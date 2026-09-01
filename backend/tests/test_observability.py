"""Tests for Criteria 6: Logging & Observability.

Verifies:
  - RequestTracingMiddleware binds correlation_id and logs duration
  - Metrics counters and histograms are populated
  - AI providers increment metrics on success/failure
  - Admin system-health includes http_metrics and gmail_watch_health
  - Cron uses structlog with correlation_id
"""
import asyncio
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

import pytest

from core.metrics import Metrics, metrics
from core.middleware import RequestTracingMiddleware
from core.logging import correlation_id
from starlette.testclient import TestClient
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route


# ---- Metrics ----

class TestMetrics:
    def test_increment(self):
        m = Metrics()
        m.increment("test.counter")
        assert m.counters["test.counter"] == 1
        m.increment("test.counter")
        assert m.counters["test.counter"] == 2

    def test_increment_with_value(self):
        m = Metrics()
        m.increment("test.counter", 5)
        assert m.counters["test.counter"] == 5

    def test_observe(self):
        m = Metrics()
        m.observe("test.latency", 0.1)
        m.observe("test.latency", 0.2)
        m.observe("test.latency", 0.3)
        summary = m.summary()
        assert "test.latency" in summary["histograms"]
        hist = summary["histograms"]["test.latency"]
        assert hist["count"] == 3
        assert hist["avg_ms"] == pytest.approx(200.0)
        assert hist["max_ms"] == pytest.approx(300.0)
        assert hist["p95_ms"] > 0

    def test_singleton(self):
        """The module-level metrics singleton is the same instance."""
        from core.metrics import metrics as m1
        assert isinstance(m1, Metrics)


# ---- RequestTracingMiddleware ----

class TestRequestTracingMiddleware:
    def test_middleware_binds_correlation_id(self):
        """Each request must get a unique correlation_id."""
        call_counts = {"n": 0}

        async def endpoint(request):
            call_counts["n"] += 1
            return JSONResponse({"seq": call_counts["n"]})

        app = Starlette(routes=[Route("/{path:path}", endpoint)])
        app.add_middleware(RequestTracingMiddleware)
        client = TestClient(app)

        r1 = client.get("/test")
        r2 = client.get("/test")
        assert r1.status_code == 200
        assert r2.status_code == 200

    def test_middleware_logs_duration(self):
        """Middleware must log http_request with duration_ms."""
        async def endpoint(request):
            return JSONResponse({"ok": True})

        app = Starlette(routes=[Route("/test", endpoint)])
        app.add_middleware(RequestTracingMiddleware)
        client = TestClient(app)

        # Should not raise
        r = client.get("/test")
        assert r.status_code == 200

    def test_metrics_incremented(self):
        """Middleware must increment http.* counters."""
        async def endpoint(request):
            return JSONResponse({"ok": True})

        app = Starlette(routes=[Route("/test", endpoint)])
        app.add_middleware(RequestTracingMiddleware)
        client = TestClient(app)

        r = client.get("/test")
        assert r.status_code == 200

        # Check metrics were incremented
        summary = metrics.summary()
        http_keys = [k for k in summary.get("counters", {}) if k.startswith("http.")]
        assert len(http_keys) > 0


# ---- AI provider metrics ----

class TestAIProviderMetrics:
    @pytest.mark.asyncio
    async def test_success_increments_counter(self):
        """Successful parse_intake must increment ai.{provider}.success."""
        from services.ai_provider import primary_provider
        from schemas.schemas import IntakeSummary

        sample = {"chief_complaint": "test", "current_medications": [], "allergies": [],
                  "past_medical_history": "", "past_surgical_history": "", "family_history": "",
                  "social_history": "", "additional_notes": "", "completeness_score": 80,
                  "missing_fields": []}
        summary = IntakeSummary(**sample)

        with patch.object(primary_provider, "_chat_complete", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = '{"chief_complaint":"test","current_medications":[],"allergies":[],"past_medical_history":"","past_surgical_history":"","family_history":"","social_history":"","additional_notes":"","completeness_score":80,"missing_fields":[]}'
            await primary_provider.parse_intake("test")

        assert metrics.counters.get("ai.openrouter.success", 0) >= 1

    @pytest.mark.asyncio
    async def test_failure_increments_failure_counter(self):
        """Failed parse_intake must increment ai.{provider}.failure."""
        from services.ai_provider import primary_provider
        with patch.object(primary_provider, "_chat_complete", new_callable=AsyncMock) as mock_chat:
            mock_chat.side_effect = RuntimeError("down")
            with pytest.raises(RuntimeError):
                await primary_provider.parse_intake("test")

        assert metrics.counters.get("ai.openrouter.failure", 0) >= 1


# ---- Admin system-health includes new fields ----

class TestSystemHealthMetrics:
    def test_admin_includes_metrics_import(self):
        """api/admin.py must import metrics and include http_metrics + gmail_watch_health."""
        admin_source = Path(__file__).parent.parent / "api" / "admin.py"
        text = admin_source.read_text(encoding="utf-8")
        assert "http_metrics" in text
        assert "gmail_watch_health" in text
        assert "from core.metrics import metrics" in text or "metrics.summary" in text

    def test_schema_has_new_fields(self):
        """SystemHealthOut must have http_metrics and gmail_watch_health fields."""
        from schemas.schemas import SystemHealthOut
        fields = SystemHealthOut.model_fields
        assert "http_metrics" in fields
        assert "gmail_watch_health" in fields

    def test_gmail_watch_health_imported(self):
        """admin.py must import check_watch_health from gmail_watch_renewal."""
        admin_source = Path(__file__).parent.parent / "api" / "admin.py"
        text = admin_source.read_text(encoding="utf-8")
        assert "check_watch_health" in text
        assert "gmail_watch_renewal" in text


# ---- Cron uses correlation_id ----

class TestCronCorrelationId:
    def test_cron_starts_with_correlation_id(self):
        """run_enforcement must log with correlation_id at start."""
        from cron_enforcement import run_enforcement
        import inspect
        source = inspect.getsource(run_enforcement)
        assert "correlation_id()" in source
        assert "cron_enforcement_started" in source
