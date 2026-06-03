"""Shared plan resolution utility — single source of truth for user plan lookup."""
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.db_models import User, Subscription
from app.config import get_settings
from app.utils.cache import get_cached, set_cached, invalidate


async def get_user_plan(user: Optional[User], db: AsyncSession) -> str:
    """Return the effective plan string for a user.

    - Returns 'free' if user is None.
    - Returns 'institutional' for admin emails (from settings.admin_emails).
    - Returns the active subscription plan name (lowercase).
    - Falls back to 'free' if no active/trialing subscription or expired trial.
    """
    if not user:
        return "free"

    # Cache plan per user for 5 minutes — plan changes are rare and a short
    # staleness window is acceptable.  Stripe webhook handlers should call
    # invalidate_user_plan_cache() on plan changes.
    _ck = f"user_plan:{user.id}"
    _hit = get_cached(_ck, ttl=300)
    if _hit is not None:
        return _hit

    settings = get_settings()
    admin_emails = {e.strip() for e in settings.admin_emails.split(",") if e.strip()}
    if user.email.strip() in admin_emails:
        set_cached(_ck, "institutional")
        return "institutional"
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = result.scalar_one_or_none()
    plan = "free"
    if sub:
        status = sub.status.value.lower()
        if status == "active":
            plan = sub.plan.value.lower()
        elif status == "trialing":
            if user.trial_end and user.trial_end > datetime.utcnow():
                plan = sub.plan.value.lower()
    set_cached(_ck, plan)
    return plan


def invalidate_user_plan_cache(user_id: str) -> None:
    """Call from billing webhooks after a plan change so stale plan is evicted."""
    invalidate(f"user_plan:{user_id}")
