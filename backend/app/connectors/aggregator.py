"""
Auction Aggregator — orchestrates all connectors.
REAL DATA ONLY. No mock/fake lots.
"""
import asyncio
import uuid
from datetime import datetime
from typing import List, Dict, Any
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum
from app.connectors import drouot_connector
# interencheres_connector disabled — Cloudflare blocks all access, returns 0 real lots
# invaluable_connector disabled — 403 Cloudflare
# christies_connector disabled — no public API
# sothebys_connector disabled — no public API

logger = structlog.get_logger()

CONNECTORS = {
    AuctionHouseEnum.DROUOT: drouot_connector,
}

CONNECTOR_METAS = {
    AuctionHouseEnum.DROUOT: drouot_connector.CONNECTOR_META,
}


async def _track_connector(
    name: str,
    coro,
    timeout: float = 120.0,
) -> List[LotNormalized]:
    """
    Wrap a connector coroutine with timing, error handling, and scrape_runs persistence.
    Always returns a list (empty on failure) — never raises.
    """
    started_at = datetime.utcnow()
    run_id = uuid.uuid4()
    lots: List[LotNormalized] = []
    status = "SUCCESS"
    error_message = None

    try:
        lots = await asyncio.wait_for(coro, timeout=timeout)
        if not lots:
            status = "EMPTY"
    except asyncio.TimeoutError:
        status = "FAILED"
        error_message = f"Timeout after {timeout}s"
        logger.warning("connector_timeout", connector=name, timeout=timeout)
    except Exception as e:
        status = "FAILED"
        error_message = f"{type(e).__name__}: {str(e)[:500]}"
        logger.warning("connector_error", connector=name, error=str(e))

    ended_at = datetime.utcnow()
    duration = round((ended_at - started_at).total_seconds(), 2)

    try:
        from app.database import BgSessionLocal
        from app.models.scrape_run import ScrapeRun
        async with BgSessionLocal() as session:
            run = ScrapeRun(
                run_id=run_id,
                source=name,
                started_at=started_at,
                ended_at=ended_at,
                status=status,
                n_fetched=len(lots),
                error_message=error_message,
                duration_seconds=duration,
            )
            session.add(run)
            await session.commit()
    except Exception as db_err:
        logger.warning("scrape_run_write_failed", connector=name, error=str(db_err))

    logger.info("connector_done", connector=name, status=status, n_fetched=len(lots), duration_s=duration)
    return lots


async def fetch_all_lots(lots_per_source: int = 5000) -> List[LotNormalized]:
    """
    Fetch REAL lots only. Never returns mock/fake data.
    Each connector is wrapped with _track_connector for metrics and error handling.
    """
    real_lots: List[LotNormalized] = []
    seen_ids: set = set()

    def _merge(lots: List[LotNormalized]) -> int:
        added = 0
        for lot in lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        return added

    # --- Drouot via ScraperAPI headless render ---
    from app.connectors.drouot_scraperapi_connector import fetch_lots as drouot_fetch
    _merge(await _track_connector("DROUOT", drouot_fetch(lots_per_source), timeout=180))

    # --- Invaluable — JSON API scraping ---
    from app.connectors.invaluable_connector import fetch_lots as inv_fetch
    _merge(await _track_connector("INVALUABLE", inv_fetch(lots_per_source), timeout=300))

    # --- LiveAuctioneers ---
    from app.connectors.liveauctioneers_connector import fetch_lots as la_fetch
    _merge(await _track_connector("LIVEAUCTIONEERS", la_fetch(lots_per_source), timeout=120))

    # --- Artsy auction lots ---
    from app.connectors.artsy_connector import fetch_lots as artsy_fetch
    _merge(await _track_connector("ARTSY", artsy_fetch(min(5000, lots_per_source)), timeout=180))

    # --- Auctionet — 300+ European auction houses ---
    from app.connectors.auctionet_connector import fetch_lots as auctionet_fetch
    _merge(await _track_connector("AUCTIONET", auctionet_fetch(lots_per_source), timeout=120))

    # --- ArtMarket API — Christie's, Sotheby's, Bonhams, Phillips (30 min max) ---
    from app.connectors.artmarketapi_connector import ArtMarketAPIConnector
    _merge(await _track_connector("ARTMARKETAPI", ArtMarketAPIConnector().fetch_lots(lots_per_source), timeout=1800))

    # --- Phillips ---
    from app.connectors.phillips_connector import fetch_lots as phillips_fetch
    _merge(await _track_connector("PHILLIPS", phillips_fetch(lots_per_source), timeout=60))

    # --- Artcurial ---
    from app.connectors.artcurial_connector import fetch_lots as artcurial_fetch
    _merge(await _track_connector("ARTCURIAL", artcurial_fetch(lots_per_source), timeout=60))

    # --- Artsper ---
    from app.connectors.artsper_connector import fetch_lots as artsper_fetch
    _merge(await _track_connector("ARTSPER", artsper_fetch(lots_per_source), timeout=60))

    # --- Saatchi Art ---
    from app.connectors.saatchiart_connector import fetch_lots as saatchi_fetch
    _merge(await _track_connector("SAATCHIART", saatchi_fetch(lots_per_source), timeout=60))

    # --- Singulart ---
    from app.connectors.singulart_connector import fetch_lots as singulart_fetch
    _merge(await _track_connector("SINGULART", singulart_fetch(lots_per_source), timeout=60))

    # --- Heritage Auctions — disabled (Railway IP blocked) ---
    if False:
        from app.connectors.heritage_connector import fetch_lots as heritage_fetch
        _merge(await _track_connector("HERITAGE", heritage_fetch(lots_per_source), timeout=60))

    # --- Catawiki ---
    from app.connectors.catawiki_connector import fetch_lots as catawiki_fetch
    _merge(await _track_connector("CATAWIKI", catawiki_fetch(lots_per_source), timeout=120))

    # --- Bonhams ---
    from app.connectors.bonhams_connector import fetch_lots as bonhams_fetch
    _merge(await _track_connector("BONHAMS", bonhams_fetch(lots_per_source), timeout=60))

    # --- eBay Art ---
    from app.connectors.ebay_connector import fetch_lots as ebay_fetch
    _merge(await _track_connector("EBAY", ebay_fetch(lots_per_source), timeout=60))

    # --- Christie's ---
    from app.connectors.christies_connector import fetch_lots as christies_fetch
    _merge(await _track_connector("CHRISTIES", christies_fetch(lots_per_source), timeout=60))

    # --- Sotheby's ---
    from app.connectors.sothebys_connector import fetch_lots as sothebys_fetch
    _merge(await _track_connector("SOTHEBYS", sothebys_fetch(lots_per_source), timeout=60))

    # --- Artsy primary market ---
    from app.connectors.artsy_connector import fetch_primary_lots as artsy_primary_fetch
    _merge(await _track_connector("ARTSY_PRIMARY", artsy_primary_fetch(min(10000, lots_per_source * 2)), timeout=600))

    logger.info("aggregation_complete", total=len(real_lots))
    return real_lots


def get_house_reputation(source: AuctionHouseEnum) -> float:
    meta = CONNECTOR_METAS.get(source)
    if meta:
        return meta.get("house_reputation_score", 0.5)
    return 0.5


def get_all_sources_meta() -> List[Dict[str, Any]]:
    return list(CONNECTOR_METAS.values())
