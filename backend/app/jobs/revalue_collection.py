"""
Job nightly de revalorisation des collections Nautilus.

Revalorise les items dont la dernière valorisation date de plus de
REVALUE_AFTER_DAYS jours (ou qui n'ont jamais été valorisés).

Traite par batch de BATCH_SIZE items pour éviter de surcharger la DB.
Seuls les items avec un artist_id valide sont traités.

Scheduling : celery beat — tous les jours à 4h UTC (voir celery_app.py).
"""

import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, and_, or_

from app.database import AsyncSessionLocal
from app.models.db_models import PortfolioItem
from app.engines.valuation_engine import valuate_item

logger = logging.getLogger(__name__)

# Revaloriser si la dernière valorisation date de plus de N jours
REVALUE_AFTER_DAYS = 30

# Batch size pour éviter de surcharger la DB
BATCH_SIZE = 50


async def revalue_stale_items() -> dict:
    """
    Revalorise les items dont last_valuation_at est NULL ou > REVALUE_AFTER_DAYS jours.

    Utilise last_valuation_at (nom réel de la colonne dans portfolio_items).

    Returns:
        dict avec statistiques d'exécution : processed, valuated, no_data, errors
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=REVALUE_AFTER_DAYS)

    async with AsyncSessionLocal() as db:
        stmt = (
            select(PortfolioItem)
            .where(
                and_(
                    PortfolioItem.artist_id.isnot(None),
                    # Cibler items jamais valorisés ou valorisés il y a plus de N jours
                    or_(
                        PortfolioItem.last_valuation_at.is_(None),
                        PortfolioItem.last_valuation_at < cutoff,
                    ),
                )
            )
            .limit(BATCH_SIZE)
        )
        result = await db.execute(stmt)
        items = result.scalars().all()

        stats = {
            "processed": 0,
            "valuated":  0,
            "no_data":   0,
            "errors":    0,
        }

        logger.info(f"[revalue_job] {len(items)} items à revaloriser (cutoff={cutoff.date()})")

        for item in items:
            stats["processed"] += 1
            try:
                estimation = await valuate_item(db, item, update_item=True)
                confidence = estimation.get("confidence", "none")
                if confidence not in ("none", "error"):
                    stats["valuated"] += 1
                else:
                    stats["no_data"] += 1
            except Exception as e:
                logger.error(f"[revalue_job] error on item {item.id}: {e}", exc_info=True)
                stats["errors"] += 1

        logger.info(f"[revalue_job] done: {stats}")
        return stats
