"""HONO Portfolio API — track artwork acquisitions and project values."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from app.database import get_db
from app.models.db_models import PortfolioItem, User
from app.api.auth_utils import get_current_user
from app.engines.projections import project_value

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PortfolioItemCreate(BaseModel):
    title: str
    artist_name: Optional[str] = None
    purchase_price_eur: float
    purchase_date: Optional[datetime] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None
    lot_id: Optional[UUID] = None


class PortfolioItemUpdate(BaseModel):
    title: Optional[str] = None
    artist_name: Optional[str] = None
    purchase_price_eur: Optional[float] = None
    purchase_date: Optional[datetime] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None
    estimated_current_value_eur: Optional[float] = None
    is_for_sale: Optional[bool] = None
    asking_price_eur: Optional[float] = None


# ── Internal helpers ──────────────────────────────────────────────────────────

def _gain_pct(item: PortfolioItem) -> Optional[float]:
    if item.estimated_current_value_eur and item.purchase_price_eur and item.purchase_price_eur > 0:
        return round(
            (item.estimated_current_value_eur - item.purchase_price_eur) / item.purchase_price_eur * 100, 1
        )
    return None


def _item_dict(item: PortfolioItem) -> dict:
    return {
        "id": str(item.id),
        "user_id": str(item.user_id),
        "lot_id": str(item.lot_id) if item.lot_id else None,
        "title": item.title,
        "artist_name": item.artist_name,
        "medium": item.medium,
        "dimensions": item.dimensions,
        "image_url": item.image_url,
        "purchase_price_eur": item.purchase_price_eur,
        "purchase_date": item.purchase_date.isoformat() if item.purchase_date else None,
        "estimated_current_value_eur": item.estimated_current_value_eur,
        "last_valuation_at": item.last_valuation_at.isoformat() if item.last_valuation_at else None,
        "notes": item.notes,
        "is_for_sale": item.is_for_sale or False,
        "asking_price_eur": item.asking_price_eur,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "gain_pct": _gain_pct(item),
    }


def _item_dict_with_proj(item: PortfolioItem) -> dict:
    est_value = item.estimated_current_value_eur or item.purchase_price_eur
    gain_eur = est_value - item.purchase_price_eur
    gain_pct = (gain_eur / item.purchase_price_eur * 100) if item.purchase_price_eur > 0 else 0
    proj = project_value(
        purchase_price_eur=item.purchase_price_eur,
        artist_name=item.artist_name,
        years=[5, 10, 20, 30, 50],
    )
    return {
        **_item_dict(item),
        "gain_eur": round(gain_eur, 2),
        "gain_pct": round(gain_pct, 1),
        "purchase_source": getattr(item, "purchase_source", None),
        "year_created": getattr(item, "year_created", None),
        "artist_tier": proj["artist_tier"],
        "base_cagr_pct": proj["base_cagr_pct"],
        "recommended_hold_years": proj["recommended_hold_years"],
        "sell_recommendation": proj["sell_recommendation"],
        "projection_5y": proj["projections"].get(5, {}).get("base_eur"),
        "projection_10y": proj["projections"].get(10, {}).get("base_eur"),
        "projection_20y": proj["projections"].get(20, {}).get("base_eur"),
        "projections": proj["projections"],
    }


# ══════════════════════════════════════════════════════════════════════════════
# NEW ENDPOINTS — /portfolio/items + /portfolio/stats (used by frontend v2)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem).where(PortfolioItem.user_id == current_user.id)
    )
    items = result.scalars().all()

    total_invested = sum(i.purchase_price_eur for i in items)
    items_with_valuation = sum(1 for i in items if i.estimated_current_value_eur is not None)
    estimated_total = sum(
        i.estimated_current_value_eur if i.estimated_current_value_eur is not None else i.purchase_price_eur
        for i in items
    )
    gain_pct = (
        round((estimated_total - total_invested) / total_invested * 100, 1)
        if total_invested > 0 else 0.0
    )

    return {
        "total_invested": total_invested,
        "total_items": len(items),
        "items_with_valuation": items_with_valuation,
        "estimated_total_value": estimated_total,
        "gain_pct": gain_pct,
    }


@router.get("/items")
async def list_items(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem)
        .where(PortfolioItem.user_id == current_user.id)
        .order_by(PortfolioItem.purchase_date.desc().nullslast(), PortfolioItem.created_at.desc())
    )
    return [_item_dict(i) for i in result.scalars().all()]


@router.post("/items", status_code=201)
async def create_item(
    body: PortfolioItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = PortfolioItem(
        user_id=current_user.id,
        lot_id=body.lot_id,
        title=body.title,
        artist_name=body.artist_name,
        purchase_price_eur=body.purchase_price_eur,
        purchase_date=body.purchase_date,
        medium=body.medium,
        dimensions=body.dimensions,
        image_url=body.image_url,
        notes=body.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _item_dict(item)


@router.put("/items/{item_id}")
async def update_item(
    item_id: UUID,
    body: PortfolioItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem).where(
            PortfolioItem.id == item_id,
            PortfolioItem.user_id == current_user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(item)
    return _item_dict(item)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem).where(
            PortfolioItem.id == item_id,
            PortfolioItem.user_id == current_user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY ENDPOINTS — kept for backward compat
# ══════════════════════════════════════════════════════════════════════════════

@router.get("")
async def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem)
        .where(PortfolioItem.user_id == current_user.id)
        .order_by(PortfolioItem.purchase_date.desc().nullslast())
    )
    items = result.scalars().all()
    portfolio_data = [_item_dict_with_proj(i) for i in items]

    total_invested = sum(i.purchase_price_eur for i in items)
    total_current = sum(i.estimated_current_value_eur or i.purchase_price_eur for i in items)
    gain = total_current - total_invested
    gain_pct = (gain / total_invested * 100) if total_invested > 0 else 0

    return {
        "items": portfolio_data,
        "stats": {
            "total_invested_eur": round(total_invested, 2),
            "total_current_eur": round(total_current, 2),
            "total_gain_eur": round(gain, 2),
            "total_gain_pct": round(gain_pct, 1),
            "item_count": len(items),
        },
    }


@router.get("/{item_id}")
async def get_portfolio_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem).where(
            and_(PortfolioItem.id == item_id, PortfolioItem.user_id == current_user.id)
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item not found")
    return _item_dict_with_proj(item)


@router.post("")
async def add_to_portfolio(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.get("title"):
        raise HTTPException(400, "title is required")
    if not body.get("purchase_price_eur"):
        raise HTTPException(400, "purchase_price_eur is required")

    item = PortfolioItem(
        user_id=current_user.id,
        lot_id=body.get("lot_id"),
        title=body["title"],
        artist_name=body.get("artist_name"),
        medium=body.get("medium"),
        dimensions=body.get("dimensions"),
        year_created=body.get("year_created"),
        image_url=body.get("image_url"),
        purchase_price_eur=float(body["purchase_price_eur"]),
        purchase_date=datetime.fromisoformat(body["purchase_date"]) if body.get("purchase_date") else None,
        purchase_source=body.get("purchase_source"),
        notes=body.get("notes"),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _item_dict_with_proj(item)


@router.patch("/{item_id}")
async def patch_portfolio_item(
    item_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem).where(
            and_(PortfolioItem.id == item_id, PortfolioItem.user_id == current_user.id)
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item not found")

    for field in ["title", "artist_name", "medium", "dimensions", "year_created", "notes",
                  "is_for_sale", "asking_price_eur", "purchase_source", "image_url",
                  "estimated_current_value_eur"]:
        if field in body:
            setattr(item, field, body[field])

    item.updated_at = datetime.utcnow()
    await db.commit()
    return {"success": True}


@router.delete("/{item_id}")
async def remove_from_portfolio(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem).where(
            and_(PortfolioItem.id == item_id, PortfolioItem.user_id == current_user.id)
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item not found")
    await db.delete(item)
    await db.commit()
    return {"success": True}
