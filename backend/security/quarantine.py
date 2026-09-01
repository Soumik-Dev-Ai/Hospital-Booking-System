"""Quarantine system for flagged users."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import QuarantinedUser, User

logger = logging.getLogger(__name__)


async def is_quarantined(user_id: UUID, db: AsyncSession) -> bool:
    """Check if a user is in the quarantine table."""
    result = await db.execute(
        select(QuarantinedUser).where(QuarantinedUser.user_id == user_id)
    )
    record = result.scalar_one_or_none()
    return record is not None


async def quarantine_user(user_id: UUID, reason: str, db: AsyncSession) -> None:
    """Add a user to the quarantine table."""
    existing = await db.execute(
        select(QuarantinedUser).where(QuarantinedUser.user_id == user_id)
    )
    record = existing.scalar_one_or_none()

    import datetime
    if record:
        record.reason = reason
        record.flagged_at = datetime.datetime.now(datetime.timezone.utc)
    else:
        record = QuarantinedUser(user_id=user_id, reason=reason)
        db.add(record)

    await db.commit()
    logger.warning("User %s quarantined: %s", user_id, reason)


async def unquarantine_user(user_id: UUID, db: AsyncSession) -> None:
    """Remove a user from the quarantine table."""
    result = await db.execute(
        select(QuarantinedUser).where(QuarantinedUser.user_id == user_id)
    )
    record = result.scalar_one_or_none()
    if record:
        await db.delete(record)
        await db.commit()
        logger.info("User %s unquarantined", user_id)


async def update_user_quarantine_flag(user_id: UUID, is_quarantined_flag: bool, db: AsyncSession) -> None:
    """Update the is_quarantined flag on the User model."""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if user:
        user.is_quarantined = is_quarantined_flag
        await db.commit()
        logger.info("User %s quarantine flag set to %s", user_id, is_quarantined_flag)
