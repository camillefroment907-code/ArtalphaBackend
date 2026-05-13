from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.db_models import ArtistProfile, EmergingArtist
from app.api.auth_utils import decode_token

router = APIRouter(prefix="/emerging", tags=["emerging"])
emerging_artists_router = APIRouter(prefix="/emerging-artists", tags=["emerging"])
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

    total_count_result = await db.execute(
        select(func.count()).select_from(ArtistProfile).where(
            ArtistProfile.investment_tier == "emerging"
        )
    )
    total_count = total_count_result.scalar() or 0

    if is_free:
        return {
            "artists": items[:FREE_LIMIT],
            "page": page,
            "page_size": page_size,
            "blur_remaining": len(items) > FREE_LIMIT,
            "total_available": total_count,
        }

    return {
        "artists": items,
        "page": page,
        "page_size": page_size,
        "blur_remaining": False,
        "total_available": total_count,
    }


# ── GET /api/emerging-artists — sourced from Artsy gallery pipeline ──

@emerging_artists_router.get("")
async def get_artsy_emerging_artists(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    min_momentum: float = Query(0.0, ge=0),
    nationality: Optional[str] = Query(None),
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    plan = _plan_from_credentials(creds)
    is_free = plan not in ("investor", "pro", "elite", "institutional")

    q = select(EmergingArtist).order_by(EmergingArtist.momentum_score.desc())
    if min_momentum > 0:
        q = q.where(EmergingArtist.momentum_score >= min_momentum)
    if nationality:
        q = q.where(EmergingArtist.nationality.ilike(f"%{nationality}%"))

    result = await db.execute(q.offset((page - 1) * page_size).limit(page_size))
    artists = result.scalars().all()

    total_q = await db.execute(select(EmergingArtist))
    total = len(total_q.scalars().all())

    items = [
        {
            "id": str(a.id),
            "artist_name": a.artist_name,
            "nationality": a.nationality,
            "birth_year": a.birth_year,
            "gallery_name": a.gallery_name,
            "avg_price": a.avg_price,
            "lot_count": a.lot_count,
            "momentum_score": a.momentum_score,
            "last_seen_at": a.last_seen_at.isoformat() if a.last_seen_at else None,
        }
        for a in artists
    ]

    if is_free:
        return {"artists": items[:3], "page": page, "page_size": page_size,
                "total": total, "blur_remaining": len(items) > 3}

    return {"artists": items, "page": page, "page_size": page_size,
            "total": total, "blur_remaining": False}


@emerging_artists_router.post("/sync")
async def sync_emerging_artists(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: pull fresh data from Artsy and upsert into emerging_artists."""
    plan = _plan_from_credentials(creds)
    if plan not in ("pro", "elite", "institutional"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")

    from app.connectors.artsy_connector import fetch_emerging_artists
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    records = await fetch_emerging_artists()
    if not records:
        return {"synced": 0}

    now = datetime.utcnow()
    synced = 0
    for rec in records:
        stmt = pg_insert(EmergingArtist).values(
            id=__import__('uuid').uuid4(),
            artist_name=rec["artist_name"],
            nationality=rec.get("nationality"),
            birth_year=rec.get("birth_year"),
            gallery_name=rec.get("gallery_name"),
            avg_price=rec.get("avg_price"),
            lot_count=rec.get("lot_count", 1),
            last_seen_at=now,
            momentum_score=50.0,
            created_at=now,
            updated_at=now,
        ).on_conflict_do_update(
            constraint="uq_emerging_artist_name",
            set_={
                "gallery_name": rec.get("gallery_name"),
                "avg_price": rec.get("avg_price"),
                "lot_count": rec.get("lot_count", 1),
                "last_seen_at": now,
                "updated_at": now,
            }
        )
        await db.execute(stmt)
        synced += 1

    await db.commit()
    return {"synced": synced}
