from fastapi import APIRouter, Depends, Query, HTTPException, Request, Header, Response
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, String, case
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timedelta
import math
import asyncio
import json
import re
import statistics

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.utils.cache import get_cached, set_cached

from app.models.db_models import User

limiter = Limiter(key_func=get_remote_address)

# Approximate EUR conversion rates — used for currency-aware price filters
_FX_TO_EUR: dict[str, float] = {
    'EUR': 1.0, 'USD': 0.92, 'GBP': 1.17,
    'SEK': 0.087, 'CHF': 1.05, 'DKK': 0.134,
    'NOK': 0.087, 'JPY': 0.006, 'HKD': 0.118,
    'AUD': 0.59, 'CAD': 0.68,
}

from app.utils.real_cost import compute_real_cost, compute_max_bid
from app.utils.estimation_bias import get_estimation_bias
from app.utils.cycle_stage import get_cycle_stage
from app.utils.consignment_alert import get_consignment_alert
from app.utils.provenance_risk import get_provenance_risk


def _resolve_ref_price(lot) -> tuple[float | None, str | None]:
    """Return (hammer_price, basis) for real cost calculation.

    Prefers current_price (live bid), falls back to estimate midpoint,
    then estimate_low alone — never uses estimate_low when estimate_high exists.
    """
    if lot.current_price:
        return float(lot.current_price), "current_bid"
    if lot.estimate_low and lot.estimate_high:
        return (float(lot.estimate_low) + float(lot.estimate_high)) / 2.0, "estimate_mid"
    if lot.estimate_low:
        return float(lot.estimate_low), "estimate_low"
    return None, None


def lot_to_list_dict(lot) -> dict:
    """Minimal lot payload for list views — skip heavy fields."""
    hammer, price_basis = _resolve_ref_price(lot)
    real_cost = None
    if hammer:
        real_cost = compute_real_cost(hammer, lot.auction_house_name)
        real_cost["ref_price"] = round(hammer)
        real_cost["price_basis"] = price_basis
    return {
        "id": str(lot.id),
        "title": lot.title,
        "artist_name_raw": lot.artist_name_raw,
        "current_price": lot.current_price,
        "estimate_low": lot.estimate_low,
        "estimate_high": lot.estimate_high,
        "deal_score": lot.deal_score,
        "pct_below_low_estimate": lot.pct_below_low_estimate,
        "image_url": lot.image_url,
        "auction_house_name": lot.auction_house_name,
        "auction_date": lot.auction_date.isoformat() if lot.auction_date else None,
        "category": lot.category,
        "source": lot.source.value if lot.source else None,
        "currency": lot.currency,
        "medium": lot.medium,
        "real_cost": real_cost,
    }


def serialize_lot(lot, plan: str) -> dict:
    """Plan-aware lot serializer. Free users get a reduced payload."""
    data = {
        "id": str(lot.id),
        "title": lot.title,
        "artist_name_raw": lot.artist_name_raw,
        "image_url": lot.image_url,
        "deal_score": lot.deal_score,
        "estimate_low": lot.estimate_low,
        "pct_below_low_estimate": lot.pct_below_low_estimate,
        "auction_house_name": lot.auction_house_name,
        "currency": lot.currency,
    }
    if plan != "free":
        data.update({
            "url": lot.url,
            "estimate_high": lot.estimate_high,
            "current_price": lot.current_price,
            "source": lot.source.value if lot.source else None,
        })
    return data


def parse_dimensions(dimensions_str: str) -> dict:
    """
    Parse dimensions from strings like:
    - "81.3 × 116.8 cm"
    - "32 x 46 in."
    - "H: 120 cm, W: 80 cm"
    Returns: { width_cm: float | None, height_cm: float | None }
    """
    if not dimensions_str:
        return {"width_cm": None, "height_cm": None}

    # Try "W × H cm/in" or "W x H cm/in"
    match = re.search(
        r'(\d+\.?\d*)\s*[×x]\s*(\d+\.?\d*)\s*(cm|in)',
        dimensions_str,
        re.IGNORECASE,
    )
    if match:
        w, h, unit = float(match.group(1)), float(match.group(2)), match.group(3).lower()
        if unit == 'in':
            w, h = w * 2.54, h * 2.54
        return {"width_cm": round(w, 1), "height_cm": round(h, 1)}

    return {"width_cm": None, "height_cm": None}

from app.database import get_db, AsyncSessionLocal
from app.models.db_models import (
    Lot, Artist, LotStatus, AuctionHouse, MarketType,
    ArtistSignal, ArtistProfile, HammerPrice, UserEvent, DecisionArchive,
)
from app.models.schemas import LotOut, LotListResponse, TopDeal, DashboardStats
from app.api.auth_utils import get_current_user_optional, get_current_user
from app.models.db_models import User
from app.config import get_settings as _get_settings
from app.utils.plan_utils import get_user_plan
from app.engines.projections import compute_market_benchmarks

ADMIN_EMAILS = {e.strip() for e in _get_settings().admin_emails.split(",") if e.strip()}


# Max results per page by plan — enforced server-side so API bypass is impossible
_PLAN_PAGE_LIMIT: dict[str, int] = {
    "free":          6,
    "starter":       10,
    "investor":      9999,
    "pro":           9999,
    "institutional": 9999,
}


router = APIRouter(prefix="/lots", tags=["lots"])


# ── SSE: real-time stream ─────────────────────────────────────────────────────

async def _lot_stream_generator(request: Request, min_score: float = 0):
    last_seen: set = set()
    heartbeat = 0

    while True:
        if await request.is_disconnected():
            break

        heartbeat += 1

        try:
            async with AsyncSessionLocal() as session:
                cutoff = datetime.utcnow() - timedelta(seconds=30)
                stmt = (
                    select(Lot)
                    .options(selectinload(Lot.artist))
                    .where(
                        and_(
                            Lot.scored_at >= cutoff,
                            Lot.deal_score >= min_score,
                        )
                    )
                    .order_by(desc(Lot.deal_score))
                    .limit(20)
                )
                result = await session.execute(stmt)
                lots = result.scalars().all()

                new_lots = [l for l in lots if str(l.id) not in last_seen]

                for lot in new_lots:
                    last_seen.add(str(lot.id))
                    lot_data = {
                        "id": str(lot.id),
                        "title": lot.title,
                        "artist_name_raw": lot.artist_name_raw,
                        "source": lot.source.value if lot.source else None,
                        "category": lot.category,
                        "estimate_low": lot.estimate_low,
                        "estimate_high": lot.estimate_high,
                        "current_price": lot.current_price,
                        "currency": lot.currency,
                        "deal_score": lot.deal_score,
                        "is_deal": lot.is_deal,
                        "pct_below_low_estimate": lot.pct_below_low_estimate,
                        "pct_below_market_avg": lot.pct_below_market_avg,
                        "auction_date": lot.auction_date.isoformat() if lot.auction_date else None,
                        "auction_house_name": lot.auction_house_name,
                        "image_url": lot.image_url,
                        "url": lot.url,
                        "status": lot.status.value if lot.status else None,
                        "artist": {
                            "name": lot.artist.name,
                            "liquidity_score": lot.artist.liquidity_score,
                            "avg_auction_price": lot.artist.avg_auction_price,
                            "trend": lot.artist.trend.value if lot.artist.trend else None,
                        } if lot.artist else None,
                        "scored_at": lot.scored_at.isoformat() if lot.scored_at else None,
                    }
                    yield f"event: lot\ndata: {json.dumps(lot_data)}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

        if heartbeat % 5 == 0:
            yield f"event: heartbeat\ndata: {json.dumps({'ts': datetime.utcnow().isoformat()})}\n\n"

        await asyncio.sleep(8)


@router.get("/stream")
async def stream_lots(
    request: Request,
    min_score: float = Query(0, ge=0, le=100),
    current_user: User = Depends(get_current_user),
):
    """SSE — streams new scored lots every 8s."""
    return StreamingResponse(
        _lot_stream_generator(request, min_score),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── REST ──────────────────────────────────────────────────────────────────────

@router.get("")
@limiter.limit("30/minute")
async def list_lots(
    request: Request,
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_score: Optional[float] = Query(None, ge=0, le=100),
    is_deal: Optional[bool] = None,
    # Single source (alpha tab) — kept for backward compat
    source: Optional[str] = None,
    # Multi-source (market tab) — comma-separated: "drouot,invaluable"
    sources: Optional[str] = Query(None),
    category: Optional[str] = None,
    categories: Optional[str] = Query(None),  # comma-separated: "Paintings,Drawings"
    medium: Optional[str] = None,
    auction_house: Optional[str] = Query(None),
    artist: Optional[str] = None,
    search: Optional[str] = Query(None),
    provenance: Optional[str] = Query(None),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    estimate_max: Optional[float] = Query(None),
    # Both naming conventions accepted (frontend sends auction_date_from)
    auction_from: Optional[datetime] = None,
    auction_to: Optional[datetime] = None,
    auction_date_from: Optional[datetime] = Query(None),
    auction_date_to: Optional[datetime] = Query(None),
    status: Optional[str] = None,
    market_type: Optional[str] = Query(None, pattern="^(auction|primary|gallery)$"),
    min_confidence: Optional[float] = Query(None, ge=0, le=100),
    low_supply: bool = Query(False),
    quality_tier: Optional[str] = Query(None),
    sort_by: str = Query("deal_score", pattern="^(deal_score|auction_date|created_at|current_price)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Block unverified free users (bypass for pro/admin)
    ADMIN_EMAIL = "camillefroment907@gmail.com"
    if current_user and not current_user.is_verified:
        if current_user.email != ADMIN_EMAIL and (current_user.plan or "free") == "free":
            raise HTTPException(
                status_code=403,
                detail="Please verify your email before accessing content.",
            )

    # ── Plan enforcement ─────────────────────────────────────────────────────
    # Cap page_size AND page to the caller's plan limit so API bypass is impossible.
    plan = await get_user_plan(current_user, db)
    max_per_page = _PLAN_PAGE_LIMIT.get(plan, 3)
    is_limited = max_per_page < 9999
    if page_size > max_per_page:
        page_size = max_per_page
    # Free/starter: only page 1 allowed — pagination would bypass the lot cap
    if is_limited and page > 1:
        from app.models.schemas import LotListResponse
        return {"items": [], "total": max_per_page, "pages": 1, "page": page, "page_size": page_size}

    # ── Cache lookup ─────────────────────────────────────────────────────────
    cache_key = f"lots:{plan}:{sort_by}:{sort_dir}:{min_score}:{page}:{page_size}:{category or ''}:{categories or ''}:{search or ''}:{provenance or ''}:{source or ''}:{sources or ''}:{min_price or 0}:{max_price or 0}:{auction_date_from or ''}:{auction_date_to or ''}"
    cached = get_cached(cache_key, ttl=120)
    if cached:
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
        response.headers["Vary"] = "Accept-Encoding"
        return cached

    # Coalesce date param names — frontend may send either form
    resolved_from = auction_date_from or auction_from
    resolved_to   = auction_date_to   or auction_to

    filters = [
        # Only show upcoming/live lots in main feed — past lots go to /missed.
        # NULL auction_date is only allowed for primary/gallery lots (no auction date by nature).
        # Auction lots must have a future date. Sold lots (hammer_price set) are excluded.
        or_(
            and_(
                Lot.auction_date.is_(None),
                or_(
                    Lot.market_type == MarketType.PRIMARY,
                    Lot.market_type == MarketType.GALLERY,
                ),
            ),
            Lot.auction_date >= datetime.utcnow(),
        ),
        Lot.hammer_price.is_(None),
    ]
    # Free-tier delay: only show lots ingested >5 min ago (prevents API racing)
    if plan == "free":
        filters.append(Lot.created_at <= datetime.utcnow() - timedelta(minutes=5))
    # Minimum €50 EUR — exclut les lots trivialement cheap (ex: 26 SEK)
    # Lots sans aucun prix (NULL/NULL) sont conservés
    _eur_val = case(
        (Lot.currency == 'SEK', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.087),
        (Lot.currency == 'USD', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.92),
        (Lot.currency == 'GBP', func.coalesce(Lot.current_price, Lot.estimate_low) * 1.17),
        (Lot.currency == 'DKK', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.134),
        (Lot.currency == 'NOK', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.087),
        (Lot.currency == 'CHF', func.coalesce(Lot.current_price, Lot.estimate_low) * 1.05),
        else_=func.coalesce(Lot.current_price, Lot.estimate_low),
    )
    filters.append(
        or_(
            and_(Lot.current_price.is_(None), Lot.estimate_low.is_(None)),
            _eur_val >= 50,
        )
    )
    if min_score is not None:
        filters.append(Lot.deal_score >= min_score)
    if max_score is not None:
        filters.append(Lot.deal_score <= max_score)
    if is_deal is not None:
        filters.append(Lot.is_deal == is_deal)
    if source:
        try:
            filters.append(Lot.source == AuctionHouse[source.upper()])
        except KeyError:
            return LotListResponse(items=[], total=0, page=page, page_size=page_size, pages=0)
    if sources:
        tokens = [s.strip() for s in sources.split(",") if s.strip()]
        valid_enums = []
        for token in tokens:
            try:
                valid_enums.append(AuctionHouse[token.upper()])
            except KeyError:
                pass
        if valid_enums:
            filters.append(or_(*[Lot.source == e for e in valid_enums]))
    _CAT_FR_TO_EN: dict[str, str] = {
        'Peinture': 'Paintings',
        'Estampes & Éditions': 'Prints & Multiples',
        'Estampes': 'Prints & Multiples',
        'Sculpture': 'Sculpture',
        'Photographie': 'Photography',
        'Dessin & Papier': 'Drawings',
        'Dessin': 'Drawings',
        'Art urbain': 'Street Art',
    }
    _CAT_FALLBACK: dict[str, list[str]] = {
        "Paintings":          ["oil", "paint", "huile", "acrylic", "canvas", "toile", "watercolor", "aquarelle"],
        "Prints & Multiples": ["print", "lithograph", "gravure", "etching", "screenprint", "estampe", "woodcut"],
        "Drawings":           ["drawing", "dessin", "pastel", "pencil", "crayon", "gouache", "charcoal", "ink"],
        "Sculpture":          ["sculpture", "bronze", "ceramic", "marble", "terracotta", "resin"],
        "Photography":        ["photo", "photograph", "tirage"],
        "Street Art":         ["street art", "urban art", "graffiti", "spray"],
    }

    # Build normalized category list (supports FR and EN, single or multi)
    cat_list: list[str] = []
    if categories:
        cat_list = [_CAT_FR_TO_EN.get(c.strip(), c.strip()) for c in categories.split(',') if c.strip()]
    elif category:
        cat_list = [_CAT_FR_TO_EN.get(category, category)]

    if cat_list:
        multi_conds = []
        for cat in cat_list:
            multi_conds.append(Lot.category.ilike(f"%{cat}%"))
            for kw in _CAT_FALLBACK.get(cat, []):
                multi_conds.append(Lot.medium.ilike(f"%{kw}%"))
                multi_conds.append(Lot.title.ilike(f"%{kw}%"))
        filters.append(or_(*multi_conds))
    if medium:
        filters.append(Lot.medium.ilike(f"%{medium}%"))
    if auction_house:
        filters.append(Lot.auction_house_name.ilike(f"%{auction_house}%"))
    if artist:
        filters.append(Lot.artist_name_raw.ilike(f"%{artist}%"))
    if search:
        filters.append(
            or_(
                Lot.title.ilike(f"%{search}%"),
                Lot.artist_name_raw.ilike(f"%{search}%"),
                Lot.auction_house_name.ilike(f"%{search}%"),
                Lot.category.ilike(f"%{search}%"),
            )
        )
    if provenance:
        filters.append(
            or_(
                Lot.artist_name_raw.ilike(f"%{provenance}%"),
                Lot.medium.ilike(f"%{provenance}%"),
                Lot.description.ilike(f"%{provenance}%"),
            )
        )
    if min_price is not None and min_price > 0:
        # Convert EUR min_price to each native currency before comparing
        price_min_conds = []
        for curr, rate in _FX_TO_EUR.items():
            if rate > 0:
                threshold = min_price / rate
                price_min_conds.append(
                    and_(
                        Lot.currency == curr,
                        or_(Lot.current_price >= threshold, Lot.estimate_low >= threshold),
                    )
                )
        price_min_conds.append(
            and_(
                Lot.currency.is_(None),
                or_(Lot.current_price >= min_price, Lot.estimate_low >= min_price),
            )
        )
        filters.append(or_(*price_min_conds))
    if max_price is not None and max_price > 0:
        # Convert EUR max_price to each native currency before comparing
        price_max_conds = []
        for curr, rate in _FX_TO_EUR.items():
            if rate > 0:
                threshold = max_price / rate
                price_max_conds.append(
                    and_(
                        Lot.currency == curr,
                        or_(Lot.current_price <= threshold, Lot.estimate_low <= threshold),
                    )
                )
        price_max_conds.append(
            and_(
                Lot.currency.is_(None),
                or_(Lot.current_price <= max_price, Lot.estimate_low <= max_price),
            )
        )
        filters.append(or_(*price_max_conds))
    if estimate_max is not None and estimate_max > 0:
        # Build OR conditions: for each currency, compute threshold in that currency
        currency_conds = []
        for curr, rate in _FX_TO_EUR.items():
            if rate > 0:
                threshold = estimate_max / rate
                currency_conds.append(
                    and_(
                        Lot.currency == curr,
                        or_(
                            Lot.estimate_low <= threshold,
                            Lot.estimate_low.is_(None),
                        )
                    )
                )
        # Also handle NULL currency — assume EUR
        currency_conds.append(
            and_(
                Lot.currency.is_(None),
                or_(Lot.estimate_low <= estimate_max, Lot.estimate_low.is_(None))
            )
        )
        filters.append(or_(*currency_conds))
    if resolved_from:
        filters.append(Lot.auction_date >= resolved_from)
    if resolved_to:
        filters.append(Lot.auction_date <= resolved_to)
    if status:
        filters.append(Lot.status.cast(String) == status)
    if market_type:
        try:
            filters.append(Lot.market_type == MarketType[market_type.upper()])
        except KeyError:
            pass
    if min_confidence is not None:
        filters.append(
            or_(
                Lot.confidence_score >= min_confidence,
                Lot.confidence_score.is_(None),  # don't filter out unscored lots
            )
        )
    if quality_tier is not None:
        filters.append(Lot.quality_tier == quality_tier)
    if low_supply:
        # Only keep lots whose artist has ≤ 3 active lots at auction
        supply_subq = (
            select(Lot.artist_name_raw)
            .where(
                and_(
                    Lot.artist_name_raw.isnot(None),
                    or_(Lot.auction_date.is_(None), Lot.auction_date >= datetime.utcnow()),
                )
            )
            .group_by(Lot.artist_name_raw)
            .having(func.count(Lot.id) <= 3)
        )
        filters.append(Lot.artist_name_raw.in_(supply_subq))

    count_stmt = select(func.count(Lot.id))
    if filters:
        count_stmt = count_stmt.where(and_(*filters))
    count_result = await db.execute(count_stmt)
    total = count_result.scalar()

    sort_col = getattr(Lot, sort_by, Lot.deal_score)
    sort_expr = desc(sort_col) if sort_dir == "desc" else sort_col

    stmt = (
        select(Lot)
        .order_by(sort_expr.nullslast() if sort_dir == "desc" else sort_expr)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if filters:
        stmt = stmt.where(and_(*filters))

    result = await db.execute(stmt)
    lots = result.scalars().all()

    # Compute supply_count per artist for returned lots
    artist_names = list({l.artist_name_raw for l in lots if l.artist_name_raw})
    supply_map: dict = {}
    if artist_names:
        from sqlalchemy import text as _text
        sc_result = await db.execute(
            _text("""
                SELECT artist_name_raw, COUNT(*) as cnt
                FROM lots
                WHERE artist_name_raw = ANY(:names)
                  AND (auction_date IS NULL OR auction_date >= NOW())
                GROUP BY artist_name_raw
            """),
            {"names": artist_names},
        )
        supply_map = {r[0]: r[1] for r in sc_result.fetchall()}

    def _enrich(lot):
        d = lot_to_list_dict(lot)
        cnt = supply_map.get(lot.artist_name_raw, 0)
        d["supply_count"] = cnt
        d["is_low_supply"] = cnt <= 3
        return d

    items = [_enrich(lot) for lot in lots]
    # For limited plans: cap total/pages so frontend can't infer real count
    # and "Load more" never appears.
    effective_total = min(total, max_per_page) if is_limited else total
    result = {
        "items": items,
        "total": effective_total,
        "page": page,
        "page_size": page_size,
        "pages": 1 if is_limited else (math.ceil(total / page_size) if total > 0 else 0),
    }
    set_cached(cache_key, result)
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
    response.headers["Vary"] = "Accept-Encoding"
    return result


@router.get("/daily-unlock")
async def daily_unlock(db: AsyncSession = Depends(get_db)):
    """Returns the single best-scored lot from the last 24h (free to access — teaser)."""
    now = datetime.utcnow()
    cutoff = now - timedelta(days=1)
    stmt = (
        select(Lot)
        .where(
            and_(
                Lot.created_at >= cutoff,
                Lot.image_url.isnot(None),
                Lot.deal_score.isnot(None),
                Lot.auction_date >= now,
                Lot.hammer_price.is_(None),
            )
        )
        .order_by(desc(Lot.deal_score))
        .limit(1)
    )
    result = await db.execute(stmt)
    lot = result.scalar_one_or_none()
    if not lot:
        stmt2 = (
            select(Lot)
            .where(
                and_(
                    Lot.image_url.isnot(None),
                    Lot.auction_date >= now,
                    Lot.hammer_price.is_(None),
                )
            )
            .order_by(desc(Lot.deal_score))
            .limit(1)
        )
        result2 = await db.execute(stmt2)
        lot = result2.scalar_one_or_none()
    if not lot:
        return {}
    payload = serialize_lot(lot, "free")
    payload["rationale"] = lot.score_rationale or None
    return payload


@router.get("/hot-deals")
async def get_hot_deals(
    limit: int = Query(20, ge=1, le=200),
    min_score: float = Query(30.0, ge=0, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the best deals right now — lots significantly below market value."""
    now = datetime.utcnow()

    # Top scored lots (ordered by score)
    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(
            and_(
                Lot.deal_score.isnot(None),
                Lot.deal_score >= min_score,
                Lot.auction_date >= now,
                Lot.url.isnot(None),
                Lot.url != "",
            )
        )
        .order_by(desc(Lot.deal_score))
        .limit(limit)
    )
    result = await db.execute(stmt)
    scored_lots = result.scalars().all()

    # Always include real lots (verified lot URLs from actual auction sites)
    real_stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(
            and_(
                Lot.deal_score.isnot(None),
                Lot.auction_date >= now,
                Lot.url.isnot(None),
                Lot.url != "",
                or_(
                    Lot.url.like("%drouot.com/fr/l/%"),
                    Lot.url.like("%drouot.com/en/l/%"),
                ),
            )
        )
        .order_by(desc(Lot.deal_score))
        .limit(30)
    )
    real_result = await db.execute(real_stmt)
    real_lots = real_result.scalars().all()

    # Build final list: real lots first (always included), then fill with scored lots
    seen_ids: set = set(lot.id for lot in real_lots)
    extra = [lot for lot in scored_lots if lot.id not in seen_ids]
    lots = list(real_lots) + extra[:max(0, limit - len(real_lots))]

    return [
        {
            "id": str(lot.id),
            "title": lot.title,
            "artist": lot.artist_name_raw,
            "source": lot.source.value if lot.source else None,
            "deal_score": lot.deal_score,
            "deal_class": (
                "FIRE" if (lot.deal_score or 0) >= 83 else
                "HOT" if (lot.deal_score or 0) >= 77 else
                "GOOD"
            ),
            "current_price": lot.current_price,
            "estimate_low": lot.estimate_low,
            "estimate_high": lot.estimate_high,
            "pct_below_estimate": lot.pct_below_low_estimate,
            "pct_below_market": lot.pct_below_market_avg,
            "currency": lot.currency,
            "auction_date": lot.auction_date.isoformat() if lot.auction_date else None,
            "auction_house": lot.auction_house_name,
            "url": lot.url,
            "image_url": lot.image_url,
            "category": lot.category,
        }
        for lot in lots
    ]


@router.get("/top-deals", response_model=List[TopDeal])
async def get_top_deals(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = datetime.utcnow()
    month_ahead = today + timedelta(days=30)

    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(
            and_(
                Lot.deal_score >= 70,
                Lot.auction_date >= today,
                Lot.auction_date <= month_ahead,
                Lot.status.cast(String) == 'upcoming',
                Lot.market_type == MarketType.AUCTION,
            )
        )
        .order_by(desc(Lot.deal_score))
        .limit(limit)
    )

    result = await db.execute(stmt)
    lots = result.scalars().all()

    top_deals = []
    for rank, lot in enumerate(lots, 1):
        saving_eur = None
        saving_pct = None
        if lot.current_price and lot.estimate_low:
            saving_eur = max(0, lot.estimate_low - lot.current_price)
            saving_pct = saving_eur / lot.estimate_low * 100 if lot.estimate_low > 0 else None

        top_deals.append(TopDeal(
            lot=lot,
            rank=rank,
            estimated_saving_eur=round(saving_eur, 2) if saving_eur else None,
            estimated_saving_pct=round(saving_pct, 1) if saving_pct else None,
        ))

    return top_deals


@router.get("/count")
@limiter.limit("10/minute")
async def get_lot_count(request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count(Lot.id)))
    return {"total": result.scalar() or 0}


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    total = await db.execute(select(func.count(Lot.id)))
    deals_today = await db.execute(
        select(func.count(Lot.id)).where(
            and_(
                Lot.deal_score >= 83,
                Lot.hammer_price.is_(None),
                Lot.auction_date >= datetime.utcnow(),
            )
        )
    )
    avg_score = await db.execute(
        select(func.avg(Lot.deal_score)).where(Lot.deal_score.isnot(None))
    )
    top_score = await db.execute(
        select(func.max(Lot.deal_score)).where(Lot.is_deal == True)
    )

    from app.models.db_models import Alert
    alerts_today = await db.execute(
        select(func.count(Alert.id)).where(Alert.sent_at >= today_start)
    )

    return DashboardStats(
        total_lots_tracked=total.scalar() or 0,
        deals_detected_today=deals_today.scalar() or 0,
        avg_deal_score=round(avg_score.scalar() or 0, 1),
        top_deal_score=round(top_score.scalar() or 0, 1),
        alerts_sent_today=alerts_today.scalar() or 0,
        sources_active=3,
    )


@router.get("/trending", response_model=LotListResponse)
async def get_trending_lots(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lots by blue-chip or trending artists."""
    from app.engines.artist_trends import BLUE_CHIP_ARTISTS, TRENDING_ARTISTS

    all_artists = list(BLUE_CHIP_ARTISTS | TRENDING_ARTISTS)
    now = datetime.utcnow()

    # Build OR conditions for partial name matching
    artist_filters = [
        func.lower(Lot.artist_name_raw).contains(name)
        for name in all_artists
    ]

    base = and_(
        Lot.auction_date > now,
        Lot.status.cast(String) == 'upcoming',
        or_(*artist_filters),
    )

    total = (await db.execute(select(func.count(Lot.id)).where(base))).scalar() or 0
    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(base)
        .order_by(desc(Lot.deal_score))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    lots = (await db.execute(stmt)).scalars().all()
    return LotListResponse(
        items=lots, total=total, page=page, page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/categories", response_model=List[str])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Returns distinct non-null categories ordered by frequency."""
    stmt = (
        select(Lot.category, func.count(Lot.id).label("cnt"))
        .where(Lot.category.isnot(None))
        .group_by(Lot.category)
        .order_by(desc("cnt"))
        .limit(20)
    )
    result = await db.execute(stmt)
    return [row.category for row in result.all() if row.category]


@router.get("/missed", response_model=LotListResponse)
async def get_missed_deals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Past lots — all sales whose auction date has passed."""
    now = datetime.utcnow()
    filters = [
        Lot.auction_date < now,
        Lot.auction_date.isnot(None),
    ]
    total = (await db.execute(select(func.count(Lot.id)).where(and_(*filters)))).scalar() or 0
    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(and_(*filters))
        .order_by(desc(Lot.auction_date))  # Most recently ended first
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    lots = (await db.execute(stmt)).scalars().all()
    return LotListResponse(
        items=lots, total=total, page=page, page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/sources")
async def get_source_stats(
    db: AsyncSession = Depends(get_db),
):
    """
    Per-source stats for the World Auctions source health monitor.
    Returns lot count, last_added datetime, and freshness status per source.
    Status thresholds: fresh < 30 min, stale < 120 min, offline >= 120 min.
    """
    FRESH_MIN = 30
    STALE_MIN = 120

    now = datetime.utcnow()
    stmt = (
        select(
            Lot.source,
            func.count(Lot.id).label("lot_count"),
            func.max(Lot.created_at).label("last_added"),
        )
        .where(
            or_(Lot.auction_date.is_(None), Lot.auction_date >= now)
        )
        .group_by(Lot.source)
        .order_by(desc("lot_count"))
    )
    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for row in rows:
        last = row.last_added
        if last:
            age_min = (now - last).total_seconds() / 60
            if age_min < FRESH_MIN:
                status = "fresh"
            elif age_min < STALE_MIN:
                status = "stale"
            else:
                status = "offline"
        else:
            status = "offline"
            age_min = None
        out.append({
            "source": row.source.value if row.source else "unknown",
            "lot_count": row.lot_count,
            "last_added": last.isoformat() if last else None,
            "age_minutes": round(age_min) if age_min is not None else None,
            "status": status,
        })

    # For OTHER sources, break down by auction_house_name
    other_breakdown_stmt = (
        select(
            Lot.auction_house_name,
            func.count(Lot.id).label("lot_count"),
            func.max(Lot.created_at).label("last_added"),
        )
        .where(
            and_(
                Lot.source == AuctionHouse.OTHER,
                Lot.auction_house_name.isnot(None),
                or_(Lot.auction_date.is_(None), Lot.auction_date >= now)
            )
        )
        .group_by(Lot.auction_house_name)
        .order_by(desc("lot_count"))
    )
    other_result = await db.execute(other_breakdown_stmt)
    other_rows = other_result.all()

    for row in other_rows:
        if not row.auction_house_name:
            continue
        last = row.last_added
        age_min = (now - last).total_seconds() / 60 if last else None
        if age_min is None:
            status = "offline"
        elif age_min < FRESH_MIN:
            status = "fresh"
        elif age_min < STALE_MIN:
            status = "stale"
        else:
            status = "offline"
        out.append({
            "source": row.auction_house_name.lower().replace(" ", "_"),
            "lot_count": row.lot_count,
            "last_added": last.isoformat() if last else None,
            "age_minutes": round(age_min) if age_min else None,
            "status": status,
        })

    return out


@router.get("/coverage")
async def get_market_coverage(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Global market coverage metrics for the dashboard status bar.
    Returns coverage score, total lots, fresh sources count, avg confidence.
    """
    now = datetime.utcnow()
    FRESH_MIN = 30

    # Active sources
    sources_stmt = (
        select(
            Lot.source,
            func.count(Lot.id).label("lot_count"),
            func.max(Lot.created_at).label("last_added"),
            func.avg(Lot.confidence_score).label("avg_confidence"),
        )
        .where(or_(Lot.auction_date.is_(None), Lot.auction_date >= now))
        .group_by(Lot.source)
    )
    sources_result = await db.execute(sources_stmt)
    sources = sources_result.all()

    total_sources = 10  # known total sources
    fresh_sources = 0
    total_lots = 0
    confidence_sum = 0.0
    confidence_count = 0

    for row in sources:
        total_lots += row.lot_count
        if row.last_added:
            age_min = (now - row.last_added).total_seconds() / 60
            if age_min < FRESH_MIN:
                fresh_sources += 1
        if row.avg_confidence:
            confidence_sum += float(row.avg_confidence)
            confidence_count += 1

    coverage_pct = round((fresh_sources / total_sources) * 100)
    avg_confidence = round(confidence_sum / confidence_count) if confidence_count > 0 else 0

    # Count lots with rationale
    rationale_count = (await db.execute(
        select(func.count(Lot.id)).where(
            and_(
                Lot.score_rationale.isnot(None),
                or_(Lot.auction_date.is_(None), Lot.auction_date >= now),
            )
        )
    )).scalar() or 0

    return {
        "coverage_pct": coverage_pct,
        "fresh_sources": fresh_sources,
        "total_sources": total_sources,
        "total_lots": total_lots,
        "avg_confidence": avg_confidence,
        "lots_with_rationale": rationale_count,
        "status": "live",
        "updated_at": now.isoformat(),
    }


@router.get("/primary", response_model=LotListResponse)
async def get_primary_lots(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_by: str = Query("deal_score", pattern="^(deal_score|created_at|current_price)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Primary market feed — galleries, emerging artists, direct sales."""
    plan = await get_user_plan(current_user, db)
    max_per_page = _PLAN_PAGE_LIMIT.get(plan, 3)
    page_size = min(page_size, max_per_page)

    filters = [
        or_(
            Lot.market_type == MarketType.PRIMARY,
            Lot.market_type == MarketType.GALLERY,
            Lot.auction_house_name.in_(["Artsper", "Saatchi Art", "Singulart"]),
        ),
        # Minimum €50 EUR — exclut les lots trivialement cheap
        or_(
            and_(Lot.current_price.is_(None), Lot.estimate_low.is_(None)),
            case(
                (Lot.currency == 'SEK', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.087),
                (Lot.currency == 'USD', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.92),
                (Lot.currency == 'GBP', func.coalesce(Lot.current_price, Lot.estimate_low) * 1.17),
                (Lot.currency == 'DKK', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.134),
                (Lot.currency == 'NOK', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.087),
                (Lot.currency == 'CHF', func.coalesce(Lot.current_price, Lot.estimate_low) * 1.05),
                else_=func.coalesce(Lot.current_price, Lot.estimate_low),
            ) >= 50,
        ),
    ]
    if min_price is not None:
        pmin_conds = []
        for curr, rate in _FX_TO_EUR.items():
            if rate > 0:
                pmin_conds.append(and_(Lot.currency == curr, Lot.current_price >= min_price / rate))
        pmin_conds.append(and_(Lot.currency.is_(None), Lot.current_price >= min_price))
        filters.append(or_(*pmin_conds))
    if max_price is not None:
        pmax_conds = []
        for curr, rate in _FX_TO_EUR.items():
            if rate > 0:
                pmax_conds.append(and_(Lot.currency == curr, Lot.current_price <= max_price / rate))
        pmax_conds.append(and_(Lot.currency.is_(None), Lot.current_price <= max_price))
        filters.append(or_(*pmax_conds))
    if category:
        filters.append(Lot.category.ilike(f"%{category}%"))
    if search:
        filters.append(or_(
            Lot.title.ilike(f"%{search}%"),
            Lot.artist_name_raw.ilike(f"%{search}%"),
        ))

    sort_col = {
        "deal_score":    Lot.deal_score,
        "created_at":    Lot.created_at,
        "current_price": Lot.current_price,
    }.get(sort_by, Lot.deal_score)
    order = desc(sort_col) if sort_dir == "desc" else sort_col

    total = (await db.execute(
        select(func.count(Lot.id)).where(and_(*filters))
    )).scalar() or 0

    lots = (await db.execute(
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(and_(*filters))
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    return LotListResponse(
        items=lots,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/for-investor", response_model=LotListResponse)
async def get_lots_for_investor(
    budget_min: Optional[float] = Query(None, description="Min budget EUR"),
    budget_max: Optional[float] = Query(None, description="Max budget EUR"),
    horizon: Optional[str] = Query(None, pattern="^(short|medium|long)$", description="short=<2y, medium=2-5y, long=5y+"),
    profile: Optional[str] = Query(None, pattern="^(first_time|collector|investor)$"),
    limit: int = Query(12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Investor-first endpoint. Returns top N lots curated for a specific budget + profile.
    This is the main feed for the new onboarding experience.
    Always returns max `limit` lots (default 12), sorted by relevance score.
    """
    plan = await get_user_plan(current_user, db)
    # Free users get preview of 3
    effective_limit = min(limit, 3) if plan == "free" else limit

    filters = [
        or_(Lot.auction_date.is_(None), Lot.auction_date >= datetime.utcnow()),
        Lot.deal_score >= 45,  # Only Interesting+ lots
        Lot.deal_score.isnot(None),
        # Only show high-confidence lots in investor feed
        or_(
            Lot.confidence_score >= 50,
            Lot.confidence_score.is_(None),
        ),
        # Minimum €50 EUR — exclut les lots trivialement cheap
        or_(
            and_(Lot.current_price.is_(None), Lot.estimate_low.is_(None)),
            case(
                (Lot.currency == 'SEK', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.087),
                (Lot.currency == 'USD', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.92),
                (Lot.currency == 'GBP', func.coalesce(Lot.current_price, Lot.estimate_low) * 1.17),
                (Lot.currency == 'DKK', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.134),
                (Lot.currency == 'NOK', func.coalesce(Lot.current_price, Lot.estimate_low) * 0.087),
                (Lot.currency == 'CHF', func.coalesce(Lot.current_price, Lot.estimate_low) * 1.05),
                else_=func.coalesce(Lot.current_price, Lot.estimate_low),
            ) >= 50,
        ),
    ]

    # Budget filter — currency-aware (budget values are in EUR)
    if budget_min is not None:
        bmin_conds = []
        for curr, rate in _FX_TO_EUR.items():
            if rate > 0:
                t = budget_min / rate
                bmin_conds.append(and_(Lot.currency == curr, or_(Lot.current_price >= t, Lot.estimate_low >= t)))
        bmin_conds.append(and_(Lot.currency.is_(None), or_(Lot.current_price >= budget_min, Lot.estimate_low >= budget_min)))
        filters.append(or_(*bmin_conds))
    if budget_max is not None:
        bmax_conds = []
        for curr, rate in _FX_TO_EUR.items():
            if rate > 0:
                t = budget_max / rate
                bmax_conds.append(and_(Lot.currency == curr, or_(Lot.current_price <= t, Lot.estimate_low <= t)))
        bmax_conds.append(and_(Lot.currency.is_(None), or_(Lot.current_price <= budget_max, Lot.estimate_low <= budget_max)))
        filters.append(or_(*bmax_conds))

    # Horizon → liquidity proxy via artist join
    # short = high liquidity artists (liquidity_score >= 70)
    # long = any (including lower liquidity = niche/emerging)
    liquidity_filter = None
    if horizon == "short":
        liquidity_filter = Artist.liquidity_score >= 70
    elif horizon == "medium":
        liquidity_filter = Artist.liquidity_score >= 40

    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .outerjoin(Artist, Lot.artist_id == Artist.id)
        .where(and_(*filters))
    )
    if liquidity_filter is not None:
        stmt = stmt.where(or_(liquidity_filter, Lot.artist_id.is_(None)))

    # Order by deal_score desc — best opportunities first
    stmt = stmt.order_by(desc(Lot.deal_score)).limit(effective_limit * 3)  # fetch 3x, re-rank below

    lots = (await db.execute(stmt)).scalars().all()

    # Re-rank: penalize lots without image, boost lots with high upside
    def relevance(lot: Lot) -> float:
        s = lot.deal_score or 0
        if not lot.image_url:
            s -= 10
        if (lot.pct_below_low_estimate or 0) > 20:
            s += 5
        if lot.artist and lot.artist.liquidity_score and lot.artist.liquidity_score > 70:
            s += 3
        return s

    lots_sorted = sorted(lots, key=relevance, reverse=True)[:effective_limit]

    return LotListResponse(
        items=lots_sorted,
        total=len(lots_sorted),
        page=1,
        page_size=effective_limit,
        pages=1,
    )


@router.delete("/admin/cleanup-non-art")
async def cleanup_non_art_lots(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin only — remove non-art lots from DB."""
    if current_user.email not in ADMIN_EMAILS:
        raise HTTPException(403, "Admin only")

    from sqlalchemy import delete

    total_before = (await db.execute(select(func.count(Lot.id)))).scalar()

    # Delete Adam's lots
    r_adams = await db.execute(
        delete(Lot).where(
            or_(
                Lot.auction_house_name.ilike('%adam%'),
                Lot.auction_house_name.ilike('%adams%'),
            )
        )
    )

    # Delete jewelry/non-art categories
    r_cat = await db.execute(
        delete(Lot).where(
            or_(
                Lot.category.ilike('%ring%'),
                Lot.category.ilike('%jewel%'),
                Lot.category.ilike('%watch%'),
                Lot.category.ilike('%coin%'),
                Lot.category.ilike('%stamp%'),
                Lot.category.ilike('%brooch%'),
                Lot.category.ilike('%necklace%'),
                Lot.category.ilike('%bracelet%'),
                Lot.category.ilike('%pendant%'),
                Lot.category.ilike('%earring%'),
            )
        )
    )

    # Delete lots with jewelry/non-art keywords in title
    jewelry_patterns = [
        '%diamond ring%', '%cocktail ring%', '%pearl ring%',
        '%ruby ring%', '%emerald ring%', '%diamond pendant%',
        '%diamond necklace%', '%diamond brooch%', '%cultured pearl%',
        '%gold ring%', '%silver ring%', '%engagement ring%',
        '%wedding band%', '%signet ring%', '%diamond bracelet%',
        '%pocket watch%', '%wristwatch%', '%gold coin%',
        '%silver coin%', '%postage stamp%', '%medal for%',
        '%médaille%', '%monnaie de%', '%prix sur demande%',
        '%price on request%', '%price upon request%',
    ]
    r_jewelry = await db.execute(
        delete(Lot).where(or_(*[Lot.title.ilike(p) for p in jewelry_patterns]))
    )

    # Delete lots with no price at all
    r_no_price = await db.execute(
        delete(Lot).where(
            and_(
                Lot.current_price.is_(None),
                Lot.estimate_low.is_(None),
            )
        )
    )

    await db.commit()

    total_after = (await db.execute(select(func.count(Lot.id)))).scalar()

    return {
        "deleted_adams": r_adams.rowcount,
        "deleted_jewelry_category": r_cat.rowcount,
        "deleted_jewelry_titles": r_jewelry.rowcount,
        "deleted_no_price": r_no_price.rowcount,
        "total_before": total_before,
        "total_after": total_after,
        "freed": total_before - total_after,
    }


@router.post("/admin/generate-rationales")
async def trigger_rationale_generation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin only — generate GPT rationales for lots missing them."""
    if current_user.email not in ADMIN_EMAILS:
        raise HTTPException(403, "Admin only")

    from app.jobs.tasks import _generate_rationales_async
    generated = await _generate_rationales_async(max_lots=30)
    return {"generated": generated, "status": "done"}


@router.post("/admin/send-weekly-report")
async def trigger_weekly_report(
    x_api_key: str = Header(None, alias="x-api-key"),
):
    """Manual trigger for weekly report — admin only."""
    import asyncio
    from app.config import get_settings
    settings = get_settings()

    if not x_api_key or x_api_key != settings.n8n_api_key:
        raise HTTPException(403, "Unauthorized")

    try:
        from app.jobs.weekly_report import send_weekly_report
        asyncio.create_task(send_weekly_report())
        return {"message": "Weekly report sending started"}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/admin/fetch-historical/{artist_name}")
async def fetch_historical_for_artist(
    artist_name: str,
    x_api_key: str = Header(None, alias="x-api-key"),
    db: AsyncSession = Depends(get_db),
):
    """Trigger historical auction results fetch for an artist."""
    from app.config import get_settings as gs
    s = gs()
    if x_api_key != s.n8n_api_key:
        raise HTTPException(403, "Unauthorized")

    try:
        from app.scrapers.artsy_historical_scraper import fetch_artist_auction_results
        from app.scrapers.hammer_price_saver import save_hammer_prices

        prices = await fetch_artist_auction_results(
            artist_name=artist_name,
            artsy_token=s.artsy_api_key,  # None is fine — public API
            max_results=200,
        )

        saved = await save_hammer_prices(prices, db)

        return {
            "artist": artist_name,
            "fetched": len(prices),
            "saved": saved,
            "message": f"Successfully fetched {len(prices)} historical results, saved {saved} new records."
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/admin/ingest-hammer-prices")
async def ingest_hammer_prices(
    request: Request,
    x_api_key: str = Header(None, alias="x-api-key"),
    db: AsyncSession = Depends(get_db),
):
    """Accept a JSON array of pre-scraped hammer price records and save to DB."""
    from app.config import get_settings as gs
    s = gs()
    if x_api_key != s.n8n_api_key:
        raise HTTPException(403, "Unauthorized")

    try:
        from app.scrapers.hammer_price_saver import save_hammer_prices
        body = await request.json()
        if not isinstance(body, list):
            raise HTTPException(400, "Expected a JSON array of records")

        # Parse sale_date strings to datetime objects
        from dateutil import parser as dp
        for rec in body:
            if rec.get("sale_date") and isinstance(rec["sale_date"], str):
                try:
                    rec["sale_date"] = dp.parse(rec["sale_date"])
                except Exception:
                    rec["sale_date"] = None

        saved = await save_hammer_prices(body, db)
        return {"received": len(body), "saved": saved}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/calendar")
async def get_auction_calendar(
    days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upcoming auctions grouped by house and date."""
    cache_key = f"calendar:{days}"
    cached = get_cached(cache_key, ttl=900)
    if cached:
        return cached

    cutoff_start = datetime.utcnow()
    cutoff_end = cutoff_start + timedelta(days=days)

    result = await db.execute(
        select(Lot)
        .where(
            and_(
                Lot.auction_date >= cutoff_start.date(),
                Lot.auction_date <= cutoff_end.date(),
            )
        )
        .order_by(Lot.auction_date, Lot.deal_score.desc().nullslast())
        .limit(500)
    )
    lots = result.scalars().all()

    # Group by house
    from collections import defaultdict
    by_house: dict = defaultdict(list)
    by_date: dict = defaultdict(list)

    for lot in lots:
        house = lot.auction_house_name or "Unknown"
        date_str = lot.auction_date.isoformat() if lot.auction_date else "TBD"
        by_house[house].append(lot)
        by_date[date_str].append(lot)

    def lot_summary(lot) -> dict:
        return {
            "id": str(lot.id),
            "title": lot.title,
            "artist_name_raw": lot.artist_name_raw,
            "deal_score": lot.deal_score,
            "current_price": lot.current_price,
            "estimate_low": lot.estimate_low,
            "estimate_high": lot.estimate_high,
            "image_url": lot.image_url,
            "auction_date": lot.auction_date.isoformat() if lot.auction_date else None,
            "category": lot.category,
            "currency": lot.currency,
        }

    def house_stats(house_lots: list) -> dict:
        scores = [l.deal_score for l in house_lots if l.deal_score]
        dates = sorted({l.auction_date for l in house_lots if l.auction_date})
        return {
            "lot_count": len(house_lots),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "max_score": round(max(scores), 1) if scores else 0,
            "dates": [d.isoformat() for d in dates],
            "top_lots": [lot_summary(l) for l in sorted(house_lots, key=lambda x: x.deal_score or 0, reverse=True)[:4]],
        }

    now = datetime.utcnow()
    urgent_threshold = now + timedelta(days=3)

    houses_out = [
        {"house": house, **house_stats(house_lots)}
        for house, house_lots in sorted(by_house.items(), key=lambda kv: len(kv[1]), reverse=True)
    ]

    dates_out = []
    for date_str, date_lots in sorted(by_date.items()):
        try:
            auction_dt = datetime.fromisoformat(date_str)
            urgent = auction_dt <= urgent_threshold
        except Exception:
            urgent = False
        scores = [l.deal_score for l in date_lots if l.deal_score]
        houses_on_date = list({l.auction_house_name for l in date_lots if l.auction_house_name})
        dates_out.append({
            "date": date_str,
            "urgent": urgent,
            "lot_count": len(date_lots),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "houses": houses_on_date,
            "top_lots": [lot_summary(l) for l in sorted(date_lots, key=lambda x: x.deal_score or 0, reverse=True)[:4]],
        })

    response = {
        "total_lots": len(lots),
        "days": days,
        "by_house": houses_out,
        "by_date": dates_out,
    }
    set_cached(cache_key, response)
    return response


# ── Public endpoint (no auth) — MUST be before /{lot_id} to avoid route shadowing ──────────────

@router.get("/public")
async def get_public_lots(
    limit: int = Query(default=8, le=12),
    sort: str = "deal_score",
    db: AsyncSession = Depends(get_db),
):
    """Returns top lots for landing page preview — public, max 12."""
    from sqlalchemy import desc

    order_col = Lot.deal_score if sort == "deal_score" else Lot.created_at

    result = await db.execute(
        select(Lot)
        .where(
            and_(
                Lot.deal_score >= 75,
                Lot.image_url.isnot(None),
                Lot.hammer_price.is_(None),
                Lot.auction_date >= datetime.utcnow(),
            )
        )
        .order_by(desc(order_col))
        .limit(limit)
    )
    lots = result.scalars().all()
    return {"lots": [lot_to_list_dict(lot) for lot in lots]}


@router.get("/closing-today")
async def get_closing_today(
    days: int = 1,
    limit: int = 50,
    min_score: float = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lots closing within N days, ordered by auction_date asc."""
    from sqlalchemy import asc

    cutoff = datetime.utcnow() + timedelta(days=days)
    filters = [
        Lot.auction_date <= cutoff,
        Lot.auction_date >= datetime.utcnow(),
        Lot.hammer_price.is_(None),
    ]
    if min_score > 0:
        filters.append(Lot.deal_score >= min_score)

    result = await db.execute(
        select(Lot)
        .where(and_(*filters))
        .order_by(asc(Lot.auction_date))
        .limit(limit)
    )
    lots = result.scalars().all()
    return {
        "total": len(lots),
        "items": [lot_to_list_dict(lot) for lot in lots],
    }


@router.get("/{lot_id}")
async def get_lot(
    lot_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(Lot.id == lot_id)
    )
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    lot_plan = await get_user_plan(current_user, db)

    # Serialize via schema then inject parsed dimension fields
    lot_dict = LotOut.model_validate(lot).model_dump(mode="json")
    dims = parse_dimensions(lot.dimensions or "")
    lot_dict["width_cm"] = dims["width_cm"]
    lot_dict["height_cm"] = dims["height_cm"]
    lot_dict["dimensions_parsed"] = dims
    hammer, price_basis = _resolve_ref_price(lot)
    if hammer:
        rc = compute_real_cost(hammer, lot.auction_house_name)
        rc["ref_price"] = round(hammer)
        rc["price_basis"] = price_basis
        lot_dict["real_cost"] = rc
    else:
        lot_dict["real_cost"] = None
    lot_dict["estimation_bias"] = await get_estimation_bias(lot.auction_house_name, db)
    lot_dict["cycle_stage"] = await get_cycle_stage(lot.artist_name_raw, db)
    lot_dict["consignment_alert"] = await get_consignment_alert(lot.artist_name_raw, str(lot.id), db)
    lot_dict["provenance_risk"] = await get_provenance_risk(lot, db)

    # ── Oracle signal (ArtistSignal) ──────────────────────────────────────────
    lot_dict["oracle"] = None
    if lot.artist_id:
        sig_result = await db.execute(
            select(ArtistSignal)
            .where(ArtistSignal.artist_id == lot.artist_id)
            .order_by(ArtistSignal.computed_at.desc())
            .limit(1)
        )
        sig = sig_result.scalar_one_or_none()
        if sig and sig.oracle_signal:
            lot_dict["oracle"] = {
                "signal":         sig.oracle_signal,       # BUY_NOW / WATCH / HOLD / AVOID
                "score_6m":       sig.oracle_score_6m,
                "score_18m":      sig.oracle_score_18m,
                "target_upside":  sig.oracle_target_upside,
                "narrative":      sig.oracle_narrative,
                "active_signals": sig.active_signals or [],
                "confidence":     sig.confidence,
                "computed_at":    sig.computed_at.isoformat() if sig.computed_at else None,
            }

    # ── Artist profile (investment tier, institutional presence) ──────────────
    lot_dict["artist_profile"] = None
    if lot.artist_name_raw:
        artist_name_clean = lot.artist_name_raw.strip()
        prof_result = await db.execute(
            select(ArtistProfile)
            .where(func.lower(ArtistProfile.name) == artist_name_clean.lower())
            .limit(1)
        )
        profile = prof_result.scalar_one_or_none()
        if not profile:
            prof_result = await db.execute(
                select(ArtistProfile)
                .where(ArtistProfile.name.ilike(f"%{artist_name_clean}%"))
                .limit(1)
            )
            profile = prof_result.scalar_one_or_none()
        if profile:
            lot_dict["artist_profile"] = {
                "investment_tier":          profile.investment_tier,        # blue_chip / mid_career / emerging
                "institutional_score":      profile.institutional_score,    # 0-100
                "gallery_tier_avg":         profile.gallery_tier_avg,
                "gallery_count":            profile.gallery_count,
                "top_gallery_name":         profile.top_gallery_name,
                "public_collections_count": profile.public_collections_count,
                "shows_last_12m":           profile.shows_last_12m,
                "shows_prev_12m":           profile.shows_prev_12m,
                "momentum_score":           profile.momentum_score,
                "is_pre_auction":           profile.is_pre_auction,
                "artsy_url":                profile.artsy_url,
            }

    # ── Bundled projection (3 / 5 / 10 years) — no separate API call needed ──
    lot_dict["projection"] = None
    if hammer:
        from app.engines.projections import project_value
        from app.scripts.medium_taxonomy import canonicalize_medium, MEDIUM_DISPLAY  # noqa: F401

        # ── Sprint 2.5 + 2.6 fallback cascade ────────────────────────────────
        # 1. medium-specific CAGR (if lot.medium maps to a canonical group)
        # 2. aggregate CAGR (Sprint 2, per-artist)
        # 3. engine tier-based fallback (inside project_value when override=None)
        cagr_override      = None
        cagr_raw_used      = None
        cagr_source_used   = None
        cagr_medium_used   = None
        cagr_n_sales_used  = None
        cagr_confidence_used = None
        signal_used        = None
        alternatives_used  = []
        cagr_aggregate     = lot.artist.cagr_calculated if lot.artist else None

        if lot.artist:
            canonical = canonicalize_medium(lot.medium) if lot.medium else None
            by_medium = lot.artist.cagr_by_medium or {}
            if canonical and canonical in by_medium:
                m = by_medium[canonical]
                cagr_override      = m.get('cagr')
                cagr_raw_used      = m.get('cagr_raw')
                cagr_source_used   = 'medium_specific'
                cagr_medium_used   = canonical
                cagr_n_sales_used  = m.get('n_sales')
                cagr_confidence_used = m.get('confidence')
                signal_used        = m.get('signal')
                # Reshape alternatives for API output
                for alt in (m.get('alternatives') or []):
                    alternatives_used.append({
                        'medium':         alt['medium'],
                        'medium_display': MEDIUM_DISPLAY.get(alt['medium'], alt['medium'].replace('_', ' ').title()),
                        'cagr_pct':       round(alt['cagr'] * 100, 2),
                        'cagr_raw_pct':   round(alt['cagr_raw'] * 100, 2),
                        'n_sales':        alt['n_sales'],
                        'delta_pct':      round(alt['delta'] * 100, 2),
                        'signal':         alt['signal'],
                        'rationale':      alt['rationale'],
                    })
            elif lot.artist.cagr_calculated is not None:
                cagr_override      = lot.artist.cagr_calculated
                cagr_source_used   = lot.artist.cagr_source
                cagr_n_sales_used  = lot.artist.cagr_n_sales
                cagr_confidence_used = lot.artist.cagr_confidence
                # Derive signal from aggregate cagr_raw (raw ≈ capped when no floor hit)
                from app.scripts.compute_cagr_by_medium import classify_signal
                signal_used = classify_signal(lot.artist.cagr_raw or lot.artist.cagr_calculated or 0)

        proj = project_value(
            purchase_price_eur=float(hammer),
            artist_name=lot.artist_name_raw,
            liquidity_score=lot.artist.liquidity_score if lot.artist else 50.0,
            popularity_score=lot.artist.popularity_score if lot.artist else 50.0,
            trend=lot.artist.trend.value if lot.artist and lot.artist.trend else "stable",
            years=[3, 5, 10],
            cagr_override=cagr_override,
        )
        lot_dict["projection"] = {
            "artist_tier":            proj["artist_tier"],
            "cagr_pct":               proj["base_cagr_pct"],
            "cagr_raw_pct":           round(cagr_raw_used * 100, 2) if cagr_raw_used is not None else proj["base_cagr_pct"],
            "cagr_aggregate_pct":     round(cagr_aggregate * 100, 2) if cagr_aggregate is not None else None,
            "cagr_source":            cagr_source_used,
            "cagr_medium_used":       cagr_medium_used,
            "cagr_confidence":        cagr_confidence_used,
            "cagr_n_sales":           cagr_n_sales_used,
            "signal":                 signal_used,
            "alternatives":           alternatives_used,
            "recommended_hold_years": proj["recommended_hold_years"],
            "sell_recommendation":    proj["sell_recommendation"],
            "years":                  proj["projections"],
        }

    # ── Nautilus fair value (median of comparable sold lots, last 24 months) ──
    lot_dict["fair_value_nautilus"] = None
    lot_dict["fair_value_confidence"] = None
    if lot.artist_name_raw:
        cutoff = datetime.utcnow() - timedelta(days=730)
        comp_result = await db.execute(
            select(Lot.hammer_price)
            .where(
                and_(
                    func.lower(Lot.artist_name_raw) == lot.artist_name_raw.lower(),
                    Lot.hammer_price.isnot(None),
                    Lot.auction_date >= cutoff,
                    Lot.id != lot.id,
                )
            )
        )
        prices = [row[0] for row in comp_result.fetchall() if row[0] and row[0] > 0]
        if len(prices) >= 5:
            lot_dict["fair_value_nautilus"] = statistics.median(prices)
            lot_dict["fair_value_confidence"] = len(prices)

    # ── Artist price history statistics ──────────────────────────────────────
    try:
        now = datetime.utcnow()
        cutoff_24m = now - timedelta(days=730)
        cutoff_48m = now - timedelta(days=1460)
        if lot.artist_name_raw:
            prices_result = await db.execute(
                select(Lot.hammer_price, Lot.estimate_high, Lot.auction_date).where(
                    and_(
                        func.lower(Lot.artist_name_raw) == lot.artist_name_raw.lower(),
                        Lot.hammer_price.isnot(None),
                        Lot.hammer_price > 0,
                        Lot.auction_date >= cutoff_48m,
                        Lot.id != lot.id,
                    )
                )
            )
            price_rows = prices_result.fetchall()
            recent = [r[0] for r in price_rows if r[2] and r[2] >= cutoff_24m]
            prior = [r[0] for r in price_rows if r[2] and r[2] < cutoff_24m]
            trend_pct = None
            if len(recent) >= 3 and len(prior) >= 3:
                med_recent = statistics.median(recent)
                med_prior = statistics.median(prior)
                if med_prior > 0:
                    trend_pct = round((med_recent - med_prior) / med_prior * 100, 1)
            with_estimate = [r for r in price_rows if r[1] and r[1] > 0 and r[2] and r[2] >= cutoff_24m]
            sell_above_pct = None
            if len(with_estimate) >= 3:
                above = sum(1 for r in with_estimate if r[0] > r[1])
                sell_above_pct = round(above / len(with_estimate) * 100, 1)
            lot_dict["price_history"] = {
                "statistics": {
                    "trend_pct": trend_pct,
                    "sell_above_estimate_pct": sell_above_pct,
                }
            } if (trend_pct is not None or sell_above_pct is not None) else None
        else:
            lot_dict["price_history"] = None
    except Exception:
        lot_dict["price_history"] = None

    if lot_plan == "free":
        lot_dict["url"] = None
        lot_dict["oracle"] = None
        lot_dict["projection"] = None
        lot_dict["fair_value_nautilus"] = None
        lot_dict["fair_value_confidence"] = None
        lot_dict["price_history"] = None

    try:
        db.add(UserEvent(
            user_id=current_user.id if current_user else None,
            lot_id=lot.id,
            event_type="lot_view",
        ))
        await db.commit()
    except Exception:
        pass

    return lot_dict


# ── Weighted max-bid helpers ──────────────────────────────────────────────────

_MEDIUM_CATEGORIES: dict[str, list[str]] = {
    "painting":   ["huile", "oil", "acrylic", "acrylique", "tempera", "gouache", "enamel"],
    "print":      ["lithograph", "litho", "offset", "sérigraph", "serigraph", "screenprint",
                   "etching", "gravure", "estampe", "woodcut", "linogravure"],
    "photo":      ["photo", "photograph", "chromogenic", "c-print", "inkjet", "silver gelatin"],
    "drawing":    ["drawing", "dessin", "crayon", "pencil", "ink", "encre", "pastel", "charcoal"],
    "sculpture":  ["sculpture", "bronze", "ceramic", "céramique", "marble", "marbre",
                   "resin", "résine", "plaster"],
    "watercolor": ["aquarelle", "watercolor", "watercolour"],
}

_MEDIUM_DISCOUNT: dict[str, float] = {
    "print": 0.20, "photo": 0.20, "drawing": 0.40,
    "sculpture": 0.30, "watercolor": 0.60, "painting": 1.00,
}

_HOUSE_TIERS: dict[int, list[str]] = {
    1: ["christies", "sotheby", "phillips", "bonhams"],
    2: ["artcurial", "aguttes", "millon", "drouot"],
}


def _medium_category(medium_str: str | None) -> str | None:
    if not medium_str:
        return None
    m = medium_str.lower()
    for cat, keywords in _MEDIUM_CATEGORIES.items():
        if any(kw in m for kw in keywords):
            return cat
    return None


def _house_tier_num(house: str | None) -> int:
    if not house:
        return 3
    h = house.lower()
    for tier, names in _HOUSE_TIERS.items():
        if any(n in h for n in names):
            return tier
    return 3


def _comp_proximity_score(
    row: dict,
    lot_medium_cat: str | None,
    lot_area: float | None,
    lot_house_tier: int,
    now_dt,
) -> int:
    from datetime import timezone as _tz
    score = 0
    hp_medium_cat = _medium_category(row.get("medium"))

    # Medium match: +60 (combines +40 medium + +20 category from spec)
    if lot_medium_cat and hp_medium_cat:
        if lot_medium_cat == hp_medium_cat:
            score += 60
        else:
            # Different edition mediums still closer than painting vs print
            two_d = {"print", "drawing", "photo", "watercolor"}
            if lot_medium_cat in two_d and hp_medium_cat in two_d:
                score += 10

    # Size ±30% by area: +15
    if lot_area and lot_area > 0:
        dims = parse_dimensions(row.get("dimensions") or "")
        w, h = dims["width_cm"], dims["height_cm"]
        if w and h:
            hp_area = w * h
            if abs(hp_area - lot_area) / lot_area <= 0.30:
                score += 15

    # Recency: +10 if <2yr, +5 if <5yr
    sale_date = row.get("sale_date")
    if sale_date:
        sale_dt = sale_date if sale_date.tzinfo else sale_date.replace(tzinfo=_tz.utc)
        age_days = (now_dt - sale_dt).days
        if age_days <= 730:
            score += 10
        elif age_days <= 1825:
            score += 5

    # Same auction-house tier: +5
    if lot_house_tier == _house_tier_num(row.get("auction_house")):
        score += 5

    return score


async def _compute_weighted_max_bid(lot, db) -> dict:
    """
    Proximity-weighted market value for max-bid computation.
    Returns dict {market_value, comp_count, comp_level, max_bid_source}
    or {} when no data (caller falls back to estimate_high × 0.85).

    Levels:
        1 — ≥3 comps score ≥60 (medium+size match)
        2 — ≥3 comps score ≥30 (partial match)
        3 — ≥5 artist sales × medium discount (litho ×0.20, drawing ×0.40 …)
    """
    from sqlalchemy import text
    from datetime import timezone as _tz
    from app.jobs.quality_filter import normalize_artist_name as _norm_artist

    if not lot.artist_name_raw:
        return {}

    artist_normalized = _norm_artist(lot.artist_name_raw)
    if not artist_normalized:
        return {}

    result = await db.execute(
        text("""
            SELECT medium, dimensions, year_created, sale_date,
                   hammer_price_eur, hammer_price, auction_house
            FROM hammer_prices
            WHERE artist_name_normalized = :norm
              AND (hammer_price_eur IS NOT NULL OR hammer_price IS NOT NULL)
            ORDER BY sale_date DESC NULLS LAST
            LIMIT 200
        """),
        {"norm": artist_normalized},
    )
    rows = result.mappings().all()
    if not rows:
        return {}

    now_dt = datetime.now(_tz.utc)
    lot_dims = parse_dimensions(lot.dimensions or "")
    lot_w, lot_h = lot_dims["width_cm"], lot_dims["height_cm"]
    lot_area = (lot_w * lot_h) if (lot_w and lot_h) else None
    lot_medium_cat = _medium_category(lot.medium) or _medium_category(lot.title or "")
    lot_house_tier = _house_tier_num(lot.auction_house_name)

    scored: list[tuple[int, float]] = []
    for row in rows:
        price = row["hammer_price_eur"] or row["hammer_price"]
        if not price or price <= 0:
            continue
        s = _comp_proximity_score(row, lot_medium_cat, lot_area, lot_house_tier, now_dt)
        scored.append((s, float(price)))

    if not scored:
        return {}

    def _wavg(pairs: list[tuple[int, float]]) -> float:
        total_w = sum(s for s, _ in pairs)
        if total_w == 0:
            return sum(p for _, p in pairs) / len(pairs)
        return sum(s * p for s, p in pairs) / total_w

    l1 = [(s, p) for s, p in scored if s >= 60]
    if len(l1) >= 3:
        return {"market_value": _wavg(l1), "comp_count": len(l1),
                "comp_level": 1, "max_bid_source": "comparables_proches"}

    l2 = [(s, p) for s, p in scored if s >= 30]
    if len(l2) >= 3:
        return {"market_value": _wavg(l2), "comp_count": len(l2),
                "comp_level": 2, "max_bid_source": "comparables_partiels"}

    if len(scored) >= 5:
        discount = _MEDIUM_DISCOUNT.get(lot_medium_cat or "", 1.0)
        return {"market_value": _wavg(scored) * discount, "comp_count": len(scored),
                "comp_level": 3, "max_bid_source": "ventes_artiste"}

    return {}


@router.get("/{lot_id}/comparables")
async def get_comparables(
    lot_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Find comparable lots.
    Priority: hammer_prices (historical realized sales) → active lot listings.
    Historical data gives the real market signal; active listings are a fallback.
    """
    cache_key = f"comparables:{lot_id}"
    cached = get_cached(cache_key, ttl=3600)
    if cached:
        return cached

    lot_result = await db.execute(select(Lot).where(Lot.id == lot_id))
    lot = lot_result.scalar_one_or_none()
    if not lot:
        raise HTTPException(404, "Lot not found")

    ref_price = lot.current_price or lot.estimate_low or 0
    hammer_comps: list = []
    live_comps: list = []

    # ── Strategy 1: Historical hammer prices — same artist ────────────────────
    if lot.artist_name_raw:
        hp_result = await db.execute(
            select(HammerPrice)
            .where(
                and_(
                    HammerPrice.artist_name.ilike(f"%{lot.artist_name_raw}%"),
                    HammerPrice.hammer_price.isnot(None),
                )
            )
            # Prefer records with images (Christie's Lotfinder has 6k+ no-image records)
            .order_by(
                HammerPrice.image_url.isnot(None).desc(),
                HammerPrice.sale_date.desc().nullslast(),
            )
            .limit(8)
        )
        hammer_comps = hp_result.scalars().all()

    # ── Strategy 2: Historical hammer prices — same medium + price range ──────
    if len(hammer_comps) < 3 and ref_price > 0:
        price_min = ref_price * 0.3
        price_max = ref_price * 3.0
        medium_filter = lot.medium or lot.category or ""
        if medium_filter:
            hp_result2 = await db.execute(
                select(HammerPrice)
                .where(
                    and_(
                        HammerPrice.medium.ilike(f"%{medium_filter}%"),
                        HammerPrice.id.notin_([h.id for h in hammer_comps]),
                        HammerPrice.hammer_price.isnot(None),
                        or_(
                            and_(HammerPrice.hammer_price_eur >= price_min, HammerPrice.hammer_price_eur <= price_max),
                            and_(HammerPrice.hammer_price >= price_min, HammerPrice.hammer_price <= price_max),
                        ),
                    )
                )
                .order_by(HammerPrice.sale_date.desc().nullslast())
                .limit(8 - len(hammer_comps))
            )
            hammer_comps.extend(hp_result2.scalars().all())

    # ── Strategy 3: Active lot listings (fallback when no historical data) ────
    if len(hammer_comps) < 3:
        if lot.artist_name_raw:
            same_artist = await db.execute(
                select(Lot)
                .where(
                    and_(
                        Lot.artist_name_raw.ilike(f"%{lot.artist_name_raw}%"),
                        Lot.id != lot.id,
                        Lot.estimate_low.isnot(None),
                        or_(Lot.auction_date.is_(None), Lot.auction_date >= datetime.utcnow()),
                    )
                )
                .order_by(Lot.deal_score.desc().nullslast())
                .limit(6)
            )
            live_comps.extend(same_artist.scalars().all())

        if len(live_comps) < 3 and lot.category and ref_price > 0:
            price_min = ref_price * 0.4
            price_max = ref_price * 2.5
            similar = await db.execute(
                select(Lot)
                .where(
                    and_(
                        Lot.category.ilike(f"%{lot.category}%"),
                        Lot.id != lot.id,
                        Lot.id.notin_([c.id for c in live_comps]),
                        or_(
                            and_(Lot.current_price >= price_min, Lot.current_price <= price_max),
                            and_(Lot.estimate_low >= price_min, Lot.estimate_low <= price_max),
                        ),
                        Lot.deal_score.isnot(None),
                        or_(Lot.auction_date.is_(None), Lot.auction_date >= datetime.utcnow()),
                    )
                )
                .order_by(Lot.deal_score.desc())
                .limit(6 - len(live_comps))
            )
            live_comps.extend(similar.scalars().all())

    # ── Serialize ─────────────────────────────────────────────────────────────
    def _hammer_to_dict(hp: HammerPrice) -> dict:
        from datetime import timezone
        price_eur = hp.hammer_price_eur or hp.hammer_price
        days_since: int | None = None
        if hp.sale_date:
            sale_dt = hp.sale_date if hp.sale_date.tzinfo else hp.sale_date.replace(tzinfo=timezone.utc)
            days_since = max(0, (datetime.now(timezone.utc) - sale_dt).days)
        return {
            "id":                     str(hp.id),
            "title":                  hp.artwork_title or "Untitled",
            "artist_name_raw":        hp.artist_name,
            "current_price":          price_eur,
            "hammer_price":           price_eur,
            "estimate_low":           hp.estimate_low,
            "estimate_high":          hp.estimate_high,
            "premium_ratio":          hp.premium_ratio,
            "deal_score":             None,
            "pct_below_low_estimate": None,
            "image_url":              hp.image_url,
            "auction_house_name":     hp.auction_house,
            "auction_date":           hp.sale_date.isoformat() if hp.sale_date else None,
            "days_since_sale":        days_since,
            "source":                 hp.source,
            "currency":               "EUR" if hp.hammer_price_eur else (hp.currency or "EUR"),
            "medium":                 hp.medium,
            "real_cost":              None,
            "is_historical":          True,   # realized sale — not a listing
        }

    use_hammer = bool(hammer_comps)
    serialized = (
        [_hammer_to_dict(h) for h in hammer_comps[:6]]
        if use_hammer
        else [lot_to_list_dict(c) for c in live_comps[:6]]
    )

    # ── Plan gating: free → 1 comparable (most recent), total count preserved ──
    plan = await get_user_plan(current_user, db)
    comparable_count_total = len(serialized)
    if plan == "free" and serialized:
        serialized = sorted(
            serialized,
            key=lambda c: c.get("auction_date") or "",
            reverse=True,
        )[:1]

    # ── Market analysis ───────────────────────────────────────────────────────
    comp_prices = [
        c.get("current_price") or c.get("estimate_low")
        for c in serialized
        if c.get("current_price") or c.get("estimate_low")
    ]
    market_avg = sum(comp_prices) / len(comp_prices) if comp_prices else 0
    sorted_prices = sorted(comp_prices)
    median_price = sorted_prices[len(sorted_prices) // 2] if sorted_prices else None
    price_gap_pct = ((market_avg - ref_price) / ref_price * 100) if ref_price and market_avg else 0

    # ── Market benchmarks — SQL PERCENTILE_CONT, fire-and-forget ─────────────
    market_benchmarks: dict | None = None
    if lot.artist_name_raw:
        try:
            bm = await compute_market_benchmarks(lot.artist_name_raw, db)
            if bm:
                estimate_mid = None
                if lot.estimate_low and lot.estimate_high:
                    estimate_mid = (lot.estimate_low + lot.estimate_high) / 2
                elif lot.estimate_low:
                    estimate_mid = lot.estimate_low
                gap = (
                    (bm["p50"] - estimate_mid) / estimate_mid * 100
                ) if (estimate_mid and bm.get("p50")) else None
                if bm["based_on"] >= 10 and gap is not None:
                    bm["verdict"] = (
                        "Marché historique nettement supérieur à l'estimation" if gap > 30
                        else "Marché historique supérieur à l'estimation"      if gap > 10
                        else "Marché historique proche de l'estimation"        if gap > -10
                        else "Marché historique inférieur à l'estimation"      if gap > -30
                        else "Marché historique nettement inférieur à l'estimation"
                    )
                    bm["verdict_color"] = (
                        "#1A6B3C" if gap > 30
                        else "#52C97F" if gap > 10
                        else "#6B7280" if gap > -10
                        else "#C6A85A" if gap > -30
                        else "#EF4444"
                    )
                    bm["price_gap_pct"] = round(gap, 1)
                market_benchmarks = bm
        except Exception:
            pass

    # ── Max bid — proximity-weighted comparable analysis ──────────────────────
    max_bid: int | None = None
    max_bid_source: str | None = None
    max_bid_comp_count: int | None = None
    max_bid_comp_level: int | None = None
    weighted = await _compute_weighted_max_bid(lot, db)
    if weighted:
        max_bid = compute_max_bid(weighted["market_value"], lot.auction_house_name)
        max_bid_source = weighted["max_bid_source"]
        max_bid_comp_count = weighted["comp_count"]
        max_bid_comp_level = weighted["comp_level"]
    elif lot.estimate_high:
        max_bid = compute_max_bid(float(lot.estimate_high) * 0.85, lot.auction_house_name)
        max_bid_source = "estimate"

    response = {
        "lot_id": lot_id,
        "reference": {
            "title":  lot.title,
            "artist": lot.artist_name_raw,
            "price":  ref_price,
            "score":  lot.deal_score,
        },
        "comparables":  serialized,
        "data_source":  "historical_sales" if use_hammer else "active_listings",
        "market_benchmarks": market_benchmarks,
        "max_bid": max_bid,
        "max_bid_source": max_bid_source,
        "max_bid_comp_count": max_bid_comp_count,
        "max_bid_comp_level": max_bid_comp_level,
        "market_analysis": {
            "comparable_count":    comparable_count_total,
            "market_avg_price":    round(market_avg) if market_avg else None,
            "market_median_price": round(median_price) if median_price else None,
            "price_gap_pct":       round(price_gap_pct, 1),
            "verdict": (
                "Significantly underpriced" if price_gap_pct > 30
                else "Underpriced"          if price_gap_pct > 10
                else "Fairly priced"        if price_gap_pct > -10
                else "Above market"
            ),
            "verdict_color": (
                "#C6A85A" if price_gap_pct > 30
                else "#2563EB" if price_gap_pct > 10
                else "#64748B" if price_gap_pct > -10
                else "#EF4444"
            ),
            "data_quality": "historical_sales" if use_hammer else "active_listings",
        },
    }

    set_cached(cache_key, response)
    return response


@router.get("/{lot_id}/similar", response_model=List[LotOut])
async def get_similar(
    lot_id: str,
    limit: int = Query(6, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Similar lots by category and price range."""
    lot = (await db.execute(
        select(Lot).where(Lot.id == lot_id)
    )).scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    filters = [
        Lot.id != lot_id,
        Lot.is_deal == True,
        or_(Lot.auction_date.is_(None), Lot.auction_date >= datetime.utcnow()),
    ]
    if lot.category:
        filters.append(Lot.category.ilike(f"%{lot.category}%"))
    if lot.current_price:
        low = lot.current_price * 0.3
        high = lot.current_price * 3.0
        filters.append(Lot.current_price.between(low, high))

    stmt = (
        select(Lot)
        .options(selectinload(Lot.artist))
        .where(and_(*filters))
        .order_by(desc(Lot.deal_score).nullslast())
        .limit(limit)
    )
    results = (await db.execute(stmt)).scalars().all()

    # Fallback: if not enough results, broaden to category only
    if len(results) < 3 and lot.category:
        stmt2 = (
            select(Lot)
            .options(selectinload(Lot.artist))
            .where(and_(
                Lot.id != lot_id,
                Lot.category.ilike(f"%{lot.category}%"),
                or_(Lot.auction_date.is_(None), Lot.auction_date >= datetime.utcnow()),
            ))
            .order_by(desc(Lot.deal_score).nullslast())
            .limit(limit)
        )
        results = (await db.execute(stmt2)).scalars().all()

    return results


@router.get("/{lot_id}/projection")
async def get_lot_projection(
    lot_id: str,
    purchase_price: Optional[float] = Query(None, description="Override price for projection (EUR)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Value projection for a lot over 5/10/20/30/50 years."""
    result = await db.execute(
        select(Lot).options(selectinload(Lot.artist)).where(Lot.id == lot_id)
    )
    lot = result.scalar_one_or_none()
    if not lot:
        raise HTTPException(404, "Lot not found")

    price = purchase_price or lot.current_price or lot.estimate_low or 1000.0

    from app.engines.projections import project_value
    from app.scripts.medium_taxonomy import canonicalize_medium

    # Sprint 2.5 cascade: medium-specific → aggregate → tier
    cagr_override = None
    if lot.artist:
        canonical = canonicalize_medium(lot.medium) if lot.medium else None
        by_medium = lot.artist.cagr_by_medium or {}
        if canonical and canonical in by_medium:
            cagr_override = by_medium[canonical].get('cagr')
        elif lot.artist.cagr_calculated is not None:
            cagr_override = lot.artist.cagr_calculated

    return project_value(
        purchase_price_eur=float(price),
        artist_name=lot.artist_name_raw,
        liquidity_score=lot.artist.liquidity_score if lot.artist else 50.0,
        popularity_score=lot.artist.popularity_score if lot.artist else 50.0,
        trend=lot.artist.trend.value if lot.artist and lot.artist.trend else "stable",
        cagr_override=cagr_override,
    )


# ── Decision Archive ───────────────────────────────────────────────────────────

class ConfirmPurchaseRequest(BaseModel):
    purchase_price: float
    purchase_date: str           # ISO date string e.g. "2024-01-15"
    purchase_source: str = "auction"   # auction | gallery | private
    notes: str | None = None


@router.post("/{lot_id}/confirm-purchase")
async def confirm_purchase(
    lot_id: str,
    body: ConfirmPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a purchase in the Decision Archive AND add to the user's portfolio."""
    from app.models.db_models import PortfolioItem

    lot = (await db.execute(
        select(Lot).options(selectinload(Lot.artist)).where(Lot.id == lot_id)
    )).scalar_one_or_none()
    if not lot:
        raise HTTPException(404, "Lot not found")

    try:
        purchase_date = datetime.fromisoformat(body.purchase_date)
    except ValueError:
        raise HTTPException(422, "Invalid purchase_date — use YYYY-MM-DD")

    # ── 1. Decision Archive entry ─────────────────────────────────────────────
    entry = DecisionArchive(
        lot_id=lot.id,
        user_id=current_user.id,
        signal_score=lot.deal_score,
        purchase_price=body.purchase_price,
        purchase_date=purchase_date,
        purchase_source=body.purchase_source,
        notes=body.notes,
    )
    db.add(entry)

    # ── 2. Portfolio item (idempotent — skip if already tracked) ─────────────
    existing_pi = (await db.execute(
        select(PortfolioItem).where(
            PortfolioItem.user_id == current_user.id,
            PortfolioItem.lot_id == lot.id,
        )
    )).scalar_one_or_none()

    portfolio_item_id: str | None = None
    if not existing_pi:
        pi = PortfolioItem(
            user_id=current_user.id,
            lot_id=lot.id,
            title=lot.title or "Lot sans titre",
            artist_name=lot.artist_name_raw,
            medium=lot.medium,
            dimensions=lot.dimensions,
            image_url=lot.image_url,
            purchase_price_eur=body.purchase_price,
            purchase_date=purchase_date,
            purchase_source=body.purchase_source,
            notes=body.notes,
        )
        db.add(pi)
        await db.flush()   # get id before commit
        portfolio_item_id = str(pi.id)
    else:
        portfolio_item_id = str(existing_pi.id)

    await db.commit()
    await db.refresh(entry)

    return {
        "id": str(entry.id),
        "lot_id": str(entry.lot_id),
        "signal_score": entry.signal_score,
        "purchase_price": entry.purchase_price,
        "purchase_date": entry.purchase_date.isoformat(),
        "purchase_source": entry.purchase_source,
        "portfolio_item_id": portfolio_item_id,
    }
