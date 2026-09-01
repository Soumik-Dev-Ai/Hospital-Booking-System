import uuid
import secrets
import string
from datetime import datetime, date, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Integer, DateTime, Date, ForeignKey, Text, Enum, Boolean, JSON,
    UniqueConstraint, Index, Float,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


def generate_ref_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StaffRole(str, PyEnum):
    DOCTOR = "DOCTOR"
    ADMIN = "ADMIN"


class ActorType(str, PyEnum):
    SYSTEM = "SYSTEM"
    DOCTOR = "DOCTOR"
    PATIENT = "PATIENT"
    ADMIN = "ADMIN"


class PrescriptionStatus(str, PyEnum):
    ACTIVE = "ACTIVE"
    DISCONTINUED = "DISCONTINUED"
    COMPLETED = "COMPLETED"


class MagicTokenState(str, PyEnum):
    PENDING = "PENDING"
    USED = "USED"
    EXPIRED = "EXPIRED"


class AppointmentStatus(str, PyEnum):
    PENDING_INTAKE = "PENDING_INTAKE"
    COMPLIANT = "COMPLIANT"
    WARNED = "WARNED"
    AUTO_CANCELLED = "AUTO_CANCELLED"
    MANUALLY_OVERRIDDEN = "MANUALLY_OVERRIDDEN"
    CANCELLED_BY_PATIENT = "CANCELLED_BY_PATIENT"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"
    COMPLETED = "COMPLETED"


class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    password_hash = Column(String(255), nullable=True)  # nullable until first portal login / password set
    medical_history = Column(Text, nullable=True)  # running log of past prescriptions + notes (appended on each completion)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    appointments = relationship("Appointment", back_populates="patient", lazy="selectin")
    magic_tokens = relationship("PatientMagicToken", back_populates="patient", lazy="selectin")
    checklists = relationship("Checklist", back_populates="patient", lazy="selectin")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    ref_code = Column(String(8), unique=True, nullable=False, index=True, default=generate_ref_code)
    calendly_event_uuid = Column(String(255), unique=True, nullable=False, index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(Enum(AppointmentStatus), nullable=False, default=AppointmentStatus.PENDING_INTAKE)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True, index=True)
    warning_sent_at = Column(DateTime(timezone=True), nullable=True)
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    auto_cancelled_at = Column(DateTime(timezone=True), nullable=True)
    overridden_by_doctor_at = Column(DateTime(timezone=True), nullable=True)
    override_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    patient = relationship("Patient", back_populates="appointments", lazy="selectin")
    doctor = relationship("Doctor", back_populates="appointments", lazy="selectin")
    intake_submission = relationship("IntakeSubmission", back_populates="appointment", uselist=False, lazy="selectin")
    prescriptions = relationship("Prescription", back_populates="appointment", lazy="selectin")


class IntakeSubmission(Base):
    __tablename__ = "intake_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False)
    raw_reply_text = Column(Text, nullable=False)            # PHI — encrypted at rest (spec A.6)
    structured_summary = Column(Text, nullable=False)        # PHI — encrypted at rest (spec A.6)
    completeness_score = Column(Integer, nullable=False)
    missing_fields = Column(JSON, nullable=False)
    summary_doc_url = Column(String(500), nullable=True)
    ai_processed_at = Column(DateTime(timezone=True), nullable=False)
    ai_provider = Column(String(50), nullable=True)  # OpenRouter | NVIDIA NIM | Gemini (legacy)
    ai_model_version = Column(String(100), nullable=False)

    appointment = relationship("Appointment", back_populates="intake_submission", lazy="selectin")


class WebhookSource(PyEnum):
    CALENDLY = "calendly"
    GMAIL = "gmail"


class WebhookEventType(PyEnum):
    INVITEE_CREATED = "invitee.created"
    EVENT_CANCELLED = "event.cancelled"
    EMAIL_RECEIVED = "email.received"
    EMAIL_REPLY = "email.reply"


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(50), nullable=False)
    dedupe_key = Column(String(255), unique=True, nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    raw_payload = Column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_webhook_events_source_processed", "source", "processed_at"),
    )


class GmailWatchState(Base):
    __tablename__ = "gmail_watch_state"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    history_id = Column(String(100), nullable=False)
    watch_expiration = Column(DateTime(timezone=True), nullable=False)
    renewed_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_type = Column(Enum(ActorType), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    details = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("idx_audit_entity", "entity_type", "entity_id"),
    )


class DailyBriefing(Base):
    __tablename__ = "daily_briefings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, unique=True, nullable=False, index=True)
    content = Column(JSON, nullable=False)
    sheet_url = Column(String(500), nullable=True)  # link to the daily-synced Sheet (A.3.5)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)


class ClinicSettings(Base):
    __tablename__ = "clinic_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    warning_hours_before = Column(Integer, nullable=False, default=48)
    reminder_hours_before = Column(Integer, nullable=False, default=24)
    compliance_threshold_pct = Column(Integer, nullable=False, default=70)
    daily_cron_time = Column(String(5), nullable=False, default="08:00")
    dry_run_mode = Column(Boolean, nullable=False, default=True)


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    specialty = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    price_per_visit = Column(Integer, nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    calendly_event_type_uri = Column(String(500), nullable=True, index=True)  # Calendly event-type URI -> this doctor
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    appointments = relationship("Appointment", back_populates="doctor", lazy="selectin")


class StaffUser(Base):
    __tablename__ = "staff_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(StaffRole), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True, index=True)
    full_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    doctor = relationship("Doctor", lazy="selectin")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True, index=True)
    medication_name = Column(String(255), nullable=True)            # structured Rx (legacy doctor-portal); nullable so /complete flow can use only prescription_text
    dosage = Column(String(255), nullable=True)
    frequency = Column(String(255), nullable=True)
    duration = Column(String(255), nullable=True)
    prescription_text = Column(Text, nullable=True)                 # free-text prescription narrative (spec: completion flow)
    checklist_tests = Column(JSON, nullable=True)                  # list of test/lab names to perform (spec: completion flow)
    status = Column(Enum(PrescriptionStatus), nullable=False, default=PrescriptionStatus.ACTIVE)
    notes = Column(Text, nullable=True)
    storage_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    appointment = relationship("Appointment", back_populates="prescriptions", lazy="selectin")
    doctor = relationship("Doctor", lazy="selectin")


class PatientMagicToken(Base):
    """One-time passwordless login tokens for patients who forgot their password.
    A token is created on POST /api/patient/magic-link and consumed on /verify.
    Spec A.6 addendum: situation-based fallback to the primary email/password login."""
    __tablename__ = "patient_magic_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), unique=True, nullable=False, index=True)  # store SHA256 of the OTP, never the OTP itself
    state = Column(Enum(MagicTokenState), nullable=False, default=MagicTokenState.PENDING)
    requested_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    patient = relationship("Patient", back_populates="magic_tokens", lazy="selectin")


# -----------------------------------------------------------------------------
# Patient-portal intake checklists (item-based, frontend-compatible)
#
# A Checklist belongs to one Patient and (optionally) ties back to an
# Appointment via the doctor-assigned checklist flow. Each row tracks the
# patient-facing title, the department/doctor it was assigned for, and a due
# date so RecordsView can order and badge items.
# -----------------------------------------------------------------------------

class Checklist(Base):
    __tablename__ = "patient_checklists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    assigned_for = Column(String(255), nullable=False)          # doctor/dept name
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    submitted = Column(Boolean, nullable=False, default=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    patient = relationship("Patient", back_populates="checklists", lazy="selectin")
    appointment = relationship("Appointment", lazy="selectin")
    items = relationship("ChecklistItem", back_populates="checklist", cascade="all, delete-orphan", lazy="selectin", order_by="ChecklistItem.position")


class ChecklistItem(Base):
    __tablename__ = "patient_checklist_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    checklist_id = Column(UUID(as_uuid=True), ForeignKey("patient_checklists.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)
    label = Column(String(500), nullable=False)
    required = Column(Boolean, nullable=False, default=False)
    done = Column(Boolean, nullable=False, default=False)
    value = Column(Text, nullable=True)
    placeholder = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    checklist = relationship("Checklist", back_populates="items")


