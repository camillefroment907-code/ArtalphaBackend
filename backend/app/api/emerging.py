from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.db_models import ArtistProfile
from app.api.auth_utils import decode_token

router = APIRouter(prefix="/emerging", tags=["emerging"])
_bearer = HTTPBearer(auto_error=False)

FREE_LIMIT = 3


def _plan_from_credentials(creds: Optional[HTTPAuthorizationCredentials]) -> str:
    if not creds:
        return "free"
    try:
        payload = decode_token(creds.credentials)
        return payload.get("plan", "free")
    except Exception:
        return "free"


def _momentum_signal(score: Optional[float]) -> Optional[str]:
    if score is None:
        return None
    return "rising" if score >= 60 else "stable"


@router.get("/artists")
async def get_emerging_artists(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    plan = _plan_from_credentials(creds)
    is_free = plan not in ("investor", "pro", "elite", "institutional")

    result = await db.execute(
        select(ArtistProfile)
        .where(
            ArtistProfile.investment_tier == "emerging",
        )
        .order_by(ArtistProfile.momentum_score.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    artists = result.scalars().all()

    items = [
        {
            "id": str(a.id),
            "name": a.name,
            "image_url": a.image_url,
            "profile_url": a.artsy_url,
            "biography": a.biography,
            "momentum_signal": _momentum_signal(a.momentum_score),
            "momentum_score": a.momentum_score,
            "source": (a.raw_data or {}).get("source"),
        }
        for a in artists
    ]

    if is_free:
        return {
            "artists": items[:FREE_LIMIT],
            "page": page,
            "page_size": page_size,
            "blur_remaining": len(items) > FREE_LIMIT,
            "total_available": len(items),
        }

    return {
        "artists": items,
        "page": page,
        "page_size": page_size,
        "blur_remaining": False,
        "total_available": len(items),
    }
