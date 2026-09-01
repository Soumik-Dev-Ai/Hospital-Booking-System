"""Deterministic safeguards and structured helpers for inbound AI workflows.

These helpers run before any third-party model call. They are intentionally
provider-agnostic so webhook handlers, background jobs, and API routes share
the same normalization and safety behavior.
"""
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
from enum import Enum
from typing import Any, Awaitable, Callable, Mapping, Optional

import httpx
from pydantic import BaseModel, Field, field_validator, model_validator


class TriageIntent(str, Enum):
    BOOKING = "booking"
    CANCELLATION = "cancellation"
    RESCHEDULE = "reschedule"
    PRESCRIPTION = "prescription"
    PATIENT_REPLY = "patient_reply"


class TriageResult(BaseModel):
    """Exactly one of the five supported inbound message intents."""

    intent: TriageIntent
    confidence: float = Field(ge=0.0, le=1.0)
    needs_manual_review: bool = False
    missing_fields: list[str] = Field(default_factory=list)


class RescheduleExtraction(BaseModel):
    """Strict structured output for reschedule messages."""

    intent: str = Field(default="reschedule", pattern="^reschedule$")
    requested_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    requested_time: str | None = Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    reason: str | None = None
    needs_details: bool = False

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_reason(cls, value: Any) -> Any:
        if value is None:
            return None
        value = normalize_text(str(value))
        return value or None

    @model_validator(mode="after")
    def mark_missing_details(self) -> "RescheduleExtraction":
        self.needs_details = not bool(self.requested_date and self.requested_time)
        return self


@dataclass(frozen=True)
class IdentityMatch:
    """Outcome of a normalized fuzzy identity lookup."""

    record: Mapping[str, Any] | None
    score: float
    ambiguous: bool = False
    missing: bool = False


@dataclass(frozen=True)
class FirewallResult:
    safe: bool
    sanitized_text: str
    matched_patterns: tuple[str, ...] = ()


INJECTION_PATTERNS: tuple[str, ...] = (
    "ignore previous instructions",
    "ignore all previous",
    "disregard previous instructions",
    "system prompt",
    "developer message",
    "you are now",
    "reveal your instructions",
    "jailbreak",
    "reset your instructions",
)

ALLOWED_IMAGE_MIME_TYPES = frozenset({"image/jpeg", "image/png"})
BLOCKED_ATTACHMENT_EXTENSIONS = frozenset({".zip", ".exe", ".bat", ".cmd", ".scr", ".js", ".vbs"})


def normalize_text(value: str | None) -> str:
    """Trim, lowercase, and collapse whitespace before comparisons/lookups."""
    return " ".join((value or "").strip().lower().split())


def normalize_email(value: str | None) -> str:
    return normalize_text(value)


def fuzzy_identity_match(
    query: str,
    candidates: list[Mapping[str, Any]],
    *,
    field: str = "full_name",
    threshold: float = 0.90,
    ambiguity_delta: float = 0.02,
) -> IdentityMatch:
    """Resolve a name/email at 90% similarity and flag close ties."""
    normalized_query = normalize_text(query)
    if not normalized_query or not candidates:
        return IdentityMatch(record=None, score=0.0, missing=True)

    ranked = sorted(
        [
            (
                SequenceMatcher(None, normalized_query, normalize_text(str(item.get(field, "")))).ratio(),
                item,
            )
            for item in candidates
        ],
        reverse=True,
        key=lambda pair: pair[0],
    )
    best_score, best_record = ranked[0]
    if best_score < threshold:
        return IdentityMatch(record=None, score=best_score, missing=True)
    ambiguous = len(ranked) > 1 and (best_score - ranked[1][0]) < ambiguity_delta
    return IdentityMatch(record=best_record, score=best_score, ambiguous=ambiguous)


def classify_intent(text: str | None) -> TriageResult:
    """Classify inbound text into exactly one supported business intent."""
    normalized = normalize_text(text)
    if not normalized:
        return TriageResult(intent=TriageIntent.PATIENT_REPLY, confidence=0.0, needs_manual_review=True)

    patterns: dict[TriageIntent, tuple[str, ...]] = {
        TriageIntent.RESCHEDULE: ("reschedule", "change my appointment", "move my appointment", "different time"),
        TriageIntent.CANCELLATION: ("cancel", "cancellation", "cannot attend", "can't attend"),
        TriageIntent.PRESCRIPTION: ("prescription", "refill", "medication", "medicine"),
        TriageIntent.BOOKING: ("book", "booking", "schedule", "appointment", "availability"),
    }
    scores = {intent: sum(1 for token in tokens if token in normalized) for intent, tokens in patterns.items()}
    ranked = sorted(scores.items(), key=lambda pair: pair[1], reverse=True)
    top_intent, top_score = ranked[0]
    second_score = ranked[1][1]
    if top_score == 0:
        return TriageResult(intent=TriageIntent.PATIENT_REPLY, confidence=0.55)
    ambiguous = top_score == second_score and top_score > 0
    missing: list[str] = []
    if top_intent is TriageIntent.RESCHEDULE:
        extraction = extract_reschedule(text)
        if extraction.requested_date is None:
            missing.append("requested_date")
        if extraction.requested_time is None:
            missing.append("requested_time")
    confidence = min(0.99, 0.70 + 0.08 * top_score) if not ambiguous else 0.50
    return TriageResult(
        intent=top_intent,
        confidence=confidence,
        needs_manual_review=ambiguous or bool(missing),
        missing_fields=missing,
    )


def extract_reschedule(text: str | None) -> RescheduleExtraction:
    """Extract only explicit ISO date/time values; never invent missing data."""
    raw = text or ""
    date_match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", raw)
    time_match = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", raw)
    requested_date = date_match.group(1) if date_match else None
    if requested_date:
        try:
            date.fromisoformat(requested_date)
        except ValueError:
            requested_date = None
    requested_time = None
    if time_match:
        requested_time = f"{int(time_match.group(1)):02d}:{time_match.group(2)}"
    reason_match = re.search(r"\b(?:because|reason is|due to)\s+(.+)$", raw, flags=re.IGNORECASE)
    reason = reason_match.group(1) if reason_match else None
    return RescheduleExtraction(
        requested_date=requested_date,
        requested_time=requested_time,
        reason=reason,
    )


def sanitize_incoming_text(text: str | None) -> FirewallResult:
    """Redact known prompt-injection directives before model processing."""
    original = text or ""
    normalized = normalize_text(original)
    matched = tuple(pattern for pattern in INJECTION_PATTERNS if pattern in normalized)
    sanitized = original
    for pattern in matched:
        sanitized = re.sub(re.escape(pattern), "[redacted instruction]", sanitized, flags=re.IGNORECASE)
    return FirewallResult(safe=not matched, sanitized_text=sanitized, matched_patterns=matched)


def filter_attachments(attachments: list[Mapping[str, Any]] | None) -> tuple[list[Mapping[str, Any]], list[Mapping[str, Any]]]:
    """Return safe OCR images and rejected executable/archive attachments."""
    allowed: list[Mapping[str, Any]] = []
    rejected: list[Mapping[str, Any]] = []
    for attachment in attachments or []:
        mime = normalize_text(str(attachment.get("mime_type") or attachment.get("mimeType") or ""))
        filename = normalize_text(str(attachment.get("filename") or attachment.get("name") or ""))
        extension = "." + filename.rsplit(".", 1)[-1] if "." in filename else ""
        if mime in ALLOWED_IMAGE_MIME_TYPES and extension in {".jpg", ".jpeg", ".png"}:
            allowed.append(attachment)
        else:
            rejected.append(attachment)
    return allowed, rejected


def build_context_prompt(patient: Mapping[str, Any] | None) -> str:
    """Build a minimal PHI-aware context block from the current patient row."""
    if not patient:
        return "Patient context: unavailable. Do not infer identity or appointment details."
    name = normalize_text(str(patient.get("full_name") or "patient")).title()
    next_appointment = patient.get("next_appointment") or "not provided"
    return f"Patient context: You are speaking with {name}. Next appointment: {next_appointment}."


PROFESSIONAL_PERSONA = (
    "You are a polite, medical-grade administrative assistant. Do not diagnose or "
    "invent clinical facts. For prescriptions, explain that medication decisions "
    "must be confirmed by the treating clinician and include a concise medical disclaimer."
)


async def post_with_429_backoff(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: Mapping[str, str],
    json: Any,
    attempts: int = 4,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> httpx.Response:
    """Retry third-party calls on HTTP 429 using 2s, 4s, and 8s delays."""
    for attempt in range(attempts):
        response = await client.post(url, headers=dict(headers), json=json)
        if response.status_code != 429:
            response.raise_for_status()
            return response
        if attempt == attempts - 1:
            response.raise_for_status()
        await sleep(float(2 ** (attempt + 1)))
    raise RuntimeError("unreachable")
