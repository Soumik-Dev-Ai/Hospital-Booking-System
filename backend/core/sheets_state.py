"""core/sheets_state.py — Simple in-memory tracker for the last Sheets sync outcome.

Updated by jobs/sheets_sync.py each time the daily cron runs.  Read by
/api/admin/system-health to report the last sync state.

This is a lightweight state holder; persistent storage is the DailyBriefing row,
but system-health needs a fast snapshot without joining across the entire
appointment table.
"""
from datetime import datetime, timezone
from typing import Any

_state: dict[str, Any] = {"at": None, "ok": True, "error": None}


def set_sheets_sync_state(ok: bool, error: str | None = None) -> None:
    _state["at"] = datetime.now(timezone.utc)
    _state["ok"] = ok
    _state["error"] = error


def get_sheets_sync_state() -> dict[str, Any]:
    return _state.copy()