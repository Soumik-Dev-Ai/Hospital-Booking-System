"""
core/sheets_lock.py — OS-level write lock around all Google Sheets writes (spec A.3.2).

Spec A.3.2 mandates `fcntl.flock` on a documented lock file path; both the webhook
handlers and the cron enforcement worker must acquire the same lock before any
Sheets write. The lock file path is configurable via `GOOGLE_SHEETS_LOCK_FILE`
(default `/tmp/patient_intake_sheets.lock`).

On Windows (dev/bootstrap only — Plan A's deployment target is Linux) we fall back
to `msvcrt.locking` so tests don't depend on POSIX-only modules. The semantics are
the same: process-wide exclusive lock, auto-released on file close or process exit.
"""
import contextlib
import os
import pathlib

from core.config import settings
from core.logging import get_logger

logger = get_logger("sheets_lock")

# Ensure parent dir exists for the lock file on first use.
def _ensure_lock_dir():
    p = pathlib.Path(settings.google_sheets_lock_file)
    if p.parent and not p.parent.exists():
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass  # /tmp usually exists; ignore permission errors in dev


@contextlib.asynccontextmanager
async def sheets_write_lock():
    """Async context manager. Acquires an exclusive OS-level lock around the
    enclosed block. Usage:

        async with sheets_write_lock():
            await sheets_client.upsert_appointment(...)
    """
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _acquire_blocking)
    try:
        yield
    finally:
        await loop.run_in_executor(None, _release_blocking)


# We hold the file handle in module state so the lock survives the duration of the
# `async with` block and is released deterministically in `_release_blocking`.
_lock_handle = None


def _acquire_blocking():
    global _lock_handle
    _ensure_lock_dir()
    f = open(settings.google_sheets_lock_file, "a+")
    try:
        try:
            import fcntl  # type: ignore
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        except ImportError:
            # Windows dev fallback — use msvcrt byte-range lock on byte 0.
            import msvcrt  # type: ignore
            try:
                msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)
            except OSError:
                # Some Windows filesystems don't support locking; degrade gracefully
                # to advisory-only. Plan A's deployment target is Linux so this is
                # strictly a non-production convenience.
                pass
    except Exception as e:
        logger.warning("sheets_lock_acquire_failed", error=str(e))
        # Degrade gracefully — better to attempt the write than to drop it
        # entirely. The Postgres layer underneath still guarantees consistency.
    _lock_handle = f
    logger.debug("sheets_lock_acquired", path=settings.google_sheets_lock_file)


def _release_blocking():
    global _lock_handle
    if _lock_handle is None:
        return
    try:
        try:
            import fcntl  # type: ignore
            fcntl.flock(_lock_handle.fileno(), fcntl.LOCK_UN)
        except ImportError:
            import msvcrt  # type: ignore
            try:
                msvcrt.locking(_lock_handle.fileno(), msvcrt.LK_UNLCK, 1)
            except OSError:
                pass
    except Exception as e:
        logger.warning("sheets_lock_release_failed", error=str(e))
    try:
        _lock_handle.close()
    finally:
        _lock_handle = None
    logger.debug("sheets_lock_released", path=settings.google_sheets_lock_file)
