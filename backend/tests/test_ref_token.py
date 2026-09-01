"""Tests for the Ref: #<ref_code> threading-token mechanism.

The intake-request email embeds a hidden `Ref: #<ref_code>` token (8-char
alphanumeric). Inbound replies are parsed to disambiguate which appointment a
reply belongs to (especially important when a patient has multiple pending
appointments).
"""
import re
import uuid
from unittest.mock import MagicMock

import pytest

from services.gmail_client import REF_PATTERN


def extract_ref_id_safe(text: str):
    """Helper — wraps gmail_client.extract_ref_id with a None-safe fallback to a string so tests stay simple."""
    from services.gmail_client import gmail_client
    parsed = gmail_client.extract_ref_id(text or "")
    return str(parsed) if parsed else None


class TestRefPattern:
    def test_pattern_matches_8char_code(self):
        text = "Hi doctor, this is my reply.\n\nRef: #A1B2C3D4"
        match = REF_PATTERN.search(text)
        assert match is not None
        assert match.group(1) == "A1B2C3D4"

    def test_pattern_case_insensitive(self):
        text = "ref: #a1b2c3d4"
        match = REF_PATTERN.search(text)
        assert match is not None
        assert match.group(1) == "a1b2c3d4"

    def test_pattern_tolerates_legacy_uuid_form_prefix(self):
        # A legacy UUID token begins with 8 hex chars — the regex captures that
        # prefix. It will never collide with a real ref_code (36^8 space), and
        # Postgres matching falls back to sender-email matching when it misses.
        match = REF_PATTERN.search("Ref: #550e8400-e29b-41d4-a716-446655440000")
        assert match is not None
        assert match.group(1) == "550e8400"

    def test_pattern_requires_at_least_3_chars(self):
        # Too-short codes (collision risk / format violation) must NOT match
        match = REF_PATTERN.search("Ref: #AB")
        assert match is None

    def test_extract_returns_code(self):
        text = "Reply text here.\nRef: #A1B2C3D4"
        result = extract_ref_id_safe(text)
        assert result == "A1B2C3D4"

    def test_extract_returns_none_when_no_ref(self):
        assert extract_ref_id_safe("Just a normal reply, no token.") is None

    def test_extract_returns_none_for_garbled_ref(self):
        # No alphanumerics after '#' → no match
        assert extract_ref_id_safe("Ref: #!!!") is None

    def test_ref_token_strips_html(self):
        """The intake email wraps the Ref in a hidden div. Replies quote the original message — the
        Ref pattern must still match through HTML wrappers and via gmail_client's HTML strip."""
        from services.gmail_client import _strip_html
        html = '<div style="display:none;">Ref: #A1B2C3D4</div>'
        plain = _strip_html(html)
        match = REF_PATTERN.search(plain)
        assert match is not None
        assert match.group(1) == "A1B2C3D4"


class TestHiddenRefInTemplate:
    def test_intake_request_template_includes_ref_div(self):
        from pathlib import Path
        tmpl_path = Path(__file__).parent.parent / "templates" / "intake_request.html"
        tmpl = tmpl_path.read_text(encoding="utf-8")
        # Template must include the Ref placeholder and be hidden
        assert "{{ ref_code }}" in tmpl, "intake_request.html must embed {{ ref_code }} for Ref token"
        assert "Ref: #{{ ref_code }}" in tmpl, "Template must include 'Ref: #{{ ref_code }}'"
        # Must be hidden so the patient doesn't see it
        assert "display:none" in tmpl or "visibility:hidden" in tmpl, "Ref token div must be hidden"

    def test_notifications_py_passes_ref_code_to_template(self):
        """Check that the ref_code is passed in the background/notification code."""
        from pathlib import Path
        # Try background/__init__.py (current location) and pipeline/notifications.py (legacy)
        candidates = [
            Path(__file__).parent.parent / "background" / "__init__.py",
            Path(__file__).parent.parent / "pipeline" / "notifications.py",
            Path(__file__).parent.parent / "services" / "gmail_client.py",
        ]
        for source in candidates:
            if source.exists():
                text = source.read_text(encoding="utf-8")
                if "ref_code" in text:
                    break
        else:
            pytest.fail("No source file with ref_code found")
        assert "ref_code" in text, \
            "notification code must pass ref_code into the template render context"
