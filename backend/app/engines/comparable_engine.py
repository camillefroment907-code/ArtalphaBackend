"""
Moteur de recherche de comparables pour la valorisation de collection Nautilus.
v2 — Philosophie : estimations crédibles uniquement, jamais de fourchette trompeuse.

Architecture :
  Une seule requête large (artiste + médium + 60 mois), suivie d'un pipeline
  de scoring et de sélection. Aucune dégradation progressive de filtres.

Pipeline :
  1. Requête : artiste + medium_category (obligatoire si connu) + 60 mois
  2. Score de similarité (0–100) par lot :
       Medium specificity  30 pts
       Dimensions          25 pts
       Période création    25 pts
       Récence             20 pts
  3. Filtre : score ≥ SCORE_FLOOR
  4. Contrôle qualité : avg_score ≥ MIN_AVG_SCORE,
       ET si avg_score < STD_DEV_THRESHOLD → score_std_dev ≤ MAX_STD_DEV_BORDERLINE
  5. Minimum MIN_COMPARABLES lots retenus
  6. Statistiques P25/P50/P75 sur les TOP_N_FOR_STATS meilleurs lots
  7. Retour riche : estimation + métadonnées + explication lisible

RÈGLE : Si les conditions 3–5 ne sont pas toutes satisfaites → confidence='none',
        valuation_median=None. Jamais une fourchette peu crédible.
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
    HammerArtistMediumStats,
)
from app.utils.normalize import (
    normalize_medium_category,
    parse_dimensions_cm,
)

logger = logging.getLogger(__name__)

# ── Paramètres calibrables ────────────────────────────────────────────────────

# Score individuel minimum pour qu'un lot soit admis comme comparable
SCORE_FLOOR = 35

# Score moyen minimum sur l'ensemble des lots admis
MIN_AVG_SCORE = 40

# Si avg_score < STD_DEV_THRESHOLD, l'écart-type doit rester ≤ MAX_STD_DEV_BORDERLINE
STD_DEV_THRESHOLD = 55
MAX_STD_DEV_BORDERLINE = 20

# Nombre minimum de lots admis pour produire une estimation
MIN_COMPARABLES = 3

# Nombre de lots (triés par score desc) utilisés pour calculer P25/P50/P75
TOP_N_FOR_STATS = 15

# Fenêtre temporelle unique (60 mois)
WINDOW_MAX = 1825

# Filtre anti-sentinel values
MAX_PLAUSIBLE_SALE_COUNT = 5000


# ── Helpers statistiques ──────────────────────────────────────────────────────

def _percentile(sorted_data: list[float], p: float) -> float:
    """Interpolation linéaire pour le percentile p (0-100) sur liste triée."""
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


def _confidence_to_float(label: str) -> Optional[float]:
    return {"high": 0.9, "medium": 0.6, "low": 0.3, "none": 0.0, "error": None}.get(label)


def _confidence_label(n: int, avg_score: float) -> str:
    """Niveau de confiance basé sur le nombre de comparables et leur score moyen."""
    if n >= 5 and avg_score >= 65:
        return "high"
    if n >= 3 and avg_score >= 50:
        return "medium"
    if n >= 3 and avg_score >= 40:
        return "low"
    return "none"


def _quality_label(avg_score: float) -> str:
    """Label lisible du niveau de qualité des comparables."""
    if avg_score >= 70:
        return "excellent"
    if avg_score >= 55:
        return "bon"
    if avg_score >= 40:
        return "moyen"
    return "faible"


# ── Comparaison de médium ─────────────────────────────────────────────────────

_MEDIUM_STOP_WORDS = frozenset({
    "sur", "on", "à", "a", "en", "de", "du", "la", "le", "les",
    "un", "une", "des", "and", "et", "with", "avec", "the",
})

# Table de traduction vers un token canonique (FR/EN → canonical)
_MEDIUM_TRANSLATIONS: dict[str, str] = {
    # Peintures / techniques
    "huile": "oil",          "acrylique": "acrylic",    "aquarelle": "watercolor",
    "watercolour": "watercolor",
    "gouache": "gouache",    "tempera": "tempera",       "pastel": "pastel",
    "crayon": "pencil",      "charbon": "charcoal",      "charcoal": "charcoal",
    "encre": "ink",          "technique": "mixed",       "mixte": "mixed",
    "media": "mixed",
    # Estampes
    "gravure": "print",      "estampe": "print",         "lithographie": "lithograph",
    "lithograph": "lithograph",
    "sérigraphie": "silkscreen", "screenprint": "silkscreen",
    "xylographie": "woodcut",    "woodcut": "woodcut",
    # Supports
    "toile": "canvas",       "panneau": "panel",         "papier": "paper",
    "bois": "wood",          "carton": "cardboard",      "soie": "silk",
    "cuivre": "copper",      "zinc": "zinc",
    # Sculpture / volumes
    "bronze": "bronze",      "marbre": "marble",         "plâtre": "plaster",
    "plaster": "plaster",    "fonte": "cast",            "résine": "resin",
    "resin": "resin",        "ceramic": "ceramic",       "céramique": "ceramic",
    "terre": "terracotta",   "terracotta": "terracotta",
}


def _medium_tokens(medium: str) -> frozenset:
    """Extrait les tokens canoniques d'un médium (multilingue FR/EN)."""
    tokens = set()
    for word in medium.lower().split():
        word = word.strip(".,;:()")
        if len(word) <= 2 or word in _MEDIUM_STOP_WORDS:
            continue
        tokens.add(_MEDIUM_TRANSLATIONS.get(word, word))
    return frozenset(tokens)


def _medium_score_pts(ref_medium: str, lot_medium: Optional[str]) -> float:
    """
    Score de comparaison entre le médium de référence et le médium du lot (0–30 pts).

      ≥ 0.5 Jaccard (même médium, ex: "huile sur toile" ↔ "oil on canvas") → 30
      ≥ 0.2 Jaccard (médium proche, ex: "huile" ↔ "acrylique sur toile")   → 20
      < 0.2 Jaccard (médium différent dans la même catégorie)               → 10
      lot_medium absent (lot non décrit)                                     →  8
    """
    if not lot_medium:
        return 8

    ref_tokens = _medium_tokens(ref_medium)
    lot_tokens = _medium_tokens(lot_medium)

    if not ref_tokens or not lot_tokens:
        return 10

    union = ref_tokens | lot_tokens
    jaccard = len(ref_tokens & lot_tokens) / len(union)

    if jaccard >= 0.5:
        return 30
    elif jaccard >= 0.2:
        return 20
    else:
        return 10


# ── Scoring ───────────────────────────────────────────────────────────────────

def _score_comparable(
    lot: dict,
    ref_medium: Optional[str],
    ref_cm2: Optional[float],
    ref_year: Optional[int],
) -> float:
    """
    Score de similarité normalisé (0–100).

    Normalisation : le score est calculé sur les critères réellement évaluables
    (les deux côtés ont la donnée). Les critères sans données disponibles ne
    contribuent ni positivement ni négativement — ils sont exclus du dénominateur.

    Exception medium : si la référence a un médium mais que le lot n'en a pas,
    le critère reste actif avec un score réduit (lot non décrit en catalogue).
    """
    raw_score = 0.0
    available_weight = 0.0

    # ── Medium (30 pts) ──────────────────────────────────────────────────
    # Toujours compté si la référence a un médium (même si le lot n'en a pas).
    if ref_medium:
        available_weight += 30
        raw_score += _medium_score_pts(ref_medium, lot.get("medium"))

    # ── Dimensions (25 pts) — uniquement si les deux côtés ont la donnée ─
    if ref_cm2 is not None and ref_cm2 > 0:
        lot_dims = lot.get("dimensions")
        if lot_dims:
            dim = parse_dimensions_cm(lot_dims)
            lot_cm2 = dim.get("area_cm2")
            if lot_cm2 and lot_cm2 > 0:
                available_weight += 25
                ratio = abs(lot_cm2 - ref_cm2) / ref_cm2
                if ratio <= 0.15:
                    raw_score += 25
                elif ratio <= 0.25:
                    raw_score += 20
                elif ratio <= 0.40:
                    raw_score += 12
                elif ratio <= 0.60:
                    raw_score += 5
                # > 60% : 0 pts, mais le poids est compté (pénalité réelle)

    # ── Période de création (25 pts) — uniquement si les deux côtés ont la donnée
    if ref_year is not None:
        lot_year = lot.get("year_created")
        if lot_year is not None:
            available_weight += 25
            delta = abs(int(lot_year) - ref_year)
            if delta <= 5:
                raw_score += 25
            elif delta <= 10:
                raw_score += 20
            elif delta <= 20:
                raw_score += 12
            elif delta <= 30:
                raw_score += 5
            # > 30 ans : 0 pts, mais le poids est compté (pénalité réelle)

    # ── Récence (20 pts) — toujours disponible ───────────────────────────
    available_weight += 20
    sale_date = lot.get("sale_date")
    if sale_date:
        months_ago = (datetime.utcnow() - sale_date).days / 30.44
        if months_ago < 12:
            raw_score += 20
        elif months_ago < 24:
            raw_score += 15
        elif months_ago < 36:
            raw_score += 9
        elif months_ago < 48:
            raw_score += 4
        else:
            raw_score += 1

    if available_weight == 0:
        return 0.0

    return (raw_score / available_weight) * 100


# ── Génération de l'explication lisible ──────────────────────────────────────

def _build_explanation(
    n: int,
    ref_medium: Optional[str],
    medium_category: Optional[str],
    year_range: Optional[list],
    sale_date_range: Optional[list],
    has_dims: bool,
) -> str:
    """
    Génère une phrase explicative pour le frontend.

    Ex: "Basé sur 7 huiles sur toile comparables, créés entre 1985 et 1993,
         vendus entre juin 2022 et jan. 2025, de formats similaires."
    """
    _MONTHS_FR = ["", "jan.", "fév.", "mars", "avr.", "mai", "juin",
                  "juil.", "août", "sep.", "oct.", "nov.", "déc."]

    def _fmt_ym(ym: str) -> str:
        try:
            y, m = ym.split("-")
            return f"{_MONTHS_FR[int(m)]} {y}"
        except Exception:
            return ym

    pl = "s" if n > 1 else ""
    medium_label = ref_medium or medium_category or "œuvre"
    parts = [f"Basé sur {n} {medium_label} comparable{pl}"]

    if year_range:
        if year_range[0] == year_range[1]:
            parts.append(f"créé{pl} en {year_range[0]}")
        else:
            parts.append(f"créé{pl} entre {year_range[0]} et {year_range[1]}")

    if sale_date_range:
        d0 = _fmt_ym(sale_date_range[0])
        d1 = _fmt_ym(sale_date_range[1])
        if sale_date_range[0] == sale_date_range[1]:
            parts.append(f"vendu{pl} en {d0}")
        else:
            parts.append(f"vendu{pl} entre {d0} et {d1}")

    if has_dims:
        parts.append("de formats similaires")

    return ", ".join(parts) + "."


# ── Formatage de la sortie comparables ───────────────────────────────────────

def _lot_to_output(lot: dict) -> dict:
    """Convertit un lot interne (sale_date = datetime) en dict API."""
    sale_date = lot.get("sale_date")
    return {
        "id":               lot.get("lot_id"),
        "hammer_price_eur": lot["hammer_price_eur"],
        "medium":           lot.get("medium"),
        "medium_category":  lot.get("medium_category"),
        "dimensions":       lot.get("dimensions"),
        "sale_date":        sale_date.isoformat() if sale_date else None,
        "auction_house":    lot.get("auction_house"),
        "year_created":     lot.get("year_created"),
        "score":            lot.get("score"),
    }


# ── Résolution artiste ────────────────────────────────────────────────────────

async def _get_artist_name_normalized(db: AsyncSession, artist_id) -> Optional[str]:
    """Résout artist_id (UUID) → Artist.name_normalized."""
    result = await db.execute(
        select(Artist.name_normalized).where(Artist.id == artist_id)
    )
    return result.scalar_one_or_none()


# ── Requête hammer_prices ─────────────────────────────────────────────────────

async def _query_hammer_prices(
    db: AsyncSession,
    artist_name_normalized: str,
    medium_category: Optional[str],
    days_back: int,
) -> list[dict]:
    """
    Requête unique : artiste + médium (si connu) + fenêtre temporelle.

    medium_category est un filtre permanent : jamais relâché si fourni.
    sale_date est retourné comme objet datetime (pour le scoring de récence).
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days_back)
    EXCLUDED_CURRENCIES = ('KRW', 'INR', 'CNY', 'HUF', 'TWD', 'NGN', 'PHP')
    SEK_SENTINEL_VALUE = 276.0

    conditions = [
        HammerPrice.artist_name_normalized == artist_name_normalized,
        HammerPrice.hammer_price_eur.isnot(None),
        HammerPrice.hammer_price_eur >= 50,
        HammerPrice.hammer_price_eur <= 15_000_000,
        HammerPrice.sale_date >= cutoff_date,
        HammerPrice.currency.notin_(EXCLUDED_CURRENCIES),
        ~(
            (HammerPrice.currency == 'SEK') &
            (HammerPrice.hammer_price_eur == SEK_SENTINEL_VALUE)
        ),
    ]

    if medium_category and medium_category != "other":
        conditions.append(HammerPrice.medium_category == medium_category)

    stmt = (
        select(
            HammerPrice.id,
            HammerPrice.hammer_price_eur,
            HammerPrice.medium,
            HammerPrice.medium_category,
            HammerPrice.dimensions,
            HammerPrice.sale_date,
            HammerPrice.auction_house,
            HammerPrice.year_created,
        )
        .where(and_(*conditions))
        .order_by(HammerPrice.sale_date.desc())
        .limit(200)
    )

    result = await db.execute(stmt)
    rows = result.fetchall()

    return [
        {
            "lot_id":           str(row.id),
            "hammer_price_eur": float(row.hammer_price_eur),
            "medium":           row.medium,
            "medium_category":  row.medium_category,
            "dimensions":       row.dimensions,
            "sale_date":        row.sale_date,   # datetime pour scoring
            "auction_house":    row.auction_house,
            "year_created":     row.year_created,
        }
        for row in rows
    ]


# ── Fallback stats pré-agrégées ───────────────────────────────────────────────

async def _fallback_aggregate_stats(
    db: AsyncSession,
    artist_name_normalized: str,
    medium_category: Optional[str],
) -> Optional[dict]:
    """
    Fallback sur hammer_artist_medium_stats uniquement (filtré par médium).

    Le fallback hammer_artist_stats (tous médiums confondus) est supprimé :
    mélanger des médiums hétérogènes produit des médianes non-interprétables.
    """
    if not medium_category or medium_category == "other":
        return None

    stmt = select(HammerArtistMediumStats).where(
        and_(
            HammerArtistMediumStats.artist_name_normalized == artist_name_normalized,
            HammerArtistMediumStats.medium_category == medium_category,
            HammerArtistMediumStats.sale_count > 0,
            HammerArtistMediumStats.sale_count < MAX_PLAUSIBLE_SALE_COUNT,
            HammerArtistMediumStats.median_eur.isnot(None),
        )
    )
    result = await db.execute(stmt)
    stats = result.scalar_one_or_none()

    if not stats or not stats.median_eur or stats.median_eur <= 0:
        return None

    median = float(stats.median_eur)
    return {
        "valuation_low":         round(median * 0.70),
        "valuation_median":      round(median),
        "valuation_high":        round(median * 1.35),
        "confidence":            "low",
        "confidence_float":      0.3,
        "comparables_count":     int(stats.sale_count),
        "method":                "aggregate_medium_stats",
        "comparables":           [],
        "comparables_quality":   "moyen",
        "avg_score":             None,
        "score_std_dev":         None,
        "lowest_score":          None,
        "highest_score":         None,
        "comparable_mediums":    [medium_category],
        "year_range":            None,
        "sale_date_range":       None,
        "dimension_range_cm2":   None,
        "explanation": (
            f"Estimation basée sur la médiane historique de {int(stats.sale_count)} "
            f"ventes en {medium_category} — aucun comparable récent disponible."
        ),
        "warning": (
            "Estimation basée sur des statistiques agrégées par médium, "
            "non sur des comparables individuels récents."
        ),
    }


# ── Fallback catégorie (artiste inconnu) ──────────────────────────────────────

async def find_comparables_by_category(
    db: AsyncSession,
    medium_category: Optional[str],
    year_created: Optional[int] = None,
    min_price: int = 100,
    max_price: int = 500_000,
) -> dict:
    """
    Cherche des comparables par catégorie de médium uniquement,
    sans artist_id. Fallback quand l'artiste est inconnu.
    Retourne toujours un dict valide. Ne lève jamais d'exception.
    """
    try:
        if not medium_category or medium_category == "other":
            return _no_data_result(
                "Médium non identifié — recherche par catégorie impossible."
            )

        cutoff_date = datetime.utcnow() - timedelta(days=1460)  # 48 mois
        EXCLUDED_CURRENCIES = ('KRW', 'INR', 'CNY', 'HUF', 'TWD', 'NGN', 'PHP')

        conditions = [
            HammerPrice.medium_category == medium_category,
            HammerPrice.hammer_price_eur.isnot(None),
            HammerPrice.hammer_price_eur >= min_price,
            HammerPrice.hammer_price_eur <= max_price,
            HammerPrice.sale_date >= cutoff_date,
            HammerPrice.currency.notin_(EXCLUDED_CURRENCIES),
        ]

        if year_created is not None:
            conditions.append(HammerPrice.year_created >= year_created - 30)
            conditions.append(HammerPrice.year_created <= year_created + 30)

        stmt = (
            select(
                HammerPrice.id,
                HammerPrice.hammer_price_eur,
                HammerPrice.medium,
                HammerPrice.medium_category,
                HammerPrice.dimensions,
                HammerPrice.sale_date,
                HammerPrice.auction_house,
                HammerPrice.year_created,
            )
            .where(and_(*conditions))
            .order_by(func.random())
            .limit(50)
        )

        result = await db.execute(stmt)
        rows = result.fetchall()

        if len(rows) < MIN_COMPARABLES:
            return _no_data_result(
                "Pas assez de ventes similaires disponibles pour cette catégorie."
            )

        prices = [float(row.hammer_price_eur) for row in rows]
        stats = _price_stats(prices)
        confidence = _confidence_label(len(rows), 50.0)
        lots = [
            {
                "id":               str(row.id),
                "hammer_price_eur": float(row.hammer_price_eur),
                "medium":           row.medium,
                "medium_category":  row.medium_category,
                "dimensions":       row.dimensions,
                "sale_date":        row.sale_date.isoformat() if row.sale_date else None,
                "auction_house":    row.auction_house,
                "year_created":     row.year_created,
                "score":            None,
            }
            for row in rows
        ]

        return {
            **stats,
            "confidence":          confidence,
            "confidence_float":    _confidence_to_float(confidence),
            "comparables_count":   len(rows),
            "method":              "market_comparables_by_category",
            "comparables":         lots[:10],
            "comparables_quality": "moyen",
            "avg_score":           None,
            "score_std_dev":       None,
            "lowest_score":        None,
            "highest_score":       None,
            "comparable_mediums":  [medium_category],
            "year_range":          None,
            "sale_date_range":     None,
            "dimension_range_cm2": None,
            "explanation": (
                f"Artiste non identifié. Estimation basée sur {len(rows)} ventes "
                f"de même catégorie ({medium_category}) — précision limitée."
            ),
            "warning": (
                f"Artiste non identifié. Estimation basée sur des ventes "
                f"de même catégorie ({medium_category}) — précision limitée."
            ),
        }

    except Exception as e:
        logger.error(
            f"[comparable_engine] find_comparables_by_category error: {e}",
            exc_info=True,
        )
        return _no_data_result("Erreur lors de la recherche par catégorie.")


# ── Fonction principale ────────────────────────────────────────────────────────

async def find_comparables_and_estimate(
    db: AsyncSession,
    artist_id,
    medium: Optional[str] = None,
    dimensions: Optional[str] = None,
    year_created: Optional[int] = None,
) -> dict:
    """
    Fonction principale du moteur de comparable v2.

    Pipeline :
      1. Requête : artiste + medium_category (obligatoire si connu) + 60 mois
      2. Score de similarité par lot (0–100)
      3. Filtre : score ≥ SCORE_FLOOR
      4. Contrôle qualité : avg_score + score_std_dev
      5. Minimum MIN_COMPARABLES lots admis
      6. P25/P50/P75 sur TOP_N_FOR_STATS meilleurs lots
      7. Retour riche avec métadonnées et explication

    Returns:
        dict toujours valide. Si données insuffisantes → confidence='none'.

    GARANTIE : Ne lève jamais d'exception.
    """
    try:
        # 1. Résoudre artist_id → artist_name_normalized
        artist_name_normalized = await _get_artist_name_normalized(db, artist_id)
        if not artist_name_normalized:
            logger.warning(f"[comparable_engine] artist_id={artist_id} not found")
            return _no_data_result("Artiste non trouvé en base de données.")

        # 2. Normaliser les entrées
        medium_category = normalize_medium_category(medium) if medium else None
        dim = parse_dimensions_cm(dimensions) if dimensions else {}
        ref_cm2 = dim.get("area_cm2") if dim else None

        logger.info(
            f"[comparable_engine] artist='{artist_name_normalized}', "
            f"medium='{medium}' → '{medium_category}', "
            f"dimensions='{dimensions}' → {ref_cm2}cm², "
            f"year_created={year_created}"
        )

        # 3. Requête unique : artiste + médium (obligatoire si connu) + 60 mois
        lots = await _query_hammer_prices(
            db, artist_name_normalized, medium_category, WINDOW_MAX
        )

        if not lots:
            fallback = await _fallback_aggregate_stats(
                db, artist_name_normalized, medium_category
            )
            if fallback:
                logger.info("[comparable_engine] Fallback: aggregate_medium_stats")
                return fallback
            return _no_data_result(
                "Aucune vente disponible pour cet artiste"
                + (f" en catégorie '{medium_category}'" if medium_category else "")
                + " sur les 60 derniers mois."
            )

        # 4. Score de similarité par lot
        scored_lots = []
        for lot in lots:
            s = _score_comparable(lot, medium, ref_cm2, year_created)
            scored_lots.append({**lot, "score": round(s, 1)})

        # 5. Filtrer par score plancher
        admitted = [l for l in scored_lots if l["score"] >= SCORE_FLOOR]
        logger.info(
            f"[comparable_engine] {len(lots)} lots fetched, "
            f"{len(admitted)} admitted (score ≥ {SCORE_FLOOR})"
        )

        if len(admitted) < MIN_COMPARABLES:
            return _no_data_result(
                f"Comparables insuffisants après filtrage qualité "
                f"({len(admitted)} retenus sur {len(lots)} disponibles) — "
                f"estimation indisponible."
            )

        # 6. Contrôle qualité : score moyen + homogénéité
        scores = [l["score"] for l in admitted]
        avg_score = sum(scores) / len(scores)
        variance = sum((s - avg_score) ** 2 for s in scores) / len(scores)
        std_dev = math.sqrt(variance)

        logger.info(
            f"[comparable_engine] Quality: avg_score={avg_score:.1f}, "
            f"std_dev={std_dev:.1f}, n={len(admitted)}"
        )

        if avg_score < MIN_AVG_SCORE:
            return _no_data_result(
                f"Qualité insuffisante des comparables (score moyen {avg_score:.0f}/100) — "
                f"estimation indisponible."
            )

        if avg_score < STD_DEV_THRESHOLD and std_dev > MAX_STD_DEV_BORDERLINE:
            return _no_data_result(
                f"Comparables trop hétérogènes (score moyen {avg_score:.0f}/100, "
                f"écart-type {std_dev:.0f}) — estimation indisponible."
            )

        # 7. Sélectionner les TOP_N_FOR_STATS meilleurs pour les statistiques
        admitted.sort(key=lambda l: l["score"], reverse=True)
        top_lots = admitted[:TOP_N_FOR_STATS]

        # 8. Calculer P25/P50/P75
        prices = [l["hammer_price_eur"] for l in top_lots]
        stats = _price_stats(prices)

        # 9. Confiance, label qualité et plage de scores
        confidence = _confidence_label(len(top_lots), avg_score)
        quality_label = _quality_label(avg_score)
        top_scores = [l["score"] for l in top_lots]
        lowest_score = round(min(top_scores), 1)
        highest_score = round(max(top_scores), 1)

        # 10. Métadonnées contextuelles
        seen_mediums: set = set()
        comparable_mediums = []
        for l in top_lots:
            m = l.get("medium")
            if m:
                m_key = m.lower().strip()
                if m_key not in seen_mediums:
                    seen_mediums.add(m_key)
                    comparable_mediums.append(m)

        years = [l["year_created"] for l in top_lots if l.get("year_created") is not None]
        year_range = [min(years), max(years)] if years else None

        sale_dates = [l["sale_date"] for l in top_lots if l.get("sale_date")]
        if sale_dates:
            sd_sorted = sorted(sale_dates)
            sale_date_range = [
                sd_sorted[0].strftime("%Y-%m"),
                sd_sorted[-1].strftime("%Y-%m"),
            ]
        else:
            sale_date_range = None

        dim_areas = []
        for l in top_lots:
            if l.get("dimensions"):
                d = parse_dimensions_cm(l["dimensions"])
                a = d.get("area_cm2")
                if a and a > 0:
                    dim_areas.append(a)
        dimension_range_cm2 = (
            [round(min(dim_areas)), round(max(dim_areas))] if dim_areas else None
        )

        # 11. Explication lisible
        explanation = _build_explanation(
            n=len(top_lots),
            ref_medium=medium,
            medium_category=medium_category,
            year_range=year_range,
            sale_date_range=sale_date_range,
            has_dims=dimension_range_cm2 is not None,
        )

        logger.info(
            f"[comparable_engine] → confidence={confidence}, n={len(top_lots)}, "
            f"avg_score={avg_score:.1f}, std_dev={std_dev:.1f}, "
            f"median={stats['valuation_median']}€"
        )

        return {
            **stats,
            "confidence":            confidence,
            "confidence_float":      _confidence_to_float(confidence),
            "comparables_count":     len(top_lots),
            "method":                "comparable_lots_scored",
            "comparables":           [_lot_to_output(l) for l in top_lots[:10]],
            "comparables_quality":   quality_label,
            "avg_score":             round(avg_score, 1),
            "score_std_dev":         round(std_dev, 1),
            "lowest_score":          lowest_score,
            "highest_score":         highest_score,
            "comparable_mediums":    comparable_mediums or None,
            "year_range":            year_range,
            "sale_date_range":       sale_date_range,
            "dimension_range_cm2":   dimension_range_cm2,
            "explanation":           explanation,
            "warning":               None,
        }

    except Exception as e:
        logger.error(
            f"[comparable_engine] Unexpected error for artist_id={artist_id}: {e}",
            exc_info=True,
        )
        return {
            "valuation_low":         None,
            "valuation_median":      None,
            "valuation_high":        None,
            "confidence":            "error",
            "confidence_float":      None,
            "comparables_count":     0,
            "method":                "error",
            "comparables":           [],
            "comparables_quality":   None,
            "avg_score":             None,
            "score_std_dev":         None,
            "lowest_score":          None,
            "highest_score":         None,
            "comparable_mediums":    None,
            "year_range":            None,
            "sale_date_range":       None,
            "dimension_range_cm2":   None,
            "explanation":           None,
            "warning":               "Erreur interne lors de l'estimation.",
        }


def _no_data_result(warning: str) -> dict:
    return {
        "valuation_low":         None,
        "valuation_median":      None,
        "valuation_high":        None,
        "confidence":            "none",
        "confidence_float":      None,
        "comparables_count":     0,
        "method":                "no_data",
        "comparables":           [],
        "comparables_quality":   None,
        "avg_score":             None,
        "score_std_dev":         None,
        "lowest_score":          None,
        "highest_score":         None,
        "comparable_mediums":    None,
        "year_range":            None,
        "sale_date_range":       None,
        "dimension_range_cm2":   None,
        "explanation":           None,
        "warning":               warning,
    }
