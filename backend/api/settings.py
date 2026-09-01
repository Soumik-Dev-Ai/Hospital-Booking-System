import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import require_admin
from core.config import settings
from models import ClinicSettings, GmailWatchState
from schemas.schemas import ClinicSettingsOut, ClinicSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=ClinicSettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(ClinicSettings).limit(1))
    cs = result.scalar_one_or_none()
    if cs is None:
        cs = ClinicSettings(
            id=uuid.uuid4(),
            warning_hours_before=settings.warning_hours_before,
            reminder_hours_before=settings.reminder_hours_before,
            compliance_threshold_pct=settings.compliance_threshold_pct,
            daily_cron_time=settings.daily_cron_time,
            dry_run_mode=settings.dry_run_mode,
        )
        db.add(cs)
        await db.flush()
        await db.commit()

    watch_result = await db.execute(
        select(GmailWatchState).order_by(GmailWatchState.renewed_at.desc()).limit(1)
    )
    watch = watch_result.scalar_one_or_none()

    return ClinicSettingsOut(
        id=cs.id,
        warning_hours_before=cs.warning_hours_before,
        reminder_hours_before=cs.reminder_hours_before,
        compliance_threshold_pct=cs.compliance_threshold_pct,
        daily_cron_time=cs.daily_cron_time,
        dry_run_mode=cs.dry_run_mode,
        calendly_webhook_ok=True,
        gmail_watch_expiration=watch.watch_expiration if watch else None,
    )


@router.put("", response_model=ClinicSettingsOut)
async def update_settings(
    body: ClinicSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(ClinicSettings).limit(1))
    cs = result.scalar_one_or_none()
    if cs is None:
        cs = ClinicSettings(id=uuid.uuid4())
        db.add(cs)

    if body.warning_hours_before is not None:
        cs.warning_hours_before = body.warning_hours_before
    if body.reminder_hours_before is not None:
        cs.reminder_hours_before = body.reminder_hours_before
    if body.compliance_threshold_pct is not None:
        cs.compliance_threshold_pct = body.compliance_threshold_pct
    if body.daily_cron_time is not None:
        cs.daily_cron_time = body.daily_cron_time
    if body.dry_run_mode is not None:
        cs.dry_run_mode = body.dry_run_mode

    await db.commit()
    await db.refresh(cs)

    return ClinicSettingsOut(
        id=cs.id,
        warning_hours_before=cs.warning_hours_before,
        reminder_hours_before=cs.reminder_hours_before,
        compliance_threshold_pct=cs.compliance_threshold_pct,
        daily_cron_time=cs.daily_cron_time,
        dry_run_mode=cs.dry_run_mode,
        calendly_webhook_ok=True,
        gmail_watch_expiration=None,
    )