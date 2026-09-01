"""pipeline/ai_parser.py — intake reply processing and compliance evaluation."""
import asyncio
import logging
from datetime import datetime, timezone

from core.logging import get_logger
from core.config import settings
from core.database import async_session_factory
from services.ai_provider import parse_intake_with_fallback, _core_fields_present, _resolve_threshold
from models import Appointment, AppointmentStatus, IntakeSubmission

logger = get_logger("ai_parser")


async def process_intake_reply(ctx, appointment_id: str, raw_reply_text: str, correlation_id: str = "") -> dict:
    """Parse a patient's reply and update the appointment compliance state."""
    async with async_session_factory() as sess:
        result = await sess.execute(
            __import__("sqlalchemy").select(Appointment).where(Appointment.id == appointment_id)
        )
        apt = result.scalar_one_or_none()
        if not apt:
            logger.warning("intake_reply_skip_no_appointment", appointment_id=appointment_id)
            return {"status": "error", "reason": "appointment_not_found"}

        # Parse with AI fallback chain
        try:
            summary, provider, model = await parse_intake_with_fallback(raw_reply_text)
        except RuntimeError:
            # All providers failed — flag for manual review
            apt.status = AppointmentStatus.NEEDS_MANUAL_REVIEW
            await sess.commit()
            logger.warning("intake_reply_manual_review", appointment_id=appointment_id)
            return {"status": "needs_manual_review"}

        # Evaluate compliance
        if not _core_fields_present(summary):
            apt.status = AppointmentStatus.NEEDS_MANUAL_REVIEW
        else:
            threshold = await _resolve_threshold(sess)
            if summary.completeness_score >= threshold:
                apt.status = AppointmentStatus.COMPLIANT
            else:
                apt.status = AppointmentStatus.PENDING_INTAKE

        # Persist intake submission
        submission = IntakeSubmission(
            appointment_id=apt.id,
            raw_reply=raw_reply_text,
            parsed_json=summary.model_dump_json(),
            provider=provider,
            model=model,
            completeness_score=summary.completeness_score,
        )
        sess.add(submission)
        await sess.commit()

        logger.info(
            "intake_reply_processed",
            appointment_id=appointment_id,
            status=apt.status.value,
            provider=provider,
        )
        return {"status": apt.status.value, "provider": provider}
