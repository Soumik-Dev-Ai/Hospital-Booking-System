import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.security import require_admin
from core.logging import get_logger
from models import (
    Appointment, AppointmentStatus, AuditLog, ActorType,
    Patient, Prescription, PrescriptionStatus,
)
from schemas.schemas import (
    AppointmentOut, AppointmentDetailOut, AppointmentOverrideRequest,
    AppointmentCompleteRequest,
    IntakeSubmissionOut, PaginatedResponse,
    PrescriptionOut,
)

router = APIRouter(prefix="/api/appointments", tags=["appointments"])
logger = get_logger("api.appointments")


@router.get("", response_model=PaginatedResponse)
async def list_appointments(
    status: str | None = Query(None),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    doctor_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    query = select(Appointment)
    count_query = select(func.count(Appointment.id))
    if doctor_id is not None:
        query = query.where(Appointment.doctor_id == doctor_id)
        count_query = count_query.where(Appointment.doctor_id == doctor_id)
    if status:
        try:
            s = AppointmentStatus(status)
            query = query.where(Appointment.status == s)
            count_query = count_query.where(Appointment.status == s)
        except ValueError:
            pass
    if from_date:
        query = query.where(Appointment.scheduled_at >= datetime.fromisoformat(from_date))
        count_query = count_query.where(Appointment.scheduled_at >= datetime.fromisoformat(from_date))
    if to_date:
        query = query.where(Appointment.scheduled_at <= datetime.fromisoformat(to_date))
        count_query = count_query.where(Appointment.scheduled_at <= datetime.fromisoformat(to_date))

    total = await db.scalar(count_query)
    query = query.order_by(Appointment.scheduled_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = [AppointmentOut.model_validate(a) for a in result.scalars().all()]

    return PaginatedResponse(items=items, total=total or 0, page=page, page_size=page_size)


@router.get("/{appointment_id}", response_model=AppointmentDetailOut)
async def get_appointment(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    await db.refresh(apt, ["patient", "intake_submission"])
    # AuditLog on clinical data access (spec A.6).
    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.DOCTOR,
        action="READ_APPOINTMENT",
        entity_type="Appointment",
        entity_id=apt.id,
        details={"by": staff["email"], "has_intake": apt.intake_submission is not None},
    ))
    await db.commit()
    return AppointmentDetailOut(
        id=apt.id,
        patient_id=apt.patient_id,
        calendly_event_uuid=apt.calendly_event_uuid,
        scheduled_at=apt.scheduled_at,
        status=apt.status.value,
        warning_sent_at=apt.warning_sent_at,
        reminder_sent_at=apt.reminder_sent_at,
        auto_cancelled_at=apt.auto_cancelled_at,
        overridden_by_doctor_at=apt.overridden_by_doctor_at,
        override_reason=apt.override_reason,
        created_at=apt.created_at,
        updated_at=apt.updated_at,
        patient=apt.patient,
        intake_submission=IntakeSubmissionOut.model_validate(apt.intake_submission) if apt.intake_submission else None,
    )


@router.post("/{appointment_id}/override")
async def override_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentOverrideRequest,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if body.action == "mark_compliant":
        apt.status = AppointmentStatus.COMPLIANT
        apt.overridden_by_doctor_at = datetime.now(timezone.utc)
        apt.override_reason = body.reason
    elif body.action == "prevent_cancellation":
        apt.status = AppointmentStatus.MANUALLY_OVERRIDDEN
        apt.overridden_by_doctor_at = datetime.now(timezone.utc)
        apt.override_reason = body.reason
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {body.action}")

    audit = AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.DOCTOR,
        action=body.action,
        entity_type="Appointment",
        entity_id=apt.id,
        details={"reason": body.reason, "by": staff["email"]},
    )
    db.add(audit)
    apt.updated_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("appointment_overridden", appointment_id=str(apt.id), action=body.action)
    return {"status": "ok"}


@router.post("/{appointment_id}/force-cancel")
async def force_cancel(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    apt.status = AppointmentStatus.CANCELLED_BY_PATIENT
    apt.updated_at = datetime.now(timezone.utc)
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.DOCTOR,
        action="FORCE_CANCEL",
        entity_type="Appointment",
        entity_id=apt.id,
        details={"by": staff["email"]},
    )
    db.add(audit)
    await db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------
#  Phase 3 addendum: POST /api/appointments/{id}/complete
#  Marks the appointment COMPLETED + upserts the Prescription row
#  (UNIQUE on appointment_id) + appends to Patient.medical_history.
#  Post-commit: pushes the COMPLETED row to the appointment's month file.
# ---------------------------------------------------------------

_MEDICAL_HISTORY_SEP = "\n\n---\n\n"


def _format_medical_entry(
    prescription_text: str,
    checklist_tests: list[str],
    when: datetime,
) -> str:
    """Format one timestamped entry to append to patient.medical_history."""
    ts = when.strftime("%Y-%m-%d %H:%M:%S UTC")
    tests_str = ", ".join(checklist_tests) if checklist_tests else "(none)"
    return f"[{ts}]\nPrescription: {prescription_text}\nTests: {tests_str}"


@router.post("/{appointment_id}/complete", response_model=PrescriptionOut)
async def complete_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentCompleteRequest,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    """ACID transaction:
      1. Set Appointment.status = COMPLETED.
      2. Upsert Prescription (UNIQUE appointment_id) with prescription_text + checklist_tests.
      3. Append a timestamped entry to Patient.medical_history.
    After commit, fire sheets_client.upsert_appointment() with the new status."""
    # ---- 1. Fetch Appointment + Patient (joined) ----
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if apt.status == AppointmentStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="Appointment already completed")

    patient_result = await db.execute(select(Patient).where(Patient.id == apt.patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    now = datetime.now(timezone.utc)

    # ---- 2. Upsert Prescription (UNIQUE on appointment_id) ----
    rx_result = await db.execute(
        select(Prescription).where(Prescription.appointment_id == apt.id)
    )
    rx = rx_result.scalar_one_or_none()
    if rx is None:
        rx = Prescription(
            id=uuid.uuid4(),
            appointment_id=apt.id,
            doctor_id=apt.doctor_id,
            prescription_text=body.prescription_text,
            checklist_tests=body.checklist_tests,
            status=PrescriptionStatus.ACTIVE,
            created_at=now,
            updated_at=now,
        )
        db.add(rx)
    else:
        rx.prescription_text = body.prescription_text
        rx.checklist_tests = body.checklist_tests
        rx.status = PrescriptionStatus.ACTIVE
        rx.updated_at = now

    # ---- 3. Append to Patient.medical_history ----
    entry = _format_medical_entry(body.prescription_text, body.checklist_tests, now)
    if patient.medical_history:
        patient.medical_history = patient.medical_history + _MEDICAL_HISTORY_SEP + entry
    else:
        patient.medical_history = entry

    # ---- 4. Set status + audit ----
    apt.status = AppointmentStatus.COMPLETED
    apt.updated_at = now
    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.ADMIN,
        action="COMPLETE_APPOINTMENT",
        entity_type="Appointment",
        entity_id=apt.id,
        details={
            "by": staff["email"],
            "prescription_id": str(rx.id),
            "tests_count": len(body.checklist_tests),
        },
    ))

    # ---- 5. COMMIT (all three writes atomic) ----
    await db.commit()
    await db.refresh(rx)
    logger.info(
        "appointment_completed",
        appointment_id=str(apt.id),
        prescription_id=str(rx.id),
        by=staff["email"],
    )

    # ---- 6. Post-commit Sheets push (best-effort; non-fatal) ----
    sheet_url: str | None = None
    try:
        from services.sheets_client import sheets_client
        if sheets_client.configured:
            await db.refresh(apt, ["patient"])
            sheet_url = await sheets_client.upsert_appointment(
                ref_code=apt.ref_code,
                appointment_id=apt.id,
                patient_name=apt.patient.full_name if apt.patient else "",
                patient_email=apt.patient.email if apt.patient else "",
                patient_phone=apt.patient.phone if apt.patient else None,
                calendly_event_uuid=apt.calendly_event_uuid,
                scheduled_at=apt.scheduled_at,
                status=apt.status.value,
                warning_sent_at=apt.warning_sent_at,
                reminder_sent_at=apt.reminder_sent_at,
                auto_cancelled_at=apt.auto_cancelled_at,
                override_reason=apt.override_reason,
                created_at=apt.created_at,
                updated_at=apt.updated_at,
                ai_provider=None,
                ai_model=None,
                completeness_score=None,
                summary_link=None,
            )
            logger.info(
                "completion_sheets_push_ok",
                appointment_id=str(apt.id),
                sheet_url=sheet_url,
            )
    except Exception as sheets_err:
        # Sheets sync failures must NOT roll back the medical record.
        logger.error(
            "completion_sheets_push_failed",
            appointment_id=str(apt.id),
            error=str(sheets_err),
        )

    response = PrescriptionOut.model_validate(rx)
    return response
