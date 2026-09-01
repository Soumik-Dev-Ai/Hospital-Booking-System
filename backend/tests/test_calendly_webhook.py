"""Tests for the Calendly webhook handler — payload validation, dedupe, booking/cancellation flow.

Uses respx to mock outbound Calendly calls and a mocked AsyncSession to isolate the handler from DB.
"""
import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from models import Appointment, AppointmentStatus, Patient, WebhookEvent


class TestCalendlyWebhookDedupe:
    """calendly_event_uuid must dedupe retries. The webhook handler's SELECT-then-INSERT pattern
    is backed by a UNIQUE constraint at the DB layer (a race would IntegrityError, caught separately)."""

    @pytest.mark.asyncio
    async def test_duplicate_event_uuid_is_ignored(self, mock_gmail_client, mock_arq_pool):
        from webhooks.calendly import calendly_webhook

        event_uuid = "evt-abc-123"
        request = MagicMock()
        request.headers = {
            "Calendly-Webhook-Signature": "v1=fake",
            "Calendly-Webhook-Timestamp": "1700000000",
        }
        request.body = AsyncMock(return_value=b'{"event":"invitee.created","payload":{}}')

        sess = MagicMock()
        # Simulate existing WebhookEvent found by dedupe_key
        exec_result = MagicMock()
        exec_result.scalar_one_or_none.return_value = MagicMock()  # exists → duplicate
        sess.execute = AsyncMock(return_value=exec_result)
        sess.commit = AsyncMock()

        # Patch the signature check to bypass for this test
        with patch("webhooks.calendly.verify_calendly_webhook", return_value=True), \
             patch("webhooks.calendly.settings") as mock_settings:
            mock_settings.calendly_webhook_signing_key = "k"
            response = await calendly_webhook(request, sess)
            assert response == {"status": "duplicate_ignored"}
            sess.commit.assert_not_called()


class TestPayloadValidation:
    """Empty email or missing start_time must 400 instead of silently persisting bad data."""

    @pytest.mark.asyncio
    async def test_booking_without_email_raises_400(self, mock_gmail_client, mock_arq_pool):
        from webhooks.calendly import _handle_booking

        sess = MagicMock()
        with pytest.raises(HTTPException) as exc_info:
            await _handle_booking(sess, {"invitee": {"email": "", "name": "x"}}, "cid")
        assert exc_info.value.status_code == 400
        assert "email" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_booking_without_start_time_raises_400(self, mock_gmail_client, mock_arq_pool):
        from webhooks.calendly import _handle_booking

        sess = MagicMock()
        with pytest.raises(HTTPException) as exc_info:
            await _handle_booking(
                sess,
                {"event_uuid": "evt-1", "invitee": {"email": "p@example.com", "name": "p"}, "scheduled_event": {}},
                "cid",
            )
        assert exc_info.value.status_code == 400
        assert "start_time" in exc_info.value.detail.lower()