import asyncio
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import require_admin
from models import DailyBriefing
from schemas.schemas import PaginatedResponse, DailyBriefingOut

router = APIRouter(prefix="/api/cron", tags=["cron"])


@router.post("/trigger")
async def trigger_cron(
    background_tasks: BackgroundTasks,
    staff: dict = Depends(require_admin),
):
    script_path = Path(__file__).parent.parent / "cron_enforcement.py"
    background_tasks.add_task(_run_enforcement_script, str(script_path))
    return {"status": "triggered", "message": "Enforcement worker started in background"}


@router.get("/history", response_model=PaginatedResponse)
async def cron_history(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    query = select(DailyBriefing).order_by(DailyBriefing.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = [DailyBriefingOut.model_validate(b) for b in result.scalars().all()]
    return PaginatedResponse(items=items, total=len(items), page=page, page_size=page_size)


def _run_enforcement_script(script_path: str):
    try:
        result = subprocess.run(
            [sys.executable, script_path, "--now"],
            capture_output=True,
            text=True,
            timeout=300,
            cwd=str(Path(script_path).parent),
        )
        if result.returncode != 0:
            import structlog
            logger = structlog.get_logger("cron.trigger")
            logger.error("cron_trigger_failed", stderr=result.stderr[:1000])
    except Exception as e:
        import structlog
        logger = structlog.get_logger("cron.trigger")
        logger.error("cron_trigger_exception", error=str(e))