"""Save hammer prices to DB with deduplication."""
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import structlog

logger = structlog.get_logger()


async def save_hammer_prices(prices: list, db: AsyncSession) -> int:
    """Save hammer prices with deduplication."""
    saved = 0
    for price in prices:
        try:
            external_id = price.get("external_id")
            if not external_id:
                continue

            # Check duplicate
            existing = await db.execute(
                text("SELECT id FROM hammer_prices WHERE external_id = :eid"),
                {"eid": external_id}
            )
            if existing.fetchone():
                continue

            # Compute normalized name if not already provided
            artist_raw = price.get("artist_name")
            artist_norm = price.get("artist_name_normalized")
            if not artist_norm and artist_raw:
                from app.jobs.quality_filter import normalize_artist_name as _norm
                artist_norm = _norm(artist_raw)

            await db.execute(
                text("""
                INSERT INTO hammer_prices (
                    id, external_id, artist_name, artist_name_normalized,
                    artwork_title, year_created, medium, dimensions, sale_date,
                    hammer_price, currency, hammer_price_eur,
                    estimate_low, estimate_high, premium_ratio,
                    auction_house, lot_number, source, image_url, created_at
                ) VALUES (
                    :id, :external_id, :artist_name, :artist_name_normalized,
                    :artwork_title, :year_created, :medium, :dimensions, :sale_date,
                    :hammer_price, :currency, :hammer_price_eur,
                    :estimate_low, :estimate_high, :premium_ratio,
                    :auction_house, :lot_number, :source, :image_url, :created_at
                )
                ON CONFLICT (external_id) DO NOTHING
                """),
                {
                    "id": str(uuid.uuid4()),
                    "external_id": external_id,
                    "artist_name": artist_raw,
                    "artist_name_normalized": artist_norm,
                    "artwork_title": price.get("artwork_title"),
                    "year_created": price.get("year_created"),
                    "medium": price.get("medium"),
                    "dimensions": price.get("dimensions"),
                    "sale_date": price.get("sale_date"),
                    "hammer_price": price.get("hammer_price"),
                    "currency": price.get("currency", "EUR"),
                    "hammer_price_eur": price.get("hammer_price_eur"),
                    "estimate_low": price.get("estimate_low"),
                    "estimate_high": price.get("estimate_high"),
                    "premium_ratio": price.get("premium_ratio"),
                    "auction_house": price.get("auction_house"),
                    "lot_number": price.get("lot_number"),
                    "source": price.get("source", "unknown"),
                    "image_url": price.get("image_url"),
                    "created_at": datetime.utcnow(),
                }
            )
            saved += 1
        except Exception as e:
            logger.debug("hammer_price_save_error", error=str(e))
            continue

    if saved > 0:
        await db.commit()

    return saved
