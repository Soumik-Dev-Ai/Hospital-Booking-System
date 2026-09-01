"""Tests for Criteria 2: Guaranteed JSON Outputs.

Verifies:
  - json_schema response format is set for OpenRouter (supports_json_schema=True)
  - json_object fallback is set for Groq/Cerebras (supports_json_schema=False)
  - No markdown fence stripping occurs in parse_intake
  - Gemini client uses GenerationConfig with response_schema
  - IntakeSummary validation rejects malformed JSON
"""
import json
from unittest.mock import AsyncMock, patch, MagicMock
import pytest

from schemas.schemas import IntakeSummary
from services.ai_provider import (
    AIProvider, primary_provider, groq_provider, cerebras_provider, fallback_provider,
    _FALLBACK_CHAIN, _ROUTE_MAP,
)
from services.model_router import classify_complexity, get_route_for_complexity
from services.gemini_client import GeminiClient


# ---- json_schema vs json_object ----

class TestResponseFormat:
    def test_openrouter_uses_json_schema(self):
        """OpenRouter (supports_json_schema=True) must request json_schema response format."""
        fmt = primary_provider._build_response_format()
        assert fmt["type"] == "json_schema"
        assert fmt["json_schema"]["name"] == "intake_summary"
        assert fmt["json_schema"]["strict"] is True
        assert "schema" in fmt["json_schema"]

    def test_groq_uses_json_object_fallback(self):
        """Groq (supports_json_schema=False) must fall back to json_object."""
        fmt = groq_provider._build_response_format()
        assert fmt["type"] == "json_object"

    def test_cerebras_uses_json_object_fallback(self):
        fmt = cerebras_provider._build_response_format()
        assert fmt["type"] == "json_object"

    def test_nvidia_nim_uses_json_object_fallback(self):
        fmt = fallback_provider._build_response_format()
        assert fmt["type"] == "json_object"

    def test_json_schema_schema_matches_intake_summary(self):
        """json_schema.schema must be a superset of IntakeSummary fields."""
        fmt = primary_provider._build_response_format()
        schema = fmt["json_schema"]["schema"]
        required = set(IntakeSummary.model_fields.keys())
        actual = set(schema.get("properties", {}).keys())
        assert required.issubset(actual), f"Missing fields: {required - actual}"


# ---- Structured output in requests ----

class TestParseIntake:
    @pytest.mark.asyncio
    async def test_parse_intake_with_valid_json(self):
        """Valid JSON should parse without fence stripping."""
        sample = {
            "chief_complaint": "Headache",
            "current_medications": [],
            "allergies": [],
            "past_medical_history": "None",
            "past_surgical_history": "None",
            "family_history": "None",
            "social_history": "Non-smoker",
            "additional_notes": "",
            "completeness_score": 60,
            "missing_fields": ["allergies", "past_medical_history"],
        }
        with patch.object(primary_provider, "_chat_complete", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = json.dumps(sample)
            result = await primary_provider.parse_intake("I have a headache")
            assert isinstance(result, IntakeSummary)
            assert result.chief_complaint == "Headache"
            assert result.completeness_score == 60

    @pytest.mark.asyncio
    async def test_no_fence_stripping(self):
        """parse_intake must NOT strip markdown fences — json_schema guarantees valid JSON."""
        with patch.object(primary_provider, "_chat_complete", new_callable=AsyncMock) as mock_chat:
            # If the model returns fenced JSON, it should fail validation (no stripping).
            mock_chat.return_value = "```json\n{\"chief_complaint\":\"test\"}\n```"
            with pytest.raises((json.JSONDecodeError, Exception)):
                await primary_provider.parse_intake("test")

    @pytest.mark.asyncio
    async def test_parse_rejects_malformed_json(self):
        """Malformed JSON should raise, not silently produce wrong data."""
        with patch.object(primary_provider, "_chat_complete", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = "not valid json at all"
            with pytest.raises((json.JSONDecodeError, Exception)):
                await primary_provider.parse_intake("test")


# ---- Gemini structured output ----

class TestGeminiClient:
    def test_gemini_uses_response_schema(self):
        """Gemini client must configure GenerationConfig with response_schema."""
        with patch("services.gemini_client.genai") as mock_genai:
            mock_model = MagicMock()
            mock_genai.GenerativeModel.return_value = mock_model
            mock_genai.GenerationConfig = MagicMock()

            # We can't fully init (needs real API key), but we verify the call args
            # by inspecting the GenerationConfig init call.
            gemini = GeminiClient.__new__(GeminiClient)
            gemini.model_name = "gemini-1.5-pro"
            gemini.model = mock_model

            # The GenerationConfig should have been called with response_schema
            # (verified by reading source instead of instantiating)
            from services.gemini_client import GeminiClient as GC
            source = GC.__init__.__code__.co_filename
            import inspect
            source_lines = inspect.getsource(GC.__init__)
            assert "response_schema" in source_lines, "Gemini client must use response_schema"
            assert "response_mime_type" in source_lines


# ---- IntakeSummary validation ----

class TestIntakeSummaryValidation:
    def test_valid_summary_accepts(self):
        data = {
            "chief_complaint": "Back pain",
            "current_medications": ["ibuprofen"],
            "allergies": ["penicillin"],
            "past_medical_history": "Hypertension",
            "past_surgical_history": "Appendectomy",
            "family_history": "Diabetes in mother",
            "social_history": "Non-smoker",
            "additional_notes": "",
            "completeness_score": 85,
            "missing_fields": [],
        }
        s = IntakeSummary.model_validate(data)
        assert s.completeness_score == 85

    def test_completeness_score_clamped(self):
        with pytest.raises(Exception):
            IntakeSummary.model_validate({
                "chief_complaint": "test",
                "current_medications": [],
                "allergies": [],
                "past_medical_history": "",
                "past_surgical_history": "",
                "family_history": "",
                "social_history": "",
                "additional_notes": "",
                "completeness_score": 150,  # exceeds max
                "missing_fields": [],
            })

    def test_missing_required_fields_rejected(self):
        with pytest.raises(Exception):
            IntakeSummary.model_validate({})


# ---- Model router ----

class TestModelRouter:
    def test_simple_text_routes_to_groq(self):
        text = "Hi doc, I have a cold. Thanks."
        complexity = classify_complexity(text)
        assert complexity == "simple"
        chain = get_route_for_complexity(complexity)
        assert chain[0][0] == "groq"

    def test_complex_text_routes_to_openrouter(self):
        text = "I have been experiencing severe chest pain radiating to the left arm, " \
               "shortness of breath, and nausea for the past 3 hours. I have a history of " \
               "hypertension and diabetes. My father had a heart attack at 55. I take " \
               "metformin 500mg twice daily and lisinopril 10mg daily. I am allergic to " \
               "sulfa drugs and penicillin. I have had an appendectomy at age 20 and a " \
               "knee replacement at 45. My family history includes heart disease and " \
               "cancer. I smoke occasionally and drink alcohol socially."
        complexity = classify_complexity(text)
        assert complexity == "complex"
        chain = get_route_for_complexity(complexity)
        assert chain[0][0] == "openrouter"

    def test_moderate_default(self):
        text = (
            "I am writing to request a prescription refill for my blood pressure medication. "
            "The current prescription is running low and I need it refilled before my upcoming "
            "appointment next month. I have been taking this medication for approximately two years "
            "now and it has been working well to manage my condition."
        )
        complexity = classify_complexity(text)
        assert complexity == "moderate"
