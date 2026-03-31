"""
HONO Deal Scoring Engine
Proprietary algorithm for detecting underpriced auction lots.

Score (0-100) components:
  1. % below low estimate    — 30%
  2. % below market average  — 30%
  3. Artist liquidity        — 20%
  4. Auction house reputation — 10%
  5. Data confidence         — 10%
"""
from typing import Optional, Dict, Any, Tuple, List
from dataclasses import dataclass
import numpy as np
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum, ScoreBreakdown
from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# ── House reputation scores ───────────────────────────────────────────────────
HOUSE_REPUTATION_SCORES: Dict[AuctionHouseEnum, float] = {
    AuctionHouseEnum.CHRISTIES: 0.97,
    AuctionHouseEnum.SOTHEBYS: 0.96,
    AuctionHouseEnum.BONHAMS: 0.88,
    AuctionHouseEnum.INVALUABLE: 0.78,
    AuctionHouseEnum.DROUOT: 0.82,
    AuctionHouseEnum.INTERENCHERES: 0.72,
    AuctionHouseEnum.OTHER: 0.60,
}

# ── Scoring weights (must sum to 1.0) ─────────────────────────────────────────
DEFAULT_WEIGHTS = {
    "below_estimate": settings.weight_below_estimate,
    "below_market": settings.weight_below_market,
    "artist_liquidity": settings.weight_artist_liquidity,
    "house_reputation": settings.weight_house_reputation,
    "confidence": settings.weight_confidence,
}


@dataclass
class ScoringInput:
    lot: LotNormalized
    artist_data: Dict[str, Any]
    house_reputation: float
    weights: Optional[Dict[str, float]] = None


@dataclass
class ScoringResult:
    deal_score: float
    is_deal: bool
    pct_below_low_estimate: Optional[float]
    pct_below_market_avg: Optional[float]
    breakdown: ScoreBreakdown


def _sigmoid(x: float, steepness: float = 0.08, midpoint: float = 30) -> float:
    """
    Sigmoid function for smooth score mapping.
    Returns value in [0, 100].
    x: percentage below estimate/market (negative = above)
    """
    return 100 / (1 + np.exp(-steepness * (x - midpoint)))


def _score_below_estimate(
    current_price: Optional[float],
    estimate_low: Optional[float],
) -> Tuple[float, Optional[float]]:
    """
    Score how far the current price is below the low estimate.
    Returns (component_score_0_100, pct_below)
    """
    if current_price is None or estimate_low is None or estimate_low <= 0:
        return 50.0, None  # neutral score when no data

    pct_below = (estimate_low - current_price) / estimate_low * 100
    # pct_below > 0 means below estimate (good for buyer)
    # pct_below < 0 means above estimate (bad for buyer)

    score = _sigmoid(pct_below, steepness=0.10, midpoint=20)
    return float(np.clip(score, 0, 100)), pct_below


def _score_below_market(
    current_price: Optional[float],
    avg_market_price: Optional[float],
) -> Tuple[float, Optional[float]]:
    """
    Score how far the current price is below historical market average.
    """
    if current_price is None or avg_market_price is None or avg_market_price <= 0:
        return 45.0, None  # slightly pessimistic when no market data

    pct_below = (avg_market_price - current_price) / avg_market_price * 100
    score = _sigmoid(pct_below, steepness=0.09, midpoint=25)
    return float(np.clip(score, 0, 100)), pct_below


def _score_liquidity(liquidity_score: Optional[float]) -> float:
    """
    Higher liquidity = easier to resell = more valuable find.
    Liquidity in 0-100 already.
    """
    if liquidity_score is None:
        return 40.0
    # Penalize very illiquid artists (harder to exit position)
    if liquidity_score < 20:
        return liquidity_score * 0.5  # steep penalty
    return float(np.clip(liquidity_score, 0, 100))


def _score_house_reputation(reputation: float) -> float:
    """Convert reputation (0-1) to component score (0-100)."""
    # High reputation houses = more trustworthy provenance and title
    # But scores from top houses are more "efficient" (less likely to have real deals)
    # We use reputation as a provenance quality signal, not deal-likelihood
    return float(reputation * 100)


def _score_confidence(
    data_confidence: Optional[float],
    artist_data_has_price: bool,
    estimate_available: bool,
) -> float:
    """
    How confident are we in this score?
    Low confidence = score is less reliable.
    """
    base = data_confidence or 0.5
    if artist_data_has_price:
        base = min(base + 0.15, 1.0)
    if estimate_available:
        base = min(base + 0.10, 1.0)
    return float(base * 100)


def build_rationale(
    inp: ScoringInput,
    pct_below_estimate: Optional[float],
    pct_below_market: Optional[float],
) -> List[str]:
    """Generate human-readable deal rationale bullets (max 4)."""
    artist = inp.artist_data
    bullets: List[str] = []

    if pct_below_estimate is not None and pct_below_estimate > 30:
        bullets.append(f"Prix {pct_below_estimate:.0f}% sous l'estimation basse — opportunité rare")
    elif pct_below_estimate is not None and pct_below_estimate > 10:
        bullets.append(f"Prix {pct_below_estimate:.0f}% sous l'estimation basse")

    if pct_below_market is not None and pct_below_market > 30:
        bullets.append(f"{pct_below_market:.0f}% sous la moyenne historique du marché")
    elif pct_below_market is not None and pct_below_market > 15:
        bullets.append(f"Décote de {pct_below_market:.0f}% vs marché")

    liquidity = artist.get("liquidity")
    if liquidity and liquidity > 75:
        bullets.append(f"Artiste très liquide ({liquidity:.0f}/100) — revente facilitée")
    elif liquidity and liquidity > 55:
        bullets.append(f"Liquidité solide ({liquidity:.0f}/100)")

    trend = artist.get("trend", "stable")
    if trend == "up":
        bullets.append("Artiste en tendance haussière — potentiel de plus-value")
    elif trend == "down":
        bullets.append("Artiste en tendance baissière — horizon long terme recommandé")

    sell_through = artist.get("sell_through")
    if sell_through and sell_through > 0.82:
        bullets.append(f"Taux de vente élevé ({sell_through * 100:.0f}%) — forte demande")

    if inp.house_reputation >= 0.90:
        bullets.append("Maison de vente de premier rang — provenance certifiée")

    if not bullets:
        bullets.append("Lot analysé par l'algorithme HONO")

    return bullets[:4]


def generate_ai_insight(
    inp: ScoringInput,
    pct_below_estimate: Optional[float],
    pct_below_market: Optional[float],
    deal_score: float,
) -> str:
    """Generate a one-paragraph NLG deal insight."""
    artist = inp.artist_data
    lot = inp.lot
    name = lot.artist_name_raw or "Ce lot"
    parts: List[str] = []

    if deal_score >= 85:
        parts.append(f"{name} représente une opportunité d'acquisition exceptionnelle.")
    elif deal_score >= 75:
        parts.append(f"{name} constitue une opportunité d'achat intéressante selon nos indicateurs.")
    else:
        parts.append(f"{name} mérite attention selon l'analyse HONO.")

    if pct_below_estimate is not None and pct_below_estimate > 15:
        parts.append(
            f"Le prix actuel est {pct_below_estimate:.0f}% sous l'estimation basse, "
            f"ce qui suggère une sous-estimation ou un manque d'intérêt temporaire du marché."
        )

    trend = artist.get("trend", "stable")
    liquidity = artist.get("liquidity", 50)
    if trend == "up" and liquidity and liquidity > 65:
        parts.append("L'artiste bénéficie d'une dynamique de marché positive avec une liquidité élevée.")
    elif trend == "down":
        parts.append("Notez que cet artiste est en tendance baissière — acquisition de long terme recommandée.")

    if pct_below_market is not None and pct_below_market > 25:
        parts.append(
            f"La décote de {pct_below_market:.0f}% par rapport aux ventes historiques "
            f"offre un potentiel de valorisation significatif."
        )

    return " ".join(parts)


def compute_deal_score(inp: ScoringInput) -> ScoringResult:
    """
    Main scoring function. Returns a ScoringResult with deal_score 0-100.
    """
    weights = inp.weights or DEFAULT_WEIGHTS
    assert abs(sum(weights.values()) - 1.0) < 0.001, "Weights must sum to 1.0"

    lot = inp.lot
    artist = inp.artist_data
    reputation = inp.house_reputation

    avg_market_price = artist.get("avg_price")
    liquidity = artist.get("liquidity")
    data_confidence = artist.get("confidence", 0.5)
    has_market_price = avg_market_price is not None and avg_market_price > 0

    # ── Component scores ─────────────────────────────────────────────────────

    below_est_score, pct_below_estimate = _score_below_estimate(
        lot.current_price, lot.estimate_low
    )

    below_mkt_score, pct_below_market = _score_below_market(
        lot.current_price, avg_market_price
    )

    liq_score = _score_liquidity(liquidity)
    rep_score = _score_house_reputation(reputation)
    conf_score = _score_confidence(
        data_confidence,
        has_market_price,
        lot.estimate_low is not None,
    )

    # ── Weighted aggregate ───────────────────────────────────────────────────

    raw_score = (
        below_est_score * weights["below_estimate"]
        + below_mkt_score * weights["below_market"]
        + liq_score * weights["artist_liquidity"]
        + rep_score * weights["house_reputation"]
        + conf_score * weights["confidence"]
    )

    # ── Penalty adjustments ──────────────────────────────────────────────────

    # Penalty: no current price data
    if lot.current_price is None:
        raw_score *= 0.70

    # Penalty: lot already sold / withdrawn (DB Lot model only — LotNormalized has no status)
    if hasattr(lot, "status") and lot.status and lot.status.value in ("sold", "withdrawn"):
        raw_score *= 0.50

    # Bonus: multiple signals agree (both below estimate AND below market)
    if (
        pct_below_estimate is not None and pct_below_estimate > 15
        and pct_below_market is not None and pct_below_market > 15
    ):
        raw_score = min(raw_score * 1.08, 100)

    # Bonus: high liquidity deal
    if liquidity and liquidity > 80 and below_est_score > 70:
        raw_score = min(raw_score * 1.05, 100)

    deal_score = float(np.clip(raw_score, 0, 100))
    is_deal = deal_score >= settings.deal_score_threshold

    rationale = build_rationale(inp, pct_below_estimate, pct_below_market)
    ai_insight = generate_ai_insight(inp, pct_below_estimate, pct_below_market, deal_score)

    breakdown = ScoreBreakdown(
        below_estimate_score=round(below_est_score, 2),
        below_market_score=round(below_mkt_score, 2),
        liquidity_score=round(liq_score, 2),
        house_reputation_score=round(rep_score, 2),
        confidence_score=round(conf_score, 2),
        weights=weights,
        pct_below_low_estimate=round(pct_below_estimate, 2) if pct_below_estimate is not None else None,
        pct_below_market_avg=round(pct_below_market, 2) if pct_below_market is not None else None,
        rationale=rationale,
        ai_insight=ai_insight,
    )

    logger.debug(
        "Lot scored",
        title=lot.title[:50],
        deal_score=round(deal_score, 1),
        is_deal=is_deal,
        pct_below_est=pct_below_estimate,
        pct_below_mkt=pct_below_market,
    )

    return ScoringResult(
        deal_score=round(deal_score, 1),
        is_deal=is_deal,
        pct_below_low_estimate=round(pct_below_estimate, 2) if pct_below_estimate is not None else None,
        pct_below_market_avg=round(pct_below_market, 2) if pct_below_market is not None else None,
        breakdown=breakdown,
    )


def get_active_weights() -> Dict[str, float]:
    """Return current scoring weights (in production: load from DB active model)."""
    return DEFAULT_WEIGHTS.copy()


# ── ML Placeholder ────────────────────────────────────────────────────────────

class MLScoreModel:
    """
    Placeholder for future ML-based scoring.
    Trains on historical sold lots + realized prices to learn better weights.
    Replace compute_deal_score() with ML inference when ready.
    """

    def __init__(self):
        self.is_trained = False
        self.feature_names = [
            "pct_below_estimate",
            "pct_below_market",
            "artist_liquidity",
            "artist_popularity",
            "house_reputation",
            "sell_through_rate",
            "data_confidence",
            "days_to_auction",
        ]

    def extract_features(self, inp: ScoringInput) -> np.ndarray:
        lot = inp.lot
        artist = inp.artist_data
        from datetime import datetime

        days_to_auction = 0
        if lot.auction_date:
            delta = lot.auction_date - datetime.utcnow()
            days_to_auction = max(0, delta.days)

        avg_price = artist.get("avg_price") or 0
        est_low = lot.estimate_low or 0
        curr = lot.current_price or 0

        pct_below_est = (est_low - curr) / max(est_low, 1) * 100 if est_low > 0 else 0
        pct_below_mkt = (avg_price - curr) / max(avg_price, 1) * 100 if avg_price > 0 else 0

        return np.array([
            pct_below_est,
            pct_below_mkt,
            artist.get("liquidity", 50),
            artist.get("popularity", 50),
            inp.house_reputation * 100,
            artist.get("sell_through", 0.6) * 100,
            artist.get("confidence", 0.5) * 100,
            days_to_auction,
        ])

    def predict(self, inp: ScoringInput) -> float:
        """
        When trained: return ML-predicted deal score.
        Currently: delegate to rule-based engine.
        """
        if not self.is_trained:
            result = compute_deal_score(inp)
            return result.deal_score
        # Future: return self.model.predict(self.extract_features(inp).reshape(1, -1))[0]
        raise NotImplementedError("ML model not yet trained")

    def train(self, historical_lots: list):
        """
        Future: train on (lot_features, realized_gain_pct) pairs.
        Use gradient boosting or XGBoost for tabular data.
        """
        logger.info("ML model training placeholder called", samples=len(historical_lots))
        # TODO: Implement when sufficient historical data is available
        pass


ml_model = MLScoreModel()
