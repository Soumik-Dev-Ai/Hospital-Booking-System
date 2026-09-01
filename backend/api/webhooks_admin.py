"""
api/webhooks_admin.py — Admin endpoint to replay failed webhook events.

A failed webhook (Gmail push or Calendly) is stored with its raw_payload in the
WebhookEvent table. This endpoint lets an admin re-dispatch a failed event for
re-processing, which is essential for recovering from transient provider failures.
"""
import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_admin
from core.logging import get_logger
from models import WebhookEvent
from api.lives import broadcast_event

logger = get_logger("api.webhooks_admin")

router = APIRouter(prefix="/api/admin", tags=["webhooks-admin"])


@router.post("/webhooks/{event_id}/replay", response_model=dict)
async def replay_webhook(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    """Re-process a failed webhook event from the stored raw_payload.

    Idempotent: already-processed events (processed_at is set) are rejected.
    """
    from sqlalchemy import select

    result = await db.execute(select(WebhookEvent).where(WebhookEvent.id == event_id))
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="Webhook event not found")
    if event.processed_at is not None:
        raise HTTPException(status_code=400, detail="Event already processed — not replayable")
    if not event.error_message:
        raise HTTPException(status_code=400, detail="Event has no error — nothing to replay")

    # Re-dispatch based on source
    try:
        if event.source == "calendly":
            await _handle_calendly_replay(db, event)
        elif event.source == "gmail":
            await _handle_gmail_replay(db, event)
        else:
            raise ValueError(f"Unknown webhook source: {event.source}")
    except Exception as replay_err:
        logger.error("webhook_replay_failed", event_id=str(event_id), error=str(replay_err))
        raise HTTPException(
            status_code=500,
            detail=f"Replay failed: {replay_err}",
        )

    # Mark as processed on successful replay
    event.error_message = None
    event.processed_at = datetime.now(timezone.utc)
    await db.commit()

    logger.info("webhook_replayed", event_id=str(event_id), source=event.source)
    await broadcast_event("webhook.replayed", {
        "event_id": str(event_id),
        "source": event.source,
        "replayed_by": staff["email"],
    })
    return {"status": "replayed", "event_id": str(event_id), "source": event.source}


async def _handle_calendly_replay(db: AsyncSession, event: WebhookEvent) -> None:
    """Re-dispatch a Calendly webhook payload by re-reading it from raw_payload."""
    from webhooks.calendly import handle_booking_webhook
    payload = event.raw_payload or {}
    await handle_booking_webhook(db, payload)


async def _handle_gmail_replay(db: AsyncSession, event: WebhookEvent) -> None:
    """Re-dispatch a Gmail Pub/Sub webhook payload by re-reading it from raw_payload."""
    from webhooks.gmail import handle_gmail_push
    payload = event.raw_payload or {}
    await handle_gmail_push(db, payload)
