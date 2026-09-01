"""Tests for Pydantic schemas."""

import pytest
from database.schemas import (
    LoginRequest,
    PatientCreate,
    ServiceRecordCreate,
    InlineUploadRequest,
    CompliancePatient,
)


class TestSchemas:
    def test_login_request_valid(self):
        data = LoginRequest(email="test@example.com", password="TestPass123")
        assert data.email == "test@example.com"
        assert data.password == "TestPass123"

    def test_login_request_invalid_email(self):
        with pytest.raises(Exception):
            LoginRequest(email="not-an-email", password="TestPass123")

    def test_login_request_short_password(self):
        with pytest.raises(Exception):
            LoginRequest(email="test@example.com", password="short")

    def test_patient_create_valid(self):
        data = PatientCreate(
            email="new@example.com",
            password="NewPass123",
            full_name="New Patient",
        )
        assert data.full_name == "New Patient"

    def test_patient_create_password_strength(self):
        """Test that password must meet strength requirements."""
        with pytest.raises(Exception):
            PatientCreate(
                email="new@example.com",
                password="weakpass",  # No uppercase, no digit
                full_name="New Patient",
            )

    def test_service_record_create_valid(self):
        from datetime import date
        data = ServiceRecordCreate(
            service_type="MRI",
            booking_date=date(2026, 8, 20),
        )
        assert data.service_type == "MRI"

    def test_service_record_create_invalid_type(self):
        from datetime import date
        with pytest.raises(Exception):
            ServiceRecordCreate(
                service_type="InvalidType",
                booking_date=date(2026, 8, 20),
            )

    def test_inline_upload_request_valid(self):
        data = InlineUploadRequest(
            file_type="checklist",
            file_url="https://example.com/file.pdf",
        )
        assert data.file_type == "checklist"

    def test_inline_upload_request_invalid_type(self):
        with pytest.raises(Exception):
            InlineUploadRequest(
                file_type="invalid",
                file_url="https://example.com/file.pdf",
            )
