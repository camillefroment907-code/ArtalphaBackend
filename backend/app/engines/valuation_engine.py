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
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.db_models import PortfolioItem, CollectionValuation
from app.engines.comparable_engine import (
    find_comparables_and_estimate,
    find_comparables_by_category,
)

logger = logging.getLogger(__name__)

# Identifiant de version du moteur — tracé dans CollectionValuation.source
ENGINE_SOURCE = "nautilus_comparable_engine_v1"

# Confidences pour lesquelles on ne met PAS à jour estimated_current_value_eur
_SKIP_UPDATE_CONFIDENCES = {"none", "error"}


# ── Claude helpers ─────────────────────────────────────────────────────────────

async def _claude_review_estimate(
    result: dict,
    item_context: dict,
) -> dict:
    """
    Claude Sonnet reviewer — appelé UNIQUEMENT sur des comparables réels.
    Contextualise et explique l'estimation pour le collectionneur.
    Ne modifie JAMAIS valuation_low/median/high.
    Ne lève jamais d'exception.

    Skip automatique si :
    - confidence == 'high' ET comparables_count >= 20
      (estimation déjà très fiable, Claude n'apporte pas de valeur)
    - pas de valuation_median
    - method contient 'llm_inference' (déjà un appel Claude)
    """
    try:
        median = result.get("valuation_median")
        if not median:
            return result

        method = result.get("method", "")
        if "llm_inference" in method:
            return result

        count      = result.get("comparables_count", 0)
        confidence = result.get("confidence", "none")
        if confidence == "high" and count >= 20:
            logger.info(
                f"[valuation_engine] claude review skipped "
                f"(high confidence, {count} comparables)"
            )
            return result

        from anthropic import AsyncAnthropic
        from app.config import settings
        import json

        if not settings.anthropic_api_key:
            return result

        low  = result.get("valuation_low")
        high = result.get("valuation_high")

        context_parts = []
        if item_context.get("artist_name"):
            context_parts.append(f"Artiste : {item_context['artist_name']}")
        if item_context.get("medium"):
            context_parts.append(f"Médium : {item_context['medium']}")
        if item_context.get("dimensions"):
            context_parts.append(f"Dimensions : {item_context['dimensions']}")
        if item_context.get("year_created"):
            context_parts.append(f"Année : {item_context['year_created']}")
        if item_context.get("style"):
            context_parts.append(f"Style : {item_context['style']}")
        if item_context.get("period"):
            context_parts.append(f"Période : {item_context['period']}")
        if item_context.get("signature_detected"):
            context_parts.append("Signature : détectée sur la photo")
        if item_context.get("certificate_detected"):
            context_parts.append("Certificat : détecté sur la photo")

        context = "\n".join(context_parts) if context_parts else "Informations limitées"

        prompt = f"""Tu es un expert du marché de l'art aux enchères.

Œuvre à évaluer :
{context}

Estimation calculée par notre moteur de comparables :
- Fourchette : {low} € — {high} €
- Valeur médiane : {median} €
- Basée sur {count} vente(s) comparable(s)
- Méthode : {method}

Ta mission :
1. Vérifier si la fourchette est cohérente avec le contexte
2. Générer une explication courte et claire pour le collectionneur

Réponds UNIQUEMENT avec ce JSON, sans texte avant ou après :
{{
  "coherent": true,
  "collector_explanation": "<2 phrases en français expliquant la fourchette>",
  "confidence_note": "<note courte sur la fiabilité>",
  "possible_outlier": false,
  "outlier_reason": "<si possible_outlier true : une phrase expliquant l'anomalie, sinon null>"
}}"""

        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=384,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        review = json.loads(raw)
        result["claude_explanation"] = review.get("collector_explanation")
        result["confidence_note"]    = review.get("confidence_note")
        result["possible_outlier"]   = review.get("possible_outlier", False)
        result["outlier_reason"]     = review.get("outlier_reason")
        result["generated_by"]       = "Nautilus Intelligence"

        return result

    except Exception as e:
        logger.warning(f"[valuation_engine] claude review failed: {e}")
        return result


async def _claude_fallback_estimate(
    medium: Optional[str],
    year_created: Optional[int],
    artist_name: Optional[str],
    dimensions: Optional[str],
) -> dict:
    """
    Claude Sonnet estimateur indicatif — appelé UNIQUEMENT quand
    aucun comparable n'est disponible (ni artiste, ni catégorie).
    Retourne directement sans passer par _claude_review_estimate.
    Ne lève jamais d'exception.
    """
    try:
        from anthropic import AsyncAnthropic
        from app.config import settings
        import json
        import math

        if not settings.anthropic_api_key:
            return _no_estimate_result("llm_inference_no_key")

        context_parts = []
        if artist_name and artist_name not in ("Artiste inconnu", "Unknown", ""):
            context_parts.append(f"Artiste : {artist_name}")
        if medium:
            context_parts.append(f"Médium / technique : {medium}")
        if dimensions:
            context_parts.append(f"Dimensions : {dimensions}")
        if year_created:
            context_parts.append(f"Année approximative : {year_created}")

        if not context_parts:
            return _no_estimate_result("llm_inference_no_context")

        context = "\n".join(context_parts)

        prompt = f"""Tu es un expert du marché de l'art aux enchères européennes.

Œuvre non attribuée avec les informations suivantes :
{context}

Aucune vente comparable n'est disponible dans notre base de données.
Donne une fourchette de valeur indicative et très prudente.

Règles :
- Sois très conservateur
- Fourchette large si informations insuffisantes
- Ne refuse jamais de répondre
- Valeurs en euros entiers

Réponds UNIQUEMENT avec ce JSON :
{{
  "valuation_low": <entier euros>,
  "valuation_high": <entier euros>,
  "uncertainty_reason": "<une phrase en français>"
}}"""

        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=256,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        data  = json.loads(raw)
        low   = int(data.get("valuation_low", 0))
        high  = int(data.get("valuation_high", 0))

        if not low or not high or low <= 0 or high <= 0:
            return _no_estimate_result("llm_inference_invalid")

        median  = int(math.sqrt(low * high))
        warning = data.get("uncertainty_reason", "Estimation indicative.")

        return {
            "valuation_low":     low,
            "valuation_median":  median,
            "valuation_high":    high,
            "confidence":        "low",
            "confidence_float":  0.20,
            "comparables_count": 0,
            "method":            "llm_inference",
            "comparables":       [],
            "warning":           f"Estimation indicative (IA) — {warning}",
            "generated_by":      "Nautilus Intelligence",
        }

    except Exception as e:
        logger.warning(f"[valuation_engine] claude fallback failed: {e}")
        return _no_estimate_result("llm_inference_error")


def _no_estimate_result(method: str) -> dict:
    return {
        "valuation_low":     None,
        "valuation_median":  None,
        "valuation_high":    None,
        "confidence":        "none",
        "confidence_float":  None,
        "comparables_count": 0,
        "method":            method,
        "comparables":       [],
        "warning":           "Estimation indisponible pour cette œuvre.",
    }


# ── Valorisation d'un item ─────────────────────────────────────────────────────

async def valuate_item(
    db: AsyncSession,
    item: PortfolioItem,
    update_item: bool = True,
) -> dict:
    """
    Valorise un item de collection et persiste le résultat en DB.

    Args:
        db: session async SQLAlchemy
        item: objet PortfolioItem à valoriser
        update_item: si True, met à jour item.estimated_current_value_eur
                     et item.last_valuation_at si l'estimation est fiable

    Returns:
        dict avec le résultat de l'estimation (même structure que comparable_engine)
    """
    if not item.artist_id:
        logger.info(
            f"[valuation_engine] item {item.id} no artist_id "
            f"— trying category comparables then llm fallback"
        )

        from app.utils.normalize import normalize_medium_category
        medium_category = (
            normalize_medium_category(item.medium) if item.medium else None
        )

        # Étape 1 : comparables par catégorie
        result = await find_comparables_by_category(
            db=db,
            medium_category=medium_category,
            year_created=item.year_created,
        )

        # Étape 2 : Claude review si comparables trouvés
        if result.get("valuation_median") and result.get("confidence") != "none":
            result = await _claude_review_estimate(
                result=result,
                item_context={
                    "artist_name":          item.artist_name,
                    "medium":               item.medium,
                    "dimensions":           item.dimensions,
                    "year_created":         item.year_created,
                    "style":                getattr(item, "style", None),
                    "period":               getattr(item, "period", None),
                    "signature_detected":   getattr(item, "signature_detected", None),
                    "certificate_detected": getattr(item, "certificate_detected", None),
                },
            )

        # Étape 3 : Claude fallback si toujours rien
        elif result.get("confidence") == "none":
            result = await _claude_fallback_estimate(
                medium=item.medium,
                year_created=item.year_created,
                artist_name=item.artist_name,
                dimensions=item.dimensions,
            )
            # Pas de review après fallback — retour direct

        # Persister uniquement si valeur réelle > 0
        now          = datetime.utcnow()
        median_value = result.get("valuation_median")

        if median_value and median_value > 0:
            valuation_record = CollectionValuation(
                collection_item_id=item.id,
                user_id=item.user_id,
                estimated_value_eur=median_value,
                value_low=result.get("valuation_low"),
                value_high=result.get("valuation_high"),
                estimation_date=now,
                method=result.get("method"),
                confidence=result.get("confidence_float"),
                comparables_used=[],
                comparables_count=result.get("comparables_count", 0),
                source=ENGINE_SOURCE,
                warning=result.get("warning"),
            )
            db.add(valuation_record)

            if update_item:
                item.estimated_current_value_eur = median_value
                item.last_valuation_at           = now
                logger.info(
                    f"[valuation_engine] item {item.id} → {median_value}€ "
                    f"(method={result.get('method')})"
                )

            await db.commit()

        return result

    logger.info(f"[valuation_engine] valuating item {item.id} (artist_id={item.artist_id})")

    result = await find_comparables_and_estimate(
        db=db,
        artist_id=item.artist_id,
        medium=item.medium,
        dimensions=item.dimensions,
        year_created=item.year_created,   # colonne réelle dans PortfolioItem
    )

    # Claude review — uniquement sur comparables réels, skip si haute confiance
    if result.get("valuation_median"):
        result = await _claude_review_estimate(
            result=result,
            item_context={
                "artist_name":          item.artist_name,
                "medium":               item.medium,
                "dimensions":           item.dimensions,
                "year_created":         item.year_created,
                "style":                getattr(item, "style", None),
                "period":               getattr(item, "period", None),
                "signature_detected":   getattr(item, "signature_detected", None),
                "certificate_detected": getattr(item, "certificate_detected", None),
            },
        )

    now = datetime.utcnow()
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


# ── Valorisation d'une collection ──────────────────────────────────────────────

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
