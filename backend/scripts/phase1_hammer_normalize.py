"""
Phase 1 — Hammer prices artist normalization + pre-aggregation.

Steps:
  1. Add artist_name_normalized column to hammer_prices (idempotent)
  2. Batch-populate it using normalize_artist_name() — 1.5M rows, chunked
  3. Create index ix_hammer_prices_artist_normalized
  4. Create hammer_artist_stats table (if not exists)
  5. Populate/refresh hammer_artist_stats (only artists with >= MIN_SALES sales)

Run from backend/ directory:
    python3 scripts/phase1_hammer_normalize.py

Options (env vars):
    BATCH_SIZE=5000   rows per UPDATE batch (default 5000)
    MIN_SALES=5       minimum sales required for hammer_artist_stats (default 5)
    DRY_RUN=1         print counts only, no writes
"""

import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import BgSessionLocal

# Import the canonical normalize function
from app.jobs.quality_filter import normalize_artist_name

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5000"))
MIN_SALES  = int(os.getenv("MIN_SALES", "5"))
DRY_RUN    = os.getenv("DRY_RUN", "0") == "1"


async def main():
    async with BgSessionLocal() as session:

        # ── Step 1: Add column (idempotent) ──────────────────────────────────
        print("Step 1: Adding artist_name_normalized column to hammer_prices …")
        await session.execute(text("""
            ALTER TABLE hammer_prices
            ADD COLUMN IF NOT EXISTS artist_name_normalized VARCHAR(500)
        """))
        await session.commit()
        print("  Column present.")

        # ── Step 2: Count how many rows need normalization ────────────────────
        result = await session.execute(text("""
            SELECT COUNT(*) FROM hammer_prices
            WHERE artist_name_normalized IS NULL AND artist_name IS NOT NULL
        """))
        total_null = result.scalar()
        print(f"Step 2: {total_null:,} rows need normalization (batch size {BATCH_SIZE:,})")

        if DRY_RUN:
            print("  DRY_RUN=1 — skipping writes.")
        else:
            # Fetch rows with NULL normalized name, process in Python, batch-UPDATE
            offset = 0
            updated = 0
            start = time.time()

            while True:
                rows_result = await session.execute(text("""
                    SELECT id::text, artist_name
                    FROM hammer_prices
                    WHERE artist_name_normalized IS NULL AND artist_name IS NOT NULL
                    ORDER BY id
                    LIMIT :lim
                """), {"lim": BATCH_SIZE})
                rows = rows_result.fetchall()
                if not rows:
                    break

                params = [
                    {"id": row[0], "norm": normalize_artist_name(row[1])}
                    for row in rows
                ]
                await session.execute(text("""
                    UPDATE hammer_prices
                    SET artist_name_normalized = :norm
                    WHERE id = CAST(:id AS UUID)
                """), params)
                await session.commit()

                updated += len(rows)
                elapsed = time.time() - start
                rate = updated / elapsed if elapsed > 0 else 0
                print(f"  Normalized {updated:,} / {total_null:,} rows  ({rate:.0f}/s)", end="\r")

            print(f"\n  Done — {updated:,} rows normalized in {time.time()-start:.1f}s")

        # ── Step 3: Create index ──────────────────────────────────────────────
        print("Step 3: Creating index ix_hammer_prices_artist_normalized …")
        if not DRY_RUN:
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_hammer_prices_artist_normalized
                ON hammer_prices (artist_name_normalized)
            """))
            await session.commit()
            print("  Index created.")
        else:
            print("  DRY_RUN — skipped.")

        # ── Step 4: Create hammer_artist_stats table ──────────────────────────
        print("Step 4: Creating hammer_artist_stats table …")
        if not DRY_RUN:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS hammer_artist_stats (
                    artist_name_normalized VARCHAR(500) PRIMARY KEY,
                    avg_eur                FLOAT,
                    median_eur             FLOAT,
                    sale_count             INTEGER DEFAULT 0,
                    last_updated           TIMESTAMP DEFAULT NOW()
                )
            """))
            await session.commit()
            print("  Table present.")

        # ── Step 5: Populate/refresh hammer_artist_stats ─────────────────────
        print(f"Step 5: Populating hammer_artist_stats (min {MIN_SALES} sales) …")
        if not DRY_RUN:
            await session.execute(text(f"""
                INSERT INTO hammer_artist_stats (
                    artist_name_normalized, avg_eur, median_eur, sale_count, last_updated
                )
                SELECT
                    artist_name_normalized,
                    AVG(hammer_price_eur)                                   AS avg_eur,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hammer_price_eur) AS median_eur,
                    COUNT(*)                                                 AS sale_count,
                    NOW()                                                    AS last_updated
                FROM hammer_prices
                WHERE
                    artist_name_normalized IS NOT NULL
                    AND artist_name_normalized <> ''
                    AND hammer_price_eur IS NOT NULL
                    AND hammer_price_eur > 0
                GROUP BY artist_name_normalized
                HAVING COUNT(*) >= {MIN_SALES}
                ON CONFLICT (artist_name_normalized) DO UPDATE
                    SET avg_eur      = EXCLUDED.avg_eur,
                        median_eur   = EXCLUDED.median_eur,
                        sale_count   = EXCLUDED.sale_count,
                        last_updated = NOW()
            """))
            await session.commit()

            count_res = await session.execute(text("SELECT COUNT(*) FROM hammer_artist_stats"))
            n = count_res.scalar()
            print(f"  hammer_artist_stats: {n:,} artists with >= {MIN_SALES} sales.")
        else:
            # Count preview
            count_res = await session.execute(text(f"""
                SELECT COUNT(DISTINCT artist_name_normalized)
                FROM hammer_prices
                WHERE artist_name_normalized IS NOT NULL AND hammer_price_eur IS NOT NULL
                GROUP BY artist_name_normalized
                HAVING COUNT(*) >= {MIN_SALES}
            """))
            rows = count_res.fetchall()
            print(f"  DRY_RUN — {len(rows):,} artists would be written.")

    print("\nPhase 1 complete.")


if __name__ == "__main__":
    asyncio.run(main())
