"""HONO Portfolio API — track artwork acquisitions and project values."""
import csv
import io
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, text
from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from app.database import get_db
from app.models.db_models import PortfolioItem, User, Wishlist, UserPreference, Lot
from app.api.auth_utils import get_current_user
from app.engines.projections import project_value

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PortfolioItemCreate(BaseModel):
    title: str
    artist_name: Optional[str] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    image_url: Optional[str] = None
    notes: Optional[str] = None
    lot_id: Optional[UUID] = None
    year: Optional[int] = None
    location: Optional[str] = None
    condition: Optional[str] = None
    target_sell_date: Optional[str] = None
    # Accept purchase_price_eur (legacy) or purchase_price (new modal)
    purchase_price_eur: Optional[float] = None
    purchase_price: Optional[float] = None
    # Accept purchase_date (legacy) or acquisition_date (new modal)
    purchase_date: Optional[datetime] = None
    acquisition_date: Optional[str] = None
    # Accept purchase_source (legacy) or acquisition_source (new modal)
    purchase_source: Optional[str] = None
    acquisition_source: Optional[str] = None
    # Accept estimated_current_value_eur (legacy) or current_value (new modal)
    estimated_current_value_eur: Optional[float] = None
    current_value: Optional[float] = None
    # Accept asking_price_eur (legacy) or target_sell_price (new modal)
    asking_price_eur: Optional[float] = None
    target_sell_price: Optional[float] = None


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
    price_eur = body.purchase_price_eur or body.purchase_price
    if price_eur is None:
        raise HTTPException(422, "purchase_price_eur is required")

    acq_date = body.purchase_date
    if acq_date is None and body.acquisition_date:
        try:
            acq_date = datetime.fromisoformat(body.acquisition_date)
        except ValueError:
            acq_date = None

    # Compose notes (merge base notes + location + condition)
    notes_parts = [p for p in [
        body.notes,
        f"Location: {body.location}" if body.location else None,
        f"Condition: {body.condition}" if body.condition else None,
    ] if p]
    combined_notes = "\n".join(notes_parts) or None

    item = PortfolioItem(
        user_id=current_user.id,
        lot_id=body.lot_id,
        title=body.title,
        artist_name=body.artist_name,
        purchase_price_eur=price_eur,
        purchase_date=acq_date,
        purchase_source=body.purchase_source or body.acquisition_source,
        medium=body.medium,
        dimensions=body.dimensions,
        image_url=body.image_url,
        notes=combined_notes,
        estimated_current_value_eur=body.estimated_current_value_eur or body.current_value,
        asking_price_eur=body.asking_price_eur or body.target_sell_price,
        year_created=body.year,
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
# WATCHLIST
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/watchlist")
async def get_watchlist(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return user's watchlist with lot details."""
    result = await db.execute(
        select(Wishlist, Lot)
        .join(Lot, Wishlist.lot_id == Lot.id)
        .where(Wishlist.user_id == current_user.id)
        .order_by(Wishlist.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "watchlist_id": str(w.id),
            "lot_id": str(w.lot_id),
            "note": w.note,
            "added_at": w.created_at.isoformat() if w.created_at else None,
            "lot": {
                "id": str(l.id),
                "title": l.title,
                "artist_name": l.artist_name_raw,
                "image_url": l.image_url,
                "auction_house": l.auction_house_name,
                "estimate_low": l.estimate_low,
                "estimate_high": l.estimate_high,
                "current_price": l.current_price,
                "deal_score": l.deal_score,
                "auction_date": l.auction_date.isoformat() if l.auction_date else None,
                "status": l.status.value if l.status else None,
            },
        }
        for w, l in rows
    ]


@router.delete("/watchlist/{lot_id}", status_code=204)
async def remove_from_watchlist(
    lot_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Wishlist).where(
            Wishlist.lot_id == lot_id,
            Wishlist.user_id == current_user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Not in watchlist")
    await db.delete(item)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# FAVORITE ARTISTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/favorite-artists")
async def get_favorite_artists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()
    return {"artists": list(pref.favorite_artists or []) if pref else []}


@router.post("/favorite-artists", status_code=201)
async def add_favorite_artist(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    artist_name = (body.get("artist_name") or "").strip()
    if not artist_name:
        raise HTTPException(400, "artist_name required")
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()
    if not pref:
        pref = UserPreference(user_id=current_user.id, favorite_artists=[artist_name])
        db.add(pref)
    else:
        current_list = list(pref.favorite_artists or [])
        if artist_name not in current_list:
            current_list.append(artist_name)
            pref.favorite_artists = current_list
    await db.commit()
    return {"success": True}


@router.delete("/favorite-artists/{artist_name}", status_code=204)
async def remove_favorite_artist(
    artist_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()
    if not pref:
        return
    current_list = list(pref.favorite_artists or [])
    if artist_name in current_list:
        current_list.remove(artist_name)
        pref.favorite_artists = current_list
        await db.commit()


@router.patch("/favorite-artists/{artist_id}")
async def update_favorite_artist(
    artist_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("UPDATE favorite_artists SET alert_new_lot = :new_lot, alert_price_change = :price WHERE id = :id AND user_id = :uid"),
        {
            "new_lot": body.get("alert_new_lot", True),
            "price": body.get("alert_price_change", True),
            "id": artist_id,
            "uid": str(current_user.id),
        }
    )
    await db.commit()
    return {"message": "Updated"}


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


@router.get("/export")
async def export_portfolio(
    format: str = Query("csv", enum=["csv", "json"]),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export full portfolio data as CSV or JSON."""
    result = await db.execute(
        select(PortfolioItem).where(PortfolioItem.user_id == current_user.id)
    )
    items = result.scalars().all()

    if format == "json":
        data = [
            {
                "artist": i.artist_name,
                "title": i.title,
                "purchase_price_eur": i.purchase_price_eur,
                "current_value_eur": i.estimated_current_value_eur,
                "acquisition_date": str(i.acquisition_date) if i.acquisition_date else None,
            }
            for i in items
        ]
        return StreamingResponse(
            io.StringIO(json.dumps(data, indent=2, ensure_ascii=False)),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=nautilus_portfolio.json"},
        )
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Artist", "Title", "Purchase Price (€)", "Current Value (€)", "Return %", "Acquisition Date"])
        for i in items:
            buy = i.purchase_price_eur or 0
            val = i.estimated_current_value_eur or buy
            ret = ((val - buy) / buy * 100) if buy > 0 else 0
            writer.writerow([
                i.artist_name or "",
                i.title or "",
                f"{buy:.0f}" if buy else "",
                f"{val:.0f}" if val else "",
                f"{ret:.1f}%",
                i.acquisition_date or "",
            ])
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=nautilus_portfolio.csv"},
        )


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
