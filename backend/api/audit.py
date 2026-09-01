from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime

from core.database import get_db
from core.security import require_admin
from models import AuditLog
from schemas.schemas import AuditLogOut, PaginatedResponse

router = APIRouter(prefix="/api/audit-log", tags=["audit"])


@router.get("", response_model=PaginatedResponse)
async def list_audit_logs(
    entity_type: str | None = Query(None),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    if from_date:
        query = query.where(AuditLog.created_at >= datetime.fromisoformat(from_date))
        count_query = count_query.where(AuditLog.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        query = query.where(AuditLog.created_at <= datetime.fromisoformat(to_date))
        count_query = count_query.where(AuditLog.created_at <= datetime.fromisoformat(to_date))

    total = await db.scalar(count_query)
    query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = [AuditLogOut.model_validate(a) for a in result.scalars().all()]
    return PaginatedResponse(items=items, total=total or 0, page=page, page_size=page_size)