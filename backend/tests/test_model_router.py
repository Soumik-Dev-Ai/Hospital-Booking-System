"""Tests for Criteria 4: Cost-Efficient Model Routing.

Verifies:
  - classify_complexity returns correct tiers
  - get_route_for_complexity returns correct provider chains
  - parse_intake_with_fallback uses dynamic routing
  - Static fallback chain is preserved
  - Unconfigured providers are skipped
"""
import json
from unittest.mock import AsyncMock, patch
import pytest

from services.model_router import classify_complexity, get_route_for_complexity
from services.ai_provider import (
    parse_intake_with_fallback, _FALLBACK_CHAIN, _ROUTE_MAP,
    primary_provider, groq_provider, cerebras_provider, fallback_provider,
)


# ---- Complexity classification ----

class TestClassifyComplexity:
    def test_short_text_is_simple(self):
        assert classify_complexity("Hi, I have a cold.") == "simple"

    def test_long_medical_text_is_complex(self):
        text = ("I have been having severe chest pain for the past 3 days. "
                "It radiates to my left arm and jaw. I also experience shortness of breath, "
                "dizziness, and nausea. I have a history of hypertension and diabetes. "
                "My father had a heart attack at 55. I take metformin and lisinopril. "
                "I am allergic to sulfa drugs. I had an appendectomy at 20 and a knee "
                "replacement at 45. My family history includes heart disease and cancer. "
                "I smoke occasionally and drink socially. I work as an accountant.")
        assert classify_complexity(text) == "complex"

    def test_medium_text_is_moderate(self):
        text = ("I am writing to request a prescription refill for my blood pressure medication. "
                "The current prescription is running low and I need it refilled before my upcoming "
                "appointment next month. I have been taking this medication for approximately two years "
                "now and it has been working well to manage my condition. I would appreciate it if you "
                "could send a new prescription to my pharmacy as soon as possible. Thank you for your "
                "help with this matter. Please let me know if you need any additional information.")
        assert classify_complexity(text) == "moderate"

    def test_empty_string_is_simple(self):
        assert classify_complexity("") == "simple"

    def test_text_with_medical_keywords_is_complex(self):
        text = ("I have chest pain, shortness of breath, and history of hypertension "
                "and diabetes. Father had heart attack at 55.")
        assert classify_complexity(text) == "complex"


# ---- Route resolution ----

class TestRouteResolution:
    def test_simple_routes_to_groq_primary(self):
        chain = get_route_for_complexity("simple")
        assert chain[0][0] == "groq"

    def test_moderate_routes_to_openrouter_primary(self):
        chain = get_route_for_complexity("moderate")
        assert chain[0][0] == "openrouter"

    def test_complex_routes_to_openrouter_primary(self):
        chain = get_route_for_complexity("complex")
        assert chain[0][0] == "openrouter"

    def test_simple_chain_has_multiple_providers(self):
        chain = get_route_for_complexity("simple")
        names = [p for p, _ in chain]
        assert "groq" in names
        assert "cerebras" in names

    def test_complex_chain_includes_fallback(self):
        chain = get_route_for_complexity("complex")
        names = [p for p, _ in chain]
        assert "openrouter" in names
        assert "nvidia_nim" in names


# ---- Static fallback chain ----

class TestStaticFallback:
    def test_fallback_chain_order(self):
        names = [p.name for p, _ in _FALLBACK_CHAIN]
        assert names == ["openrouter", "groq", "cerebras", "nvidia_nim"]

    def test_openrouter_has_3_attempts(self):
        for p, attempts in _FALLBACK_CHAIN:
            if p.name == "openrouter":
                assert attempts == 3

    def test_groq_has_1_attempt_in_static(self):
        for p, attempts in _FALLBACK_CHAIN:
            if p.name == "groq":
                assert attempts == 1


# ---- parse_intake_with_fallback ----

class TestParseIntakeWithFallback:
    @pytest.mark.asyncio
    async def test_first_provider_success(self):
        """If primary provider succeeds, return its result."""
        sample = {"chief_complaint": "test", "current_medications": [], "allergies": [],
                  "past_medical_history": "", "past_surgical_history": "", "family_history": "",
                  "social_history": "", "additional_notes": "", "completeness_score": 80,
                  "missing_fields": []}
        primary_provider._configured_override = True
        try:
            with patch.object(primary_provider, "parse_intake", new_callable=AsyncMock) as mock_parse:
                mock_parse.return_value = type('S', (), sample)()
                # Need to make it validate as IntakeSummary
                from schemas.schemas import IntakeSummary
                summary = IntakeSummary(**sample)
                mock_parse.return_value = summary
    
                result, name, model = await parse_intake_with_fallback("test text")
                assert result.chief_complaint == "test"
                assert name == "openrouter"
        finally:
            primary_provider._configured_override = None

    @pytest.mark.asyncio
    async def test_falls_through_to_next_provider(self):
        """If primary fails, fall through to next configured provider."""
        from schemas.schemas import IntakeSummary
        sample = {"chief_complaint": "test", "current_medications": [], "allergies": [],
                  "past_medical_history": "", "past_surgical_history": "", "family_history": "",
                  "social_history": "", "additional_notes": "", "completeness_score": 80,
                  "missing_fields": []}
        summary = IntakeSummary(**sample)

        primary_provider._configured_override = True
        groq_provider._configured_override = True
        try:
            with patch.object(primary_provider, "parse_intake", new_callable=AsyncMock) as mock_primary:
                with patch.object(groq_provider, "parse_intake", new_callable=AsyncMock) as mock_groq:
                    mock_primary.side_effect = RuntimeError("provider down")
                    mock_groq.return_value = summary

                    # Use moderate text so router chain is: openrouter -> groq -> cerebras
                    result, name, _ = await parse_intake_with_fallback(
                        "I am writing to request a prescription refill for my blood pressure medication. "
                        "The current prescription is running low and I need it refilled before my upcoming "
                        "appointment next month. I have been taking this medication for approximately two years "
                        "now and it has been working well to manage my condition. I would appreciate it if you "
                        "could send a new prescription to my pharmacy as soon as possible.")
                    assert name == "groq"
                    assert mock_primary.call_count == 2  # openrouter max_attempts=2 in moderate chain
                    mock_groq.assert_called_once()
        finally:
            primary_provider._configured_override = None
            groq_provider._configured_override = None

    @pytest.mark.asyncio
    async def test_all_providers_exhausted_raises(self):
        """If all providers fail, raise RuntimeError."""
        with patch.object(primary_provider, "parse_intake", new_callable=AsyncMock) as m:
            m.side_effect = RuntimeError("all down")
            with patch.object(groq_provider, "parse_intake", new_callable=AsyncMock) as m2:
                m2.side_effect = RuntimeError("also down")
                with patch.object(cerebras_provider, "parse_intake", new_callable=AsyncMock) as m3:
                    m3.side_effect = RuntimeError("also down")
                    with patch.object(fallback_provider, "parse_intake", new_callable=AsyncMock) as m4:
                        m4.side_effect = RuntimeError("also down")
                        with pytest.raises(RuntimeError):
                            await parse_intake_with_fallback("test")

    @pytest.mark.asyncio
    async def test_unconfigured_providers_skipped(self):
        """Providers without API key must be skipped silently."""
        from schemas.schemas import IntakeSummary
        sample = {"chief_complaint": "test", "current_medications": [], "allergies": [],
                  "past_medical_history": "", "past_surgical_history": "", "family_history": "",
                  "social_history": "", "additional_notes": "", "completeness_score": 80,
                  "missing_fields": []}
        summary = IntakeSummary(**sample)

        # Make all providers unconfigured except groq
        primary_provider._configured_override = False
        cerebras_provider._configured_override = False
        fallback_provider._configured_override = False
        groq_provider._configured_override = True
        try:
            with patch.object(groq_provider, "parse_intake", new_callable=AsyncMock) as m:
                m.return_value = summary
                result, name, _ = await parse_intake_with_fallback("test")
                assert name == "groq"
        finally:
            primary_provider._configured_override = None
            cerebras_provider._configured_override = None
            fallback_provider._configured_override = None
            groq_provider._configured_override = None


# ---- Dynamic vs static routing ----

class TestDynamicRouting:
    def test_route_map_defined(self):
        assert "simple" in _ROUTE_MAP
        assert "moderate" in _ROUTE_MAP
        assert "complex" in _ROUTE_MAP

    def test_simple_chain_differs_from_static(self):
        """Simple route should start with groq, not openrouter."""
        simple_chain = get_route_for_complexity("simple")
        static_chain = _FALLBACK_CHAIN
        assert simple_chain[0][0] != static_chain[0][0]
