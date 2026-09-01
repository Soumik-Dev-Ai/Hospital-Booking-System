"""
services/sheets_client.py — Google Sheets dynamic month-wise writer.

Per spec (Phase 2): ONE spreadsheet file per month, named "Patient Intake - <Month> YYYY"
(e.g., "Patient Intake - August 2026"). The set of files grows over time; new months
auto-create on first write. The doctor-facing dashboard always opens the file for the
appointment's scheduled month.

Files are searched via Google Drive v3 (`files.list` with `mimeType` + name filter),
and created via the Sheets v4 API. Authentication scope is `drive.file` so the service
account only sees files it owns — never the doctor's private docs.

Caching: a per-instance dict `self._spreadsheet_ids: {filename: spreadsheet_id}`
prevents a Drive API hit on every webhook. The cache lives for the lifetime of the
process; for multi-worker deployments a stale cache only costs an extra Drive list call.
"""
import asyncio
import datetime as _dt
import uuid
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from google.oauth2.service_account import Credentials as ServiceAccountCredentials
from googleapiclient.discovery import build

from core.config import settings
from core.logging import get_logger

logger = get_logger("sheets_client")

# --- Column schema for the Sheet1 of each month file ---
# Order matters — Sheets writes are positional via `values: [[...]]`.
COLUMNS = [
    "Ref_Code", "Appt_ID", "Patient_Name", "Patient_Email", "Patient_Phone",
    "Calendly_Event_UUID", "Scheduled_At", "Status", "Warning_Sent_At",
    "Reminder_Sent_At", "Auto_Cancelled_At", "Override_Reason", "Created_At",
    "Updated_At", "AI_Provider", "AI_Model", "Completeness_Score",
    "Summary_Link",
]

# Scopes: drive.file for search/create of files this app owns; spreadsheets for write.
_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]


def _filename_for(scheduled_at: _dt.datetime) -> str:
    """Return the per-month filename, e.g. 'Patient Intake - August 2026'."""
    tz = ZoneInfo(settings.clinic_timezone)
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=_dt.timezone.utc)
    return f"Patient Intake - {scheduled_at.astimezone(tz).strftime('%B %Y')}"


def _public_url(spreadsheet_id: str) -> str:
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"


def _row_values(row: dict) -> list:
    """Convert a dict row to a list of values matching COLUMNS order."""
    def _iso(v): return v.isoformat() if hasattr(v, "isoformat") and v else ""
    return [
        row.get("ref_code", ""),
        row.get("appointment_id", ""),
        row.get("patient_name", ""),
        row.get("patient_email", ""),
        row.get("patient_phone") or "",
        row.get("calendly_event_uuid", ""),
        _iso(row.get("scheduled_at")),
        row.get("status", ""),
        _iso(row.get("warning_sent_at")),
        _iso(row.get("reminder_sent_at")),
        _iso(row.get("auto_cancelled_at")),
        row.get("override_reason") or "",
        _iso(row.get("created_at")),
        _iso(row.get("updated_at")),
        row.get("ai_provider") or "",
        row.get("ai_model") or "",
        "" if row.get("completeness_score") is None else str(row["completeness_score"]),
        row.get("summary_link") or "",
    ]


class SheetsClient:
    def __init__(self):
        self._sheets_service = None
        self._drive_service = None
        # filename -> spreadsheet_id cache (lifetime of process)
        self._spreadsheet_ids: dict[str, str] = {}

    # --- service construction ---

    def _creds(self):
        if settings.google_sheets_service_account_file:
            return ServiceAccountCredentials.from_service_account_file(
                settings.google_sheets_service_account_file, scopes=_SCOPES,
            )
        # Fallback: reuse the Gmail OAuth token (must have drive.file + spreadsheets in original consent).
        return Credentials(
            token=None,
            refresh_token=settings.gmail_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.gmail_client_id,
            client_secret=settings.gmail_client_secret,
            scopes=_SCOPES,
        )

    def _get_sheets_service(self):
        if self._sheets_service is None:
            self._sheets_service = build(
                "sheets", "v4", credentials=self._creds(), cache_discovery=False,
            )
        return self._sheets_service

    def _get_drive_service(self):
        if self._drive_service is None:
            self._drive_service = build(
                "drive", "v3", credentials=self._creds(), cache_discovery=False,
            )
        return self._drive_service

    @property
    def configured(self) -> bool:
        return bool(
            settings.google_sheets_service_account_file or settings.gmail_refresh_token
        )

    # --- per-month dynamic file discovery ---

    async def get_or_create_spreadsheet(self, scheduled_at: _dt.datetime) -> str | None:
        """Return the spreadsheet ID for the appointment's month, creating one
        if none exists. Returns None when Sheets is not configured.

        The flow:
          1. Cache hit → return immediately.
          2. Drive v3 search by exact filename + mimeType — if found, cache + return.
          3. Otherwise create via Sheets API (writes headers to Sheet1), cache + return.
        """
        if not self.configured:
            return None

        filename = _filename_for(scheduled_at)
        if filename in self._spreadsheet_ids:
            return self._spreadsheet_ids[filename]

        loop = asyncio.get_event_loop()

        # Drive search (escapes single quotes in filenames defensively)
        safe_name = filename.replace("'", "\\'")
        query = (
            f"name='{safe_name}' and "
            f"mimeType='application/vnd.google-apps.spreadsheet' and "
            f"trashed=false"
        )

        def _drive_search():
            return self._get_drive_service().files().list(
                q=query, spaces="drive", fields="files(id, name)", pageSize=1,
            ).execute()

        try:
            drive_result = await loop.run_in_executor(None, _drive_search)
            files = drive_result.get("files", [])
            if files:
                sid = files[0]["id"]
                self._spreadsheet_ids[filename] = sid
                logger.info("sheets_file_found", filename=filename, id=sid)
                return sid
        except Exception as e:
            logger.warning("sheets_drive_search_failed", filename=filename, error=str(e))

        # Not found — create via Sheets API
        def _create_and_seed():
            svc = self._get_sheets_service()
            created = svc.spreadsheets().create(
                body={"properties": {"title": filename}, "sheets": [{"properties": {"title": "Sheet1"}}]},
                fields="spreadsheetId",
            ).execute()
            sid = created["spreadsheetId"]
            svc.spreadsheets().values().update(
                spreadsheetId=sid,
                range="Sheet1!A1",
                valueInputOption="RAW",
                body={"values": [COLUMNS]},
            ).execute()
            return sid

        try:
            sid = await loop.run_in_executor(None, _create_and_seed)
            self._spreadsheet_ids[filename] = sid
            logger.info("sheets_file_created", filename=filename, id=sid, url=_public_url(sid))
            return sid
        except Exception as e:
            logger.error("sheets_file_create_failed", filename=filename, error=str(e))
            return None

    async def get_public_url(self, scheduled_at: _dt.datetime) -> str | None:
        sid = await self.get_or_create_spreadsheet(scheduled_at)
        return _public_url(sid) if sid else None

    # --- single-row upsert (legacy, kept for backward compat) ---

    async def upsert_appointment(
        self,
        ref_code: str,
        appointment_id: uuid.UUID,
        patient_name: str,
        patient_email: str,
        patient_phone: str | None,
        calendly_event_uuid: str,
        scheduled_at: _dt.datetime,
        status: str,
        warning_sent_at: _dt.datetime | None = None,
        reminder_sent_at: _dt.datetime | None = None,
        auto_cancelled_at: _dt.datetime | None = None,
        override_reason: str | None = None,
        created_at: _dt.datetime | None = None,
        updated_at: _dt.datetime | None = None,
        ai_provider: str | None = None,
        ai_model: str | None = None,
        completeness_score: int | None = None,
        summary_link: str | None = None,
    ) -> str | None:
        """Insert or update a single appointment row in its month's spreadsheet.
        Callers MUST hold `sheets_write_lock()` (A.3.2) before calling serially.
        Returns the public URL of the month-file on success, None on skip/failure."""
        if not self.configured:
            return None

        sid = await self.get_or_create_spreadsheet(scheduled_at)
        if sid is None:
            return None

        def _iso(v): return v.isoformat() if v else ""

        row = [
            ref_code, str(appointment_id), patient_name, patient_email, patient_phone or "",
            calendly_event_uuid, scheduled_at.isoformat(), status,
            _iso(warning_sent_at), _iso(reminder_sent_at), _iso(auto_cancelled_at),
            override_reason or "", _iso(created_at), _iso(updated_at),
            ai_provider or "", ai_model or "",
            "" if completeness_score is None else str(completeness_score),
            summary_link or "",
        ]

        loop = asyncio.get_event_loop()

        def _do_upsert():
            svc = self._get_sheets_service()
            # Column A is ref_code — idempotent lookup.
            read = svc.spreadsheets().values().get(spreadsheetId=sid, range="Sheet1!A2:A").execute()
            values = read.get("values", [])
            row_idx = None
            for i, row_vals in enumerate(values, start=2):  # row 1 is header
                if row_vals and row_vals[0] == ref_code:
                    row_idx = i
                    break
            if row_idx is not None:
                svc.spreadsheets().values().update(
                    spreadsheetId=sid,
                    range=f"Sheet1!A{row_idx}",
                    valueInputOption="USER_ENTERED",
                    body={"values": [row]},
                ).execute()
            else:
                svc.spreadsheets().values().append(
                    spreadsheetId=sid,
                    range="Sheet1!A1",
                    valueInputOption="USER_ENTERED",
                    insertDataOption="INSERT_ROWS",
                    body={"values": [row]},
                ).execute()

        await loop.run_in_executor(None, _do_upsert)
        logger.info("sheets_upsert_ok", spreadsheet_id=sid, appointment_id=str(appointment_id))
        return _public_url(sid)

    # --- batch upsert (Criterion 1: O-grade concurrency) ---

    async def batch_upsert_appointments(
        self,
        rows: list[dict],
        scheduled_at: _dt.datetime,
    ) -> str | None:
        """Upsert multiple appointment rows in a single spreadsheet in 2 API calls:
          1. Read existing Ref_Code column (A2:A) to find row indices.
          2. One batchUpdate for existing rows + one append for new rows.

        rows: list of dicts with keys matching COLUMNS order (see _row_values).
        Callers MUST hold `sheets_write_lock()` before calling.
        """
        if not self.configured or not rows:
            return None

        sid = await self.get_or_create_spreadsheet(scheduled_at)
        if sid is None:
            return None

        loop = asyncio.get_event_loop()

        def _batch_op():
            svc = self._get_sheets_service()
            # 1. Read existing ref codes with their row indices
            read = svc.spreadsheets().values().get(spreadsheetId=sid, range="Sheet1!A2:R").execute()
            existing: dict[str, int] = {}
            for i, row_vals in enumerate(read.get("values", []), start=2):
                if row_vals and row_vals[0]:
                    existing[row_vals[0]] = i

            # 2. Partition rows into updates vs appends
            update_requests = []   # list of {"range": ..., "values": [[...]]}
            append_values = []     # list of [value, ...]
            for row_dict in rows:
                ref = row_dict.get("ref_code", "")
                val = _row_values(row_dict)
                if ref in existing:
                    update_requests.append({
                        "range": f"Sheet1!A{existing[ref]}",
                        "values": [val],
                    })
                else:
                    append_values.append(val)

            # 3. Batch update existing rows (single API call)
            if update_requests:
                svc.spreadsheets().values().batchUpdate(
                    spreadsheetId=sid,
                    body={"valueInputOption": "USER_ENTERED", "data": update_requests},
                ).execute()

            # 4. Append new rows (single API call)
            if append_values:
                svc.spreadsheets().values().append(
                    spreadsheetId=sid,
                    range="Sheet1!A1",
                    valueInputOption="USER_ENTERED",
                    insertDataOption="INSERT_ROWS",
                    body={"values": append_values},
                ).execute()

        try:
            await loop.run_in_executor(None, _batch_op)
            logger.info(
                "sheets_batch_upsert_ok",
                spreadsheet_id=sid,
                total=len(rows),
            )
            return _public_url(sid)
        except Exception as e:
            logger.error("sheets_batch_upsert_failed", error=str(e))
            return None

    # --- find by ref code across month-files ---

    async def find_by_ref_code(
        self,
        ref_code: str,
        scheduled_at_hint: _dt.datetime | None = None,
    ) -> dict | None:
        """Locate a row by Ref_Code. With a scheduled_at_hint, search that month
        + prev/next month. Without a hint, walk all cached + the last 12 months."""
        if not self.configured:
            return None

        loop = asyncio.get_event_loop()

        # Build the ordered list of (filename, scheduled_at) to search.
        candidates: list[_dt.datetime] = []
        now = _dt.datetime.now(_dt.timezone.utc)
        if scheduled_at_hint is not None:
            candidates.append(scheduled_at_hint)
            candidates.append(scheduled_at_hint - _dt.timedelta(days=30))
            candidates.append(scheduled_at_hint + _dt.timedelta(days=30))
        else:
            # Last 12 months — covers realistic patient-history lookback.
            for m in range(12):
                y, mo = now.year, now.month - m
                while mo <= 0:
                    mo += 12
                    y -= 1
                candidates.append(_dt.datetime(y, mo, 15, tzinfo=_dt.timezone.utc))

        seen_filenames: set[str] = set()
        for sched in candidates:
            filename = _filename_for(sched)
            if filename in seen_filenames:
                continue
            seen_filenames.add(filename)

            sid = await self.get_or_create_spreadsheet(sched)
            if sid is None:
                # get_or_create returns None both when unconfigured and when a fresh
                # create failed. If unconfigured, the next iteration's create will
                # also fail and we'll short-circuit. Skip this iteration.
                if not self.configured:
                    return None
                continue

            def _search(sheet_id=sid):
                svc = self._get_sheets_service()
                read = svc.spreadsheets().values().get(
                    spreadsheetId=sheet_id, range="Sheet1!A2:R",
                ).execute()
                for row_vals in read.get("values", []):
                    if row_vals and row_vals[0] == ref_code:
                        padded = (row_vals + [""] * len(COLUMNS))[:len(COLUMNS)]
                        return dict(zip(COLUMNS, padded))
                return None

            try:
                result = await loop.run_in_executor(None, _search)
                if result is not None:
                    logger.info("sheets_ref_code_found",
                                filename=filename, ref_code=ref_code)
                    return result
            except Exception as e:
                logger.debug("sheets_file_read_failed", filename=filename, error=str(e))

        logger.info("sheets_ref_code_not_found", ref_code=ref_code,
                    filenames_checked=list(seen_filenames))
        return None


sheets_client = SheetsClient()
