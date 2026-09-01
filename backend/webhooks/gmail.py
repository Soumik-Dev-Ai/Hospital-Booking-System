import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import verify_pubsub_token
from core.logging import get_logger, correlation_id
from models import (
    WebhookEvent, GmailWatchState, Patient, Appointment, AppointmentStatus, AuditLog, ActorType,
)
from services.gmail_client import gmail_client
from api.lives import broadcast_event
from services.ai_edge_cases import filter_attachments, sanitize_incoming_text

router = APIRouter(tags=["webhooks"])
logger = get_logger("webhooks.gmail")


@router.post("/gmail")
async def gmail_webhook(request: Request, db: AsyncSession = Depends(get_db), background_tasks: BackgroundTasks = None):
    cid = correlation_id()
    logger.info("gmail_webhook_received", correlation_id=cid)

    # ---- OIDC Token Verification (Pub/Sub push) ----
    auth_header = request.headers.get("Authorization", "")
    if not verify_pubsub_token(auth_header):
        logger.warning("gmail_pubsub_token_invalid", correlation_id=cid)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Pub/Sub token")

    body = await request.json()
    message = body.get("message", {})
    history_id = message.get("historyId") or message.get("history_id")

    if not history_id:
        logger.warning("gmail_no_history_id", correlation_id=cid)
        return {"status": "acked_no_history_id"}

    # ---- Deduplication ----
    existing = await db.execute(select(WebhookEvent).where(WebhookEvent.dedupe_key == history_id))
    if existing.scalar_one_or_none():
        logger.info("gmail_duplicate_history_id", correlation_id=cid, history_id=history_id)
        return {"status": "duplicate_ignored"}

    await broadcast_event("webhook.gmail_received", {
        "history_id": str(history_id),
        "correlation_id": cid,
    })

    webhook_event = WebhookEvent(
        id=uuid.uuid4(),
        source="gmail_pubsub",
        dedupe_key=history_id,
        event_type="gmail_push",
        raw_payload=body,
    )
    db.add(webhook_event)

    # Read the cursor up-front. New messages are processed into arq jobs — if anything
    # fails mid-way, we MUST NOT advance the cursor (otherwise patient replies are silently lost).
    prior_watch_state = await _get_latest_watch_state(db)
    last_id = prior_watch_state.history_id if prior_watch_state else "0"

    new_history_id = None
    processed = 0
    processing_failed = False

    try:
        history_result = await gmail_client.history_list(last_id)
        new_history_id = history_result.get("historyId", last_id)
        changes = history_result.get("history", [])

        for change in changes:
            for msg_added in change.get("messagesAdded", []):
                inner_message = msg_added.get("message", {})
                msg_id = inner_message.get("id")
                full_msg = await gmail_client.get_message(msg_id)
                if not full_msg:
                    continue

                from_addr = gmail_client.extract_from_address(full_msg)
                if not from_addr:
                    continue

                full_text = (
                    gmail_client.decode_message_body(full_msg)
                    + " "
                    + " ".join(
                        h.get("value", "")
                        for h in full_msg.get("payload", {}).get("headers", [])
                        if h.get("name", "").lower() in ("subject",)
                    )
                )

                # Firewall all inbound text before it can reach the AI pipeline.
                firewall_result = sanitize_incoming_text(full_text)
                if firewall_result.matched_patterns:
                    logger.warning(
                        "gmail_prompt_injection_quarantined",
                        correlation_id=cid,
                        from_addr=from_addr,
                        patterns=firewall_result.matched_patterns,
                    )
                    continue
                full_text = firewall_result.sanitized_text

                # Only JPG/PNG attachments are eligible for a future OCR path;
                # executable/archive payloads are rejected and never downloaded.
                attachments = gmail_client.extract_attachments(full_msg)
                _, rejected_attachments = filter_attachments(attachments)
                if rejected_attachments:
                    logger.warning(
                        "gmail_unsafe_attachments_rejected",
                        correlation_id=cid,
                        from_addr=from_addr,
                        filenames=[item.get("filename") for item in rejected_attachments],
                    )

                # Prefer the embedded Ref: #<ref_code> token (disambiguates multi-appointment patients)
                ref_code = gmail_client.extract_ref_id(full_text)
                appointment: Appointment | None = None

                if ref_code:
                    try:
                        apt_result = await db.execute(
                            select(Appointment).where(Appointment.ref_code == ref_code)
                        )
                        appointment = apt_result.scalar_one_or_none()
                    except (ValueError, Exception):
                        pass
                    # Note: Postgres is the single source of truth (spec A.2). No
                    # Sheets read-back fallback — Sheets is a reporting artifact only.

                if not appointment:
                    # Fallback: match by sender email + pending appointment
                    patient_result = await db.execute(
                        select(Patient)
                        .join(Appointment)
                        .where(Patient.email == from_addr.lower().strip())
                        .where(Appointment.status == AppointmentStatus.PENDING_INTAKE)
                    )
                    patient = patient_result.scalar_one_or_none()
                    if not patient:
                        # Unmatched reply — log a warning so the doctor knows; do NOT silently drop.
                        logger.info(
                            "gmail_unmatched_reply",
                            correlation_id=cid,
                            from_addr=from_addr,
                        )
                        audit = AuditLog(
                            id=uuid.uuid4(),
                            actor_type=ActorType.SYSTEM,
                            action="UNMATCHED_REPLY",
                            entity_type="Patient",
                            entity_id=uuid.UUID(int=0),  # placeholder; no patient matched
                            details={"from_addr": from_addr, "subject": full_msg.get("payload", {}).get("headers", [{}])[0].get("value", "")[:200]},
                        )
                        db.add(audit)
                        continue

                    reply_text = gmail_client.extract_reply_text(full_msg)
                    if not reply_text.strip():
                        continue

                    apt_result = await db.execute(
                        select(Appointment)
                        .where(Appointment.patient_id == patient.id)
                        .where(Appointment.status == AppointmentStatus.PENDING_INTAKE)
                        .order_by(Appointment.scheduled_at.asc())
                    )
                    appointment = apt_result.scalars().first()
                else:
                    reply_text = gmail_client.extract_reply_text(full_msg)

                if appointment:
                    # ---- Plan A.1: Fire via BackgroundTasks (the ONLY dispatch path
                    # here; arq+Redis is a documented optional upgrade) ----
                    if background_tasks is not None:
                        from background import process_intake_reply_bg
                        background_tasks.add_task(
                            process_intake_reply_bg,
                            str(appointment.id), reply_text, cid,
                        )
                    else:
                        logger.warning("intake_reply_background_tasks_unavailable", appointment_id=str(appointment.id))
                    await broadcast_event("intake.reply_received", {
                        "appointment_id": str(appointment.id),
                        "from_addr": from_addr,
                        "ref_code": ref_code,
                        "correlation_id": cid,
                    })
                    processed += 1

        # Cursor advances ONLY on successful processing — never on failure (BUG-7 fix)
        if new_history_id and not processing_failed:
            if prior_watch_state:
                prior_watch_state.history_id = new_history_id
            else:
                db.add(GmailWatchState(
                    id=uuid.uuid4(),
                    history_id=new_history_id,
                    watch_expiration=datetime.now(timezone.utc),
                ))

        webhook_event.processed_at = datetime.now(timezone.utc)
        webhook_event.error_message = None
        logger.info("gmail_history_processed", correlation_id=cid, messages_processed=processed, new_history_id=new_history_id)

    except Exception as e:
        processing_failed = True
        webhook_event.error_message = str(e)
        # Do NOT advance the cursor on failure — next push will retry from previous cursor.
        logger.error("gmail_handler_error_no_cursor_advance", correlation_id=cid, error=str(e))

    await db.commit()
    return {"status": "ok", "processed_messages": processed, "cursor_advanced": not processing_failed}


async def _get_latest_watch_state(db: AsyncSession) -> GmailWatchState | None:
    result = await db.execute(
        select(GmailWatchState).order_by(GmailWatchState.renewed_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()
