"""Phase 3 addendum tests: Patient.medical_history + Prescription.prescription_text /
checklist_tests + AppointmentCompleteRequest schema + the medical-history append format.
"""
import uuid
from datetime import datetime, timezone

import pytest

from models import Patient, Prescription, Appointment
from schemas.schemas import AppointmentCompleteRequest


# ---- Patient.medical_history ----

class TestPatientMedicalHistory:
    def test_patient_table_has_medical_history_column(self):
        """medical_history must be a nullable Text column on Patient."""
        from sqlalchemy import inspect
        mapper = inspect(Patient)
        cols = {c.name: c for c in mapper.columns}
        assert "medical_history" in cols, "Patient.medical_history missing"
        assert cols["medical_history"].nullable, "medical_history must be nullable"
        # TEXT in postgres, String in sqlite — both fine, check type name.
        assert cols["medical_history"].type.__class__.__name__ in ("Text", "String", "UnicodeText")

    def test_patient_medical_history_defaults_to_none(self):
        p = Patient(
            id=uuid.uuid4(), full_name="X", email="x@example.com",
        )
        assert p.medical_history is None


# ---- Prescription new fields + uniqueness ----

class TestPrescriptionNewFields:
    def test_prescription_has_prescription_text_column(self):
        from sqlalchemy import inspect
        mapper = inspect(Prescription)
        cols = {c.name: c for c in mapper.columns}
        assert "prescription_text" in cols
        assert cols["prescription_text"].nullable

    def test_prescription_has_checklist_tests_column(self):
        from sqlalchemy import inspect
        mapper = inspect(Prescription)
        cols = {c.name: c for c in mapper.columns}
        assert "checklist_tests" in cols
        assert cols["checklist_tests"].nullable

    def test_prescription_appointment_id_is_unique(self):
        from sqlalchemy import inspect
        mapper = inspect(Prescription)
        # Column-level unique OR a UniqueConstraint both count.
        col = mapper.columns.appointment_id
        if col.unique:
            return
        table = mapper.persist_selectable
        for ix in table.indexes:
            if ix.unique and [c.name for c in ix.columns] == ["appointment_id"]:
                return
        pytest.fail("Prescription.appointment_id must be UNIQUE")

    def test_legacy_medication_name_now_nullable(self):
        """The Phase 1 change relaxed medication_name to nullable so the completion
        flow (which uses prescription_text) doesn't have to set it."""
        from sqlalchemy import inspect
        mapper = inspect(Prescription)
        cols = {c.name: c for c in mapper.columns}
        assert cols["medication_name"].nullable


# ---- AppointmentCompleteRequest schema ----

class TestAppointmentCompleteRequest:
    def test_accepts_prescription_text_and_checklist(self):
        req = AppointmentCompleteRequest(
            prescription_text="Amoxicillin 500mg TID x 7d",
            checklist_tests=["CBC", "Lipid panel"],
        )
        assert req.prescription_text == "Amoxicillin 500mg TID x 7d"
        assert req.checklist_tests == ["CBC", "Lipid panel"]

    def test_checklist_tests_defaults_to_empty_list(self):
        req = AppointmentCompleteRequest(prescription_text="Rest + fluids")
        assert req.checklist_tests == []

    def test_missing_prescription_text_rejected(self):
        with pytest.raises(Exception):
            AppointmentCompleteRequest()


# ---- Medical-history append format ----

class TestMedicalHistoryAppend:
    def test_format_entry_contains_timestamp_and_fields(self):
        from api.appointments import _format_medical_entry
        ts = datetime(2026, 8, 15, 10, 30, 0, tzinfo=timezone.utc)
        entry = _format_medical_entry("Amox 500mg", ["CBC"], ts)
        assert "[2026-08-15 10:30:00 UTC]" in entry
        assert "Prescription: Amox 500mg" in entry
        assert "Tests: CBC" in entry

    def test_format_entry_with_no_tests_marks_none(self):
        from api.appointments import _format_medical_entry
        ts = datetime(2026, 8, 15, 10, 30, 0, tzinfo=timezone.utc)
        entry = _format_medical_entry("Rest", [], ts)
        assert "Tests: (none)" in entry

    def test_format_entry_with_multiple_tests_joins(self):
        from api.appointments import _format_medical_entry
        ts = datetime(2026, 8, 15, 10, 30, 0, tzinfo=timezone.utc)
        entry = _format_medical_entry("Rx", ["CBC", "Lipid panel", "BMP"], ts)
        assert "Tests: CBC, Lipid panel, BMP" in entry


# ---- sheets_client dynamic per-month filename ----

class TestSheetsClientDynamicFilenames:
    def test_filename_format_uses_month_year(self):
        from services.sheets_client import _filename_for
        import datetime as _dt
        d = _dt.datetime(2026, 8, 15, 10, 0, 0, tzinfo=_dt.timezone.utc)
        assert _filename_for(d) == "Patient Intake - August 2026"

    def test_filename_different_for_different_months(self):
        from services.sheets_client import _filename_for
        import datetime as _dt
        aug = _dt.datetime(2026, 8, 15, 10, 0, 0, tzinfo=_dt.timezone.utc)
        sep = _dt.datetime(2026, 9, 15, 10, 0, 0, tzinfo=_dt.timezone.utc)
        assert _filename_for(aug) != _filename_for(sep)

    def test_sheets_client_has_id_cache(self):
        from services.sheets_client import sheets_client
        assert hasattr(sheets_client, "_spreadsheet_ids")
        assert isinstance(sheets_client._spreadsheet_ids, dict)

    def test_sheets_client_has_get_or_create_method(self):
        from services.sheets_client import sheets_client
        assert hasattr(sheets_client, "get_or_create_spreadsheet")
        assert hasattr(sheets_client, "get_public_url")

    def test_scopes_include_drive_file(self):
        from services.sheets_client import _SCOPES
        assert "https://www.googleapis.com/auth/drive.file" in _SCOPES
        assert "https://www.googleapis.com/auth/spreadsheets" in _SCOPES


# ---- Completion endpoint registered ----

class TestCompletionRouteRegistered:
    def test_complete_route_exists(self):
        from api.appointments import router
        paths = [r.path for r in router.routes]
        assert any(p.endswith("/{appointment_id}/complete") for p in paths), \
            f"complete route not found; routes={paths}"
