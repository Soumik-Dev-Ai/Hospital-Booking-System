"""SQLAlchemy ORM models for Alder & Sage clinic."""

import uuid
from datetime import datetime, date, time
from enum import Enum as PyEnum
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Time,
    Enum, Float, ForeignKey, Index, Integer, String, Text,
    Table, UniqueConstraint, func,
)
from sqlalchemy.types import DECIMAL as SADecimal
from sqlalchemy.dialects.postgresql import UUID as PGSUUID
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, PyEnum):
    ROLE_PATIENT = "ROLE_PATIENT"
    ROLE_DOCTOR = "ROLE_DOCTOR"
    ROLE_ADMIN = "ROLE_ADMIN"


class AppointmentStatus(str, PyEnum):
    SCHEDULED = "Scheduled"
    IN_PROGRESS = "In-Progress"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"
    NO_SHOW = "No-Show"


class ServiceType(str, PyEnum):
    MRI = "MRI"
    XRAY = "X-ray"
    BLOOD_WORK = "Blood Work"
    ECG = "ECG"
    ULTRASOUND = "Ultrasound"
    OTHER = "Other"


class ServiceRecordStatus(str, PyEnum):
    BOOKED = "Booked"
    PENDING_RESULTS = "Pending Results"
    COMPLETED = "Completed"


# ---------------------------------------------------------------------------
# Base mixins
# ---------------------------------------------------------------------------

class TimestampedMixin:
    """Auto-populate created_at / updated_at."""
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        onupdate=func.now(),
    )


class UUIDMixin:
    """Use UUID v4 as primary key."""
    id = Column(
        PGSUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(UUIDMixin, TimestampedMixin, Base):
    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.ROLE_PATIENT)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    is_quarantined = Column(Boolean, default=False)

    # Relationships
    appointments = relationship("Appointment", back_populates="patient")
    doctors = relationship("Doctor", back_populates="user")
    checklists = relationship("Checklist", back_populates="patient")
    service_records = relationship("ServiceRecord", back_populates="patient")
    quarantined_record = relationship(
        "QuarantinedUser",
        back_populates="user",
        uselist=False,
    )

    __table_args__ = (
        Index("ix_users_email", "email"),
    )


class Doctor(UUIDMixin, TimestampedMixin, Base):
    __tablename__ = "doctors"

    user_id = Column(PGSUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    specialization = Column(String(255), nullable=True)
    license_number = Column(String(100), unique=True, nullable=True)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="doctors")
    appointments = relationship("Appointment", back_populates="doctor")
    time_slots = relationship("TimeSlot", back_populates="doctor")
    assigned_checklists = relationship(
        "Checklist",
        back_populates="doctor",
        foreign_keys="Checklist.doctor_id",
    )
    clinical_services = relationship(
        "ClinicalService",
        secondary="clinical_service_doctors",
        back_populates="doctors",
    )

    __table_args__ = (
        Index("ix_doctors_user_id", "user_id"),
    )


class Appointment(UUIDMixin, TimestampedMixin, Base):
    __tablename__ = "appointments"

    patient_id = Column(
        PGSUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    doctor_id = Column(
        PGSUUID(as_uuid=True),
        ForeignKey("doctors.id"),
        nullable=False,
    )
    ref_code = Column(String(8), unique=True, nullable=True, index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(
        Enum(AppointmentStatus),
        nullable=False,
        default=AppointmentStatus.SCHEDULED,
    )
    notes = Column(Text, nullable=True)
    intake_form_completed = Column(Boolean, default=False)

    patient = relationship("User", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    checklists = relationship("Checklist", back_populates="appointment")
    service_records = relationship("ServiceRecord", back_populates="appointment")

    __table_args__ = (
        Index("ix_appointments_patient_id", "patient_id"),
        Index("ix_appointments_doctor_id", "doctor_id"),
        Index("ix_appointments_scheduled_at_status", "scheduled_at", "status"),
    )


class ServiceRecord(UUIDMixin, TimestampedMixin, Base):
    """Tracks one-off clinical tests: MRI, X-ray, etc."""

    __tablename__ = "service_records"

    patient_id = Column(
        PGSUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    appointment_id = Column(
        PGSUUID(as_uuid=True),
        ForeignKey("appointments.id"),
        nullable=True,
    )
    service_type = Column(Enum(ServiceType), nullable=False)
    booking_date = Column(Date, nullable=False)
    time_slot = Column(String(50), nullable=True)
    status = Column(
        Enum(ServiceRecordStatus),
        nullable=False,
        default=ServiceRecordStatus.BOOKED,
    )
    result_document_url = Column(String(2048), nullable=True)
    notes = Column(Text, nullable=True)

    patient = relationship("User", back_populates="service_records")
    appointment = relationship("Appointment", back_populates="service_records")

    __table_args__ = (
        Index("ix_service_records_patient_id", "patient_id"),
        Index("ix_service_records_status", "status"),
    )


class Checklist(UUIDMixin, TimestampedMixin, Base):
    """Patient intake / compliance forms with explicit doctor-patient tracking."""

    __tablename__ = "checklists"

    appointment_id = Column(
        PGSUUID(as_uuid=True),
        ForeignKey("appointments.id"),
        nullable=False,
    )
    patient_id = Column(
        PGSUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    doctor_id = Column(
        PGSUUID(as_uuid=True),
        ForeignKey("doctors.id"),
        nullable=True,
    )
    is_assigned_by_doctor = Column(Boolean, default=False)
    is_completed_by_patient = Column(Boolean, default=False)
    form_data = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    # Frontend-facing metadata (title + due date drive the RecordsView list).
    title = Column(String(255), nullable=True)
    assigned_for = Column(String(255), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)

    appointment = relationship("Appointment", back_populates="checklists")
    patient = relationship("User", back_populates="checklists")
    doctor = relationship(
        "Doctor",
        back_populates="assigned_checklists",
        foreign_keys=[doctor_id],
    )
    items = relationship(
        "ChecklistItem",
        back_populates="checklist",
        cascade="all, delete-orphan",
        order_by="ChecklistItem.position",
    )

    __table_args__ = (
        Index("ix_checklists_appointment_id", "appointment_id"),
        Index("ix_checklists_patient_id", "patient_id"),
        Index(
            "ix_checklists_assignment_completion",
            "is_assigned_by_doctor", "is_completed_by_patient",
        ),
        Index("ix_checklists_due_date", "due_date"),
        UniqueConstraint("appointment_id", name="uq_checklists_appointment"),
    )


class ChecklistItem(UUIDMixin, TimestampedMixin, Base):
    """A single labelled line-item in a Checklist with an answer field."""

    __tablename__ = "checklist_items"

    checklist_id = Column(
        PGSUUID(as_uuid=True),
        ForeignKey("checklists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False, default=0)
    label = Column(String(500), nullable=False)
    required = Column(Boolean, default=False, nullable=False)
    done = Column(Boolean, default=False, nullable=False)
    value = Column(Text, nullable=True)
    placeholder = Column(String(255), nullable=True)

    checklist = relationship("Checklist", back_populates="items")


class ClinicalService(UUIDMixin, TimestampedMixin, Base):
    """Catalog of bookable clinical services (MRI, blood panel, etc.).

    Distinct from `ServiceRecord` (which tracks one booked instance for one
    patient). `ClinicalService` is the public catalog definition that the
    BookingFlow renders.
    """

    __tablename__ = "clinical_services"

    name = Column(String(255), nullable=False, unique=True, index=True)
    department = Column(String(255), nullable=False)
    duration = Column(String(64), nullable=False)        # "45 min"
    fee = Column(Integer, nullable=False)                # whole-dollar fee
    prep_instructions = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    doctors = relationship(
        "Doctor",
        secondary="clinical_service_doctors",
        back_populates="clinical_services",
    )

    __table_args__ = (
        Index("ix_clinical_services_active", "is_active"),
    )


# Association table: a clinical service may be offered by many doctors and
# a doctor may offer many clinical services. (System A's clinical catalog.)
clinical_service_doctors = Table(
    "clinical_service_doctors",
    Base.metadata,
    Column(
        "clinical_service_id",
        PGSUUID(as_uuid=True),
        ForeignKey("clinical_services.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "doctor_id",
        PGSUUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Index("ix_clinical_service_doctors_service", "clinical_service_id"),
    Index("ix_clinical_service_doctors_doctor", "doctor_id"),
)


class TimeSlot(UUIDMixin, TimestampedMixin, Base):
    """Available doctor time slots."""

    __tablename__ = "time_slots"

    doctor_id = Column(
        PGSUUID(as_uuid=True),
        ForeignKey("doctors.id"),
        nullable=False,
    )
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_booked = Column(Boolean, default=False)

    doctor = relationship("Doctor", back_populates="time_slots")

    __table_args__ = (
        Index("ix_time_slots_doctor_date", "doctor_id", "date"),
        UniqueConstraint(
            "doctor_id", "date", "start_time",
            name="uq_timeslot_doctor_date_time",
        ),
    )


class QuarantinedUser(UUIDMixin, TimestampedMixin, Base):
    """Users flagged by the prompt injection firewall."""

    __tablename__ = "quarantined_users"

    user_id = Column(
        PGSUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        unique=True,
    )
    reason = Column(Text, nullable=False)
    flagged_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    auto_unflag_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="quarantined_record")

    __table_args__ = (
        Index("ix_quarantined_users_user_id", "user_id"),
    )


class AuditLog(Base):
    """Trace every webhook / sensitive operation for observability."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trace_id = Column(String(36), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(PGSUUID(as_uuid=True), nullable=True)
    user_id = Column(PGSUUID(as_uuid=True), nullable=True)
    extra_metadata = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    __table_args__ = (
        Index("ix_audit_logs_trace_id", "trace_id"),
        Index("ix_audit_logs_created_at", "created_at"),
    )
