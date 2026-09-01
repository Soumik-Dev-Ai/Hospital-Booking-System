"""Tests for API routes."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from main import app
from database.models import User, Doctor, Appointment, UserRole, AppointmentStatus
from api.auth import hash_password


@pytest.fixture
def client(db_session):
    """Create a test client with the test database injected."""
    from database import get_db as _get_db

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[_get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_user():
    """Create a sample user."""
    return User(
        email="test@example.com",
        hashed_password=hash_password("TestPass123"),
        full_name="Test User",
        role=UserRole.ROLE_PATIENT,
    )


class TestHealthEndpoint:
    def test_health(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestAuthEndpoints:
    def test_login_success(self, client, sample_user, db_session):
        db_session.add(sample_user)

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "TestPass123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["role"] == "ROLE_PATIENT"
        assert data["full_name"] == "Test User"

    def test_login_invalid_password(self, client, sample_user, db_session):
        db_session.add(sample_user)

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrongpassword"},
        )
        assert response.status_code == 401

    def test_login_invalid_email(self, client):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@example.com", "password": "TestPass123"},
        )
        assert response.status_code == 401

    def test_forgot_password_existing(self, client, sample_user, db_session):
        db_session.add(sample_user)

        response = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "test@example.com"},
        )
        assert response.status_code == 200
        assert "message" in response.json()

    def test_forgot_password_nonexistent(self, client):
        response = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )
        assert response.status_code == 200
        # Same response to prevent email enumeration


class TestPublicEndpoints:
    @pytest.mark.asyncio
    async def test_get_free_slots(self, client, db_session):
        from database.models import Doctor

        doctor = Doctor(
            user_id=uuid4(),
            specialization="General Practice",
        )
        db_session.add(doctor)
        await db_session.commit()
        await db_session.refresh(doctor)

        response = client.get(f"/api/v1/public/doctors/{doctor.id}/free-slots")
        assert response.status_code == 200
        slots = response.json()
        assert isinstance(slots, list)
        # Should return up to 3 mock slots
        assert len(slots) <= 3


class TestAdminEndpoints:
    def test_compliance_requires_admin(self, client):
        response = client.get("/api/v1/admin/patients/compliance")
        assert response.status_code == 401  # Not authenticated

    def test_workload_requires_admin(self, client):
        response = client.get("/api/v1/admin/doctors/workload")
        assert response.status_code == 401  # Not authenticated
