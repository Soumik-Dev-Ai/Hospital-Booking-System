"""
services/gemini_client.py — Legacy Gemini AI path (kept for tests and
environments where OpenRouter/NIM are not configured).

Uses Gemini SDK's native structured output when available.
"""
import asyncio
import json

import google.generativeai as genai

from schemas.schemas import IntakeSummary
from core.config import settings
from core.logging import get_logger
from core.metrics import metrics

logger = get_logger("gemini")

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


class GeminiClient:
    def __init__(self):
        self.model_name = settings.gemini_model
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=IntakeSummary,
            ),
        )

    async def parse_intake(self, raw_reply_text: str) -> IntakeSummary:
        prompt = (
            f"Parse the following patient email reply into the structured intake JSON schema. "
            f"Output only the raw JSON object.\n\n"
            f"Schema:\n{INTAKE_SCHEMA_DESCRIPTION}\n\n"
            f"Patient email:\n{raw_reply_text}"
        )
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: self.model.generate_content(prompt))
        raw = response.text.strip()
        parsed = json.loads(raw)
        summary = IntakeSummary.model_validate(parsed)
        metrics.increment("ai.gemini.success")
        logger.info("gemini_parse_success", completeness=summary.completeness_score)
        return summary

    async def health_check(self) -> bool:
        if not settings.gemini_api_key:
            return False
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: self.model.generate_content("hi"))
            return True
        except Exception:
            return False


class _LazyGeminiClient:
    """Lazy-initializes GeminiClient so module import never fails when API key is missing."""
    def __init__(self):
        self._client = None

    def _get(self):
        if self._client is None:
            self._client = GeminiClient()
        return self._client

    def __getattr__(self, name):
        return getattr(self._get(), name)


gemini_client = _LazyGeminiClient()
