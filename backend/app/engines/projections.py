"""
Art value projection engine.
Based on historical auction data and artist market trends.
"""
from typing import Optional, List
import math


# Historical art market CAGR (Artprice Research / Mei Moses)
ARTIST_TIER_CAGR = {
    "blue_chip":   0.094,  # 9.4%/year — Picasso, Warhol, Basquiat
    "established": 0.072,  # 7.2%/year — Chagall, Miró, Buffet
    "emerging":    0.055,  # 5.5%/year — living artists, contemporary
    "unknown":     0.041,  # 4.1%/year — unattributed, decorative
}

ARTIST_TIER_VOLATILITY = {
    "blue_chip":   0.18,
    "established": 0.24,
    "emerging":    0.35,
    "unknown":     0.28,
}

BLUE_CHIP_ARTISTS = {
    "pablo picasso", "andy warhol", "jean-michel basquiat", "gerhard richter",
    "cy twombly", "jasper johns", "david hockney", "jeff koons",
    "yves klein", "pierre soulages", "zao wou-ki", "gustav klimt",
    "egon schiele",
}

ESTABLISHED_ARTISTS = {
    "marc chagall", "joan miró", "fernand léger", "bernard buffet",
    "niki de saint phalle", "alexander calder", "henry moore",
    "damien hirst", "georg baselitz", "yoshitomo nara", "kaws",
    "bridget riley", "jean dubuffet",
}


def get_artist_tier(artist_name: Optional[str]) -> str:
    if not artist_name:
        return "unknown"
    name = artist_name.lower().strip()
    if name in BLUE_CHIP_ARTISTS:
        return "blue_chip"
    if name in ESTABLISHED_ARTISTS:
        return "established"
    return "emerging"


def project_value(
    purchase_price_eur: float,
    artist_name: Optional[str] = None,
    liquidity_score: float = 50.0,
    popularity_score: float = 50.0,
    trend: str = "stable",
    years: List[int] = None,
    cagr_override: Optional[float] = None,
) -> dict:
    """Project artwork value over time using compounded growth model.

    If cagr_override is provided (Sprint 2 real per-artist CAGR, already capped
    0-15%), it is used as the base CAGR instead of the hardcoded tier lookup.
    Trend/liquidity/popularity micro-adjustments still apply on top.
    """
    if years is None:
        years = [5, 10, 20, 30, 50]

    tier = get_artist_tier(artist_name)
    if cagr_override is not None:
        base_cagr = float(cagr_override)
    else:
        base_cagr = ARTIST_TIER_CAGR[tier]
    volatility = ARTIST_TIER_VOLATILITY[tier]

    trend_adj = {"up": 0.015, "stable": 0.0, "down": -0.012}.get(trend, 0.0)
    liquidity_adj = (liquidity_score - 50) / 1000
    popularity_adj = (popularity_score - 50) / 2000

    adjusted_cagr = base_cagr + trend_adj + liquidity_adj + popularity_adj

    projections = {}
    for year in years:
        base = purchase_price_eur * (1 + adjusted_cagr) ** year
        conservative = purchase_price_eur * (1 + max(adjusted_cagr - volatility, 0.01)) ** year
        optimistic = purchase_price_eur * (1 + adjusted_cagr + volatility * 0.5) ** year

        projections[year] = {
            "year": year,
            "conservative_eur": round(conservative, -1),
            "base_eur": round(base, -1),
            "optimistic_eur": round(optimistic, -1),
            "base_roi_pct": round((base / purchase_price_eur - 1) * 100, 1),
            "cagr_pct": round(adjusted_cagr * 100, 2),
            "tier": tier,
        }

    best_sell_year = _find_optimal_sell_window(purchase_price_eur, adjusted_cagr, volatility)

    return {
        "purchase_price_eur": purchase_price_eur,
        "artist_tier": tier,
        "base_cagr_pct": round(adjusted_cagr * 100, 2),
        "projections": projections,
        "recommended_hold_years": best_sell_year,
        "sell_recommendation": _sell_recommendation(
            best_sell_year,
            trend,
            adjusted_cagr,
            liquidity_score,
        ),
    }


def _find_optimal_sell_window(price: float, cagr: float, volatility: float) -> int:
    if cagr <= 0:
        return 5
    transaction_cost = 0.12
    break_even_year = math.ceil(math.log(1 / (1 - transaction_cost)) / math.log(1 + cagr))
    return max(break_even_year * 2, 5)


def _sell_recommendation(
    years: int,
    trend: str,
    cagr: float,
    liquidity_score: float,
) -> str:
    if trend == "down":
        return "Marché en recul — attendre un retournement avant de vendre"
    if cagr <= 0.03:
        return "Croissance faible — horizon 10 ans+ recommandé"
    if trend == "up" and liquidity_score >= 75 and years <= 5:
        return f"Horizon optimal : 3–5 ans — artiste liquide en hausse"
    elif years <= 5:
        return f"Horizon optimal : 3–5 ans"
    elif years <= 10:
        return f"Horizon optimal : 5–10 ans"
    else:
        return f"Horizon long terme : 10 ans+"
