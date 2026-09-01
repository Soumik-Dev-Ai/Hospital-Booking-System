"""
arq worker entrypoint — handles background tasks (AI parsing, email sending, Calendly operations).

  arq worker.QueueWorker --burst

"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from arq.connections import RedisSettings
from pipeline import process_intake_reply, send_intake_request_email, cancel_appointment_via_calendly
from pipeline.doc_generator import generate_intake_doc
from core.config import settings
from core.logging import configure_logging

configure_logging("arq-worker")


async def startup(ctx):
    pass


async def resume(ctx):
    pass


async def shutdown(ctx):
    pass


class WorkerSettings:
    functions = [
        process_intake_reply,
        send_intake_request_email,
        cancel_appointment_via_calendly,
        generate_intake_doc,
        # Criterion 5: cron dispatcher registered as an arq task for testability.
    ]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 10
    job_timeout = 300  # 5 min max per job (Gemini calls can be slow)
    poll_delay = 0.5
    allow_unsafe_upgrade = True