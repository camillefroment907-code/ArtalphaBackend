"""
backfill_artist_real_data.py
────────────────────────────
One-time script (safe to re-run): replaces MD5-based heuristic market metrics
stored in Artist records with real data from HammerArtistStats and
ArtsperArtistSnapshot.

Before this script ran, ingest called _generate_heuristic_enrichment() which
produced fake avg_price, liquidity, popularity, sell_through, trend from an
MD5 hash of the artist name. These values were stored in the Artist table and
corrupted deal scoring (below_market_score) for ~99% of artists.

What this script does:
  - For each Artist with data_confidence < 0.3 (heuristic marker):
      1. Check HammerArtistStats (≥5 sales required for statistical reliability)
      2. Check ArtsperArtistSnapshot (primary market)
      3. If real data found: update avg_auction_price, median, lots_sold, confidence
      4. If no real data: set market metrics to NULL and data_confidence = 0.05

Run:
  cd backend
  python -m app.scripts.backfill_artist_real_data
"""

import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.db_models import Artist, HammerArtistStats, ArtsperArtistSnapshot
from app.jobs.quality_filter import normalize_artist_name
import structlog

logger = structlog.get_logger()

BATCH_SIZE = 500


async def backfill():
    # Fetch IDs only — fast single query, avoids loading 57K ORM objects at once
    async with AsyncSessionLocal() as session:
        id_result = await session.execute(
            select(Artist.id).where(
                (Artist.data_confidence < 0.3)
                | Artist.data_confidence.is_(None)
                | (Artist.cagr_source == 'TIER_FALLBACK')
            )
        )
        all_ids = [row[0] for row in id_result.all()]

    logger.info("Artists to backfill", count=len(all_ids))

    updated_with_real = 0
    nulled_out = 0

    # Process in batches — new session per batch avoids Neon connection timeout
    for batch_start in range(0, len(all_ids), BATCH_SIZE):
        batch_ids = all_ids[batch_start:batch_start + BATCH_SIZE]
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Artist).where(Artist.id.in_(batch_ids))
            )
            artists = result.scalars().all()

            for artist in artists:
                name_norm = artist.name_normalized or (artist.name or "").lower().strip()
                if not name_norm:
                    continue

                real_avg = None
                real_median = None
                real_lots = None
                real_confidence = 0.05  # default: no data

                # 1. ArtsperArtistSnapshot — primary market
                artsper_res = await session.execute(
                    select(ArtsperArtistSnapshot)
                    .where(ArtsperArtistSnapshot.artist_name_normalized == name_norm)
                    .limit(1)
                )
                artsper = artsper_res.scalar_one_or_none()
                if artsper and artsper.price_avg and artsper.price_avg > 0:
                    real_avg = artsper.price_avg
                    real_confidence = min(real_confidence + 0.20, 1.0)

                # 2. HammerArtistStats — auction history
                hn = normalize_artist_name(artist.name or "")
                if hn:
                    hs_res = await session.execute(
                        select(HammerArtistStats)
                        .where(HammerArtistStats.artist_name_normalized == hn)
                    )
                    hs = hs_res.scalar_one_or_none()
                    if hs and hs.sale_count >= 5 and hs.avg_eur:
                        if not real_avg:
                            real_avg = hs.avg_eur
                        real_median = hs.median_eur
                        real_lots = hs.sale_count
                        real_confidence = min(real_confidence + 0.25, 1.0)

                if real_avg:
                    artist.avg_auction_price = real_avg
                    artist.median_auction_price = real_median
                    if real_lots is not None:
                        artist.total_lots_sold = real_lots
                    # Clear other fake heuristic fields — we don't have real values for these
                    artist.popularity_score = None
                    artist.liquidity_score = None
                    artist.trend = None
                    artist.sell_through_rate = None
                    artist.price_volatility = None
                    artist.data_confidence = real_confidence
                    updated_with_real += 1
                else:
                    # No real data: null out all heuristic market metrics
                    artist.avg_auction_price = None
                    artist.median_auction_price = None
                    artist.popularity_score = None
                    artist.liquidity_score = None
                    artist.trend = None
                    artist.sell_through_rate = None
                    artist.price_volatility = None
                    artist.data_confidence = 0.05
                    nulled_out += 1

            await session.commit()
            logger.info(
                "batch committed",
                batch_start=batch_start,
                batch_end=batch_start + len(artists),
                updated_with_real=updated_with_real,
                nulled_out=nulled_out,
            )

    logger.info(
        "Backfill complete",
        updated_with_real=updated_with_real,
        nulled_out=nulled_out,
        total=len(all_ids),
    )
    return updated_with_real, nulled_out


if __name__ == "__main__":
    updated, nulled = asyncio.run(backfill())
    print(f"Done. {updated} artists updated with real data, {nulled} nulled out (no real data available).")
