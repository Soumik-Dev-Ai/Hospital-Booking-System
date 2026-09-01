"""
background/__init__.py — FastAPI BackgroundTasks-compatible wrappers (spec A.1).

These are the Plan A required dispatch methods: thin coroutines that the webhook
handlers fire via `background_tasks.add_task(...)`. They import and call the
core logic from `pipeline/` directly, skipping the arq queue completely.

This BackgroundTasks path is the sole dispatch mechanism. The arq-based queue
jobs in `pipeline/` (worker.py) remain as the documented optional upgrade path
(durable retries, dead-letter, burst workers) for later deployment.
"""
import asyncio

from core.logging import get_logger

logger = get_logger("background")


async def send_intake_request_email_bg(appointment_id: str, correlation_id: str = ""):
    """Direct-call wrapper. Identical logic to pipeline/notifications.send_intake_request_email
    but without the arq `ctx` parameter so it can be used via BackgroundTasks.add_task()."""
    from pipeline.notifications import send_intake_request_email
    await send_intake_request_email(None, appointment_id, correlation_id)


async def process_intake_reply_bg(appointment_id: str, raw_reply_text: str, correlation_id: str = ""):
    """Direct-call wrapper for pipeline/ai_parser.process_intake_reply."""
    from pipeline.ai_parser import process_intake_reply
    await process_intake_reply(None, appointment_id, raw_reply_text, correlation_id)


async def cancel_appointment_via_calendly_bg(appointment_id: str):
    """Direct-call wrapper for pipeline/enforcement_actions.cancel_appointment_via_calendly."""
    from pipeline.enforcement_actions import cancel_appointment_via_calendly
    await cancel_appointment_via_calendly(None, appointment_id)
