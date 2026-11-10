from config.settings import settings
"""API routes for Alder & Sage clinic backend."""

import logging
from utils.file_validator import validate_and_save
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    Appointment,
    AppointmentStatus,
    Checklist,
    ChecklistItem,
    ClinicalService,
    Doctor,
    ServiceRecord,
    ServiceRecordStatus,
    ServiceType,
    TimeSlot,
    User,
    UserRole,
)
from database.schemas import (
    AppointmentCreate,
    AppointmentResponse,
    ChecklistCreateRequest,
    ChecklistSubmitRequest,
    ClinicalServiceOut,
    CompliancePatient,
    ComplianceResponse,
    DoctorPublicOut,
    DoctorResponse,
    FreeSlotRequest,
    InlineUploadRequest,
    InlineUploadResponse,
    PatientAppointmentOut,
    PatientRegisterRequest,
    ServiceRecordCreate,
    ServiceRecordResponse,
    TimeSlotResponse,
    WorkloadDoctor,
    WorkloadResponse,
)
from database import get_db
from .auth import (
    get_current_user,
    require_role,
    security,
    login as auth_login,
    forgot_password as auth_forgot_password,
    logout as auth_logout,
)
from utils.tracing import get_trace_id

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@router.post("/auth/login", response_model=dict)
async def login_endpoint(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """POST /api/v1/auth/login — JWT auth with role injection."""
    from database.schemas import LoginRequest
    schema = LoginRequest(**body)
    result = await auth_login(schema, db)
    return result.model_dump()


@router.post("/auth/forgot-password", response_model=dict)
async def forgot_password_endpoint(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """POST /api/v1/auth/forgot-password — magic link stub."""
    email = body.get("email", "")
    result = await auth_forgot_password(email, db)
    return result


@router.post("/auth/logout", response_model=dict)
async def logout_endpoint(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """POST /api/v1/auth/logout — blacklists the presented JWT in Redis.

    The token is stored under its jti with a TTL matching its remaining
    lifetime, so it can never be replayed once the user signs out.
    """
    result = await auth_logout(credentials.credentials)
    return result


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------

@router.get("/public/doctors")
async def list_public_doctors(db: AsyncSession = Depends(get_db)):
    from database.models import Doctor as DBDoctor, User as DBUser
    from database.schemas import DoctorPublicOut
    result = await db.execute(
        select(DBDoctor).where(DBDoctor.is_active.is_(True))
    )
    doctors = result.scalars().all()
    out = []
    for d in doctors:
        # Load user relation for full_name
        await db.refresh(d, ["user"])
        out.append(DoctorPublicOut(
            id=d.id,
            full_name=d.user.full_name if d.user else "Unknown",
            specialty=d.specialization,
            bio=None,
            price_per_visit=None,
            is_active=d.is_active,
        ))
    return out


@router.get("/public/services")
async def list_public_services(db: AsyncSession = Depends(get_db)):
    from database.models import ClinicalService
    from database.schemas import ClinicalServiceOut
    result = await db.execute(
        select(ClinicalService).where(ClinicalService.is_active.is_(True))
    )
    services = result.scalars().all()
    return [ClinicalServiceOut.model_validate(s) for s in services]


@router.get("/public/doctors/{doctor_id}/free-slots", response_model=List[TimeSlotResponse])
async def get_free_slots(
    doctor_id: UUID,
    body: FreeSlotRequest = FreeSlotRequest(),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as date_type

    doctor_result = await db.execute(
        select(Doctor).where(Doctor.id == doctor_id, Doctor.is_active.is_(True))
    )
    doctor = doctor_result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if body.date:
        result = await db.execute(
            select(TimeSlot)
            .where(
                TimeSlot.doctor_id == doctor_id,
                TimeSlot.date == body.date,
                TimeSlot.is_booked.is_(False),
            )
            .order_by(TimeSlot.start_time)
        )
        slots = result.scalars().all()
        if not slots:
            slots = _generate_mock_slots(doctor_id, datetime.combine(body.date, datetime.min.time(), timezone.utc), 5)
        return [TimeSlotResponse.model_validate(s) for s in slots]

    now = datetime.now(timezone.utc)
    query = select(TimeSlot).where(
        TimeSlot.doctor_id == doctor_id,
        TimeSlot.is_booked.is_(False),
    )
    end_date = now + timedelta(hours=48)
    query = query.where(
        TimeSlot.date >= now.date(),
        TimeSlot.date <= end_date.date(),
    )
    query = query.order_by(TimeSlot.date, TimeSlot.start_time).limit(3)
    result = await db.execute(query)
    slots = result.scalars().all()

    if len(slots) < 3:
        mock_slots = _generate_mock_slots(doctor_id, now, 3 - len(slots))
        slots = list(slots) + mock_slots

    return [TimeSlotResponse.model_validate(s) for s in slots]


def _generate_mock_slots(doctor_id: UUID, from_dt: datetime, count: int) -> List[TimeSlot]:
    """Generate mock time slots for demo purposes."""
    from datetime import time as time_type
    slots = []
    base = from_dt.replace(hour=9, minute=0, second=0, microsecond=0)
    for i in range(count):
        slot = TimeSlot(
            id=UUID(int=i),  # demo only
            doctor_id=doctor_id,
            date=base.date() + timedelta(days=i),
            start_time=time_type(hour=9, minute=min(i * 30, 59)),
            end_time=time_type(hour=9, minute=min((i * 30) + 30, 59)),
            is_booked=False,
        )
        slots.append(slot)
    return slots


# ---------------------------------------------------------------------------
# Doctor
# ---------------------------------------------------------------------------

@router.post(
    "/doctors/appointments/{appointment_id}/inline-upload",
    response_model=InlineUploadResponse,
)
async def inline_upload(
    appointment_id: UUID,
    body: InlineUploadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ROLE_DOCTOR)),
):
    """POST /api/v1/doctors/appointments/{id}/inline-upload."""
    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = appt_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appointment.doctor_id != current_user.id and current_user.role != UserRole.ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")


    # Security: Validate file_url to prevent SSRF
    from urllib.parse import urlparse
    import socket
    parsed = urlparse(body.file_url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid URL scheme")
    try:
        ip = socket.gethostbyname(parsed.hostname)
        if ip.startswith("127.") or ip.startswith("10.") or ip.startswith("192.168."):
            raise HTTPException(status_code=400, detail="Internal IPs blocked (SSRF prevention)")
    except socket.error:
        raise HTTPException(status_code=400, detail="Unresolvable hostname")

    # In production, validate file_url and store attachment
    logger.info(
        "Doctor %s uploaded %s to appointment %s",
        current_user.id,
        body.file_type,
        appointment_id,
    )

    return InlineUploadResponse(
        appointment_id=appointment_id,
        file_type=body.file_type,
        file_url=body.file_url,
        uploaded_by=current_user.id,
        message=f"{body.file_type.capitalize()} uploaded successfully",
    )


# ---------------------------------------------------------------------------
# Admin — Compliance
# ---------------------------------------------------------------------------

@router.get("/admin/patients/compliance", response_model=ComplianceResponse)
async def get_compliance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ROLE_ADMIN)),
):
    """GET /api/v1/admin/patients/compliance — flagged patients."""
    now = datetime.now(timezone.utc)
    twenty_four_hours = timedelta(hours=24)

    # Patients who have appointments within 24h but checklist not sent by doctor
    not_sent_result = await db.execute(
        select(Appointment, User, Checklist)
        .join(User, Appointment.patient_id == User.id)
        .outerjoin(Checklist, Checklist.appointment_id == Appointment.id)
        .where(
            Appointment.scheduled_at <= now + twenty_four_hours,
            Appointment.scheduled_at >= now,
            Appointment.status == AppointmentStatus.SCHEDULED,
            (Checklist.is_assigned_by_doctor.is_(False)) | (Checklist.id.is_(None)),
        )
    )
    not_sent_rows = not_sent_result.all()

    not_sent = [
        CompliancePatient(
            patient_id=row[0].patient_id,
            patient_name=row[1].full_name,
            email=row[1].email,
            appointment_id=row[0].id,
            appointment_date=row[0].scheduled_at,
            issue="not_sent_by_doctor",
        )
        for row in not_sent_rows
    ]

    # Patients who have appointments within 24h but haven't completed checklist
    not_responded_result = await db.execute(
        select(Appointment, User, Checklist)
        .join(User, Appointment.patient_id == User.id)
        .outerjoin(Checklist, Checklist.appointment_id == Appointment.id)
        .where(
            Appointment.scheduled_at <= now + twenty_four_hours,
            Appointment.scheduled_at >= now,
            Appointment.status == AppointmentStatus.SCHEDULED,
            (Checklist.is_completed_by_patient.is_(False)) | (Checklist.id.is_(None)),
        )
    )
    not_responded_rows = not_responded_result.all()

    not_responded = [
        CompliancePatient(
            patient_id=row[0].patient_id,
            patient_name=row[1].full_name,
            email=row[1].email,
            appointment_id=row[0].id,
            appointment_date=row[0].scheduled_at,
            issue="not_responded_by_user",
        )
        for row in not_responded_rows
    ]

    return ComplianceResponse(
        not_sent_by_doctor=not_sent,
        not_responded_by_user=not_responded,
        generated_at=now,
    )


# ---------------------------------------------------------------------------
# Admin — Doctor Workload
# ---------------------------------------------------------------------------

@router.get("/admin/doctors/workload", response_model=WorkloadResponse)
async def get_workload(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ROLE_ADMIN)),
):
    """GET /api/v1/admin/doctors/workload — aggregated appointments."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    result = await db.execute(
        select(
            Doctor.id,
            User.full_name,
            func.count(Appointment.id).label("total"),
            func.json_object_agg(
                Appointment.status,
                func.count(Appointment.id),
            ).label("by_status"),
        )
        .join(User, Doctor.user_id == User.id)
        .leftjoin(Appointment, Appointment.doctor_id == Doctor.id)
        .where(Appointment.scheduled_at >= thirty_days_ago)
        .group_by(Doctor.id, User.full_name)
    )
    rows = result.all()

    doctors = []
    for row in rows:
        status_counts = {}
        if row.by_status:
            try:
                import json
                status_counts = json.loads(row.by_status)
            except (json.JSONDecodeError, TypeError):
                status_counts = {}

        avg_per_day = row.total / 30.0 if row.total > 0 else 0.0
        doctors.append(
            WorkloadDoctor(
                doctor_id=row.id,
                doctor_name=row.full_name,
                total_appointments=row.total,
                appointments_by_status=status_counts,
                avg_appointments_per_day=round(avg_per_day, 2),
            )
        )

    return WorkloadResponse(doctors=doctors, generated_at=now)


# ---------------------------------------------------------------------------
# Service Records
# ---------------------------------------------------------------------------

@router.post("/service-records", response_model=ServiceRecordResponse)
async def create_service_record(
    body: ServiceRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ROLE_PATIENT, UserRole.ROLE_DOCTOR, UserRole.ROLE_ADMIN)),
):
    """Create a new service record (MRI, X-ray, etc.)."""
    record = ServiceRecord(
        patient_id=current_user.id,
        service_type=ServiceType(body.service_type),
        booking_date=body.booking_date,
        time_slot=body.time_slot,
        notes=body.notes,
        status=ServiceRecordStatus.BOOKED,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return ServiceRecordResponse.model_validate(record)


@router.get("/service-records", response_model=List[ServiceRecordResponse])
async def list_service_records(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List service records for the current user (or all for admins)."""
    if current_user.role == UserRole.ROLE_ADMIN:
        result = await db.execute(
            select(ServiceRecord).order_by(ServiceRecord.created_at.desc())
        )
    else:
        result = await db.execute(
            select(ServiceRecord)
            .where(ServiceRecord.patient_id == current_user.id)
            .order_by(ServiceRecord.created_at.desc())
        )
    records = result.scalars().all()
    return [ServiceRecordResponse.model_validate(r) for r in records]


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health")
async def health():
    return {"status": "healthy", "service": "alder-sage-backend"}


@router.post("/webhooks/gmail")
async def gmail_webhook(request: Request):
    """Trigger the LangGraph pipeline from a webhook."""
    from ai.pipeline import IntakeState, run_langgraph_pipeline
    body = await request.json()
    text = body.get("text", "")
    appointment_id = body.get("appointment_id", "")
    
    state = IntakeState(text=text, appointment_id=appointment_id)
    result = await run_langgraph_pipeline(state)
    if result.route == "injection" or result.error == "Prompt injection detected":
        return {
            "status": "quarantined",
            "reason": "prompt_injection_detected",
            "route": result.route,
        }
    return {"status": "success", "route": result.route, "extracted": result.extracted}


def register_routes(app):
    """Register all routes on the app."""
    app.include_router(router, prefix="/api/v1")


import os
import httpx
from fastapi.responses import RedirectResponse
import uuid
from urllib.parse import quote
from sqlalchemy.exc import IntegrityError
from models import Patient, StaffUser, StaffRole, Doctor as CoreDoctor
from core.security import create_patient_access_token, create_staff_access_token, hash_password

@router.get("/auth/google/login")
async def google_login(role: str = "patient"):
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google Client ID not configured")

    base_url = (settings.app_base_url or "http://localhost:8000").rstrip("/")
    redirect_uri = f"{base_url}/api/v1/auth/google/callback"
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.google_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid email profile"
        f"&state={role}"
        f"&prompt=select_account"
    )
    return RedirectResponse(auth_url)

@router.get("/auth/google/callback")
async def google_callback(code: str, state: str = "patient", db: AsyncSession = Depends(get_db)):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=500, detail="Google credentials not configured")

    base_url = (settings.app_base_url or "http://localhost:8000").rstrip("/")
    redirect_uri = f"{base_url}/api/v1/auth/google/callback"

    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            }
        )
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google token")

        access_token = token_res.json().get("access_token")

        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if userinfo_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user profile")

        profile = userinfo_res.json()

    email = (profile.get("email") or "").strip().lower()
    name = (profile.get("name") or "Google User").strip()

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    role_slug = state.lower() if state.lower() in ("patient", "doctor", "admin") else "patient"

    from core.security import is_master_account
    is_master = is_master_account(email)

    if is_master:
        # 1. Ensure Patient record exists
        p_res = await db.execute(select(Patient).where(func.lower(Patient.email) == email))
        if not p_res.scalar_one_or_none():
            db.add(Patient(id=uuid.uuid4(), full_name=name or "Master Administrator", email=email, password_hash=None))
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()

        # 2. Ensure Doctor record exists
        doc_res = await db.execute(select(CoreDoctor).where(func.lower(CoreDoctor.email) == email))
        doc = doc_res.scalar_one_or_none()
        if not doc:
            doc = CoreDoctor(
                id=uuid.uuid4(),
                full_name=name or "Master Administrator",
                email=email,
                specialty="Chief of Medicine / System Overseer",
            )
            db.add(doc)
            try:
                await db.commit()
                await db.refresh(doc)
            except IntegrityError:
                await db.rollback()
                doc = (await db.execute(select(CoreDoctor).where(func.lower(CoreDoctor.email) == email))).scalar_one()

        # 3. Ensure StaffUser record exists as ADMIN
        s_res = await db.execute(select(StaffUser).where(func.lower(StaffUser.email) == email))
        staff = s_res.scalar_one_or_none()
        if not staff:
            staff = StaffUser(
                id=uuid.uuid4(),
                email=email,
                full_name=name or "Master Administrator",
                password_hash=hash_password(str(uuid.uuid4())),
                role=StaffRole.ADMIN,
                doctor_id=doc.id if doc else None,
            )
            db.add(staff)
            try:
                await db.commit()
                await db.refresh(staff)
            except IntegrityError:
                await db.rollback()
                staff = (await db.execute(select(StaffUser).where(func.lower(StaffUser.email) == email))).scalar_one()

        role_slug = "admin"
        token = create_staff_access_token(
            subject=email,
            role="admin",
            doctor_id=str(doc.id) if doc else None,
        )
        display_name = name or "Master Administrator"
    elif role_slug == "patient":
        result = await db.execute(select(Patient).where(func.lower(Patient.email) == email))
        patient = result.scalar_one_or_none()
        if not patient:
            patient = Patient(id=uuid.uuid4(), full_name=name, email=email, password_hash=None)
            db.add(patient)
            try:
                await db.commit()
                await db.refresh(patient)
            except IntegrityError:
                await db.rollback()
                result = await db.execute(select(Patient).where(func.lower(Patient.email) == email))
                patient = result.scalar_one()
        token = create_patient_access_token(subject=patient.email)
        display_name = patient.full_name or name
    else:
        staff_role = StaffRole.DOCTOR if role_slug == "doctor" else StaffRole.ADMIN
        result = await db.execute(select(StaffUser).where(func.lower(StaffUser.email) == email))
        staff = result.scalar_one_or_none()
        if not staff:
            doc_id = None
            if staff_role == StaffRole.DOCTOR:
                doc_res = await db.execute(select(CoreDoctor).where(func.lower(CoreDoctor.email) == email))
                doc = doc_res.scalar_one_or_none()
                if not doc:
                    doc = CoreDoctor(id=uuid.uuid4(), full_name=name, email=email)
                    db.add(doc)
                    await db.flush()
                doc_id = doc.id
            staff = StaffUser(
                id=uuid.uuid4(),
                email=email,
                full_name=name,
                password_hash=hash_password(str(uuid.uuid4())),
                role=staff_role,
                doctor_id=doc_id,
            )
            db.add(staff)
            try:
                await db.commit()
                await db.refresh(staff)
            except IntegrityError:
                await db.rollback()
                result = await db.execute(select(StaffUser).where(func.lower(StaffUser.email) == email))
                staff = result.scalar_one()
        role_slug = staff.role.value
        token = create_staff_access_token(
            subject=staff.email,
            role=role_slug,
            doctor_id=str(staff.doctor_id) if staff.doctor_id else None,
        )
        display_name = staff.full_name or name

    frontend_url = (
        getattr(settings, "frontend_url", None)
        or os.getenv("FRONTEND_URL")
        or (settings.cors_origins[0] if settings.cors_origins else "http://localhost:3000")
    ).rstrip("/")
    return RedirectResponse(
        f"{frontend_url}/auth/callback?token={token}&role={role_slug}&name={quote(display_name)}"
    )
