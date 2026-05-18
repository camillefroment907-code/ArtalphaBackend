"""
Nautilus Seed Script
Populates the database with realistic auction data for development/demo.
Run: python scripts/seed.py
"""
import asyncio
import sys
import os
from urllib.parse import quote_plus
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from app.database import create_tables
from app.config import get_settings
from app.api.auth_utils import hash_password

settings = get_settings()


async def seed():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from app.models.db_models import (
        User, UserPreference, Artist, Lot, Alert,
        AlertChannel, LotStatus, TrendDirection, AuctionHouse
    )
    import uuid

    engine = create_async_engine(
        settings.database_url.replace("postgresql://", "postgresql+asyncpg://"),
    )
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    await create_tables()
    print("✓ Tables created")

    async with AsyncSessionLocal() as session:

        # ── Demo User ─────────────────────────────────────────────────────────
        demo_user = User(
            email="demo@hono.art",
            hashed_password=hash_password("demo1234"),
            full_name="Demo Collector",
            is_active=True,
            is_verified=True,
        )
        session.add(demo_user)
        await session.flush()

        prefs = UserPreference(
            user_id=demo_user.id,
            favorite_artists=["Bernard Buffet", "Marc Chagall", "Andy Warhol"],
            categories=["Paintings", "Prints"],
            budget_max=50000,
            min_deal_score=70,
            alert_channel=AlertChannel.EMAIL,
            alert_email="demo@hono.art",
            auction_houses=["drouot", "invaluable"],
            is_alerts_enabled=True,
        )
        session.add(prefs)

        # ── Artists ───────────────────────────────────────────────────────────
        artists_data = [
            {
                "name": "Bernard Buffet", "name_normalized": "bernard buffet",
                "nationality": "French", "birth_year": 1928, "death_year": 1999,
                "movement": "Expressionism", "popularity_score": 72,
                "avg_auction_price": 1900, "median_auction_price": 1400,
                "price_volatility": 0.35, "liquidity_score": 78,
                "trend": TrendDirection.STABLE, "total_lots_sold": 4200,
                "sell_through_rate": 0.68, "data_confidence": 0.90,
            },
            {
                "name": "Marc Chagall", "name_normalized": "marc chagall",
                "nationality": "Russian-French", "birth_year": 1887, "death_year": 1985,
                "movement": "Expressionism", "popularity_score": 90,
                "avg_auction_price": 42000, "median_auction_price": 28000,
                "price_volatility": 0.25, "liquidity_score": 88,
                "trend": TrendDirection.STABLE, "total_lots_sold": 18500,
                "sell_through_rate": 0.84, "data_confidence": 0.96,
            },
            {
                "name": "Andy Warhol", "name_normalized": "andy warhol",
                "nationality": "American", "birth_year": 1928, "death_year": 1987,
                "movement": "Pop Art", "popularity_score": 98,
                "avg_auction_price": 95000, "median_auction_price": 42000,
                "price_volatility": 0.45, "liquidity_score": 95,
                "trend": TrendDirection.STABLE, "total_lots_sold": 22000,
                "sell_through_rate": 0.88, "data_confidence": 0.97,
            },
            {
                "name": "Joan Miró", "name_normalized": "joan miro",
                "nationality": "Spanish", "birth_year": 1893, "death_year": 1983,
                "movement": "Surrealism", "popularity_score": 89,
                "avg_auction_price": 32000, "median_auction_price": 20000,
                "price_volatility": 0.22, "liquidity_score": 87,
                "trend": TrendDirection.STABLE, "total_lots_sold": 16200,
                "sell_through_rate": 0.83, "data_confidence": 0.96,
            },
            {
                "name": "Damien Hirst", "name_normalized": "damien hirst",
                "nationality": "British", "birth_year": 1965, "death_year": None,
                "movement": "YBA", "popularity_score": 85,
                "avg_auction_price": 25000, "median_auction_price": 12000,
                "price_volatility": 0.58, "liquidity_score": 75,
                "trend": TrendDirection.DOWN, "total_lots_sold": 8500,
                "sell_through_rate": 0.62, "data_confidence": 0.88,
            },
            {
                "name": "Niki de Saint Phalle", "name_normalized": "niki de saint phalle",
                "nationality": "French-American", "birth_year": 1930, "death_year": 2002,
                "movement": "Neo-Dadaism", "popularity_score": 85,
                "avg_auction_price": 14000, "median_auction_price": 9500,
                "price_volatility": 0.32, "liquidity_score": 80,
                "trend": TrendDirection.UP, "total_lots_sold": 3100,
                "sell_through_rate": 0.78, "data_confidence": 0.88,
            },
        ]

        artist_objects = {}
        for a_data in artists_data:
            artist = Artist(**a_data)
            session.add(artist)
            await session.flush()
            artist_objects[a_data["name"]] = artist

        print(f"✓ {len(artist_objects)} artists created")

        # ── Lots ──────────────────────────────────────────────────────────────
        from datetime import timedelta
        import random
        random.seed(42)

        lots_data = [
            # High-score deals
            {
                "source": AuctionHouse.DROUOT,
                "title": "Bernard Buffet — Le Clown, huile sur toile",
                "artist_name_raw": "Bernard Buffet",
                "artist_key": "Bernard Buffet",
                "category": "Paintings",
                "medium": "Huile sur toile",
                "dimensions": "65 × 50 cm",
                "estimate_low": 1200, "estimate_high": 1500,
                "current_price": 620,
                "deal_score": 89.2, "is_deal": True,
                "pct_below_low_estimate": 48.3, "pct_below_market_avg": 67.4,
                "auction_house_name": "Hôtel Drouot — Paris",
                "days_ahead": 3,
            },
            {
                "source": AuctionHouse.INVALUABLE,
                "title": "Marc Chagall — Lithographie originale signée",
                "artist_name_raw": "Marc Chagall",
                "artist_key": "Marc Chagall",
                "category": "Prints",
                "medium": "Lithographie",
                "dimensions": "50 × 38 cm",
                "estimate_low": 8000, "estimate_high": 12000,
                "current_price": 3800,
                "deal_score": 85.7, "is_deal": True,
                "pct_below_low_estimate": 52.5, "pct_below_market_avg": 91.0,
                "auction_house_name": "Bonhams — London",
                "days_ahead": 7,
            },
            {
                "source": AuctionHouse.INVALUABLE,
                "title": "Andy Warhol — Marilyn, sérigraphie numérotée",
                "artist_name_raw": "Andy Warhol",
                "artist_key": "Andy Warhol",
                "category": "Prints",
                "medium": "Sérigraphie",
                "dimensions": "91 × 91 cm",
                "estimate_low": 35000, "estimate_high": 50000,
                "current_price": 18500,
                "deal_score": 82.4, "is_deal": True,
                "pct_below_low_estimate": 47.1, "pct_below_market_avg": 80.5,
                "auction_house_name": "Heritage Auctions — Dallas",
                "days_ahead": 14,
            },
            {
                "source": AuctionHouse.INTERENCHERES,
                "title": "Joan Miró — Gravure originale, signée",
                "artist_name_raw": "Joan Miró",
                "artist_key": "Joan Miró",
                "category": "Prints",
                "medium": "Eau-forte et aquatinte",
                "dimensions": "35 × 28 cm",
                "estimate_low": 6000, "estimate_high": 8000,
                "current_price": 2900,
                "deal_score": 80.1, "is_deal": True,
                "pct_below_low_estimate": 51.7, "pct_below_market_avg": 90.9,
                "auction_house_name": "Maître Dupont — Lyon",
                "days_ahead": 5,
            },
            {
                "source": AuctionHouse.DROUOT,
                "title": "Niki de Saint Phalle — Nana, sérigraphie",
                "artist_name_raw": "Niki de Saint Phalle",
                "artist_key": "Niki de Saint Phalle",
                "category": "Prints",
                "medium": "Sérigraphie",
                "dimensions": "70 × 50 cm",
                "estimate_low": 3500, "estimate_high": 5000,
                "current_price": 1600,
                "deal_score": 78.9, "is_deal": True,
                "pct_below_low_estimate": 54.3, "pct_below_market_avg": 88.6,
                "auction_house_name": "Hôtel Drouot — Paris",
                "days_ahead": 10,
            },
            # Mid-range lots
            {
                "source": AuctionHouse.DROUOT,
                "title": "École française XIXe — Paysage fluvial",
                "artist_name_raw": None,
                "artist_key": None,
                "category": "Paintings",
                "medium": "Huile sur toile",
                "dimensions": "80 × 60 cm",
                "estimate_low": 800, "estimate_high": 1200,
                "current_price": 750,
                "deal_score": 55.2, "is_deal": False,
                "pct_below_low_estimate": 6.3, "pct_below_market_avg": None,
                "auction_house_name": "Hôtel Drouot — Paris",
                "days_ahead": 8,
            },
            {
                "source": AuctionHouse.INTERENCHERES,
                "title": "Service de table Christofle — Argent massif",
                "artist_name_raw": None,
                "artist_key": None,
                "category": "Argenterie",
                "medium": "Argent massif",
                "dimensions": "48 pièces",
                "estimate_low": 2000, "estimate_high": 3000,
                "current_price": 1800,
                "deal_score": 48.0, "is_deal": False,
                "pct_below_low_estimate": 10.0, "pct_below_market_avg": None,
                "auction_house_name": "Étude Blanchard — Bordeaux",
                "days_ahead": 12,
            },
            {
                "source": AuctionHouse.INVALUABLE,
                "title": "Damien Hirst — Spot painting, sérigraphie",
                "artist_name_raw": "Damien Hirst",
                "artist_key": "Damien Hirst",
                "category": "Prints",
                "medium": "Sérigraphie",
                "dimensions": "100 × 70 cm",
                "estimate_low": 12000, "estimate_high": 18000,
                "current_price": 11500,
                "deal_score": 42.1, "is_deal": False,
                "pct_below_low_estimate": 4.2, "pct_below_market_avg": 54.0,
                "auction_house_name": "Phillips — New York",
                "days_ahead": 20,
            },
        ]

        def _search_url(source, artist_name):
            encoded = quote_plus(artist_name or "")
            if source == AuctionHouse.DROUOT:
                return f"https://drouot.com/lots?q={encoded}"
            elif source == AuctionHouse.INTERENCHERES:
                return f"https://www.interencheres.com/fr/recherche/?q={encoded}"
            else:  # INVALUABLE and others
                return f"https://www.invaluable.com/search/#search_keyword={encoded}&upcoming=true"

        for i, l_data in enumerate(lots_data):
            artist_key = l_data.pop("artist_key")
            artist = artist_objects.get(artist_key) if artist_key else None
            days = l_data.pop("days_ahead")
            source = l_data.pop("source")
            artist_name_raw = l_data.pop("artist_name_raw")

            lot = Lot(
                external_id=f"seed-{i:04d}",
                source=source,
                title=l_data.pop("title"),
                artist_name_raw=artist_name_raw,
                artist_id=artist.id if artist else None,
                category=l_data.pop("category"),
                medium=l_data.pop("medium"),
                dimensions=l_data.pop("dimensions"),
                estimate_low=l_data.pop("estimate_low"),
                estimate_high=l_data.pop("estimate_high"),
                current_price=l_data.pop("current_price"),
                currency="EUR",
                deal_score=l_data.pop("deal_score"),
                is_deal=l_data.pop("is_deal"),
                pct_below_low_estimate=l_data.pop("pct_below_low_estimate"),
                pct_below_market_avg=l_data.pop("pct_below_market_avg"),
                auction_house_name=l_data.pop("auction_house_name"),
                auction_date=datetime.utcnow() + timedelta(days=days),
                status=LotStatus.UPCOMING,
                scored_at=datetime.utcnow(),
                enriched_at=datetime.utcnow(),
                image_url=f"https://picsum.photos/seed/seed{i}/600/400",
                url=_search_url(source, artist_name_raw),
                score_breakdown={
                    "below_estimate_score": round(random.uniform(60, 95), 1),
                    "below_market_score": round(random.uniform(55, 90), 1),
                    "liquidity_score": round(random.uniform(70, 90), 1),
                    "house_reputation_score": round(random.uniform(72, 97), 1),
                    "confidence_score": round(random.uniform(65, 95), 1),
                },
            )
            session.add(lot)

        await session.commit()
        print(f"✓ {len(lots_data)} lots created")

    print("\n✅ Seed complete!")
    print("   Demo login: demo@hono.art / demo1234")
    print("   API docs: http://localhost:8000/docs")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
