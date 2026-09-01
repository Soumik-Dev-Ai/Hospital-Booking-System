"""Fuzzy matching utilities using Levenshtein distance."""

import logging
from difflib import SequenceMatcher
from typing import Optional

logger = logging.getLogger(__name__)


def levenshtein_distance(s1: str, s2: str) -> float:
    """Compute normalized Levenshtein similarity between two strings.

    Returns a similarity ratio between 0.0 (completely different) and
    1.0 (identical).
    """
    if not s1 and not s2:
        return 1.0
    if not s1 or not s2:
        return 0.0
    return SequenceMatcher(None, s1.lower(), s2.lower()).ratio()


def fuzzy_match_patient(
    input_name: str,
    candidate_names: list[str],
    threshold: float = 0.8,
) -> Optional[str]:
    """Find the best matching patient name using Levenshtein distance.

    Args:
        input_name: Name from the incoming email/webhook.
        candidate_names: List of known patient names from the database.
        threshold: Minimum similarity ratio to accept a match.

    Returns:
        The best matching name, or None if no match exceeds the threshold.
    """
    if not input_name or not candidate_names:
        return None

    best_name = None
    best_score = 0.0

    for candidate in candidate_names:
        score = levenshtein_distance(input_name, candidate)
        if score > best_score:
            best_score = score
            best_name = candidate

    if best_score >= threshold:
        logger.info(
            "Fuzzy match: '%s' -> '%s' (score=%.3f)",
            input_name, best_name, best_score,
        )
        return best_name

    logger.warning(
        "No fuzzy match for '%s' (best=%.3f < threshold=%.2f)",
        input_name, best_score, threshold,
    )
    return None


def find_patient_by_email(
    input_email: str,
    candidate_emails: list[str],
    threshold: float = 0.85,
) -> Optional[str]:
    """Fuzzy match an email address against known emails."""
    return fuzzy_match_patient(input_email, candidate_emails, threshold)


def normalize_name(name: str) -> str:
    """Normalize a name for comparison: lowercase, strip whitespace."""
    return " ".join(name.lower().split())
