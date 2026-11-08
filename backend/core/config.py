import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    model_config = {'env_file': '.env', 'extra': 'ignore', 'case_sensitive': False}
    database_url: str = 'sqlite+aiosqlite:///./alder_sage.db'
    async_database_url: str = "sqlite+aiosqlite:///./alder_sage.db"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    doctor_email: str = "doctor@clinic.com"
    doctor_password_hash: str = ""
    calendly_client_id: str = ""
    calendly_client_secret: str = ""
    calendly_webhook_signing_key: str = ""
    calendly_organization_url: str = ""
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_refresh_token: str = ""
    gmail_topic_name: str = ""
    gmail_push_service_account_email: str = ""
    gmail_push_audience: str = ""
    app_base_url: str = ""
    clinic_name: str = "Alder & Sage"
    clinic_timezone: str = "UTC"
    google_sheets_service_account_file: str = ""
    google_service_account_json: str = ""
    openrouter_base_url: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = ""
    groq_base_url: str = ""
    groq_api_key: str = ""
    groq_model: str = ""
    cerebras_base_url: str = ""
    cerebras_api_key: str = ""
    cerebras_model: str = ""
    nim_base_url: str = ""
    nim_api_key: str = ""
    nim_model: str = ""

    @property
    def get_async_db_url(self) -> str:
        import os
        url = os.getenv("DATABASE_URL") or self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if "postgresql://" in url and "asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("sqlite://") and "+aiosqlite" not in url:
            url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return url

settings = Settings()
