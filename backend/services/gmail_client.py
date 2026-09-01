import asyncio
import base64
import re

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from html import unescape

from core.config import settings
from core.logging import get_logger
from core.circuit_breaker import gmail_breaker

logger = get_logger(__name__)

# Ref: #<ref_code> token embedded in outbound intake emails, parsed from inbound replies.
# ref_code is an 8-char alphanumeric string (A-Z0-9) per models.Appointment.ref_code.
REF_PATTERN = re.compile(r"Ref:\s*#([A-Z0-9]{3,12})", re.IGNORECASE)


class GmailClient:
    def __init__(self):
        self._service = None

    def _get_service(self):
        if self._service is None:
            creds = Credentials(
                token=None,
                refresh_token=settings.gmail_refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=settings.gmail_client_id,
                client_secret=settings.gmail_client_secret,
            )
            self._service = build("gmail", "v1", credentials=creds)
        return self._service

    async def send_email(self, to: str, subject: str, html_body: str, thread_id: str | None = None) -> str:
        from email.mime.text import MIMEText
        msg = MIMEText(html_body, "html", "utf-8")
        msg["To"] = to
        msg["Subject"] = subject

        raw_msg = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        body = {"raw": raw_msg}
        if thread_id:
            body["threadId"] = thread_id

        loop = asyncio.get_event_loop()

        async def _inner():
            svc = self._get_service()
            sent = await loop.run_in_executor(
                None,
                lambda: svc.users().messages().send(userId="me", body=body).execute(),
            )
            logger.info("gmail_sent", to=to, subject=subject, message_id=sent.get("id"))
            return sent.get("id")

        return await gmail_breaker.call(_inner)

    async def history_list(self, start_history_id: str) -> dict:
        loop = asyncio.get_event_loop()
        svc = self._get_service()
        result = await loop.run_in_executor(
            None,
            lambda: svc.users().history().list(
                userId="me",
                startHistoryId=start_history_id,
                labelId="INBOX",
                historyTypes=["messageAdded"],
            ).execute(),
        )
        return result

    async def get_message(self, message_id: str) -> dict | None:
        loop = asyncio.get_event_loop()
        svc = self._get_service()
        result = await loop.run_in_executor(
            None,
            lambda: svc.users().messages().get(
                userId="me",
                id=message_id,
                format="full",
            ).execute(),
        )
        return result

    async def watch(self) -> dict:
        loop = asyncio.get_event_loop()
        svc = self._get_service()
        result = await loop.run_in_executor(
            None,
            lambda: svc.users().watch(
                userId="me",
                body={"topicName": settings.gmail_topic_name},
            ).execute(),
        )
        logger.info("gmail_watch_renewed", expiration=result.get("expiration"))
        return result

    async def stop_watch(self):
        loop = asyncio.get_event_loop()
        svc = self._get_service()
        await loop.run_in_executor(
            None,
            lambda: svc.users().stop(userId="me").execute(),
        )

    def decode_message_body(self, message: dict) -> str:
        """Decode a Gmail message body, handling multipart and HTML fallback."""
        payload = message.get("payload", {})

        # Multipart: prefer text/plain, fall back to text/html
        if "parts" in payload:
            for part in payload["parts"]:
                if part.get("mimeType") == "text/plain":
                    data = part.get("body", {}).get("data", "")
                    if data:
                        return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
            for part in payload["parts"]:
                if part.get("mimeType") == "text/html":
                    data = part.get("body", {}).get("data", "")
                    if data:
                        html = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                        return _strip_html(html)

        data = payload.get("body", {}).get("data", "")
        if data:
            decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
            if payload.get("mimeType") == "text/html":
                return _strip_html(decoded)
            return decoded
        return ""

    def extract_ref_id(self, text: str) -> str | None:
        """Parse the hidden 'Ref: #<ref_code>' token from an inbound reply.

        Returns the raw 8-char alphanumeric ref_code string (no validation needed —
        the DB column/query enforces the format), or None if absent/garbled.
        """
        match = REF_PATTERN.search(text or "")
        if not match:
            return None
        return match.group(1)

    def extract_reply_text(self, message: dict) -> str:
        """Extract the reply text, stripping quoted previous emails."""
        text = self.decode_message_body(message)
        lines = text.split("\n")
        reply_lines = []
        for line in lines:
            if line.strip().startswith(">"):
                continue
            if re.match(r'On .* wrote:', line.strip(), re.IGNORECASE):
                break
            reply_lines.append(line)
        return "\n".join(reply_lines).strip()

    def extract_from_address(self, message: dict) -> str | None:
        headers = message.get("payload", {}).get("headers", [])
        for h in headers:
            if h.get("name") == "From":
                val = h["value"]
                if "<" in val:
                    return val.split("<")[1].rstrip(">").strip()
                return val.strip()
        return None

    def extract_attachments(self, message: dict) -> list[dict]:
        """Return attachment metadata without downloading unsafe payloads."""
        attachments: list[dict] = []

        def visit(part: dict) -> None:
            filename = part.get("filename") or ""
            body = part.get("body") or {}
            if filename or body.get("attachmentId"):
                attachments.append({
                    "filename": filename,
                    "mime_type": part.get("mimeType") or "",
                    "attachment_id": body.get("attachmentId"),
                    "size": body.get("size", 0),
                })
            for child in part.get("parts", []) or []:
                visit(child)

        visit(message.get("payload", {}))
        return attachments


def _strip_html(html: str) -> str:
    """Cheap HTML → plain-text conversion for reply parsing and Ref extraction."""
    # Remove style/script blocks entirely
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
    # Convert <br> and block closers to newlines
    html = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    html = re.sub(r"</(p|div|li|tr|h[1-6])>", "\n", html, flags=re.IGNORECASE)
    # Strip remaining tags
    text = re.sub(r"<[^>]+>", "", html)
    return unescape(text)


gmail_client = GmailClient()
