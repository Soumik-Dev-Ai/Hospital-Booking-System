"""
core/encryption.py — Application-level field encryption at rest (spec A.6).

Encrypts `IntakeSubmission.raw_reply_text` and `structured_summary` (PHI) before
they hit Postgres, decrypts on read. Uses Fernet (symmetric, from the
`cryptography` package, already in requirements.txt).

The key comes from `PHI_ENCRYPTION_KEY` env var. Generate one with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

If no key is configured, the system FAILS CLOSED on write (raises) so PHI is
never persisted in plaintext, and FAILS OPEN on read only for legacy/plaintext
rows created before encryption was enabled (returns the value as-is) so
existing data remains readable during migration.
"""
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from core.config import settings
from core.logging import get_logger

logger = get_logger("encryption")

_fernet: Fernet | None = None


def _get_fernet() -> Fernet | None:
    global _fernet
    if _fernet is None:
        key = settings.phi_encryption_key
        if not key:
            return None
        _fernet = Fernet(key.encode("utf-8"))
    return _fernet


def encrypt_text(plaintext: str) -> str:
    """Encrypt a string. Returns a `enc:...`-prefixed token. Raises if no key configured."""
    f = _get_fernet()
    if f is None:
        raise RuntimeError(
            "PHI_ENCRYPTION_KEY is not configured — refusing to persist plaintext PHI. "
            "Generate a key and set it in the environment."
        )
    return "enc:" + f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_text(ciphertext: str) -> str:
    """Decrypt a `enc:`-prefixed token. Legacy plaintext rows are returned as-is."""
    if not ciphertext:
        return ciphertext
    if not ciphertext.startswith("enc:"):
        return ciphertext  # legacy plaintext row
    f = _get_fernet()
    if f is None:
        logger.error("cannot_decrypt_phi_key_not_configured")
        return ""
    try:
        return f.decrypt(ciphertext[4:].encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.error("phi_decrypt_failed_invalid_token")
        return ""


def encrypt_json(value: dict[str, Any]) -> str:
    """Serialize + encrypt a dict (for structured_summary)."""
    return encrypt_text(json.dumps(value, default=str))


def decrypt_json(ciphertext: str) -> dict[str, Any]:
    """Decrypt + deserialize a JSON dict. Legacy plaintext rows are handled."""
    raw = decrypt_text(ciphertext)
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}
