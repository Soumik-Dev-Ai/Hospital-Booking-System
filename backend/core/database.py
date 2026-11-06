import ssl
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from .config import settings

# Spec A.6: Postgres connection encrypted in transit.
_connect_args: dict = {}
if "postgresql" in settings.get_async_db_url:
    ssl_ctx = ssl.create_default_context()
    if "supabase" in settings.get_async_db_url or "pooler" in settings.get_async_db_url:
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
    _connect_args["ssl"] = ssl_ctx

engine = create_async_engine(
    settings.get_async_db_url,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=300 if "supabase" in settings.get_async_db_url else 3600,
    connect_args={
        **_connect_args,
        **({"prepared_statement_cache_size": 0} if "supabase" in settings.get_async_db_url or "pooler" in settings.get_async_db_url else {})
    },
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
