"""
AI Agent API — Investor plan and above.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, delete
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.api.auth_utils import get_current_user
from app.config import get_settings
from app.models.db_models import (
    User, AgentAlert, AgentRecommendation,
    Subscription, SubscriptionStatus, UserEvent,
)

router = APIRouter(prefix="/agent", tags=["agent"])

_settings = get_settings()
_ADMIN_EMAILS = {e.strip() for e in _settings.admin_emails.split(",")}

AGENT_ALERT_LIMITS: dict[str, int] = {
    "free":          0,
    "starter":       0,
    "investor":      1,
    "pro":           5,
    "institutional": 9999,
    "expert":        9999,
}

AGENT_PLANS = set(k for k, v in AGENT_ALERT_LIMITS.items() if v > 0)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_user_plan(user: User, db: AsyncSession) -> str:
    if user.email.strip() in _ADMIN_EMAILS:
        return "institutional"
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    sub = result.scalar_one_or_none()
    if sub and sub.status.value.lower() in ("active", "trialing"):
        return sub.plan.value.lower()
    return "free"


async def _require_agent_plan(user: User, db: AsyncSession) -> str:
    plan = await _get_user_plan(user, db)
    if plan not in AGENT_PLANS:
        raise HTTPException(
            status_code=403,
            detail="L'Agent IA est disponible à partir du plan Investor (€29/mois).",
        )
    return plan


# ── Schemas ───────────────────────────────────────────────────────────────────

class AgentAlertCreate(BaseModel):
    name: str
    artist_name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    keywords: Optional[List[str]] = []
    budget_min_eur: Optional[float] = None
    budget_max_eur: Optional[float] = None
    investment_horizon: Optional[str] = None
    risk_tolerance: Optional[str] = "medium"
    min_conviction_score: Optional[int] = 65
    notify_email: Optional[bool] = True


class AgentAlertUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    artist_name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    keywords: Optional[List[str]] = None
    budget_min_eur: Optional[float] = None
    budget_max_eur: Optional[float] = None
    investment_horizon: Optional[str] = None
    risk_tolerance: Optional[str] = None
    min_conviction_score: Optional[int] = None
    notify_email: Optional[bool] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

_TARGETING_FIELDS = {
    "artist_name", "category", "subcategory", "keywords",
    "budget_min_eur", "budget_max_eur",
}


def _serialize_alert(alert: AgentAlert, rec_count: int = 0) -> dict:
    return {
        "id": str(alert.id),
        "name": alert.name,
        "is_active": alert.is_active,
        "artist_name": alert.artist_name,
        "category": alert.category,
        "subcategory": alert.subcategory,
        "keywords": alert.keywords or [],
        "budget_min_eur": alert.budget_min_eur,
        "budget_max_eur": alert.budget_max_eur,
        "investment_horizon": alert.investment_horizon,
        "risk_tolerance": alert.risk_tolerance,
        "min_conviction_score": alert.min_conviction_score,
        "notify_email": alert.notify_email,
        "created_at": alert.created_at.isoformat(),
        "recommendation_count": rec_count,
    }


@router.get("/limits")
async def get_limits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_user_plan(current_user, db)
    max_alerts = AGENT_ALERT_LIMITS.get(plan, 0)
    result = await db.execute(
        select(func.count(AgentAlert.id)).where(AgentAlert.user_id == current_user.id)
    )
    used = result.scalar() or 0
    return {
        "plan": plan,
        "used": used,
        "max": max_alerts,
        "can_create": used < max_alerts,
    }


@router.get("/alerts")
async def list_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_agent_plan(current_user, db)

    alerts_result = await db.execute(
        select(AgentAlert)
        .where(AgentAlert.user_id == current_user.id)
        .order_by(AgentAlert.created_at.desc())
    )
    alerts = alerts_result.scalars().all()

    # Rec counts per alert
    counts_result = await db.execute(
        select(AgentRecommendation.alert_id, func.count(AgentRecommendation.id))
        .where(AgentRecommendation.user_id == current_user.id)
        .group_by(AgentRecommendation.alert_id)
    )
    counts = {str(row[0]): row[1] for row in counts_result.all()}

    return [_serialize_alert(a, counts.get(str(a.id), 0)) for a in alerts]


@router.post("/alerts", status_code=201)
async def create_alert(
    body: AgentAlertCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _require_agent_plan(current_user, db)
    limit = AGENT_ALERT_LIMITS.get(plan, 0)

    count_result = await db.execute(
        select(func.count(AgentAlert.id)).where(AgentAlert.user_id == current_user.id)
    )
    used = count_result.scalar() or 0
    if used >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Votre plan permet {limit} alerte(s). Passez à un plan supérieur pour en créer davantage.",
        )

    alert = AgentAlert(user_id=current_user.id, **body.model_dump())
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return _serialize_alert(alert)


@router.patch("/alerts/{alert_id}")
async def update_alert(
    alert_id: str,
    body: AgentAlertUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_agent_plan(current_user, db)

    result = await db.execute(
        select(AgentAlert).where(
            and_(AgentAlert.id == alert_id, AgentAlert.user_id == current_user.id)
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(404, "Alerte introuvable.")

    updates = body.model_dump(exclude_none=True)
    targeting_changed = bool(_TARGETING_FIELDS & set(updates.keys()))

    for field, value in updates.items():
        setattr(alert, field, value)
    alert.updated_at = datetime.utcnow()

    # Clear unread recs so agent re-evaluates with new criteria
    if targeting_changed:
        await db.execute(
            delete(AgentRecommendation).where(
                and_(
                    AgentRecommendation.alert_id == alert.id,
                    AgentRecommendation.is_read == False,  # noqa: E712
                )
            )
        )

    await db.commit()
    return _serialize_alert(alert)


@router.delete("/alerts/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_agent_plan(current_user, db)

    result = await db.execute(
        select(AgentAlert).where(
            and_(AgentAlert.id == alert_id, AgentAlert.user_id == current_user.id)
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(404, "Alerte introuvable.")

    await db.delete(alert)
    await db.commit()


@router.get("/recommendations")
async def get_recommendations(
    alert_id: Optional[str] = None,
    unread_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_agent_plan(current_user, db)

    filters = [AgentRecommendation.user_id == current_user.id]
    if alert_id:
        filters.append(AgentRecommendation.alert_id == alert_id)
    if unread_only:
        filters.append(AgentRecommendation.is_read == False)  # noqa: E712

    result = await db.execute(
        select(AgentRecommendation)
        .options(
            selectinload(AgentRecommendation.lot),
            selectinload(AgentRecommendation.alert),
        )
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
            "alert_id": str(rec.alert_id),
            "alert_name": rec.alert.name if rec.alert else None,
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
async def mark_read(
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
        raise HTTPException(404, "Recommandation introuvable.")
    rec.is_read = True
    await db.commit()
    return {"status": "ok"}


@router.patch("/recommendations/{rec_id}/acted")
async def mark_acted(
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
        raise HTTPException(404, "Recommandation introuvable.")
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


@router.post("/trigger-run", status_code=200)
async def trigger_agent_run(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_user_plan(current_user, db)
    if current_user.email.strip() not in _ADMIN_EMAILS:
        raise HTTPException(403, "Admin only.")
    import traceback
    from app.jobs.tasks import _run_ai_agents_async
    try:
        await _run_ai_agents_async()
        return {"status": "done"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc), "trace": traceback.format_exc()}


@router.post("/track-event", status_code=201)
async def track_event(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    body = await request.json()
    event = UserEvent(
        user_id=current_user.id,
        event_type=body.get('event_type'),
        entity_type=body.get('entity_type'),
        entity_id=str(body.get('entity_id', '')),
        properties=body.get('properties', {}),
        created_at=datetime.utcnow(),
    )
    db.add(event)
    await db.commit()
    return {"status": "ok"}
