"""api/patient.py — Patient-portal routes (role == "patient").

Auth model (situation-based, per user direction):
  - Default: email + password login (Patient.password_hash)
  - Fallback: magic-link OTP for forgotten passwords — code is emailed,
    then verified to mint a fresh patient JWT.

All routes here are guarded by get_current_patient (which requires role=="patient").
Patients can read their OWN appointments, intake summaries, and prescriptions only.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timezone, timedelta, date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import (
    create_patient_access_token, get_current_patient, verify_password, hash_password,
)
from core.logging import get_logger
from core.config import settings
from models import (
    Patient, Appointment, IntakeSubmission, Prescription,
    PatientMagicToken, MagicTokenState, AuditLog, ActorType,
    Checklist, ChecklistItem, Doctor, generate_ref_code, AppointmentStatus,
)
from schemas.schemas import (
    PatientOut, PatientLoginRequest, PatientTokenResponse,
    PatientMagicLinkRequest, PatientMagicVerifyRequest, MagicLinkSentResponse,
    AppointmentDoctorOut, DoctorOut,
    IntakeSummaryOut,
    PrescriptionOutWithDoctor,
    PatientAppointmentOut,
    ChecklistOut, ChecklistItemOut,
    ChecklistSubmitRequest, ChecklistCreateRequest,
    PatientRegisterRequest, PatientBookAppointmentRequest,
)

router = APIRouter(prefix="/api/patient", tags=["patient"])
logger = get_logger("api.patient")

_MAGIC_TOKEN_TTL_MINUTES = 15
_OTP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous chars


def _hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _gen_otp() -> str:
    return "".join(secrets.choice(_OTP_ALPHABET) for _ in range(8))


# ── Login + magic-link ─────────────────────────────────────

@router.post("/login", response_model=PatientTokenResponse)
async def patient_login(
    body: PatientLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Email + password login (default)."""
    result = await db.execute(
        select(Patient).where(Patient.email == body.email.strip().lower())
    )
    patient = result.scalar_one_or_none()
    if not patient or not patient.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, patient.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_patient_access_token(subject=patient.email)
    return PatientTokenResponse(
        access_token=token, patient_id=patient.id, full_name=patient.full_name,
    )


@router.post("/magic-link", response_model=MagicLinkSentResponse)
async def request_magic_link(
    body: PatientMagicLinkRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request an OTP login code (for forgotten passwords). Always returns
    sent=True so an attacker can't probe which emails have accounts."""
    result = await db.execute(
        select(Patient).where(Patient.email == body.email.strip().lower())
    )
    patient = result.scalar_one_or_none()

    if patient is None:
        # Don't leak whether the email has an account.
        return MagicLinkSentResponse()

    code = _gen_otp()
    token = PatientMagicToken(
        id=uuid.uuid4(),
        patient_id=patient.id,
        token_hash=_hash_otp(code),
        state=MagicTokenState.PENDING,
        requested_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=_MAGIC_TOKEN_TTL_MINUTES),
    )
    db.add(token)
    await db.commit()

    # Email the OTP via gmail_client (best-effort; non-fatal if email send fails).
    try:
        from services.gmail_client import gmail_client
        html = (
            f"<p>Hello {patient.full_name},</p>"
            f"<p>Your one-time login code for the patient portal is:</p>"
            f"<p style='font-size:24px; font-weight:bold; letter-spacing:4px;'>{code}</p>"
            f"<p>This code expires in {_MAGIC_TOKEN_TTL_MINUTES} minutes. "
            f"If you did not request it, ignore this email.</p>"
        )
        await gmail_client.send_email(
            to=patient.email, subject="Your patient portal login code", html_body=html,
        )
    except Exception as e:
        logger.error("magic_link_email_failed", patient_id=str(patient.id), error=str(e))
    return MagicLinkSentResponse()


@router.post("/magic-link/verify", response_model=PatientTokenResponse)
async def verify_magic_link(
    body: PatientMagicVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange an OTP for a patient JWT."""
    result = await db.execute(
        select(Patient).where(Patient.email == body.email.strip().lower())
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=401, detail="Invalid code")

    token_result = await db.execute(
        select(PatientMagicToken).where(
            PatientMagicToken.token_hash == _hash_otp(body.code.strip().upper()),
            PatientMagicToken.patient_id == patient.id,
            PatientMagicToken.state == MagicTokenState.PENDING,
        ).order_by(PatientMagicToken.requested_at.desc()).limit(1)
    )
    token = token_result.scalar_one_or_none()
    if not token or token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    token.state = MagicTokenState.USED
    token.used_at = datetime.now(timezone.utc)
    await db.commit()

    jwt = create_patient_access_token(subject=patient.email)
    return PatientTokenResponse(
        access_token=jwt, patient_id=patient.id, full_name=patient.full_name,
    )


class SetPasswordRequest(BaseModel):
    new_password: str

    model_config = {"json_schema_extra": {"examples": [{"new_password": "Str0ngP@ssw0rd"}]}}


@router.post("/set-password")
async def set_password(
    body: SetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    patient_email: str = Depends(get_current_patient),
):
    """Allow a logged-in patient (via magic-link) to set a password for future logins."""
    new_password = body.new_password
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    result = await db.execute(
        select(Patient).where(Patient.email == patient_email)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.password_hash = hash_password(new_password)
    await db.commit()
    return {"status": "ok"}


# ── Self-service reads ─────────────────────────────────────

async def _get_own_patient(db: AsyncSession, email: str) -> Patient:
    result = await db.execute(select(Patient).where(Patient.email == email))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


async def _patient_own_appointment(
    db: AsyncSession, patient: Patient, appointment_id: uuid.UUID,
) -> Appointment:
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.patient_id == patient.id,
        )
    )
    apt = result.scalar_one_or_none()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return apt


@router.get("/me", response_model=PatientOut)
async def get_me(
    db: AsyncSession = Depends(get_db),
    patient_email: str = Depends(get_current_patient),
):
    patient = await _get_own_patient(db, patient_email)
    return PatientOut.model_validate(patient)


@router.get("/appointments", response_model=list[PatientAppointmentOut])
async def list_my_appointments(
    db: AsyncSession = Depends(get_db),
    patient_email: str = Depends(get_current_patient),
):
    patient = await _get_own_patient(db, patient_email)
    result = await db.execute(
        select(Appointment)
        .where(Appointment.patient_id == patient.id)
        .order_by(Appointment.scheduled_at.desc())
    )
    items = []
    for apt in result.scalars().all():
        await db.refresh(apt, ["doctor"])
        items.append(_apt_to_patient_out(apt, patient))
    return items


@router.get("/appointments/{appointment_id}/intake-summary", response_model=IntakeSummaryOut)
async def get_my_intake_summary(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    patient_email: str = Depends(get_current_patient),
):
    from core.encryption import decrypt_json
    patient = await _get_own_patient(db, patient_email)
    apt = await _patient_own_appointment(db, patient, appointment_id)
    intake_result = await db.execute(
        select(IntakeSubmission).where(IntakeSubmission.appointment_id == apt.id)
    )
    intake = intake_result.scalar_one_or_none()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not yet submitted")
    summary_data = decrypt_json(intake.structured_summary)
    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.PATIENT,
        action="READ_OWN_INTAKE",
        entity_type="Appointment",
        entity_id=apt.id,
        details={"by": patient_email},
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


@router.get("/appointments/{appointment_id}/prescriptions", response_model=list[PrescriptionOutWithDoctor])
async def list_my_prescriptions(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    patient_email: str = Depends(get_current_patient),
):
    patient = await _get_own_patient(db, patient_email)
    apt = await _patient_own_appointment(db, patient, appointment_id)
    result = await db.execute(
        select(Prescription).where(Prescription.appointment_id == apt.id)
    )
    items = []
    for p in result.scalars().all():
        await db.refresh(p, ["doctor"])
        items.append(PrescriptionOutWithDoctor(
            id=p.id, appointment_id=p.appointment_id,
            doctor_id=p.doctor_id,
            medication_name=p.medication_name, dosage=p.dosage,
            frequency=p.frequency, duration=p.duration,
            status=p.status.value, notes=p.notes,
            storage_url=p.storage_url,
            created_at=p.created_at, updated_at=p.updated_at,
            doctor=DoctorOut.model_validate(p.doctor) if p.doctor else None,
        ))
    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.PATIENT,
        action="VIEW_OWN_PRESCRIPTIONS",
        entity_type="Appointment",
        entity_id=apt.id,
        details={"by": patient_email},
    ))
    await db.commit()
    return items


def _apt_to_patient_out(apt: Appointment, patient: Patient) -> PatientAppointmentOut:
    """Convert an Appointment to the frontend-compatible PatientAppointmentOut shape."""
    from datetime import date as date_type
    today = datetime.now(timezone.utc).date()
    scheduled_date = apt.scheduled_at.date()
    day_offset = (scheduled_date - today).days
    time_str = apt.scheduled_at.strftime("%H:%M")

    kind = "consult"
    if apt.doctor:
        title = f"{apt.doctor.full_name} · {apt.doctor.specialty or 'Consultation'}"
        provider = apt.doctor.full_name
        dept = apt.doctor.specialty or "General Medicine"
        duration = "45 min"
        location = "In-clinic · Suite 12"
    else:
        title = "Clinical Service"
        provider = "Verdant Diagnostics"
        dept = "Diagnostics"
        duration = "30 min"
        location = "Diagnostics Wing · Level 2"

    return PatientAppointmentOut(
        id=apt.id,
        kind=kind,
        title=title,
        provider=provider,
        dept=dept,
        day_offset=day_offset,
        time=time_str,
        duration=duration,
        location=location,
        status=apt.status.value,
        note=apt.ref_code,
        ref_code=apt.ref_code,
        has_record=False,
        record_id=None,
        prescription_id=None,
        created_at=apt.created_at,
    )


# ── Patient Registration ───────────────────────────────────────

@router.post("/register", response_model=PatientTokenResponse, status_code=201)
async def register_patient(body: PatientRegisterRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    result = await db.execute(select(Patient).where(Patient.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    patient = Patient(
        id=uuid.uuid4(),
        email=email,
        full_name=body.full_name.strip(),
        password_hash=hash_password(body.password),
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)

    token = create_patient_access_token(subject=patient.email)
    return PatientTokenResponse(
        access_token=token, patient_id=patient.id, full_name=patient.full_name,
    )


# ── Appointment Booking ────────────────────────────────────────

@router.post("/appointments", response_model=PatientAppointmentOut, status_code=201)
async def book_appointment(
    body: PatientBookAppointmentRequest,
    db: AsyncSession = Depends(get_db),
    patient_email: str = Depends(get_current_patient),
):
    patient = await _get_own_patient(db, patient_email)

    doctor_result = await db.execute(
        select(Doctor).where(Doctor.id == body.doctor_id)
    )
    doctor = doctor_result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if body.scheduled_date < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Cannot schedule in the past")

    try:
        scheduled_dt = datetime.combine(
            body.scheduled_date,
            datetime.strptime(body.time_slot, "%H:%M").time(),
        ).replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    apt = Appointment(
        id=uuid.uuid4(),
        patient_id=patient.id,
        doctor_id=doctor.id,
        scheduled_at=scheduled_dt,
        status=AppointmentStatus.PENDING_INTAKE,
        ref_code=generate_ref_code(),
        calendly_event_uuid=f"portal-{uuid.uuid4()}",
    )
    db.add(apt)
    await db.commit()
    await db.refresh(apt, ["doctor"])

    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.PATIENT,
        action="BOOK_APPOINTMENT",
        entity_type="Appointment",
        entity_id=apt.id,
        details={"by": patient_email, "doctor_id": str(doctor.id), "scheduled_at": scheduled_dt.isoformat()},
    ))
    await db.commit()

    return _apt_to_patient_out(apt, patient)


# ── Checklists ────────────────────────────────────────────────

@router.get("/checklists", response_model=list[ChecklistOut])
async def list_my_checklists(
    db: AsyncSession = Depends(get_db),
    patient_email: str = Depends(get_current_patient),
):
    patient = await _get_own_patient(db, patient_email)
    result = await db.execute(
        select(Checklist)
        .where(Checklist.patient_id == patient.id)
        .order_by(Checklist.due_date.desc().nullslast())
    )
    checklists = result.scalars().all()

    out = []
    for cl in checklists:
        await db.refresh(cl, ["items"])
        items = []
        for item in cl.items:
            items.append(ChecklistItemOut(
                id=item.id,
                label=item.label,
                done=item.done,
                value=item.value,
                placeholder=item.placeholder,
                required=item.required,
                position=item.position,
            ))
        out.append(ChecklistOut(
            id=cl.id,
            title=cl.title,
            assigned_for=cl.assigned_for,
            due_date=cl.due_date,
            submitted=cl.submitted,
            submitted_at=cl.submitted_at,
            items=items,
        ))
    return out


@router.post("/checklists/{checklist_id}/submit", response_model=ChecklistOut)
async def submit_checklist(
    checklist_id: uuid.UUID,
    body: ChecklistSubmitRequest,
    db: AsyncSession = Depends(get_db),
    patient_email: str = Depends(get_current_patient),
):
    patient = await _get_own_patient(db, patient_email)
    result = await db.execute(
        select(Checklist).where(Checklist.id == checklist_id)
    )
    checklist = result.scalar_one_or_none()
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    if checklist.patient_id != patient.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if checklist.submitted:
        raise HTTPException(status_code=409, detail="Checklist already submitted")

    await db.refresh(checklist, ["items"])
    item_map = {item.label: item for item in checklist.items}

    for submitted in body.items:
        label = submitted.get("label")
        value = submitted.get("value")
        if label in item_map:
            item_map[label].done = True
            item_map[label].value = value

    checklist.submitted = True
    checklist.submitted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(checklist, ["items"])

    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.PATIENT,
        action="SUBMIT_CHECKLIST",
        entity_type="Checklist",
        entity_id=checklist.id,
        details={"by": patient_email},
    ))
    await db.commit()

    items = []
    for item in checklist.items:
        items.append(ChecklistItemOut(
            id=item.id,
            label=item.label,
            done=item.done,
            value=item.value,
            placeholder=item.placeholder,
            required=item.required,
            position=item.position,
        ))
    return ChecklistOut(
        id=checklist.id,
        title=checklist.title,
        assigned_for=checklist.assigned_for,
        due_date=checklist.due_date,
        submitted=checklist.submitted,
        submitted_at=checklist.submitted_at,
        items=items,
    )
