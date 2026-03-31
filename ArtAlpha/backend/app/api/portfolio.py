"""HONO Portfolio API — track artwork acquisitions and project values."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models.db_models import PortfolioItem, User
from app.api.auth_utils import get_current_user
from app.engines.projections import project_value

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _item_to_dict(item: PortfolioItem, proj: dict) -> dict:
    est_value = item.estimated_current_value_eur or item.purchase_price_eur
    gain_eur = est_value - item.purchase_price_eur
    gain_pct = (gain_eur / item.purchase_price_eur * 100) if item.purchase_price_eur > 0 else 0
    return {
        "id": str(item.id),
        "title": item.title,
        "artist_name": item.artist_name,
        "medium": item.medium,
        "dimensions": item.dimensions,
        "year_created": item.year_created,
        "image_url": item.image_url,
        "purchase_price_eur": item.purchase_price_eur,
        "purchase_date": item.purchase_date.isoformat() if item.purchase_date else None,
        "purchase_source": item.purchase_source,
        "estimated_current_value_eur": est_value,
        "gain_eur": round(gain_eur, 2),
        "gain_pct": round(gain_pct, 1),
        "is_for_sale": item.is_for_sale,
        "asking_price_eur": item.asking_price_eur,
        "notes": item.notes,
        "artist_tier": proj["artist_tier"],
        "base_cagr_pct": proj["base_cagr_pct"],
        "recommended_hold_years": proj["recommended_hold_years"],
        "sell_recommendation": proj["sell_recommendation"],
        "projection_5y": proj["projections"].get(5, {}).get("base_eur"),
        "projection_10y": proj["projections"].get(10, {}).get("base_eur"),
        "projection_20y": proj["projections"].get(20, {}).get("base_eur"),
        "projections": proj["projections"],
    }


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

    portfolio_data = []
    for item in items:
        proj = project_value(
            purchase_price_eur=item.purchase_price_eur,
            artist_name=item.artist_name,
            years=[5, 10, 20, 30, 50],
        )
        portfolio_data.append(_item_to_dict(item, proj))

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
    proj = project_value(purchase_price_eur=item.purchase_price_eur, artist_name=item.artist_name, years=[5, 10, 20, 30, 50])
    return _item_to_dict(item, proj)


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
    proj = project_value(purchase_price_eur=item.purchase_price_eur, artist_name=item.artist_name, years=[5, 10, 20, 30, 50])
    return _item_to_dict(item, proj)


@router.patch("/{item_id}")
async def update_portfolio_item(
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
