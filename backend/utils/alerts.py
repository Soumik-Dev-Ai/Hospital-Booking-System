"""Alerting utilities — Discord and Slack webhook notifications."""

import asyncio
import json
import logging
from typing import Optional

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)


async def notify_startup(message: str) -> None:
    """Notify on successful startup."""
    await _send_webhook(
        url=settings.discord_webhook_url or settings.slack_webhook_url,
        content=f"🟢 **{message}**",
    )


async def notify_failure(task_name: str, error: str) -> None:
    """Notify on critical task failure."""
    await _send_webhook(
        url=settings.discord_webhook_url or settings.slack_webhook_url,
        content=f"🔴 **{task_name} FAILED**: {error}",
    )


async def notify_alert(message: str, severity: str = "warning") -> None:
    """Send a generic alert."""
    emoji = {"critical": "🔴", "error": "🟠", "warning": "🟡", "info": "ℹ️"}.get(
        severity, "🔔"
    )
    await _send_webhook(
        url=settings.discord_webhook_url or settings.slack_webhook_url,
        content=f"{emoji} **{severity.upper()}**: {message}",
    )


async def _send_webhook(url: str, content: str) -> None:
    """Send a message to a Discord or Slack webhook."""
    if not url:
        logger.debug("No webhook URL configured, skipping notification")
        return

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {
                "content": content,
                "username": "Alder & Sage Alerts",
            }
            response = await client.post(url, json=payload, timeout=10.0)
            response.raise_for_status()
            logger.info("Alert sent successfully to %s", url[:50] + "...")
    except httpx.HTTPError as exc:
        logger.error("Failed to send alert: %s", exc)
    except Exception as exc:
        logger.error("Unexpected error sending alert: %s", exc)


async def send_email_reminder(to_email: str, subject: str, body: str) -> None:
    """Stub: send an email reminder via SendGrid or AWS SES."""
    logger.info("Would send email to %s: %s", to_email, subject)
    # TODO: Integrate with SendGrid or AWS SES
    # if settings.sendgrid_api_key:
    #     await _send_via_sendgrid(to_email, subject, body)
    # elif settings.ses_region:
    #     await _send_via_ses(to_email, subject, body)


async def _send_via_sendgrid(to_email: str, subject: str, body: str) -> None:
    """Send via SendGrid API."""
    if not settings.sendgrid_api_key:
        logger.warning("SendGrid API key not configured")
        return
    # TODO: Implement SendGrid integration
    logger.info("SendGrid email would be sent to %s", to_email)


async def _send_via_ses(to_email: str, subject: str, body: str) -> None:
    """Send via AWS SES."""
    if not settings.ses_region:
        logger.warning("SES region not configured")
        return
    # TODO: Implement AWS SES integration
    logger.info("SES email would be sent to %s", to_email)


async def write_to_google_sheets(
    sheet_id: str,
    data: list[list],
    range_name: str = "Sheet1!A1",
) -> str:
    """Stub: write data to a Google Sheet and return the sheet URL."""
    if not settings.google_sheets_api_key:
        logger.warning("Google Sheets API key not configured")
        return ""
    # TODO: Implement Google Sheets API integration
    sheet_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}"
    logger.info("Would write %d rows to %s", len(data), sheet_url)
    return sheet_url
