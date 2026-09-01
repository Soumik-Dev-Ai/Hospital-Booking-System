from datetime import datetime, timezone, date, timedelta
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.security import require_admin
from core.logging import get_logger
from core.config import settings
from models import (
    Appointment, AppointmentStatus, Patient, GmailWatchState, DailyBriefing,
)
from schemas.schemas import DashboardTodayOut, AppointmentOut

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
logger = get_logger("api.dashboard")


def _clinic_today_window() -> tuple[datetime, datetime]:
    """Return the (start, end) of 'today' in the clinic's configured timezone, expressed as UTC for queries."""
    import zoneinfo
    tz = zoneinfo.ZoneInfo(settings.clinic_timezone)
    now_clinic = datetime.now(tz)
    today_local = now_clinic.date()
    day_start_local = datetime.combine(today_local, datetime.min.time(), tzinfo=tz)
    day_end_local = datetime.combine(today_local, datetime.max.time(), tzinfo=tz)
    return day_start_local.astimezone(timezone.utc), day_end_local.astimezone(timezone.utc)


@router.get("/today", response_model=DashboardTodayOut)
async def dashboard_today(
    doctor_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    day_start, day_end = _clinic_today_window()

    query = (
        select(Appointment)
        .where(Appointment.scheduled_at >= day_start)
        .where(Appointment.scheduled_at <= day_end)
        .order_by(Appointment.scheduled_at)
    )
    if doctor_id is not None:
        query = query.where(Appointment.doctor_id == doctor_id)
    result = await db.execute(query)
    appointments = result.scalars().all()
    appt_out = [AppointmentOut.model_validate(a) for a in appointments]

    pending = sum(1 for a in appointments if a.status == AppointmentStatus.PENDING_INTAKE)
    compliant = sum(1 for a in appointments if a.status == AppointmentStatus.COMPLIANT)
    warned = sum(1 for a in appointments if a.status == AppointmentStatus.WARNED)
    cancelled = sum(1 for a in appointments if a.status == AppointmentStatus.AUTO_CANCELLED)

    watch_result = await db.execute(
        select(GmailWatchState).order_by(GmailWatchState.renewed_at.desc()).limit(1)
    )
    watch = watch_result.scalar_one_or_none()
    watch_healthy = watch is not None and watch.watch_expiration > datetime.now(timezone.utc)
    watch_exp = watch.watch_expiration if watch else None

    last_cron_result = await db.execute(
        select(DailyBriefing).order_by(DailyBriefing.created_at.desc()).limit(1)
    )
    last_cron = last_cron_result.scalar_one_or_none()
    last_cron_run = last_cron.created_at if last_cron else None

    return DashboardTodayOut(
        appointments=appt_out,
        total=len(appt_out),
        pending_intake=pending,
        compliant=compliant,
        warned=warned,
        auto_cancelled=cancelled,
        gmail_watch_healthy=watch_healthy,
        gmail_watch_expiration=watch_exp,
        last_cron_run=last_cron_run,
    )


@router.get("/stats")
async def dashboard_stats(
    range: str = Query("7d"),
    doctor_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    days = 7
    if range == "30d":
        days = 30
    since = datetime.now(timezone.utc) - timedelta(days=days)

    base = select(Appointment.id).where(Appointment.created_at >= since)
    if doctor_id is not None:
        base = base.where(Appointment.doctor_id == doctor_id)

    total_appts = await db.scalar(select(func.count()).select_from(base.subquery()))
    compliant = base.where(Appointment.status == AppointmentStatus.COMPLIANT)
    compliant_count = await db.scalar(select(func.count()).select_from(compliant.subquery()))
    cancelled = base.where(Appointment.status == AppointmentStatus.AUTO_CANCELLED)
    cancelled_count = await db.scalar(select(func.count()).select_from(cancelled.subquery()))

    return {
        "total_appointments": total_appts or 0,
        "compliant": compliant_count or 0,
        "auto_cancelled": cancelled_count or 0,
        "compliance_rate": round((compliant_count or 0) / max(total_appts or 1, 1) * 100, 1),
    }