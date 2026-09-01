"""Arq task definitions for background agents."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from itertools import groupby

from arq import create_pool
from redis.asyncio import ConnectionPool as RedisPool
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from config.settings import settings
from utils.tracing import set_trace_id, get_trace_id
from utils.alerts import notify_failure

from database.models import Appointment, Checklist, ServiceRecord, AppointmentStatus
from services.sheets_client import sheets_client

logger = logging.getLogger(__name__)


def get_redis_pool() -> RedisPool:
    """Create a Redis connection pool from settings."""
    return RedisPool.from_url(
        settings.redis_url,
        decode_responses=True,
        max_connections=10,
    )


async def get_redis() -> object:
    """Arq worker — create and return a Redis pool."""
    pool = get_redis_pool()
    return pool


# ---------------------------------------------------------------------------
# Task 1: Patient Reminder Engine
# ---------------------------------------------------------------------------

async def send_patient_reminders(ctx: dict) -> int:
    """Daily task: scan upcoming appointments and send email reminders.

    Fires for appointments within the next 24 hours.
    If the patient hasn't completed their intake form, sends a nudge.
    """
    trace_id = set_trace_id("patient-reminder")
    logger.info("[trace=%s] Starting patient reminder engine", trace_id)

    redis = ctx["redis"]
    now = datetime.now(timezone.utc)
    tomorrow = now + timedelta(hours=24)
    
    from database import get_db
    async for db in get_db():
        result = await db.execute(
            select(Appointment)
            .options(selectinload(Appointment.checklists), selectinload(Appointment.patient))
            .where(
                Appointment.scheduled_at.between(now, tomorrow),
                Appointment.status == AppointmentStatus.SCHEDULED,
            )
        )
        appointments = result.scalars().all()
        for appt in appointments:
            needs_nudge = False
            for chk in appt.checklists:
                if not chk.is_completed_by_patient:
                    needs_nudge = True
                    break
            if needs_nudge:
                logger.info(f"Would send nudge email to {appt.patient.email} for appointment {appt.id}")
            else:
                logger.info(f"Would send reminder email to {appt.patient.email} for appointment {appt.id}")

    logger.info("[trace=%s] Patient reminder engine completed", trace_id)
    return 0


# ---------------------------------------------------------------------------
# Task 2: Doctor's Daily Briefing & Sheets Sync
# ---------------------------------------------------------------------------

async def send_doctor_briefings(ctx: dict) -> int:
    """Nightly task (6 AM): aggregate previous day's data and email each doctor.
    Also acts as the Google Sheets sync for the clinic."""
    trace_id = set_trace_id("doctor-briefing")
    logger.info("[trace=%s] Starting doctor daily briefing agent & sheets sync", trace_id)

    redis = ctx["redis"]
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    today = datetime.now(timezone.utc)
    month_start = datetime(yesterday.year, yesterday.month, 1, tzinfo=timezone.utc)

    if not sheets_client.configured:
        logger.info("sheets_client not configured. Skipping sheets sync.")
        return 0

    from database import get_db
    async for db in get_db():
        result = await db.execute(
            select(Appointment)
            .options(selectinload(Appointment.patient), selectinload(Appointment.checklists), selectinload(Appointment.service_records))
            .where(Appointment.scheduled_at >= month_start)
        )
        appointments = result.scalars().all()

        row_dicts = []
        for apt in appointments:
            patient = apt.patient
            # Legacy mapping uses 'intake_submission' concepts. We map Checklist -> completeness.
            completeness = 100 if any(c.is_completed_by_patient for c in apt.checklists) else 0
            
            row_dicts.append({
                "ref_code": apt.ref_code or str(apt.id)[:8],
                "appointment_id": str(apt.id),
                "patient_name": patient.full_name if patient else "",
                "patient_email": patient.email if patient else "",
                "patient_phone": patient.phone if patient else None,
                "calendly_event_uuid": "N/A",  # Calendly UUID was dropped in new models
                "scheduled_at": apt.scheduled_at,
                "status": apt.status.value if apt.status else "Scheduled",
                "warning_sent_at": None,
                "reminder_sent_at": None,
                "auto_cancelled_at": None,
                "override_reason": None,
                "created_at": apt.created_at,
                "updated_at": apt.updated_at,
                "ai_provider": "LangGraph",
                "ai_model": "Groq",
                "completeness_score": completeness,
                "summary_link": None,
            })
            
        try:
            from core.sheets_lock import sheets_write_lock
            async with sheets_write_lock():
                result_url = await sheets_client.batch_upsert_appointments(
                    rows=row_dicts,
                    scheduled_at=month_start,
                )
            if result_url:
                logger.info(f"Sheets sync successful! URL: {result_url}")
                # Now send emails to doctors
                doctor_ids = set(a.doctor_id for a in appointments if a.scheduled_at.date() == yesterday.date())
                for doc_id in doctor_ids:
                    logger.info(f"Would send briefing email to doctor {doc_id} with link {result_url}")
        except Exception as e:
            logger.error(f"Sheets sync failed: {e}")

    logger.info("[trace=%s] Doctor briefing agent completed", trace_id)
    return 0


# ---------------------------------------------------------------------------
# Task 3: Periodic check-in (keep worker alive)
# ---------------------------------------------------------------------------

async def periodic_checkin(ctx: dict) -> None:
    """Lightweight heartbeat to verify the worker is alive."""
    logger.debug("[trace=%s] Worker heartbeat", get_trace_id() or "unknown")


# ---------------------------------------------------------------------------
# Arq Worker Settings
# ---------------------------------------------------------------------------

class WorkerSettings:
    functions = [send_patient_reminders, send_doctor_briefings, periodic_checkin]
    cron_jobs = [
        {
            "job": "agents.tasks:send_patient_reminders",
            "cron": "0 8 * * *",  # 8 AM daily
            "time_unit": "minutes",
        },
        {
            "job": "agents.tasks:send_doctor_briefings",
            "cron": "0 6 * * *",  # 6 AM daily
            "time_unit": "minutes",
        },
    ]
    max_tries = 3
    timeout = 300  # 5 minutes per task


async def run_worker():
    """Start the Arq worker."""
    pool = get_redis_pool()
    try:
        worker = await create_pool(
            pool,
            settings=WorkerSettings,
        )
        logger.info("Arq worker started")
        await worker.run()
    except Exception as exc:
        logger.error("Arq worker failed: %s", exc)
        await notify_failure("Arq worker", str(exc))
        raise
