"""Tests for queue/ai_parser.py — IntakeSummary parsing, compliance threshold, NEEDS_MANUAL_REVIEW."""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models import Appointment, AppointmentStatus, IntakeSubmission
from schemas.schemas import IntakeSummary
from services.ai_provider import _core_fields_present


# ---- _core_fields_present ----

class TestCoreFieldsPresent:
    def _mk_summary(self, chief="headache", meds=["ibuprofen"], allergies=["penicillin"]):
        return IntakeSummary(
            chief_complaint=chief,
            current_medications=meds,
            allergies=allergies,
            past_medical_history="[Not provided]",
            past_surgical_history="[Not provided]",
            family_history="[Not provided]",
            social_history="[Not provided]",
            additional_notes="",
            completeness_score=70,
            missing_fields=[],
        )

    def test_all_core_fields_present(self):
        summary = self._mk_summary(chief="headache", meds=["ibuprofen"], allergies=["penicillin"])
        assert _core_fields_present(summary) is True

    def test_missing_chief_complaint(self):
        summary = self._mk_summary(chief="[Not provided]")
        assert _core_fields_present(summary) is False

    def test_missing_medications_list_empty(self):
        summary = self._mk_summary(meds=[])
        assert _core_fields_present(summary) is False

    def test_medications_all_not_provided_sentinel(self):
        summary = self._mk_summary(meds=["[Not provided]"])
        assert _core_fields_present(summary) is False

    def test_medications_with_real_entry_among_sentinels(self):
        """A list that contains a real entry alongside the sentinel should pass."""
        summary = self._mk_summary(meds=["[Not provided]", "metformin"])
        assert _core_fields_present(summary) is True

    def test_allergies_with_no_known_allergies(self):
        """A genuine 'no known allergies' entry should count as provided."""
        summary = self._mk_summary(allergies=["No known allergies"])
        assert _core_fields_present(summary) is True


# ---- Compliance threshold ----

class TestResolveThreshold:
    @pytest.mark.asyncio
    async def test_reads_clinic_settings_first(self):
        from services.ai_provider import _resolve_threshold
        from models import ClinicSettings
        mock_settings = ClinicSettings(id=uuid.uuid4(), compliance_threshold_pct=85)
        sess = MagicMock()
        exec_result = MagicMock()
        exec_result.scalar_one_or_none.return_value = mock_settings
        sess.execute = AsyncMock(return_value=exec_result)

        threshold = await _resolve_threshold(sess)
        assert threshold == 85

    @pytest.mark.asyncio
    async def test_falls_back_to_env_when_no_settings_row(self):
        from services.ai_provider import _resolve_threshold
        sess = MagicMock()
        exec_result = MagicMock()
        exec_result.scalar_one_or_none.return_value = None
        sess.execute = AsyncMock(return_value=exec_result)

        with patch("services.ai_provider.settings") as mock_settings:
            mock_settings.compliance_threshold_pct = 70
            threshold = await _resolve_threshold(sess)
            assert threshold == 70


# ---- IntakeSummary Pydantic schema validation ----

class TestIntakeSummarySchema:
    def test_valid_full_summary(self):
        data = {
            "chief_complaint": "headache",
            "current_medications": ["ibuprofen"],
            "allergies": ["penicillin"],
            "past_medical_history": "hypertension",
            "past_surgical_history": "appendectomy 2018",
            "family_history": "father had diabetes",
            "social_history": "non-smoker",
            "additional_notes": "anxious about visit",
            "completeness_score": 95,
            "missing_fields": [],
        }
        s = IntakeSummary.model_validate(data)
        assert s.chief_complaint == "headache"
        assert s.completeness_score == 95

    def test_completeness_score_below_zero_rejected(self):
        data = {
            "chief_complaint": "", "current_medications": [], "allergies": [],
            "past_medical_history": "", "past_surgical_history": "",
            "family_history": "", "social_history": "", "additional_notes": "",
            "completeness_score": -1, "missing_fields": [],
        }
        # Pydantic raises a ValidationError on out-of-bound score
        with pytest.raises(Exception):
            IntakeSummary.model_validate(data)

    def test_completeness_score_above_hundred_rejected(self):
        data = {
            "chief_complaint": "", "current_medications": [], "allergies": [],
            "past_medical_history": "", "past_surgical_history": "",
            "family_history": "", "social_history": "", "additional_notes": "",
            "completeness_score": 101, "missing_fields": [],
        }
        with pytest.raises(Exception):
            IntakeSummary.model_validate(data)
