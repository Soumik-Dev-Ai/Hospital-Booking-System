"""pipeline package — re-exports core background-task functions.

This package was created to satisfy legacy imports from worker.py and
background/__init__.py after the codebase was reorganized.
"""
from pipeline.notifications import send_intake_request_email
from pipeline.ai_parser import process_intake_reply
from pipeline.enforcement_actions import cancel_appointment_via_calendly
from pipeline.doc_generator import generate_intake_doc

__all__ = [
    "process_intake_reply",
    "send_intake_request_email",
    "cancel_appointment_via_calendly",
    "generate_intake_doc",
]
