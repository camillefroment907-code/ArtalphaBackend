"""
HONO Background Tasks
All async operations are wrapped with asyncio.run() for Celery compatibility.
"""
import asyncio
import hashlib
import uuid as _uuid_mod
from datetime import datetime, timedelta
from typing import List, Optional
import structlog

from app.jobs.celery_app import celery_app
from app.config import get_settings
from app.utils.url_validator import fix_url
from sqlalchemy.dialects.postgresql import insert as pg_insert

logger = structlog.get_logger()
settings = get_settings()

# In-process lock — prevents concurrent scraping runs in single-worker uvicorn
# Stores start time so a stuck lock auto-resets after 20 minutes
_SCRAPING_RUNNING = False
_SCRAPING_STARTED_AT: Optional[datetime] = None
_SCRAPING_LOCK_MAX_SECONDS = 20 * 60  # 20 minutes


def _get_sync_db():
    """Get synchronous DB session for Celery tasks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(
        settings.database_url.replace("postgresql+asyncpg://", "postgresql://"),
        pool_size=5,
        max_overflow=10,
    )
    Session = sessionmaker(bind=engine)
    return Session()


@celery_app.task(name="app.jobs.tasks.poll_and_score_lots", bind=True, max_retries=3)
def poll_and_score_lots(self):
    """
    Main pipeline task:
    1. Fetch lots from all connectors
    2. Enrich with artist data
    3. Score each lot
    4. Save to DB
    5. Trigger alerts for new deals
    """
    try:
        asyncio.run(_poll_and_score_async())
    except Exception as exc:
        logger.error("poll_and_score_lots failed", error=str(exc))
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


async def _poll_and_score_async(lots_per_source: int = 800, skip_purge: bool = False, skip_rationale: bool = False):
    global _SCRAPING_RUNNING, _SCRAPING_STARTED_AT
    if _SCRAPING_RUNNING:
        # Auto-reset if lock has been held for more than 20 minutes (stuck run)
        if _SCRAPING_STARTED_AT and (datetime.utcnow() - _SCRAPING_STARTED_AT).total_seconds() > _SCRAPING_LOCK_MAX_SECONDS:
            logger.warning("scraping_lock_expired — auto-resetting after 20 min", started_at=str(_SCRAPING_STARTED_AT))
            _SCRAPING_RUNNING = False
        else:
            logger.warning("scraping_already_running — skipping concurrent run")
            return
    _SCRAPING_RUNNING = True
    _SCRAPING_STARTED_AT = datetime.utcnow()
    try:
        await _poll_and_score_inner(lots_per_source=lots_per_source, skip_purge=skip_purge, skip_rationale=skip_rationale)
    finally:
        _SCRAPING_RUNNING = False
        _SCRAPING_STARTED_AT = None


async def _poll_and_score_inner(lots_per_source: int = 800, skip_purge: bool = False, skip_rationale: bool = False):
    from app.connectors.aggregator import fetch_all_lots, get_house_reputation
    from app.engines.scoring import compute_deal_score, ScoringInput
    from app.models.db_models import Lot, Artist, LotStatus
    from app.engines.artist_enrichment import _find_in_db, _detect_artist_from_title, _generate_heuristic_enrichment
    from sqlalchemy import select

    from app.database import BgSessionLocal as AsyncSessionLocal

    logger.info("Starting poll & score pipeline", lots_per_source=lots_per_source)
    start_time = datetime.utcnow()

    if not skip_purge:
        # 0. Purge UPCOMING lots whose auction_date is more than 1 day past.
        #    SOLD lots (historical data) are kept — never purged here.
        #    Must delete FK dependents (score_performance, hammer_prices, user_signals) first.
        async with AsyncSessionLocal() as _cleanup_session:
            from sqlalchemy import text as _text

            async def _purge_by_sql(where_clause: str, params: dict) -> int:
                """Delete lots matching where_clause, cleaning FK deps first via CTE."""
                result = await _cleanup_session.execute(_text(f"""
                    WITH to_del AS (
                        SELECT id FROM lots WHERE {where_clause}
                    ),
                    del_score AS (
                        DELETE FROM score_performance WHERE lot_id IN (SELECT id FROM to_del)
                    ),
                    del_hammer AS (
                        DELETE FROM hammer_prices WHERE lot_id IN (SELECT id FROM to_del)
                    ),
                    del_signals AS (
                        DELETE FROM user_signals WHERE lot_id IN (SELECT id FROM to_del)
                    )
                    DELETE FROM lots WHERE id IN (SELECT id FROM to_del)
                """), params)
                await _cleanup_session.commit()
                return result.rowcount

            expired_cutoff = datetime.utcnow() - timedelta(days=1)
            expired_count = await _purge_by_sql(
                "auction_date IS NOT NULL AND auction_date < :cutoff AND status = 'UPCOMING'",
                {"cutoff": expired_cutoff},
            )
            if expired_count:
                logger.info("Purged expired lots", count=expired_count)

            # Purge UPCOMING lots with no auction_date older than 3 days
            no_date_cutoff = datetime.utcnow() - timedelta(days=3)
            no_date_count = await _purge_by_sql(
                "auction_date IS NULL AND created_at < :cutoff AND status = 'UPCOMING'",
                {"cutoff": no_date_cutoff},
            )
            if no_date_count:
                logger.info("Purged no-date lots", count=no_date_count)

            # Purge Drouot lots with countdown timer titles (legacy bad data)
            bad_title_count = await _purge_by_sql(
                r"title ~ '^\d+h\s*\d+m\s*\d+s'",
                {},
            )
            if bad_title_count:
                logger.info("Purged countdown-title lots", count=bad_title_count)

    # 1. Fetch lots from all sources (parallel)
    raw_lots = await fetch_all_lots(lots_per_source=lots_per_source)
    logger.info("Lots fetched", count=len(raw_lots))

    # Quality filter + cross-source dedup (before DB lookup)
    from app.jobs.quality_filter import filter_and_deduplicate, normalize_category
    raw_lots, filter_stats = filter_and_deduplicate(raw_lots)

    # Normalize category on every lot so filters work correctly
    for lot in raw_lots:
        raw = lot.category or lot.medium or lot.title or ""
        lot.category = normalize_category(raw)
    logger.info("Quality filter applied", **filter_stats)

    if not raw_lots:
        logger.info("Poll & score complete", processed=0, new_deals=0, elapsed_s=0)
        return

    processed = 0
    new_deals = 0
    exceptional_lot_ids: list = []  # IDs of lots with score >= 80 for post-commit alerts

    async with AsyncSessionLocal() as session:
        # 2. Bulk dedup — find (source, external_id) pairs already in DB.
        # Filter by BOTH source AND external_id to avoid cross-source false matches
        # (e.g. Drouot lot "123" should not block Invaluable lot "123").
        candidate_pairs = [
            (lot.source.value if hasattr(lot.source, "value") else str(lot.source), lot.external_id)
            for lot in raw_lots if lot.external_id
        ]
        candidate_eids = [eid for _, eid in candidate_pairs]
        candidate_sources = list({src for src, _ in candidate_pairs})
        if candidate_eids:
            from sqlalchemy import cast, Text
            existing_result = await session.execute(
                select(Lot.source, Lot.external_id).where(
                    Lot.external_id.in_(candidate_eids),
                )
            existing_pairs = {
                (
                    row.source.value if hasattr(row.source, "value") else str(row.source),
                    row.external_id,
                )
                for row in existing_result.fetchall()
            }
        else:
            existing_pairs = set()

        # 3. Filter to only new lots
        new_lots = [
            lot for lot in raw_lots
            if lot.external_id and (lot.source.value, lot.external_id) not in existing_pairs
        ]
        # Log per-source new lot breakdown for diagnostics
        from collections import Counter
        new_by_source = Counter(str(lot.source.value) for lot in new_lots)
        logger.info("New lots to insert", new=len(new_lots), duplicates=len(raw_lots) - len(new_lots), by_source=dict(new_by_source))

        # 4. Process new lots — score + bulk insert (no per-lot OpenAI, use heuristics)
        artist_cache: dict = {}  # name_normalized → db_artist | None (in-memory per run)
        for lot_data in new_lots:
            try:
                # Artist enrichment (local DB + heuristics only — no per-lot OpenAI calls)
                artist_name = lot_data.artist_name_raw
                if not artist_name and lot_data.title:
                    artist_name = _detect_artist_from_title(lot_data.title)

                artist_data: dict = {}
                if artist_name:
                    artist_data = _find_in_db(artist_name) or _generate_heuristic_enrichment(artist_name)

                # Find or create artist record (cached per run)
                db_artist = None
                if artist_name:
                    key = artist_name.lower().strip()
                    if key in artist_cache:
                        db_artist = artist_cache[key]
                    else:
                        artist_result = await session.execute(
                            select(Artist).where(Artist.name_normalized == key)
                        )
                        # Use .scalars().first() — guards against MultipleResultsFound
                        # when duplicate artist rows share the same name_normalized
                        # (titles like "Cavallo", "Les chevaux" detected as artist names
                        # can create multiple rows across ingestion runs).
                        db_artist = artist_result.scalars().first()
                        artist_cache[key] = db_artist

                    if not db_artist and artist_data:
                        db_artist = Artist(
                            name=artist_name,
                            name_normalized=artist_name.lower().strip(),
                            nationality=artist_data.get("nationality"),
                            birth_year=artist_data.get("birth_year"),
                            death_year=artist_data.get("death_year"),
                            movement=artist_data.get("movement"),
                            popularity_score=artist_data.get("popularity", 50),
                            avg_auction_price=artist_data.get("avg_price"),
                            median_auction_price=artist_data.get("median_price"),
                            price_volatility=artist_data.get("volatility", 0.3),
                            liquidity_score=artist_data.get("liquidity", 50),
                            trend=artist_data.get("trend", "stable"),
                            total_lots_sold=artist_data.get("lots_sold", 0),
                            sell_through_rate=artist_data.get("sell_through", 0.6),
                            data_confidence=artist_data.get("confidence", 0.5),
                            last_enriched_at=datetime.utcnow(),
                        )
                        session.add(db_artist)
                        await session.flush()  # need id for FK
                        artist_cache[key] = db_artist

                # 5. Score the lot
                # Sprint C: enrich artist_data with ArtsperArtistSnapshot avg price
                # and pull oracle signal when artist already exists in DB
                ingest_oracle_score_6m = None
                ingest_oracle_signal = None
                ingest_oracle_narrative = None
                if artist_name and db_artist:
                    name_norm = artist_name.lower().strip()
                    from app.models.db_models import ArtsperArtistSnapshot, ArtistSignal
                    artsper_res = await session.execute(
                        select(ArtsperArtistSnapshot)
                        .where(ArtsperArtistSnapshot.artist_name_normalized == name_norm)
                        .limit(1)
                    )
                    artsper = artsper_res.scalar_one_or_none()
                    if artsper and artsper.price_avg and artsper.price_avg > 0:
                        if not artist_data.get("avg_price") or (artsper.total_works or 0) > 10:
                            artist_data["avg_price"] = artsper.price_avg
                            artist_data["confidence"] = min(
                                (artist_data.get("confidence") or 0.5) + 0.10, 1.0
                            )
                    sig_res = await session.execute(
                        select(ArtistSignal)
                        .where(ArtistSignal.artist_id == db_artist.id)
                        .order_by(ArtistSignal.computed_at.desc())
                        .limit(1)
                    )
                    sig = sig_res.scalar_one_or_none()
                    if sig and sig.oracle_score_6m is not None:
                        ingest_oracle_score_6m = sig.oracle_score_6m
                        ingest_oracle_signal = sig.oracle_signal
                        ingest_oracle_narrative = sig.oracle_narrative

                house_rep = get_house_reputation(lot_data.source)
                scoring_input = ScoringInput(
                    lot=lot_data,
                    artist_data=artist_data,
                    house_reputation=house_rep,
                    oracle_score_6m=ingest_oracle_score_6m,
                    oracle_signal=ingest_oracle_signal,
                    oracle_narrative=ingest_oracle_narrative,
                )
                score_result = compute_deal_score(scoring_input)

                # Compute confidence score
                from app.engines.confidence import compute_confidence_score
                confidence = compute_confidence_score(lot_data, artist_data)

                # Generate rationale for meaningful opportunities (async, non-blocking)
                # Skipped during bulk ingest to avoid per-lot OpenAI call overhead
                from app.engines.rationale import generate_rationale
                rationale = None
                if not skip_rationale and score_result.deal_score >= 45 and confidence >= 40 and settings.openai_api_key:
                    rationale = await generate_rationale(
                        title=lot_data.title or "",
                        artist_name=artist_name or lot_data.artist_name_raw or "Unknown",
                        current_price=lot_data.current_price,
                        estimate_low=lot_data.estimate_low,
                        estimate_high=lot_data.estimate_high,
                        deal_score=score_result.deal_score,
                        pct_below_estimate=score_result.pct_below_low_estimate,
                        pct_below_market=score_result.pct_below_market_avg,
                        artist_avg_price=artist_data.get("avg_price"),
                        artist_liquidity=artist_data.get("liquidity"),
                        auction_house=lot_data.auction_house_name,
                        category=lot_data.category,
                        lang="fr",
                    )

                # 6. Ensure URL is valid (fixes relative URLs, filters non-art,
                #    falls back to verified search URL when direct link is missing)
                clean_url = fix_url(
                    url=lot_data.url,
                    source=str(lot_data.source.value if hasattr(lot_data.source, "value") else lot_data.source),
                    title=lot_data.title or "",
                    artist=artist_name or lot_data.artist_name_raw or "",
                )

                # 7. Compute content fingerprint for cross-source deduplication
                _fp_raw = (
                    f"{(lot_data.title or '').lower().strip()}|"
                    f"{(artist_name or lot_data.artist_name_raw or '').lower().strip()}|"
                    f"{round(lot_data.estimate_low or 0)}|"
                    f"{round(lot_data.estimate_high or 0)}"
                )
                lot_fingerprint = hashlib.md5(_fp_raw.encode()).hexdigest() if lot_data.title else None

                # 8. Create new lot record
                # Preserve SOLD status for historical lots (prevents purge)
                _lot_performance = (lot_data.raw_data or {}).get("lot_performance", "")
                _lot_status = LotStatus.SOLD if _lot_performance == "sold" else LotStatus.UPCOMING

                # Truncate long fields to prevent DB column overflow
                if lot_data.medium:        lot_data.medium = lot_data.medium[:300]
                if lot_data.dimensions:    lot_data.dimensions = lot_data.dimensions[:300]
                if lot_data.description:   lot_data.description = lot_data.description[:1000]
                if lot_data.auction_sale_title: lot_data.auction_sale_title = lot_data.auction_sale_title[:300]

                lot_obj = Lot(
                    external_id=lot_data.external_id,
                    source=lot_data.source,
                    url=clean_url,
                    image_url=lot_data.image_url,
                    title=lot_data.title,
                    description=lot_data.description,
                    lot_number=lot_data.lot_number,
                    category=lot_data.category,
                    medium=lot_data.medium,
                    dimensions=lot_data.dimensions,
                    artist_id=db_artist.id if db_artist else None,
                    artist_name_raw=artist_name or lot_data.artist_name_raw,
                    estimate_low=lot_data.estimate_low,
                    estimate_high=lot_data.estimate_high,
                    current_price=lot_data.current_price,
                    currency=lot_data.currency,
                    # Strip timezone so asyncpg can write to TIMESTAMP WITHOUT TIME ZONE
                    auction_date=(
                        lot_data.auction_date.replace(tzinfo=None)
                        if lot_data.auction_date and lot_data.auction_date.tzinfo
                        else lot_data.auction_date
                    ),
                    auction_house_name=lot_data.auction_house_name,
                    auction_sale_title=lot_data.auction_sale_title,
                    status=_lot_status,
                    market_type=lot_data.market_type,
                    is_buy_now=lot_data.is_buy_now or False,
                    gallery_name=lot_data.gallery_name,
                    artist_website=lot_data.artist_website,
                    raw_data=lot_data.raw_data,
                    deal_score=score_result.deal_score,
                    is_deal=score_result.is_deal,
                    pct_below_low_estimate=score_result.pct_below_low_estimate,
                    pct_below_market_avg=score_result.pct_below_market_avg,
                    score_breakdown=score_result.breakdown.model_dump(),
                    scored_at=datetime.utcnow(),
                    enriched_at=datetime.utcnow(),
                    confidence_score=confidence,
                    score_rationale=rationale,
                )
                # INSERT ... ON CONFLICT DO NOTHING — idempotent at DB level.
                # Two conflict targets:
                # 1. uq_lots_source_external: same (source, external_id) — same connector, same lot
                # 2. uq_lots_fingerprint: same content hash — cross-connector duplicate (e.g. Roseberys via artmarketapi AND direct)
                _lot_uuid = _uuid_mod.uuid4()
                stmt = pg_insert(Lot).values(
                    id=_lot_uuid,
                    external_id=lot_obj.external_id,
                    source=lot_obj.source,
                    url=lot_obj.url,
                    image_url=lot_obj.image_url,
                    title=lot_obj.title,
                    description=lot_obj.description,
                    lot_number=lot_obj.lot_number,
                    category=lot_obj.category,
                    medium=lot_obj.medium,
                    dimensions=lot_obj.dimensions,
                    artist_id=lot_obj.artist_id,
                    artist_name_raw=lot_obj.artist_name_raw,
                    estimate_low=lot_obj.estimate_low,
                    estimate_high=lot_obj.estimate_high,
                    current_price=lot_obj.current_price,
                    currency=lot_obj.currency,
                    auction_date=lot_obj.auction_date,
                    auction_house_name=lot_obj.auction_house_name,
                    auction_sale_title=lot_obj.auction_sale_title,
                    status=lot_obj.status,
                    market_type=lot_obj.market_type,
                    is_buy_now=lot_obj.is_buy_now,
                    gallery_name=lot_obj.gallery_name,
                    artist_website=lot_obj.artist_website,
                    raw_data=lot_obj.raw_data,
                    deal_score=lot_obj.deal_score,
                    is_deal=lot_obj.is_deal,
                    pct_below_low_estimate=lot_obj.pct_below_low_estimate,
                    pct_below_market_avg=lot_obj.pct_below_market_avg,
                    score_breakdown=lot_obj.score_breakdown,
                    scored_at=lot_obj.scored_at,
                    enriched_at=lot_obj.enriched_at,
                    confidence_score=lot_obj.confidence_score,
                    score_rationale=lot_obj.score_rationale,
                    lot_fingerprint=lot_fingerprint,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                ).on_conflict_do_nothing()  # catches ALL unique violations (source+ext_id AND fingerprint)
                try:
                    await session.execute(stmt)
                    if score_result.is_deal:
                        new_deals += 1
                    if score_result.deal_score >= 80 and _lot_status != LotStatus.SOLD:
                        exceptional_lot_ids.append(_lot_uuid)
                    processed += 1

                    # Batch commit every 100 lots — avoids single huge transaction
                    if processed % 100 == 0:
                        await session.commit()
                        logger.info("Batch committed", processed=processed)
                except Exception as insert_err:
                    logger.error("Insert failed — rolling back lot", title=(lot_data.title or "")[:50], error=str(insert_err))
                    await session.rollback()

            except Exception as e:
                logger.error("Failed to process lot", title=(lot_data.title or "")[:50], error=str(e))
                continue

        # Final commit for remaining lots
        await session.commit()
        logger.info("Committed lots to DB", count=processed)

    elapsed = (datetime.utcnow() - start_time).total_seconds()
    logger.info(
        "Poll & score complete",
        processed=processed,
        new_deals=new_deals,
        elapsed_s=round(elapsed, 2),
    )

    # 7. Exceptional opportunity alerts (score >= 80)
    if exceptional_lot_ids:
        try:
            from app.services.alert_triggers import send_exceptional_opportunity_alerts
            await send_exceptional_opportunity_alerts(exceptional_lot_ids)
        except Exception as e:
            logger.warning("exceptional_opportunity_alerts failed", error=str(e))

    # Legacy deal alerts (score >= threshold, all users)
    if new_deals > 0:
        try:
            await _process_alerts_async()
        except Exception as e:
            logger.warning("alerts pipeline failed", error=str(e))

    try:
        await _run_ai_agents_async()
    except Exception as e:
        logger.warning("ai agents pipeline failed", error=str(e))


@celery_app.task(name="app.jobs.tasks.rescore_live_lots", bind=True)
def rescore_live_lots(self):
    """Re-score lots that are upcoming or live (prices may have changed)."""
    try:
        asyncio.run(_rescore_live_async())
    except Exception as exc:
        logger.error("rescore_live_lots failed", error=str(exc))
        raise self.retry(exc=exc, countdown=120)


async def _rescore_live_async():
    from app.models.db_models import Lot, LotStatus, Artist, ArtsperArtistSnapshot, ArtistSignal
    from app.engines.scoring import compute_deal_score, ScoringInput
    from app.connectors.aggregator import get_house_reputation
    from sqlalchemy import select, or_, func
    from sqlalchemy.orm import selectinload

    from app.database import BgSessionLocal as AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Lot)
            .options(selectinload(Lot.artist))
            .where(Lot.status.in_([LotStatus.UPCOMING, LotStatus.LIVE]))
            .where(
                or_(
                    Lot.auction_date >= datetime.utcnow(),
                    Lot.auction_date.is_(None),  # includes gallery/primary lots
                )
            )
            .limit(50)
        )
        lots = result.scalars().all()
        logger.info("Re-scoring live lots", count=len(lots))

        for lot in lots:
            try:
                artist_data = {}
                if lot.artist:
                    a = lot.artist
                    artist_data = {
                        "avg_price": a.avg_auction_price,
                        "liquidity": a.liquidity_score,
                        "confidence": a.data_confidence,
                        "popularity": a.popularity_score,
                        "sell_through": a.sell_through_rate,
                        "volatility": a.price_volatility,
                        "trend": a.trend.value if a.trend else "stable",
                    }

                # ── Sprint C: enrich with ArtsperArtistSnapshot avg price ─────
                artist_name_raw = lot.artist_name_raw or (lot.artist.name if lot.artist else None)
                oracle_score_6m = None
                oracle_signal = None
                oracle_narrative = None

                if artist_name_raw:
                    name_norm = artist_name_raw.lower().strip()

                    # ArtsperArtistSnapshot — primary market price anchor
                    artsper_res = await session.execute(
                        select(ArtsperArtistSnapshot)
                        .where(ArtsperArtistSnapshot.artist_name_normalized == name_norm)
                        .limit(1)
                    )
                    artsper = artsper_res.scalar_one_or_none()
                    if artsper and artsper.price_avg and artsper.price_avg > 0:
                        # Use Artsper avg when: no auction avg, or Artsper has more data points
                        if not artist_data.get("avg_price") or (artsper.total_works or 0) > 10:
                            artist_data["avg_price"] = artsper.price_avg
                            artist_data["confidence"] = min(
                                (artist_data.get("confidence") or 0.5) + 0.10, 1.0
                            )

                # ── Sprint C: pull ArtistSignal oracle data ───────────────────
                if lot.artist_id:
                    sig_res = await session.execute(
                        select(ArtistSignal)
                        .where(ArtistSignal.artist_id == lot.artist_id)
                        .order_by(ArtistSignal.computed_at.desc())
                        .limit(1)
                    )
                    sig = sig_res.scalar_one_or_none()
                    if sig and sig.oracle_score_6m is not None:
                        oracle_score_6m = sig.oracle_score_6m
                        oracle_signal = sig.oracle_signal
                        oracle_narrative = sig.oracle_narrative

                from app.models.schemas import LotNormalized, AuctionHouseEnum
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
                scoring_input = ScoringInput(
                    lot=lot_normalized,
                    artist_data=artist_data,
                    house_reputation=house_rep,
                    oracle_score_6m=oracle_score_6m,
                    oracle_signal=oracle_signal,
                    oracle_narrative=oracle_narrative,
                )
                score_result = compute_deal_score(scoring_input)

                lot.deal_score = score_result.deal_score
                lot.is_deal = score_result.is_deal
                lot.pct_below_low_estimate = score_result.pct_below_low_estimate
                lot.pct_below_market_avg = score_result.pct_below_market_avg
                lot.score_breakdown = score_result.breakdown.model_dump()
                lot.scored_at = datetime.utcnow()

            except Exception as e:
                logger.warning("Re-score failed for lot", lot_id=str(lot.id), error=str(e))

        await session.commit()
        logger.info("Re-score complete")


@celery_app.task(name="app.jobs.tasks.process_pending_alerts", bind=True)
def process_pending_alerts(self):
    """Find new deals and send alerts to all eligible users."""
    try:
        asyncio.run(_process_alerts_async())
    except Exception as exc:
        logger.error("process_pending_alerts failed", error=str(exc))
        raise self.retry(exc=exc, countdown=30)


async def _process_alerts_async():
    from app.models.db_models import Lot, LotStatus, User, UserPreference, Alert
    from app.engines.alerts import send_deal_alert
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy import select, and_, func
    from sqlalchemy.orm import selectinload

    from app.database import engine, BgSessionLocal as AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        # Get lots that are deals and haven't been alerted in the last hour
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)

        deal_lots_result = await session.execute(
            select(Lot)
            .options(selectinload(Lot.artist))
            .where(
                and_(
                    Lot.is_deal == True,
                    Lot.status == LotStatus.UPCOMING,
                    Lot.scored_at >= one_hour_ago,
                )
            )
            .limit(50)
        )
        deal_lots = deal_lots_result.scalars().all()

        if not deal_lots:
            logger.debug("No new deals to alert")
            return

        # Get all active users with preferences and alerts enabled
        users_result = await session.execute(
            select(User, UserPreference)
            .join(UserPreference, User.id == UserPreference.user_id)
            .where(
                and_(
                    User.is_active == True,
                    UserPreference.is_alerts_enabled == True,
                )
            )
        )
        users_prefs = users_result.all()

        logger.info("Processing alerts", deals=len(deal_lots), users=len(users_prefs))

        total_sent = 0
        for lot in deal_lots:
            artist_avg = lot.artist.avg_auction_price if lot.artist else None

            for user, prefs in users_prefs:
                # Check 1 — lot already alerted for this user
                dup_count = await session.execute(
                    select(func.count()).select_from(Alert).where(
                        and_(
                            Alert.user_id == user.id,
                            Alert.lot_id == lot.id,
                        )
                    )
                )
                if dup_count.scalar() > 0:
                    logger.debug("alert_skipped_duplicate", user_id=str(user.id), lot_id=str(lot.id))
                    continue

                # Check 2 — daily cap: max 2 alerts per user per 24h
                daily_count = await session.execute(
                    select(func.count()).select_from(Alert).where(
                        and_(
                            Alert.user_id == user.id,
                            Alert.created_at > datetime.utcnow() - timedelta(hours=24),
                        )
                    )
                )
                if daily_count.scalar() >= 2:
                    logger.debug("alert_throttled_daily", user_id=str(user.id))
                    continue

                # Check user filters
                if prefs.budget_max and lot.current_price and lot.current_price > prefs.budget_max:
                    continue

                if prefs.favorite_artists and lot.artist_name_raw:
                    artist_match = any(
                        fav.lower() in lot.artist_name_raw.lower()
                        for fav in prefs.favorite_artists
                    )
                    if not artist_match and prefs.favorite_artists:
                        continue  # only alert for favorite artists if list is set

                alerts = await send_deal_alert(lot, user, prefs, artist_avg)
                for alert in alerts:
                    session.add(alert)
                    logger.info(f"Alert sent: deal → user {user.id}, lot {lot.id}, score {lot.deal_score:.0f}")
                total_sent += len(alerts)

        await session.commit()
        logger.info("Alerts sent", total=total_sent)


@celery_app.task(name="app.jobs.tasks.daily_cleanup")
def daily_cleanup():
    """Remove old lots, compress logs, update statistics."""
    try:
        asyncio.run(_daily_cleanup_async())
    except Exception as exc:
        logger.error("daily_cleanup failed", error=str(exc))


async def _daily_cleanup_async():
    from app.models.db_models import Lot, LotStatus
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy import delete, and_

    from app.database import engine, BgSessionLocal as AsyncSessionLocal

    cutoff = datetime.utcnow() - timedelta(days=90)

    async with AsyncSessionLocal() as session:
        # Mark past lots as sold/unsold
        from sqlalchemy import select as sa_select
        stmt = sa_select(Lot).where(
            and_(
                Lot.auction_date < datetime.utcnow(),
                Lot.status == LotStatus.UPCOMING,
            )
        )
        past_lots_result = await session.execute(stmt)
        # In production: check if hammer price was recorded → SOLD, else UNSOLD
        # For now just mark as sold
        for lot in past_lots_result.scalars().all():
            lot.status = LotStatus.SOLD

        # Purge low-quality lots (score < 20 AND no price AND no estimate)
        from sqlalchemy import delete, or_
        purge_stmt = delete(Lot).where(
            and_(
                or_(Lot.deal_score.is_(None), Lot.deal_score < 20),
                Lot.current_price.is_(None),
                Lot.estimate_low.is_(None),
                Lot.estimate_high.is_(None),
                # Only purge if no alerts sent for this lot
                ~Lot.alerts.any(),
            )
        )
        purge_result = await session.execute(purge_stmt)
        logger.info("Purged low-quality lots", count=purge_result.rowcount)

        # Purge old chat messages (30-day retention)
        from app.models.db_models import ChatMessage
        cutoff_chat = datetime.utcnow() - timedelta(days=30)
        chat_purge = delete(ChatMessage).where(ChatMessage.created_at < cutoff_chat)
        chat_result = await session.execute(chat_purge)
        logger.info("Purged old chat messages", count=chat_result.rowcount)

        await session.commit()
        logger.info("Daily cleanup complete")


@celery_app.task(name="app.jobs.tasks.run_ai_agents", bind=True)
def run_ai_agents(self):
    """Run AI agent for all active Pro+ users. Called after poll_and_score_lots."""
    try:
        asyncio.run(_run_ai_agents_async())
    except Exception as exc:
        logger.error("run_ai_agents failed", error=str(exc))
        raise self.retry(exc=exc, countdown=60)


async def _run_ai_agents_async():
    from app.models.db_models import (
        AgentAlert, AgentRecommendation, User, Lot, LotStatus, Subscription,
    )
    from app.engines.agent import run_agent_for_alert
    from app.services.email_service import send_deal_alert_email
    from sqlalchemy import select, and_, desc as sa_desc
    from sqlalchemy.orm import selectinload

    from app.database import BgSessionLocal as AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AgentAlert, User, Subscription)
            .join(User, AgentAlert.user_id == User.id)
            .join(Subscription, User.id == Subscription.user_id, isouter=True)
            .where(
                and_(
                    AgentAlert.is_active == True,  # noqa: E712
                    User.is_active == True,          # noqa: E712
                )
            )
        )
        rows = result.all()

        admin_emails = {e.strip() for e in settings.admin_emails.split(",")}

        eligible = []
        for alert, user, sub in rows:
            if user.email.strip() in admin_emails:
                plan = "institutional"
            else:
                plan = sub.plan.value.lower() if sub and sub.status.value.lower() in ("active", "trialing") else "free"
            if plan in ("investor", "pro", "institutional", "expert"):
                eligible.append((alert, user))

        if not eligible:
            logger.debug("No eligible agents to run")
            return

        lookback = datetime.utcnow() - timedelta(hours=24)
        lots_result = await session.execute(
            select(Lot)
            .options(selectinload(Lot.artist))
            .where(
                and_(
                    Lot.scored_at >= lookback,
                    Lot.deal_score >= 45,
                    Lot.status == LotStatus.UPCOMING,
                )
            )
            .order_by(Lot.deal_score.desc())
            .limit(200)
        )
        new_lots = lots_result.scalars().all()

        if not new_lots:
            logger.debug("No new lots for agents")
            return

        logger.info("Running AI agents", alerts=len(eligible), lots=len(new_lots))

        total_recs = 0
        for alert, user in eligible:
            created = await run_agent_for_alert(
                alert=alert,
                new_lots=new_lots,
                session=session,
                lang="fr",
            )
            total_recs += created

            if created > 0 and alert.notify_email:
                top_rec_result = await session.execute(
                    select(AgentRecommendation)
                    .options(selectinload(AgentRecommendation.lot))
                    .where(
                        and_(
                            AgentRecommendation.alert_id == alert.id,
                            AgentRecommendation.user_id == user.id,
                        )
                    )
                    .order_by(sa_desc(AgentRecommendation.created_at))
                    .limit(1)
                )
                top_rec = top_rec_result.scalar_one_or_none()
                if top_rec and top_rec.lot:
                    await send_deal_alert_email(
                        to_email=user.email,
                        lot_title=top_rec.lot.title or "Untitled",
                        artist_name=top_rec.lot.artist_name_raw or "Unknown",
                        price=float(top_rec.lot.current_price or top_rec.lot.estimate_low or 0),
                        estimate=float(top_rec.lot.estimate_high or top_rec.lot.estimate_low or 0),
                        deal_score=int(top_rec.lot.deal_score or 0),
                        upside_pct=float(top_rec.lot.pct_below_low_estimate or 0),
                        lot_url=top_rec.lot.url or "",
                        lot_id=str(top_rec.lot.id),
                        lang="fr",
                    )

        await session.commit()
        logger.info("AI agents complete", total_recommendations=total_recs)


@celery_app.task(name="app.jobs.tasks.dedup_cleanup")
def dedup_cleanup():
    """Weekly DB-level dedup — removes duplicate lots by title+artist+source."""
    try:
        from app.jobs.dedup_cleanup import run_dedup_cleanup
        deleted = run_dedup_cleanup()
        logger.info("dedup_cleanup task complete", deleted=deleted)
    except Exception as exc:
        logger.error("dedup_cleanup failed", error=str(exc))


@celery_app.task(name="app.jobs.tasks.ingest_artsy_liveauctioneers", bind=True)
def ingest_artsy_liveauctioneers(self):
    """Fetch artsy + liveauctioneers every 3 hours and insert new lots."""
    try:
        asyncio.run(_ingest_artsy_liveauctioneers_async())
    except Exception as exc:
        logger.error("ingest_artsy_liveauctioneers failed", error=str(exc))
        raise self.retry(exc=exc, countdown=300)


async def _ingest_artsy_liveauctioneers_async():
    import uuid as _uuid
    import hashlib
    import importlib
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy import select, func
    from app.models.db_models import Lot as LotModel, LotStatus
    from app.jobs.quality_filter import filter_and_deduplicate
    from app.database import BgSessionLocal as AsyncSessionLocal

    sources = {
        "artsy":           ("app.connectors.artsy_connector",            "fetch_lots", 3000),
        "liveauctioneers": ("app.connectors.liveauctioneers_connector",  "fetch_lots", 1000),
    }

    counts = {}
    all_passed = []

    for name, (mod_path, fn_name, limit) in sources.items():
        try:
            mod = importlib.import_module(mod_path)
            fn = getattr(mod, fn_name)
            lots = await asyncio.wait_for(fn(limit), timeout=90)
            passed, _ = filter_and_deduplicate(lots)
            counts[name] = len(passed)
            all_passed.extend(passed)
        except Exception as e:
            logger.warning("scheduled_ingest_fetch_failed", source=name, error=str(e))
            counts[name] = 0

    inserted = 0
    async with AsyncSessionLocal() as session:
        # Pre-check: fetch all (source, external_id) pairs already in DB for these sources
        # so we can skip lots that already exist without relying solely on ON CONFLICT.
        candidate_pairs = [
            (lot.source.value if hasattr(lot.source, "value") else str(lot.source), lot.external_id)
            for lot in all_passed if lot.external_id
        ]
        candidate_eids    = [eid for _, eid in candidate_pairs]
        candidate_sources = list({src for src, _ in candidate_pairs})
        existing_pairs: set = set()
        if candidate_eids:
            existing_rows = await session.execute(
                select(LotModel.source, LotModel.external_id).where(
                    LotModel.external_id.in_(candidate_eids),
                )
            )
            existing_pairs = {
                (row.source.value if hasattr(row.source, "value") else str(row.source), row.external_id)
                for row in existing_rows.fetchall()
            }

        # Also pre-compute fingerprints for lots without external_id and check DB
        # Use the SAME formula as the main pipeline: title|artist|est_low|est_high
        def _make_fp(lot) -> str | None:
            if not lot.title:
                return None
            raw = (
                f"{(lot.title or '').lower().strip()}|"
                f"{(lot.artist_name_raw or '').lower().strip()}|"
                f"{round(lot.estimate_low or 0)}|"
                f"{round(lot.estimate_high or 0)}"
            )
            return hashlib.md5(raw.encode()).hexdigest()

        fps_to_check = [_make_fp(lot) for lot in all_passed if not lot.external_id]
        fps_to_check = [fp for fp in fps_to_check if fp]
        existing_fps: set = set()
        if fps_to_check:
            fp_rows = await session.execute(
                select(LotModel.lot_fingerprint).where(
                    LotModel.lot_fingerprint.in_(fps_to_check)
                )
            )
            existing_fps = {row[0] for row in fp_rows.fetchall()}

        for lot in all_passed:
            try:
                src_val = lot.source.value if hasattr(lot.source, "value") else str(lot.source)
                _fp = _make_fp(lot)

                # Skip if already in DB by (source, external_id) or by fingerprint
                if lot.external_id and (src_val, lot.external_id) in existing_pairs:
                    continue
                if not lot.external_id and _fp and _fp in existing_fps:
                    continue

                stmt = pg_insert(LotModel).values(
                    id=_uuid.uuid4(),
                    external_id=lot.external_id,
                    source=lot.source,
                    title=lot.title,
                    estimate_low=lot.estimate_low,
                    estimate_high=lot.estimate_high,
                    current_price=lot.current_price,
                    currency=lot.currency or "USD",
                    auction_date=lot.auction_date,
                    auction_house_name=lot.auction_house_name,
                    status=LotStatus.UPCOMING,
                    market_type=lot.market_type or "AUCTION",
                    is_buy_now=False,
                    deal_score=50.0,
                    is_deal=False,
                    image_url=lot.image_url,
                    url=lot.url,
                    lot_fingerprint=_fp,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                ).on_conflict_do_nothing()
                await session.execute(stmt)
                inserted += 1
            except Exception as e:
                logger.warning("scheduled_ingest_insert_failed", error=str(e))
        await session.commit()

    logger.info(
        "scheduled_ingest",
        artsy=counts.get("artsy", 0),
        liveauctioneers=counts.get("liveauctioneers", 0),
        inserted=inserted,
    )


async def _generate_rationales_async(max_lots: int = 20):
    """
    Separate task: generate GPT rationales for lots missing them.
    Runs independently from the main scan to avoid timeout pressure.
    Max 20 lots per run at 0.5s sleep = ~10s total.
    """
    from app.engines.rationale import generate_rationale
    from app.database import BgSessionLocal as AsyncSessionLocal
    from sqlalchemy import select, and_
    from app.models.db_models import Lot

    logger.info("rationale_generation_starting")
    generated = 0

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Lot)
                .where(
                    and_(
                        Lot.score_rationale.is_(None),
                        Lot.deal_score >= 45,
                    )
                )
                .order_by(Lot.deal_score.desc())
                .limit(max_lots)
            )
            lots = result.scalars().all()

            for lot in lots:
                try:
                    rationale = await generate_rationale(
                        title=lot.title or "",
                        artist_name=lot.artist_name_raw or "Unknown",
                        current_price=lot.current_price,
                        estimate_low=lot.estimate_low,
                        estimate_high=lot.estimate_high,
                        deal_score=lot.deal_score or 0,
                        pct_below_estimate=lot.pct_below_low_estimate,
                        pct_below_market=lot.pct_below_market_avg,
                        artist_avg_price=None,
                        artist_liquidity=None,
                        auction_house=lot.auction_house_name,
                        category=lot.category,
                        lang="fr",
                    )
                    if rationale:
                        lot.score_rationale = rationale
                        generated += 1
                    await asyncio.sleep(0.5)
                except Exception as e:
                    logger.debug("rationale_skip", error=str(e))
                    continue

            await session.commit()

    except Exception as e:
        logger.error("rationale_generation_failed", error=str(e))

    logger.info("rationale_generation_done", generated=generated)
    return generated


@celery_app.task(name="app.jobs.tasks.sync_artsper_artist_data", bind=True)
def sync_artsper_artist_data(self):
    """
    Weekly sync of Artsper primary market data into artsper_artist_snapshots.
    Fetches up to 200k artworks from Algolia, aggregates per-artist stats,
    upserts snapshots, and links to Artist records by normalized name.
    """
    try:
        from app.jobs.artsper_enrichment_job import run_artsper_enrichment
        summary = asyncio.run(run_artsper_enrichment())
        logger.info("sync_artsper_artist_data_done", **summary)
        return summary
    except Exception as exc:
        logger.error("sync_artsper_artist_data_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=600, max_retries=2)


@celery_app.task(name="app.jobs.tasks.compute_oracle_weekly", bind=True)
def compute_oracle_weekly(self):
    """
    Nautilus Oracle — compute predictive signals for all artists
    with >= 3 lots in the last 180 days. Runs every Sunday at 2am UTC.
    """
    try:
        result = asyncio.run(_compute_oracle_weekly_async())
        logger.info("compute_oracle_weekly_done", **result)
        return result
    except Exception as exc:
        logger.error("compute_oracle_weekly_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=300)


async def _compute_oracle_weekly_async():
    from app.services.oracle_service import compute_oracle_for_all_artists
    return await compute_oracle_for_all_artists(min_lots=3)


@celery_app.task(name="app.jobs.tasks.sync_poush_artists", bind=True)
def sync_poush_artists(self):
    """Monthly sync of Poush Manifesto artists into artist_profiles."""
    try:
        result = asyncio.run(_sync_poush_async())
        logger.info("sync_poush_done", imported=result)
        return {"imported": result}
    except Exception as exc:
        logger.error("sync_poush_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=300)


async def _sync_poush_async():
    from app.connectors.poush_connector import sync_to_db
    return await sync_to_db()
