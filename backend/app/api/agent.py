"""
AI Agent API — Pro (Family Office) plan only.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.api.auth_utils import get_current_user
from app.config import get_settings
from app.models.db_models import (
    User, AgentConfig, AgentRecommendation,
    Subscription, SubscriptionPlan, SubscriptionStatus,
)

router = APIRouter(prefix="/agent", tags=["agent"])

AGENT_PLANS = {"pro", "institutional", "expert"}  # plans with agent access

_settings = get_settings()
_ADMIN_EMAILS = {e.strip() for e in _settings.admin_emails.split(",")}


async def _require_agent_plan(user: User, db: AsyncSession) -> str:
    """Raise 403 if user is not on Pro+ plan. Returns the plan string."""
    if user.email.strip() in _ADMIN_EMAILS:
        return "institutional"
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = result.scalar_one_or_none()
    plan = sub.plan.value.lower() if sub and sub.status.value.lower() in ("active", "trialing") else "free"
    if plan not in AGENT_PLANS:
        raise HTTPException(
            status_code=403,
            detail="AI Agent is available on Family Office plan (€99/month) and above."
        )
    return plan


# ── Schemas ───────────────────────────────────────────────────────────────────

class AgentConfigCreate(BaseModel):
    budget_min_eur: Optional[float] = None
    budget_max_eur: Optional[float] = None
    investment_horizon: Optional[str] = None
    collector_type: Optional[str] = None
    favorite_artists: Optional[List[str]] = []
    preferred_categories: Optional[List[str]] = []
    risk_tolerance: Optional[str] = "medium"
    min_conviction_score: Optional[int] = 70
    max_recommendations_per_day: Optional[int] = 3
    notify_email: Optional[bool] = True
    notify_in_app: Optional[bool] = True


class AgentConfigUpdate(AgentConfigCreate):
    is_active: Optional[bool] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_agent_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_agent_plan(current_user, db)
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return {"configured": False}
    return {
        "configured": True,
        "is_active": config.is_active,
        "budget_min_eur": config.budget_min_eur,
        "budget_max_eur": config.budget_max_eur,
        "investment_horizon": config.investment_horizon,
        "collector_type": config.collector_type,
        "favorite_artists": config.favorite_artists or [],
        "preferred_categories": config.preferred_categories or [],
        "risk_tolerance": config.risk_tolerance,
        "min_conviction_score": config.min_conviction_score,
        "max_recommendations_per_day": config.max_recommendations_per_day,
        "notify_email": config.notify_email,
        "notify_in_app": config.notify_in_app,
    }


@router.post("/config")
async def create_or_update_agent_config(
    body: AgentConfigCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_agent_plan(current_user, db)
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()

    if not config:
        config = AgentConfig(user_id=current_user.id)
        db.add(config)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(config, field, value)

    config.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "ok", "is_active": config.is_active}


@router.patch("/config")
async def patch_agent_config(
    body: AgentConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_agent_plan(current_user, db)
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.user_id == current_user.id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(404, "Agent not configured yet. Call POST /agent/config first.")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(config, field, value)

    config.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "ok"}


@router.get("/recommendations")
async def get_recommendations(
    unread_only: bool = False,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_agent_plan(current_user, db)

    filters = [AgentRecommendation.user_id == current_user.id]
    if unread_only:
        filters.append(AgentRecommendation.is_read == False)  # noqa: E712

    result = await db.execute(
        select(AgentRecommendation)
        .options(selectinload(AgentRecommendation.lot))
        .where(and_(*filters))
        .order_by(AgentRecommendation.created_at.desc())
        .limit(limit)
    )
    recs = result.scalars().all()

    out = []
    for rec in recs:
        lot_data = None
        if rec.lot:
            lot_data = {
                "id": str(rec.lot.id),
                "title": rec.lot.title,
                "artist_name_raw": rec.lot.artist_name_raw,
                "current_price": rec.lot.current_price,
                "estimate_low": rec.lot.estimate_low,
                "estimate_high": rec.lot.estimate_high,
                "deal_score": rec.lot.deal_score,
                "image_url": rec.lot.image_url,
                "url": rec.lot.url,
                "auction_date": rec.lot.auction_date.isoformat() if rec.lot.auction_date else None,
                "auction_house_name": rec.lot.auction_house_name,
                "pct_below_low_estimate": rec.lot.pct_below_low_estimate,
            }
        out.append({
            "id": str(rec.id),
            "lot_id": str(rec.lot_id) if rec.lot_id else None,
            "verdict": rec.verdict,
            "conviction_score": rec.conviction_score,
            "reasoning": rec.reasoning,
            "bull_case": rec.bull_case,
            "bear_case": rec.bear_case,
            "suggested_max_price_eur": rec.suggested_max_price_eur,
            "estimated_return_pct": rec.estimated_return_pct,
            "hold_period_months": rec.hold_period_months,
            "is_read": rec.is_read,
            "is_acted_on": rec.is_acted_on,
            "created_at": rec.created_at.isoformat(),
            "lot": lot_data,
        })
    return out


@router.patch("/recommendations/{rec_id}/read")
async def mark_recommendation_read(
    rec_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentRecommendation).where(
            and_(
                AgentRecommendation.id == rec_id,
                AgentRecommendation.user_id == current_user.id,
            )
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    rec.is_read = True
    await db.commit()
    return {"status": "ok"}


@router.patch("/recommendations/{rec_id}/acted")
async def mark_recommendation_acted(
    rec_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentRecommendation).where(
            and_(
                AgentRecommendation.id == rec_id,
                AgentRecommendation.user_id == current_user.id,
            )
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "Recommendation not found")
    rec.is_acted_on = True
    await db.commit()
    return {"status": "ok"}


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count(AgentRecommendation.id)).where(
            and_(
                AgentRecommendation.user_id == current_user.id,
                AgentRecommendation.is_read == False,  # noqa: E712
            )
        )
    )
    return {"count": result.scalar() or 0}
