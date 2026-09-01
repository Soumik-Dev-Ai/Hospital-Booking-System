from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from .config import settings

# Spec A.6: the Postgres connection MUST be encrypted in transit. `sslmode=require`
# enforces TLS even if the server would otherwise negotiate a plaintext fallback.
_connect_args: dict = {}
if "postgresql" in settings.async_database_url and "sslmode" not in settings.async_database_url:
    _connect_args["ssl"] = True

engine = create_async_engine(
    settings.async_database_url,
    echo=False,
    
    
    pool_pre_ping=True,
    connect_args=_connect_args,
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


