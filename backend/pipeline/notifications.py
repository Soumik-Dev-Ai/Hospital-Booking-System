"""pipeline/notifications.py — send intake request emails with Ref token."""
import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from core.logging import get_logger
from core.config import settings
from services.gmail_client import gmail_client

logger = get_logger("notifications")


async def send_intake_request_email(ctx, appointment_id: str, correlation_id: str = "") -> dict:
    """Send an intake-request email to a patient with a hidden Ref: #<ref_code> token."""
    from models import Appointment
    from core.database import async_session_factory
    from sqlalchemy import select

    async with async_session_factory() as sess:
        result = await sess.execute(select(Appointment).where(Appointment.id == appointment_id))
        apt = result.scalar_one_or_none()
        if not apt:
            logger.warning("intake_email_skip_no_appointment", appointment_id=appointment_id)
            return {"sent": False, "reason": "appointment_not_found"}

        patient = apt.patient
        if not patient:
            logger.warning("intake_email_skip_no_patient", appointment_id=appointment_id)
            return {"sent": False, "reason": "no_patient"}

        ref_code = apt.ref_code or ""

        template_dir = Path(__file__).parent.parent / "templates"
        env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(["html"]),
        )
        template = env.get_template("intake_request.html")
        html_body = template.render(
            ref_code=ref_code,
            clinic_name=settings.clinic_name,
            appointment_date=apt.scheduled_at.strftime("%B %d, %Y at %I:%M %p") if apt.scheduled_at else "",
        )

        subject = f"Intake Request — {settings.clinic_name}"
        msg_id = await gmail_client.send_email(
            to=patient.email,
            subject=subject,
            html_body=html_body,
        )
        logger.info("intake_email_sent", appointment_id=appointment_id, msg_id=msg_id)
        return {"sent": True, "msg_id": msg_id}
