from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
import math
import uuid

from app.database import get_db
from app.models.db_models import Alert, User, UserPreference, UserAlertPreferences
from app.models.schemas import AlertOut, PreferenceUpdate, PreferenceOut, AlertPreferencesOut, AlertPreferencesUpdate
from app.api.auth_utils import get_current_user

alerts_router = APIRouter(prefix="/alerts", tags=["alerts"])
prefs_router = APIRouter(prefix="/preferences", tags=["preferences"])


# ── Alerts ────────────────────────────────────────────────────────────────────

@alerts_router.get("", response_model=dict)
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    total_result = await db.execute(
        select(func.count(Alert.id)).where(Alert.user_id == current_user.id)
    )
    total = total_result.scalar() or 0

    result = await db.execute(
        select(Alert)
        .options(selectinload(Alert.lot).selectinload(Alert.lot.artist))  # type: ignore
        .where(Alert.user_id == current_user.id)
        .order_by(desc(Alert.sent_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    alerts = result.scalars().all()

    return {
        "items": alerts,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total > 0 else 0,
    }


@alerts_router.delete("/{alert_id}")
async def delete_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Alert).where(
            and_(Alert.id == alert_id, Alert.user_id == current_user.id)
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    await db.delete(alert)
    await db.commit()
    return {"deleted": True}


# ── Preferences ───────────────────────────────────────────────────────────────

@prefs_router.get("", response_model=PreferenceOut)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")
    return prefs


@alerts_router.get("/preferences", response_model=AlertPreferencesOut)
async def get_alert_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserAlertPreferences).where(UserAlertPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        # Auto-create with defaults on first access
        prefs = UserAlertPreferences(id=uuid.uuid4(), user_id=current_user.id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return prefs


@alerts_router.put("/preferences", response_model=AlertPreferencesOut)
async def update_alert_preferences(
    body: AlertPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserAlertPreferences).where(UserAlertPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = UserAlertPreferences(id=uuid.uuid4(), user_id=current_user.id)
        db.add(prefs)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(prefs, field, value)

    from datetime import datetime
    prefs.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(prefs)
    return prefs


@prefs_router.patch("", response_model=PreferenceOut)
async def update_preferences(
    body: PreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        raise HTTPException(status_code=404, detail="Preferences not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prefs, field, value)

    from datetime import datetime
    prefs.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(prefs)
    return prefs
