"""
provision.py — One-time provisioning script.
Registers Calendly webhook subscription, initializes Gmail watch, creates Pub/Sub subscription.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.gmail_client import gmail_client
from services.calendly_client import calendly_client
from core.config import settings
from core.logging import get_logger

logger = get_logger("provision")


async def provision_calendly():
    """Register webhook subscription for invitee.created and invitee.canceled events."""
    resp = await calendly_client._request(
        "POST",
        "/webhook_subscriptions",
        json={
            "url": f"{settings.app_base_url}/webhooks/calendly",
            "events": ["invitee.created", "invitee.canceled"],
            "organization": settings.calendly_organization_url,
            "scope": "organization",
            "signing_key": settings.calendly_webhook_signing_key,
        },
    )
    if resp.status_code == 201:
        data = resp.json()
        logger.info("calendly_webhook_registered", uri=data.get("resource", {}).get("uri"))
    else:
        logger.warning("calendly_webhook_registration_may_exist", status=resp.status_code, body=resp.text[:500])


async def provision_gmail():
    """Initialize Gmail push notification watch + register Pub/Sub subscription."""
    try:
        await gmail_client.stop_watch()
    except Exception:
        pass
    result = await gmail_client.watch()
    logger.info("gmail_watch_initialized", expiration=result.get("expiration"))


async def main():
    await provision_calendly()
    await provision_gmail()


if __name__ == "__main__":
    asyncio.run(main())