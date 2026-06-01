"""
P0 Backfill: hammer_prices ← sold lots + re-normalize artist names.

Runs three steps in order:

  Step 1 — Re-normalize hammer_prices.artist_name_normalized
    Clears and rebuilds using the fixed normalize_artist_name() (handles
    "SURNAME Firstname", "Lastname, Firstname", parenthetical dates).

  Step 2 — Backfill hammer_prices from sold lots
    All lots with status='sold' AND current_price > 0 are inserted into
    hammer_prices (idempotent — external_id = 'lot-<external_id>').
    Prices are converted to EUR using static FX rates for non-EUR currencies.

  Step 3 — Refresh hammer_artist_stats
    Recomputes avg/median/count per normalized artist name (min 5 sales).

Run from backend/ directory:
    DATABASE_URL=<url> python -m app.scripts.backfill_hammer_from_lots

Options (env vars):
    BATCH_SIZE=5000    rows per UPDATE batch (default 5000)
    MIN_SALES=5        min sales for hammer_artist_stats (default 5)
    DRY_RUN=1          print counts only, no writes
"""
import asyncio
import os
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.database import BgSessionLocal
from app.jobs.quality_filter import normalize_artist_name, is_unknown_artist

BATCH_SIZE  = int(os.getenv("BATCH_SIZE", "5000"))
MIN_SALES   = int(os.getenv("MIN_SALES", "5"))
DRY_RUN     = os.getenv("DRY_RUN", "0") == "1"
SKIP_STEP1  = os.getenv("SKIP_STEP1", "0") == "1"

# Static FX rates → EUR (same as artsy_historical_scraper)
_FX: dict[str, float] = {
    "USD": 0.92, "GBP": 1.17, "EUR": 1.0, "CHF": 1.05,
    "HKD": 0.12, "AUD": 0.60, "CAD": 0.68, "JPY": 0.0062,
}


def _to_eur(amount: float | None, currency: str | None) -> float | None:
    if amount is None or amount <= 0:
        return None
    rate = _FX.get((currency or "EUR").upper(), 0.92)
    return round(amount * rate, 2)


async def step0_ensure_constraints(session) -> None:
    """Ensure schema prerequisites: UNIQUE on external_id, normalized column."""
    print("\n── Step 0: Ensure schema constraints ──")
    await session.execute(text("""
        ALTER TABLE hammer_prices
        ADD COLUMN IF NOT EXISTS artist_name_normalized VARCHAR(500)
    """))
    # ON CONFLICT (external_id) requires a unique constraint.
    await session.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_hammer_prices_external_id
        ON hammer_prices (external_id)
    """))
    await session.commit()
    print("  Constraints OK.")


async def step1_renormalize(session) -> int:
    """Clear artist_name_normalized and recompute with fixed function."""
    print("\n── Step 1: Re-normalize hammer_prices.artist_name_normalized ──")

    # Column already ensured in step0
    await session.commit()

    # Count total rows
    total = (await session.execute(
        text("SELECT COUNT(*) FROM hammer_prices WHERE artist_name IS NOT NULL")
    )).scalar() or 0
    print(f"  Total rows with artist_name: {total:,}")

    if DRY_RUN:
        print("  DRY_RUN — skipping writes.")
        return 0

    # Clear existing normalization (force full rebuild)
    await session.execute(text(
        "UPDATE hammer_prices SET artist_name_normalized = NULL WHERE artist_name IS NOT NULL"
    ))
    await session.commit()
    print(f"  Cleared {total:,} rows — rebuilding …")

    updated = 0
    start = time.time()
    while True:
        rows = (await session.execute(text("""
            SELECT id::text, artist_name
            FROM hammer_prices
            WHERE artist_name_normalized IS NULL AND artist_name IS NOT NULL
            ORDER BY id
            LIMIT :lim
        """), {"lim": BATCH_SIZE})).fetchall()
        if not rows:
            break

        params = [{"id": r[0], "norm": normalize_artist_name(r[1])} for r in rows]
        await session.execute(text("""
            UPDATE hammer_prices
            SET artist_name_normalized = :norm
            WHERE id = CAST(:id AS UUID)
        """), params)
        await session.commit()

        updated += len(rows)
        elapsed = time.time() - start
        rate = updated / elapsed if elapsed > 0 else 0
        print(f"  {updated:,} / {total:,}  ({rate:.0f} rows/s)", end="\r")

    print(f"\n  Done — {updated:,} rows re-normalized in {time.time()-start:.1f}s")

    # Recreate index
    await session.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_hammer_prices_artist_normalized
        ON hammer_prices (artist_name_normalized)
    """))
    await session.commit()
    print("  Index ix_hammer_prices_artist_normalized present.")
    return updated


async def step2_backfill_from_lots(session) -> int:
    """Insert sold lots into hammer_prices."""
    print("\n── Step 2: Backfill hammer_prices from sold lots ──")

    # Lots with sold status, a price, and artist name
    rows = (await session.execute(text("""
        SELECT
            external_id,
            artist_name_raw,
            title,
            auction_date,
            current_price,
            currency,
            estimate_low,
            estimate_high,
            auction_house_name,
            lot_number,
            source,
            image_url
        FROM lots
        WHERE status = 'sold'
          AND current_price IS NOT NULL
          AND current_price > 0
          AND artist_name_raw IS NOT NULL
        ORDER BY auction_date DESC
    """))).fetchall()
    print(f"  Sold lots with price: {len(rows):,}")

    if DRY_RUN:
        print("  DRY_RUN — skipping writes.")
        return 0

    inserted = 0
    skipped = 0
    import uuid

    for row in rows:
        ext_id = f"lot-{row.external_id}" if row.external_id else None
        if not ext_id:
            skipped += 1
            continue

        # Skip anonymous / "unknown artist" entries — they would aggregate
        # prices from unrelated works under a single fake "artist" key.
        if is_unknown_artist(row.artist_name_raw):
            skipped += 1
            continue

        # Check for existing entry
        exists = (await session.execute(
            text("SELECT 1 FROM hammer_prices WHERE external_id = :eid LIMIT 1"),
            {"eid": ext_id}
        )).fetchone()
        if exists:
            skipped += 1
            continue

        currency = (row.currency or "EUR").upper()
        hammer_eur = _to_eur(row.current_price, currency)
        if hammer_eur is None:
            skipped += 1
            continue

        artist_norm = normalize_artist_name(row.artist_name_raw or "")

        await session.execute(text("""
            INSERT INTO hammer_prices (
                id, external_id, artist_name, artist_name_normalized,
                artwork_title, sale_date,
                hammer_price, currency, hammer_price_eur,
                estimate_low, estimate_high,
                auction_house, lot_number, source, image_url, created_at
            ) VALUES (
                :id, :external_id, :artist_name, :artist_name_normalized,
                :artwork_title, :sale_date,
                :hammer_price, :currency, :hammer_price_eur,
                :estimate_low, :estimate_high,
                :auction_house, :lot_number, :source, :image_url, :created_at
            )
        """), {
            "id": str(uuid.uuid4()),
            "external_id": ext_id,
            "artist_name": row.artist_name_raw,
            "artist_name_normalized": artist_norm,
            "artwork_title": row.title,
            "sale_date": row.auction_date,
            "hammer_price": row.current_price,
            "currency": currency,
            "hammer_price_eur": hammer_eur,
            "estimate_low": row.estimate_low,
            "estimate_high": row.estimate_high,
            "auction_house": row.auction_house_name,
            "lot_number": row.lot_number,
            "source": str(row.source) if row.source else "unknown",
            "image_url": row.image_url,
            "created_at": datetime.utcnow(),
        })
        inserted += 1

        if inserted % 500 == 0:
            await session.commit()
            print(f"  Inserted {inserted:,} …", end="\r")

    await session.commit()
    print(f"\n  Inserted {inserted:,} new hammer_prices rows  (skipped {skipped:,})")
    return inserted


async def step3_refresh_stats(session, min_sales: int = MIN_SALES) -> int:
    """Recompute hammer_artist_stats from hammer_prices."""
    from app.jobs.quality_filter import _UNKNOWN_ARTIST_NORMALIZED
    print(f"\n── Step 3: Refresh hammer_artist_stats (min {min_sales} sales) ──")

    # Build SQL exclusion list for unknown-artist normalized strings.
    # These are already normalized, so we can use a literal IN clause.
    _excl = ", ".join(f"'{v}'" for v in sorted(_UNKNOWN_ARTIST_NORMALIZED))

    if DRY_RUN:
        preview = (await session.execute(text(f"""
            SELECT COUNT(DISTINCT artist_name_normalized)
            FROM hammer_prices
            WHERE artist_name_normalized IS NOT NULL
              AND artist_name_normalized <> ''
              AND artist_name_normalized NOT IN ({_excl})
              AND hammer_price_eur IS NOT NULL
              AND hammer_price_eur > 0
            GROUP BY artist_name_normalized
            HAVING COUNT(*) >= {min_sales}
        """))).fetchall()
        print(f"  DRY_RUN — {len(preview):,} artists would be written.")
        return 0

    await session.execute(text("""
        CREATE TABLE IF NOT EXISTS hammer_artist_stats (
            artist_name_normalized VARCHAR(500) PRIMARY KEY,
            avg_eur                FLOAT,
            median_eur             FLOAT,
            sale_count             INTEGER DEFAULT 0,
            last_updated           TIMESTAMP DEFAULT NOW()
        )
    """))

    await session.execute(text(f"""
        INSERT INTO hammer_artist_stats (
            artist_name_normalized, avg_eur, median_eur, sale_count, last_updated
        )
        SELECT
            artist_name_normalized,
            AVG(hammer_price_eur)                                        AS avg_eur,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hammer_price_eur) AS median_eur,
            COUNT(*)                                                      AS sale_count,
            NOW()                                                         AS last_updated
        FROM hammer_prices
        WHERE artist_name_normalized IS NOT NULL
          AND artist_name_normalized <> ''
          AND artist_name_normalized NOT IN ({_excl})
          AND hammer_price_eur IS NOT NULL
          AND hammer_price_eur > 0
        GROUP BY artist_name_normalized
        HAVING COUNT(*) >= {min_sales}
        ON CONFLICT (artist_name_normalized) DO UPDATE
            SET avg_eur      = EXCLUDED.avg_eur,
                median_eur   = EXCLUDED.median_eur,
                sale_count   = EXCLUDED.sale_count,
                last_updated = NOW()
    """))
    await session.commit()

    n = (await session.execute(text("SELECT COUNT(*) FROM hammer_artist_stats"))).scalar() or 0
    print(f"  hammer_artist_stats: {n:,} artists with >= {min_sales} sales.")
    return n


MIN_MEDIUM_SALES = int(os.getenv("MIN_MEDIUM_SALES", "3"))


async def step4_refresh_medium_stats(session, min_sales: int = MIN_MEDIUM_SALES) -> int:
    """Build hammer_artist_medium_stats — per artist × medium category (≥3 sales).

    Solves the Warhol problem: a Warhol screenprint must be benchmarked against
    other Warhol prints, not against Warhol oils sold for $50M.
    """
    from app.jobs.quality_filter import _UNKNOWN_ARTIST_NORMALIZED, normalize_medium_category
    _excl = ", ".join(f"'{v}'" for v in sorted(_UNKNOWN_ARTIST_NORMALIZED))

    print(f"\n── Step 4: Refresh hammer_artist_medium_stats (min {min_sales} sales per medium) ──")

    if DRY_RUN:
        preview = (await session.execute(text(f"""
            SELECT COUNT(*)
            FROM (
                SELECT artist_name_normalized, medium
                FROM hammer_prices
                WHERE artist_name_normalized IS NOT NULL
                  AND artist_name_normalized <> ''
                  AND artist_name_normalized NOT IN ({_excl})
                  AND hammer_price_eur IS NOT NULL
                  AND hammer_price_eur > 0
                  AND medium IS NOT NULL
                GROUP BY artist_name_normalized, medium
                HAVING COUNT(*) >= {min_sales}
            ) x
        """))).scalar() or 0
        print(f"  DRY_RUN — ~{preview:,} artist×medium groups would be written.")
        return 0

    await session.execute(text("""
        CREATE TABLE IF NOT EXISTS hammer_artist_medium_stats (
            artist_name_normalized VARCHAR(500) NOT NULL,
            medium_category        VARCHAR(50)  NOT NULL,
            avg_eur                FLOAT,
            median_eur             FLOAT,
            sale_count             INTEGER DEFAULT 0,
            last_updated           TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (artist_name_normalized, medium_category)
        )
    """))
    await session.commit()

    # Pull all rows with a medium value; bucket in Python, then UPSERT.
    rows = (await session.execute(text(f"""
        SELECT artist_name_normalized, medium, hammer_price_eur
        FROM hammer_prices
        WHERE artist_name_normalized IS NOT NULL
          AND artist_name_normalized <> ''
          AND artist_name_normalized NOT IN ({_excl})
          AND hammer_price_eur IS NOT NULL
          AND hammer_price_eur > 0
          AND medium IS NOT NULL
    """))).fetchall()
    print(f"  Rows with medium: {len(rows):,}")

    # Group by (artist_norm, medium_category)
    from collections import defaultdict
    import statistics

    groups: dict[tuple[str, str], list[float]] = defaultdict(list)
    for r in rows:
        cat = normalize_medium_category(r.medium)
        groups[(r.artist_name_normalized, cat)].append(r.hammer_price_eur)

    # Filter to groups with enough sales, build upsert params
    params = []
    for (artist_norm, cat), prices in groups.items():
        if len(prices) < min_sales:
            continue
        params.append({
            "artist_name_normalized": artist_norm,
            "medium_category": cat,
            "avg_eur": round(sum(prices) / len(prices), 2),
            "median_eur": round(statistics.median(prices), 2),
            "sale_count": len(prices),
        })

    if params:
        await session.execute(text("""
            INSERT INTO hammer_artist_medium_stats
                (artist_name_normalized, medium_category, avg_eur, median_eur, sale_count, last_updated)
            VALUES
                (:artist_name_normalized, :medium_category, :avg_eur, :median_eur, :sale_count, NOW())
            ON CONFLICT (artist_name_normalized, medium_category) DO UPDATE
                SET avg_eur      = EXCLUDED.avg_eur,
                    median_eur   = EXCLUDED.median_eur,
                    sale_count   = EXCLUDED.sale_count,
                    last_updated = NOW()
        """), params)
        await session.commit()

    n = (await session.execute(text("SELECT COUNT(*) FROM hammer_artist_medium_stats"))).scalar() or 0
    print(f"  hammer_artist_medium_stats: {n:,} artist×medium groups with >= {min_sales} sales.")
    return n


async def main():
    print("══ P0 Hammer backfill ══════════════════════════════════")
    print(f"  DRY_RUN={DRY_RUN}  BATCH_SIZE={BATCH_SIZE}  MIN_SALES={MIN_SALES}  SKIP_STEP1={SKIP_STEP1}")

    async with BgSessionLocal() as session:
        await step0_ensure_constraints(session)
        if not SKIP_STEP1:
            await step1_renormalize(session)
        else:
            print("\n── Step 1: Skipped (SKIP_STEP1=1) ──")
        await step2_backfill_from_lots(session)
        await step3_refresh_stats(session, MIN_SALES)
        await step4_refresh_medium_stats(session, MIN_MEDIUM_SALES)

    print("\n══ Done ════════════════════════════════════════════════")


if __name__ == "__main__":
    asyncio.run(main())
