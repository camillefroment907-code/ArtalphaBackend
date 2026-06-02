"""
Compute and persist Artist Cycle Intelligence stats.

For every artist in the `artists` table that has records in `hammer_prices`,
compute:
  - Eligibility (minimum sales, recent activity, estimate coverage)
  - Segment performance: medium / size / house / month / season
  - Best configuration (highest Wilson-lower-bound per dimension)

Usage:
    python -m app.scripts.compute_artist_cycle_stats [OPTIONS]

Options:
    --artist TEXT     Compute for a specific artist (UUID or name, partial match OK)
    --limit INT       Process at most N artists (default: all)
    --dry-run         Print results without writing to DB (default if --confirm absent)
    --confirm         Actually write results to DB (required for bulk writes)
    --min-sales INT   Override MIN_TOTAL_SALES threshold (default: 20)

Examples:
    # Dry run for all artists
    python -m app.scripts.compute_artist_cycle_stats

    # Dry run for one artist by name
    python -m app.scripts.compute_artist_cycle_stats --artist "Picasso"

    # Write all eligible artists to DB
    python -m app.scripts.compute_artist_cycle_stats --confirm

    # Write up to 50 artists
    python -m app.scripts.compute_artist_cycle_stats --limit 50 --confirm

Env:
    DATABASE_URL — Postgres connection string (asyncpg format)

Safety:
    Without --confirm, the script always runs in dry-run mode.
    Dry run prints a summary but never writes to the DB.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta, date
from typing import Optional
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

# Make sure the app package is importable when running as __main__
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from app.engines.cycle_intelligence import (
    is_artist_eligible,
    compute_all_segment_stats,
    select_best_config,
    month_to_season,
    MIN_TOTAL_SALES,
    MIN_RECENT_SALES_3Y,
    MIN_ESTIMATE_COVERAGE,
)
from app.utils.normalize import (
    normalize_auction_house,
    parse_dimensions_cm,
    size_bucket,
    normalize_medium_category,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


# ── DB setup (mirrors backfill_hammer_signatures.py pattern) ─────────────────

def _make_engine(database_url: Optional[str] = None) -> object:
    raw_url = database_url or os.environ.get("DATABASE_URL", "")
    if not raw_url:
        raise RuntimeError("DATABASE_URL environment variable is not set.")

    # Strip incompatible query params
    for param in ("sslmode", "channel_binding"):
        import re
        raw_url = re.sub(rf"[?&]{param}=[^&]*", "", raw_url)
    raw_url = raw_url.rstrip("?&")

    if raw_url.startswith("postgresql://"):
        raw_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    connect_args: dict = {}
    if "neon.tech" in raw_url or os.environ.get("DB_SSL", "") == "require":
        connect_args = {"ssl": "require"}

    return create_async_engine(raw_url, poolclass=NullPool, connect_args=connect_args)


# ── Core computation ──────────────────────────────────────────────────────────

async def _fetch_artist_hammer_rows(
    db: AsyncSession,
    artist_name_normalized: str,
) -> list[dict]:
    """
    Fetch all hammer_prices rows for a normalized artist name.

    Returns list of dicts with keys:
        hammer_price_eur, estimate_low, medium_category,
        dimensions, auction_house, sale_date
    """
    result = await db.execute(
        text("""
            SELECT
                hammer_price_eur,
                hammer_price,
                estimate_low,
                medium_category,
                medium,
                dimensions,
                auction_house,
                sale_date
            FROM hammer_prices
            WHERE artist_name_normalized = :artist
              AND sale_date IS NOT NULL
              AND (hammer_price_eur IS NOT NULL OR hammer_price IS NOT NULL)
            ORDER BY sale_date ASC
        """),
        {"artist": artist_name_normalized},
    )
    rows = result.fetchall()
    out = []
    for r in rows:
        (hp_eur, hp_raw, est_low, med_cat, medium, dims, house, sale_date) = r

        # Prefer EUR price, fall back to raw
        price = hp_eur or hp_raw

        # Normalize medium category
        cat = med_cat or normalize_medium_category(medium) or "unknown"

        # Normalize auction house
        house_norm = normalize_auction_house(house) if house else "unknown"

        # Parse dimensions
        dim_parsed = parse_dimensions_cm(dims)
        sz = size_bucket(dim_parsed["width_cm"], dim_parsed["height_cm"])

        # Sale date → month + season
        sd = sale_date
        if isinstance(sd, datetime):
            month = sd.month
        elif isinstance(sd, date):
            month = sd.month
        else:
            month = None

        season = month_to_season(month) if month is not None else "unknown"

        out.append({
            "hammer_price_eur": price,
            "estimate_low": est_low,
            "medium_category": cat,
            "size_bkt": sz if sz != "unknown" else None,
            "auction_house_norm": house_norm,
            "sale_month": month,
            "sale_season": season,
            "sale_date": sale_date,
        })
    return out


async def _count_recent_sales(
    db: AsyncSession,
    artist_name_normalized: str,
    cutoff: date,
) -> int:
    """Count sales in the last 3 years."""
    result = await db.execute(
        text("""
            SELECT COUNT(*) FROM hammer_prices
            WHERE artist_name_normalized = :artist
              AND sale_date >= :cutoff
              AND (hammer_price_eur IS NOT NULL OR hammer_price IS NOT NULL)
        """),
        {"artist": artist_name_normalized, "cutoff": cutoff},
    )
    row = result.fetchone()
    return row[0] if row else 0


async def compute_for_artist(
    db: AsyncSession,
    artist_id: str,
    artist_name: str,
    artist_name_normalized: str,
    *,
    min_total: int = MIN_TOTAL_SALES,
    min_recent: int = MIN_RECENT_SALES_3Y,
    min_coverage: float = MIN_ESTIMATE_COVERAGE,
) -> dict:
    """
    Compute full cycle stats for a single artist.

    Returns a dict ready to upsert into artist_cycle_stats.
    """
    rows = await _fetch_artist_hammer_rows(db, artist_name_normalized)
    total_sales = len(rows)

    # Recent sales (last 3 years)
    cutoff = date.today() - timedelta(days=3 * 365)
    recent_sales = await _count_recent_sales(db, artist_name_normalized, cutoff)

    # Estimate coverage
    n_with_est = sum(1 for r in rows if r.get("estimate_low") is not None)
    coverage = n_with_est / total_sales if total_sales > 0 else 0.0

    # Eligibility
    eligible, reason = is_artist_eligible(
        total_sales, recent_sales, coverage,
        min_total=min_total, min_recent=min_recent, min_coverage=min_coverage,
    )

    result: dict = {
        "artist_id": artist_id,
        "computed_at": datetime.utcnow(),
        "is_eligible": eligible,
        "total_sales": total_sales,
        "recent_sales_3y": recent_sales,
        "estimate_coverage": round(coverage, 4),
        # Default nulls
        "best_medium": None, "best_medium_wilson": None,
        "best_size": None,   "best_size_wilson": None,
        "best_house": None,  "best_house_wilson": None,
        "best_month": None,  "best_month_wilson": None,
        "best_season": None, "best_season_wilson": None,
        "medium_stats": None, "size_stats": None,
        "house_stats": None,  "month_stats": None,
        "season_stats": None,
    }

    if not eligible:
        log.debug("Artist %s (%s) ineligible: %s", artist_name, artist_id, reason)
        return result

    # Compute segment stats
    all_stats = compute_all_segment_stats(rows, min_segment_sales=3)
    best = select_best_config(all_stats, min_sales=5)

    # best_month from string key → integer
    best_month_raw = best.get("best_month")
    try:
        best_month_int = int(best_month_raw) if best_month_raw is not None else None
    except (ValueError, TypeError):
        best_month_int = None

    result.update({
        "best_medium":        best.get("best_medium"),
        "best_medium_wilson": best.get("best_medium_wilson"),
        "best_size":          best.get("best_size"),
        "best_size_wilson":   best.get("best_size_wilson"),
        "best_house":         best.get("best_house"),
        "best_house_wilson":  best.get("best_house_wilson"),
        "best_month":         best_month_int,
        "best_month_wilson":  best.get("best_month_wilson"),
        "best_season":        best.get("best_season"),
        "best_season_wilson": best.get("best_season_wilson"),
        "medium_stats": all_stats.get("medium"),
        "size_stats":   all_stats.get("size"),
        "house_stats":  all_stats.get("house"),
        "month_stats":  all_stats.get("month"),
        "season_stats": all_stats.get("season"),
    })
    return result


async def upsert_artist_cycle_stats(db: AsyncSession, stats: dict) -> None:
    """Upsert one artist_cycle_stats row (INSERT ... ON CONFLICT DO UPDATE)."""
    await db.execute(
        text("""
            INSERT INTO artist_cycle_stats (
                id, artist_id, computed_at,
                is_eligible, total_sales, recent_sales_3y, estimate_coverage,
                best_medium, best_medium_wilson,
                best_size, best_size_wilson,
                best_house, best_house_wilson,
                best_month, best_month_wilson,
                best_season, best_season_wilson,
                medium_stats, size_stats, house_stats, month_stats, season_stats
            )
            VALUES (
                gen_random_uuid(), :artist_id, :computed_at,
                :is_eligible, :total_sales, :recent_sales_3y, :estimate_coverage,
                :best_medium, :best_medium_wilson,
                :best_size, :best_size_wilson,
                :best_house, :best_house_wilson,
                :best_month, :best_month_wilson,
                :best_season, :best_season_wilson,
                :medium_stats, :size_stats, :house_stats, :month_stats, :season_stats
            )
            ON CONFLICT (artist_id) DO UPDATE SET
                computed_at         = EXCLUDED.computed_at,
                is_eligible         = EXCLUDED.is_eligible,
                total_sales         = EXCLUDED.total_sales,
                recent_sales_3y     = EXCLUDED.recent_sales_3y,
                estimate_coverage   = EXCLUDED.estimate_coverage,
                best_medium         = EXCLUDED.best_medium,
                best_medium_wilson  = EXCLUDED.best_medium_wilson,
                best_size           = EXCLUDED.best_size,
                best_size_wilson    = EXCLUDED.best_size_wilson,
                best_house          = EXCLUDED.best_house,
                best_house_wilson   = EXCLUDED.best_house_wilson,
                best_month          = EXCLUDED.best_month,
                best_month_wilson   = EXCLUDED.best_month_wilson,
                best_season         = EXCLUDED.best_season,
                best_season_wilson  = EXCLUDED.best_season_wilson,
                medium_stats        = EXCLUDED.medium_stats,
                size_stats          = EXCLUDED.size_stats,
                house_stats         = EXCLUDED.house_stats,
                month_stats         = EXCLUDED.month_stats,
                season_stats        = EXCLUDED.season_stats
        """),
        {
            "artist_id":         str(stats["artist_id"]),
            "computed_at":       stats["computed_at"],
            "is_eligible":       stats["is_eligible"],
            "total_sales":       stats["total_sales"],
            "recent_sales_3y":   stats["recent_sales_3y"],
            "estimate_coverage": stats["estimate_coverage"],
            "best_medium":       stats["best_medium"],
            "best_medium_wilson": stats["best_medium_wilson"],
            "best_size":         stats["best_size"],
            "best_size_wilson":  stats["best_size_wilson"],
            "best_house":        stats["best_house"],
            "best_house_wilson": stats["best_house_wilson"],
            "best_month":        stats["best_month"],
            "best_month_wilson": stats["best_month_wilson"],
            "best_season":       stats["best_season"],
            "best_season_wilson": stats["best_season_wilson"],
            "medium_stats": stats["medium_stats"],
            "size_stats":   stats["size_stats"],
            "house_stats":  stats["house_stats"],
            "month_stats":  stats["month_stats"],
            "season_stats": stats["season_stats"],
        },
    )
    await db.commit()


# ── Main loop ─────────────────────────────────────────────────────────────────

async def _main(
    artist_filter: Optional[str],
    limit: Optional[int],
    dry_run: bool,
    min_sales: int,
) -> None:
    engine = _make_engine()
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as db:
        # Fetch artists that have at least one hammer_price record
        if artist_filter:
            query = text("""
                SELECT DISTINCT a.id, a.name, a.name_normalized
                FROM artists a
                JOIN hammer_prices hp ON hp.artist_name_normalized = a.name_normalized
                WHERE a.name ILIKE :filter OR a.id::text = :filter
                LIMIT :lim
            """)
            params = {
                "filter": f"%{artist_filter}%",
                "lim": limit or 1000,
            }
        else:
            query = text("""
                SELECT DISTINCT a.id, a.name, a.name_normalized
                FROM artists a
                JOIN hammer_prices hp ON hp.artist_name_normalized = a.name_normalized
                ORDER BY a.name
                LIMIT :lim
            """)
            params = {"lim": limit or 100_000}

        result = await db.execute(query, params)
        artists = result.fetchall()

    log.info("Found %d artists with hammer_price records", len(artists))
    if not artists:
        log.info("Nothing to process.")
        return

    engine2 = _make_engine()
    AsyncSessionLocal2 = sessionmaker(engine2, class_=AsyncSession, expire_on_commit=False)

    n_eligible = 0
    n_ineligible = 0
    n_written = 0

    for artist_id, artist_name, artist_name_normalized in artists:
        if artist_name_normalized is None:
            continue
        try:
            async with AsyncSessionLocal2() as db:
                stats = await compute_for_artist(
                    db,
                    str(artist_id),
                    artist_name,
                    artist_name_normalized,
                    min_total=min_sales,
                )

            if stats["is_eligible"]:
                n_eligible += 1
                log.info(
                    "[ELIGIBLE] %s | total=%d recent=%d coverage=%.0f%% "
                    "best_medium=%s best_house=%s best_season=%s",
                    artist_name,
                    stats["total_sales"] or 0,
                    stats["recent_sales_3y"] or 0,
                    (stats["estimate_coverage"] or 0) * 100,
                    stats["best_medium"],
                    stats["best_house"],
                    stats["best_season"],
                )
            else:
                n_ineligible += 1
                log.debug("[INELIGIBLE] %s | total=%d", artist_name, stats["total_sales"] or 0)

            if not dry_run:
                async with AsyncSessionLocal2() as db:
                    await upsert_artist_cycle_stats(db, stats)
                n_written += 1

        except Exception as exc:
            log.error("Error processing artist %s: %s", artist_name, exc)

    log.info(
        "Done. eligible=%d ineligible=%d written=%d (dry_run=%s)",
        n_eligible, n_ineligible, n_written, dry_run,
    )
    await engine.dispose()
    await engine2.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compute Artist Cycle Intelligence stats for Nautilus"
    )
    parser.add_argument("--artist", type=str, default=None,
                        help="Filter by artist name or UUID")
    parser.add_argument("--limit", type=int, default=None,
                        help="Maximum number of artists to process")
    parser.add_argument("--dry-run", action="store_true", default=False,
                        help="Print results without writing to DB")
    parser.add_argument("--confirm", action="store_true", default=False,
                        help="Write results to DB (required to persist)")
    parser.add_argument("--min-sales", type=int, default=MIN_TOTAL_SALES,
                        help=f"Override minimum total sales threshold (default: {MIN_TOTAL_SALES})")
    args = parser.parse_args()

    # Safety: require --confirm for writes; default to dry-run
    dry_run = not args.confirm
    if dry_run and not args.dry_run:
        log.info("No --confirm flag — running in DRY-RUN mode (no DB writes).")

    asyncio.run(_main(
        artist_filter=args.artist,
        limit=args.limit,
        dry_run=dry_run,
        min_sales=args.min_sales,
    ))


if __name__ == "__main__":
    main()
