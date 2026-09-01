from .gemini_client import gemini_client, GeminiClient  # legacy, kept for existing tests
from .ai_provider import AIProvider, parse_intake_with_fallback, primary_provider, fallback_provider
from .calendly_client import calendly_client, CalendlyClient
from .gmail_client import gmail_client, GmailClient