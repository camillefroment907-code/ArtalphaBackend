"""
Rescore all lots in the database.

Applies the full scoring pipeline (ArtsperArtistSnapshot + HammerArtistStats + ArtistSignal)
to every lot, overwriting deal_score / is_deal / pct_below_market_avg.

Run from backend/ directory:
    python3 scripts/rescore_all.py

Options (env vars):
    BATCH_SIZE=500   lots per commit batch (default 500)
    STATUS=all       'all' | 'upcoming' | 'live' (default 'all')
    DRY_RUN=1        score but do not commit
"""

import asyncio
import os
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, String
from sqlalchemy.orm import selectinload

from app.database import BgSessionLocal
from app.models.db_models import (
    Lot, Artist, ArtsperArtistSnapshot, ArtistSignal, HammerArtistStats
)
from app.engines.scoring import compute_deal_score, ScoringInput
from app.connectors.aggregator import get_house_reputation
from app.models.schemas import LotNormalized
from app.jobs.quality_filter import normalize_artist_name

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "500"))
STATUS     = os.getenv("STATUS", "all")
DRY_RUN    = os.getenv("DRY_RUN", "0") == "1"

_TRUST_SOURCES = {
    'artsy', 'liveauctioneers', 'invaluable', 'drouot', 'artcurial',
    'phillips', 'bonhams', 'christies', 'sothebys', 'artmarketapi',
    'catawiki', 'interencheres',
}


async def main():
    async with BgSessionLocal() as session:

        # ── Count total lots to process ───────────────────────────────────────
        from sqlalchemy import func, text
        count_q = select(func.count(Lot.id))
        if STATUS != "all":
            count_q = count_q.where(Lot.status.cast(String) == STATUS)
        total = (await session.execute(count_q)).scalar()
        print(f"Lots to rescore: {total:,}  (status={STATUS}, batch={BATCH_SIZE}, dry_run={DRY_RUN})")

        processed = 0
        updated   = 0
        errors    = 0
        start     = time.time()
        offset    = 0

        # Cache HammerArtistStats in memory — 9k rows, ~1 MB, avoids per-lot DB round-trip
        print("Loading HammerArtistStats into memory …")
        hs_result = await session.execute(select(HammerArtistStats))
        hammer_cache: dict = {
            row.artist_name_normalized: row
            for row in hs_result.scalars().all()
        }
        print(f"  {len(hammer_cache):,} artists with hammer data cached.")

        # Cache ArtsperArtistSnapshot similarly
        print("Loading ArtsperArtistSnapshot into memory …")
        artsper_result = await session.execute(select(ArtsperArtistSnapshot))
        artsper_cache: dict = {}
        for row in artsper_result.scalars().all():
            artsper_cache[row.artist_name_normalized] = row
        print(f"  {len(artsper_cache):,} artists with Artsper data cached.")

        # Cache ArtistSignal (latest per artist)
        print("Loading ArtistSignal into memory …")
        from sqlalchemy import text as sqla_text
        sig_result = await session.execute(sqla_text("""
            SELECT DISTINCT ON (artist_id)
                artist_id::text, oracle_score_6m, oracle_signal, oracle_narrative
            FROM artist_signals
            ORDER BY artist_id, computed_at DESC
        """))
        signal_cache: dict = {
            row[0]: {"score": row[1], "signal": row[2], "narrative": row[3]}
            for row in sig_result.fetchall()
        }
        print(f"  {len(signal_cache):,} artist signals cached.\n")

        while True:
            q = (
                select(Lot)
                .options(selectinload(Lot.artist))
                .order_by(Lot.id)
                .offset(offset)
                .limit(BATCH_SIZE)
            )
            if STATUS != "all":
                q = q.where(Lot.status.cast(String) == STATUS)

            result = await session.execute(q)
            lots = result.scalars().all()
            if not lots:
                break

            for lot in lots:
                try:
                    artist_data: dict = {}
                    if lot.artist:
                        a = lot.artist
                        artist_data = {
                            "avg_price":    a.avg_auction_price,
                            "median_price": a.median_auction_price,
                            "liquidity":    a.liquidity_score,
                            "confidence":   a.data_confidence,
                            "popularity":   a.popularity_score,
                            "sell_through": a.sell_through_rate,
                            "volatility":   a.price_volatility,
                            "trend":        a.trend.value if a.trend else "stable",
                        }

                    artist_name_raw = lot.artist_name_raw or (lot.artist.name if lot.artist else None)
                    oracle_score_6m = oracle_signal = oracle_narrative = None

                    if artist_name_raw:
                        name_lower = artist_name_raw.lower().strip()

                        # ArtsperArtistSnapshot — primary market price anchor
                        artsper = artsper_cache.get(name_lower)
                        if artsper and artsper.price_avg and artsper.price_avg > 0:
                            if not artist_data.get("avg_price") or (artsper.total_works or 0) > 10:
                                artist_data["avg_price"] = artsper.price_avg
                                artist_data["confidence"] = min(
                                    (artist_data.get("confidence") or 0.5) + 0.10, 1.0
                                )

                        # HammerArtistStats — auction history fallback
                        if not artist_data.get("avg_price"):
                            hn = normalize_artist_name(artist_name_raw)
                            hs = hammer_cache.get(hn)
                            if hs and hs.sale_count >= 5 and hs.avg_eur:
                                artist_data["avg_price"]    = hs.avg_eur
                                artist_data["median_price"] = hs.median_eur
                                artist_data["confidence"]   = min(
                                    (artist_data.get("confidence") or 0.5) + 0.15, 1.0
                                )

                    # ArtistSignal oracle data
                    if lot.artist_id:
                        sig = signal_cache.get(str(lot.artist_id))
                        if sig:
                            oracle_score_6m  = sig["score"]
                            oracle_signal    = sig["signal"]
                            oracle_narrative = sig["narrative"]

                    lot_normalized = LotNormalized(
                        external_id=lot.external_id,
                        source=lot.source,
                        title=lot.title,
                        estimate_low=lot.estimate_low,
                        estimate_high=lot.estimate_high,
                        current_price=lot.current_price,
                        currency=lot.currency or "EUR",
                        auction_date=lot.auction_date,
                    )
                    house_rep = get_house_reputation(lot.source)
                    score_result = compute_deal_score(ScoringInput(
                        lot=lot_normalized,
                        artist_data=artist_data,
                        house_reputation=house_rep,
                        oracle_score_6m=oracle_score_6m,
                        oracle_signal=oracle_signal,
                        oracle_narrative=oracle_narrative,
                    ))

                    if not DRY_RUN:
                        lot.deal_score           = score_result.deal_score
                        lot.is_deal              = score_result.is_deal
                        lot.pct_below_low_estimate = score_result.pct_below_low_estimate
                        lot.pct_below_market_avg = score_result.pct_below_market_avg
                        lot.score_breakdown      = score_result.breakdown.model_dump()
                        lot.scored_at            = datetime.utcnow()

                        src = str(lot.source.value if hasattr(lot.source, "value") else lot.source)
                        if src in _TRUST_SOURCES and (lot.current_price or 0) >= 500 and lot.artist_name_raw:
                            lot.quality_tier = "A"
                        elif (lot.current_price or lot.estimate_low or 0) >= 200:
                            lot.quality_tier = "B"
                        else:
                            lot.quality_tier = "C"

                    updated += 1

                except Exception as e:
                    errors += 1
                    # silent — keep going

            if not DRY_RUN:
                await session.commit()

            processed += len(lots)
            offset    += BATCH_SIZE
            elapsed    = time.time() - start
            rate       = processed / elapsed if elapsed > 0 else 0
            pct        = processed / total * 100 if total else 0
            print(
                f"  {processed:,}/{total:,} ({pct:.1f}%)  "
                f"updated={updated:,}  errors={errors}  {rate:.0f} lots/s",
                end="\r",
            )

        elapsed = time.time() - start
        print(f"\n\nDone in {elapsed:.1f}s")
        print(f"  Processed : {processed:,}")
        print(f"  Updated   : {updated:,}")
        print(f"  Errors    : {errors}")
        if DRY_RUN:
            print("  (DRY_RUN — no changes committed)")


if __name__ == "__main__":
    asyncio.run(main())
