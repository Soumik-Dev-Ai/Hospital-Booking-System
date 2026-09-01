import structlog
from datetime import datetime, timezone
import uuid


def configure_logging(service_name="patient-intake"):
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.dev.ConsoleRenderer() if __import__("os").getenv("APP_ENV") == "development" else structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(20),
        cache_logger_on_first_use=True,
    )
    return structlog.get_logger(service_name)


def correlation_id() -> str:
    return uuid.uuid4().hex[:12]


def get_logger(name: str = "patient-intake") -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)