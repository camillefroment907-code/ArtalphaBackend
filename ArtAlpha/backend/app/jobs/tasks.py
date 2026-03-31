"""
HONO Background Tasks
All async operations are wrapped with asyncio.run() for Celery compatibility.
"""
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional
import structlog

from app.jobs.celery_app import celery_app
from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


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


async def _poll_and_score_async():
    from app.connectors.aggregator import fetch_all_lots, get_house_reputation
    from app.engines.artist_enrichment import enrich_artist
    from app.engines.scoring import compute_deal_score, ScoringInput
    from app.models.db_models import Lot, Artist, LotStatus
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy import select

    from app.database import engine, AsyncSessionLocal

    logger.info("Starting poll & score pipeline")
    start_time = datetime.utcnow()

    # 1. Fetch lots from all sources
    raw_lots = await fetch_all_lots(lots_per_source=500)
    logger.info("Lots fetched", count=len(raw_lots))

    processed = 0
    new_deals = 0

    async with AsyncSessionLocal() as session:
        for lot_data in raw_lots:
            try:
                # 2. Check for duplicate
                if lot_data.external_id:
                    existing = await session.execute(
                        select(Lot).where(
                            Lot.source == lot_data.source,
                            Lot.external_id == lot_data.external_id,
                        )
                    )
                    existing_lot = existing.scalar_one_or_none()
                    if existing_lot:
                        # Update price only
                        if lot_data.current_price and existing_lot.current_price != lot_data.current_price:
                            existing_lot.current_price = lot_data.current_price
                            existing_lot.updated_at = datetime.utcnow()
                            # Re-score
                            lot_obj = existing_lot
                        else:
                            continue
                    else:
                        lot_obj = None
                else:
                    lot_obj = None

                # 3. Enrich artist
                artist_name, artist_data = await enrich_artist(
                    lot_data.artist_name_raw,
                    lot_data.title,
                )

                # 4. Find or create artist record
                db_artist = None
                if artist_name:
                    artist_result = await session.execute(
                        select(Artist).where(
                            Artist.name_normalized == artist_name.lower().strip()
                        )
                    )
                    db_artist = artist_result.scalar_one_or_none()

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
                        await session.flush()

                # 5. Score the lot
                house_rep = get_house_reputation(lot_data.source)
                scoring_input = ScoringInput(
                    lot=lot_data,
                    artist_data=artist_data,
                    house_reputation=house_rep,
                )
                score_result = compute_deal_score(scoring_input)

                # 6. Create or update lot record
                if not lot_obj:
                    lot_obj = Lot(
                        external_id=lot_data.external_id,
                        source=lot_data.source,
                        url=lot_data.url,
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
                        auction_date=lot_data.auction_date,
                        auction_house_name=lot_data.auction_house_name,
                        auction_sale_title=lot_data.auction_sale_title,
                        status=LotStatus.UPCOMING,
                        raw_data=lot_data.raw_data,
                    )
                    session.add(lot_obj)
                    await session.flush()

                was_deal = lot_obj.is_deal
                lot_obj.deal_score = score_result.deal_score
                lot_obj.is_deal = score_result.is_deal
                lot_obj.pct_below_low_estimate = score_result.pct_below_low_estimate
                lot_obj.pct_below_market_avg = score_result.pct_below_market_avg
                lot_obj.score_breakdown = score_result.breakdown.model_dump()
                lot_obj.scored_at = datetime.utcnow()
                lot_obj.enriched_at = datetime.utcnow()

                if score_result.is_deal and not was_deal:
                    new_deals += 1

                processed += 1

            except Exception as e:
                logger.error("Failed to process lot", title=lot_data.title[:50], error=str(e))
                continue

        await session.commit()

    elapsed = (datetime.utcnow() - start_time).total_seconds()
    logger.info(
        "Poll & score complete",
        processed=processed,
        new_deals=new_deals,
        elapsed_s=round(elapsed, 2),
    )

    # 7. Trigger alerts for new deals
    if new_deals > 0:
        process_pending_alerts.delay()


@celery_app.task(name="app.jobs.tasks.rescore_live_lots", bind=True)
def rescore_live_lots(self):
    """Re-score lots that are upcoming or live (prices may have changed)."""
    try:
        asyncio.run(_rescore_live_async())
    except Exception as exc:
        logger.error("rescore_live_lots failed", error=str(exc))
        raise self.retry(exc=exc, countdown=120)


async def _rescore_live_async():
    from app.models.db_models import Lot, LotStatus, Artist
    from app.engines.scoring import compute_deal_score, ScoringInput
    from app.connectors.aggregator import get_house_reputation
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.database import engine, AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Lot)
            .options(selectinload(Lot.artist))
            .where(Lot.status.in_([LotStatus.UPCOMING, LotStatus.LIVE]))
            .where(Lot.auction_date >= datetime.utcnow())
            .limit(500)
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
                    }

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
    from sqlalchemy import select, and_
    from sqlalchemy.orm import selectinload

    from app.database import engine, AsyncSessionLocal

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
                # Check if already alerted for this lot
                existing_alert = await session.execute(
                    select(Alert).where(
                        and_(
                            Alert.user_id == user.id,
                            Alert.lot_id == lot.id,
                        )
                    )
                )
                if existing_alert.scalar_one_or_none():
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

    from app.database import engine, AsyncSessionLocal

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

        await session.commit()
        logger.info("Daily cleanup complete")
