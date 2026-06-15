"""
Moteur de valorisation de collection Nautilus.

Orchestre l'estimation d'un item via comparable_engine et persiste
le résultat dans collection_valuations pour traçabilité et historique.

RÈGLES :
- Jamais modifier estimated_current_value_eur si confidence='none' ou 'error'
- Toujours créer un CollectionValuation pour traçabilité, même si no_data
- Utiliser last_valuation_at (pas valuation_updated_at) pour le timestamp
- Utiliser year_created (pas year) pour le champ PortfolioItem
- CollectionValuation.collection_item_id (pas item_id)
- CollectionValuation.estimated_value_eur (pas value_eur)
- CollectionValuation.estimation_date (pas valuation_date)
- user_id obligatoire dans CollectionValuation — pris depuis item.user_id
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.db_models import PortfolioItem, CollectionValuation
from app.engines.comparable_engine import find_comparables_and_estimate

logger = logging.getLogger(__name__)

# Identifiant de version du moteur — tracé dans CollectionValuation.source
ENGINE_SOURCE = "nautilus_comparable_engine_v1"

# Confidences pour lesquelles on ne met PAS à jour estimated_current_value_eur
_SKIP_UPDATE_CONFIDENCES = {"none", "error"}


async def valuate_item(
    db: AsyncSession,
    item: PortfolioItem,
    update_item: bool = True,
) -> dict:
    """
    Valorise un item de collection et persiste le résultat en DB.

    Args:
        db: session async SQLAlchemy
        item: objet PortfolioItem à valoriser (doit avoir artist_id)
        update_item: si True, met à jour item.estimated_current_value_eur
                     et item.last_valuation_at si l'estimation est fiable

    Returns:
        dict avec le résultat de l'estimation (même structure que comparable_engine)
    """
    if not item.artist_id:
        logger.warning(f"[valuation_engine] item {item.id} has no artist_id — skipping")
        return {
            "valuation_low":     None,
            "valuation_median":  None,
            "valuation_high":    None,
            "confidence":        "none",
            "confidence_float":  None,
            "comparables_count": 0,
            "method":            "no_artist_id",
            "comparables":       [],
            "warning":           "Œuvre sans artiste identifié — valorisation impossible.",
        }

    logger.info(f"[valuation_engine] valuating item {item.id} (artist_id={item.artist_id})")

    result = await find_comparables_and_estimate(
        db=db,
        artist_id=item.artist_id,
        medium=item.medium,
        dimensions=item.dimensions,
        year_created=item.year_created,   # colonne réelle dans PortfolioItem
    )

    now = datetime.now(timezone.utc)
    median_value = result.get("valuation_median")

    # Persister pour traçabilité et historique
    # CollectionValuation requiert estimated_value_eur non-null — utiliser 0.0 si none
    valuation_record = CollectionValuation(
        collection_item_id=item.id,       # colonne réelle : collection_item_id
        user_id=item.user_id,             # requis par le modèle
        estimated_value_eur=median_value or 0.0,  # colonne réelle : estimated_value_eur
        value_low=result.get("valuation_low"),    # colonne réelle : value_low (sans _eur)
        value_high=result.get("valuation_high"),  # colonne réelle : value_high (sans _eur)
        estimation_date=now,              # colonne réelle : estimation_date
        method=result.get("method"),
        confidence=result.get("confidence_float"),  # colonne Float en DB
        comparables_used=result.get("comparables", []),
        comparables_count=result.get("comparables_count", 0),
        source=ENGINE_SOURCE,
        warning=result.get("warning"),
    )
    db.add(valuation_record)

    # Mettre à jour l'item seulement si l'estimation est fiable
    confidence = result.get("confidence", "none")
    if update_item and confidence not in _SKIP_UPDATE_CONFIDENCES and median_value:
        item.estimated_current_value_eur = median_value
        item.last_valuation_at = now      # colonne réelle : last_valuation_at
        logger.info(
            f"[valuation_engine] item {item.id} → {median_value}€ "
            f"(confidence={confidence}, method={result.get('method')})"
        )

    await db.commit()
    return result


async def valuate_collection(
    db: AsyncSession,
    user_id,
    force: bool = False,
) -> dict:
    """
    Valorise tous les items d'une collection utilisateur.

    Utilisé par :
    - Le job nightly de revalorisation (revalue_collection.py)
    - L'endpoint POST /api/collection/revaluate (futur)

    Args:
        db: session async SQLAlchemy
        user_id: UUID de l'utilisateur
        force: si True, revalorise même les items récemment valorisés

    Returns:
        dict avec statistiques de la revalorisation
    """
    stmt = select(PortfolioItem).where(PortfolioItem.user_id == user_id)
    result = await db.execute(stmt)
    items = result.scalars().all()

    stats = {
        "total": len(items),
        "valuated": 0,
        "skipped_no_artist": 0,
        "skipped_no_data": 0,
        "errors": 0,
        "total_value_eur": 0.0,
    }

    for item in items:
        try:
            estimation = await valuate_item(db, item, update_item=True)
            confidence = estimation.get("confidence", "none")

            if confidence in _SKIP_UPDATE_CONFIDENCES:
                if not item.artist_id:
                    stats["skipped_no_artist"] += 1
                else:
                    stats["skipped_no_data"] += 1
            else:
                stats["valuated"] += 1
                if item.estimated_current_value_eur:
                    stats["total_value_eur"] += float(item.estimated_current_value_eur)

        except Exception as e:
            logger.error(
                f"[valuation_engine] error on item {item.id}: {e}",
                exc_info=True,
            )
            stats["errors"] += 1

    logger.info(
        f"[valuation_engine] collection valuated for user {user_id}: "
        f"{stats['valuated']}/{stats['total']} items, "
        f"total={stats['total_value_eur']:.0f}€"
    )
    return stats
