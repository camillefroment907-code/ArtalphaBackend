from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.models.db_models import Wishlist, Lot, User
from app.models.schemas import LotOut
from app.api.auth_utils import get_current_user

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


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

    db.add(Wishlist(user_id=current_user.id, lot_id=lot_id))
    await db.commit()
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
    return {"ok": True}
