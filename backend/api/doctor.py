"""api/doctor.py — Doctor-scoped routes (role == "doctor", doctor_id check).

Every endpoint verifies appointment.doctor_id matches the logged-in doctor's doctor_id.
Admin tokens are REJECTED here (spec: doctor routes are for doctors only, admin is separate).
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.security import require_staff_doctor
from core.logging import get_logger
from core.encryption import decrypt_json
from models import (
    Appointment, AppointmentStatus, IntakeSubmission,
    Prescription, PrescriptionStatus, Doctor,
    AuditLog, ActorType,
    Checklist, ChecklistItem,
)
from schemas.schemas import (
    AppointmentDoctorOut, AppointmentDetailOut, DoctorOut,
    IntakeSummaryOut, IntakeSubmissionOut,
    PrescriptionCreateRequest, PrescriptionOutWithDoctor,
    PaginatedResponse,
    ChecklistCreateRequest, ChecklistOut, ChecklistItemOut,
)

router = APIRouter(prefix="/api/doctor", tags=["doctor"])
logger = get_logger("api.doctor")


_AUDIT_ACTOR_TYPE = ActorType.DOCTOR
_ROUTE_OWNERSHIP_DENIED = "This appointment is not yours"


async def _fetch_own_appointment(
    db: AsyncSession, appointment_id: uuid.UUID, doctor_id: uuid.UUID,
) -> Appointment:
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if apt.doctor_id != doctor_id:
        raise HTTPException(status_code=403, detail=_ROUTE_OWNERSHIP_DENIED)
    return apt


@router.get("/appointments", response_model=PaginatedResponse)
async def list_own_appointments(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_staff_doctor),
):
    doctor_id_val = uuid.UUID(staff["doctor_id"])
    query = (
        select(Appointment)
        .where(Appointment.doctor_id == doctor_id_val)
    )
    count_q = (
        select(func.count(Appointment.id))
        .where(Appointment.doctor_id == doctor_id_val)
    )
    if status_filter:
        try:
            s = AppointmentStatus(status_filter)
            query = query.where(Appointment.status == s)
            count_q = count_q.where(Appointment.status == s)
        except ValueError:
            pass
    if from_date:
        query = query.where(Appointment.scheduled_at >= datetime.fromisoformat(from_date))
        count_q = count_q.where(Appointment.scheduled_at >= datetime.fromisoformat(from_date))
    if to_date:
        query = query.where(Appointment.scheduled_at <= datetime.fromisoformat(to_date))
        count_q = count_q.where(Appointment.scheduled_at <= datetime.fromisoformat(to_date))

    total = await db.scalar(count_q)
    query = query.order_by(Appointment.scheduled_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = []
    for apt in result.scalars().all():
        await db.refresh(apt, ["doctor"])
        items.append(AppointmentDoctorOut(
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
            ref_code=apt.ref_code,
            doctor=DoctorOut.model_validate(apt.doctor) if apt.doctor else None,
        ))
    return PaginatedResponse(items=items, total=total or 0, page=page, page_size=page_size)


@router.get("/appointments/{appointment_id}", response_model=AppointmentDetailOut)
async def get_own_appointment(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_staff_doctor),
):
    doctor_id_val = uuid.UUID(staff["doctor_id"])
    apt = await _fetch_own_appointment(db, appointment_id, doctor_id_val)
    await db.refresh(apt, ["patient"])
    await db.refresh(apt, ["intake_submission"])
    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=_AUDIT_ACTOR_TYPE,
        action="READ_APPOINTMENT",
        entity_type="Appointment",
        entity_id=apt.id,
        details={"by": staff["email"], "has_intake": apt.intake_submission is not None},
    ))
    await db.commit()
    return AppointmentDetailOut(
        id=apt.id, patient_id=apt.patient_id,
        calendly_event_uuid=apt.calendly_event_uuid,
        scheduled_at=apt.scheduled_at, status=apt.status.value,
        warning_sent_at=apt.warning_sent_at,
        reminder_sent_at=apt.reminder_sent_at,
        auto_cancelled_at=apt.auto_cancelled_at,
        overridden_by_doctor_at=apt.overridden_by_doctor_at,
        override_reason=apt.override_reason,
        created_at=apt.created_at, updated_at=apt.updated_at,
        patient=apt.patient,
        intake_submission=IntakeSubmissionOut.model_validate(apt.intake_submission) if apt.intake_submission else None,
    )


@router.get("/{appointment_id}/intake-summary", response_model=IntakeSummaryOut)
async def get_intake_summary(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_staff_doctor),
):
    doctor_id_val = uuid.UUID(staff["doctor_id"])
    apt = await _fetch_own_appointment(db, appointment_id, doctor_id_val)
    result = await db.execute(
        select(IntakeSubmission).where(IntakeSubmission.appointment_id == apt.id)
    )
    intake = result.scalar_one_or_none()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not yet submitted")
    summary_data = decrypt_json(intake.structured_summary)
    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.DOCTOR,
        action="READ_INTAKE",
        entity_type="Appointment",
        entity_id=apt.id,
        details={"by": staff["email"]},
    ))
    await db.commit()
    return IntakeSummaryOut(
        appointment_id=apt.id,
        chief_complaint=summary_data.get("chief_complaint", "[Not provided]"),
        current_medications=summary_data.get("current_medications", []),
        allergies=summary_data.get("allergies", []),
        past_medical_history=summary_data.get("past_medical_history", "[Not provided]"),
        past_surgical_history=summary_data.get("past_surgical_history", "[Not provided]"),
        family_history=summary_data.get("family_history", "[Not provided]"),
        social_history=summary_data.get("social_history", "[Not provided]"),
        additional_notes=summary_data.get("additional_notes", "[Not provided]"),
        completeness_score=summary_data.get("completeness_score", 0),
        missing_fields=summary_data.get("missing_fields", []),
        ai_provider=intake.ai_provider,
        ai_model_version=intake.ai_model_version,
        ai_processed_at=intake.ai_processed_at,
    )


@router.post("/{appointment_id}/prescription", response_model=PrescriptionOutWithDoctor)
async def create_prescription(
    appointment_id: uuid.UUID,
    body: PrescriptionCreateRequest,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_staff_doctor),
):
    doctor_id_val = uuid.UUID(staff["doctor_id"])
    apt = await _fetch_own_appointment(db, appointment_id, doctor_id_val)

    prescription = Prescription(
        id=uuid.uuid4(),
        appointment_id=apt.id,
        doctor_id=doctor_id_val,
        medication_name=body.medication_name,
        dosage=body.dosage,
        frequency=body.frequency,
        duration=body.duration,
        status=PrescriptionStatus.ACTIVE,
        notes=body.notes,
        storage_url=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(prescription)

    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.DOCTOR,
        action="CREATE_PRESCRIPTION",
        entity_type="Prescription",
        entity_id=prescription.id,
        details={"by": staff["email"], "medication": body.medication_name, "appointment_id": str(apt.id)},
    ))
    await db.commit()
    await db.refresh(prescription, ["doctor"])
    return PrescriptionOutWithDoctor(
        id=prescription.id, appointment_id=prescription.appointment_id,
        doctor_id=prescription.doctor_id,
        medication_name=prescription.medication_name,
        dosage=prescription.dosage,
        frequency=prescription.frequency,
        duration=prescription.duration,
        status=prescription.status.value,
        notes=prescription.notes,
        storage_url=prescription.storage_url,
        created_at=prescription.created_at,
        updated_at=prescription.updated_at,
        doctor=DoctorOut.model_validate(prescription.doctor) if prescription.doctor else None,
    )


# ── Doctor Self Profile ──────────────────────────────────────

@router.get("/me", response_model=DoctorOut)
async def get_doctor_me(
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_staff_doctor),
):
    doctor_id_val = uuid.UUID(staff["doctor_id"])
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id_val))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    return DoctorOut.model_validate(doctor)


# ── Checklist Assignment ─────────────────────────────────────

@router.post("/{appointment_id}/checklist", status_code=201, response_model=ChecklistOut)
async def assign_checklist(
    appointment_id: uuid.UUID,
    body: ChecklistCreateRequest,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_staff_doctor),
):
    doctor_id_val = uuid.UUID(staff["doctor_id"])
    apt = await _fetch_own_appointment(db, appointment_id, doctor_id_val)
    
    await db.refresh(apt, ["doctor"])
    doctor_name = apt.doctor.full_name if apt.doctor else "Your Care Team"
    
    checklist = Checklist(
        id=uuid.uuid4(),
        patient_id=apt.patient_id,
        appointment_id=apt.id,
        doctor_id=doctor_id_val,
        title=body.title,
        assigned_for=body.assigned_for or doctor_name,
        due_date=body.due_date,
        submitted=False,
    )
    db.add(checklist)
    await db.flush()

    for position, item_data in enumerate(body.items):
        item = ChecklistItem(
            id=uuid.uuid4(),
            checklist_id=checklist.id,
            position=position,
            label=item_data.get("label", ""),
            required=item_data.get("required", False),
            placeholder=item_data.get("placeholder", ""),
        )
        db.add(item)
    
    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.DOCTOR,
        action="CREATE_CHECKLIST",
        entity_type="Checklist",
        entity_id=checklist.id,
        details={"by": staff["email"], "appointment_id": str(apt.id)},
    ))
    await db.commit()
    await db.refresh(checklist, ["items"])
    
    return ChecklistOut.model_validate(checklist)