from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from app.config import get_settings
from app.models.db_models import Base
import structlog

logger = structlog.get_logger()
settings = get_settings()

# Convert sync URL to async, strip SSL params asyncpg handles differently
def _make_async_url(url: str) -> tuple[str, dict]:
    connect_args: dict = {}
    # asyncpg doesn't accept sslmode or channel_binding as query params
    for param in ("sslmode", "channel_binding"):
        import re
        url = re.sub(rf"[?&]{param}=[^&]*", "", url)
    # Clean up trailing ? or &
    url = url.rstrip("?&")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    # Neon requires SSL
    if "neon.tech" in url:
        connect_args = {"ssl": "require"}
    return url, connect_args

_db_url, _connect_args = _make_async_url(settings.database_url)

engine = create_async_engine(
    _db_url,
    echo=settings.environment == "development",
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Background jobs use NullPool — no event-loop binding, safe across threads.
# Jobs must import BgSessionLocal (not AsyncSessionLocal) so the API pool is never patched.
_bg_engine = create_async_engine(
    _db_url,
    poolclass=NullPool,
    connect_args=_connect_args,
)
BgSessionLocal = async_sessionmaker(
    _bg_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")


async def check_db_connection():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("Database connection failed", error=str(e))
        return False
