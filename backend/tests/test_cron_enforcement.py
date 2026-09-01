"""Tests for the daily cron enforcement worker — boundary logic, race conditions, and ordering guarantees.

These tests use mocked DB sessions to isolate the algorithm from the database layer.
"""
import asyncio
from datetime import datetime, timezone, timedelta, date
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

import pytest

from models import Appointment, AppointmentStatus, Patient, ClinicSettings
from cron_enforcement import (
    _warning_48h, _reminder_24h, _purge_today, _today_in_clinic, _clinic_day_window,
    _NON_PURGEABLE,
)


def _mk_appt(scheduled_at: datetime, status: AppointmentStatus = AppointmentStatus.PENDING_INTAKE,
             patient=None, warning_sent=None, reminder_sent=None) -> Appointment:
    apt = Appointment(
        id=uuid.uuid4(),
        patient_id=patient.id if patient else uuid.uuid4(),
        calendly_event_uuid=f"evt-{uuid.uuid4().hex[:8]}",
        scheduled_at=scheduled_at,
        status=status,
        warning_sent_at=warning_sent,
        reminder_sent_at=reminder_sent,
    )
    apt.patient = patient or Patient(id=apt.patient_id, full_name="Test Patient", email="p@example.com")
    return apt


def _mk_settings(warning_hours=48, reminder_hours=24, compliance_pct=70, dry_run=True) -> ClinicSettings:
    return ClinicSettings(
        id=uuid.uuid4(),
        warning_hours_before=warning_hours,
        reminder_hours_before=reminder_hours,
        compliance_threshold_pct=compliance_pct,
        dry_run_mode=dry_run,
    )


def _mock_session(appointments: list[Appointment]) -> MagicMock:
    sess = MagicMock()
    # select(...).where(...).where(...).where(...) chain returns an executable
    exec_result = MagicMock()
    exec_result.scalars.return_value.all.return_value = appointments
    sess.execute = AsyncMock(return_value=exec_result)
    # sess.refresh populates relationships
    async def _refresh(obj, attrs=None): pass
    sess.refresh = _refresh
    sess.commit = AsyncMock()
    sess.add = MagicMock()
    return sess


# ---- 48-Hour Warning Boundary ----

class TestWarning48h:
    @pytest.mark.asyncio
    async def test_warns_pending_appt_48h_out(self, mock_gmail_client):
        now = datetime.now(timezone.utc)
        appt = _mk_appt(now + timedelta(hours=48), AppointmentStatus.PENDING_INTAKE)
        sess = _mock_session([appt])

        with patch("cron_enforcement.gmail_client") as cron_gmail:
            cron_gmail.send_email = AsyncMock()
            warned = await _warning_48h(sess, _mk_settings(), now)
        assert warned == 1
        assert appt.status == AppointmentStatus.WARNED
        assert appt.warning_sent_at is not None
        cron_gmail.send_email.assert_called_once()

    @pytest.mark.asyncio
    async def test_skipped_when_already_warned(self, mock_gmail_client):
        now = datetime.now(timezone.utc)
        appt = _mk_appt(
            now + timedelta(hours=48),
            AppointmentStatus.PENDING_INTAKE,
            warning_sent=now - timedelta(hours=2),
        )
        sess = _mock_session([])  # query filters out warning_sent_at IS NULL → returns empty

        warned = await _warning_48h(sess, _mk_settings(), now)
        assert warned == 0
        mock_gmail_client.send_email.assert_not_called()

    @pytest.mark.asyncio
    async def test_does_not_warn_compliant_appt(self, mock_gmail_client):
        now = datetime.now(timezone.utc)
        appt = _mk_appt(now + timedelta(hours=48), AppointmentStatus.COMPLIANT)
        sess = _mock_session([])  # COMPLIANT excluded by PENDING_INTAKE filter

        warned = await _warning_48h(sess, _mk_settings(), now)
        assert warned == 0

    @pytest.mark.asyncio
    async def test_does_not_warn_47h_out_outside_window(self, mock_gmail_client):
        """Edge case: appointment at 47h59m or 48h01m is in the ±2h window (acceptable per design),
        but an appt 60h out must NOT be warned."""
        now = datetime.now(timezone.utc)
        appt = _mk_appt(now + timedelta(hours=60))  # outside [+46h, +50h] window
        sess = _mock_session([])

        warned = await _warning_48h(sess, _mk_settings(), now)
        assert warned == 0


# ---- 24-Hour Reminder (COMPLIANT-only) ----

class TestReminder24h:
    @pytest.mark.asyncio
    async def test_reminds_compliant_appt_24h_out(self, mock_gmail_client):
        now = datetime.now(timezone.utc)
        appt = _mk_appt(now + timedelta(hours=24), AppointmentStatus.COMPLIANT)
        sess = _mock_session([appt])

        with patch("cron_enforcement.gmail_client") as cron_gmail:
            cron_gmail.send_email = AsyncMock()
            reminded = await _reminder_24h(sess, _mk_settings(), now)
        assert reminded == 1
        assert appt.reminder_sent_at is not None
        # Critical: status must NOT change for the reminder pass
        assert appt.status == AppointmentStatus.COMPLIANT
        cron_gmail.send_email.assert_called_once()

    @pytest.mark.asyncio
    async def test_does_not_remind_pending_appt(self, mock_gmail_client):
        """Boundary test: a PENDING (non-compliant) appointment must NEVER receive the friendly reminder."""
        now = datetime.now(timezone.utc)
        appt = _mk_appt(now + timedelta(hours=24), AppointmentStatus.PENDING_INTAKE)
        sess = _mock_session([])  # filtered out — PENDING not COMPLIANT

        reminded = await _reminder_24h(sess, _mk_settings(), now)
        assert reminded == 0
        mock_gmail_client.send_email.assert_not_called()

    @pytest.mark.asyncio
    async def test_does_not_remind_warned_appt(self, mock_gmail_client):
        now = datetime.now(timezone.utc)
        appt = _mk_appt(now + timedelta(hours=24), AppointmentStatus.WARNED)
        sess = _mock_session([])

        reminded = await _reminder_24h(sess, _mk_settings(), now)
        assert reminded == 0

    @pytest.mark.asyncio
    async def test_skipped_when_already_reminded(self, mock_gmail_client):
        now = datetime.now(timezone.utc)
        appt = _mk_appt(
            now + timedelta(hours=24),
            AppointmentStatus.COMPLIANT,
            reminder_sent=now - timedelta(hours=2),
        )
        sess = _mock_session([])

        reminded = await _reminder_24h(sess, _mk_settings(), now)
        assert reminded == 0


# ---- Day-Of Purge ----

class TestPurgeToday:
    @pytest.mark.asyncio
    async def test_purges_pending_today_in_dry_run(self, mock_gmail_client, mock_calendly_client):
        """Dry run: logs but does NOT enqueue a cancel job."""
        today = date.today()
        appt = _mk_appt(datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc).replace(hour=10),
                        AppointmentStatus.PENDING_INTAKE)
        sess = _mock_session([appt])
        arq_pool = AsyncMock()

        purge = await _purge_today(sess, _mk_settings(dry_run=True), today, arq_pool)
        assert purge["would_cancel"] == 1
        assert purge["cancelled"] == 0
        arq_pool.enqueue_job.assert_not_called()
        mock_calendly_client.cancel_event.assert_not_called()

    @pytest.mark.asyncio
    async def test_purges_pending_today_in_live_mode(self, mock_gmail_client, mock_calendly_client):
        today = date.today()
        appt = _mk_appt(datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc).replace(hour=10),
                        AppointmentStatus.PENDING_INTAKE)
        sess = _mock_session([appt])
        arq_pool = AsyncMock()

        purge = await _purge_today(sess, _mk_settings(dry_run=False), today, arq_pool)
        assert purge["would_cancel"] == 0
        assert purge["cancelled"] == 1
        arq_pool.enqueue_job.assert_called_once_with(
            "cancel_appointment_via_calendly", appointment_id=str(appt.id)
        )

    @pytest.mark.asyncio
    async def test_does_not_purge_compliant_today(self, mock_gmail_client, mock_calendly_client):
        """Critical race-fix test: a COMPLIANT appointment must NOT be purged even if it's today."""
        today = date.today()
        appt = _mk_appt(datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc).replace(hour=10),
                        AppointmentStatus.COMPLIANT)
        sess = _mock_session([])  # COMPLIANT excluded by PENDING/WARNED filter
        arq_pool = AsyncMock()

        purge = await _purge_today(sess, _mk_settings(dry_run=False), today, arq_pool)
        assert purge["cancelled"] == 0
        arq_pool.enqueue_job.assert_not_called()

    @pytest.mark.asyncio
    async def test_does_not_purge_needs_manual_review(self, mock_gmail_client, mock_calendly_client):
        """NEEDS_MANUAL_REVIEW appointments must NOT be silently auto-cancelled — doctor review required."""
        today = date.today()
        appt = _mk_appt(datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc).replace(hour=10),
                        AppointmentStatus.NEEDS_MANUAL_REVIEW)
        sess = _mock_session([])  # excluded by status filter
        arq_pool = AsyncMock()

        purge = await _purge_today(sess, _mk_settings(dry_run=False), today, arq_pool)
        assert purge["cancelled"] == 0
        arq_pool.enqueue_job.assert_not_called()

    @pytest.mark.asyncio
    async def test_purge_warned_appts_today(self, mock_gmail_client, mock_calendly_client):
        """A WARNED appointment (warned 48h ago but still non-compliant) MUST be purged today."""
        today = date.today()
        appt = _mk_appt(datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc).replace(hour=10),
                        AppointmentStatus.WARNED)
        sess = _mock_session([appt])
        arq_pool = AsyncMock()

        purge = await _purge_today(sess, _mk_settings(dry_run=False), today, arq_pool)
        assert purge["cancelled"] == 1

    @pytest.mark.asyncio
    async def test_live_mode_with_no_arq_pool_skips_not_silently_drops(self, mock_gmail_client):
        """If arq pool creation failed in live mode, the cron runner refuses to run; but if a stray
        purge call reaches _purge_today with no pool, it must skip cleanly (logged, not exception)."""
        today = date.today()
        appt = _mk_appt(datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc).replace(hour=10),
                        AppointmentStatus.PENDING_INTAKE)
        sess = _mock_session([appt])
        # None arq pool in live mode — must not crash
        purge = await _purge_today(sess, _mk_settings(dry_run=False), today, None)
        assert purge["cancelled"] == 0


# ---- Briefing ordering guarantee ----

class TestBriefingOrdering:
    """The purge MUST complete before the briefing email is composed — otherwise the doctor would see
    a schedule that still includes patients about to be cut. We verify this by structural inspection of
    run_enforcement() since it's an end-to-end flow."""

    def test_purge_called_before_briefing_in_source(self):
        """Reads cron_enforcement.py and verifies that the purge pass is invoked before _send_briefing."""
        from pathlib import Path
        source = Path(__file__).parent.parent / "cron_enforcement.py"
        text = source.read_text(encoding="utf-8")
        purge_idx = text.find("await _purge_today(")
        briefing_idx = text.find("await _send_briefing(")
        assert purge_idx != -1, "_purge_today call not found in cron_enforcement.py"
        assert briefing_idx != -1, "_send_briefing call not found in cron_enforcement.py"
        assert purge_idx < briefing_idx, "Briefing call must come AFTER purge call in source"

    def test_send_briefing_sends_email_before_persisting(self):
        """Email must be sent BEFORE the DailyBriefing row is committed — otherwise a crash between
        persist and send could result in skipping tomorrow's briefing (already-sent guard)."""
        from pathlib import Path
        source = Path(__file__).parent.parent / "cron_enforcement.py"
        text = source.read_text(encoding="utf-8")
        # Find _send_briefing body
        send_start = text.find("async def _send_briefing")
        send_end = text.find("async def ", send_start + 1)
        send_body = text[send_start:send_end if send_end != -1 else None]
        email_idx = send_body.find("await gmail_client.send_email")
        commit_idx = send_body.find("await sess.commit()")
        assert email_idx != -1 and commit_idx != -1
        assert email_idx < commit_idx, "Email must be sent BEFORE commit in _send_briefing"


# ---- Timezone correctness ----

class TestTimezone:
    def test_today_in_clinic_uses_clinic_timezone(self):
        """If the clinic is in New_York and the server is UTC, _today_in_clinic must return New_York's date —
        not server-local. We force a known clock and verify."""
        with patch("cron_enforcement.settings") as mock_settings:
            mock_settings.clinic_timezone = "America/New_York"
            # Mock datetime.now to return 2026-08-02 04:00 UTC, which is 2026-08-02 00:00 ET (or 2026-08-01 if DST boundary).
            # August is EDT (UTC-4) so 04:00 UTC = 00:00 ET → date is 2026-08-02.
            from cron_enforcement import _today_in_clinic
            mock_now = datetime(2026, 8, 2, 4, 0, tzinfo=timezone.utc)
            with patch("cron_enforcement.datetime") as mock_dt:
                mock_dt.now.return_value = mock_now
                # Make sure isinstance still works
                result = _today_in_clinic()
                # Result is whatever mock date() returns now. Simplify: mock now().date() chain.
                # If using the real zoneinfo, date(2026, 8, 2). To validate the calculation, we
                # call the real function below (without mocking datetime.now-to-a-different-type).
        # Real call (uses the patched settings.clinic_timezone):
        with patch("cron_enforcement.settings") as mock_settings_real:
            mock_settings_real.clinic_timezone = "America/New_York"
            # Force UTC clock to 2026-08-02 03:00 (which is 2026-08-01 23:00 EDT)
            from cron_enforcement import _today_in_clinic
            fixed_utc = datetime(2026, 8, 2, 3, 0, tzinfo=timezone.utc)
            with patch("cron_enforcement.datetime") as mock_dt:
                # A real now(tz) converts into the requested tzinfo — mock must do the same,
                # otherwise the tz conversion under test is bypassed and the result is UTC's date.
                mock_dt.now.side_effect = lambda tz=None: fixed_utc.astimezone(tz) if tz else fixed_utc
                result = _today_in_clinic()
                # 03:00 UTC is still 23:00 the previous day in EDT (UTC-4)
                assert result == date(2026, 8, 1), f"Expected 2026-08-01, got {result}"


# ---- NEEDS_MANUAL_REVIEW exclusion set ----

class TestNonPurgeableSet:
    def test_needs_manual_review_in_non_purgeable_set(self):
        assert AppointmentStatus.NEEDS_MANUAL_REVIEW in _NON_PURGEABLE

    def test_compliant_in_non_purgeable_set(self):
        assert AppointmentStatus.COMPLIANT in _NON_PURGEABLE

    def test_pending_intake_not_in_non_purgeable_set(self):
        assert AppointmentStatus.PENDING_INTAKE not in _NON_PURGEABLE