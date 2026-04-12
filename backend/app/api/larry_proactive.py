"""
Larry Proactive — Nautilus
Larry initiates conversations about market opportunities.
Runs after each scan cycle. Stores notifications for users.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from datetime import datetime, timedelta

from app.database import get_db
from app.api.auth_utils import get_current_user
from app.models.db_models import User, Lot

router = APIRouter(prefix="/larry", tags=["larry"])


@router.get("/proactive")
async def get_proactive_messages(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns Larry's proactive messages for the current user.
    Generated from: new exceptional lots + agent matches + market signals.
    """
    messages = []
    now = datetime.utcnow()
    since = now - timedelta(hours=24)

    # 1. New EXCEPTIONAL lots in last 24h
    exceptional_result = await db.execute(
        select(Lot)
        .where(
            and_(
                Lot.deal_score >= 80,
                Lot.created_at >= since,
                Lot.current_price.isnot(None),
            )
        )
        .order_by(desc(Lot.deal_score))
        .limit(3)
    )
    exceptional_lots = exceptional_result.scalars().all()

    for lot in exceptional_lots:
        price = lot.current_price or lot.estimate_low or 0
        upside = lot.pct_below_low_estimate or 0
        artist = lot.artist_name_raw or "Unknown"

        messages.append({
            "id": f"exceptional-{lot.id}",
            "type": "exceptional_lot",
            "priority": "high",
            "lot_id": str(lot.id),
            "title": "Opportunité exceptionnelle détectée",
            "preview": f"{artist} — {lot.title[:50] if lot.title else 'Sans titre'}",
            "detail": f"Score {lot.deal_score:.0f}/100 · {upside:.0f}% sous estimation · €{price:,.0f}",
            "cta": "Analyser →",
            "created_at": lot.created_at.isoformat() if lot.created_at else now.isoformat(),
            "larry_message": f"J'ai repéré un lot exceptionnel. {artist} passe en vente avec une décote de {upside:.0f}% par rapport à l'estimation. Score de conviction : {lot.deal_score:.0f}/100. Voulez-vous que j'analyse ?",
        })

    # 2. Market signal — strong day
    if len(exceptional_lots) >= 2:
        messages.append({
            "id": f"market-signal-{now.strftime('%Y%m%d')}",
            "type": "market_signal",
            "priority": "medium",
            "lot_id": None,
            "title": "Signal marché fort aujourd'hui",
            "preview": f"{len(exceptional_lots)} opportunités exceptionnelles détectées",
            "detail": "Activité inhabituelle sur le marché — score moyen en hausse",
            "cta": "Voir les opportunités →",
            "created_at": now.isoformat(),
            "larry_message": f"Le marché présente {len(exceptional_lots)} opportunités exceptionnelles ce cycle. C'est au-dessus de la moyenne. Voulez-vous que je vous fasse un brief ?",
        })

    # 3. Primary market newcomer
    primary_result = await db.execute(
        select(Lot)
        .where(
            and_(
                Lot.market_type == "primary",
                Lot.deal_score >= 65,
                Lot.created_at >= since,
            )
        )
        .order_by(desc(Lot.deal_score))
        .limit(1)
    )
    primary_lot = primary_result.scalar_one_or_none()

    if primary_lot:
        messages.append({
            "id": f"primary-{primary_lot.id}",
            "type": "primary_opportunity",
            "priority": "medium",
            "lot_id": str(primary_lot.id),
            "title": "Nouvelle entrée marché primaire",
            "preview": f"{primary_lot.artist_name_raw or 'Artiste'} — disponible en galerie",
            "detail": f"Fenêtre d'entrée pré-enchères · Score {primary_lot.deal_score:.0f}/100",
            "cta": "Voir l'œuvre →",
            "created_at": primary_lot.created_at.isoformat() if primary_lot.created_at else now.isoformat(),
            "larry_message": f"Un artiste intéressant vient d'apparaître sur le marché primaire. C'est souvent la meilleure fenêtre d'entrée avant que les enchères ne le découvrent.",
        })

    return {
        "messages": messages,
        "count": len(messages),
        "generated_at": now.isoformat(),
    }
