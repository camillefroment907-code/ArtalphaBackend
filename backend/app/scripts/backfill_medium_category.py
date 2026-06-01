"""
Backfill hammer_prices.medium_category from the existing medium column.

Usage:
    python -m app.scripts.backfill_medium_category

Env:
    DATABASE_URL  — Postgres connection string (falls back to app.config)
    BATCH_SIZE    — rows per UPDATE batch (default 5000)
    DRY_RUN       — set to 1 to print counts without writing
"""
import asyncio
import os
import logging
import ssl
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.jobs.quality_filter import normalize_medium_category

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5000"))
DRY_RUN    = os.getenv("DRY_RUN", "0") == "1"

# asyncpg does not accept sslmode/channel_binding as query params.
# Strip them from the URL and pass ssl=True via connect_args instead.
_ASYNCPG_UNSUPPORTED_PARAMS = {"sslmode", "channel_binding"}


def _parse_db_url() -> tuple[str, dict]:
    """Return (asyncpg_url, connect_args) with SSL handled properly."""
    raw = os.getenv("DATABASE_URL")
    if not raw:
        from app.config import settings
        raw = settings.database_url

    parsed = urlparse(raw)
    params = parse_qs(parsed.query, keep_blank_values=True)

    needs_ssl = params.pop("sslmode", [""])[0] in ("require", "verify-ca", "verify-full")
    params.pop("channel_binding", None)

    clean_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = urlunparse(parsed._replace(query=clean_query))
    clean_url = clean_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    clean_url = clean_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)

    connect_args: dict = {}
    if needs_ssl:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ctx

    return clean_url, connect_args


async def run() -> None:
    db_url, connect_args = _parse_db_url()
    engine = create_async_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Count rows that need backfilling
        result = await session.execute(
            text("SELECT COUNT(*) FROM hammer_prices WHERE medium_category IS NULL")
        )
        total = result.scalar_one()
        log.info(f"Rows to backfill: {total}")

        if total == 0:
            log.info("Nothing to do.")
            return

        if DRY_RUN:
            log.info("DRY_RUN=1 — exiting without writing.")
            return

        updated = 0

        while True:
            # Always fetch from OFFSET 0 — updated rows leave the NULL set,
            # so incrementing offset would double-skip rows.
            rows = (await session.execute(
                text(
                    "SELECT id, medium FROM hammer_prices "
                    "WHERE medium_category IS NULL "
                    "ORDER BY id "
                    "LIMIT :limit"
                ),
                {"limit": BATCH_SIZE},
            )).fetchall()

            if not rows:
                break

            # Group by category to minimise round-trips
            by_category: dict[str, list[str]] = {}
            for row_id, medium in rows:
                cat = normalize_medium_category(medium)
                by_category.setdefault(cat, []).append(str(row_id))

            for cat, ids in by_category.items():
                await session.execute(
                    text(
                        "UPDATE hammer_prices "
                        "SET medium_category = :cat "
                        "WHERE id = ANY(:ids)"
                    ),
                    {"cat": cat, "ids": ids},
                )

            await session.commit()
            updated += len(rows)
            log.info(f"  {updated}/{total} rows updated")

        log.info(f"Done — {updated} rows backfilled.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
