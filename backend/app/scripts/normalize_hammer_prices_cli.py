"""
Nautilus — Auction House Normalization CLI.

Safe operational script that validates normalization coverage for
the auction_house column in hammer_prices.

In --dry-run mode (default): reads only, prints a report.
In --confirm mode: backfills auction_house_normalized IF that column exists.

SAFETY RULES:
  1. Never adds a column — the column must already exist (ALTER TABLE is a migration job).
  2. Checks column existence before any writes.
  3. All updates are idempotent (already-normalized rows are skipped).
  4. BATCH_SIZE and LIMIT env vars control volume.

Usage:
    python -m app.scripts.normalize_hammer_prices_cli --dry-run
    python -m app.scripts.normalize_hammer_prices_cli --confirm
    LIMIT=1000 python -m app.scripts.normalize_hammer_prices_cli --dry-run

Env:
    DATABASE_URL  — Postgres connection string (falls back to app.config)
    BATCH_SIZE    — rows per UPDATE batch (default 5000)
    LIMIT         — max distinct house names to process (default all)
"""
import asyncio
import os
import ssl
import sys
import logging
from collections import Counter
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.utils.normalize import normalize_auction_house, AUCTION_HOUSE_CANONICAL

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5000"))
LIMIT: int | None = int(os.getenv("LIMIT", "0")) or None  # 0 means all

# Name of the normalized column — must be added via a migration before --confirm
NORMALIZED_COLUMN = "auction_house_normalized"


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


async def _column_exists(session: AsyncSession, table: str, column: str) -> bool:
    """Check if a column exists in the given table using information_schema."""
    result = await session.execute(
        text("""
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = :table AND column_name = :column
        """),
        {"table": table, "column": column},
    )
    return result.scalar_one() > 0


async def run(confirm: bool = False) -> None:
    """
    Main entry point.

    Args:
        confirm: If True, backfill auction_house_normalized column (if it exists).
                 If False (default), dry-run analysis only.
    """
    db_url, connect_args = _parse_db_url()
    engine = create_async_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:

        # ── Step 1: fetch all distinct auction_house values ───────────────────
        limit_clause = f"LIMIT {LIMIT}" if LIMIT else ""
        log.info(
            f"Fetching distinct auction_house values "
            f"(LIMIT={LIMIT or 'all'})..."
        )

        rows = (await session.execute(
            text(f"""
                SELECT
                    COALESCE(auction_house, '') AS house,
                    COUNT(*) AS cnt
                FROM hammer_prices
                GROUP BY 1
                ORDER BY 2 DESC
                {limit_clause}
            """)
        )).fetchall()

        total_rows = sum(r[1] for r in rows)
        total_distinct = len(rows)
        log.info(
            f"Found {total_distinct} distinct auction_house values "
            f"covering {total_rows:,} rows"
        )

        # ── Step 2: apply normalization to each distinct value ────────────────
        mapped_count = 0
        passthrough_count = 0
        unknown_count = 0
        unmapped_houses: Counter = Counter()  # raw → count for rows not in the map

        for house_raw, cnt in rows:
            normalized = normalize_auction_house(house_raw or None)

            if normalized == "unknown":
                unknown_count += 1
                if house_raw:
                    unmapped_houses[house_raw] += cnt
            elif normalized == (house_raw or "").strip().lower():
                # Passed through unchanged (not in map, not empty)
                passthrough_count += 1
                unmapped_houses[house_raw] += cnt
            else:
                mapped_count += 1

        # ── Step 3: print report ──────────────────────────────────────────────
        print()
        print("=" * 60)
        print("Auction House Normalization Coverage Report")
        print("=" * 60)
        print(f"Total distinct values:   {total_distinct}")
        print(f"Total rows covered:      {total_rows:,}")
        print(f"Mapped to canonical:     {mapped_count}  ({_pct(mapped_count, total_distinct)}%)")
        print(f"Passed through (unmapped): {passthrough_count}")
        print(f"Empty → 'unknown':       {unknown_count}")
        print()
        print("Top 20 unmapped house names (extend AUCTION_HOUSE_CANONICAL with these):")
        print("-" * 60)
        top_unmapped = unmapped_houses.most_common(20)
        if top_unmapped:
            for house, cnt in top_unmapped:
                suggested = normalize_auction_house(house)
                print(f"  [{cnt:6,} rows] {house!r:50s} → '{suggested}'")
        else:
            print("  None — all houses mapped!")
        print()

        # ── Step 4: write if --confirm and column exists ──────────────────────
        if not confirm:
            log.info("Dry-run mode — no writes. Use --confirm to backfill.")
            await engine.dispose()
            return

        col_exists = await _column_exists(session, "hammer_prices", NORMALIZED_COLUMN)
        if not col_exists:
            log.warning(
                f"Column '{NORMALIZED_COLUMN}' does not exist on hammer_prices. "
                f"Add it via a migration first:\n"
                f"  ALTER TABLE hammer_prices ADD COLUMN {NORMALIZED_COLUMN} VARCHAR(200);\n"
                f"Then re-run with --confirm."
            )
            await engine.dispose()
            return

        log.info(
            f"Column '{NORMALIZED_COLUMN}' found — starting backfill "
            f"(BATCH_SIZE={BATCH_SIZE})..."
        )

        # Batch backfill using cursor-based pagination
        processed = 0
        last_id = None

        while True:
            if last_id is None:
                batch_rows = (await session.execute(
                    text(
                        f"SELECT id, auction_house FROM hammer_prices "
                        f"WHERE {NORMALIZED_COLUMN} IS NULL "
                        f"ORDER BY id LIMIT :limit"
                    ),
                    {"limit": BATCH_SIZE},
                )).fetchall()
            else:
                batch_rows = (await session.execute(
                    text(
                        f"SELECT id, auction_house FROM hammer_prices "
                        f"WHERE {NORMALIZED_COLUMN} IS NULL AND id > :last_id "
                        f"ORDER BY id LIMIT :limit"
                    ),
                    {"last_id": last_id, "limit": BATCH_SIZE},
                )).fetchall()

            if not batch_rows:
                break

            # Group by normalized value to minimize round-trips
            by_normalized: dict[str, list] = {}
            for row_id, house_raw in batch_rows:
                normalized = normalize_auction_house(house_raw)
                by_normalized.setdefault(normalized, []).append(str(row_id))

            for norm_val, ids in by_normalized.items():
                await session.execute(
                    text(
                        f"UPDATE hammer_prices "
                        f"SET {NORMALIZED_COLUMN} = :val "
                        f"WHERE id::TEXT = ANY(:ids)"
                    ),
                    {"val": norm_val, "ids": ids},
                )

            await session.commit()
            processed += len(batch_rows)
            last_id = batch_rows[-1][0]
            log.info(f"  {processed:,} rows backfilled...")

        log.info(f"Done — {processed:,} rows updated with {NORMALIZED_COLUMN}.")

    await engine.dispose()


def _pct(num: int, denom: int) -> str:
    if denom == 0:
        return "0.0"
    return f"{num / denom * 100:.1f}"


if __name__ == "__main__":
    confirm = "--confirm" in sys.argv
    asyncio.run(run(confirm=confirm))
