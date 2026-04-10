"""
Confidence score — data quality per lot.
Measures how reliable the data is, independently from deal quality.
0-100. Only lots with confidence > 50 appear in Best Lots.
"""
from app.models.schemas import LotNormalized


def compute_confidence_score(lot: LotNormalized, artist_data: dict) -> float:
    """
    Confidence = how much we trust the data for this lot.
    Independent from deal_score (which measures opportunity quality).

    Components:
    - has_current_price (25pts)
    - has_estimate (25pts)
    - has_image (15pts)
    - artist_in_db (20pts)
    - has_comparables / artist_avg_price (15pts)
    """
    score = 0.0

    # Price data
    if lot.current_price and lot.current_price > 0:
        score += 25.0
    elif lot.estimate_low and lot.estimate_low > 0:
        score += 12.0  # partial — estimate but no current price

    # Estimate data
    if lot.estimate_low and lot.estimate_low > 0:
        score += 15.0
    if lot.estimate_high and lot.estimate_high > 0:
        score += 10.0

    # Image
    if lot.image_url:
        score += 15.0

    # Artist in DB with data
    if artist_data:
        score += 10.0
        if artist_data.get("avg_price") and artist_data["avg_price"] > 0:
            score += 10.0  # has comparables
        if artist_data.get("liquidity") and artist_data["liquidity"] > 20:
            score += 5.0   # artist has track record
        if artist_data.get("confidence", 0) > 0.6:
            score += 5.0   # high confidence artist data

    # Title quality
    if lot.title and len(lot.title) > 5:
        score += 5.0

    # Auction date present
    if lot.auction_date:
        score += 5.0

    return min(round(score, 1), 100.0)
