"""
Artist enrichment job — runs every 6 hours.
Fetches Artsy intelligence data for artists found in lots.
Stores in artist_profiles table.
Max 20 artists per run to respect API limits.
"""
import asyncio
import structlog
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
import uuid

logger = structlog.get_logger()


async def run_artist_enrichment(max_artists: int = 20):
    """
    1. Find artists from lots not yet in artist_profiles
    2. Fetch their Artsy intelligence data
    3. Store in artist_profiles
    """
    from app.database import BgSessionLocal as AsyncSessionLocal
    from app.models.db_models import Lot, ArtistProfile
    from app.engines.artsy_intelligence import fetch_artist_from_artsy

    logger.info("artist_enrichment_starting", max=max_artists)
    enriched = 0

    try:
        async with AsyncSessionLocal() as session:
            # Get distinct artist names from lots not yet enriched
            existing_result = await session.execute(
                select(ArtistProfile.name)
            )
            existing_names = {r[0].lower() for r in existing_result.all()}

            # Get artists from lots
            artists_result = await session.execute(
                select(Lot.artist_name_raw)
                .where(Lot.artist_name_raw.isnot(None))
                .where(Lot.artist_name_raw != "")
                .group_by(Lot.artist_name_raw)
                .order_by(func.count(Lot.id).desc())
                .limit(max_artists * 3)  # Fetch more to filter
            )
            all_artists = [r[0] for r in artists_result.all()]

            # Filter to unenriched only
            to_enrich = [
                a for a in all_artists
                if a and a.lower() not in existing_names
            ][:max_artists]

            logger.info("artists_to_enrich", count=len(to_enrich))

            for artist_name in to_enrich:
                try:
                    data = await fetch_artist_from_artsy(artist_name)
                    if not data:
                        logger.debug("artsy_no_data", artist=artist_name)
                        await asyncio.sleep(0.5)
                        continue

                    # Upsert into artist_profiles
                    artsy_id = data.get("artsy_id")
                    if artsy_id:
                        stmt = pg_insert(ArtistProfile).values(
                            id=uuid.uuid4(),
                            artsy_id=artsy_id,
                            name=data["name"],
                            nationality=data.get("nationality"),
                            birth_year=data.get("birth_year"),
                            death_year=data.get("death_year"),
                            biography=data.get("biography"),
                            image_url=data.get("image_url"),
                            gallery_tier_avg=data.get("gallery_tier_avg"),
                            gallery_count=data.get("gallery_count", 0),
                            top_gallery_name=data.get("top_gallery_name"),
                            public_collections_count=data.get("public_collections_count", 0),
                            shows_last_12m=data.get("shows_last_12m", 0),
                            shows_prev_12m=data.get("shows_prev_12m", 0),
                            momentum_score=data.get("momentum_score"),
                            liquidity_score=data.get("liquidity_score"),
                            institutional_score=data.get("institutional_score"),
                            is_pre_auction=data.get("is_pre_auction", False),
                            investment_tier=data.get("investment_tier"),
                            artsy_url=data.get("artsy_url"),
                            raw_data=data.get("raw_data"),
                            updated_at=datetime.utcnow(),
                        ).on_conflict_do_update(
                            index_elements=["artsy_id"],
                            set_={
                                "momentum_score": data.get("momentum_score"),
                                "liquidity_score": data.get("liquidity_score"),
                                "institutional_score": data.get("institutional_score"),
                                "gallery_tier_avg": data.get("gallery_tier_avg"),
                                "gallery_count": data.get("gallery_count", 0),
                                "shows_last_12m": data.get("shows_last_12m", 0),
                                "shows_prev_12m": data.get("shows_prev_12m", 0),
                                "is_pre_auction": data.get("is_pre_auction", False),
                                "investment_tier": data.get("investment_tier"),
                                "updated_at": datetime.utcnow(),
                            }
                        )
                    else:
                        stmt = pg_insert(ArtistProfile).values(
                            id=uuid.uuid4(),
                            artsy_id=None,
                            name=data["name"],
                            nationality=data.get("nationality"),
                            birth_year=data.get("birth_year"),
                            death_year=data.get("death_year"),
                            biography=data.get("biography"),
                            image_url=data.get("image_url"),
                            gallery_tier_avg=data.get("gallery_tier_avg"),
                            gallery_count=data.get("gallery_count", 0),
                            top_gallery_name=data.get("top_gallery_name"),
                            public_collections_count=data.get("public_collections_count", 0),
                            shows_last_12m=data.get("shows_last_12m", 0),
                            shows_prev_12m=data.get("shows_prev_12m", 0),
                            momentum_score=data.get("momentum_score"),
                            liquidity_score=data.get("liquidity_score"),
                            institutional_score=data.get("institutional_score"),
                            is_pre_auction=data.get("is_pre_auction", False),
                            investment_tier=data.get("investment_tier"),
                            artsy_url=data.get("artsy_url"),
                            raw_data=data.get("raw_data"),
                            updated_at=datetime.utcnow(),
                        ).on_conflict_do_nothing()

                    await session.execute(stmt)
                    await session.commit()
                    enriched += 1
                    logger.info("artist_enriched", artist=artist_name, tier=data.get("investment_tier"))
                    await asyncio.sleep(1)  # Respect Artsy rate limits

                except Exception as e:
                    logger.warning("artist_enrich_failed", artist=artist_name, error=str(e))
                    await asyncio.sleep(0.5)
                    continue

    except Exception as e:
        logger.error("artist_enrichment_job_failed", error=str(e))

    logger.info("artist_enrichment_done", enriched=enriched)
    return enriched
