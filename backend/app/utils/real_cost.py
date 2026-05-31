"""
Real Cost Calculator — compute true all-in cost and breakeven for a lot.
"""

BUYERS_PREMIUM_RATES: dict[str, float] = {
    "christies":  0.26,
    "sotheby":    0.275,
    "phillips":   0.27,
    "bonhams":    0.25,
    "drouot":     0.25,
    "artcurial":  0.25,
    "aguttes":    0.22,
    "millon":     0.20,
}
_DEFAULT_PREMIUM = 0.26


def compute_real_cost(
    hammer_price: float,
    auction_house: str | None,
    holding_years: int = 3,
) -> dict:
    """
    Returns break-even analysis for a given lot.

    Args:
        hammer_price: price paid at hammer (pre-premium), in EUR
        auction_house: raw auction house name string (e.g. "Christie's Paris")
        holding_years: default 3-year holding assumption

    Returns dict with:
        cost_basis         — hammer + buyer's premium
        holding_cost_3y    — storage + insurance over holding_years
        breakeven_hammer   — hammer price needed to recoup costs after seller fee
        needed_gain_pct    — % gain over today's price required to break even
        buyers_premium_pct — applied buyer's premium rate (%)
    """
    house_key = (auction_house or "").lower()
    premium_rate = _DEFAULT_PREMIUM
    for key, rate in BUYERS_PREMIUM_RATES.items():
        if key in house_key:
            premium_rate = rate
            break

    cost_basis = hammer_price * (1 + premium_rate)
    # Storage ~0.5%/yr + insurance ~0.1%/yr of cost basis
    holding_cost = cost_basis * 0.006 * holding_years
    # Seller's commission: 15% of hammer at resale
    sellers_fee = 0.15
    breakeven_hammer = (cost_basis + holding_cost) / (1 - sellers_fee)
    needed_gain_pct = round((breakeven_hammer / hammer_price - 1) * 100, 1)

    return {
        "cost_basis": round(cost_basis),
        "holding_cost_3y": round(holding_cost),
        "breakeven_hammer": round(breakeven_hammer),
        "needed_gain_pct": needed_gain_pct,
        "buyers_premium_pct": round(premium_rate * 100, 1),
    }


def compute_max_bid(
    market_value: float,
    auction_house: str | None,
    profit_margin: float = 0.10,
    holding_years: int = 3,
) -> int:
    """
    Max hammer price to bid given a target resale market value.

    Solves breakeven backwards:
        market_value = bid × (1 + premium) × (1 + holding_rate) / (1 - seller_fee)
    Then applies profit_margin safety factor.
    """
    house_key = (auction_house or "").lower()
    premium_rate = _DEFAULT_PREMIUM
    for key, rate in BUYERS_PREMIUM_RATES.items():
        if key in house_key:
            premium_rate = rate
            break
    seller_fee = 0.15
    holding_rate = 0.006 * holding_years
    breakeven_bid = market_value * (1 - seller_fee) / ((1 + premium_rate) * (1 + holding_rate))
    return round(breakeven_bid * (1 - profit_margin))
