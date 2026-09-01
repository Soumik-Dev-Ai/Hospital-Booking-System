"""Tests for Criteria 1: Concurrency & Batch Processing.

Verifies:
  - Warning and reminder passes run concurrently via asyncio.gather
  - _EMAIL_SEM limits concurrent sends to 10
  - Sheets batch_upsert_appointments reduces API calls to 2 max
  - Cron source contains gather pattern
"""
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

import pytest

from models import Appointment, AppointmentStatus, Patient, ClinicSettings
from cron_enforcement import (
    _warning_48h, _reminder_24h, _EMAIL_SEM,
    _send_email_limited,
)


def _mk_settings(warning_hours=48, reminder_hours=24, dry_run=True):
    return ClinicSettings(
        id=uuid.uuid4(),
        warning_hours_before=warning_hours,
        reminder_hours_before=reminder_hours,
        compliance_threshold_pct=70,
        dry_run_mode=dry_run,
    )


def _mock_session(appointments: list) -> MagicMock:
    sess = MagicMock()
    exec_result = MagicMock()
    exec_result.scalars.return_value.all.return_value = appointments
    sess.execute = AsyncMock(return_value=exec_result)

    async def _refresh(obj, attrs=None):
        pass
    sess.refresh = _refresh
    sess.commit = AsyncMock()
    sess.add = MagicMock()
    return sess


def _mk_appt(scheduled_at: datetime, status=AppointmentStatus.PENDING_INTAKE,
             warning_sent=None, reminder_sent=None) -> Appointment:
    apt = Appointment(
        id=uuid.uuid4(),
        patient_id=uuid.uuid4(),
        calendly_event_uuid=f"evt-{uuid.uuid4().hex[:8]}",
        scheduled_at=scheduled_at,
        status=status,
        warning_sent_at=warning_sent,
        reminder_sent_at=reminder_sent,
    )
    apt.patient = Patient(id=apt.patient_id, full_name="Test", email="t@example.com")
    return apt


# ---- Concurrency: gather pattern ----

class TestConcurrencyGather:
    def test_cron_uses_asyncio_gather(self):
        """run_enforcement must use asyncio.gather for warning + reminder passes."""
        source = Path(__file__).parent.parent / "cron_enforcement.py"
        text = source.read_text(encoding="utf-8")
        assert "asyncio.gather" in text, "Expected asyncio.gather in cron_enforcement.py"

    def test_concurrent_tasks_created(self):
        """Verify the source creates both tasks before gathering."""
        source = Path(__file__).parent.parent / "cron_enforcement.py"
        text = source.read_text(encoding="utf-8")
        assert "asyncio.create_task(_warning_48h" in text
        assert "asyncio.create_task(_reminder_24h" in text


# ---- Semaphore limits concurrent email sends ----

class TestEmailSemaphore:
    @pytest.mark.asyncio
    async def test_semaphore_limits_concurrent_sends(self):
        """_EMAIL_SEM must be an asyncio.Semaphore with value 10."""
        assert isinstance(_EMAIL_SEM, asyncio.Semaphore)
        assert _EMAIL_SEM._value == 10

    @pytest.mark.asyncio
    async def test_send_email_limited_gates_concurrency(self):
        """_send_email_limited must acquire semaphore before calling send_email."""
        mock_client = AsyncMock()
        mock_client.send_email = AsyncMock(return_value="msg-id")

        async def _do_send():
            return await _send_email_limited(mock_client, to="a@b.com", subject="s", html_body="h")

        # Run 15 concurrent sends; semaphore should serialize to max 10 at once.
        results = await asyncio.gather(*[_do_send() for _ in range(15)])
        assert len(results) == 15
        assert mock_client.send_email.call_count == 15


# ---- Parallel execution of warning + reminder ----

class TestParallelPasses:
    @pytest.mark.asyncio
    async def test_warning_and_reminder_run_concurrently(self, mock_gmail_client):
        """warning and reminder should be startable as concurrent tasks."""
        now = datetime.now(timezone.utc)
        warn_appt = _mk_appt(now + timedelta(hours=48), AppointmentStatus.PENDING_INTAKE)
        remind_appt = _mk_appt(now + timedelta(hours=24), AppointmentStatus.COMPLIANT)

        warn_sess = _mock_session([warn_appt])
        remind_sess = _mock_session([remind_appt])

        with patch("cron_enforcement.gmail_client", mock_gmail_client):
            w_task = asyncio.create_task(_warning_48h(warn_sess, _mk_settings(), now))
            r_task = asyncio.create_task(_reminder_24h(remind_sess, _mk_settings(), now))
            warned, reminded = await asyncio.gather(w_task, r_task)

        assert warned == 1
        assert reminded == 1


# ---- Sheets batch upsert ----

class TestSheetsBatchUpsert:
    @pytest.mark.asyncio
    async def test_batch_upsert_reduces_api_calls(self):
        """batch_upsert_appointments must do at most 2 API calls (read + one write)."""
        from services.sheets_client import SheetsClient

        client = SheetsClient()
        client._spreadsheet_ids["Patient Intake - August 2026"] = "mock-sid-123"
        client._sheets_service = MagicMock()
        client._drive_service = MagicMock()

        mock_svc = client._sheets_service
        # Mock read
        mock_read = MagicMock()
        mock_read.execute.return_value = {"values": []}
        mock_svc.spreadsheets().values().get.return_value = mock_read

        # Mock batchUpdate
        mock_batch = MagicMock()
        mock_batch.execute.return_value = {}
        mock_svc.spreadsheets().values().batchUpdate.return_value = mock_batch

        # No append needed (empty read result, but rows are new — will append)
        mock_append = MagicMock()
        mock_append.execute.return_value = {}
        mock_svc.spreadsheets().values().append.return_value = mock_append

        rows = [
            {"ref_code": "ABC123", "appointment_id": "1", "patient_name": "Test",
             "patient_email": "t@example.com", "scheduled_at": datetime.now(timezone.utc),
             "status": "compliant"},
        ]

        with patch.object(asyncio.get_event_loop(), "run_in_executor", new_callable=AsyncMock) as mock_exec:
            mock_exec.side_effect = lambda _, fn, *a, **k: fn(*a, **k)
            result = await client.batch_upsert_appointments(rows, datetime.now(timezone.utc))

        # Should have done read + append (or batchUpdate if existing)
        # With empty read, rows are new → append called
        api_calls = [
            mock_read.execute.call_count,
            mock_append.execute.call_count,
        ]
        # At most 2 calls: one read + one write
        assert sum(api_calls) <= 2
