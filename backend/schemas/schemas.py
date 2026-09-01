from datetime import datetime, date
from uuid import UUID
from pydantic import BaseModel, Field

# --- Webhook Payloads ---

class CalendlyWebhookPayload(BaseModel):
    event: str = Field(..., alias="event")
    payload: dict = Field(...)


class PubSubPushMessage(BaseModel):
    data: str | None = None
    message_id: str | None = Field(None, alias="messageId")
    publish_time: str | None = Field(None, alias="publishTime")


class PubSubPushBody(BaseModel):
    message: PubSubPushMessage
    subscription: str | None = None


# --- AI Parsed Intake ---

class IntakeSummary(BaseModel):
    chief_complaint: str
    current_medications: list[str]
    allergies: list[str]
    past_medical_history: str
    past_surgical_history: str
    family_history: str
    social_history: str
    additional_notes: str
    completeness_score: int = Field(ge=0, le=100)
    missing_fields: list[str]


# --- API Schemas: Auth ---

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- API Schemas: Patient ---

class PatientOut(BaseModel):
    id: UUID
    full_name: str
    email: str
    phone: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- API Schemas: Appointment ---

class AppointmentOut(BaseModel):
    id: UUID
    patient_id: UUID
    calendly_event_uuid: str
    scheduled_at: datetime
    status: str
    warning_sent_at: datetime | None
    reminder_sent_at: datetime | None
    auto_cancelled_at: datetime | None
    overridden_by_doctor_at: datetime | None
    override_reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AppointmentDetailOut(AppointmentOut):
    patient: "PatientOut | None" = None
    intake_submission: "IntakeSubmissionOut | None" = None


class AppointmentOverrideRequest(BaseModel):
    action: str
    reason: str | None = None


class AppointmentCompleteRequest(BaseModel):
    """Phase 3 addendum: marks the appointment COMPLETED and creates/updates the
    Prescription row with the doctor's narrative + ordered test checklist."""
    prescription_text: str
    checklist_tests: list[str] = []


# --- API Schemas: Intake ---

class IntakeSubmissionOut(BaseModel):
    id: UUID
    appointment_id: UUID
    raw_reply_text: str
    structured_summary: dict
    completeness_score: int
    missing_fields: list[str]
    summary_doc_url: str | None
    ai_processed_at: datetime
    ai_provider: str | None
    ai_model_version: str

    model_config = {"from_attributes": True}


# --- API Schemas: Briefing ---

class DailyBriefingOut(BaseModel):
    id: UUID
    date: date
    content: dict
    sheet_url: str | None
    sent_at: datetime | None

    model_config = {"from_attributes": True}


# --- API Schemas: Audit ---

class AuditLogOut(BaseModel):
    id: UUID
    actor_type: str
    action: str
    entity_type: str
    entity_id: UUID
    metadata: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- API Schemas: Settings ---

class ClinicSettingsOut(BaseModel):
    id: UUID
    warning_hours_before: int
    reminder_hours_before: int
    compliance_threshold_pct: int
    daily_cron_time: str
    dry_run_mode: bool
    calendly_webhook_ok: bool = False
    gmail_watch_expiration: datetime | None = None

    model_config = {"from_attributes": True}


class ClinicSettingsUpdate(BaseModel):
    warning_hours_before: int | None = None
    reminder_hours_before: int | None = None
    compliance_threshold_pct: int | None = None
    daily_cron_time: str | None = None
    dry_run_mode: bool | None = None


# --- API Schemas: Cron ---

class CronRunOut(BaseModel):
    id: UUID
    date: date
    created_at: datetime
    status: str | None = None


# --- API Schemas: Dashboard ---

class DashboardTodayOut(BaseModel):
    appointments: list[AppointmentOut]
    total: int
    pending_intake: int
    compliant: int
    warned: int
    auto_cancelled: int
    gmail_watch_healthy: bool
    gmail_watch_expiration: datetime | None
    last_cron_run: datetime | None


# --- API Schemas: WebhookEvent ---

class WebhookEventOut(BaseModel):
    id: UUID
    source: str
    dedupe_key: str
    event_type: str
    processed_at: datetime | None
    error_message: str | None

    model_config = {"from_attributes": True}


# --- Paginated ---

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# --- Doctor (public profile) ---

class DoctorOut(BaseModel):
    id: UUID
    full_name: str
    specialty: str | None
    bio: str | None
    price_per_visit: int | None
    email: str

    model_config = {"from_attributes": True}


# --- Staff Auth ---

class StaffLoginRequest(BaseModel):
    email: str
    password: str


class StaffTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    doctor_id: UUID | None = None


# --- Staff User Management ---

class StaffUserOut(BaseModel):
    id: UUID
    email: str
    role: str
    doctor_id: UUID | None
    full_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StaffUserCreateRequest(BaseModel):
    email: str
    password: str
    role: str  # "DOCTOR" or "ADMIN"
    doctor_id: UUID | None = None
    full_name: str


# --- Intake Summary (shared) ---

class IntakeSummaryOut(BaseModel):
    appointment_id: UUID
    chief_complaint: str
    current_medications: list[str]
    allergies: list[str]
    past_medical_history: str
    past_surgical_history: str
    family_history: str
    social_history: str
    additional_notes: str
    completeness_score: int
    missing_fields: list[str]
    ai_provider: str | None
    ai_model_version: str
    ai_processed_at: datetime


# --- Prescription ---

class PrescriptionCreateRequest(BaseModel):
    medication_name: str
    dosage: str | None = None
    frequency: str | None = None
    duration: str | None = None
    notes: str | None = None


class PrescriptionOut(BaseModel):
    id: UUID
    appointment_id: UUID
    doctor_id: UUID | None
    medication_name: str
    dosage: str | None
    frequency: str | None
    duration: str | None
    status: str
    notes: str | None
    storage_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- System Health ---

class SystemHealthOut(BaseModel):
    # Calendly health
    calendly_webhook_configured: bool
    calendly_24h_processed: int
    calendly_24h_failed: int
    # Gmail watch health
    gmail_watch_active: bool
    gmail_watch_expiration: datetime | None
    # DB health
    postgres_connected: bool
    # AI provider health (bucket: "up" / "down" / "not-configured")
    ai_openrouter: str
    ai_nim: str
    ai_groq: str
    ai_cerebras: str
    # AI usage distribution last 7d
    ai_provider_distribution: dict[str, int]
    # Sheets sync
    last_sheets_sync_at: datetime | None
    last_sheets_sync_ok: bool
    last_sheets_sync_error: str | None
    # Last cron runs
    recent_cron_runs: list["CronRunOut"]
    # Criterion 6: HTTP request metrics (p95 latency, counts)
    http_metrics: dict | None = None
    # Criterion 5: detailed Gmail watch health
    gmail_watch_health: dict | None = None


# --- Appointment list now optionally includes doctor info ---

class AppointmentDoctorOut(AppointmentOut):
    ref_code: str | None = None
    doctor: "DoctorOut | None" = None


# --- Doctor management (admin) ---

class DoctorCreateRequest(BaseModel):
    full_name: str
    specialty: str | None = None
    bio: str | None = None
    price_per_visit: int | None = None
    email: str
    calendly_event_type_uri: str | None = None


class DoctorUpdateRequest(BaseModel):
    full_name: str | None = None
    specialty: str | None = None
    bio: str | None = None
    price_per_visit: int | None = None
    email: str | None = None
    calendly_event_type_uri: str | None = None


# --- Staff user management (admin) ---

class StaffUserUpdateRequest(BaseModel):
    password: str | None = None
    role: str | None = None
    doctor_id: UUID | None = None
    full_name: str | None = None


# --- Patient auth ---

class PatientLoginRequest(BaseModel):
    email: str
    password: str


class PatientTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    patient_id: UUID
    full_name: str


class PatientMagicLinkRequest(BaseModel):
    email: str


class PatientMagicVerifyRequest(BaseModel):
    email: str
    code: str  # 6-8 char OTP


class MagicLinkSentResponse(BaseModel):
    sent: bool = True
    message: str = "If an account with that email exists, a one-time login code has been emailed."


# --- Prescription out with doctor info ---

class PrescriptionOutWithDoctor(PrescriptionOut):
    doctor: "DoctorOut | None" = None


# --- Patient appointment (frontend-compatible shape) ---
# Phase 2.1: adapter so the patient app doesn't have to do date math.

class PatientAppointmentOut(BaseModel):
    """Frontend-facing appointment shape consumed by AppointmentsHub +
    RecordsView. day_offset / time are computed server-side from
    Appointment.scheduled_at."""
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
    note: str | None = None
    ref_code: str | None = None
    has_record: bool = False
    record_id: UUID | None = None
    prescription_id: UUID | None = None
    created_at: datetime


# --- Checklists (item-based, frontend-compatible) ---

class ChecklistItemOut(BaseModel):
    id: UUID | None = None
    label: str
    done: bool = False
    value: str | None = None
    placeholder: str | None = None
    required: bool = False
    position: int = 0


class ChecklistOut(BaseModel):
    id: UUID
    title: str
    assigned_for: str
    due_date: datetime | None = None
    submitted: bool
    submitted_at: datetime | None = None
    items: list[ChecklistItemOut] = []


class ChecklistSubmitRequest(BaseModel):
    items: list[dict] = []   # [{"label": "...", "value": "..."}]


class ChecklistCreateRequest(BaseModel):
    title: str
    assigned_for: str | None = None
    due_date: datetime | None = None
    items: list[dict] = []   # [{"label": "...", "required": true, "placeholder": "..."}]


# --- Patient registration ---

class PatientRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str


# --- Patient appointment booking ---

class PatientBookAppointmentRequest(BaseModel):
    doctor_id: UUID
    scheduled_date: date
    time_slot: str    # "HH:MM"
    service_type: str = "consult"
    duration: str = "45 min"
    notes: str | None = None