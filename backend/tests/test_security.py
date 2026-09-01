"""Tests for security middleware and quarantine."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from security.quarantine import (
    is_quarantined,
    quarantine_user,
    unquarantine_user,
    update_user_quarantine_flag,
)
from database.models import User, QuarantinedUser, UserRole


class TestQuarantine:
    @pytest.mark.asyncio
    async def test_is_not_quarantined(self, db_session):
        user_id = uuid4()
        result = await is_quarantined(user_id, db_session)
        assert result is False

    @pytest.mark.asyncio
    async def test_quarantine_user(self, db_session):
        user_id = uuid4()
        await quarantine_user(user_id, "test reason", db_session)
        result = await is_quarantined(user_id, db_session)
        assert result is True

    @pytest.mark.asyncio
    async def test_unquarantine_user(self, db_session):
        user_id = uuid4()
        await quarantine_user(user_id, "test reason", db_session)
        await unquarantine_user(user_id, db_session)
        result = await is_quarantined(user_id, db_session)
        assert result is False

    @pytest.mark.asyncio
    async def test_update_user_quarantine_flag(self, db_session):
        user = User(
            email="quarantine@test.com",
            hashed_password="hashed",
            role=UserRole.ROLE_PATIENT,
            full_name="Quarantine Test",
        )
        db_session.add(user)
        await db_session.flush()

        await update_user_quarantine_flag(user.id, True, db_session)
        result = await db_session.get(User, user.id)
        assert result.is_quarantined is True

        await update_user_quarantine_flag(user.id, False, db_session)
        result = await db_session.get(User, user.id)
        assert result.is_quarantined is False
