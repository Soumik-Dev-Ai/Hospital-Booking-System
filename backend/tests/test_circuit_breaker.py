"""Tests for Criteria 3: Robust Routing & Safety Fallbacks.

Verifies:
  - Circuit breaker transitions: CLOSED -> OPEN -> HALF_OPEN
  - Rate limiter skips admin/webhook paths
  - Rate limiter enforces 429 on excess requests
  - Gmail client uses circuit breaker on send_email
  - Calendly client uses circuit breaker on cancel_event
"""
import asyncio
import time
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from core.circuit_breaker import CircuitBreaker, gmail_breaker, calendly_breaker
from core.rate_limiter import RateLimiter
from starlette.testclient import TestClient
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route


# ---- Circuit breaker ----

class TestCircuitBreaker:
    @pytest.mark.asyncio
    async def test_closed_state_allows_calls(self):
        breaker = CircuitBreaker(name="test", failure_threshold=3, recovery_timeout=60.0)
        assert breaker.state == "CLOSED"

        async def ok_fn():
            return "ok"

        result = await breaker.call(ok_fn)
        assert result == "ok"
        assert breaker.failure_count == 0

    @pytest.mark.asyncio
    async def test_opens_after_threshold_failures(self):
        breaker = CircuitBreaker(name="test", failure_threshold=2, recovery_timeout=60.0)

        async def failing_fn():
            raise RuntimeError("fail")

        for _ in range(2):
            with pytest.raises(RuntimeError):
                await breaker.call(failing_fn)

        assert breaker.state == "OPEN"

    @pytest.mark.asyncio
    async def test_open_state_rejects_calls(self):
        breaker = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=60.0)

        async def failing_fn():
            raise RuntimeError("fail")

        with pytest.raises(RuntimeError):
            await breaker.call(failing_fn)

        assert breaker.state == "OPEN"
        # Second call should also raise (CircuitBreakerOpen)
        with pytest.raises(Exception):
            await breaker.call(failing_fn)

    @pytest.mark.asyncio
    async def test_half_open_allows_probe_after_recovery(self):
        breaker = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=0.1)

        async def failing_fn():
            raise RuntimeError("fail")

        with pytest.raises(RuntimeError):
            await breaker.call(failing_fn)
        assert breaker.state == "OPEN"

        # Wait for recovery timeout
        await asyncio.sleep(0.15)

        # In HALF_OPEN, a successful call should close the circuit
        async def ok_fn():
            return "ok"

        result = await breaker.call(ok_fn)
        assert result == "ok"
        assert breaker.state == "CLOSED"
        assert breaker.failure_count == 0

    @pytest.mark.asyncio
    async def test_half_open_rejects_after_failure(self):
        breaker = CircuitBreaker(name="test", failure_threshold=1, recovery_timeout=0.1)

        async def failing_fn():
            raise RuntimeError("fail")

        with pytest.raises(RuntimeError):
            await breaker.call(failing_fn)
        assert breaker.state == "OPEN"

        await asyncio.sleep(0.15)

        # In HALF_OPEN, a failure should re-open
        with pytest.raises(RuntimeError):
            await breaker.call(failing_fn)
        assert breaker.state == "OPEN"


# ---- Gmail client circuit breaker ----

class TestGmailBreaker:
    @pytest.mark.asyncio
    async def test_send_email_wrapped_by_breaker(self):
        """gmail_client.send_email must use gmail_breaker.call()."""
        from services.gmail_client import gmail_client
        import inspect
        source = inspect.getsource(gmail_client.send_email)
        assert "gmail_breaker.call" in source


# ---- Calendly client circuit breaker ----

class TestCalendlyBreaker:
    @pytest.mark.asyncio
    async def test_cancel_event_wrapped_by_breaker(self):
        """calendly_client.cancel_event must use calendly_breaker.call()."""
        from services.calendly_client import calendly_client
        import inspect
        source = inspect.getsource(calendly_client.cancel_event)
        assert "calendly_breaker.call" in source


# ---- Rate limiter ----

def _make_app():
    """Minimal Starlette app for rate-limiter integration tests."""
    call_count = {"n": 0}

    async def endpoint(request):
        call_count["n"] += 1
        return JSONResponse({"count": call_count["n"]})

    app = Starlette(routes=[Route("/api/public/{path:path}", endpoint)])
    return app, call_count


class TestRateLimiter:
    @pytest.mark.asyncio
    async def test_skips_admin_paths(self):
        app, _ = _make_app()
        rl = RateLimiter(app, requests_per_minute=60)

        from starlette.requests import Request
        req = Request(
            scope={"type": "http", "method": "GET", "path": "/api/admin/staff-users",
                   "headers": [], "query_string": b""},
        )
        # Should not raise — admin paths are skipped
        async def call_next(r):
            return JSONResponse({"ok": True})
        result = await rl.dispatch(req, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_skips_webhook_paths(self):
        app, _ = _make_app()
        rl = RateLimiter(app, requests_per_minute=60)

        from starlette.requests import Request
        req = Request(
            scope={"type": "http", "method": "POST", "path": "/webhooks/calendly",
                   "headers": [], "query_string": b""},
        )

        async def call_next(r):
            return JSONResponse({"ok": True})
        result = await rl.dispatch(req, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_enforces_limit(self):
        """Exceeding RPM should return 429."""
        from fastapi import HTTPException
        from starlette.requests import Request
        from starlette.responses import JSONResponse

        app, _ = _make_app()
        rl = RateLimiter(app, requests_per_minute=2)

        async def make_request(path):
            req = Request(
                scope={"type": "http", "method": "GET", "path": path,
                       "headers": [], "query_string": b"",
                       "server": ("testserver", 80)},
            )
            async def call_next(r):
                return JSONResponse({"count": 1})
            try:
                return await rl.dispatch(req, call_next)
            except HTTPException as e:
                return e

        r1 = await make_request("/api/public/foo")
        assert r1.status_code == 200
        r2 = await make_request("/api/public/foo")
        assert r2.status_code == 200
        r3 = await make_request("/api/public/foo")
        assert isinstance(r3, HTTPException)
        assert r3.status_code == 429

    @pytest.mark.asyncio
    async def test_skips_health_path(self):
        app, _ = _make_app()
        rl = RateLimiter(app, requests_per_minute=1)

        from starlette.requests import Request
        req = Request(
            scope={"type": "http", "method": "GET", "path": "/api/health",
                   "headers": [], "query_string": b""},
        )

        async def call_next(r):
            return JSONResponse({"status": "healthy"})
        result = await rl.dispatch(req, call_next)
        assert result.status_code == 200
