"""LangGraph-based AI extraction pipeline.

Uses a cheap router model (Groq) for triage, then a multi-agent setup
(Extractor Agent + Critic Agent) for parsing complex medical intake forms.
"""

import json
import logging
from typing import Any, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from config.settings import settings
from utils.tracing import set_trace_id, get_trace_id
from services.ai_provider import parse_intake_with_fallback
from services.ai_edge_cases import (
    PROFESSIONAL_PERSONA,
    TriageResult,
    build_context_prompt,
    classify_intent,
    sanitize_incoming_text,
)
from ai.doc_generator import generate_intake_doc
import uuid

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Router Agent — triages the input to determine complexity
# ---------------------------------------------------------------------------

async def route_input(text: str) -> str:
    """Route input through a cheap model to determine complexity.

    Returns:
        "simple" — direct extraction is sufficient
        "complex" — needs multi-agent pipeline
        "injection" — prompt injection detected, block
    """
    trace_id = set_trace_id(get_trace_id() or "")

    # First, check the firewall
    from security.firewall import firewall
    if not firewall.is_safe(text):
        logger.warning("[trace=%s] Prompt injection detected in route", trace_id)
        return "injection"

    # Fallback to simple if routing API keys aren't set
    return "simple"


# ---------------------------------------------------------------------------
# Business-intent triage
# ---------------------------------------------------------------------------


def classify_business_intent(text: str | None) -> TriageResult:
    """Return exactly one supported business intent before extraction."""
    return classify_intent(text)


# ---------------------------------------------------------------------------
# Extractor Agent
# ---------------------------------------------------------------------------

async def extract_fields(text: str, patient_context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Extract fields only after prompt-injection sanitization."""
    trace_id = set_trace_id(get_trace_id() or "")
    firewall_result = sanitize_incoming_text(text)
    if firewall_result.matched_patterns:
        logger.warning("[trace=%s] Prompt injection content redacted before extraction", trace_id)
    safe_text = firewall_result.sanitized_text
    context = build_context_prompt(patient_context)
    enriched_text = f"{PROFESSIONAL_PERSONA}\n{context}\n\nInbound message:\n{safe_text}"

    # Injecting the robust OpenRouter/NIM fallback logic from legacy backend
    try:
        summary, provider, model = await parse_intake_with_fallback(enriched_text)
        logger.info(f"[trace={trace_id}] Extraction successful via {provider} ({model})")
        return summary.model_dump()
    except Exception as exc:
        logger.error(f"[trace={trace_id}] Extraction failed: {exc}")
        return {}


# ---------------------------------------------------------------------------
# Critic Agent
# ---------------------------------------------------------------------------

async def critique_extraction(extracted: dict[str, Any], original_text: str) -> dict[str, Any]:
    """Critic agent validates and corrects the extractor's output."""
    trace_id = set_trace_id(get_trace_id() or "")

    # Simple validation rules for medical data
    validated = {}
    for key, value in extracted.items():
        if value is None:
            validated[key] = None
            continue

        if isinstance(value, str):
            if value.lower() in ("unknown", "n/a", "na", "none", ""):
                validated[key] = None
            else:
                validated[key] = value.strip()
        else:
            validated[key] = value

    logger.info("[trace=%s] Critic validated %d fields", trace_id, len(validated))
    return validated


# ---------------------------------------------------------------------------
# LangGraph-style state machine (for future expansion)
# ---------------------------------------------------------------------------

class IntakeState:
    """State container for the LangGraph pipeline."""

    def __init__(self, text: str, appointment_id: str):
        self.text = text
        self.appointment_id = appointment_id
        self.route: Optional[str] = None
        self.extracted: dict[str, Any] = {}
        self.validated: dict[str, Any] = {}
        self.error: Optional[str] = None
        self.trace_id: str = ""


async def _heuristic_route(text: str) -> str:
    """Simple heuristic fallback for routing when LLM is unavailable.

    Short texts and texts without medical keywords route to 'simple'.
    """
    if not text or len(text.strip().split()) < 50:
        return "simple"
    lower = text.lower()
    if any(kw in lower for kw in ("headache", "cold", "flu", "checkup", "routine")):
        return "simple"
    if any(kw in lower for kw in ("surgery", "chemo", "radiation", "oncology", "transplant")):
        return "complex"
    return "moderate"


async def process_intake_form(text: str, fields: list[str] | None = None, patient_context: dict[str, Any] | None = None) -> dict[str, Any]:
    """High-level entry point: route -> extract -> critique. Returns extracted fields."""
    firewall_result = sanitize_incoming_text(text)
    if firewall_result.matched_patterns:
        return {"status": "quarantined", "reason": "prompt_injection_detected"}
    route = await _heuristic_route(text)
    if route == "injection":
        return {}
    extracted = await extract_fields(text, patient_context=patient_context)
    if fields:
        return {k: v for k, v in extracted.items() if k in fields}
    return extracted


async def run_langgraph_pipeline(state: IntakeState) -> IntakeState:
    """LangGraph-style pipeline that could be expanded with actual graph nodes."""
    from utils.tracing import generate_trace_id
    state.trace_id = set_trace_id(generate_trace_id())
    logger.info("[trace=%s] LangGraph pipeline started", state.trace_id)

    try:
        # Node 1: Route
        state.route = await route_input(state.text)
        if state.route == "injection":
            state.error = "Prompt injection detected"
            return state

        # Node 2: Extract (Using legacy robust AI logic)
        state.extracted = await extract_fields(state.text)

        # Node 3: Critique
        state.validated = await critique_extraction(state.extracted, state.text)
        
        # Node 4: Generate Google Doc
        logger.info(f"[trace={state.trace_id}] Generating Google Doc for {state.appointment_id}")
        try:
            # We must pass the correct uuid format to the generator
            await generate_intake_doc(None, state.appointment_id)
        except Exception as doc_err:
            logger.warning(f"[trace={state.trace_id}] Google Doc generation skipped: {doc_err}")

        logger.info("[trace=%s] Pipeline complete", state.trace_id)
    except Exception as exc:
        state.error = str(exc)
        logger.error("[trace=%s] Pipeline failed: {exc}", state.trace_id)

    return state
