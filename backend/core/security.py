import uuid
import hmac
import hashlib
import time
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Request, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_bearer = HTTPBearer()


def verify_calendly_webhook(body: bytes, signature_header: str, timestamp_header: str, tolerance_seconds: int = 300) -> bool:
    """Verify Calendly webhook HMAC-SHA256 signature. NEVER bypasses — caller must gate on whether the signing
    key is configured (the webhook handler raises 503 if CALendly_WEBHOOK_SIGNING_KEY is unset)."""
    if not settings.calendly_webhook_signing_key:
        # Defensive: if the signing key is unset, verifier refuses rather than bypassing.
        # The webhook handler is responsible for surfacing this as a 503 BEFORE calling here.
        return False
    try:
        ts = int(timestamp_header)
        now_ts = int(time.time())
        if abs(now_ts - ts) > tolerance_seconds:
            return False
        payload = f"{ts}.{body.decode('utf-8')}"
        expected = hmac.new(
            settings.calendly_webhook_signing_key.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        # Calendly sends signature as a comma-separated list (e.g. "t=...,v1=...") — extract v1=...
        sig = None
        for part in signature_header.split(","):
            part = part.strip()
            if part.startswith("v1="):
                sig = part[3:]
                break
        if sig is None:
            return False
        return hmac.compare_digest(expected, sig)
    except Exception:
        return False


def verify_pubsub_token(authorization_header: str | None) -> bool:
    # Gmail Pub/Sub push: verify OIDC token from Google, restrict to expected audience.
    if not authorization_header or not authorization_header.startswith("Bearer "):
        return False
    token_str = authorization_header[len("Bearer "):]
    try:
        req = google_requests.Request()
        payload = id_token.verify_oauth2_token(token_str, req, audience=settings.gmail_push_audience)
        expected_issuers = ["accounts.google.com", "https://accounts.google.com"]
        if payload.get("iss") not in expected_issuers:
            return False
        if payload.get("email") != settings.gmail_push_service_account_email:
            return False
        return True
    except Exception:
        return False


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes))
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


async def is_token_blacklisted(token: str) -> bool:
    """Check if a JWT's jti has been blacklisted in Redis."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        jti = payload.get("jti")
        if not jti:
            return False
        from core.redis_client import get_redis
        redis = await get_redis()
        return bool(await redis.get(f"blacklist:{jti}"))
    except Exception:
        return False  # Redis down = graceful degradation


async def blacklist_token(token: str) -> None:
    """Add a JWT to the Redis blacklist with TTL matching its remaining lifetime."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        jti = payload.get("jti")
        if not jti:
            return
        exp = payload.get("exp", 0)
        ttl = max(int(exp - datetime.now(timezone.utc).timestamp()), 1)
        from core.redis_client import get_redis
        redis = await get_redis()
        await redis.setex(f"blacklist:{jti}", ttl, "1")
    except Exception:
        pass  # Redis down = best-effort


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> str:
    payload = verify_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if await is_token_blacklisted(credentials.credentials):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
    user_email = payload.get("sub")
    if not user_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return user_email


async def require_doctor(user_email: str = Depends(get_current_user)) -> str:
    if user_email != settings.doctor_email:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return user_email


# ---- Multi-Role JWT (patient / doctor / admin) ----

def create_staff_access_token(subject: str, role: str, doctor_id: str | None = None,
                              expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes))
    to_encode = {"sub": subject, "role": role, "exp": expire, "jti": str(uuid.uuid4())}
    if doctor_id:
        to_encode["doctor_id"] = doctor_id
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_patient_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes))
    to_encode = {"sub": subject, "role": "patient", "exp": expire, "jti": str(uuid.uuid4())}
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


async def get_current_staff(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
) -> dict:
    payload = verify_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if await is_token_blacklisted(credentials.credentials):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
    role = payload.get("role")
    if role not in ("doctor", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff role required")
    user_email = payload.get("sub")
    if not user_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return {
        "email": user_email,
        "role": role,
        "doctor_id": payload.get("doctor_id"),
    }


async def require_admin(staff: dict = Depends(get_current_staff)) -> dict:
    if staff["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return staff


async def require_staff_doctor(staff: dict = Depends(get_current_staff)) -> dict:
    if staff["role"] != "doctor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor role required")
    if not staff.get("doctor_id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor profile not linked")
    return staff


async def get_current_patient(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
) -> str:
    payload = verify_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if await is_token_blacklisted(credentials.credentials):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
    if payload.get("role") != "patient":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient role required")
    user_email = payload.get("sub")
    if not user_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return user_email