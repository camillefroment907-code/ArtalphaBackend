#!/usr/bin/env python3
"""
Standalone bulk ingest script — run directly to fill the DB with lots.

Usage:
    cd backend
    python -m app.scripts.bulk_ingest [--limit 5000] [--skip-purge] [--skip-rationale]

Or via the admin API:
    POST /api/admin/bulk-ingest
    X-Admin-Key: hono-admin-2024
    {"limit_per_source": 5000, "skip_purge": true}

This script runs the full pipeline:
  1. Fetch lots from all enabled connectors (including past/historical sources)
  2. Quality filter + cross-source dedup
  3. Score each lot
  4. Insert new lots into DB
  5. Print a summary by source
"""
import asyncio
import argparse
import os
import sys
import time
from collections import Counter

# Make sure we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


async def run_ingest(limit_per_source: int, skip_purge: bool, skip_rationale: bool):
    import structlog
    from app.jobs.tasks import _poll_and_score_async

    logger = structlog.get_logger()
    print(f"\n[bulk_ingest] Starting — limit_per_source={limit_per_source}, skip_purge={skip_purge}, skip_rationale={skip_rationale}")
    print(f"[bulk_ingest] This may take 30-60 minutes for a full run.\n")

    t0 = time.time()
    await _poll_and_score_async(
        lots_per_source=limit_per_source,
        skip_purge=skip_purge,
        skip_rationale=skip_rationale,
    )
    elapsed = time.time() - t0
    print(f"\n[bulk_ingest] Done in {elapsed:.0f}s ({elapsed/60:.1f} min).")
    print("[bulk_ingest] Poll GET /api/admin/lot-count to see updated counts.")


async def print_lot_count():
    """Print current lot count by source."""
    from app.database import BgSessionLocal
    from app.models.db_models import Lot
    from sqlalchemy import select, func

    print("\n[lot-count] Current DB state:")
    async with BgSessionLocal() as session:
        total = (await session.execute(select(func.count(Lot.id)))).scalar() or 0
        print(f"  Total lots: {total}")

        rows = (await session.execute(
            select(Lot.source, func.count(Lot.id)).group_by(Lot.source)
        )).fetchall()
        by_source = sorted(rows, key=lambda r: r[1], reverse=True)
        for src, cnt in by_source:
            print(f"  {src}: {cnt}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Bulk ingest lots into Nautilus DB")
    parser.add_argument("--limit", type=int, default=5000, help="Lots per source (default 5000)")
    parser.add_argument("--skip-purge", action="store_true", default=True, help="Skip purge of expired lots")
    parser.add_argument("--skip-rationale", action="store_true", default=True, help="Skip per-lot OpenAI rationale")
    parser.add_argument("--count-only", action="store_true", help="Just print current lot count and exit")
    args = parser.parse_args()

    if args.count_only:
        asyncio.run(print_lot_count())
        return

    asyncio.run(print_lot_count())
    asyncio.run(run_ingest(
        limit_per_source=args.limit,
        skip_purge=args.skip_purge,
        skip_rationale=args.skip_rationale,
    ))
    asyncio.run(print_lot_count())


if __name__ == "__main__":
    main()
