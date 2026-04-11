"""
Artsy Intelligence Engine — Nautilus
Transforms raw Artsy data into investment-grade signals.

3 core signals:
1. Gallery Tier — credibility of representing galleries
2. Artist Momentum — acceleration of career signals
3. Pre-auction Detection — artists not yet at auction but ready
"""
import httpx
import asyncio
import re
import structlog
from datetime import datetime, timedelta
from typing import Optional

logger = structlog.get_logger()

ARTSY_GRAPHQL = "https://metaphysics-production.artsy.net/v2"

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0",
}

# Known major museums/institutions — presence in bio = collection count proxy
MAJOR_INSTITUTIONS = [
    "moma", "museum of modern art", "tate", "pompidou", "guggenheim",
    "louvre", "hermitage", "metropolitan", "met museum", "whitney",
    "lacma", "sfmoma", "stedelijk", "musée d'orsay", "national gallery",
    "art institute of chicago", "musée national", "centre pompidou",
    "kunst", "nationalgalerie", "pinakothek", "rijksmuseum",
]


# ─────────────────────────────────────────────
# GALLERY TIER CALCULATION
# ─────────────────────────────────────────────

def compute_gallery_tier(location_count: int, shows_count: int) -> int:
    """
    Tier 1: Top institutional galleries (Gagosian, Pace, Hauser & Wirth level)
    Tier 2: Strong mid-market galleries
    Tier 3: Emerging or regional galleries
    Uses location count and shows count as proxies for gallery prestige.
    """
    score = 0
    score += min(location_count * 15, 60)   # Max 60pts: 4+ locations = major gallery
    score += min(shows_count * 5, 40)        # Max 40pts from number of shows at gallery

    if score >= 60:
        return 1
    elif score >= 25:
        return 2
    else:
        return 3


# ─────────────────────────────────────────────
# ARTIST MOMENTUM SCORE
# ─────────────────────────────────────────────

def compute_momentum_score(
    shows_last_12m: int,
    shows_prev_12m: int,
    gallery_tier_avg: float,
    public_collections: int,
    gallery_count: int,
) -> float:
    """
    Momentum = acceleration of career signals.
    0-100. Above 70 = strong buy signal for primary market.
    """
    # Show velocity (40pts max)
    if shows_prev_12m == 0:
        show_growth = min(shows_last_12m * 10, 40)
    else:
        ratio = shows_last_12m / shows_prev_12m
        show_growth = min((ratio - 1) * 20, 40)
    show_growth = max(show_growth, 0)

    # Gallery quality (30pts max)
    gallery_score = max(0, (4 - gallery_tier_avg) / 3 * 30)  # Tier 1 = 30pts

    # Institutional validation (20pts max)
    institutional = min(public_collections * 5, 20)

    # Market breadth (10pts max)
    breadth = min(gallery_count * 2, 10)

    total = show_growth + gallery_score + institutional + breadth
    return round(min(total, 100), 1)


def compute_liquidity_score(
    gallery_count: int,
    location_count: int,
    gallery_tier_avg: float,
) -> float:
    """
    Liquidity = ease of resale on secondary market.
    High liquidity = artist has international market.
    """
    score = 0
    score += min(gallery_count * 5, 40)
    score += min(location_count * 3, 30)
    score += max(0, (4 - gallery_tier_avg) / 3 * 30)
    return round(min(score, 100), 1)


def compute_institutional_score(public_collections: int) -> float:
    """
    Institutional validation = number of major public collections.
    MoMA, Tate, Pompidou etc. = price floor guarantee.
    """
    if public_collections >= 10:
        return 100.0
    elif public_collections >= 5:
        return 80.0
    elif public_collections >= 3:
        return 60.0
    elif public_collections >= 1:
        return 35.0
    return 0.0


def detect_investment_tier(
    momentum_score: float,
    institutional_score: float,
    liquidity_score: float,
    birth_year: Optional[int],
) -> str:
    """
    Classify artist into investment tier:
    - blue_chip: established, liquid, institutional
    - mid_career: growing, validated, some institutional
    - emerging: early stage, high risk/reward
    """
    if institutional_score >= 60 and liquidity_score >= 60:
        return "blue_chip"
    elif momentum_score >= 60 or institutional_score >= 35:
        return "mid_career"
    else:
        return "emerging"


def detect_pre_auction(
    gallery_tier_avg: float,
    shows_last_12m: int,
    public_collections: int,
    has_auction_results: bool,
) -> bool:
    """
    Pre-auction = artist in serious galleries but not yet at auction.
    Best risk/reward window for primary market investment.
    """
    return (
        not has_auction_results and
        gallery_tier_avg <= 2.5 and      # Represented by decent galleries
        shows_last_12m >= 2 and          # Actively showing
        public_collections >= 1          # Institutional validation
    )


def _count_institutional_mentions(biography: str) -> int:
    """
    Count major museum/institution mentions in biography text.
    Used as proxy for public collections count.
    """
    if not biography:
        return 0
    bio_lower = biography.lower()
    count = 0
    for inst in MAJOR_INSTITUTIONS:
        if inst in bio_lower:
            count += 1
    return count


# ─────────────────────────────────────────────
# ARTSY DATA FETCHERS
# ─────────────────────────────────────────────

async def fetch_artist_from_artsy(artist_name: str) -> Optional[dict]:
    """
    Fetch enriched artist data from Artsy GraphQL.
    Returns structured data for ArtistProfile creation.
    """
    query = """
    query ArtistIntelligence($name: String!) {
      searchConnection(query: $name, entities: [ARTIST], first: 1) {
        edges {
          node {
            __typename
            ... on Artist {
              internalID
              slug
              name
              nationality
              birthday
              deathday
              biographyBlurb { text }
              image { url(version: "large") }

              showsConnection(first: 20, sort: START_AT_DESC) {
                totalCount
                edges {
                  node {
                    startAt
                    endAt
                    partner {
                      ... on Partner { name }
                    }
                  }
                }
              }

              artistSeriesConnection(first: 5) {
                totalCount
              }

              partnersConnection(first: 10) {
                edges {
                  node {
                    ... on Partner {
                      internalID
                      name
                      locationsConnection(first: 5) { totalCount }
                      showsConnection(first: 3) { totalCount }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    """

    try:
        async with httpx.AsyncClient(timeout=15, headers=HEADERS) as client:
            resp = await client.post(
                ARTSY_GRAPHQL,
                json={"query": query, "variables": {"name": artist_name}},
            )
            if resp.status_code != 200:
                logger.debug("artsy_http_error", artist=artist_name, status=resp.status_code)
                return None

            data = resp.json()

            # Check for GraphQL errors
            if data.get("errors"):
                logger.debug("artsy_graphql_error", artist=artist_name, errors=data["errors"])
                return None

            edges = (data.get("data", {})
                        .get("searchConnection", {})
                        .get("edges", []))

            if not edges:
                return None

            node = edges[0].get("node", {})
            # Only process Artist nodes (not SearchableItem or other types)
            if not node or node.get("__typename") != "Artist":
                return None

            return _parse_artist_node(node, artist_name)

    except Exception as e:
        logger.debug("artsy_artist_fetch_failed", artist=artist_name, error=str(e))
        return None


def _parse_artist_node(node: dict, fallback_name: str) -> dict:
    """Parse Artsy artist GraphQL node into structured intelligence data."""
    now = datetime.utcnow()
    one_year_ago = now - timedelta(days=365)
    two_years_ago = now - timedelta(days=730)

    # Biography
    bio_obj = node.get("biographyBlurb") or {}
    biography = bio_obj.get("text", "") if isinstance(bio_obj, dict) else ""

    # Shows analysis
    shows_edges = (node.get("showsConnection") or {}).get("edges", [])
    shows_last_12m = 0
    shows_prev_12m = 0

    for edge in shows_edges:
        show = edge.get("node", {})
        start_at = show.get("startAt")
        if not start_at:
            continue
        try:
            show_date = datetime.fromisoformat(str(start_at)[:19])
            if show_date >= one_year_ago:
                shows_last_12m += 1
            elif show_date >= two_years_ago:
                shows_prev_12m += 1
        except Exception:
            pass

    # Gallery analysis — partners use inline fragment ... on Partner
    partners_edges = (node.get("partnersConnection") or {}).get("edges", [])
    gallery_tiers = []
    gallery_count = 0
    top_gallery = None
    top_tier = 3
    location_total = 0

    for edge in partners_edges:
        partner = edge.get("node", {})
        if not partner or not partner.get("name"):
            continue  # Skip non-Partner nodes (empty {} from inline fragment miss)
        gallery_count += 1
        locations = (partner.get("locationsConnection") or {}).get("totalCount", 1)
        shows_at_gallery = (partner.get("showsConnection") or {}).get("totalCount", 0)
        location_total += locations
        tier = compute_gallery_tier(locations, shows_at_gallery)
        gallery_tiers.append(tier)
        if tier < top_tier:
            top_tier = tier
            top_gallery = partner.get("name")

    gallery_tier_avg = (sum(gallery_tiers) / len(gallery_tiers)) if gallery_tiers else 3.0

    # Institutional validation — count major museum mentions in biography
    public_collections = _count_institutional_mentions(biography)

    # Birth/death year
    birth_year = None
    death_year = None
    if node.get("birthday"):
        try:
            birth_year = int(str(node["birthday"])[:4])
        except Exception:
            pass
    if node.get("deathday"):
        try:
            death_year = int(str(node["deathday"])[:4])
        except Exception:
            pass

    # Compute all scores
    momentum = compute_momentum_score(
        shows_last_12m, shows_prev_12m,
        gallery_tier_avg, public_collections, gallery_count
    )
    liquidity = compute_liquidity_score(gallery_count, location_total, gallery_tier_avg)
    institutional = compute_institutional_score(public_collections)
    inv_tier = detect_investment_tier(momentum, institutional, liquidity, birth_year)
    pre_auction = detect_pre_auction(
        gallery_tier_avg, shows_last_12m, public_collections,
        has_auction_results=False  # Will be updated by lot matching
    )

    return {
        "artsy_id": node.get("internalID") or node.get("slug", ""),
        "name": node.get("name") or fallback_name,
        "nationality": node.get("nationality"),
        "birth_year": birth_year,
        "death_year": death_year,
        "biography": biography[:2000] if biography else None,
        "image_url": (node.get("image") or {}).get("url"),
        "gallery_tier_avg": round(gallery_tier_avg, 2),
        "gallery_count": gallery_count,
        "top_gallery_name": top_gallery,
        "public_collections_count": public_collections,
        "shows_last_12m": shows_last_12m,
        "shows_prev_12m": shows_prev_12m,
        "momentum_score": momentum,
        "liquidity_score": liquidity,
        "institutional_score": institutional,
        "is_pre_auction": pre_auction,
        "investment_tier": inv_tier,
        "artsy_url": f"https://www.artsy.net/artist/{node.get('slug', '')}",
        "raw_data": {
            "shows_total": (node.get("showsConnection") or {}).get("totalCount", 0),
            "gallery_tier_avg": gallery_tier_avg,
        },
    }
