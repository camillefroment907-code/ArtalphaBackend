"""Artists API — investment intelligence from Artsy data + Lot market data."""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, text
from typing import Optional

from app.database import get_db
from app.models.db_models import ArtistProfile, Lot

router = APIRouter(prefix="/artist-profiles", tags=["artist-profiles"])


@router.get("/")
async def list_artists(
    tier: Optional[str] = Query(None),
    min_momentum: Optional[float] = Query(None),
    is_pre_auction: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List artists with investment intelligence scores."""
    filters = []
    if tier:
        filters.append(ArtistProfile.investment_tier == tier)
    if min_momentum is not None:
        filters.append(ArtistProfile.momentum_score >= min_momentum)
    if is_pre_auction is not None:
        filters.append(ArtistProfile.is_pre_auction == is_pre_auction)
    if search:
        filters.append(ArtistProfile.name.ilike(f"%{search}%"))

    from sqlalchemy import and_
    stmt = select(ArtistProfile).order_by(desc(ArtistProfile.momentum_score)).limit(limit)
    if filters:
        stmt = stmt.where(and_(*filters))
    result = await db.execute(stmt)
    artists = result.scalars().all()
    return [_serialize_artist(a) for a in artists]


@router.get("/momentum")
async def get_momentum_artists(
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Top artists by momentum score."""
    result = await db.execute(
        select(ArtistProfile)
        .where(ArtistProfile.momentum_score.isnot(None))
        .order_by(desc(ArtistProfile.momentum_score))
        .limit(limit)
    )
    artists = result.scalars().all()
    return [_serialize_artist(a) for a in artists]


@router.get("/pre-auction")
async def get_pre_auction_artists(
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Artists in galleries but not yet at auction."""
    result = await db.execute(
        select(ArtistProfile)
        .where(ArtistProfile.is_pre_auction == True)  # noqa: E712
        .order_by(desc(ArtistProfile.momentum_score))
        .limit(limit)
    )
    artists = result.scalars().all()
    return [_serialize_artist(a) for a in artists]


@router.get("/search/{query}")
async def search_artists(
    query: str,
    db: AsyncSession = Depends(get_db),
):
    """Search artists by name — returns list with basic stats from lot data."""
    result = await db.execute(
        select(
            Lot.artist_name_raw,
            func.count(Lot.id).label("lot_count"),
            func.avg(Lot.deal_score).label("avg_score"),
            func.avg(Lot.current_price).label("avg_price"),
        )
        .where(Lot.artist_name_raw.ilike(f"%{query}%"))
        .group_by(Lot.artist_name_raw)
        .order_by(func.count(Lot.id).desc())
        .limit(10)
    )
    artists = result.all()
    return {
        "artists": [
            {
                "name": a.artist_name_raw,
                "lot_count": a.lot_count,
                "avg_score": round(float(a.avg_score or 0), 1),
                "avg_price": round(float(a.avg_price or 0)),
            }
            for a in artists
            if a.artist_name_raw
        ]
    }


@router.get("/{artist_name}/format-matrix")
async def get_format_matrix(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Format Performance Matrix — normalized medium categories with price metrics."""
    from app.utils.cache import get_cached, set_cached

    cache_key = f"format_matrix:{artist_name.lower()}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    result = await db.execute(
        text("""
        SELECT medium, hammer_price_eur, premium_ratio
        FROM hammer_prices
        WHERE artist_name ILIKE :name
          AND medium IS NOT NULL AND medium != ''
          AND hammer_price_eur IS NOT NULL
        """),
        {"name": f"%{artist_name}%"},
    )
    rows = result.fetchall()

    if not rows:
        return {"artist_name": artist_name, "formats": []}

    # ── Medium normalizer ─────────────────────────────────────────────────────
    def normalize(raw: str) -> str:
        m = raw.lower().strip()
        if any(k in m for k in ("oil on", "oil paint", "huile sur")):
            return "Oil"
        if any(k in m for k in ("acrylic on", "acrylique", "acrylic paint")):
            return "Acrylic"
        if any(k in m for k in ("watercolor", "watercolour", "gouache", "aquarelle",
                                  "pastel", "charcoal", "pencil", "graphite",
                                  "crayon", "ink on paper", "india ink", "pen and ink",
                                  "wax crayon", "tempera on paper", "chalk")):
            return "Works on Paper"
        if any(k in m for k in ("lithograph", "linocut", "screenprint", "silkscreen",
                                  "serigraph", "etching", "woodcut", "aquatint",
                                  "drypoint", "mezzotint", "engraving", "linoprint",
                                  "offset litho", "color litho", "colour litho")):
            return "Prints"
        if any(k in m for k in ("photograph", "gelatin silver", "chromogenic",
                                  "c-print", "archival pigment", "inkjet",
                                  "silver print", "digital print")):
            return "Photography"
        if any(k in m for k in ("bronze", "sculpture", "marble", "ceramic",
                                  "terracotta", "cast", "steel", "resin",
                                  "wood", "stone", "plaster", "iron", "aluminium",
                                  "aluminum", "fiberglass")):
            return "Sculpture"
        if any(k in m for k in ("mixed media", "techniques mixtes", "multimedia")):
            return "Mixed Media"
        if any(k in m for k in ("acrylic", "acrylique")):
            return "Acrylic"
        if any(k in m for k in ("oil", "huile")):
            return "Oil"
        if any(k in m for k in ("ink", "drawing", "dessin", "pen ")):
            return "Works on Paper"
        if "paint" in m:
            return "Paintings"
        return "Other"

    # ── Aggregate ─────────────────────────────────────────────────────────────
    from collections import defaultdict
    buckets: dict = defaultdict(lambda: {"prices": [], "ratios": []})
    for medium, price, ratio in rows:
        cat = normalize(medium)
        buckets[cat]["prices"].append(price)
        if ratio is not None:
            buckets[cat]["ratios"].append(ratio)

    formats = []
    for cat, data in buckets.items():
        prices = data["prices"]
        ratios = data["ratios"]
        formats.append({
            "format": cat,
            "count": len(prices),
            "avg_price": round(sum(prices) / len(prices)),
            "max_price": round(max(prices)),
            "min_price": round(min(prices)),
            "sell_above_estimate_pct": round(
                len([r for r in ratios if r > 1]) / len(ratios) * 100, 1
            ) if ratios else None,
        })

    # Sort by count desc, filter out tiny buckets
    formats = sorted(
        [f for f in formats if f["count"] >= 2],
        key=lambda x: x["count"],
        reverse=True,
    )

    response = {"artist_name": artist_name, "formats": formats}
    set_cached(cache_key, response)
    return response


@router.get("/{artist_name}/geo-arbitrage")
async def get_geo_arbitrage(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Geographic Arbitrage Detector — avg prices by market region using currency + house signals."""
    from app.utils.cache import get_cached, set_cached

    cache_key = f"geo_arbitrage:{artist_name.lower()}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    result = await db.execute(
        text("""
        SELECT currency, auction_house, hammer_price_eur, premium_ratio
        FROM hammer_prices
        WHERE artist_name ILIKE :name
          AND hammer_price_eur IS NOT NULL
          AND currency IS NOT NULL
        """),
        {"name": f"%{artist_name}%"},
    )
    rows = result.fetchall()

    if not rows:
        return {"artist_name": artist_name, "regions": [], "spread_pct": None}

    # ── Region mapping ────────────────────────────────────────────────────────
    PARIS_HOUSES = {
        "artcurial", "cornette de saint cyr", "tajan", "eric pillon",
        "millon", "eric pillon encheres", "millon & associes",
        "gazette drouot", "drouot", "aguttes", "piasa", "osenat",
        "rouillac", "leclere", "pestel-debord",
    }
    GERMAN_HOUSES = {
        "ketterer", "grisebach", "van ham", "lempertz", "neumeister",
        "quittenbaum", "nagel", "bassenge", "stahl",
    }
    AUSTRIAN_HOUSES = {"dorotheum", "im kinsky"}
    ITALIAN_HOUSES = {
        "meeting art", "finarte", "farsetti", "galleria pananti",
        "il ponte", "sant'agostino", "poleschi", "cambi", "pandolfini",
        "farsettiarte", "finarte semenzato", "finarte casa d'aste",
        "farsetti arte", "cambi casa d'aste", "casa d'aste pandolfini",
        "poleschi casa d'aste", "sant'agostino casa d'arte",
        "galleria pananti", "il ponte", "bonino", "sant agostino",
    }
    NORDIC_HOUSES = {
        "bruun rasmussen", "bukowskis", "stockholms auktionsverk",
        "blomqvist", "lauritz",
    }

    def region_for(currency: str, house: str | None) -> tuple[str, str]:
        """Returns (region_name, flag)."""
        c = (currency or "").upper()
        h = (house or "").lower()

        if c == "GBP":
            return "London", "🇬🇧"
        if c == "HKD":
            return "Hong Kong", "🇭🇰"
        if c == "CHF":
            return "Switzerland", "🇨🇭"
        if c == "JPY":
            return "Tokyo", "🇯🇵"
        if c == "SEK":
            return "Stockholm", "🇸🇪"
        if c == "DKK":
            return "Copenhagen", "🇩🇰"
        if c == "CNY":
            return "China", "🇨🇳"
        if c == "AUD":
            return "Sydney", "🇦🇺"
        if c == "CAD":
            return "Toronto", "🇨🇦"
        if c == "MXN":
            return "Mexico City", "🇲🇽"
        if c == "USD":
            return "New York", "🇺🇸"
        if c == "EUR":
            if any(k in h for k in PARIS_HOUSES):
                return "Paris", "🇫🇷"
            if any(k in h for k in AUSTRIAN_HOUSES):
                return "Vienna", "🇦🇹"
            if any(k in h for k in GERMAN_HOUSES):
                return "Germany", "🇩🇪"
            if any(k in h for k in ITALIAN_HOUSES):
                return "Italy", "🇮🇹"
            if any(k in h for k in NORDIC_HOUSES):
                return "Scandinavia", "🇸🇪"
            # Fallback: try to infer from house name
            if any(k in h for k in ("paris", "drouot", "france")):
                return "Paris", "🇫🇷"
            if any(k in h for k in ("berlin", "munich", "hamburg", "köln", "cologne")):
                return "Germany", "🇩🇪"
            if any(k in h for k in ("vienna", "wien")):
                return "Vienna", "🇦🇹"
            if any(k in h for k in ("milan", "rome", "italian", "italia")):
                return "Italy", "🇮🇹"
            if any(k in h for k in ("brussels", "belgium", "belgi")):
                return "Brussels", "🇧🇪"
            if any(k in h for k in ("amsterdam", "netherlands", "dutch")):
                return "Amsterdam", "🇳🇱"
            return "Europe", "🇪🇺"

        return "Other", "🌍"

    # ── Aggregate ─────────────────────────────────────────────────────────────
    from collections import defaultdict
    buckets: dict = defaultdict(lambda: {"prices": [], "ratios": [], "flag": ""})

    for currency, house, price_eur, ratio in rows:
        region, flag = region_for(currency, house)
        buckets[region]["prices"].append(price_eur)
        buckets[region]["flag"] = flag
        if ratio is not None:
            buckets[region]["ratios"].append(ratio)

    regions = []
    for region, data in buckets.items():
        prices = data["prices"]
        ratios = data["ratios"]
        count = len(prices)
        if count < 3:
            continue
        avg_price = round(sum(prices) / count)
        sorted_p = sorted(prices)
        mid = len(sorted_p) // 2
        median_price = round((sorted_p[mid - 1] + sorted_p[mid]) / 2 if len(sorted_p) % 2 == 0 else sorted_p[mid])
        above_est = round(len([r for r in ratios if r > 1]) / len(ratios) * 100, 1) if ratios else None

        regions.append({
            "region": region,
            "flag": data["flag"],
            "count": count,
            "avg_price_eur": avg_price,
            "median_price_eur": median_price,
            "sell_above_estimate_pct": above_est,
        })

    # Sort by count desc
    regions = sorted(regions, key=lambda x: x["count"], reverse=True)

    # Arbitrage spread
    avg_prices = [r["avg_price_eur"] for r in regions if r["count"] >= 5]
    spread_pct = None
    best_buy = None
    best_sell = None
    if len(avg_prices) >= 2:
        max_p = max(avg_prices)
        min_p = min(avg_prices)
        spread_pct = round((max_p - min_p) / min_p * 100, 1) if min_p > 0 else None
        best_sell = next(r["region"] for r in regions if r["avg_price_eur"] == max_p)
        best_buy = next(r["region"] for r in regions if r["avg_price_eur"] == min_p)

    response = {
        "artist_name": artist_name,
        "regions": regions,
        "spread_pct": spread_pct,
        "best_buy": best_buy,
        "best_sell": best_sell,
        "total_sales": len(rows),
    }
    set_cached(cache_key, response)
    return response


@router.get("/{artist_name}/timing-optimizer")
async def get_timing_optimizer(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Auction House Timing Optimizer — best house × month combos from historical data."""
    from app.utils.cache import get_cached, set_cached

    cache_key = f"timing_optimizer:{artist_name.lower()}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    result = await db.execute(
        text("""
        SELECT
            auction_house,
            EXTRACT(MONTH FROM sale_date)::int AS month,
            COUNT(*)::int AS count,
            ROUND(AVG(hammer_price_eur)::numeric, 0)::float AS avg_price,
            ROUND(AVG(premium_ratio)::numeric, 3)::float AS avg_ratio,
            ROUND(
                COUNT(CASE WHEN premium_ratio > 1 THEN 1 END)::numeric
                / NULLIF(COUNT(premium_ratio), 0) * 100, 1
            )::float AS sell_above_pct
        FROM hammer_prices
        WHERE artist_name ILIKE :name
          AND sale_date IS NOT NULL
          AND hammer_price_eur IS NOT NULL
          AND auction_house IS NOT NULL
        GROUP BY auction_house, EXTRACT(MONTH FROM sale_date)
        HAVING COUNT(*) >= 2
        ORDER BY avg_price DESC NULLS LAST
        """),
        {"name": f"%{artist_name}%"},
    )
    rows = result.mappings().all()

    if not rows:
        return {"artist_name": artist_name, "entries": [], "best_house": None, "best_month": None}

    MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    SEASONS = {1:"Winter",2:"Winter",3:"Spring",4:"Spring",5:"Spring",
               6:"Summer",7:"Summer",8:"Summer",9:"Autumn",10:"Autumn",11:"Autumn",12:"Winter"}

    entries = [
        {
            "house": r["auction_house"],
            "month": r["month"],
            "month_name": MONTH_NAMES[r["month"] - 1],
            "season": SEASONS[r["month"]],
            "count": r["count"],
            "avg_price": int(r["avg_price"]) if r["avg_price"] else None,
            "avg_ratio": r["avg_ratio"],
            "sell_above_pct": r["sell_above_pct"],
        }
        for r in rows
    ]

    # Top combo by avg price (min 3 sales)
    qualified = [e for e in entries if e["count"] >= 3 and e["avg_price"]]
    best = qualified[0] if qualified else (entries[0] if entries else None)

    # Monthly aggregation across all houses
    monthly_summary = []
    for m in range(1, 13):
        prices = [e["avg_price"] for e in entries if e["month"] == m and e["avg_price"]]
        counts = [e["count"] for e in entries if e["month"] == m]
        if prices:
            monthly_summary.append({
                "month": m,
                "month_name": MONTH_NAMES[m - 1],
                "season": SEASONS[m],
                "avg_price": round(sum(prices) / len(prices)),
                "total_sales": sum(counts),
            })

    response = {
        "artist_name": artist_name,
        "entries": entries[:20],
        "monthly_summary": monthly_summary,
        "best_house": best["house"] if best else None,
        "best_month": best["month_name"] if best else None,
        "best_season": best["season"] if best else None,
        "best_avg_price": best["avg_price"] if best else None,
    }
    set_cached(cache_key, response)
    return response


@router.get("/{artist_name}/liquidity-map")
async def get_liquidity_map(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Liquidity Depth Map — 5 price bands × 3 time periods heatmap."""
    from app.utils.cache import get_cached, set_cached

    cache_key = f"liquidity_map:{artist_name.lower()}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    result = await db.execute(
        text("""
        SELECT
            CASE
                WHEN hammer_price_eur < 1000    THEN 0
                WHEN hammer_price_eur < 5000    THEN 1
                WHEN hammer_price_eur < 20000   THEN 2
                WHEN hammer_price_eur < 100000  THEN 3
                ELSE                                 4
            END AS price_band,
            CASE
                WHEN sale_date >= NOW() - INTERVAL '2 years' THEN 0
                WHEN sale_date >= NOW() - INTERVAL '5 years' THEN 1
                ELSE                                               2
            END AS period,
            COUNT(*)::int    AS count,
            ROUND(AVG(hammer_price_eur)::numeric, 0)::float AS avg_price,
            ROUND(MAX(hammer_price_eur)::numeric, 0)::float AS max_price
        FROM hammer_prices
        WHERE artist_name ILIKE :name
          AND hammer_price_eur IS NOT NULL
          AND sale_date IS NOT NULL
        GROUP BY price_band, period
        ORDER BY period, price_band
        """),
        {"name": f"%{artist_name}%"},
    )
    rows = result.mappings().all()

    if not rows:
        return {"artist_name": artist_name, "cells": [], "total_sales": 0}

    PRICE_BANDS = ["< €1K", "€1K–5K", "€5K–20K", "€20K–100K", "€100K+"]
    PERIODS     = ["Last 2 years", "2–5 years ago", "5+ years ago"]

    # Build full 5×3 grid (fill missing with zeros)
    grid = {(r["price_band"], r["period"]): r for r in rows}
    cells = []
    total = sum(r["count"] for r in rows)
    max_count = max(r["count"] for r in rows) if rows else 1

    for period in range(3):
        for band in range(5):
            r = grid.get((band, period))
            cells.append({
                "price_band": band,
                "price_label": PRICE_BANDS[band],
                "period": period,
                "period_label": PERIODS[period],
                "count": r["count"] if r else 0,
                "avg_price": int(r["avg_price"]) if r and r["avg_price"] else None,
                "max_price": int(r["max_price"]) if r and r["max_price"] else None,
                "intensity": round(r["count"] / max_count, 3) if r else 0,
            })

    response = {
        "artist_name": artist_name,
        "cells": cells,
        "price_bands": PRICE_BANDS,
        "periods": PERIODS,
        "total_sales": total,
        "max_count": max_count,
    }
    set_cached(cache_key, response)
    return response


@router.get("/{artist_name}/calendar-overlay")
async def get_calendar_overlay(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Institutional Calendar Overlay — major sale events per year+month for PriceChart markers."""
    from app.utils.cache import get_cached, set_cached

    cache_key = f"calendar_overlay:{artist_name.lower()}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    result = await db.execute(
        text("""
        SELECT
            EXTRACT(YEAR FROM sale_date)::int  AS year,
            EXTRACT(MONTH FROM sale_date)::int AS month,
            auction_house,
            COUNT(*)::int   AS count,
            ROUND(MAX(hammer_price_eur)::numeric, 0)::float AS max_price,
            ROUND(AVG(hammer_price_eur)::numeric, 0)::float AS avg_price
        FROM hammer_prices
        WHERE artist_name ILIKE :name
          AND sale_date IS NOT NULL
          AND hammer_price_eur IS NOT NULL
        GROUP BY year, month, auction_house
        ORDER BY year, month
        """),
        {"name": f"%{artist_name}%"},
    )
    rows = result.mappings().all()

    if not rows:
        return {"artist_name": artist_name, "events": [], "active_months": [], "peak_season": None}

    TIER1 = {"Christie's", "Sotheby's", "Phillips", "Bonhams"}
    MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

    events = [
        {
            "year": r["year"],
            "month": r["month"],
            "month_name": MONTH_NAMES[r["month"] - 1],
            "house": r["auction_house"],
            "is_tier1": r["auction_house"] in TIER1,
            "count": r["count"],
            "max_price": int(r["max_price"]) if r["max_price"] else None,
            "avg_price": int(r["avg_price"]) if r["avg_price"] else None,
        }
        for r in rows
    ]

    # Monthly activity pattern (across all years)
    from collections import Counter
    month_counts: Counter = Counter()
    for e in events:
        month_counts[e["month"]] += e["count"]

    active_months = [
        {"month": m, "month_name": MONTH_NAMES[m - 1], "total_sales": month_counts[m]}
        for m in sorted(month_counts, key=lambda x: -month_counts[x])
        if month_counts[m] > 0
    ]

    peak_month = active_months[0]["month"] if active_months else None
    SEASONS = {1:"Winter",2:"Winter",3:"Spring",4:"Spring",5:"Spring",
               6:"Summer",7:"Summer",8:"Summer",9:"Autumn",10:"Autumn",11:"Autumn",12:"Winter"}
    peak_season = SEASONS[peak_month] if peak_month else None

    response = {
        "artist_name": artist_name,
        "events": events,
        "active_months": active_months[:6],
        "peak_month": MONTH_NAMES[peak_month - 1] if peak_month else None,
        "peak_season": peak_season,
    }
    set_cached(cache_key, response)
    return response


@router.get("/{artist_name}/price-history")
async def get_artist_price_history(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Full price history for an artist — hammer prices over time."""
    from app.utils.cache import get_cached, set_cached

    cache_key = f"price_history:{artist_name.lower()}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    # Recent sales for display (50 shown in UI)
    result = await db.execute(
        text("""
        SELECT
            artist_name, artwork_title, year_created, medium,
            sale_date, hammer_price_eur, hammer_price, currency,
            estimate_low, estimate_high, premium_ratio,
            auction_house, image_url, lot_number, external_id
        FROM hammer_prices
        WHERE artist_name ILIKE :name AND hammer_price IS NOT NULL
        ORDER BY sale_date DESC NULLS LAST
        LIMIT 50
        """),
        {"name": f"%{artist_name}%"}
    )
    rows = result.mappings().all()

    # Year-by-year aggregation — all records, direct SQL (not limited to 50)
    year_result = await db.execute(
        text("""
        SELECT
            EXTRACT(YEAR FROM sale_date)::int AS year,
            AVG(hammer_price_eur)::float AS avg_price,
            MAX(hammer_price_eur)::float AS max_price,
            COUNT(*)::int AS sale_count
        FROM hammer_prices
        WHERE artist_name ILIKE :name
          AND hammer_price_eur IS NOT NULL
          AND sale_date IS NOT NULL
        GROUP BY EXTRACT(YEAR FROM sale_date)
        ORDER BY year
        """),
        {"name": f"%{artist_name}%"}
    )
    year_rows = year_result.mappings().all()

    # Total count
    count_result = await db.execute(
        text("SELECT COUNT(*) FROM hammer_prices WHERE artist_name ILIKE :name AND hammer_price IS NOT NULL"),
        {"name": f"%{artist_name}%"}
    )
    total_count = count_result.scalar() or 0

    if not year_rows and not rows:
        return {
            "artist_name": artist_name,
            "total_sales": 0,
            "sales": [],
            "statistics": None,
            "message": "No historical data yet. Fetching in background..."
        }

    sales = [dict(r) for r in rows]
    for s in sales:
        if s.get("sale_date"):
            s["sale_date"] = s["sale_date"].isoformat() if hasattr(s["sale_date"], "isoformat") else str(s["sale_date"])

    price_by_year = [
        {
            "year": str(r["year"]),
            "avg_price": round(r["avg_price"]),
            "max_price": round(r["max_price"]),
            "sale_count": r["sale_count"],
        }
        for r in year_rows
    ]

    # Stats from all records
    all_prices_result = await db.execute(
        text("""
        SELECT hammer_price_eur, premium_ratio
        FROM hammer_prices
        WHERE artist_name ILIKE :name AND hammer_price_eur IS NOT NULL
        """),
        {"name": f"%{artist_name}%"}
    )
    all_price_rows = all_prices_result.all()
    prices = [r[0] for r in all_price_rows]
    ratios = [r[1] for r in all_price_rows if r[1] is not None]

    # Trend: compare last 2 years vs 2 years before
    recent_years = [r for r in price_by_year if r["year"] >= str(max(int(y["year"]) for y in price_by_year) - 1)] if price_by_year else []
    older_years  = [r for r in price_by_year if r["year"] < str(max(int(y["year"]) for y in price_by_year) - 1)] if price_by_year else []
    trend_pct = 0.0
    if recent_years and older_years:
        recent_avg = sum(r["avg_price"] for r in recent_years) / len(recent_years)
        older_avg  = sum(r["avg_price"] for r in older_years)  / len(older_years)
        trend_pct  = round((recent_avg - older_avg) / older_avg * 100, 1) if older_avg > 0 else 0.0

    response = {
        "artist_name": artist_name,
        "total_sales": total_count,
        "sales": sales,
        "statistics": {
            "avg_hammer_eur": round(sum(prices) / len(prices)) if prices else None,
            "min_hammer_eur": round(min(prices)) if prices else None,
            "max_hammer_eur": round(max(prices)) if prices else None,
            "avg_premium_ratio": round(sum(ratios) / len(ratios), 2) if ratios else None,
            "sell_above_estimate_pct": round(len([r for r in ratios if r > 1]) / len(ratios) * 100, 1) if ratios else None,
            "trend_pct": trend_pct,
            "trend_direction": "up" if trend_pct > 5 else "down" if trend_pct < -5 else "stable",
        },
        "price_by_year": price_by_year,
    }

    set_cached(cache_key, response)
    return response


@router.get("/{artist_name}")
async def get_artist_intelligence(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Full artist intelligence — all market data Nautilus has on this artist."""
    from app.utils.cache import get_cached, set_cached
    from collections import Counter
    from datetime import datetime, timedelta

    cache_key = f"artist_intel:{artist_name.lower()}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    name_clean = artist_name.strip()

    # All lots by this artist
    lots_result = await db.execute(
        select(Lot)
        .where(Lot.artist_name_raw.ilike(f"%{name_clean}%"))
        .order_by(Lot.deal_score.desc().nullslast())
        .limit(50)
    )
    lots = lots_result.scalars().all()

    if not lots:
        # Fall back to ArtistProfile lookup
        profile_result = await db.execute(
            select(ArtistProfile)
            .where(ArtistProfile.name.ilike(f"%{name_clean}%"))
            .limit(1)
        )
        profile = profile_result.scalar_one_or_none()
        if profile:
            data = _serialize_artist(profile)
            data["total_lots"] = 0
            data["statistics"] = {}
            data["top_lots"] = []
            data["all_lots"] = []
            data["top_auction_houses"] = []
            data["categories"] = []
            data["ai_brief"] = ""
            data["artist_name"] = profile.name
            return data
        raise HTTPException(404, f"No data found for artist: {artist_name}")

    # Statistics
    scores = [l.deal_score for l in lots if l.deal_score]
    prices = [l.current_price or l.estimate_low for l in lots if (l.current_price or l.estimate_low)]
    hammer_prices = [l.hammer_price for l in lots if l.hammer_price]

    avg_price = sum(prices) / len(prices) if prices else 0
    min_price = min(prices) if prices else 0
    max_price = max(prices) if prices else 0
    sell_through = len(hammer_prices) / len(lots) * 100 if lots else 0

    house_counts = Counter(l.auction_house_name for l in lots if l.auction_house_name)
    cat_counts = Counter(l.category for l in lots if l.category)

    recent_cutoff = datetime.utcnow() - timedelta(days=90)
    recent_lots = [l for l in lots if l.created_at and l.created_at >= recent_cutoff]
    momentum = "rising" if len(recent_lots) > len(lots) * 0.3 else "stable" if len(recent_lots) > 0 else "low"

    top_lots = sorted([l for l in lots if l.deal_score], key=lambda x: x.deal_score, reverse=True)[:6]

    # AI brief (non-blocking — returns "" on failure)
    artist_brief = await _generate_artist_brief(name_clean, lots, avg_price)

    # Try to get nationality/movement from linked Artist record
    nationality = None
    movement = None
    for lot in lots:
        if lot.artist_id:
            from app.models.db_models import Artist
            artist_row = await db.get(Artist, lot.artist_id)
            if artist_row:
                nationality = artist_row.nationality
                movement = artist_row.movement
            break

    from app.api.lots import lot_to_list_dict
    response = {
        "artist_name": name_clean,
        "total_lots": len(lots),
        "nationality": nationality,
        "movement": movement,
        "statistics": {
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "max_score": round(max(scores), 1) if scores else 0,
            "avg_price": round(avg_price),
            "min_price": round(min_price),
            "max_price": round(max_price),
            "sell_through_rate": round(sell_through, 1),
            "momentum": momentum,
            "recent_lots_90d": len(recent_lots),
        },
        "top_auction_houses": [
            {"name": house, "count": count}
            for house, count in house_counts.most_common(5)
        ],
        "categories": [
            {"name": cat, "count": count}
            for cat, count in cat_counts.most_common(5)
        ],
        "top_lots": [lot_to_list_dict(l) for l in top_lots],
        "all_lots": [lot_to_list_dict(l) for l in lots[:20]],
        "ai_brief": artist_brief,
    }

    set_cached(cache_key, response)
    return response


async def _generate_artist_brief(artist_name: str, lots: list, avg_price: float) -> str:
    """Generate AI brief about artist market position."""
    try:
        from openai import AsyncOpenAI
        from app.utils.openai_guard import can_make_request, record_request
        from app.config import get_settings
        settings = get_settings()

        if not settings.openai_api_key or not can_make_request():
            return ""

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        scores = [l.deal_score for l in lots if l.deal_score]
        avg_score = sum(scores) / len(scores) if scores else 0
        houses = list({l.auction_house_name for l in lots[:5] if l.auction_house_name})

        prompt = f"""You are a senior art market analyst.
In 3 concise sentences, analyse the market position of {artist_name}:
- {len(lots)} lots tracked on Nautilus
- Avg conviction score: {avg_score:.0f}/100
- Avg price: €{avg_price:,.0f}
- Houses: {', '.join(houses) if houses else 'various'}

Be precise and factual. Mention investment potential."""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3,
        )
        record_request()
        return response.choices[0].message.content.strip()
    except Exception:
        return ""


def _serialize_artist(a: ArtistProfile) -> dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "nationality": a.nationality,
        "birth_year": a.birth_year,
        "death_year": a.death_year,
        "biography": a.biography,
        "image_url": a.image_url,
        "artsy_url": a.artsy_url,
        "investment_tier": a.investment_tier,
        "momentum_score": a.momentum_score,
        "liquidity_score": a.liquidity_score,
        "institutional_score": a.institutional_score,
        "gallery_tier_avg": a.gallery_tier_avg,
        "gallery_count": a.gallery_count,
        "top_gallery_name": a.top_gallery_name,
        "public_collections_count": a.public_collections_count,
        "shows_last_12m": a.shows_last_12m,
        "is_pre_auction": a.is_pre_auction,
        "signals": _generate_signals(a),
    }


def _generate_signals(a: ArtistProfile) -> list:
    signals = []
    if a.is_pre_auction:
        signals.append({"type": "opportunity", "icon": "◆", "label": "Pre-auction opportunity",
                        "detail": "In serious galleries but not yet at auction — optimal entry window", "color": "gold"})
    if a.momentum_score and a.momentum_score >= 70:
        signals.append({"type": "momentum", "icon": "↑", "label": f"Strong momentum ({a.momentum_score:.0f}/100)",
                        "detail": f"{a.shows_last_12m} shows in last 12 months", "color": "electric"})
    elif a.momentum_score and a.momentum_score >= 50:
        signals.append({"type": "momentum", "icon": "→", "label": f"Growing momentum ({a.momentum_score:.0f}/100)",
                        "detail": f"{a.shows_last_12m} shows in last 12 months", "color": "text"})
    if a.institutional_score and a.institutional_score >= 60:
        signals.append({"type": "institutional", "icon": "◎", "label": "Institutional validation",
                        "detail": f"Present in {a.public_collections_count} public collections", "color": "navy"})
    if a.gallery_tier_avg and a.gallery_tier_avg <= 1.5:
        signals.append({"type": "gallery", "icon": "★", "label": "Top-tier representation",
                        "detail": f"Represented by {a.top_gallery_name or 'Tier 1 gallery'}", "color": "gold"})
    if a.liquidity_score and a.liquidity_score >= 70:
        signals.append({"type": "liquidity", "icon": "◇", "label": "High liquidity",
                        "detail": f"Active in {a.gallery_count} galleries across multiple markets", "color": "electric"})
    return signals
