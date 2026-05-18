"""Shared plan resolution utility — single source of truth for user plan lookup."""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.db_models import User, Subscription
from app.config import get_settings


async def get_user_plan(user: Optional[User], db: AsyncSession) -> str:
    """Return the effective plan string for a user.

    - Returns 'free' if user is None.
    - Returns 'institutional' for admin emails (from settings.admin_emails).
    - Returns the active subscription plan name (lowercase).
    - Falls back to 'free' if no active/trialing subscription.
    """
    if not user:
        return "free"
    settings = get_settings()
    admin_emails = {e.strip() for e in settings.admin_emails.split(",") if e.strip()}
    if user.email.strip() in admin_emails:
        return "institutional"
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = result.scalar_one_or_none()
    if sub and sub.status.value.lower() in ("active", "trialing"):
        return sub.plan.value.lower()
    return "free"
