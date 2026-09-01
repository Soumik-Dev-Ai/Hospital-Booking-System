"""JWT authentication utilities."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from redis import asyncio as redis_async
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config.settings import settings
from database import get_db
from database.models import User, UserRole, QuarantinedUser
from database.schemas import LoginRequest, LoginResponse

logger = logging.getLogger(__name__)

security = HTTPBearer()

# ---------------------------------------------------------------------------
# Redis-backed JWT blacklist
#
# Logged-out (and otherwise revoked) tokens are stored under a `jti` key with
# a TTL equal to the token's remaining lifetime, so a hijacked or stale token
# fails the instant it is blacklisted instead of lingering until expiry.
# Redis is a hard dependency of the deployment (docker-compose) but the client
# degrades gracefully: if Redis is unreachable the blacklist is skipped and
# the token simply lives out its natural expiry.
# ---------------------------------------------------------------------------

_BLACKLIST_PREFIX = "jwt:blacklist:"
_redis_client = None
_redis_unavailable = False


def _get_redis():
    """Return the lazy shared Redis client, or None when unavailable."""
    global _redis_client, _redis_unavailable
    if _redis_unavailable:
        return None
    if _redis_client is None:
        _redis_client = redis_async.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
    return _redis_client


async def is_token_revoked(jti: Optional[str]) -> bool:
    """True when the JWT id is currently blacklisted."""
    if not jti:
        return False
    client = _get_redis()
    if client is None:
        return False
    try:
        return bool(await client.get(f"{_BLACKLIST_PREFIX}{jti}"))
    except Exception as exc:  # pragma: no cover - depends on redis availability
        logger.warning("Redis blacklist lookup failed: %s", exc)
        return False


async def revoke_token(token: str) -> bool:
    """Blacklist a JWT until its natural expiration. Returns True on success."""
    try:
        payload = decode_access_token(token)
    except HTTPException:
        return False

    jti = payload.get("jti")
    if not jti:
        return False

    exp = payload.get("exp")
    ttl = (
        max(int(exp - datetime.now(timezone.utc).timestamp()), 1)
        if exp
        else settings.access_token_expire_minutes * 60
    )

    client = _get_redis()
    if client is None:
        logger.warning("Redis unavailable: cannot blacklist token %s", jti[:8])
        return False
    try:
        await client.set(f"{_BLACKLIST_PREFIX}{jti}", "1", ex=ttl)
        logger.info("Token %s blacklisted for %ss", jti[:8], ttl)
        return True
    except Exception as exc:  # pragma: no cover - depends on redis availability
        logger.warning("Redis blacklist write failed for %s: %s", jti[:8], exc)
        return False


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(plaintext: str) -> str:
    """Hash a password with bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plaintext.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plaintext: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(
        plaintext.encode("utf-8"),
        hashed.encode("utf-8"),
    )


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def create_access_token(
    *,
    user_id: UUID,
    role: UserRole,
    extra: Optional[dict] = None,
) -> str:
    """Create a JWT containing the user's role and a unique jti (used for
    Redis blacklisting on logout)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role.value,
        "jti": uuid4().hex,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT. Raises on any failure."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )
    return payload


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the Authorization header."""
    token = credentials.credentials
    payload = decode_access_token(token)

    if await is_token_revoked(payload.get("jti")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    subject = str(payload.get("sub", ""))
    try:
        user_id = UUID(subject)
        query = select(User).where(User.id == user_id)
    except ValueError:
        query = select(User).where(User.email == subject.lower())
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    if user.is_quarantined:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is quarantined",
        )

    return user


def require_role(
    *required_roles: UserRole,
):
    """Dependency factory — restricts an endpoint to specific roles."""
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {[r.value for r in required_roles]}",
            )
        return user
    return _checker


async def login(request: LoginRequest, db: AsyncSession) -> LoginResponse:
    """Authenticate and return a JWT with role injection."""
    result = await db.execute(
        select(User).where(User.email == request.email.lower())
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    if user.is_quarantined:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is quarantined",
        )

    token = create_access_token(user_id=user.id, role=user.role)
    return LoginResponse(
        access_token=token,
        role=user.role.value,
        user_id=user.id,
        full_name=user.full_name,
    )


async def logout(token: str) -> dict:
    """Blacklist the presented JWT so it fails immediately on any reuse."""
    revoked = await revoke_token(token)
    return {
        "message": "Signed out. Token revoked until natural expiry.",
        "revoked": revoked,
    }


async def forgot_password(email: str, db: AsyncSession) -> dict:
    """Stub: in production this sends a magic link via email."""
    result = await db.execute(
        select(User).where(User.email == email.lower())
    )
    user = result.scalar_one_or_none()

    if user and user.is_active:
        logger.info("Magic link dispatched for %s", user.email)
        # TODO: send actual magic link via SES/SendGrid
    else:
        logger.info("Magic link request for unknown email: %s", email)

    # Always return the same response to prevent email enumeration
    return {"message": "If the email exists in our system, a magic link has been sent."}



