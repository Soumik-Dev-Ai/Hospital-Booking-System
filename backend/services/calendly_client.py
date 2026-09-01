import httpx
from datetime import datetime, timezone, timedelta

from core.config import settings
from core.logging import get_logger
from core.circuit_breaker import calendly_breaker

logger = get_logger(__name__)

CALENDLY_API_BASE = "https://api.calendly.com"


class CalendlyClient:
    def __init__(self):
        self.client_id = settings.calendly_client_id
        self.client_secret = settings.calendly_client_secret
        self._token: str | None = None
        self._token_expires_at: datetime | None = None

    async def _get_token(self) -> str:
        if self._token and self._token_expires_at and datetime.now(timezone.utc) < self._token_expires_at:
            return self._token

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{CALENDLY_API_BASE}/oauth/token",
                json={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "client_credentials",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            self._token = data["access_token"]
            self._token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 3600))
            return self._token

    async def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        token = await self._get_token()
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {token}"
        headers.setdefault("Content-Type", "application/json")
        url = path if path.startswith("http") else f"{CALENDLY_API_BASE}{path}"
        async with httpx.AsyncClient() as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            return resp

    async def cancel_event(self, event_uuid: str, reason: str = "Non-compliant with intake policy") -> dict:
        async def _inner() -> dict:
            resp = await self._request(
                "DELETE",
                f"/scheduled_events/{event_uuid}",
                json={"reason": reason},
            )
            resp.raise_for_status()
            logger.info("calendly_event_cancelled", event_uuid=event_uuid)
            return resp.json() if resp.content else {}
        return await calendly_breaker.call(_inner)

    async def get_event(self, event_uuid: str) -> dict | None:
        resp = await self._request("GET", f"/scheduled_events/{event_uuid}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()


calendly_client = CalendlyClient()
