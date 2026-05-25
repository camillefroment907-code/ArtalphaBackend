import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_, and_, String, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.db_models import Wishlist, Lot, User, LotStatus, MarketType, UserEvent
from app.models.schemas import LotOut
from app.api.auth_utils import get_current_user
from app.config import get_settings
from app.api.billing import _get_user_plan, PLAN_LIMITS

router = APIRouter(prefix="/wishlist", tags=["wishlist"])
_settings = get_settings()


# ── Wishlist Parser ───────────────────────────────────────────────────────────

class WishlistParseRequest(BaseModel):
    text: str    # natural language description from the user


@router.post("/parse")
async def parse_wishlist(
    body: WishlistParseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Parse a natural language wishlist description with GPT-4o-mini,
    extract structured criteria, and return matching lots from the DB.

    Example input: "A Picasso drawing under €50,000 and a Basquiat painting"
    Returns: { criteria: [...], lots: [...] }
    """
    if not _settings.openai_api_key:
        raise HTTPException(status_code=503, detail="AI parsing not configured")

    if len(body.text.strip()) < 3:
        raise HTTPException(status_code=400, detail="Text too short")

    # ── Step 1: GPT-4o-mini extraction ────────────────────────────────────────
    import openai
    client = openai.AsyncOpenAI(api_key=_settings.openai_api_key)

    system_prompt = (
        "You are an art market intelligence assistant. "
        "Extract structured search criteria from the user's wishlist description. "
        "Return a JSON array of criteria objects. Each object has: "
        "artist_name (string or null), category (string or null), "
        "max_price_eur (number or null), min_price_eur (number or null), "
        "period (string or null), keywords (array of strings). "
        "Return ONLY valid JSON, no explanation."
    )
    user_prompt = f"Extract criteria from: {body.text[:1000]}"

    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=400,
            temperature=0,
        )
        raw = resp.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        criteria_list = json.loads(raw)
        if not isinstance(criteria_list, list):
            criteria_list = [criteria_list]
    except Exception:
        criteria_list = []

    # ── Step 2: Query DB for each criterion ───────────────────────────────────
    all_lots: list = []
    seen_ids: set = set()

    for crit in criteria_list[:5]:  # cap at 5 criteria
        filters = [
            Lot.status.cast(String).in_(['upcoming', 'live']),
            Lot.market_type == MarketType.AUCTION,
        ]

        if crit.get("artist_name"):
            filters.append(Lot.artist_name_raw.ilike(f"%{crit['artist_name']}%"))

        if crit.get("category"):
            filters.append(Lot.category.ilike(f"%{crit['category']}%"))

        if crit.get("max_price_eur"):
            filters.append(
                or_(
                    Lot.estimate_low <= crit["max_price_eur"],
                    Lot.current_price <= crit["max_price_eur"],
                )
            )

        if crit.get("min_price_eur"):
            filters.append(
                or_(
                    Lot.estimate_low >= crit["min_price_eur"],
                    Lot.current_price >= crit["min_price_eur"],
                )
            )

        if crit.get("period"):
            filters.append(Lot.period.ilike(f"%{crit['period']}%"))

        result = await db.execute(
            select(Lot)
            .where(and_(*filters))
            .order_by(Lot.deal_score.desc().nullslast())
            .limit(5)
        )
        for lot in result.scalars().all():
            if str(lot.id) not in seen_ids:
                seen_ids.add(str(lot.id))
                all_lots.append({
                    "id":                   str(lot.id),
                    "title":                lot.title,
                    "artist_name_raw":      lot.artist_name_raw,
                    "estimate_low":         lot.estimate_low,
                    "estimate_high":        lot.estimate_high,
                    "current_price":        lot.current_price,
                    "deal_score":           lot.deal_score,
                    "image_url":            lot.image_url,
                    "url":                  lot.url,
                    "auction_date":         lot.auction_date.isoformat() if lot.auction_date else None,
                    "auction_house_name":   lot.auction_house_name,
                    "category":             lot.category,
                    "matched_criterion":    crit.get("artist_name") or crit.get("category") or "keyword",
                })

    return {
        "criteria": criteria_list,
        "lots": all_lots,
        "total": len(all_lots),
    }


@router.get("/ids", response_model=List[str])
async def get_wishlist_ids(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return list of lot IDs in the user's wishlist."""
    stmt = select(Wishlist.lot_id).where(Wishlist.user_id == current_user.id)
    result = await db.execute(stmt)
    return [str(row) for row in result.scalars().all()]


@router.get("", response_model=List[LotOut])
async def get_wishlist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all lots in the user's wishlist."""
    stmt = (
        select(Lot)
        .join(Wishlist, Wishlist.lot_id == Lot.id)
        .options(selectinload(Lot.artist))
        .where(Wishlist.user_id == current_user.id)
        .order_by(Wishlist.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{lot_id}", status_code=201)
async def add_to_wishlist(
    lot_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lot = await db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    stmt = select(Wishlist).where(
        Wishlist.user_id == current_user.id,
        Wishlist.lot_id == lot_id,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        return {"ok": True, "message": "Already in wishlist"}

    plan = await _get_user_plan(current_user, db)
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    max_items = limits.get("max_wishlist_items", 9999)
    if max_items < 9999:
        count_result = await db.execute(
            select(func.count(Wishlist.id)).where(Wishlist.user_id == current_user.id)
        )
        count = count_result.scalar() or 0
        if count >= max_items:
            raise HTTPException(
                status_code=403,
                detail={"code": "WISHLIST_LIMIT", "limit": max_items},
            )

    db.add(Wishlist(user_id=current_user.id, lot_id=lot_id))
    await db.commit()
    try:
        db.add(UserEvent(user_id=current_user.id, lot_id=lot_id, event_type="wishlist_add"))
        await db.commit()
    except Exception:
        pass
    return {"ok": True}


@router.delete("/{lot_id}")
async def remove_from_wishlist(
    lot_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = delete(Wishlist).where(
        Wishlist.user_id == current_user.id,
        Wishlist.lot_id == lot_id,
    )
    await db.execute(stmt)
    await db.commit()
    try:
        db.add(UserEvent(user_id=current_user.id, lot_id=lot_id, event_type="wishlist_remove"))
        await db.commit()
    except Exception:
        pass
    return {"ok": True}
