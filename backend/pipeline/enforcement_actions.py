"""pipeline/enforcement_actions.py — Calendly cancel with race-condition guard."""
import logging

from core.logging import get_logger
from core.config import settings
from core.database import async_session_factory
from models import Appointment, AppointmentStatus
from services.calendly_client import calendly_client

logger = get_logger("enforcement_actions")


async def cancel_appointment_via_calendly(ctx, appointment_id: str) -> dict:
    """Cancel a Calendly event for an appointment, with race-condition guard.

    BEFORE cancelling, re-fetches the appointment to verify it is still in a
    cancel-able status.  Skips silently if the patient already became COMPLIANT,
    NEEDS_MANUAL_REVIEW, or already AUTO_CANCELLED.
    """
    sess = await async_session_factory()
    try:
        result = await sess.execute(
            __import__("sqlalchemy").select(Appointment).where(Appointment.id == appointment_id)
        )
        apt = result.scalar_one_or_none()
        if not apt:
            logger.warning("cancel_skip_no_appointment", appointment_id=appointment_id)
            return {"cancelled": False, "reason": "appointment_not_found"}

        # Race-condition guard: skip if status changed since enqueue
        if apt.status in (AppointmentStatus.COMPLIANT, AppointmentStatus.NEEDS_MANUAL_REVIEW,
                          AppointmentStatus.AUTO_CANCELLED, AppointmentStatus.CANCELLED_BY_PATIENT,
                          AppointmentStatus.COMPLETED, AppointmentStatus.MANUALLY_OVERRIDDEN):
            logger.info("cancel_skip_status_changed", appointment_id=appointment_id,
                        status=apt.status.value)
            return {"cancelled": False, "reason": f"status={apt.status.value}"}

        if not apt.calendly_event_uuid or apt.calendly_event_uuid == "N/A":
            logger.warning("cancel_skip_no_calendly_uuid", appointment_id=appointment_id)
            return {"cancelled": False, "reason": "no_calendly_uuid"}

        # Check dry-run mode from ClinicSettings (DB) — primary source of truth
        from models import ClinicSettings
        cs_result = await sess.execute(
            __import__("sqlalchemy").select(ClinicSettings).limit(1)
        )
        cs = cs_result.scalar_one_or_none()
        if cs and cs.dry_run_mode:
            logger.info("cancel_skip_dry_run", appointment_id=appointment_id)
            apt.status = AppointmentStatus.AUTO_CANCELLED
            await sess.commit()
            return {"cancelled": False, "reason": "dry_run"}

        # Actually cancel via Calendly
        try:
            await calendly_client.cancel_event(apt.calendly_event_uuid)
            apt.status = AppointmentStatus.AUTO_CANCELLED
            await sess.commit()
            logger.info("cancel_success", appointment_id=appointment_id)
            return {"cancelled": True}
        except Exception as exc:
            logger.error("cancel_failed", appointment_id=appointment_id, error=str(exc))
            return {"cancelled": False, "reason": str(exc)}
    finally:
        if hasattr(sess, 'close'):
            await sess.close()
