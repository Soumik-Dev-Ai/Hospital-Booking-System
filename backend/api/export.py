"""
api/export.py — Optional CSV/spreadsheet export of the appointment intake ledger.

Surfaces the relational store in a doctor-friendly spreadsheet form, addressing the
'Google Sheets frontend' requirement from the original PRD without reintroducing
live Sheets as the system of record (per build prompt §2 Note on storage).
"""
import csv
import io
import json
from datetime import datetime, timezone, date

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_admin
from models import Appointment, Patient, IntakeSubmission, AppointmentStatus, AuditLog
from core.logging import get_logger

router = APIRouter(prefix="/api/export", tags=["export"])
logger = get_logger("api.export")


@router.get("/appointments.csv")
async def export_appointments_csv(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    """Download today's (or a date-range) appointment ledger as CSV — including patient demographics,
    appointment status, intake score, missing fields, and the Doc URL when present.
    The doctor can open this in Excel/Google Sheets for a spreadsheet-style dashboard view."""
    query = (
        select(Appointment)
        .order_by(Appointment.scheduled_at.asc())
    )
    if from_date:
        query = query.where(Appointment.scheduled_at >= datetime.fromisoformat(from_date))
    if to_date:
        query = query.where(Appointment.scheduled_at <= datetime.fromisoformat(to_date))

    result = await db.execute(query)
    appointments = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "appointment_id", "calendly_event_uuid", "scheduled_at",
        "patient_name", "patient_email", "patient_phone",
        "status", "completeness_score", "missing_fields", "summary_doc_url",
        "warning_sent_at", "reminder_sent_at", "auto_cancelled_at",
    ])
    for apt in appointments:
        await db.refresh(apt, ["patient", "intake_submission"])
        patient = apt.patient
        intake = apt.intake_submission
        missing = ",".join(intake.missing_fields) if intake and intake.missing_fields else ""
        score = intake.completeness_score if intake else ""
        doc_url = intake.summary_doc_url if intake else ""
        writer.writerow([
            str(apt.id),
            apt.calendly_event_uuid,
            apt.scheduled_at.isoformat() if apt.scheduled_at else "",
            patient.full_name if patient else "",
            patient.email if patient else "",
            patient.phone if patient else "",
            apt.status.value if apt.status else "",
            score,
            missing,
            doc_url,
            apt.warning_sent_at.isoformat() if apt.warning_sent_at else "",
            apt.reminder_sent_at.isoformat() if apt.reminder_sent_at else "",
            apt.auto_cancelled_at.isoformat() if apt.auto_cancelled_at else "",
        ])

    today_stamp = date.today().isoformat()
    headers = {
        "Content-Disposition": f'attachment; filename="patient_intake_{today_stamp}.csv"',
    }
    logger.info("csv_exported", user=staff["email"], row_count=len(appointments))
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)


@router.get("/audit.csv")
async def export_audit_csv(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    """Download full administrative & clinical audit trail as CSV."""
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if from_date:
        query = query.where(AuditLog.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        query = query.where(AuditLog.created_at <= datetime.fromisoformat(to_date))

    result = await db.execute(query)
    logs = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp", "Actor Type", "Action", "Entity Type", "Entity ID", "Details"])
    for l in logs:
        actor = l.actor_type.value if hasattr(l.actor_type, "value") else str(l.actor_type or "")
        det_str = json.dumps(l.details) if l.details else ""
        writer.writerow([
            str(l.id),
            l.created_at.isoformat() if l.created_at else "",
            actor,
            l.action or "",
            l.entity_type or "",
            str(l.entity_id or ""),
            det_str,
        ])

    today_stamp = date.today().isoformat()
    headers = {
        "Content-Disposition": f'attachment; filename="aurelis_audit_trail_{today_stamp}.csv"',
    }
    logger.info("audit_csv_exported", user=staff["email"], count=len(logs))
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)
