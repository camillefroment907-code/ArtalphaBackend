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
import structlog
from datetime import datetime, timedelta
from typing import Optional

logger = structlog.get_logger()

ARTSY_GRAPHQL = "https://metaphysics-production.artsy.net/v2"

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0",
}


# ─────────────────────────────────────────────
# GALLERY TIER CALCULATION
# ─────────────────────────────────────────────

def compute_gallery_tier(followers: int, fair_count: int, location_count: int) -> int:
    """
    Tier 1: Top institutional galleries (Gagosian, Pace, Hauser & Wirth level)
    Tier 2: Strong mid-market galleries (Templon, Perrotin, Almine Rech level)
    Tier 3: Emerging or regional galleries
    """
    score = 0
    score += min(followers / 1000, 60)    # Max 60pts from followers
    score += min(fair_count * 5, 25)      # Max 25pts from art fairs
    score += min(location_count * 3, 15)  # Max 15pts from locations

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
                    partner { name }
                  }
                }
              }

              artistSeriesConnection(first: 5) {
                totalCount
              }

              partnersConnection(first: 10, partnerType: GALLERY) {
                edges {
                  node {
                    internalID
                    name
                    followersCount
                    locationsConnection(first: 5) { totalCount }
                  }
                }
              }

              collectionConnection: collectionsConnection(first: 1) {
                totalCount
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
                return None

            data = resp.json()
            edges = (data.get("data", {})
                        .get("searchConnection", {})
                        .get("edges", []))

            if not edges:
                return None

            node = edges[0].get("node", {})
            if not node or node.get("__typename") == "SearchableItem":
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

    # Gallery analysis
    partners_edges = (node.get("partnersConnection") or {}).get("edges", [])
    gallery_tiers = []
    gallery_count = len(partners_edges)
    top_gallery = None
    top_tier = 3
    location_total = 0

    for edge in partners_edges:
        partner = edge.get("node", {})
        followers = partner.get("followersCount") or 0
        locations = (partner.get("locationsConnection") or {}).get("totalCount", 1)
        location_total += locations
        tier = compute_gallery_tier(followers, 0, locations)
        gallery_tiers.append(tier)
        if tier < top_tier:
            top_tier = tier
            top_gallery = partner.get("name")

    gallery_tier_avg = (sum(gallery_tiers) / len(gallery_tiers)) if gallery_tiers else 3.0

    # Collections (institutional validation)
    public_collections = (node.get("collectionConnection") or {}).get("totalCount", 0)

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

    # Biography
    bio_obj = node.get("biographyBlurb") or {}
    biography = bio_obj.get("text", "") if isinstance(bio_obj, dict) else ""

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
