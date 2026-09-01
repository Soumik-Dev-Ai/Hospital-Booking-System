"""
core/circuit_breaker.py — Async circuit breaker with three states:
CLOSED → OPEN → HALF_OPEN → CLOSED.

Usage:
    breaker = CircuitBreaker("gmail", failure_threshold=5, recovery_timeout=120.0)
    result = await breaker.call(async_func, arg1, arg2)
"""
import asyncio
import functools
import time
from collections import defaultdict
from typing import Any, Callable

from core.logging import get_logger

logger = get_logger("circuit_breaker")


class CircuitOpenError(Exception):
    """Raised when the circuit is OPEN and the request is rejected."""
    pass


class CircuitBreaker:
    """Three-state async circuit breaker for external service calls."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_max_calls: int = 3,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = "CLOSED"  # CLOSED | OPEN | HALF_OPEN
        self._last_failure_time = 0.0
        self._failure_count = 0
        self._half_open_calls = 0

    @property
    def failure_count(self) -> int:
        return self._failure_count

    @property
    def state(self) -> str:
        if self._state == "OPEN":
            if time.monotonic() - self._last_failure_time >= self.recovery_timeout:
                self._state = "HALF_OPEN"
                self._half_open_calls = 0
                logger.info("circuit_half_open", name=self.name)
        return self._state

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        current_state = self.state

        if current_state == "OPEN":
            raise CircuitOpenError(f"circuit_open: {self.name}")

        if current_state == "HALF_OPEN":
            if self._half_open_calls >= self.half_open_max_calls:
                raise CircuitOpenError(f"circuit_half_open_limit: {self.name}")
            self._half_open_calls += 1

        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)

            if self._state == "HALF_OPEN":
                self._state = "CLOSED"
                self._failure_count = 0
                self._half_open_calls = 0
                logger.info("circuit_closed", name=self.name)

            return result

        except CircuitOpenError:
            raise
        except Exception as e:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            logger.warning(
                "circuit_failure",
                name=self.name,
                failure_count=self._failure_count,
                threshold=self.failure_threshold,
                error=str(e),
            )
            if self._failure_count >= self.failure_threshold:
                self._state = "OPEN"
                logger.error("circuit_opened", name=self.name, failures=self._failure_count)
            raise

    def reset(self) -> None:
        self._state = "CLOSED"
        self._failure_count = 0
        self._half_open_calls = 0
        self._last_failure_time = 0.0


# Module-level breaker instances for the two wrapped services.
gmail_breaker = CircuitBreaker("gmail", failure_threshold=5, recovery_timeout=120.0)
calendly_breaker = CircuitBreaker("calendly", failure_threshold=5, recovery_timeout=120.0)
sheets_breaker = CircuitBreaker("sheets", failure_threshold=5, recovery_timeout=120.0)
