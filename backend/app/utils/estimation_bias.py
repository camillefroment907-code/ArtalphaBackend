"""
Estimation Bias — measures how accurately an auction house estimates lot values.

ratio = avg(actual_hammer / low_estimate)
  > 1.2  → house underestimates  → buyer advantage (bidders see "bargain")
  0.9–1.2 → accurate
  < 0.9  → house overestimates  → bearish signal (lots fail to sell)
"""
from sqlalchemy import text
from app.utils.cache import get_cached, set_cached


async def get_estimation_bias(auction_house: str | None, db) -> dict | None:
    if not auction_house:
        return None

    # Normalize key: "Christie's Paris" → "christies"
    house_key = (
        auction_house.lower()
        .replace("'", "").replace("'", "")
        .split()[0]
        .rstrip("s")  # "christies" → "christie"
    )
    cache_key = f"bias:{house_key}"
    cached = get_cached(cache_key, ttl=3600)
    if cached is not None:
        return cached if cached else None  # False = "queried, no data"

    # Match on the first word of the house name (handles "Sotheby's Paris" etc.)
    pattern = f"%{auction_house.split()[0].replace(chr(39),'').replace(chr(8217),'')}%"

    result = await db.execute(
        text("""
            SELECT
                AVG(
                    COALESCE(
                        premium_ratio,
                        hammer_price_eur / NULLIF(estimate_low, 0)
                    )
                )::float  AS avg_ratio,
                COUNT(*)::int AS sample_size
            FROM hammer_prices
            WHERE auction_house ILIKE :house
              AND COALESCE(premium_ratio, hammer_price_eur / NULLIF(estimate_low, 0))
                  BETWEEN 0.05 AND 15
              AND hammer_price_eur > 0
              AND estimate_low   > 0
        """),
        {"house": pattern},
    )

    row = result.one_or_none()
    if not row or not row.avg_ratio or (row.sample_size or 0) < 5:
        set_cached(cache_key, False)
        return None

    ratio = row.avg_ratio
    pct = round((ratio - 1) * 100, 1)

    if ratio >= 1.4:
        label = f"Heavily underestimates (+{pct}% avg)"
        signal = "bullish"
    elif ratio >= 1.15:
        label = f"Underestimates (+{pct}% avg)"
        signal = "bullish"
    elif ratio >= 0.9:
        label = f"Estimates accurately ({'+' if pct >= 0 else ''}{pct}%)"
        signal = "neutral"
    else:
        label = f"Overestimates ({pct}% avg)"
        signal = "bearish"

    bias = {
        "avg_ratio": round(ratio, 3),
        "pct_above_low_estimate": pct,
        "sample_size": row.sample_size,
        "label": label,
        "signal": signal,
        "house": auction_house,
    }
    set_cached(cache_key, bias)
    return bias
