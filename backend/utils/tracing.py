"""Trace ID utilities using contextvars for structured logging."""

import contextvars
import logging
import uuid
from typing import Optional

logger = logging.getLogger(__name__)

# Context variable to hold the trace ID for the current request
_trace_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    "trace_id", default=""
)


def set_trace_id(trace_id: str) -> str:
    """Set the trace ID for the current context."""
    _trace_id.set(trace_id)
    return trace_id


def get_trace_id() -> str:
    """Get the current trace ID."""
    return _trace_id.get()


def generate_trace_id() -> str:
    """Generate a new UUID v4 trace ID."""
    return str(uuid.uuid4())


class TraceContextManager:
    """Context manager that sets and restores trace IDs."""

    def __init__(self, trace_id: Optional[str] = None):
        self.trace_id = trace_id or generate_trace_id()
        self._token = None

    def __enter__(self):
        self._token = _trace_id.set(self.trace_id)
        logger.debug("Trace context started: %s", self.trace_id)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._token:
            _trace_id.reset(self._token)
        logger.debug("Trace context ended: %s", self.trace_id)
        return False


def trace_log(message: str, **kwargs) -> None:
    """Log a message with the current trace ID automatically included."""
    tid = get_trace_id()
    extra = {"trace_id": tid, **kwargs}
    logger.info(f"[trace={tid}] {message}", extra=extra)


def trace_warning(message: str, **kwargs) -> None:
    """Log a warning with the current trace ID automatically included."""
    tid = get_trace_id()
    logger.warning(f"[trace={tid}] {message}", extra=kwargs)


def trace_error(message: str, **kwargs) -> None:
    """Log an error with the current trace ID automatically included."""
    tid = get_trace_id()
    logger.error(f"[trace={tid}] {message}", extra=kwargs)
