"""Tests for background agents."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from agents.tasks import (
    send_patient_reminders,
    send_doctor_briefings,
    periodic_checkin,
    WorkerSettings,
)


class TestAgents:
    @pytest.mark.asyncio
    async def test_send_patient_reminders(self):
        """Test that the reminder task runs without errors."""
        mock_ctx = {"redis": AsyncMock()}

        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        async def _mock_get_db():
            yield mock_db

        with patch("database.get_db", _mock_get_db):
            result = await send_patient_reminders(mock_ctx)
        assert result == 0

    @pytest.mark.asyncio
    async def test_send_doctor_briefings(self):
        """Test that the briefing task runs without errors."""
        mock_ctx = {"redis": AsyncMock()}
        with patch("database.get_db") as mock_get_db, \
             patch("agents.tasks.sheets_client") as mock_sheets:
            mock_sheets.configured = False
            mock_db = MagicMock()
            mock_db.execute = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_db.execute.return_value = mock_result
            mock_get_db.return_value.__aiter__ = lambda self: iter([mock_db])
            result = await send_doctor_briefings(mock_ctx)
        assert result == 0

    @pytest.mark.asyncio
    async def test_periodic_checkin(self):
        """Test that the heartbeat task runs without errors."""
        mock_ctx = {"redis": AsyncMock()}
        result = await periodic_checkin(mock_ctx)
        assert result is None

    def test_worker_settings(self):
        """Test that worker settings are properly configured."""
        assert hasattr(WorkerSettings, "functions")
        assert len(WorkerSettings.functions) == 3
        assert hasattr(WorkerSettings, "cron_jobs")
        assert len(WorkerSettings.cron_jobs) == 2
        assert WorkerSettings.max_tries == 3
        assert WorkerSettings.timeout == 300
