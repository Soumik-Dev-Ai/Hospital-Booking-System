from dotenv import load_dotenv
load_dotenv()
import socket
from functools import lru_cache
from typing import List, Optional
from pydantic import ConfigDict, field_validator
from pydantic_settings import BaseSettings

def _get_db_url(is_sync=False) -> str:
    import os
    db_url = os.getenv('DATABASE_URL')
    if db_url:
        if db_url.startswith("postgres://"): db_url = db_url.replace("postgres://", "postgresql://", 1)
        if not is_sync and not "asyncpg" in db_url and db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if is_sync and "asyncpg" in db_url:
            db_url = db_url.replace("+asyncpg", "")
        return db_url
    try:
        import socket
        with socket.create_connection(('localhost', 5432), timeout=0.2):
            user = os.getenv('POSTGRES_USER', 'postgres')
            pwd = os.getenv('POSTGRES_PASSWORD', '')
            host = os.getenv('POSTGRES_HOST', 'localhost')
            port = os.getenv('POSTGRES_PORT', '5432')
            db = os.getenv('POSTGRES_DB', 'alder_sage')
            if is_sync: return f'postgresql://{user}:{pwd}@{host}:{port}/{db}'
            return f'postgresql+asyncpg://{user}:{pwd}@{host}:{port}/{db}'
    except OSError:
        return 'sqlite:///./alder_sage.db' if is_sync else 'sqlite+aiosqlite:///./alder_sage.db'

class Settings(BaseSettings):
    model_config = ConfigDict(env_file='.env', env_file_encoding='utf-8', case_sensitive=False, extra='ignore')
    app_name: str = 'Alder & Sage'
    debug: bool = False
    host: str = '0.0.0.0'
    port: int = 8000
    log_level: str = 'info'
    cors_origins: List[str] = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:8080']

    @field_validator('cors_origins', mode='before')
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            if v.startswith('[') and v.endswith(']'):
                import json
                try: return json.loads(v)
                except Exception: pass
            return [i.strip() for i in v.split(',') if i.strip()]
        return v
    
    @property
    def database_url(self) -> str:
        return _get_db_url(is_sync=False)
        
    @property
    def sync_database_url(self) -> str:
        return _get_db_url(is_sync=True)

    redis_url: str = 'redis://localhost:6379/0'
    secret_key: str = '' # REQUIRED in .env
    algorithm: str = 'HS256'
    access_token_expire_minutes: int = 60
    google_client_id: str | None = None
    google_client_secret: str | None = None
    app_base_url: str | None = None
    app_env: str = 'development'
    discord_webhook_url: Optional[str] = None
    slack_webhook_url: Optional[str] = None
    moderation_api_key: Optional[str] = None
    moderation_api_url: Optional[str] = None
    gemini_api_key: Optional[str] = None
    sendgrid_api_key: Optional[str] = None
    google_sheets_api_key: Optional[str] = None

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()

