import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from core.security import verify_access_token
from core.logging import get_logger

router = APIRouter(tags=["live"])
logger = get_logger("api.lives")

_active_connections: list[WebSocket] = []


async def broadcast_event(event_type: str, data: dict):
    message = json.dumps({"type": event_type, "data": data})
    dead = []
    for ws in _active_connections:
        try:
            await ws.send_text(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in _active_connections:
            _active_connections.remove(ws)


@router.websocket("/api/live")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(default=None),
):
    """WebSocket with JWT auth — spec addendum C10 fix: previously accepted any connection.
    Caller must pass ?token=<jwt>. Doctor/admin tokens only (patients don't get broadcast events)."""
    if not token:
        # No token provided — reject. (Don't accept then close; close with policy-violation code.)
        await websocket.close(code=4401)  # unauthorized
        return
    payload = verify_access_token(token)
    if payload is None or payload.get("role") not in ("doctor", "admin"):
        await websocket.close(code=4403)  # forbidden
        return

    await websocket.accept()
    _active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _active_connections:
            _active_connections.remove(websocket)


def get_broadcast_fn():
    return broadcast_event