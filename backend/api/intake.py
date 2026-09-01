import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import require_admin
from core.encryption import decrypt_text, decrypt_json
from models import IntakeSubmission, AuditLog, ActorType
from schemas.schemas import IntakeSubmissionOut

router = APIRouter(prefix="/api/intake", tags=["intake"])


@router.get("/{appointment_id}", response_model=IntakeSubmissionOut)
async def get_intake(
    appointment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(
        select(IntakeSubmission).where(IntakeSubmission.appointment_id == appointment_id)
    )
    intake = result.scalar_one_or_none()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    # AuditLog on clinical data access (spec A.6).
    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type=ActorType.DOCTOR,
        action="READ_INTAKE",
        entity_type="Appointment",
        entity_id=appointment_id,
        details={"by": staff["email"]},
    ))
    await db.commit()

    out = IntakeSubmissionOut.model_validate(intake)
    out.raw_reply_text = decrypt_text(intake.raw_reply_text)
    out.structured_summary = decrypt_json(intake.structured_summary)
    return out
