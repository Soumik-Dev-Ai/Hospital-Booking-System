from datetime import date as date_type

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.security import require_doctor
from models import DailyBriefing
from schemas.schemas import DailyBriefingOut, PaginatedResponse

router = APIRouter(prefix="/api/briefings", tags=["briefings"])


@router.get("", response_model=PaginatedResponse)
async def list_briefings(
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_email: str = Depends(require_doctor),
):
    query = select(DailyBriefing)
    count_query = select(func.count(DailyBriefing.id))
    if from_date:
        d = date_type.fromisoformat(from_date)
        query = query.where(DailyBriefing.date >= d)
        count_query = count_query.where(DailyBriefing.date >= d)
    if to_date:
        d = date_type.fromisoformat(to_date)
        query = query.where(DailyBriefing.date <= d)
        count_query = count_query.where(DailyBriefing.date <= d)

    total = await db.scalar(count_query)
    query = query.order_by(DailyBriefing.date.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = [DailyBriefingOut.model_validate(b) for b in result.scalars().all()]
    return PaginatedResponse(items=items, total=total or 0, page=page, page_size=page_size)


@router.get("/{briefing_date}", response_model=DailyBriefingOut)
async def get_briefing(
    briefing_date: str,
    db: AsyncSession = Depends(get_db),
    user_email: str = Depends(require_doctor),
):
    d = date_type.fromisoformat(briefing_date)
    result = await db.execute(select(DailyBriefing).where(DailyBriefing.date == d))
    briefing = result.scalar_one_or_none()
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    return DailyBriefingOut.model_validate(briefing)