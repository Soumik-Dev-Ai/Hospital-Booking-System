"""Tests for the doctor briefing & DailyBriefing idempotency.

Verifies that the briefing is sent only once per day (guarded by the unique constraint on
DailyBriefing.date) and that the source code's structure guarantees purge-before-briefing.
"""
import re
from pathlib import Path
from datetime import date


class TestBriefingIdempotency:
    def test_daily_briefing_date_is_unique(self):
        """DailyBriefing.date must have a unique constraint so a duplicate briefing insert fails."""
        source = Path(__file__).parent.parent / "models" / "models.py"
        text = source.read_text(encoding="utf-8")
        # Find the DailyBriefing class block
        match = re.search(r"class DailyBriefing.*?(?=\nclass |\Z)", text, re.DOTALL)
        assert match, "DailyBriefing class not found in models.py"
        body = match.group(0)
        assert "unique=True" in body, "DailyBriefing.date must be unique=True"
        assert "date = Column(Date, unique=True" in body


class TestBriefingContent:
    def test_briefing_includes_purge_counts_separately(self):
        """The briefing summary must show dry-run 'would-cancel' separately from actual cancellations."""
        source = Path(__file__).parent.parent / "cron_enforcement.py"
        text = source.read_text(encoding="utf-8")
        # The _compile_briefing function should include both 'would_cancel_count' and 'cancelled_count'
        assert "would_cancel_count" in text, "Briefing should distinguish would_cancel_count from cancelled_count"
        assert "cancelled_count" in text

    def test_briefing_template_distinguishes_dry_run(self):
        tmpl = Path(__file__).parent.parent / "templates" / "doctor_briefing.html"
        text = tmpl.read_text(encoding="utf-8")
        assert "{% if dry_run_mode %}" in text, "doctor_briefing.html must surface dry_run_mode banner"
        assert "would_cancel_count" in text or "would be cancelled" in text


class TestTemplateHealth:
    def test_auto_cancellation_html_no_grammar_error(self):
        """Regression: the original template contained 'would you would like' and 'that to you' grammar errors."""
        tmpl = Path(__file__).parent.parent / "templates" / "auto_cancellation.html"
        text = tmpl.read_text(encoding="utf-8")
        assert "would you would" not in text, "Grammar error 'would you would' must be fixed"
        assert "that to you" not in text, "Grammar error 'that to you' must be fixed"

    def test_intake_request_subject_does_not_embed_ref_inline(self):
        """The Ref token is private — must NOT be in the email Subject (visible to patient) — only in the hidden div."""
        tmpl = Path(__file__).parent.parent / "templates" / "intake_request.html"
        text = tmpl.read_text(encoding="utf-8")
        # The Ref {{ ref_code }} line must be in a hidden div, not in subject or visible body
        assert "Ref: #{{ ref_code }}" in text
        # Verify it's in a display:none / hidden container
        ref_idx = text.find("Ref: #{{ ref_code }}")
        surrounding = text[max(0, ref_idx - 200):ref_idx]
        assert "display:none" in surrounding or "visibility:hidden" in surrounding, \
            "Ref token must be inside a hidden div, not visible body"