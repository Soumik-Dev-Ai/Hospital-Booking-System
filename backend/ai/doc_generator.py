"""
queue/doc_generator.py — Optional background job that generates a Google Doc per intake
and writes its URL back to `IntakeSubmission.summary_doc_url`.

This is an OPTIONAL per-patient export artifact (see build prompt §2 "Note on storage").
Postgres remains the system of record; the Doc is a human-readable convenience for the doctor.
"""
import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import IntakeSubmission, Appointment, Patient
from core.database import async_session_factory
from core.logging import get_logger
from core.config import settings
from core.encryption import decrypt_json

logger = get_logger("pipeline.doc_generator")


def _format_intake_text(submission: IntakeSubmission, appointment: Appointment, patient: Patient) -> str:
    """Build a plain-text body for the Doc. (Production would use the Docs API; this keeps the
    surface minimal so a non-Google-Workspace deployment still works.)"""
    s = decrypt_json(submission.structured_summary)
    lines = [
        f"Patient Intake Summary — {settings.clinic_name}",
        f"Patient: {patient.full_name} ({patient.email})",
        f"Appointment: {appointment.scheduled_at.isoformat()}",
        f"Generated: {submission.ai_processed_at.isoformat()}",
        f"AI model: {submission.ai_model_version}",
        f"Completeness: {submission.completeness_score}%",
        "",
        "=" * 50,
        "Chief Complaint:",
        s.get("chief_complaint", "[Not provided]"),
        "",
        "Current Medications:",
        "\n".join("  - " + m for m in s.get("current_medications", [])) or "  [Not provided]",
        "",
        "Allergies:",
        "\n".join("  - " + a for a in s.get("allergies", [])) or "  [Not provided]",
        "",
        "Past Medical History:",
        s.get("past_medical_history", "[Not provided]"),
        "",
        "Past Surgical History:",
        s.get("past_surgical_history", "[Not provided]"),
        "",
        "Family History:",
        s.get("family_history", "[Not provided]"),
        "",
        "Social History:",
        s.get("social_history", "[Not provided]"),
        "",
        "Additional Notes:",
        s.get("additional_notes", "[Not provided]"),
        "",
        "Missing Fields:",
        "\n".join("  - " + f for f in (submission.missing_fields or [])) or "  (none)",
    ]
    return "\n".join(lines)


async def generate_intake_doc(ctx, intake_submission_id: str):
    """Optional Google Doc generation. If Google Docs credentials aren't configured (no AppBaseURL doc settings),
    fall back to logging and leave summary_doc_url NULL — the dashboard still shows the Postgres-stored summary."""
    sess: AsyncSession = async_session_factory()
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        result = await sess.execute(
            select(IntakeSubmission).where(IntakeSubmission.id == intake_submission_id)
        )
        submission = result.scalar_one_or_none()
        if not submission:
            logger.warning("doc_gen_skip_not_found", intake_submission_id=intake_submission_id)
            return
        if submission.summary_doc_url:
            logger.info("doc_gen_skip_already_built", intake_submission_id=intake_submission_id)
            return

        await sess.refresh(submission, ["appointment"])
        appointment = submission.appointment
        if not appointment:
            return
        await sess.refresh(appointment, ["patient"])
        patient = appointment.patient
        if not patient:
            return

        body_text = _format_intake_text(submission, appointment, patient)
        title = f"Intake — {patient.full_name} — {appointment.scheduled_at.strftime('%Y-%m-%d')}"

        # Build the Docs service. Note: a real deployment needs Docs API scopes in the OAuth flow;
        # for now we make this a benign optional feature that fails softly.
        try:
            creds = Credentials(
                token=None,
                refresh_token=settings.gmail_refresh_token,  # reuses the same OAuth token
                token_uri="https://oauth2.googleapis.com/token",
                client_id=settings.gmail_client_id,
                client_secret=settings.gmail_client_secret,
                scopes=["https://www.googleapis.com/auth/documents"],
            )
            loop = asyncio.get_event_loop()
            service = await loop.run_in_executor(None, lambda: build("docs", "v1", credentials=creds, cache_discovery=False))
            create_resp = await loop.run_in_executor(
                None,
                lambda: service.documents().create(body={"title": title}).execute(),
            )
            doc_id = create_resp.get("documentId")
            if not doc_id:
                logger.error("doc_gen_create_no_id", intake_submission_id=intake_submission_id)
                return

            # Insert the intake text as a single batchUpdate with one InsertTextRequest
            requests = [
                {
                    "insertText": {
                        "location": {"index": 1},
                        "text": body_text,
                    }
                }
            ]
            await loop.run_in_executor(
                None,
                lambda: service.documents().batchUpdate(documentId=doc_id, body={"requests": requests}).execute(),
            )

            doc_url = f"https://docs.google.com/document/d/{doc_id}/edit"

            # ---- Share the doc with the doctor (A.6: "shared only with necessary
            # service account / doctor account"). Without this step the doctor
            # receives a link to a document they cannot open.
            try:
                drive_service = await loop.run_in_executor(
                    None,
                    lambda: build("drive", "v3", credentials=creds, cache_discovery=False),
                )
                permission_body = {
                    "type": "user",
                    "role": "reader",
                    "emailAddress": settings.doctor_email,
                }
                await loop.run_in_executor(
                    None,
                    lambda: drive_service.permissions()
                    .create(fileId=doc_id, body=permission_body, transferOwnership=False)
                    .execute(),
                )
                logger.info(
                    "doc_shared_with_doctor",
                    intake_submission_id=intake_submission_id,
                    doctor_email=settings.doctor_email,
                )
            except Exception as share_err:
                # Sharing failure is a recoverable degradation — the doc still
                # exists and the URL is returned, the doctor just may need a
                # manual share from the service account owner. Log loudly.
                logger.warning(
                    "doc_share_failed_recoverable",
                    intake_submission_id=intake_submission_id,
                    doctor_email=settings.doctor_email,
                    error=str(share_err),
                )

            submission.summary_doc_url = doc_url
            await sess.commit()
            logger.info("doc_gen_success", intake_submission_id=intake_submission_id, doc_url=doc_url)
        except Exception as e:
            logger.warning("doc_gen_failed_optional", intake_submission_id=intake_submission_id, error=str(e))
    finally:
        await sess.close()