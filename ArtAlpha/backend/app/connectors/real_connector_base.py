"""
Base class for real auction data connectors.
Every connector MUST return lots with real URLs that actually exist.
"""
from abc import ABC, abstractmethod
from typing import List
from app.models.schemas import LotNormalized

KNOWN_AUCTION_DOMAINS = [
    "drouot.com", "invaluable.com", "christies.com",
    "sothebys.com", "bonhams.com", "catawiki.com",
    "liveauctioneers.com", "barnebys.com", "artsy.net",
    "interencheres.com", "heritage", "phillips.com",
    "cdn.drouot.com",
]


class RealConnector(ABC):
    """
    A real connector fetches live data from actual auction sources.
    The lot.url field MUST point to the exact lot page on the auction site.
    """

    @abstractmethod
    async def fetch_lots(self, limit: int = 50) -> List[LotNormalized]:
        """Fetch real lots. Never return mock data from this class."""
        pass

    def validate_lot(self, lot: LotNormalized) -> bool:
        """A lot is valid only if it has a real, verifiable URL."""
        if not lot.url:
            return False
        if not lot.url.startswith("http"):
            return False
        return any(d in lot.url for d in KNOWN_AUCTION_DOMAINS)
