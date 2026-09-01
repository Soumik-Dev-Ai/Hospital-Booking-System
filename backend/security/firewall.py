"""Prompt Injection Firewall.

Routes all raw user text through a moderation/LLM guardrail before it
touches the extraction pipeline. On a positive detection the user is
quarantined.
"""

import logging
from typing import Optional
from uuid import UUID

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from config.settings import settings
from database.models import QuarantinedUser
from database.schemas import LoginRequest

logger = logging.getLogger(__name__)

# Keywords that indicate prompt injection attempts
INJECTION_PATTERNS = [
    "ignore all previous",
    "system prompt",
    "you are now",
    "disregard",
    "pretend that",
    "role play",
    "jailbreak",
    "override",
    "reset your instructions",
]


class PromptInjectionFirewall:
    """Lightweight firewall that blocks known injection patterns and
    optionally calls an external moderation API."""

    def __init__(self, api_key: Optional[str] = None, api_url: Optional[str] = None):
        self.api_key = api_key or settings.moderation_api_key
        self.api_url = api_url or settings.moderation_api_url
        self._blocked = set()

    def is_safe(self, text: str) -> bool:
        """Return True if the text passes the firewall."""
        if not text:
            return True
        lower = text.lower()
        for pattern in INJECTION_PATTERNS:
            if pattern in lower:
                logger.warning("Injection pattern detected: '%s'", pattern)
                return False
        return True

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=30),
        reraise=True,
    )
    async def classify_remote(self, text: str) -> bool:
        """Call an external moderation API with exponential backoff."""
        if not self.api_key or not self.api_url:
            # Fall back to local check if no API key configured
            return self.is_safe(text)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"text": text},
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()
            # Adjust based on your moderation API's response schema
            return not data.get("flagged", False)

    async def quarantine_user(self, user_id: UUID, reason: str) -> None:
        """Add a user to the QuarantinedUsers table."""
        from database import async_session_factory
        async with async_session_factory() as db:
            existing = await db.get(QuarantinedUser, user_id)
            if existing:
                existing.reason = reason
                existing.flagged_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
            else:
                quarantine = QuarantinedUser(user_id=user_id, reason=reason)
                db.add(quarantine)
            await db.commit()
        logger.warning("User %s quarantined: %s", user_id, reason)


firewall = PromptInjectionFirewall()
