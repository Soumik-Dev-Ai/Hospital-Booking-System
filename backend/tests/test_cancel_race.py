"""Tests for the conformance race fix in pipeline/enforcement_actions.py.

Critical scenario: cron enqueues a Calendly cancel job for a PENDING appointment; between the
enqueue decision and the queue task running, the patient replies and the AI parser marks the
appointment COMPLIANT. The cancel task MUST re-check the status and skip — never cancel a
compliant patient.
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models import Appointment, AppointmentStatus


class TestCancelRaceFix:
    @pytest.mark.asyncio
    async def test_skip_cancel_when_status_changed_to_compliant(self, mock_calendly_client, mock_gmail_client):
        from pipeline.enforcement_actions import cancel_appointment_via_calendly

        appointment = Appointment(
            id=uuid.uuid4(),
            patient_id=uuid.uuid4(),
            calendly_event_uuid="evt-1",
            scheduled_at=datetime.now(timezone.utc),
            status=AppointmentStatus.COMPLIANT,  # already compliant by the time the queue task runs
        )
        appointment.patient = MagicMock()
        appointment.patient.full_name = "Test"
        appointment.patient.email = "p@example.com"

        sess = MagicMock()
        exec_result = MagicMock()
        exec_result.scalar_one_or_none.return_value = appointment
        sess.execute = AsyncMock(return_value=exec_result)
        sess.refresh = AsyncMock()
        sess.commit = AsyncMock()
        sess.close = AsyncMock()

        async_session_factory_mock = AsyncMock(return_value=sess)
        with patch("pipeline.enforcement_actions.async_session_factory", async_session_factory_mock):
            ctx = {"job_try": 1}
            await cancel_appointment_via_calendly(ctx, str(appointment.id))
            # Calendly DELETE MUST NOT happen — patient is compliant
            mock_calendly_client.cancel_event.assert_not_called()
            assert appointment.status == AppointmentStatus.COMPLIANT  # unchanged

    @pytest.mark.asyncio
    async def test_skip_cancel_when_status_is_needs_manual_review(self, mock_calendly_client, mock_gmail_client):
        from pipeline.enforcement_actions import cancel_appointment_via_calendly

        appointment = Appointment(
            id=uuid.uuid4(),
            patient_id=uuid.uuid4(),
            calendly_event_uuid="evt-1",
            scheduled_at=datetime.now(timezone.utc),
            status=AppointmentStatus.NEEDS_MANUAL_REVIEW,
        )
        appointment.patient = MagicMock()

        sess = MagicMock()
        exec_result = MagicMock()
        exec_result.scalar_one_or_none.return_value = appointment
        sess.execute = AsyncMock(return_value=exec_result)
        sess.refresh = AsyncMock()
        sess.commit = AsyncMock()
        sess.close = AsyncMock()

        async_session_factory_mock = AsyncMock(return_value=sess)
        with patch("pipeline.enforcement_actions.async_session_factory", async_session_factory_mock):
            ctx = {"job_try": 1}
            await cancel_appointment_via_calendly(ctx, str(appointment.id))
            mock_calendly_client.cancel_event.assert_not_called()

    @pytest.mark.asyncio
    async def test_skip_cancel_when_already_auto_cancelled(self, mock_calendly_client, mock_gmail_client):
        """Idempotency: a retried cancel job that runs after a previous successful cancel must not double-call."""
        from pipeline.enforcement_actions import cancel_appointment_via_calendly

        appointment = Appointment(
            id=uuid.uuid4(),
            patient_id=uuid.uuid4(),
            calendly_event_uuid="evt-1",
            scheduled_at=datetime.now(timezone.utc),
            status=AppointmentStatus.AUTO_CANCELLED,
        )
        appointment.patient = MagicMock()
        sess = MagicMock()
        exec_result = MagicMock()
        exec_result.scalar_one_or_none.return_value = appointment
        sess.execute = AsyncMock(return_value=exec_result)
        sess.refresh = AsyncMock()
        sess.commit = AsyncMock()
        sess.close = AsyncMock()

        async_session_factory_mock = AsyncMock(return_value=sess)
        with patch("pipeline.enforcement_actions.async_session_factory", async_session_factory_mock):
            ctx = {"job_try": 2}
            await cancel_appointment_via_calendly(ctx, str(appointment.id))
            mock_calendly_client.cancel_event.assert_not_called()


class TestDryRunSourceInQueue:
    """Critical: queue task must read dry_run from ClinicSettings (DB), not env — so the API
    toggle is the single source of truth."""

    @pytest.mark.asyncio
    async def test_dry_run_via_clinic_settings_skips_calent(self, mock_calendly_client, mock_gmail_client):
        from pipeline.enforcement_actions import cancel_appointment_via_calendly
        from models import ClinicSettings

        appointment = Appointment(
            id=uuid.uuid4(),
            patient_id=uuid.uuid4(),
            calendly_event_uuid="evt-1",
            scheduled_at=datetime.now(timezone.utc),
            status=AppointmentStatus.PENDING_INTAKE,  # still pending — race gate passes
        )
        appointment.patient = MagicMock()
        appointment.patient.full_name = "Test"
        appointment.patient.email = "p@example.com"

        # ClinicSettings row says dry_run = True
        cs = ClinicSettings(id=uuid.uuid4(), dry_run_mode=True)

        sess = MagicMock()
        # First execute returns appointment; second returns cs
        appt_result = MagicMock()
        appt_result.scalar_one_or_none.return_value = appointment
        cs_result = MagicMock()
        cs_result.scalar_one_or_none.return_value = cs
        sess.execute = AsyncMock(side_effect=[appt_result, cs_result])
        sess.refresh = AsyncMock()
        sess.commit = AsyncMock()
        sess.close = AsyncMock()

        async_session_factory_mock = AsyncMock(return_value=sess)
        with patch("pipeline.enforcement_actions.async_session_factory", async_session_factory_mock):
            # env says dry_run = False, but DB says True — DB should win
            with patch("pipeline.enforcement_actions.settings") as mock_env:
                mock_env.dry_run_mode = False
                mock_env.doctor_email = "d@clinic.com"
                mock_env.app_base_url = "https://example.com"
                mock_env.clinic_name = "Test Clinic"
                ctx = {"job_try": 1}
                await cancel_appointment_via_calendly(ctx, str(appointment.id))
                mock_calendly_client.cancel_event.assert_not_called()
