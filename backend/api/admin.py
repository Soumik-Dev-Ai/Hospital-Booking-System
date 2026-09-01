"""api/admin.py — Admin-scoped routes (role == "admin")."""
import asyncio
import uuid
import time
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from core.database import get_db, engine
from core.security import require_admin, hash_password
from core.config import settings
from core.logging import get_logger
from models import (
    StaffUser, StaffRole, Doctor,
    WebhookEvent, GmailWatchState, DailyBriefing,
    AuditLog, ActorType, IntakeSubmission,
)
from schemas.schemas import (
    StaffUserOut, StaffUserCreateRequest, StaffUserUpdateRequest,
    DoctorOut, DoctorCreateRequest, DoctorUpdateRequest,
    SystemHealthOut, CronRunOut,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = get_logger("api.admin")

_health_cache_value: SystemHealthOut | None = None
_health_cache_ts: float = 0


# ── Staff Users CRUD ────────────────────────────────────────────────

@router.get("/staff-users", response_model=list[StaffUserOut])
async def list_staff_users(
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(StaffUser).order_by(StaffUser.created_at.desc()))
    return [StaffUserOut.model_validate(u) for u in result.scalars().all()]


@router.post("/staff-users", response_model=StaffUserOut, status_code=201)
async def create_staff_user(
    body: StaffUserCreateRequest,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    role_str = body.role.upper()
    if role_str not in StaffRole.__members__:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role_str}")
    role = StaffRole(role_str)
    if role == StaffRole.DOCTOR and not body.doctor_id:
        raise HTTPException(status_code=400, detail="doctor_id required for DOCTOR role")

    existing = await db.execute(
        select(StaffUser).where(StaffUser.email == body.email.strip().lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")

    user = StaffUser(
        id=uuid.uuid4(),
        email=body.email.strip().lower(),
        password_hash=hash_password(body.password),
        role=role,
        doctor_id=body.doctor_id,
        full_name=body.full_name,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.add(AuditLog(
        id=uuid.uuid4(),
        actor_type="ADMIN",
        action="CREATE_STAFF_USER",
        entity_type="StaffUser",
        entity_id=user.id,
        details={"by": staff["email"], "role": body.role, "email": body.email},
    ))
    await db.commit()
    await db.refresh(user)
    return StaffUserOut.model_validate(user)


@router.put("/staff-users/{user_id}", response_model=StaffUserOut)
async def update_staff_user(
    user_id: uuid.UUID,
    body: StaffUserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(StaffUser).where(StaffUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    if body.role is not None:
        user.role = StaffRole(body.role.upper())
    if body.doctor_id is not None:
        user.doctor_id = body.doctor_id
    if body.full_name is not None:
        user.full_name = body.full_name
    await db.commit()
    await db.refresh(user)
    return StaffUserOut.model_validate(user)


@router.delete("/staff-users/{user_id}")
async def delete_staff_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(StaffUser).where(StaffUser.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(user)
    await db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------
#  Doctors CRUD (public profile entity)
# ---------------------------------------------------------------

@router.get("/doctors", response_model=list[DoctorOut])
async def list_doctors(
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(Doctor).order_by(Doctor.full_name))
    return [DoctorOut.model_validate(d) for d in result.scalars().all()]


@router.post("/doctors", response_model=DoctorOut, status_code=201)
async def create_doctor(
    body: DoctorCreateRequest,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    existing = await db.execute(
        select(Doctor).where(Doctor.email == body.email.strip().lower())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")
    doctor = Doctor(
        id=uuid.uuid4(),
        full_name=body.full_name,
        specialty=body.specialty,
        bio=body.bio,
        price_per_visit=body.price_per_visit,
        email=body.email.strip().lower(),
        calendly_event_type_uri=body.calendly_event_type_uri,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(doctor)
    await db.commit()
    await db.refresh(doctor)
    return DoctorOut.model_validate(doctor)


@router.put("/doctors/{doctor_id}", response_model=DoctorOut)
async def update_doctor(
    doctor_id: uuid.UUID,
    body: DoctorUpdateRequest,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Not found")
    for field in ("full_name", "specialty", "bio", "calendly_event_type_uri"):
        v = getattr(body, field, None)
        if v is not None:
            setattr(doctor, field, v)
    if body.price_per_visit is not None:
        doctor.price_per_visit = body.price_per_visit
    if body.email is not None:
        doctor.email = body.email.strip().lower()
    doctor.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(doctor)
    return DoctorOut.model_validate(doctor)


@router.delete("/doctors/{doctor_id}")
async def delete_doctor(
    doctor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(doctor)
    await db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------
#  System Health (aggregate, 30s cache)
# ---------------------------------------------------------------

async def _build_system_health(db: AsyncSession) -> SystemHealthOut:
    now_utc = datetime.now(timezone.utc)
    day_ago = now_utc - timedelta(hours=24)
    week_ago = now_utc - timedelta(days=7)

    calendly_configured = bool(settings.calendly_webhook_signing_key and settings.calendly_organization_url)
    c24_proc = await db.scalar(
        select(func.count(WebhookEvent.id)).where(
            WebhookEvent.source == "calendly",
            WebhookEvent.processed_at >= day_ago,
        )
    )
    c24_fail = await db.scalar(
        select(func.count(WebhookEvent.id)).where(
            WebhookEvent.source == "calendly",
            WebhookEvent.processed_at >= day_ago,
            WebhookEvent.error_message.isnot(None),
        )
    )

    watch_result = await db.execute(
        select(GmailWatchState).order_by(GmailWatchState.renewed_at.desc()).limit(1)
    )
    watch = watch_result.scalar_one_or_none()
    watch_active = watch is not None and watch.watch_expiration > now_utc

    postgres_ok = False
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        postgres_ok = True
    except Exception as e:
        logger.error("pg_health_fail", error=str(e))

    from services.ai_provider import get_all_providers_health
    provider_health = await get_all_providers_health()
    dist_result = await db.execute(
        select(IntakeSubmission.ai_provider, func.count(IntakeSubmission.id).label("cnt"))
        .where(IntakeSubmission.ai_processed_at >= week_ago)
        .group_by(IntakeSubmission.ai_provider)
    )
    ai_dist: dict[str, int] = {}
    for row in dist_result:
        ai_dist[row.ai_provider or "unknown"] = row.cnt

    from core.sheets_state import get_sheets_sync_state
    sync_state = get_sheets_sync_state()

    # Criterion 6: include in-memory HTTP metrics in system-health.
    from core.metrics import metrics
    http_summary = metrics.summary()

    cron_result = await db.execute(
        select(DailyBriefing).order_by(DailyBriefing.created_at.desc()).limit(5)
    )
    cron_runs = [
        CronRunOut(
            id=b.id, date=b.date, created_at=b.created_at,
            status="sent" if b.sent_at else "pending",
        )
        for b in cron_result.scalars().all()
    ]

    # Criterion 5: include Gmail watch health from gmail_watch_renewal module.
    from jobs.gmail_watch_renewal import check_watch_health
    watch_health = await check_watch_health(db)

    return SystemHealthOut(
        calendly_webhook_configured=calendly_configured,
        calendly_24h_processed=c24_proc or 0,
        calendly_24h_failed=c24_fail or 0,
        gmail_watch_active=watch_active,
        gmail_watch_expiration=watch.watch_expiration if watch else None,
        postgres_connected=postgres_ok,
        ai_openrouter=provider_health.get("openrouter", "not-configured"),
        ai_nim=provider_health.get("nvidia_nim", "not-configured"),
        ai_groq=provider_health.get("groq", "not-configured"),
        ai_cerebras=provider_health.get("cerebras", "not-configured"),
        ai_provider_distribution=ai_dist,
        last_sheets_sync_at=sync_state["at"],
        last_sheets_sync_ok=sync_state["ok"],
        last_sheets_sync_error=sync_state["error"],
        recent_cron_runs=cron_runs,
        http_metrics=http_summary,
        gmail_watch_health=watch_health,
    )


@router.get("/system-health", response_model=SystemHealthOut)
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    staff: dict = Depends(require_admin),
):
    global _health_cache_value, _health_cache_ts
    now = time.monotonic()
    if _health_cache_value and (now - _health_cache_ts) < 30:
        return _health_cache_value
    result = await _build_system_health(db)
    _health_cache_value = result
    _health_cache_ts = now
    return result