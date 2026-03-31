"""
ArtAlpha Profile API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from datetime import datetime

from app.database import get_db
from app.models.db_models import User, UserPreference, Subscription
from app.api.auth_utils import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me")
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = sub_result.scalar_one_or_none()

    pref_result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = pref_result.scalar_one_or_none()

    try:
        portfolio_count = (await db.execute(
            text("SELECT COUNT(*) FROM portfolio_items WHERE user_id = :uid"),
            {"uid": str(current_user.id)}
        )).scalar() or 0
    except Exception:
        portfolio_count = 0

    try:
        watchlist_count = (await db.execute(
            text("SELECT COUNT(*) FROM wishlists WHERE user_id = :uid"),
            {"uid": str(current_user.id)}
        )).scalar() or 0
    except Exception:
        watchlist_count = 0

    plan_val = sub.plan.value.lower() if sub else "free"

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": getattr(current_user, "full_name", None),
        "phone": getattr(current_user, "phone", None),
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        # Subscription
        "plan": plan_val,
        "plan_status": sub.status.value.lower() if sub else "active",
        "billing_interval": getattr(sub, "billing_interval", None),
        "current_period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        "cancel_at_period_end": sub.cancel_at_period_end if sub else False,
        # Investor profile (from preferences)
        "collector_type": getattr(pref, "collector_type", None),
        "annual_budget_eur": getattr(pref, "budget_max", None),
        "min_lot_budget_eur": getattr(pref, "min_lot_budget_eur", None),
        "max_lot_budget_eur": getattr(pref, "max_lot_budget_eur", None),
        "investment_horizon": getattr(pref, "investment_horizon", None),
        # Art preferences
        "preferred_categories": getattr(pref, "categories", None) or [],
        "preferred_periods": getattr(pref, "preferred_periods", None) or [],
        "preferred_regions": getattr(pref, "preferred_regions", None) or [],
        "min_deal_score": getattr(pref, "min_deal_score", 70),
        # Notifications
        "notify_email": getattr(pref, "is_alerts_enabled", True),
        "notify_sms": getattr(pref, "notify_sms", False),
        "alert_email": getattr(pref, "alert_email", None) or current_user.email,
        # Stats
        "portfolio_count": portfolio_count,
        "watchlist_count": watchlist_count,
    }


@router.put("/me")
async def update_profile(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Update User fields
    if "full_name" in body and hasattr(current_user, "full_name"):
        current_user.full_name = body["full_name"]
    if "phone" in body and hasattr(current_user, "phone"):
        current_user.phone = body["phone"]
    current_user.updated_at = datetime.utcnow()

    # Update or create UserPreference
    pref_result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    pref = pref_result.scalar_one_or_none()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)

    pref_field_map = {
        "collector_type":     "collector_type",
        "annual_budget_eur":  "budget_max",
        "min_lot_budget_eur": "min_lot_budget_eur",
        "max_lot_budget_eur": "max_lot_budget_eur",
        "investment_horizon": "investment_horizon",
        "preferred_categories": "categories",
        "preferred_periods":  "preferred_periods",
        "preferred_regions":  "preferred_regions",
        "min_deal_score":     "min_deal_score",
        "notify_email":       "is_alerts_enabled",
        "notify_sms":         "notify_sms",
        "alert_email":        "alert_email",
    }

    for body_key, pref_key in pref_field_map.items():
        if body_key in body and hasattr(pref, pref_key):
            setattr(pref, pref_key, body[body_key])

    pref.updated_at = datetime.utcnow()
    await db.commit()
    return {"updated": True}
