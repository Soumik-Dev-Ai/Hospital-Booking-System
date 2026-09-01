import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, status, Depends, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import verify_calendly_webhook
from core.logging import get_logger, correlation_id
from core.config import settings
from models import Appointment, Patient, WebhookEvent, AppointmentStatus, generate_ref_code
from schemas.schemas import CalendlyWebhookPayload
from api.lives import broadcast_event
# Sheets writes are intentionally NOT imported here — see spec A.3.5 (cron-only sync).

router = APIRouter(tags=["webhooks"])
logger = get_logger("webhooks.calendly")


@router.post("/calendly")
async def calendly_webhook(request: Request, db: AsyncSession = Depends(get_db), background_tasks: BackgroundTasks = None):
    cid = correlation_id()
    logger.info("calendly_webhook_received", correlation_id=cid)

    body_bytes = await request.body()
    raw_body = body_bytes.decode("utf-8")

    # ---- MANDATORY Signature Verification (no bypass) ----
    # Spec §7: "Verify EVERY inbound webhook cryptographically before trusting it — mandatory, not optional"
    if not settings.calendly_webhook_signing_key:
        logger.error("calendly_signing_key_unset_ENDPOINT_DISABLED", correlation_id=cid)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook verification not configured")

    signature = request.headers.get("Calendly-Webhook-Signature")
    timestamp = request.headers.get("Calendly-Webhook-Timestamp")
    if not signature or not timestamp:
        logger.warning("calendly_missing_signature_headers", correlation_id=cid)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature headers")

    if not verify_calendly_webhook(body_bytes, signature, timestamp):
        logger.warning("calendly_signature_invalid", correlation_id=cid)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    try:
        payload = CalendlyWebhookPayload.model_validate_json(raw_body)
    except Exception as e:
        logger.error("calendly_payload_validation_failed", correlation_id=cid, error=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")

    event = payload.event
    data = payload.payload
    event_uuid = data.get("event_uuid") or data.get("uri", "").split("/")[-1]

    # ---- Deduplication ----
    existing = await db.execute(select(WebhookEvent).where(WebhookEvent.dedupe_key == event_uuid))
    if existing.scalar_one_or_none():
        logger.info("calendly_duplicate_event", correlation_id=cid, event_uuid=event_uuid)
        return {"status": "duplicate_ignored"}

    await broadcast_event("webhook.calendly_received", {
        "event_uuid": event_uuid,
        "event_type": event,
        "correlation_id": cid,
    })

    webhook_event = WebhookEvent(
        id=uuid.uuid4(),
        source="calendly",
        dedupe_key=event_uuid,
        event_type=event,
        raw_payload=data,
    )

    try:
        if event == "invitee.created":
            await _handle_booking(db, data, cid, background_tasks)
        elif event == "invitee.canceled":
            await _handle_cancellation(db, data, cid)
        webhook_event.processed_at = datetime.now(timezone.utc)
    except HTTPException:
        raise
    except Exception as e:
        webhook_event.error_message = str(e)
        logger.error("calendly_handler_error", correlation_id=cid, error=str(e))

    db.add(webhook_event)
    await db.commit()

    return {"status": "ok", "event_uuid": event_uuid}


async def _handle_booking(db: AsyncSession, data: dict, cid: str, background_tasks: BackgroundTasks = None):
    invitee = data.get("invitee") or data

    # ---- Payload validation: required fields ----
    email = (invitee.get("email") or "").strip().lower()
    if not email:
        logger.error("calendly_booking_missing_email", correlation_id=cid, data_keys=list(data.keys()))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing invitee email")

    name = invitee.get("name", "") or email.split("@")[0]
    phone_raw = invitee.get("questions_and_responses", [])
    phone = ""
    if isinstance(phone_raw, list):
        for qa in phone_raw:
            if isinstance(qa, dict) and "phone" in str(qa.get("question", "")).lower():
                phone = qa.get("answer", "")
                break

    event_uuid = data.get("event_uuid") or data.get("uri", "").split("/")[-1]
    scheduled_at_iso = data.get("scheduled_event", {}).get("start_time") or data.get("start_time")
    if not scheduled_at_iso:
        logger.error("calendly_booking_missing_start_time", correlation_id=cid, event_uuid=event_uuid)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing scheduled_event.start_time")
    scheduled_at = datetime.fromisoformat(scheduled_at_iso.replace("Z", "+00:00"))

    # ---- Doctor assignment (multi-doctor addendum): match Calendly event-type URI
    # to a Doctor row's calendly_event_type_uri. NULL if no match (admin can reassign).
    event_type_uri = data.get("scheduled_event", {}).get("event_type") or data.get("event_type")
    doctor_id_value = None
    if event_type_uri:
        from models import Doctor
        doc_result = await db.execute(
            select(Doctor).where(Doctor.calendly_event_type_uri == event_type_uri)
        )
        doctor_row = doc_result.scalar_one_or_none()
        if doctor_row:
            doctor_id_value = doctor_row.id
            logger.info("calendly_doctor_assigned", ref_event_type=event_type_uri,
                        doctor_id=str(doctor_id_value), correlation_id=cid)
        else:
            logger.warning("calendly_no_doctor_match_for_event_type",
                           event_type=event_type_uri, correlation_id=cid)

    # Upsert patient
    result_patient = await db.execute(select(Patient).where(Patient.email == email))
    patient = result_patient.scalar_one_or_none()
    if not patient:
        patient = Patient(
            id=uuid.uuid4(),
            full_name=name,
            email=email,
            phone=phone,
        )
        db.add(patient)
        await db.flush()
    else:
        patient.full_name = name
        if phone:
            patient.phone = phone

    # Idempotency: check for existing appointment (Calendly retry)
    result_appt = await db.execute(select(Appointment).where(Appointment.calendly_event_uuid == event_uuid))
    if result_appt.scalar_one_or_none():
        return

    appointment = Appointment(
        id=uuid.uuid4(),
        patient_id=patient.id,
        ref_code=generate_ref_code(),
        calendly_event_uuid=event_uuid,
        scheduled_at=scheduled_at,
        status=AppointmentStatus.PENDING_INTAKE,
        doctor_id=doctor_id_value,
    )
    db.add(appointment)
    await db.flush()

    # ---- Plan A.1: Fire via BackgroundTasks (the ONLY dispatch path here;
    # arq+Redis is a documented optional upgrade for higher-volume deployments) ----
    if background_tasks is not None:
        from background import send_intake_request_email_bg
        background_tasks.add_task(send_intake_request_email_bg, str(appointment.id), cid)
    else:
        logger.warning("intake_email_background_tasks_unavailable", appointment_id=str(appointment.id))
    await broadcast_event("intake.request_queued", {
        "appointment_id": str(appointment.id),
        "patient_email": patient.email,
        "scheduled_at": appointment.scheduled_at.isoformat(),
        "correlation_id": cid,
    })
    logger.info("intake_request_queued", correlation_id=cid, appointment_id=str(appointment.id))

    # NOTE: Per spec A.3.5, Sheets is written only by the daily cron sync job
    # (jobs/sheets_sync.py). Webhook handlers write ONLY to Postgres.


async def _handle_cancellation(db: AsyncSession, data: dict, cid: str):
    event_uuid = data.get("event_uuid") or data.get("uri", "").split("/")[-1]
    result = await db.execute(select(Appointment).where(Appointment.calendly_event_uuid == event_uuid))
    appointment = result.scalar_one_or_none()
    if appointment and appointment.status not in (AppointmentStatus.CANCELLED_BY_PATIENT, AppointmentStatus.AUTO_CANCELLED):
        appointment.status = AppointmentStatus.CANCELLED_BY_PATIENT
        appointment.updated_at = datetime.now(timezone.utc)
        await broadcast_event("appointment.cancelled_by_patient", {
            "appointment_id": str(appointment.id),
            "calendly_event_uuid": event_uuid,
            "correlation_id": cid,
        })
        logger.info("appointment_cancelled_by_patient", correlation_id=cid, appointment_id=str(appointment.id))