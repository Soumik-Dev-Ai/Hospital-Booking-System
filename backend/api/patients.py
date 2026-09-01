import uuid

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.security import require_admin
from models import Patient
from schemas.schemas import PatientOut, PaginatedResponse

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=PaginatedResponse)
async def list_patients(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    query = select(Patient)
    count_query = select(func.count(Patient.id))
    if search:
        filter_clause = (Patient.full_name.ilike(f"%{search}%")) | (Patient.email.ilike(f"%{search}%"))
        query = query.where(filter_clause)
        count_query = count_query.where(filter_clause)

    total = await db.scalar(count_query)
    query = query.order_by(Patient.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = [PatientOut.model_validate(p) for p in result.scalars().all()]

    return PaginatedResponse(items=items, total=total or 0, page=page, page_size=page_size)


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return PatientOut.model_validate(patient)