import os
import logging, uuid, time, math
from collections import defaultdict
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from config.settings import settings

logger = logging.getLogger(__name__)

class UnifiedSecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._buckets = defaultdict(list)
        self._violations = defaultdict(int)
        
    def _get_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        # 1. Attachment Stripping for webhooks
        if "/webhooks" in path:
            ctype = request.headers.get("content-type", "").lower()
            if ctype in {"application/pdf", "application/x-executable", "application/octet-stream", "application/zip"}:
                return JSONResponse(status_code=400, content={"detail": "Attachments dropped"})

        # 2. Rate Limiting with Exponential Backoff
        if path not in {"/docs", "/openapi.json", "/redoc", "/favicon.ico"}:
            ip = self._get_ip(request)
            is_auth = path.startswith(("/api/v1/auth/login", "/api/v1/auth/forgot-password"))
            is_public = path.startswith("/api/v1/public/")
            
            # Limits based on tier (fallback defaults if not in env)
            max_req = int(os.getenv("RATE_LIMIT_AUTH", 5)) if is_auth else (int(os.getenv("RATE_LIMIT_PUBLIC", 30)) if is_public else int(os.getenv("RATE_LIMIT_GENERAL", 100)))
            window = 60
            
            now = time.monotonic()
            key = f"{ip}:{path.split('/')[3] if len(path.split('/')) > 3 else 'root'}"
            
            timestamps = self._buckets[key]
            timestamps[:] = [t for t in timestamps if t > now - window]
            
            if len(timestamps) >= max_req:
                if is_auth:
                    self._violations[ip] += 1
                    backoff = min((2.0 ** self._violations[ip]), 300)
                    retry_after = int(backoff)
                else:
                    retry_after = max(1, int(timestamps[0] + window - now))
                return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"}, headers={"Retry-After": str(retry_after)})
            
            if is_auth and ip in self._violations:
                self._violations[ip] = max(0, self._violations[ip] - 1)
            timestamps.append(now)

        # 3. Process Request
        trace_id = str(uuid.uuid4())
        request.state.trace_id = trace_id
        response = await call_next(request)
        
        # 4. Security Headers
        response.headers["x-trace-id"] = trace_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # 5. No-store cache
        if path.startswith("/api/v1") and not path.startswith("/api/v1/public/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            
        return response

def setup_security_middleware(app: FastAPI):
    app.add_middleware(UnifiedSecurityMiddleware)
