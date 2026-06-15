"""
Moteur de recherche de comparables pour la valorisation de collection Nautilus.

Requête hammer_prices pour trouver des lots vendus comparables à une œuvre
donnée, en appliquant des filtres successifs avec dégradation gracieuse.

Architecture :
  HammerPrice n'a pas de colonne artist_id. Le lien artiste se fait via
  artist_name_normalized (String). Le moteur commence donc par résoudre
  artist_id → Artist.name_normalized avant de requêter hammer_prices.

  HammerPrice.medium_category est déjà normalisé en DB (paint/print/…),
  ce qui permet un filtre SQL direct sans normalisation Python par ligne.

Hiérarchie de filtres (du plus strict au plus large) :
  Level 1 : artiste + médium (medium_category) + taille ±40% + 24 derniers mois
  Level 2 : artiste + médium + 48 derniers mois (relâche taille)
  Level 3 : artiste seul + 60 derniers mois (tous médiums, toutes tailles)
  Fallback : hammer_artist_medium_stats ou hammer_artist_stats (pré-agrégés)

RÈGLE : Jamais retourner de données inventées.
Si 0 résultat à tous les niveaux → confidence='none', valuation_median=None.
"""

import logging
import math
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import (
    Artist,
    HammerPrice,
    HammerArtistStats,
    HammerArtistMediumStats,
)
from app.utils.normalize import (
    normalize_medium_category,
    parse_dimensions_cm,
    is_size_comparable,
    mediums_are_compatible,
)

logger = logging.getLogger(__name__)

# Nombre minimum de comparables pour chaque niveau de confiance
MIN_COMPARABLES_HIGH = 5
MIN_COMPARABLES_MEDIUM = 3
MIN_COMPARABLES_LOW = 1

# Fenêtres temporelles (jours)
WINDOW_TIGHT = 730    # 24 mois
WINDOW_MEDIUM = 1460  # 48 mois
WINDOW_WIDE = 1825    # 60 mois

# Tolérance de taille relative (±40%)
SIZE_TOLERANCE = 0.40

# Filtre anti-sentinel values : exclure les artistes avec des stats manifestement
# fausses (valeurs injectées lors d'ingestions batch, ex. sale_count=22000)
MAX_PLAUSIBLE_SALE_COUNT = 5000


# ── Helpers statistiques ──────────────────────────────────────────────────────

def _percentile(sorted_data: list[float], p: float) -> float:
    """
    Interpolation linéaire pour le percentile p (0-100) sur liste triée.
    Correcte même sur petites listes (1, 2, 3 éléments).
    """
    n = len(sorted_data)
    if n == 1:
        return sorted_data[0]
    idx = (p / 100) * (n - 1)
    lo = int(idx)
    hi = lo + 1
    if hi >= n:
        return sorted_data[-1]
    frac = idx - lo
    return sorted_data[lo] + frac * (sorted_data[hi] - sorted_data[lo])


def _price_stats(prices: list[float]) -> dict:
    """Calcule P25 (low), P50 (median), P75 (high) avec interpolation linéaire."""
    if not prices:
        return {"valuation_low": None, "valuation_median": None, "valuation_high": None}
    s = sorted(prices)
    return {
        "valuation_low":    round(_percentile(s, 25)),
        "valuation_median": round(_percentile(s, 50)),
        "valuation_high":   round(_percentile(s, 75)),
    }


def _confidence_label(n: int, method: str) -> str:
    """Niveau de confiance basé sur le nombre de comparables et la méthode."""
    if method in ("aggregate_medium_stats", "aggregate_artist_stats"):
        return "low"
    if n >= MIN_COMPARABLES_HIGH:
        return "high"
    if n >= MIN_COMPARABLES_MEDIUM:
        return "medium"
    if n >= MIN_COMPARABLES_LOW:
        return "low"
    return "none"


def _confidence_to_float(label: str) -> Optional[float]:
    """Convertit le label de confiance en float pour la colonne DB (Float)."""
    return {"high": 0.9, "medium": 0.6, "low": 0.3, "none": 0.0, "error": None}.get(label)


# ── Résolution artiste ────────────────────────────────────────────────────────

async def _get_artist_name_normalized(db: AsyncSession, artist_id) -> Optional[str]:
    """
    Résout artist_id (UUID) → Artist.name_normalized.

    HammerPrice n'a pas de colonne artist_id. La jointure artiste se fait
    exclusivement via artist_name_normalized.
    """
    result = await db.execute(
        select(Artist.name_normalized).where(Artist.id == artist_id)
    )
    return result.scalar_one_or_none()


# ── Requête principale hammer_prices ─────────────────────────────────────────

async def _query_hammer_prices(
    db: AsyncSession,
    artist_name_normalized: str,
    medium_category: Optional[str],   # catégorie normalisée, ex: "painting"
    ref_cm2: Optional[float],
    days_back: int,
    apply_size_filter: bool,
    apply_medium_filter: bool,
    year_created: Optional[int] = None,
    year_tolerance: int = 20,
) -> list[dict]:
    """
    Requête interne hammer_prices avec filtres configurables.

    Utilise HammerPrice.medium_category (déjà normalisé en DB) pour le filtre
    médium — évite la normalisation Python ligne par ligne.

    Args:
        artist_name_normalized: clé de jointure vers hammer_prices
        medium_category: catégorie canonique (normalize_medium_category output)
        ref_cm2: surface de référence en cm²
        days_back: fenêtre temporelle (ventes des N derniers jours)
        apply_size_filter: activer le filtre ±40% de surface
        apply_medium_filter: activer le filtre par catégorie de médium
        year_created: année de création de l'œuvre de référence.
                      Si fourni, restreint les comparables à ±year_tolerance ans
                      autour de l'année de création (pas de vente) pour éviter
                      de comparer des œuvres de périodes stylistiques différentes.
        year_tolerance: fenêtre ±N ans autour de year_created (défaut ±20)
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days_back)

    conditions = [
        HammerPrice.artist_name_normalized == artist_name_normalized,
        HammerPrice.hammer_price_eur.isnot(None),
        HammerPrice.hammer_price_eur > 0,
        HammerPrice.sale_date >= cutoff_date,
    ]

    # Filtre médium via medium_category (déjà normalisé en DB)
    if apply_medium_filter and medium_category and medium_category != "other":
        conditions.append(HammerPrice.medium_category == medium_category)

    # Filtre période de création (±year_tolerance autour de year_created)
    if year_created is not None:
        conditions.append(HammerPrice.year_created >= year_created - year_tolerance)
        conditions.append(HammerPrice.year_created <= year_created + year_tolerance)

    stmt = (
        select(
            HammerPrice.id,
            HammerPrice.hammer_price_eur,
            HammerPrice.medium,
            HammerPrice.medium_category,
            HammerPrice.dimensions,      # colonne réelle : 'dimensions' (pas dimensions_cm)
            HammerPrice.sale_date,
            HammerPrice.auction_house,
            HammerPrice.year_created,
        )
        .where(and_(*conditions))
        .order_by(HammerPrice.sale_date.desc())
        .limit(200)  # cap pour éviter les requêtes trop larges
    )

    result = await db.execute(stmt)
    rows = result.fetchall()

    candidates = []
    for row in rows:
        # Filtre taille : calculé en Python car dimensions stockées en String brut
        if apply_size_filter and ref_cm2 is not None:
            dim = parse_dimensions_cm(row.dimensions)
            lot_cm2 = dim.get("area_cm2")
            if lot_cm2 is not None and not is_size_comparable(ref_cm2, lot_cm2, SIZE_TOLERANCE):
                continue

        candidates.append({
            "lot_id": str(row.id),
            "hammer_price_eur": float(row.hammer_price_eur),
            "medium": row.medium,
            "medium_category": row.medium_category,
            "dimensions": row.dimensions,
            "sale_date": row.sale_date.isoformat() if row.sale_date else None,
            "auction_house": row.auction_house,
            "year_created": row.year_created,
        })

    return candidates


# ── Fallback stats pré-agrégées ───────────────────────────────────────────────

async def _fallback_aggregate_stats(
    db: AsyncSession,
    artist_name_normalized: str,
    medium_category: Optional[str],
) -> Optional[dict]:
    """
    Fallback sur les stats pré-agrégées si aucun comparable individuel trouvé.

    Essaie hammer_artist_medium_stats (plus précis) puis hammer_artist_stats.

    RÈGLE ANTI-SENTINEL : filtre sale_count < MAX_PLAUSIBLE_SALE_COUNT.
    Les valeurs like sale_count=22000 sont des artefacts d'ingestion batch.
    """
    # Tentative 1 : stats par médium (hammer_artist_medium_stats)
    if medium_category and medium_category != "other":
        stmt = select(HammerArtistMediumStats).where(
            and_(
                HammerArtistMediumStats.artist_name_normalized == artist_name_normalized,
                HammerArtistMediumStats.medium_category == medium_category,
                HammerArtistMediumStats.sale_count > 0,
                # Anti-sentinel : exclut les valeurs manifestement fausses injectées par batch
                HammerArtistMediumStats.sale_count < MAX_PLAUSIBLE_SALE_COUNT,
                HammerArtistMediumStats.median_eur.isnot(None),
            )
        )
        result = await db.execute(stmt)
        stats = result.scalar_one_or_none()

        if stats and stats.median_eur and stats.median_eur > 0:
            median = float(stats.median_eur)
            return {
                "valuation_low":      round(median * 0.70),
                "valuation_median":   round(median),
                "valuation_high":     round(median * 1.35),
                "confidence":         "low",
                "confidence_float":   0.3,
                "comparables_count":  int(stats.sale_count),
                "method":             "aggregate_medium_stats",
                "comparables":        [],
                "warning": (
                    "Estimation basée sur des statistiques agrégées par médium, "
                    "non sur des comparables individuels."
                ),
            }

    # Tentative 2 : stats artiste global (hammer_artist_stats)
    stmt = select(HammerArtistStats).where(
        and_(
            HammerArtistStats.artist_name_normalized == artist_name_normalized,
            HammerArtistStats.sale_count > 0,
            # Anti-sentinel : exclut les valeurs manifestement fausses injectées par batch
            HammerArtistStats.sale_count < MAX_PLAUSIBLE_SALE_COUNT,
            HammerArtistStats.median_eur.isnot(None),
        )
    )
    result = await db.execute(stmt)
    stats = result.scalar_one_or_none()

    if stats and stats.median_eur and stats.median_eur > 0:
        median = float(stats.median_eur)
        return {
            "valuation_low":      round(median * 0.65),
            "valuation_median":   round(median),
            "valuation_high":     round(median * 1.40),
            "confidence":         "low",
            "confidence_float":   0.3,
            "comparables_count":  int(stats.sale_count),
            "method":             "aggregate_artist_stats",
            "comparables":        [],
            "warning": (
                "Estimation basée sur la médiane globale de l'artiste (tous médiums). "
                "Précision limitée."
            ),
        }

    return None


# ── Fonction principale ────────────────────────────────────────────────────────

async def find_comparables_and_estimate(
    db: AsyncSession,
    artist_id,
    medium: Optional[str] = None,
    dimensions: Optional[str] = None,
    year_created: Optional[int] = None,
) -> dict:
    """
    Fonction principale du moteur de comparable.

    Cherche des comparables par niveaux de filtres successifs et retourne
    une estimation avec fourchette de prix et niveau de confiance.

    Args:
        db: session async SQLAlchemy
        artist_id: UUID de l'artiste en DB (FK valide vers artists.id)
        medium: chaîne de médium libre (ex: "huile sur toile")
        dimensions: chaîne de dimensions libre (ex: "80 x 60 cm")
        year_created: année de création de l'œuvre (restreint comparables
                      à la même période stylistique ±20 ans)

    Returns:
        dict avec valuation_low, valuation_median, valuation_high,
        confidence (str), confidence_float (float), comparables_count,
        method, comparables (list), warning (str|None).

    GARANTIE : Ne lève jamais d'exception. Retourne toujours un dict valide.
    Si aucune donnée → valuation_median=None, confidence='none'.
    """
    try:
        # Résoudre artist_id → artist_name_normalized (clé hammer_prices)
        artist_name_normalized = await _get_artist_name_normalized(db, artist_id)
        if not artist_name_normalized:
            logger.warning(f"[comparable_engine] artist_id={artist_id} not found in artists table")
            return _no_data_result("Artiste non trouvé en base de données.")

        # Normaliser le médium et calculer la surface
        medium_category = normalize_medium_category(medium) if medium else None
        dim = parse_dimensions_cm(dimensions) if dimensions else {}
        ref_cm2 = dim.get("area_cm2") if dim else None

        logger.info(
            f"[comparable_engine] artist_name_normalized='{artist_name_normalized}', "
            f"medium='{medium}' → '{medium_category}', "
            f"dimensions='{dimensions}' → {ref_cm2}cm²"
        )

        # ── Level 1 : médium + taille + 24 mois (filtre le plus strict) ─────────
        if medium_category and medium_category != "other" and ref_cm2:
            lots = await _query_hammer_prices(
                db, artist_name_normalized, medium_category, ref_cm2,
                days_back=WINDOW_TIGHT,
                apply_size_filter=True,
                apply_medium_filter=True,
                year_created=year_created,
            )
            if len(lots) >= MIN_COMPARABLES_LOW:
                prices = [l["hammer_price_eur"] for l in lots]
                stats = _price_stats(prices)
                confidence = _confidence_label(len(lots), "comparable_lots")
                logger.info(f"[comparable_engine] Level 1 match: {len(lots)} comparables")
                return {
                    **stats,
                    "confidence":        confidence,
                    "confidence_float":  _confidence_to_float(confidence),
                    "comparables_count": len(lots),
                    "method":            "comparable_lots_strict",
                    "comparables":       lots[:10],
                    "warning":           None,
                }

        # ── Level 2 : médium + 48 mois (relâche filtre taille) ──────────────────
        if medium_category and medium_category != "other":
            lots = await _query_hammer_prices(
                db, artist_name_normalized, medium_category, ref_cm2,
                days_back=WINDOW_MEDIUM,
                apply_size_filter=False,
                apply_medium_filter=True,
                year_created=year_created,
            )
            if len(lots) >= MIN_COMPARABLES_LOW:
                prices = [l["hammer_price_eur"] for l in lots]
                stats = _price_stats(prices)
                confidence = _confidence_label(len(lots), "comparable_lots")
                logger.info(f"[comparable_engine] Level 2 match: {len(lots)} comparables")
                return {
                    **stats,
                    "confidence":        confidence,
                    "confidence_float":  _confidence_to_float(confidence),
                    "comparables_count": len(lots),
                    "method":            "comparable_lots_medium_only",
                    "comparables":       lots[:10],
                    "warning": (
                        "Taille non prise en compte — peu de ventes de format "
                        "similaire disponibles sur 48 mois."
                    ),
                }

        # ── Level 3 : artiste seul + 60 mois ────────────────────────────────────
        lots = await _query_hammer_prices(
            db, artist_name_normalized, None, None,
            days_back=WINDOW_WIDE,
            apply_size_filter=False,
            apply_medium_filter=False,
        )
        if len(lots) >= MIN_COMPARABLES_LOW:
            prices = [l["hammer_price_eur"] for l in lots]
            stats = _price_stats(prices)
            confidence = _confidence_label(len(lots), "comparable_lots")
            logger.info(f"[comparable_engine] Level 3 match: {len(lots)} comparables")
            return {
                **stats,
                "confidence":        confidence,
                "confidence_float":  _confidence_to_float(confidence),
                "comparables_count": len(lots),
                "method":            "comparable_lots_artist_only",
                "comparables":       lots[:10],
                "warning": (
                    "Médium et taille non pris en compte — estimation basée sur "
                    "toutes les ventes disponibles de l'artiste."
                ),
            }

        # ── Fallback : stats pré-agrégées ────────────────────────────────────────
        fallback = await _fallback_aggregate_stats(
            db, artist_name_normalized, medium_category
        )
        if fallback:
            logger.info(f"[comparable_engine] Fallback: {fallback['method']}")
            return fallback

        # ── Aucune donnée disponible ──────────────────────────────────────────────
        logger.warning(
            f"[comparable_engine] No data for artist '{artist_name_normalized}' "
            f"(artist_id={artist_id})"
        )
        return _no_data_result(
            "Aucune donnée de vente disponible pour cet artiste. Estimation impossible."
        )

    except Exception as e:
        logger.error(
            f"[comparable_engine] Unexpected error for artist_id={artist_id}: {e}",
            exc_info=True,
        )
        return {
            "valuation_low":     None,
            "valuation_median":  None,
            "valuation_high":    None,
            "confidence":        "none",
            "confidence_float":  None,
            "comparables_count": 0,
            "method":            "error",
            "comparables":       [],
            "warning":           "Erreur interne lors de l'estimation.",
        }


def _no_data_result(warning: str) -> dict:
    return {
        "valuation_low":     None,
        "valuation_median":  None,
        "valuation_high":    None,
        "confidence":        "none",
        "confidence_float":  None,
        "comparables_count": 0,
        "method":            "no_data",
        "comparables":       [],
        "warning":           warning,
    }
