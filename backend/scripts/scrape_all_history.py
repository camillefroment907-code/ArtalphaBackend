"""
Backfill Artsy auction history for all artists in the lots table.

For each artist with < MIN_RECORDS in hammer_prices:
  1. Query Artsy GraphQL (public API, no key needed)
  2. Save results via hammer_price_saver
  3. Report progress

Run from backend/ directory:
    python3 scripts/scrape_all_history.py

Options (env vars):
    MIN_RECORDS=500   skip artists already above this threshold (default 500)
    MAX_PER_ARTIST=1000  max hammer records to fetch per artist (default 1000)
    SLEEP=2.0         seconds between Artsy requests (default 2.0)
"""

import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import re
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.config import get_settings
from app.scrapers.artsy_historical_scraper import fetch_artist_auction_results
from app.scrapers.hammer_price_saver import save_hammer_prices

settings = get_settings()

MIN_RECORDS   = int(os.environ.get("MIN_RECORDS",   500))
MAX_PER_ARTIST = int(os.environ.get("MAX_PER_ARTIST", 1000))
SLEEP          = float(os.environ.get("SLEEP",         2.0))


# ── DB engine ─────────────────────────────────────────────────────────────────
def _make_async_url(url: str) -> tuple[str, dict]:
    connect_args: dict = {}
    for param in ("sslmode", "channel_binding"):
        url = re.sub(rf"[?&]{param}=[^&]*", "", url)
    url = url.rstrip("?&")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if "neon.tech" in url:
        connect_args = {"ssl": "require"}
    return url, connect_args

_db_url, _connect_args = _make_async_url(settings.database_url)
engine = create_async_engine(_db_url, echo=False, pool_pre_ping=True, connect_args=_connect_args)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


# ── Main ──────────────────────────────────────────────────────────────────────
async def main():
    print("── Artsy history backfill ──────────────────────────────────────")
    print(f"   MIN_RECORDS={MIN_RECORDS}  MAX_PER_ARTIST={MAX_PER_ARTIST}  SLEEP={SLEEP}s\n")

    async with AsyncSessionLocal() as db:

        # 1. All distinct artist names ordered by lot count (most important first)
        result = await db.execute(text("""
            SELECT artist_name_raw, COUNT(*) n
            FROM lots
            WHERE artist_name_raw IS NOT NULL AND artist_name_raw != ''
            GROUP BY artist_name_raw
            ORDER BY COUNT(*) DESC
        """))
        all_artists = result.fetchall()
        print(f"Found {len(all_artists)} distinct artists in lots\n")

        done = 0
        skipped = 0
        failed = 0
        total_saved = 0

        for i, row in enumerate(all_artists):
            name: str = (row[0] or "").strip()
            lot_count: int = row[1]
            if not name:
                continue

            # 2. Check existing hammer records
            existing = await db.execute(
                text("SELECT COUNT(*) FROM hammer_prices WHERE artist_name ILIKE :name"),
                {"name": f"%{name}%"}
            )
            count = existing.scalar() or 0

            if count >= MIN_RECORDS:
                print(f"  ✓  [{i+1}/{len(all_artists)}] {name} — {count} records, skipping")
                skipped += 1
                continue

            print(f"  →  [{i+1}/{len(all_artists)}] {name} ({lot_count} lots, {count} existing) — fetching Artsy…")

            try:
                prices = await fetch_artist_auction_results(
                    artist_name=name,
                    artsy_token=None,  # public API
                    max_results=MAX_PER_ARTIST,
                )

                if not prices:
                    print(f"     ✗  No Artsy data found")
                    failed += 1
                    await asyncio.sleep(SLEEP)
                    continue

                saved = await save_hammer_prices(prices, db)
                total_saved += saved
                print(f"     ✓  {len(prices)} fetched, {saved} new saved (total: {count + saved})")
                done += 1

            except Exception as e:
                print(f"     ✗  Error: {e}")
                failed += 1

            await asyncio.sleep(SLEEP)

    elapsed = time.time()
    print(f"\n── Done ──────────────────────────────────────────────────────────")
    print(f"   Enriched: {done}  |  Skipped (already full): {skipped}  |  Not on Artsy: {failed}")
    print(f"   New hammer records saved: {total_saved:,}")


if __name__ == "__main__":
    asyncio.run(main())
