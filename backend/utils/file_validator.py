import os, uuid, logging
from pathlib import Path

logger = logging.getLogger(__name__)
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", 5 * 1024 * 1024))
ALLOWED_MIMES = {"application/pdf", "image/png", "image/jpeg", "image/gif", "text/plain", "text/csv"}
MAGIC = {b"%PDF": "application/pdf", b"\x89PNG": "image/png", b"\xff\xd8\xff": "image/jpeg", b"GIF8": "image/gif"}
UPLOADS_DIR = Path(__file__).parent.parent / "uploads"

def validate_and_save(content: bytes, original_name: str) -> Path:
    if len(content) > MAX_UPLOAD_BYTES: raise ValueError("File too large")
    detected = next((mime for sig, mime in MAGIC.items() if content.startswith(sig)), None)
    if not detected:
        try:
            import magic
            detected = magic.from_buffer(content[:2048], mime=True)
        except ImportError: pass
    if not detected or detected not in ALLOWED_MIMES:
        raise ValueError(f"Invalid or forbidden file type: {detected}")
    ext = Path(original_name).suffix.lower()
    dest = UPLOADS_DIR / f"{uuid.uuid4().hex}{ext}"
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return dest
