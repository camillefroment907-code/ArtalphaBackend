"""
Waitlist API — pre-launch signup with referral system.
Endpoint: POST /api/waitlist  (root of prefix, matches frontend call)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
import secrets
import string

from app.database import get_db
from app.models.db_models import WaitlistEntry

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


class WaitlistJoinRequest(BaseModel):
    email: str
    name: Optional[str] = None
    referral_code: Optional[str] = None


class WaitlistJoinResponse(BaseModel):
    position: int
    referral_code: str
    message: str


def _generate_referral_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("", response_model=WaitlistJoinResponse, status_code=201)
async def join_waitlist(body: WaitlistJoinRequest, db: AsyncSession = Depends(get_db)):
    """Join the pre-launch waitlist. Idempotent — returns existing entry if already signed up."""
    email = body.email.strip().lower()

    # Idempotent: return existing entry
    result = await db.execute(select(WaitlistEntry).where(WaitlistEntry.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        return WaitlistJoinResponse(
            position=existing.position,
            referral_code=existing.referral_code,
            message="Already on waitlist",
        )

    # Determine position (1-based)
    count_result = await db.execute(select(func.count()).select_from(WaitlistEntry))
    count = count_result.scalar() or 0

    # Referral boost: +10 positions up the list
    referred_by = None
    referral_boost = 0
    if body.referral_code:
        ref_code = body.referral_code.strip().upper()
        ref_result = await db.execute(
            select(WaitlistEntry).where(WaitlistEntry.referral_code == ref_code)
        )
        if ref_result.scalar_one_or_none():
            referred_by = ref_code
            referral_boost = 10

    position = max(1, count + 1 - referral_boost)

    # Generate a unique referral code
    code = ""
    for _ in range(10):
        candidate = _generate_referral_code()
        exists = await db.execute(
            select(WaitlistEntry).where(WaitlistEntry.referral_code == candidate)
        )
        if not exists.scalar_one_or_none():
            code = candidate
            break
    if not code:
        code = _generate_referral_code()  # fallback (collision probability ~0)

    entry = WaitlistEntry(
        email=email,
        first_name=body.name.strip() if body.name else None,
        referral_code=code,
        referred_by=referred_by,
        position=position,
    )
    db.add(entry)
    await db.commit()

    return WaitlistJoinResponse(
        position=position,
        referral_code=code,
        message="Welcome to the Nautilus waitlist!",
    )


@router.get("/count")
async def get_waitlist_count(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count()).select_from(WaitlistEntry))
    return {"count": result.scalar() or 0}


@router.get("/position/{email}")
async def get_waitlist_position(email: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WaitlistEntry).where(WaitlistEntry.email == email.strip().lower())
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Email not found on waitlist")
    return {"position": entry.position, "referral_code": entry.referral_code}
