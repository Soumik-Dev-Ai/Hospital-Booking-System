"""Pydantic v2 schemas for request / response validation."""

from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Common
# ---------------------------------------------------------------------------

class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: UUID
    full_name: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class MagicLinkResponse(BaseSchema):
    message: str = "If the email exists in our system, a magic link has been sent."


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class PatientCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class PatientResponse(BaseSchema):
    id: UUID
    email: str
    full_name: str
    phone: Optional[str]
    date_of_birth: Optional[date]
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Doctors
# ---------------------------------------------------------------------------

class DoctorResponse(BaseSchema):
    id: UUID
    user_id: UUID
    specialization: Optional[str]
    license_number: Optional[str]
    is_active: bool
    full_name: str
    email: str


# ---------------------------------------------------------------------------
# Time Slots
# ---------------------------------------------------------------------------

class TimeSlotResponse(BaseSchema):
    id: UUID
    doctor_id: UUID
    date: date
    start_time: time
    end_time: time
    is_booked: bool


class FreeSlotRequest(BaseModel):
    hours_ahead: int = Field(default=48, ge=1, le=720)
    date: Optional[date] = None


# ---------------------------------------------------------------------------
# Public doctor / service catalog
# ---------------------------------------------------------------------------

class DoctorPublicOut(BaseSchema):
    """Public doctor card rendered by the BookingFlow.

    `rating` and `reviews_count` are optional in the database and are defaulted
    here so the public catalog never breaks when those columns are empty.
    """
    id: UUID
    full_name: str
    specialty: Optional[str] = None
    bio: Optional[str] = None
    price_per_visit: Optional[int] = None
    rating: float = 4.7
    reviews_count: int = 0
    is_active: bool = True


class ClinicalServiceOut(BaseSchema):
    """Public clinical service card rendered by the BookingFlow."""
    id: UUID
    name: str
    department: str
    duration: str
    fee: int
    prep_instructions: Optional[str] = None
    is_active: bool = True


# ---------------------------------------------------------------------------
# Patient appointment (frontend-compatible shape)
# ---------------------------------------------------------------------------

class PatientAppointmentOut(BaseSchema):
    """Frontend-facing appointment shape.

    The frontend consumes appointments as `kind` + `title` + `provider` +
    `dept` + `dayOffset` (integer days from today) + `time` (HH:MM) +
    `duration`. This adapter is computed server-side from the raw
    `scheduled_at` datetime so the patient app never has to do date math.
    """
    id: UUID
    kind: str = "consult"            # "consult" | "service"
    title: str
    provider: str
    dept: str
    day_offset: int
    time: str                        # "HH:MM"
    duration: str = "45 min"
    location: str = "In-clinic"
    status: str
    note: Optional[str] = None
    ref_code: Optional[str] = None
    has_record: bool = False
    record_id: Optional[UUID] = None
    prescription_id: Optional[UUID] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Checklists (frontend-compatible item-based shape)
# ---------------------------------------------------------------------------

class ChecklistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[UUID] = None
    label: str
    done: bool = False
    value: Optional[str] = None
    placeholder: Optional[str] = None
    required: bool = False
    position: int = 0


class ChecklistOut(BaseSchema):
    id: UUID
    title: str
    assigned_for: str
    due_date: Optional[datetime] = None
    submitted: bool
    submitted_at: Optional[datetime] = None
    items: List[ChecklistItemOut] = []


class ChecklistSubmitRequest(BaseModel):
    items: List[dict] = Field(default_factory=list)
    # Each item: {"label": "...", "value": "..."}


class ChecklistCreateRequest(BaseModel):
    title: str
    assigned_for: Optional[str] = None
    due_date: Optional[datetime] = None
    items: List[dict] = Field(default_factory=list)
    # Each item: {"label": "...", "required": true, "placeholder": "..."}


# ---------------------------------------------------------------------------
# Patient registration
# ---------------------------------------------------------------------------

class PatientRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class PatientBookAppointmentRequest(BaseModel):
    doctor_id: UUID
    scheduled_date: date
    time_slot: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    service_type: str = Field(default="consult")
    duration: str = Field(default="45 min")
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------

class AppointmentCreate(BaseModel):
    doctor_id: UUID
    scheduled_at: datetime
    notes: Optional[str] = None


class AppointmentResponse(BaseSchema):
    id: UUID
    patient_id: UUID
    doctor_id: UUID
    scheduled_at: datetime
    status: str
    notes: Optional[str]
    intake_form_completed: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Service Records
# ---------------------------------------------------------------------------

class ServiceRecordCreate(BaseModel):
    doctor_id: Optional[UUID] = None
    service_type: str
    booking_date: date
    time_slot: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("service_type")
    @classmethod
    def valid_service_type(cls, v: str) -> str:
        valid = {"MRI", "X-ray", "Blood Work", "ECG", "Ultrasound", "Other"}
        if v not in valid:
            raise ValueError(f"service_type must be one of {valid}")
        return v


class ServiceRecordResponse(BaseSchema):
    id: UUID
    patient_id: UUID
    appointment_id: Optional[UUID]
    service_type: str
    booking_date: date
    time_slot: Optional[str]
    status: str
    result_document_url: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Checklists
# ---------------------------------------------------------------------------

class ChecklistCreate(BaseModel):
    appointment_id: UUID
    doctor_id: Optional[UUID] = None
    form_data: Optional[str] = None


class ChecklistResponse(BaseSchema):
    id: UUID
    appointment_id: UUID
    patient_id: UUID
    doctor_id: Optional[UUID]
    is_assigned_by_doctor: bool
    is_completed_by_patient: bool
    form_data: Optional[str]
    submitted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Admin Analytics
# ---------------------------------------------------------------------------

class CompliancePatient(BaseSchema):
    patient_id: UUID
    patient_name: str
    email: str
    appointment_id: UUID
    appointment_date: datetime
    issue: str  # "not_sent_by_doctor" | "not_responded_by_user"


class WorkloadDoctor(BaseSchema):
    doctor_id: UUID
    doctor_name: str
    total_appointments: int
    appointments_by_status: dict
    avg_appointments_per_day: float


class ComplianceResponse(BaseSchema):
    not_sent_by_doctor: List[CompliancePatient]
    not_responded_by_user: List[CompliancePatient]
    generated_at: datetime


class WorkloadResponse(BaseSchema):
    doctors: List[WorkloadDoctor]
    generated_at: datetime


# ---------------------------------------------------------------------------
# Inline Upload
# ---------------------------------------------------------------------------

class InlineUploadRequest(BaseModel):
    file_type: str = Field(..., pattern="^(checklist|prescription)$")
    file_url: str = Field(..., min_length=1, max_length=2048)
    notes: Optional[str] = None


class InlineUploadResponse(BaseSchema):
    appointment_id: UUID
    file_type: str
    file_url: str
    uploaded_by: UUID
    message: str
