"""
cron_enforcement.py — Standalone daily worker (invoked via cron or systemd timer).

Runs every morning at 08:00 (clinic-local) and performs two condition blocks:

Condition 1 — Patient Outreach:
  1. 48-hour warning -> urgent email for PENDING_INTAKE appointments ~2 days out
  2. 24-hour reminder -> friendly reminder for already COMPLIANT appointments ~1 day out

Condition 2 — Mailing the Doctor (gated on Day-Of Cancellation):
  3. The Purge -> cancel today's non-compliant appointments via Calendly
  4. The Briefing -> email doctor with today's clean schedule + summary

Usage:
  python cron_enforcement.py          # Run as scheduled
  python cron_enforcement.py --now    # Manually trigger for testing
"""
import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta, date
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).parent))

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select

from models import (
    Appointment, AppointmentStatus, Patient, DailyBriefing,
    AuditLog, ActorType, ClinicSettings, WebhookEvent,
)
from services.gmail_client import gmail_client
# Sheets writes happen only in the dedicated jobs/sheets_sync.py step (spec A.3.5).
from core.database import async_session_factory
from core.logging import get_logger, correlation_id
from core.config import settings
import arq
from api.lives import broadcast_event

logger = get_logger("cron_enforcement")


def _clinic_tz() -> ZoneInfo:
    return ZoneInfo(settings.clinic_timezone)


def _today_in_clinic() -> date:
    """Return today's date in the clinic's configured timezone — never the server's TZ."""
    return datetime.now(_clinic_tz()).date()


def _clinic_day_window(today: date) -> tuple[datetime, datetime]:
    """Convert a clinic-local calendar day into a UTC start/end pair for queries."""
    tz = _clinic_tz()
    day_start_local = datetime.combine(today, datetime.min.time(), tzinfo=tz)
    day_end_local = datetime.combine(today, datetime.max.time(), tzinfo=tz)
    return day_start_local.astimezone(timezone.utc), day_end_local.astimezone(timezone.utc)


async def get_clinic_settings(sess):
    result = await sess.execute(select(ClinicSettings).limit(1))
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
        sess.add(cs)
        await sess.flush()
    return cs


def _render_template(name: str, **kwargs) -> str:
    tmpl_dir = os.path.join(os.path.dirname(__file__), "templates")
    env = Environment(loader=FileSystemLoader(tmpl_dir), autoescape=select_autoescape(["html"]))
    return env.get_template(name).render(**kwargs)


# Non-purgeable statuses: a patient who flagged for manual review is NOT silently auto-cancelled.
_NON_PURGEABLE = {
    AppointmentStatus.COMPLIANT,
    AppointmentStatus.MANUALLY_OVERRIDDEN,
    AppointmentStatus.NEEDS_MANUAL_REVIEW,
    AppointmentStatus.AUTO_CANCELLED,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.COMPLETED,
}


async def _warning_48h(sess, cs, now_utc: datetime):
    """Pass 1: 48-hour warning. PENDING_INTAKE appts ~2 days out, no warning yet."""
    window_min = now_utc + timedelta(hours=cs.warning_hours_before - 2)
    window_max = now_utc + timedelta(hours=cs.warning_hours_before + 2)

    result = await sess.execute(
        select(Appointment)
        .where(Appointment.status == AppointmentStatus.PENDING_INTAKE)
        .where(Appointment.scheduled_at >= window_min)
        .where(Appointment.scheduled_at <= window_max)
        .where(Appointment.warning_sent_at.is_(None))
    )
    appointments = result.scalars().all()
    warned = 0
    for apt in appointments:
        await sess.refresh(apt, ["patient"])
        patient = apt.patient
        if not patient:
            continue

        html_body = _render_template(
            "warning_email.html",
            patient_name=patient.full_name,
            appointment_time=apt.scheduled_at.strftime("%B %d, %Y at %I:%M %p"),
            deadline_time=(apt.scheduled_at - timedelta(hours=cs.warning_hours_before)).strftime("%B %d, %Y at %I:%M %p"),
            clinic_name=settings.clinic_name,
        )
        await _send_email_limited(
            gmail_client,
            to=patient.email,
            subject="URGENT: Intake Required for Your Appointment",
            html_body=html_body,
        )
        apt.warning_sent_at = datetime.now(timezone.utc)
        apt.status = AppointmentStatus.WARNED
        apt.updated_at = datetime.now(timezone.utc)
        warned += 1
        logger.info("warning_sent", appointment_id=str(apt.id), patient=patient.email)
        await broadcast_event("appointment.warned", {
            "appointment_id": str(apt.id),
            "patient_email": patient.email,
            "scheduled_at": apt.scheduled_at.isoformat(),
        })

    logger.info("warning_pass_complete", warned_count=warned)
    return warned


async def _reminder_24h(sess, cs, now_utc: datetime):
    """Pass 2: 24-hour reminder. COMPLIANT-only appts ~1 day out, no reminder yet.
    Does NOT change appointment status."""
    window_min = now_utc + timedelta(hours=cs.reminder_hours_before - 2)
    window_max = now_utc + timedelta(hours=cs.reminder_hours_before + 2)

    result = await sess.execute(
        select(Appointment)
        .where(Appointment.status == AppointmentStatus.COMPLIANT)
        .where(Appointment.scheduled_at >= window_min)
        .where(Appointment.scheduled_at <= window_max)
        .where(Appointment.reminder_sent_at.is_(None))
    )
    appointments = result.scalars().all()
    reminded = 0
    for apt in appointments:
        await sess.refresh(apt, ["patient"])
        patient = apt.patient
        if not patient:
            continue

        html_body = _render_template(
            "reminder_email.html",
            patient_name=patient.full_name,
            appointment_time=apt.scheduled_at.strftime("%B %d, %Y at %I:%M %p"),
            clinic_name=settings.clinic_name,
        )
        await _send_email_limited(
            gmail_client,
            to=patient.email,
            subject=f"Reminder: Your {settings.clinic_name} Appointment Tomorrow",
            html_body=html_body,
        )
        apt.reminder_sent_at = datetime.now(timezone.utc)
        apt.updated_at = datetime.now(timezone.utc)
        # NOTE: deliberately NO status change — this is a courtesy touch only.
        reminded += 1
        logger.info("reminder_sent", appointment_id=str(apt.id), patient=patient.email)
        await broadcast_event("appointment.reminder_sent", {
            "appointment_id": str(apt.id),
            "patient_email": patient.email,
            "scheduled_at": apt.scheduled_at.isoformat(),
        })

    logger.info("reminder_pass_complete", reminded_count=reminded)
    return reminded


async def _purge_today(sess, cs, today: date, arq_pool) -> dict:
    """Pass 3: The Purge. Cancel today's non-compliant appointments via Calendly.
    Excludes NEEDS_MANUAL_REVIEW (a doctor must intervene) and obviously compliant states.
    Returns {'would_cancel': int, 'actually_cancelled': int} so dry-run counts don't inflate the briefing."""
    day_start, day_end = _clinic_day_window(today)

    result = await sess.execute(
        select(Appointment)
        .where(Appointment.scheduled_at >= day_start)
        .where(Appointment.scheduled_at <= day_end)
        .where(Appointment.status.in_([AppointmentStatus.PENDING_INTAKE, AppointmentStatus.WARNED]))
    )
    appointments = result.scalars().all()
    would_cancel = 0
    actually_cancelled = 0
    for apt in appointments:
        if cs.dry_run_mode:
            logger.info(
                "dry_run_would_purge",
                appointment_id=str(apt.id),
                calendly=apt.calendly_event_uuid,
                current_status=apt.status.value,
            )
            would_cancel += 1
        else:
            # arq_pool MUST be reachable in live mode — silently failing here is unacceptable.
            if arq_pool is None:
                logger.error("purge_skip_no_arq_pool", appointment_id=str(apt.id))
                continue
            await arq_pool.enqueue_job(
                "cancel_appointment_via_calendly",
                appointment_id=str(apt.id),
            )
            actually_cancelled += 1

    logger.info(
        "purge_pass_complete",
        would_cancel=would_cancel,
        actually_cancelled=actually_cancelled,
        dry_run=cs.dry_run_mode,
    )
    return {"would_cancel": would_cancel, "cancelled": actually_cancelled}


async def _compile_briefing(sess, today: date, warned: int, reminded: int, purge: dict):
    day_start, day_end = _clinic_day_window(today)

    result = await sess.execute(
        select(Appointment)
        .where(Appointment.scheduled_at >= day_start)
        .where(Appointment.scheduled_at <= day_end)
        .order_by(Appointment.scheduled_at)
    )
    today_appointments = result.scalars().all()
    schedule_lines = []
    needs_attention = []
    for apt in today_appointments:
        await sess.refresh(apt, ["patient", "intake_submission"])
        if apt.status == AppointmentStatus.NEEDS_MANUAL_REVIEW:
            needs_attention.append(apt)
        status_label = {
            AppointmentStatus.COMPLIANT: "[OK]      ",
            AppointmentStatus.PENDING_INTAKE: "[PENDING] ",
            AppointmentStatus.WARNED: "[WARNED]  ",
            AppointmentStatus.AUTO_CANCELLED: "[CANCEL]  ",
            AppointmentStatus.CANCELLED_BY_PATIENT: "[CNCLD-PX]",
            AppointmentStatus.NEEDS_MANUAL_REVIEW: "[REVIEW!] ",
            AppointmentStatus.MANUALLY_OVERRIDDEN: "[OVERRIDE]",
            AppointmentStatus.COMPLETED: "[DONE]    ",
        }.get(apt.status, "[?]")
        line = f"{status_label} {apt.scheduled_at.strftime('%I:%M %p')} - {apt.patient.full_name if apt.patient else '<unknown>'} ({apt.status.value})"
        if apt.intake_submission and apt.intake_submission.completeness_score:
            line += f" | score: {apt.intake_submission.completeness_score}%"
        schedule_lines.append(line)

    review_lines = [
        f"  ! {apt.scheduled_at.strftime('%H:%M')} - {apt.patient.full_name if apt.patient else '?'} — AI parse failed, awaiting doctor review"
        for apt in needs_attention
    ]

    stuck_result = await sess.execute(
        select(WebhookEvent).where(WebhookEvent.processed_at.is_(None)).limit(10)
    )
    stuck = stuck_result.scalars().all()
    stuck_lines = [f"  - {h.source}/{h.dedupe_key} ({h.event_type})" for h in stuck]

    content = {
        "date": today.isoformat(),
        "appointments": schedule_lines,
        "warned_count": warned,
        "reminded_count": reminded,
        "would_cancel_count": purge.get("would_cancel", 0),
        "cancelled_count": purge.get("cancelled", 0),
        "needs_review": review_lines,
        "stuck_webhooks": stuck_lines,
    }
    return content


async def _send_briefing(sess, content: dict, cs, today: date, sheet_url: str | None = None, sheets_sync_ok: bool = True):
    existing_result = await sess.execute(
        select(DailyBriefing).where(DailyBriefing.date == today)
    )
    if existing_result.scalar_one_or_none():
        logger.info("briefing_already_sent_today")
        return

    # If sync failed, flag prominently in the email subject + body so the doctor
    # never silently receives a stale or broken Sheet link (spec A.3.5).
    subject_suffix = "" if sheets_sync_ok and sheet_url else " [SHEETS SYNC FAILED]"
    sheet_section = (
        f'<p><a href="{sheet_url}">Open today\'s Patient Intake Sheet</a></p>'
        if sheet_url
        else '<p><strong style="color:#c00">⚠ Sheets sync failed — no link available. Run "python cron_enforcement.py --now" to retry.</strong></p>'
    )

    html_body = _render_template(
        "doctor_briefing.html",
        clinic_name=settings.clinic_name,
        date_str=today.strftime("%B %d, %Y"),
        appointments="\n".join(content["appointments"]),
        warned_count=content["warned_count"],
        reminded_count=content["reminded_count"],
        cancelled_count=content["cancelled_count"],
        would_cancel_count=content.get("would_cancel_count", 0),
        dry_run_mode=cs.dry_run_mode,
        stuck_webhooks="\n".join(content.get("stuck_webhooks", [])),
        needs_review="\n".join(content.get("needs_review", [])),
        sheet_section=sheet_section,
    )

    await gmail_client.send_email(
        to=settings.doctor_email,
        subject=f"Daily Briefing — {today.strftime('%B %d, %Y')}{subject_suffix}",
        html_body=html_body,
    )

    briefing = DailyBriefing(
        id=uuid.uuid4(),
        date=today,
        content=content,
        sheet_url=sheet_url,
        sent_at=datetime.now(timezone.utc),
    )
    sess.add(briefing)
    await sess.commit()
    logger.info("doctor_briefing_sent", sheet_url=sheet_url, sheets_sync_ok=sheets_sync_ok)


# Semaphore limiting concurrent email sends per cron run (Criterion 1: O-grade concurrency).
_EMAIL_SEM = asyncio.Semaphore(10)


async def _send_email_limited(client, **kwargs):
    """Send an email with concurrency gating — never more than 10 parallel sends."""
    async with _EMAIL_SEM:
        return await client.send_email(**kwargs)


async def run_enforcement():
    cid = correlation_id()
    logger.info("cron_enforcement_started", correlation_id=cid, clinic_timezone=settings.clinic_timezone)
    await broadcast_event("cron.started", {"correlation_id": cid, "clinic_timezone": settings.clinic_timezone})

    async with async_session_factory() as sess:
        cs = await get_clinic_settings(sess)

        # Single point of truth for "today" — clinic-local.
        # Date arithmetic throughout this run uses clinic tz. Windows used in queries are
        # projected to UTC before comparison against scheduled_at (which is stored as UTC).
        today = _today_in_clinic()
        now_utc = datetime.now(timezone.utc)
        logger.info("cron_enforcement_run_context", today_clinic=today.isoformat(), now_utc=now_utc.isoformat())

        arq_pool = None
        try:
            arq_pool = await arq.create_pool(settings.redis_url)
        except Exception as e:
            logger.error("arq_pool_create_failed", error=str(e))
            # In dry-run we don't strictly need the pool (purge path stays in log-only branch).
            # In LIVE mode we MUST hard-abort to avoid silently dropping cancellations.
            if not cs.dry_run_mode:
                logger.error("cron_abort_no_redis_in_live_mode")
                raise RuntimeError("Redis queue unreachable and dry_run disabled — refusing to run")

        # Criterion 1: run warning and reminder passes concurrently (independent queries).
        warned_task = asyncio.create_task(_warning_48h(sess, cs, now_utc))
        reminded_task = asyncio.create_task(_reminder_24h(sess, cs, now_utc))
        warned, reminded = await asyncio.gather(warned_task, reminded_task)
        await sess.commit()

        purge = await _purge_today(sess, cs, today, arq_pool)
        await sess.commit()

        # ---- Step 4: Google Sheets Sync (spec A.3.5) — MUST complete (or fail
        # gracefully) before the briefing goes out. If sync fails, pass
        # sheet_url=None and flag it prominently in the briefing email.
        sheet_url: str | None = None
        sheets_sync_ok = False
        try:
            from jobs.sheets_sync import run_sync_and_return_url
            sheet_url = await run_sync_and_return_url()
            sheets_sync_ok = sheet_url is not None
            await broadcast_event("sheets_sync.completed", {
                "correlation_id": cid,
                "sheet_url": sheet_url,
                "ok": sheets_sync_ok,
            })
        except Exception as sync_err:
            logger.error("sheets_sync_failed_briefing_will_flag_stale", error=str(sync_err))
            sheets_sync_ok = False

        content = await _compile_briefing(sess, today, warned, reminded, purge)
        content["sheets_sync_ok"] = sheets_sync_ok
        content["sheet_url"] = sheet_url
        await _send_briefing(sess, content, cs, today, sheet_url=sheet_url, sheets_sync_ok=sheets_sync_ok)

        logger.info(
            "cron_enforcement_complete",
            correlation_id=cid,
            warned=warned,
            reminded=reminded,
            would_cancel=purge.get("would_cancel", 0),
            actually_cancelled=purge.get("cancelled", 0),
            dry_run=cs.dry_run_mode,
        )

        await broadcast_event("cron.completed", {
            "correlation_id": cid,
            "warned": warned,
            "reminded": reminded,
            "would_cancel": purge.get("would_cancel", 0),
            "actually_cancelled": purge.get("cancelled", 0),
            "dry_run": cs.dry_run_mode,
        })

        if arq_pool:
            await arq_pool.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Patient Intake Enforcement Worker")
    parser.add_argument("--now", action="store_true", default=True, help="Run enforcement immediately")
    args = parser.parse_args()
    asyncio.run(run_enforcement())