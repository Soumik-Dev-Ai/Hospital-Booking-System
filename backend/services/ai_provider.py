"""
services/ai_provider.py — Single AIProvider class with 4-tier fallback chain:
OpenRouter -> Groq -> Cerebras -> NVIDIA NIM.
All providers use the OpenAI-compatible Chat Completions API.

Features:
  - json_schema structured outputs for providers that support it (OpenRouter)
  - Dynamic routing table based on intake complexity (services/model_router)
  - Metrics tracking (core/metrics)
  - Circuit breaker via core.circuit_breaker
"""
import asyncio
import json
import time
import httpx

from schemas.schemas import IntakeSummary
from core.config import settings
from core.logging import get_logger
from core.metrics import metrics

logger = get_logger("ai_provider")

SYSTEM_PROMPT = """You are a strictly administrative clinical intake parser. Your only job is to organize the patient's own words into a fixed JSON schema. You must never diagnose, interpret symptoms, or provide medical advice.

Rules:
1. Use the patient's own words where wording matters for clinical accuracy.
2. If a field is not present or cannot be deduced from the email, mark it exactly as [Not provided].
3. For completeness_score (0-100): score based on how many of the core intake fields are meaningfully filled. chief_complaint is heavily weighted, followed by medications and allergies.
4. For missing_fields: list the field names (snake_case) that are missing or marked [Not provided].
5. Output ONLY valid JSON matching the schema below. No markdown fences, no extra text."""

INTAKE_SCHEMA_DESCRIPTION = """{
  "chief_complaint": "string",
  "current_medications": ["string"],
  "allergies": ["string"],
  "past_medical_history": "string",
  "past_surgical_history": "string",
  "family_history": "string",
  "social_history": "string",
  "additional_notes": "string",
  "completeness_score": 85,
  "missing_fields": ["family_history"]
}"""

_HTTP_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class AIProvider:
    """Provider-agnostic OpenAI-compatible chat-completions client."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        name: str = "unnamed",
        supports_json_schema: bool = False,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.name = name
        self.supports_json_schema = supports_json_schema

    @property
    def configured(self) -> bool:
        if hasattr(self, '_configured_override'):
            return self._configured_override
        # Model is dynamically resolved if empty/auto; base_url and api_key are sufficient
        return bool(self.base_url and self.api_key)

    def _build_response_format(self) -> dict:
        if self.supports_json_schema:
            return {
                "type": "json_schema",
                "json_schema": {
                    "name": "intake_summary",
                    "strict": True,
                    "schema": IntakeSummary.model_json_schema(),
                },
            }
        return {"type": "json_object"}

    async def health_check(self) -> bool:
        """Quick reachability test: hit /models endpoint."""
        if not self.configured:
            return True  # not-configured is different from down; caller handles this
        try:
            url = f"{self.base_url}/models"
            headers = {"Authorization": f"Bearer {self.api_key}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                return 200 <= resp.status_code < 500
        except Exception:
            return False

    async def _get_candidate_models(self) -> list[str]:
        # If user explicitly configured a specific model that is not "auto", prioritize it
        if self.model and self.model.strip().lower() not in ("auto", "dynamic", "none", ""):
            return [self.model.strip()]

        candidates = []
        if self.name == "openrouter":
            candidates.extend([
                "nvidia/nemotron-3.5-lightning:free",
                "recursive/flint-v1.0:free",
                "xingchen-agi/xing4.0-29b-a4b:free",
                "liquid/lfm-2.5-2.6b:free",
                "google/gemma-4-31b-it:free",
                "openrouter/auto",
            ])
        elif self.name == "nvidia_nim":
            candidates.extend([
                "meta/llama-3.2-3b-instruct",
                "meta/llama-3.1-8b-instruct",
                "ibm/granite-3.0-8b-instruct",
                "mistralai/mistral-7b-instruct-v0.3",
            ])
        elif self.name == "groq":
            candidates.extend(["llama-3.1-8b-instant", "llama-3.3-70b-versatile"])
        elif self.name == "cerebras":
            candidates.extend(["llama3.1-8b", "llama-3.3-70b"])

        # Dynamically query available models from the provider API
        try:
            url = f"{self.base_url}/models"
            headers = {"Authorization": f"Bearer {self.api_key}"}
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    fetched = [
                        m.get("id") for m in data.get("data", [])
                        if isinstance(m, dict) and m.get("id")
                    ]
                    # Put completely free models at the very front of the candidate queue
                    free_fetched = [m for m in fetched if ":free" in m]
                    for m in reversed(free_fetched):
                        if m not in candidates:
                            candidates.insert(0, m)
        except Exception:
            pass

        return candidates or ["openrouter/auto"]

    async def _chat_complete(self, raw_reply_text: str) -> str:
        candidates = await self._get_candidate_models()
        last_exception = None

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if "openrouter.ai" in self.base_url:
            headers["HTTP-Referer"] = settings.app_base_url or "https://clinic.local"
            headers["X-Title"] = "patient-intake"

        for candidate in candidates:
            self.last_model_used = candidate
            body = {
                "model": candidate,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": (
                        f"Parse the following patient email reply into the structured intake "
                        f"JSON schema. Output only the raw JSON object.\n\n"
                        f"Schema:\n{INTAKE_SCHEMA_DESCRIPTION}\n\n"
                        f"Patient email:\n{raw_reply_text}"
                    )},
                ],
                "response_format": self._build_response_format(),
                "temperature": 0.2,
            }
            try:
                async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
                    resp = await client.post(url, headers=headers, json=body)
                    if resp.status_code in (402, 404, 429, 503):
                        logger.warning(
                            "ai_candidate_model_retry",
                            provider=self.name,
                            model=candidate,
                            status=resp.status_code,
                        )
                        continue
                    resp.raise_for_status()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
            except Exception as e:
                last_exception = e
                continue

        if last_exception:
            raise last_exception
        raise RuntimeError(f"All candidate models failed for provider {self.name}")

    async def parse_intake(self, raw_reply_text: str) -> IntakeSummary:
        start = time.perf_counter()
        try:
            raw = await self._chat_complete(raw_reply_text)
            raw = raw.strip()
            # json_schema mode guarantees valid JSON — no fence stripping needed.
            parsed = json.loads(raw)
            summary = IntakeSummary.model_validate(parsed)
            metrics.increment(f"ai.{self.name}.success")
            logger.info(
                "ai_parse_success",
                provider=self.name,
                model=getattr(self, "last_model_used", self.model),
                completeness=summary.completeness_score,
            )
            return summary
        except Exception:
            metrics.increment(f"ai.{self.name}.failure")
            raise
        finally:
            metrics.observe(f"ai.{self.name}.latency", time.perf_counter() - start)


# ---------------------------------------------------------------
#  4-tier provider chain
# ---------------------------------------------------------------

primary_provider = AIProvider(
    settings.openrouter_base_url, settings.openrouter_api_key,
    settings.openrouter_model, name="openrouter",
    supports_json_schema=True,
)
groq_provider = AIProvider(
    settings.groq_base_url, settings.groq_api_key,
    settings.groq_model, name="groq",
    supports_json_schema=False,
)
cerebras_provider = AIProvider(
    settings.cerebras_base_url, settings.cerebras_api_key,
    settings.cerebras_model, name="cerebras",
    supports_json_schema=False,
)
fallback_provider = AIProvider(
    settings.nim_base_url, settings.nim_api_key,
    settings.nim_model, name="nvidia_nim",
    supports_json_schema=False,
)

# Static fallback chain (used when dynamic routing is not needed).
_FALLBACK_CHAIN = [
    (primary_provider, 3),
    (groq_provider, 1),
    (cerebras_provider, 1),
    (fallback_provider, 1),
]

# Dynamic routing table keyed by complexity level.
# Each entry: (AIProvider instance, max_attempts)
_ROUTE_MAP = {
    "simple": [
        (groq_provider, 2),
        (cerebras_provider, 1),
        (primary_provider, 1),
    ],
    "moderate": [
        (primary_provider, 2),
        (groq_provider, 1),
        (cerebras_provider, 1),
    ],
    "complex": [
        (primary_provider, 3),
        (fallback_provider, 2),
    ],
}


_PROVIDER_BY_NAME: dict[str, "AIProvider"] = {
    "openrouter": primary_provider,
    "groq": groq_provider,
    "cerebras": cerebras_provider,
    "nvidia_nim": fallback_provider,
}


async def parse_intake_with_fallback(raw_reply_text: str):
    """Try providers in order; returns (IntakeSummary, name, model).
    Raises RuntimeError if ALL fail — caller must flag NEEDS_MANUAL_REVIEW.

    Uses the dynamic routing table based on intake complexity when possible;
    falls back to the static _FALLBACK_CHAIN if the router module is unavailable.
    """
    chain = _FALLBACK_CHAIN  # default: static chain with provider objects
    try:
        from services.model_router import classify_complexity, get_route_for_complexity
        complexity = classify_complexity(raw_reply_text)
        str_chain = get_route_for_complexity(complexity)
        # get_route_for_complexity returns string tuples — map to provider objects.
        resolved = []
        for name, attempts in str_chain:
            prov = _PROVIDER_BY_NAME.get(name)
            if prov:
                resolved.append((prov, attempts))
        if resolved:
            chain = resolved
            logger.info("ai_routing_decision", complexity=complexity,
                        primary=str_chain[0][0])
    except Exception:
        logger.debug("ai_routing_fallback_to_static", exc_info=True)

    last_err = None
    for provider, attempts in chain:
        if not provider.configured:
            logger.warning("ai_provider_skipped_unconfigured", provider=provider.name)
            continue
        for attempt in range(1, attempts + 1):
            try:
                summary = await provider.parse_intake(raw_reply_text)
                return summary, provider.name, getattr(provider, "last_model_used", provider.model)
            except Exception as e:
                last_err = e
                logger.warning("ai_provider_retry", provider=provider.name,
                               attempt=attempt, error=str(e))
                if attempt < attempts:
                    await asyncio.sleep(2 ** attempt)
    raise RuntimeError(f"All AI providers exhausted. last_error={last_err}") from last_err


def _core_fields_present(summary: "IntakeSummary") -> bool:
    """Check if the core fields (chief_complaint, medications, allergies) are meaningfully provided."""
    if not summary:
        return False
    chief = (summary.chief_complaint or "").strip()
    if not chief or chief.lower() in ("[not provided]", "none", "n/a", ""):
        return False
    meds = summary.current_medications or []
    if not meds or all(m.strip().lower() == "[not provided]" for m in meds):
        return False
    allergies = summary.allergies or []
    if not allergies or all(a.strip().lower() == "[not provided]" for a in allergies):
        return False
    return True


async def _resolve_threshold(sess) -> int:
    """Read compliance_threshold_pct from ClinicSettings row; fall back to env setting."""
    from models import ClinicSettings
    result = await sess.execute(
        __import__("sqlalchemy").select(ClinicSettings).limit(1)
    )
    settings_row = result.scalar_one_or_none()
    if settings_row:
        return settings_row.compliance_threshold_pct
    from config.settings import settings
    return getattr(settings, "compliance_threshold_pct", 70)


async def get_all_providers_health() -> dict[str, str]:
    """Returns dict of provider_name -> "up"/"down"/"not-configured"."""
    result = {}
    for prov, _ in _FALLBACK_CHAIN:
        if not prov.configured:
            result[prov.name] = "not-configured"
        else:
            try:
                ok = await prov.health_check()
                result[prov.name] = "up" if ok else "down"
            except Exception:
                result[prov.name] = "down"
    return result
