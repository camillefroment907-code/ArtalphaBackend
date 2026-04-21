from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool, AsyncAdaptedQueuePool
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
    poolclass=AsyncAdaptedQueuePool,
    pool_size=20,
    max_overflow=40,
    pool_timeout=10,
    pool_recycle=1800,
    pool_pre_ping=True,
    echo=settings.environment == "development",
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
    """Fast path: only create missing tables. Call run_migrations() separately for ALTER/INDEX."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created")


async def run_migrations():
    """Slow path: ALTER TABLE / CREATE INDEX statements run after startup to avoid blocking healthcheck."""
    # IMPORTANT: ALTER TYPE ADD VALUE cannot run inside a PostgreSQL transaction.
    # These must run first with AUTOCOMMIT, then regular DDL runs in engine.begin().
    enum_migrations = [
        # subscriptionplan enum: add values that may be missing from older DB instances
        "ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'STARTER'",
        "ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'PRO'",
        "ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'INSTITUTIONAL'",
        "ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'ELITE'",
        "ALTER TYPE subscriptionplan ADD VALUE IF NOT EXISTS 'EXPERT'",
        # auctionhouse enum: SQLAlchemy uses Python member NAMES (uppercase) as DB values.
        # Existing PG values: DROUOT, INTERENCHERES, INVALUABLE, CHRISTIES, SOTHEBYS,
        # BONHAMS, OTHER, PHILLIPS, ROSEBERYS, HERITAGE, ARTMARKETAPI (all uppercase).
        # New sources must also be uppercase to match member names.
        "ALTER TYPE auctionhouse ADD VALUE IF NOT EXISTS 'LIVEAUCTIONEERS'",
        "ALTER TYPE auctionhouse ADD VALUE IF NOT EXISTS 'ARTSY'",
        "ALTER TYPE auctionhouse ADD VALUE IF NOT EXISTS 'CATAWIKI'",
        "ALTER TYPE auctionhouse ADD VALUE IF NOT EXISTS 'ARTCURIAL'",
    ]
    # ALTER TYPE ADD VALUE must run outside any transaction.
    # Use a dedicated NullPool engine with AUTOCOMMIT so asyncpg never wraps it in a TX.
    _ac_engine = create_async_engine(
        _db_url,
        poolclass=NullPool,
        connect_args=_connect_args,
        isolation_level="AUTOCOMMIT",
    )
    try:
        async with _ac_engine.connect() as conn:
            for sql in enum_migrations:
                try:
                    await conn.execute(text(sql))
                except Exception as e:
                    logger.warning("enum_migration_skipped", sql=sql[:60], error=str(e))
    finally:
        await _ac_engine.dispose()

    migrations = [
        # users columns
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_ip VARCHAR(45)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_version VARCHAR(10)",
        # preferences columns — add ALL non-core columns (table may be very old)
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS budget_max FLOAT",
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100)",
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'fr'",
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS notify_sms BOOLEAN DEFAULT FALSE",
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS collector_type VARCHAR(50)",
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS investment_horizon VARCHAR(50)",
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS min_lot_budget_eur FLOAT",
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS max_lot_budget_eur FLOAT",
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS preferred_periods TEXT[]",
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS preferred_regions TEXT[]",
        "ALTER TABLE preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        # lots columns added after initial deploy
        "ALTER TABLE lots ADD COLUMN IF NOT EXISTS market_type VARCHAR(50) DEFAULT 'auction'",
        "ALTER TABLE lots ADD COLUMN IF NOT EXISTS size_category VARCHAR(50)",
        # Phase 5: content fingerprint for cross-source deduplication
        "ALTER TABLE lots ADD COLUMN IF NOT EXISTS lot_fingerprint VARCHAR(64)",
        # NPS survey: add comment column
        "ALTER TABLE nps_responses ADD COLUMN IF NOT EXISTS comment TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_lots_fingerprint ON lots(lot_fingerprint) WHERE lot_fingerprint IS NOT NULL",
        # proprietary data tables — create_all handles new tables,
        # but ensure any future column additions are listed here
        "ALTER TABLE hammer_prices ADD COLUMN IF NOT EXISTS premium_paid FLOAT",
        "ALTER TABLE hammer_prices ADD COLUMN IF NOT EXISTS external_id TEXT",
        "ALTER TABLE hammer_prices ADD COLUMN IF NOT EXISTS hammer_price_eur FLOAT",
        "ALTER TABLE hammer_prices ADD COLUMN IF NOT EXISTS premium_ratio FLOAT",
        "ALTER TABLE hammer_prices ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown'",
        "ALTER TABLE hammer_prices ADD COLUMN IF NOT EXISTS image_url TEXT",
        "ALTER TABLE hammer_prices ADD COLUMN IF NOT EXISTS lot_url TEXT",
        "ALTER TABLE hammer_prices ADD COLUMN IF NOT EXISTS lot_number TEXT",
        "ALTER TABLE hammer_prices ALTER COLUMN sale_date DROP NOT NULL",
        "ALTER TABLE hammer_prices ALTER COLUMN hammer_price DROP NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_hammer_prices_external_id ON hammer_prices(external_id) WHERE external_id IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS idx_hammer_prices_source ON hammer_prices(source)",
        "ALTER TABLE score_performance ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP",
        "ALTER TABLE user_signals ADD COLUMN IF NOT EXISTS duration_seconds INTEGER",
        # performance indexes
        "CREATE INDEX IF NOT EXISTS idx_lots_deal_score ON lots(deal_score DESC) WHERE deal_score IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS idx_lots_created_at ON lots(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_lots_artist_name ON lots(artist_name_raw)",
        "CREATE INDEX IF NOT EXISTS idx_lots_category ON lots(category)",
        "CREATE INDEX IF NOT EXISTS idx_lots_auction_date ON lots(auction_date)",
    ]
    for sql in migrations:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
        except Exception as e:
            logger.warning("migration_skipped", sql=sql[:60], error=str(e))

    logger.info("Database migrations applied")


async def check_db_connection():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("Database connection failed", error=str(e))
        return False
