"""Tests for the tracing utility."""

import pytest
import contextvars
from utils.tracing import (
    set_trace_id,
    get_trace_id,
    generate_trace_id,
    TraceContextManager,
    trace_log,
    trace_warning,
    trace_error,
    _trace_id,
)


class TestTraceId:
    def test_generate_trace_id(self):
        tid = generate_trace_id()
        assert len(tid) == 36  # UUID format
        assert tid.count("-") == 4  # Standard UUID separators

    def test_set_and_get(self):
        tid = generate_trace_id()
        set_trace_id(tid)
        assert get_trace_id() == tid

    def test_default_trace_id(self):
        # Reset any leftover context from prior tests
        _trace_id.set("")
        assert get_trace_id() == ""


class TestTraceContextManager:
    def test_context_manager_sets_trace_id(self):
        # Start from a clean state
        _trace_id.set("")
        with TraceContextManager("test-trace-123") as ctx:
            assert get_trace_id() == "test-trace-123"
        # Should be reset after context exits
        assert get_trace_id() == ""

    def test_context_manager_generates_trace_id(self):
        with TraceContextManager() as ctx:
            assert get_trace_id() != ""

    def test_nested_contexts(self):
        with TraceContextManager("outer"):
            assert get_trace_id() == "outer"
            with TraceContextManager("inner"):
                assert get_trace_id() == "inner"
            assert get_trace_id() == "outer"


class TestTraceLogging:
    def test_trace_log_includes_id(self, caplog):
        with TraceContextManager("log-test-123"):
            with caplog.at_level("INFO"):
                trace_log("test message")
                assert "log-test-123" in caplog.text
