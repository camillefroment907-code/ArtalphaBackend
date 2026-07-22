"""
Market Signals V1 — all user-facing strings.

No raw ratios, scores, internal calculations, or SQL terminology are
exposed here. The render functions receive only safe metadata (counts,
direction enum) and return the four user-facing fields.
"""
from __future__ import annotations


def render_price_premium(
    *,
    n_total: int,
    n_months: int,
    direction: str,
) -> dict:
    """
    Build the price_premium signal response dict.

    direction: "above" | "at" | "below" — derived from recent_avg vs 1.0
    thresholds in the service layer. Never exposed in the API response.
    """
    if direction == "above":
        headline = "Consistent auction premium"
        detail = "Recent sales have tracked above pre-auction estimate guidance."
        meaning = (
            "Buyer demand exceeds published valuations — the market places "
            "a sustained premium on this artist's work."
        )
    elif direction == "below":
        headline = "Auction discount pattern"
        detail = "Recent sales have tracked below pre-auction estimates."
        meaning = (
            "Works have sold at a discount to estimates — the current market "
            "is pricing below auction house guidance."
        )
    else:
        headline = "Prices align with estimates"
        detail = "Recent sales have tracked in line with pre-auction estimates."
        meaning = (
            "Stable valuation — the market is pricing this artist's work "
            "close to published auction house guidance."
        )

    return {
        "type": "price_premium",
        "headline": headline,
        "detail": detail,
        "meaning": meaning,
        "basis": f"Based on {n_total} auction results across {n_months} active months.",
    }


def render_auction_volume(*, vol_recent: int, vol_prior: int) -> dict:
    """
    Build the auction_activity signal response dict.

    vol_recent / vol_prior are counts used to determine direction and to
    populate the basis field. They are counts, not ratios.
    """
    if vol_recent > vol_prior:
        headline = "Rising auction volume"
        detail = "More works came to auction over the past 12 months than in the prior period."
        meaning = (
            "Growing collector demand — the secondary market for this artist is expanding."
        )
    elif vol_recent < vol_prior:
        headline = "Declining auction volume"
        detail = "Fewer works came to auction over the past 12 months compared to the prior period."
        meaning = (
            "Lower secondary market supply — works may be moving to primary market "
            "channels or held by long-term collectors."
        )
    else:
        headline = "Stable auction volume"
        detail = "Auction supply is consistent with the prior 12-month period."
        meaning = (
            "Steady secondary market presence — reliable visibility in the auction market."
        )

    return {
        "type": "auction_activity",
        "headline": headline,
        "detail": detail,
        "meaning": meaning,
        "basis": (
            f"{vol_recent} sales in the past 12 months, "
            f"versus {vol_prior} in the prior period."
        ),
    }
