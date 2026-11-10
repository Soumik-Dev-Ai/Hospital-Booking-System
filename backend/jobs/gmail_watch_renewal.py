"""
jobs/gmail_watch_renewal.py — Gmail Watch renewal job and health verification.
"""
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import GmailWatchState


async def check_watch_health(sess: AsyncSession) -> dict:
    """Check Gmail Watch lease status and health."""
    try:
        result = await sess.execute(
            select(GmailWatchState).order_by(GmailWatchState.renewed_at.desc()).limit(1)
        )
        state = result.scalar_one_or_none()
        if not state:
            return {"active": False, "error": "No watch state found"}
        now = datetime.now(timezone.utc)
        hours_remaining = (state.watch_expiration - now).total_seconds() / 3600
        return {
            "active": state.watch_expiration > now,
            "history_id": state.history_id,
            "expiration": state.watch_expiration.isoformat() if state.watch_expiration else None,
            "hours_remaining": round(hours_remaining, 2) if hours_remaining > 0 else 0,
        }
    except Exception as e:
        return {"active": False, "error": str(e)}
