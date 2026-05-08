"""
Auction subscriptions — follow a lot or a sale, get notified before it closes.
"""
import uuid as uuid_lib
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.auth_utils import get_current_user
from app.models.db_models import AuctionSubscription, Lot, User

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class LotSubscribeRequest(BaseModel):
    lot_id: str

class SaleSubscribeRequest(BaseModel):
    auction_house_name: str
    auction_date: str   # ISO string e.g. "2026-05-10T14:00:00"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/lot", status_code=201)
async def subscribe_lot(
    body: LotSubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        lot_uuid = uuid_lib.UUID(str(body.lot_id))
    except (ValueError, AttributeError):
        raise HTTPException(400, "Invalid lot_id")

    lot = await db.get(Lot, lot_uuid)
    if not lot:
        raise HTTPException(404, "Lot not found")

    # Idempotent — return existing if already subscribed
    existing = (await db.execute(
        select(AuctionSubscription).where(
            AuctionSubscription.user_id == current_user.id,
            AuctionSubscription.lot_id == lot_uuid,
        )
    )).scalar_one_or_none()
    if existing:
        return {
            "id": str(existing.id),
            "lot_id": str(existing.lot_id),
            "auction_date": existing.auction_date.isoformat() if existing.auction_date else None,
        }

    sub = AuctionSubscription(
        user_id=current_user.id,
        type="lot",
        lot_id=lot_uuid,
        auction_house_name=lot.auction_house_name,
        auction_date=lot.auction_date,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return {
        "id": str(sub.id),
        "lot_id": str(sub.lot_id),
        "auction_date": sub.auction_date.isoformat() if sub.auction_date else None,
    }


@router.post("/sale", status_code=201)
async def subscribe_sale(
    body: SaleSubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        auction_date = datetime.fromisoformat(body.auction_date)
    except (ValueError, TypeError):
        raise HTTPException(400, "Invalid auction_date — use ISO format")

    sub = AuctionSubscription(
        user_id=current_user.id,
        type="sale",
        auction_house_name=body.auction_house_name,
        auction_date=auction_date,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return {
        "id": str(sub.id),
        "auction_house_name": sub.auction_house_name,
        "auction_date": sub.auction_date.isoformat() if sub.auction_date else None,
    }


@router.get("")
async def list_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AuctionSubscription)
        .where(AuctionSubscription.user_id == current_user.id)
        .order_by(AuctionSubscription.created_at.desc())
    )
    subs = result.scalars().all()

    out = []
    for s in subs:
        item: dict = {
            "id": str(s.id),
            "type": s.type,
            "lot_id": str(s.lot_id) if s.lot_id else None,
            "auction_house_name": s.auction_house_name,
            "auction_date": s.auction_date.isoformat() if s.auction_date else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "title": None,
            "image_url": None,
        }
        if s.lot_id:
            lot = await db.get(Lot, s.lot_id)
            if lot:
                item["title"] = lot.title
                item["image_url"] = lot.image_url
        out.append(item)
    return out


@router.delete("/{subscription_id}")
async def delete_subscription(
    subscription_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        sub_uuid = uuid_lib.UUID(str(subscription_id))
    except (ValueError, AttributeError):
        raise HTTPException(400, "Invalid subscription_id")

    sub = await db.get(AuctionSubscription, sub_uuid)
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub.user_id != current_user.id:
        raise HTTPException(403, "Not your subscription")

    await db.delete(sub)
    await db.commit()
    return {"ok": True}


@router.get("/upcoming")
async def upcoming_subscriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return subscriptions where auction_date is within the next 2 hours."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    in_2h = now + timedelta(hours=2)

    result = await db.execute(
        select(AuctionSubscription).where(
            AuctionSubscription.user_id == current_user.id,
            AuctionSubscription.auction_date >= now,
            AuctionSubscription.auction_date <= in_2h,
        )
    )
    subs = result.scalars().all()
    out = []
    for s in subs:
        artist_name = None
        title = None
        if s.lot_id:
            lot = await db.get(Lot, s.lot_id)
            if lot:
                artist_name = lot.artist_name_raw
                title = lot.title
        out.append({
            "id": str(s.id),
            "type": s.type,
            "lot_id": str(s.lot_id) if s.lot_id else None,
            "auction_house_name": s.auction_house_name,
            "auction_date": s.auction_date.isoformat() if s.auction_date else None,
            "notified_1h": s.notified_1h,
            "notified_30min": s.notified_30min,
            "artist_name": artist_name,
            "title": title,
        })
    return out
