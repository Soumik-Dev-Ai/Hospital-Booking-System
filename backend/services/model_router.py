"""
services/model_router.py — Smart pre-classifier that routes intakes by complexity.

Simple emails → cheap/fast provider (Groq/Cerebras).
Complex clinical emails → premium provider (Claude/GPT).

This reduces costs by routing ~60% of simple intakes away from expensive models.
"""
import re

from core.logging import get_logger

logger = get_logger("model_router")

# Medical complexity indicators — matches trigger "complex" classification.
COMPLEX_INDICATORS = [
    r"\b(surgery|surgical|transplant|chemotherapy|radiation|oncology)\b",
    r"\b(diabetes|hypertension|cardiac|renal|hepatic|cardiovascular)\b",
    r"\b(multiple\s+medications|polypharmacy|anticoagulant|insulin)\b",
    r"\b(chronic|autoimmune|immunodeficiency|immunocompromised)\b",
    r"\b(trauma|fracture|broken.*bone|dislocated)\b",
    r"\b(hemoglobin|hematocrit|bilirubin|creatinine|glomerular)\b",
    r"\b(mri|ct\s*scan|xray|x-ray|ultrasound|biopsy)\b",
]
_COMPLEX_RE = re.compile("|".join(COMPLEX_INDICATORS), re.IGNORECASE)

# Simple indicators — when present with few words, strongly suggest "simple".
SIMPLE_INDICATORS = [
    r"\b(checkup|annual\s*physical|well\s*visit|routine)\b",
    r"\b(no\s+allergies|no\s+medications|no\s+concerns|nothing\s+new)\b",
    r"\b(follow\s*up|followup)\b",
]
_SIMPLE_RE = re.compile("|".join(SIMPLE_INDICATORS), re.IGNORECASE)


def classify_complexity(raw_text: str) -> str:
    """Classify an intake email as 'simple', 'moderate', or 'complex'.

    Complexity is based on:
      - Word count (longer = more complex)
      - Presence of medical condition/surgery keywords
      - Presence of simple-visit indicators
    """
    if not raw_text or not raw_text.strip():
        return "simple"

    text = raw_text.strip()
    word_count = len(text.split())
    complex_matches = len(_COMPLEX_RE.findall(text))
    simple_matches = len(_SIMPLE_RE.findall(text))

    # High-complexity signals: many words + multiple medical terms
    if word_count > 300 or complex_matches >= 3:
        return "complex"

    # Low-complexity signals: short + simple-visit keywords
    if word_count < 80 and simple_matches > 0 and complex_matches == 0:
        return "simple"

    # Moderate baseline
    if word_count < 50 and complex_matches == 0:
        return "simple"

    if complex_matches >= 2:
        return "complex"

    return "moderate"


def get_route_for_complexity(complexity: str) -> list[tuple[str, int]]:
    """Return the provider chain for a given complexity level.

    Each tuple is (provider_name, max_attempts).
    """
    route_map = {
        "simple": [
            ("groq", 2),
            ("cerebras", 1),
            ("openrouter", 1),
        ],
        "moderate": [
            ("openrouter", 2),
            ("groq", 1),
            ("cerebras", 1),
        ],
        "complex": [
            ("openrouter", 3),
            ("nvidia_nim", 2),
        ],
    }
    return route_map.get(complexity, route_map["moderate"])


def route_intake(raw_text: str) -> tuple[str, list[tuple[str, int]]]:
    """Full routing decision: complexity + provider chain. Returns (complexity, chain)."""
    complexity = classify_complexity(raw_text)
    chain = get_route_for_complexity(complexity)
    logger.info(
        "ai_routing_decision",
        complexity=complexity,
        primary=chain[0][0],
        word_count=len(raw_text.split()) if raw_text else 0,
        chain=[name for name, _ in chain],
    )
    return complexity, chain
