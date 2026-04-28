"""
Affiliate click tracking.
GET /api/track/{lot_id}  — logs the click then redirects to the lot's affiliate URL.
"""
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.db_models import ClickEvent, Lot
from app.api.auth_utils import get_current_user_optional
from app.models.db_models import User

router = APIRouter(tags=["tracking"])

# UTM params appended to every outbound link
_UTM = {
    "ref": "nautilus",
    "utm_source": "nautilus",
    "utm_medium": "referral",
}


def _build_affiliate_url(lot: Lot) -> str:
    """Append UTM + campaign params to the lot's source URL."""
    raw = lot.url or ""
    if not raw or not raw.startswith("http"):
        # Fallback — send to a generic search
        name = (lot.artist_name_raw or "").strip()[:60]
        from urllib.parse import quote_plus
        return f"https://www.google.com/search?q={quote_plus(name)}"

    parsed = urlparse(raw)
    params = parse_qs(parsed.query)

    # Merge in our UTM params (never overwrite existing values)
    for k, v in _UTM.items():
        if k not in params:
            params[k] = [v]
    params.setdefault("utm_campaign", [f"lot_{lot.id}"])

    new_query = urlencode({k: v[0] for k, v in params.items()})
    return urlunparse(parsed._replace(query=new_query))


@router.get("/track/{lot_id}", include_in_schema=False)
async def track_and_redirect(
    lot_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    # Fetch lot
    result = await db.execute(select(Lot).where(Lot.id == lot_id))
    lot = result.scalar_one_or_none()

    if lot is None:
        return RedirectResponse(url="https://get-nautilus.com", status_code=302)

    destination = _build_affiliate_url(lot)

    # Log click (fire-and-forget; never block the redirect)
    try:
        ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else None)
        if ip:
            ip = ip.split(",")[0].strip()[:45]
        click = ClickEvent(
            user_id=current_user.id if current_user else None,
            lot_id=lot.id,
            destination_url=destination,
            clicked_at=datetime.utcnow(),
            ip=ip,
        )
        db.add(click)
        await db.commit()
    except Exception:
        pass  # never break the redirect

    return RedirectResponse(url=destination, status_code=302)
