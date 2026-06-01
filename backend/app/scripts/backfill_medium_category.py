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

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.jobs.quality_filter import normalize_medium_category

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5000"))
DRY_RUN    = os.getenv("DRY_RUN", "0") == "1"


def _get_db_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    from app.config import settings
    return settings.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)


async def run() -> None:
    engine = create_async_engine(_get_db_url(), pool_pre_ping=True)
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

        offset = 0
        updated = 0

        while True:
            # Fetch a batch of (id, medium) where medium_category is NULL
            rows = (await session.execute(
                text(
                    "SELECT id, medium FROM hammer_prices "
                    "WHERE medium_category IS NULL "
                    "ORDER BY id "
                    "LIMIT :limit OFFSET :offset"
                ),
                {"limit": BATCH_SIZE, "offset": offset},
            )).fetchall()

            if not rows:
                break

            # Group by category to minimise round-trips
            by_category: dict[str, list[str]] = {}
            for row_id, medium in rows:
                cat = normalize_medium_category(medium)
                by_category.setdefault(cat, []).append(str(row_id))

            for cat, ids in by_category.items():
                # Use ANY(:ids) — safe, no interpolation
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

            if len(rows) < BATCH_SIZE:
                break
            offset += BATCH_SIZE

        log.info(f"Done — {updated} rows backfilled.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
