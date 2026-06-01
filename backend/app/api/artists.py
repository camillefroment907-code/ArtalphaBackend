"""Artists API — investment intelligence from Artsy data + Lot market data."""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, text
from typing import Optional

from app.database import get_db
from app.models.db_models import ArtistProfile, Lot, User
from app.api.auth_utils import get_current_user

router = APIRouter(prefix="/artist-profiles", tags=["artist-profiles"])

_ATTRIBUTION_PREFIXES = (
    "after ", "d'après", "d'apres", "efter ",
    "attribué à", "attribue a", "attributed to",
    "follower of", "circle of", "workshop of",
    "school of", "manner of",
    ". nach", " nach ",
)


def _is_attribution(name: str) -> bool:
    low = (name or "").lower()
    return any(p in low for p in _ATTRIBUTION_PREFIXES)


def _canonical_name(name: str) -> str:
    """Normalize to canonical: uppercase, strip, drop subtitle after first '.'."""
    return (name or "").upper().strip().split(".")[0].strip()


@router.get("/")
async def list_artists(
    tier: Optional[str] = Query(None),
    min_momentum: Optional[float] = Query(None),
    is_pre_auction: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    from collections import defaultdict
    serialized = [_serialize_artist(a) for a in artists if not _is_attribution(a.name or "")]
    groups: dict[str, list] = defaultdict(list)
    for s in serialized:
        groups[_canonical_name(s["name"] or "")].append(s)
    result = []
    for variants in groups.values():
        if len(variants) == 1:
            result.append(variants[0])
        else:
            result.append(max(variants, key=lambda v: (v.get("momentum_score") or 0)))
    return result


@router.get("/momentum")
async def get_momentum_artists(
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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


@router.get("/search")
async def list_top_artists(
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top artists by lot count — used for initial Artists page load."""
    from collections import defaultdict
    result = await db.execute(
        select(
            Lot.artist_name_raw,
            func.count(Lot.id).label("lot_count"),
            func.avg(Lot.deal_score).label("avg_score"),
            func.avg(Lot.current_price).label("avg_price"),
        )
        .where(Lot.artist_name_raw.isnot(None))
        .group_by(Lot.artist_name_raw)
        .order_by(func.count(Lot.id).desc())
        .limit(limit)
    )
    artists = result.all()
    raw = [
        {
            "name": a.artist_name_raw,
            "lot_count": a.lot_count,
            "avg_score": round(float(a.avg_score or 0), 1),
            "avg_price": round(float(a.avg_price or 0)),
        }
        for a in artists
        if a.artist_name_raw and not _is_attribution(a.artist_name_raw)
    ]
    groups: dict[str, list] = defaultdict(list)
    for entry in raw:
        groups[_canonical_name(entry["name"])].append(entry)
    grouped = []
    for variants in groups.values():
        if len(variants) == 1:
            grouped.append(variants[0])
        else:
            best = max(variants, key=lambda v: v["lot_count"])
            total_lots = sum(v["lot_count"] for v in variants)
            grouped.append({**best, "lot_count": total_lots})
    grouped.sort(key=lambda x: x["lot_count"], reverse=True)
    return {"artists": grouped[:limit]}


@router.get("/search/{query}")
async def search_artists(
    query: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search artists by name — returns list with basic stats from lot data."""
    use_trgm = len(query) >= 4

    if use_trgm:
        stmt = (
            select(
                Lot.artist_name_raw,
                func.count(Lot.id).label("lot_count"),
                func.avg(Lot.deal_score).label("avg_score"),
                func.avg(Lot.current_price).label("avg_price"),
                func.max(func.similarity(Lot.artist_name_raw, query)).label("sim"),
            )
            .where(func.similarity(Lot.artist_name_raw, query) > 0.15)
            .group_by(Lot.artist_name_raw)
            .order_by(func.max(func.similarity(Lot.artist_name_raw, query)).desc())
            .limit(10)
        )
    else:
        stmt = (
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

    result = await db.execute(stmt)
    artists = result.all()
    from collections import defaultdict
    raw = [
        {
            "name": a.artist_name_raw,
            "lot_count": a.lot_count,
            "avg_score": round(float(a.avg_score or 0), 1),
            "avg_price": round(float(a.avg_price or 0)),
        }
        for a in artists
        if a.artist_name_raw and not _is_attribution(a.artist_name_raw)
    ]
    groups: dict[str, list] = defaultdict(list)
    for entry in raw:
        groups[_canonical_name(entry["name"])].append(entry)
    grouped = []
    for variants in groups.values():
        if len(variants) == 1:
            grouped.append(variants[0])
        else:
            best = max(variants, key=lambda v: v["lot_count"])
            total_lots = sum(v["lot_count"] for v in variants)
            best_score = max(v["avg_score"] for v in variants)
            w_price = sum(v["avg_price"] * v["lot_count"] for v in variants) / total_lots if total_lots else 0
            grouped.append({
                "name": best["name"],
                "lot_count": total_lots,
                "avg_score": round(best_score, 1),
                "avg_price": round(w_price),
            })
    grouped.sort(key=lambda x: x["lot_count"], reverse=True)
    return {"artists": grouped}


@router.get("/{artist_name}/format-matrix")
async def get_format_matrix(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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


@router.get("/{artist_name}/investment-grade")
async def get_investment_grade(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Investment Grade Score 0-100 — aggregates liquidity, cycle, sell-through, trend, supply."""
    from app.utils.cache import get_cached, set_cached

    cache_key = f"investment_grade:{artist_name.lower()}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    result = await db.execute(
        text("""
        SELECT
            COUNT(*) AS total_sales,
            COUNT(*) FILTER (WHERE premium_ratio > 1) AS above_estimate,
            AVG(hammer_price_eur) AS avg_price,
            STDDEV(hammer_price_eur) AS price_stddev,
            COUNT(DISTINCT EXTRACT(YEAR FROM sale_date)::int) AS active_years,
            COUNT(DISTINCT auction_house) AS house_count,
            COUNT(*) FILTER (WHERE sale_date >= NOW() - INTERVAL '2 years') AS recent_count,
            AVG(hammer_price_eur) FILTER (WHERE sale_date >= NOW() - INTERVAL '2 years') AS recent_avg,
            AVG(hammer_price_eur) FILTER (WHERE sale_date < NOW() - INTERVAL '2 years') AS older_avg,
            COUNT(*) FILTER (WHERE sale_date < NOW() - INTERVAL '2 years') AS older_count,
            AVG(hammer_price_eur) FILTER (WHERE sale_date >= NOW() - INTERVAL '1 year') AS last_year_avg,
            AVG(hammer_price_eur) FILTER (
                WHERE sale_date >= NOW() - INTERVAL '2 years'
                  AND sale_date < NOW() - INTERVAL '1 year'
            ) AS prev_year_avg
        FROM hammer_prices
        WHERE artist_name ILIKE :name
          AND hammer_price_eur IS NOT NULL
          AND sale_date IS NOT NULL
        """),
        {"name": f"%{artist_name}%"},
    )
    row = result.mappings().first()

    if not row or not row["total_sales"]:
        return {"artist_name": artist_name, "score": None, "grade": None, "sub_scores": {}}

    total        = int(row["total_sales"] or 0)
    above_est    = int(row["above_estimate"] or 0)
    active_years = int(row["active_years"] or 0)
    house_count  = int(row["house_count"] or 0)
    recent_count = int(row["recent_count"] or 0)
    recent_avg   = float(row["recent_avg"] or 0)
    older_avg    = float(row["older_avg"] or 0)
    older_count  = int(row["older_count"] or 0)
    last_yr      = float(row["last_year_avg"]) if row["last_year_avg"] else None
    prev_yr      = float(row["prev_year_avg"]) if row["prev_year_avg"] else None
    stddev       = float(row["price_stddev"] or 0)
    avg_price    = float(row["avg_price"] or 0)

    # 1. Liquidity (0-20): volume + multi-house + recency
    liq = 0
    liq += 8 if total >= 50 else 5 if total >= 20 else 2 if total >= 5 else 0
    liq += 6 if house_count >= 4 else 3 if house_count >= 2 else 0
    liq += 6 if recent_count >= 5 else 3 if recent_count >= 2 else 0
    liq = min(20, liq)

    # 2. Cycle (0-20): price trend older vs recent 2yr
    cycle = 10
    if older_count > 0 and older_avg > 0:
        t = (recent_avg - older_avg) / older_avg
        cycle = 18 if t > 0.20 else 15 if t > 0.10 else 12 if t > 0 else 8 if t > -0.10 else 4

    # 3. Sell-through (0-20)
    st_pct = (above_est / total * 100) if total > 0 else 0
    st = 20 if st_pct >= 60 else 15 if st_pct >= 45 else 10 if st_pct >= 30 else 5 if st_pct >= 15 else 2

    # 4. Trend (0-20): year-over-year price momentum
    trend = 10
    if last_yr and prev_yr and prev_yr > 0:
        yoy = (last_yr - prev_yr) / prev_yr
        trend = 20 if yoy > 0.15 else 16 if yoy > 0.05 else 12 if yoy > 0 else 8 if yoy > -0.05 else 3

    # 5. Supply (0-20): price stability (low CV = scarce / controlled supply)
    cv = (stddev / avg_price) if avg_price > 0 else 1
    supply = 20 if cv < 0.5 else 15 if cv < 1.0 else 10 if cv < 1.5 else 6 if cv < 2.5 else 2

    score = liq + cycle + st + trend + supply

    if score >= 80:   grade, label = "A",  "Investment Grade"
    elif score >= 65: grade, label = "B+", "Strong"
    elif score >= 50: grade, label = "B",  "Solid"
    elif score >= 35: grade, label = "C",  "Speculative"
    else:             grade, label = "D",  "High Risk"

    response = {
        "artist_name": artist_name,
        "score": score,
        "grade": grade,
        "label": label,
        "sub_scores": {
            "liquidity":    liq,
            "cycle":        cycle,
            "sell_through": st,
            "trend":        trend,
            "supply":       supply,
        },
        "meta": {
            "total_sales":      total,
            "sell_through_pct": round(st_pct, 1),
            "active_years":     active_years,
            "house_count":      house_count,
        },
    }
    set_cached(cache_key, response)
    return response


@router.get("/autocomplete")
async def autocomplete_artists(
    q: str = Query(..., min_length=2),
    limit: int = Query(5, le=10),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fuzzy artist autocomplete with attribution filtering, dedup, and popularity weighting."""
    import unicodedata
    from collections import defaultdict
    from app.models.db_models import Artist

    def _norm(name: str) -> str:
        n = name.strip().lower()
        n = unicodedata.normalize("NFD", n)
        n = "".join(c for c in n if unicodedata.category(c) != "Mn")
        return n

    nq = _norm(q)

    # ── 1. Fetch extra headroom for filtering / dedup ─────────────────────────
    sim = func.similarity(Artist.name_normalized, nq)
    stmt = (
        select(Artist, sim.label("sim"))
        .where(sim > 0.2)
        .order_by(sim.desc())
        .limit(limit * 6)
    )
    result = await db.execute(stmt)
    rows = result.all()

    # ── 2. Filter attributions ────────────────────────────────────────────────
    rows = [(a, s) for a, s in rows if not _is_attribution(a.name or "")]

    # ── 3. Deduplicate by canonical name, keep highest liquidity_score ────────
    seen: dict[str, tuple] = {}
    for artist, s in rows:
        canon = _canonical_name(artist.name or "")
        existing = seen.get(canon)
        if existing is None or (artist.liquidity_score or 0) > (existing[0].liquidity_score or 0):
            seen[canon] = (artist, s)

    # ── 4. Re-sort by composite score (sim 70 % + popularity 30 %) ───────────
    deduped = sorted(
        seen.values(),
        key=lambda x: float(x[1]) * 0.7 + (x[0].liquidity_score or 50.0) / 100.0 * 0.3,
        reverse=True,
    )[:limit]

    # ── 5. Fallback to Lot.artist_name_raw when artists table is sparse ───────
    if len(deduped) < 2:
        sim_raw = func.similarity(Lot.artist_name_raw, nq)
        lot_stmt = (
            select(Lot.artist_name_raw, sim_raw.label("sim"))
            .where(
                Lot.artist_name_raw.isnot(None),
                sim_raw > 0.25,
            )
            .order_by(sim_raw.desc())
            .limit(limit * 6)
        )
        lot_result = await db.execute(lot_stmt)
        lot_rows = lot_result.all()

        fallback_seen: dict[str, float] = {}
        for raw_name, s in lot_rows:
            if _is_attribution(raw_name or ""):
                continue
            canon = _canonical_name(raw_name or "")
            if canon not in fallback_seen or float(s) > fallback_seen[canon]:
                fallback_seen[canon] = float(s)

        # Merge fallback entries not already covered by artists table
        covered = {_canonical_name(a.name or "") for a, _ in deduped}
        fallback_entries = [
            {"name": canon.title(), "similarity": round(s, 3), "confidence": "unresolved"}
            for canon, s in sorted(fallback_seen.items(), key=lambda x: x[1], reverse=True)
            if canon not in covered
        ][: limit - len(deduped)]

        suggestions = []
        for artist, similarity_score in deduped:
            confidence = (
                "confirmed" if similarity_score >= 0.80
                else "suggested" if similarity_score >= 0.45
                else "unresolved"
            )
            suggestions.append({
                "id": str(artist.id),
                "name": artist.name,
                "nationality": artist.nationality,
                "birth_year": artist.birth_year,
                "death_year": artist.death_year,
                "trend": artist.trend.value if artist.trend else None,
                "liquidity_score": artist.liquidity_score,
                "similarity": round(float(similarity_score), 3),
                "confidence": confidence,
            })
        suggestions.extend(fallback_entries)
        return {"suggestions": suggestions}

    # ── Normal path ───────────────────────────────────────────────────────────
    suggestions = []
    for artist, similarity_score in deduped:
        confidence = (
            "confirmed" if similarity_score >= 0.80
            else "suggested" if similarity_score >= 0.45
            else "unresolved"
        )
        suggestions.append({
            "id": str(artist.id),
            "name": artist.name,
            "nationality": artist.nationality,
            "birth_year": artist.birth_year,
            "death_year": artist.death_year,
            "trend": artist.trend.value if artist.trend else None,
            "liquidity_score": artist.liquidity_score,
            "similarity": round(float(similarity_score), 3),
            "confidence": confidence,
        })

    return {"suggestions": suggestions}


@router.get("/correlation-matrix")
async def get_correlation_matrix(
    artists: str = Query(..., description="Comma-separated artist names"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pearson correlation matrix of annual price returns for a list of artists."""
    artist_list = [a.strip() for a in artists.split(",") if a.strip()][:10]
    if len(artist_list) < 2:
        return {"artists": artist_list, "matrix": [], "years": []}

    # Year → avg_price per artist
    artist_series: dict[str, dict[int, float]] = {}
    for name in artist_list:
        r = await db.execute(
            text("""
            SELECT EXTRACT(YEAR FROM sale_date)::int AS year,
                   AVG(hammer_price_eur)::float       AS avg_price
            FROM hammer_prices
            WHERE artist_name ILIKE :name
              AND hammer_price_eur IS NOT NULL
              AND sale_date IS NOT NULL
            GROUP BY 1 ORDER BY 1
            """),
            {"name": f"%{name}%"},
        )
        artist_series[name] = {row["year"]: row["avg_price"] for row in r.mappings()}

    all_years = sorted({y for s in artist_series.values() for y in s})
    if len(all_years) < 2:
        return {"artists": artist_list, "matrix": [], "years": all_years}

    # Annual return series (year-over-year %)
    def returns(prices: dict[int, float]) -> list:
        out = []
        for i, yr in enumerate(all_years[1:], 1):
            p0, p1 = prices.get(all_years[i - 1]), prices.get(yr)
            out.append((p1 - p0) / p0 if p0 and p1 and p0 > 0 else None)
        return out

    def pearson(xs: list, ys: list) -> float | None:
        pairs = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
        if len(pairs) < 2:
            return None
        n = len(pairs)
        mx = sum(p[0] for p in pairs) / n
        my = sum(p[1] for p in pairs) / n
        num = sum((p[0] - mx) * (p[1] - my) for p in pairs)
        dx  = sum((p[0] - mx) ** 2 for p in pairs) ** 0.5
        dy  = sum((p[1] - my) ** 2 for p in pairs) ** 0.5
        return round(num / (dx * dy), 3) if dx > 0 and dy > 0 else None

    ret_map = {name: returns(artist_series[name]) for name in artist_list}
    matrix = [
        [1.0 if i == j else pearson(ret_map[a], ret_map[b]) for j, b in enumerate(artist_list)]
        for i, a in enumerate(artist_list)
    ]

    return {
        "artists": artist_list,
        "matrix": matrix,
        "years": all_years,
        "n_periods": len(all_years) - 1,
    }


@router.get("/{artist_name}")
async def get_artist_intelligence(
    artist_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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

    # Try to get birth/death year from ArtistProfile
    birth_year = None
    death_year = None
    try:
        _p_result = await db.execute(
            select(ArtistProfile).where(ArtistProfile.name.ilike(f"%{name_clean}%")).limit(1)
        )
        _p = _p_result.scalar_one_or_none()
        if _p:
            birth_year = _p.birth_year
            death_year = _p.death_year
    except Exception:
        pass

    from app.api.lots import lot_to_list_dict
    response = {
        "artist_name": name_clean,
        "total_lots": len(lots),
        "nationality": nationality,
        "movement": movement,
        "birth_year": birth_year,
        "death_year": death_year,
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
