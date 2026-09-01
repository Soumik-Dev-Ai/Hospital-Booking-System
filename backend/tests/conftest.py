"""Conftest — shared fixtures for the test suite."""

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Use in-memory SQLite for tests (faster, no DB required)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


# No custom event_loop fixture — let pytest-asyncio manage it.


@pytest_asyncio.fixture
async def db_session():
    """Create an in-memory test database with all tables."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        import sys
        sys.path.insert(0, ".")
        from database.models import Base
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session
    await engine.dispose()


@pytest.fixture
def sample_user():
    """Sample user data for tests."""
    return {
        "email": "test@example.com",
        "password": "TestPass123",
        "full_name": "Test User",
        "role": "ROLE_PATIENT",
    }


@pytest.fixture
def sample_doctor():
    """Sample doctor data for tests."""
    return {
        "email": "doctor@example.com",
        "password": "DoctorPass123",
        "full_name": "Dr. Test",
        "role": "ROLE_DOCTOR",
        "specialization": "Cardiology",
    }


@pytest.fixture
def sample_appointment():
    """Sample appointment data for tests."""
    return {
        "scheduled_at": datetime(2026, 8, 15, 10, 0, tzinfo=timezone.utc),
        "notes": "Annual checkup",
    }


@pytest.fixture
def mock_gmail_client():
    """Mock Gmail client for tests."""
    mock = MagicMock()
    mock.send_email = AsyncMock(return_value="msg-id")
    mock.extract_ref_id = MagicMock(return_value=None)
    mock._strip_html = MagicMock(side_effect=lambda x: x.replace("<div>","").replace("</div>",""))
    return mock


@pytest.fixture
def mock_calendly_client():
    """Mock Calendly client for tests."""
    mock = MagicMock()
    mock.cancel_event = AsyncMock(return_value=True)
    mock.create_event = AsyncMock(return_value={"uuid": "test-uuid"})
    return mock


@pytest.fixture
def mock_arq_pool():
    """Mock Arq (Redis) pool for tests."""
    mock = AsyncMock()
    mock.enqueue_job = AsyncMock(return_value="job-id")
    return mock
