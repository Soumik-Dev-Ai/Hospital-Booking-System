"""Tests for database models."""

import pytest
from sqlalchemy import select
from uuid import uuid4

from database.models import (
    User,
    Doctor,
    Appointment,
    ServiceRecord,
    Checklist,
    TimeSlot,
    QuarantinedUser,
    UserRole,
    AppointmentStatus,
    ServiceType,
    ServiceRecordStatus,
)


class TestUserModel:
    def test_create_user(self, db_session):
        user = User(
            email="test@example.com",
            hashed_password="hashed",
            role=UserRole.ROLE_PATIENT,
            full_name="Test User",
        )
        db_session.add(user)

    @pytest.mark.asyncio
    async def test_user_email_unique(self, db_session):
        user1 = User(
            email="unique@example.com",
            hashed_password="hashed",
            role=UserRole.ROLE_PATIENT,
            full_name="Unique User",
        )
        db_session.add(user1)
        await db_session.flush()

        user2 = User(
            email="unique@example.com",  # Same email
            hashed_password="hashed",
            role=UserRole.ROLE_PATIENT,
            full_name="Another User",
        )
        db_session.add(user2)

        with pytest.raises(Exception):
            await db_session.flush()


class TestAppointmentModel:
    @pytest.mark.asyncio
    async def test_create_appointment(self, db_session):
        from datetime import datetime, timezone
        patient = User(
            email="patient@example.com",
            hashed_password="hashed",
            role=UserRole.ROLE_PATIENT,
            full_name="Patient",
        )
        db_session.add(patient)
        await db_session.flush()

        doctor = Doctor(user_id=patient.id, specialization="Cardiology")
        db_session.add(doctor)
        await db_session.flush()

        appointment = Appointment(
            patient_id=patient.id,
            doctor_id=doctor.id,
            scheduled_at=datetime(2026, 8, 15, 10, 0, tzinfo=timezone.utc),
        )
        db_session.add(appointment)
        await db_session.flush()

        assert appointment.id is not None
        assert appointment.status == AppointmentStatus.SCHEDULED


class TestServiceRecordModel:
    @pytest.mark.asyncio
    async def test_create_service_record(self, db_session):
        from datetime import date
        patient = User(
            email="patient@example.com",
            hashed_password="hashed",
            role=UserRole.ROLE_PATIENT,
            full_name="Patient",
        )
        db_session.add(patient)
        await db_session.flush()

        record = ServiceRecord(
            patient_id=patient.id,
            service_type=ServiceType.MRI,
            booking_date=date(2026, 8, 20),
            status=ServiceRecordStatus.BOOKED,
        )
        db_session.add(record)
        await db_session.flush()

        assert record.id is not None
        assert record.status == ServiceRecordStatus.BOOKED


class TestChecklistModel:
    @pytest.mark.asyncio
    async def test_checklist_booleans(self, db_session):
        patient = User(
            email="patient@example.com",
            hashed_password="hashed",
            role=UserRole.ROLE_PATIENT,
            full_name="Patient",
        )
        db_session.add(patient)
        await db_session.flush()

        checklist = Checklist(
            appointment_id=uuid4(),
            patient_id=patient.id,
            is_assigned_by_doctor=True,
            is_completed_by_patient=False,
        )
        db_session.add(checklist)
        await db_session.flush()

        assert checklist.is_assigned_by_doctor is True
        assert checklist.is_completed_by_patient is False
