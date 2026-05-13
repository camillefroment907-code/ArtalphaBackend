"""
Auction Aggregator — orchestrates all connectors.
REAL DATA ONLY. No mock/fake lots.
"""
import asyncio
from typing import List, Dict, Any
import structlog


async def _with_timeout(coro, timeout: float, name: str):
    """Run a coroutine with a timeout. Returns [] on timeout or error."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning("connector_timeout", connector=name, timeout=timeout)
        return []
    except Exception as e:
        logger.warning("connector_error", connector=name, error=str(e))
        return []

from app.models.schemas import LotNormalized, AuctionHouseEnum
from app.connectors import drouot_connector
# interencheres_connector disabled — Cloudflare blocks all access, returns 0 real lots
# invaluable_connector disabled — 403 Cloudflare
# christies_connector disabled — no public API
# sothebys_connector disabled — no public API

logger = structlog.get_logger()

CONNECTORS = {
    AuctionHouseEnum.DROUOT: drouot_connector,
    # AuctionHouseEnum.INTERENCHERES: interencheres_connector,  # Cloudflare blocked
    # AuctionHouseEnum.INVALUABLE: invaluable_connector,        # Cloudflare blocked
    # AuctionHouseEnum.CHRISTIES: christies_connector,          # no public API
    # AuctionHouseEnum.SOTHEBYS: sothebys_connector,            # no public API
}

CONNECTOR_METAS = {
    AuctionHouseEnum.DROUOT: drouot_connector.CONNECTOR_META,
    # AuctionHouseEnum.INTERENCHERES: interencheres_connector.CONNECTOR_META,
    # AuctionHouseEnum.INVALUABLE: invaluable_connector.CONNECTOR_META,
    # AuctionHouseEnum.CHRISTIES: christies_connector.CONNECTOR_META,
    # AuctionHouseEnum.SOTHEBYS: sothebys_connector.CONNECTOR_META,
}


async def fetch_all_lots(lots_per_source: int = 5000) -> List[LotNormalized]:
    """
    Fetch REAL lots only. Never returns mock/fake data.

    Sources:
    1. DrouotRealConnector — Playwright scraping of drouot.com (always works)
    2. Live Auctioneers — REST API (requires LIVEAUCTIONEERS_API_KEY in .env)
    """
    real_lots: List[LotNormalized] = []
    seen_ids: set = set()

    # --- Bukowskis — Swedish auction house, no key needed, listing HTML scraping ---
    try:
        from app.connectors.bukowskis_connector import fetch_lots as bukowskis_fetch
        bukowskis_lots = await _with_timeout(bukowskis_fetch(lots_per_source), timeout=120, name="bukowskis")
        added = 0
        for lot in bukowskis_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Bukowskis: fetched", count=added)
    except Exception as e:
        logger.warning("Bukowskis connector skipped", error=str(e))

    # --- Bruun Rasmussen — Danish auction house, no key needed, JSON-LD scraping ---
    try:
        from app.connectors.bruun_rasmussen_connector import fetch_lots as br_fetch
        br_lots = await _with_timeout(br_fetch(lots_per_source), timeout=120, name="bruun_rasmussen")
        added = 0
        for lot in br_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Bruun Rasmussen: fetched", count=added)
    except Exception as e:
        logger.warning("Bruun Rasmussen connector skipped", error=str(e))

    # --- Drouot via ScraperAPI headless render (replaces Playwright) ---
    # Requires SCRAPERAPI_KEY env var. Uses render=true + French IP to bypass Cloudflare.
    try:
        from app.connectors.drouot_scraperapi_connector import fetch_lots as drouot_fetch
        drouot_lots = await _with_timeout(drouot_fetch(lots_per_source), timeout=180, name="drouot_scraperapi")
        added = 0
        for lot in drouot_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Drouot (ScraperAPI): fetched", count=added)
    except Exception as e:
        logger.warning("Drouot ScraperAPI connector skipped", error=str(e))

    # --- Drouot via Apify (saswave/drouot-scraper) — requires APIFY_API_TOKEN ---
    try:
        from app.connectors.apify_drouot_connector import fetch_lots as apify_drouot_fetch
        apify_drouot_lots = await _with_timeout(apify_drouot_fetch(lots_per_source), timeout=300, name="apify_drouot")
        added = 0
        for lot in apify_drouot_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Drouot (Apify): fetched", count=added)
    except Exception as e:
        logger.warning("Drouot Apify connector skipped", error=str(e))

    # --- Invaluable via Apify (lexis-solutions/invaluable-scraper) — requires APIFY_API_TOKEN ---
    try:
        from app.connectors.apify_invaluable_connector import fetch_lots as apify_invaluable_fetch
        apify_invaluable_lots = await _with_timeout(apify_invaluable_fetch(lots_per_source), timeout=300, name="apify_invaluable")
        added = 0
        for lot in apify_invaluable_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Invaluable (Apify): fetched", count=added)
    except Exception as e:
        logger.warning("Invaluable Apify connector skipped", error=str(e))

    # --- Interenchères — disabled (Cloudflare blocks all access, 0 real lots) ---
    # try:
    #     from app.connectors.interencheres_real_connector import fetch_lots as ie_fetch
    #     lots = await ie_fetch(lots_per_source)
    #     ...
    # except Exception as e:
    #     logger.warning("Interenchères real connector skipped", error=str(e))

    # --- Invaluable — JSON API scraping (300s timeout) ---
    try:
        from app.connectors.invaluable_connector import fetch_lots as inv_fetch
        inv_lots = await _with_timeout(inv_fetch(lots_per_source), timeout=300, name="invaluable")
        added = 0
        for lot in inv_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Invaluable: fetched", count=added)
    except Exception as e:
        logger.warning("Invaluable connector skipped", error=str(e))

    # --- LiveAuctioneers direct API (no key required, browser headers) ---
    try:
        from app.connectors.liveauctioneers_connector import fetch_lots as la_fetch
        la_lots = await _with_timeout(la_fetch(lots_per_source), timeout=120, name="liveauctioneers")
        added = 0
        for lot in la_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("LiveAuctioneers: fetched", count=added)
    except Exception as e:
        logger.warning("LiveAuctioneers connector skipped", error=str(e))

    # --- Artsy — free public API (auction lots, full cursor pagination, 180s timeout) ---
    try:
        from app.connectors.artsy_connector import fetch_lots as artsy_fetch
        artsy_lots = await _with_timeout(artsy_fetch(min(5000, lots_per_source)), timeout=180, name="artsy")
        added = 0
        for lot in artsy_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Artsy: fetched", count=added)
    except Exception as e:
        logger.warning("Artsy connector skipped", error=str(e))

    # --- Auctionet — 300+ European auction houses, public API, no key needed ---
    try:
        from app.connectors.auctionet_connector import fetch_lots as auctionet_fetch
        auctionet_lots = await _with_timeout(auctionet_fetch(lots_per_source), timeout=120, name="auctionet")
        added = 0
        for lot in auctionet_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Auctionet: fetched", count=added)
    except Exception as e:
        logger.warning("Auctionet connector skipped", error=str(e))

    # --- ArtMarket API — Christie's, Sotheby's, Bonhams, Phillips via aggregator (1800s timeout) ---
    try:
        from app.connectors.artmarketapi_connector import ArtMarketAPIConnector
        amapi = ArtMarketAPIConnector()
        amapi_lots = await _with_timeout(amapi.fetch_lots(lots_per_source), timeout=1800, name="artmarketapi")  # 30 min max
        added = 0
        for lot in amapi_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("ArtMarket API: fetched", count=added)
    except Exception as e:
        logger.warning("ArtMarket API connector skipped", error=str(e))

    # --- Phillips — public JSON API ---
    try:
        from app.connectors.phillips_connector import fetch_lots as phillips_fetch
        phillips_lots = await _with_timeout(phillips_fetch(lots_per_source), timeout=60, name="phillips")
        added = 0
        for lot in phillips_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Phillips: fetched", count=added)
    except Exception as e:
        logger.warning("Phillips connector skipped", error=str(e))

    # --- Artcurial — public JSON API ---
    try:
        from app.connectors.artcurial_connector import fetch_lots as artcurial_fetch
        artcurial_lots = await _with_timeout(artcurial_fetch(lots_per_source), timeout=60, name="artcurial")
        added = 0
        for lot in artcurial_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Artcurial: fetched", count=added)
    except Exception as e:
        logger.warning("Artcurial connector skipped", error=str(e))

    # --- Artsper — gallery platform ---
    try:
        from app.connectors.artsper_connector import fetch_lots as artsper_fetch
        artsper_lots = await _with_timeout(artsper_fetch(lots_per_source), timeout=120, name="artsper")
        added = 0
        for lot in artsper_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Artsper: fetched", count=added)
    except Exception as e:
        logger.warning("Artsper connector skipped", error=str(e))

    # --- Saatchi Art — primary market ---
    try:
        from app.connectors.saatchiart_connector import fetch_lots as saatchi_fetch
        saatchi_lots = await _with_timeout(saatchi_fetch(lots_per_source), timeout=120, name="saatchi")
        added = 0
        for lot in saatchi_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Saatchi Art: fetched", count=added)
    except Exception as e:
        logger.warning("Saatchi Art connector skipped", error=str(e))

    # --- Singulart — primary market ---
    try:
        from app.connectors.singulart_connector import fetch_lots as singulart_fetch
        singulart_lots = await _with_timeout(singulart_fetch(lots_per_source), timeout=120, name="singulart")
        added = 0
        for lot in singulart_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Singulart: fetched", count=added)
    except Exception as e:
        logger.warning("Singulart connector skipped", error=str(e))

    # --- Heritage Auctions — public fine art lots ---
    if False:  # Blocked by Railway IP — re-enable if proxy added
        try:
            from app.connectors.heritage_connector import fetch_lots as heritage_fetch
            heritage_lots = await heritage_fetch(lots_per_source)
            added = 0
            for lot in heritage_lots:
                if lot.external_id not in seen_ids:
                    seen_ids.add(lot.external_id)
                    real_lots.append(lot)
                    added += 1
            if added:
                logger.info("Heritage Auctions: fetched", count=added)
        except Exception as e:
            logger.warning("Heritage Auctions connector skipped", error=str(e))

    # --- Catawiki — fine art auction lots (needs SCRAPERAPI_KEY on Railway) ---
    try:
        from app.connectors.catawiki_connector import fetch_lots as catawiki_fetch
        catawiki_lots = await _with_timeout(catawiki_fetch(lots_per_source), timeout=120, name="catawiki")
        added = 0
        for lot in catawiki_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Catawiki: fetched", count=added)
    except Exception as e:
        logger.warning("Catawiki connector skipped", error=str(e))

    # --- Barnebys — disabled (no public API, returns 0 real lots) ---
    # try:
    #     from app.connectors.barnebys_connector import fetch_lots as barnebys_fetch
    #     ...
    # except Exception as e:
    #     logger.warning("Barnebys connector skipped", error=str(e))

    # --- Bonhams — major UK/US auction house ---
    try:
        from app.connectors.bonhams_connector import fetch_lots as bonhams_fetch
        bonhams_lots = await bonhams_fetch(lots_per_source)
        added = 0
        for lot in bonhams_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Bonhams: fetched", count=added)
    except Exception as e:
        logger.warning("Bonhams connector skipped", error=str(e))

    # --- eBay Art — auction listings (requires EBAY_CLIENT_ID + EBAY_CLIENT_SECRET) ---
    try:
        from app.connectors.ebay_connector import fetch_lots as ebay_fetch
        ebay_lots = await ebay_fetch(lots_per_source)
        added = 0
        for lot in ebay_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("eBay Art: fetched", count=added)
    except Exception as e:
        logger.warning("eBay connector skipped", error=str(e))

    # --- Christie's — blue chip auction house ---
    try:
        from app.connectors.christies_connector import fetch_lots as christies_fetch
        christies_lots = await christies_fetch(lots_per_source)
        added = 0
        for lot in christies_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Christie's: fetched", count=added)
    except Exception as e:
        logger.warning("Christie's connector skipped", error=str(e))

    # --- Sotheby's — blue chip auction house ---
    try:
        from app.connectors.sothebys_connector import fetch_lots as sothebys_fetch
        sothebys_lots = await sothebys_fetch(lots_per_source)
        added = 0
        for lot in sothebys_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Sotheby's: fetched", count=added)
    except Exception as e:
        logger.warning("Sotheby's connector skipped", error=str(e))

    # --- Artsy primary market — for sale artworks (600s timeout for 10K lots) ---
    try:
        from app.connectors.artsy_connector import fetch_primary_lots as artsy_primary_fetch
        artsy_primary_lots = await _with_timeout(artsy_primary_fetch(min(10000, lots_per_source * 2)), timeout=600, name="artsy_primary")
        added = 0
        for lot in artsy_primary_lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Artsy primary: fetched", count=added)
    except Exception as e:
        logger.warning("Artsy primary connector skipped", error=str(e))

    # NOTE: Invaluable past lots and ArtMarket API historical are NOT in the regular
    # 15-min poll cycle — they take hours and block the pipeline.
    # Run them manually via: python -m app.scripts.bulk_ingest

    logger.info("Aggregation complete — real lots only", total=len(real_lots))
    return real_lots


def get_house_reputation(source: AuctionHouseEnum) -> float:
    meta = CONNECTOR_METAS.get(source)
    if meta:
        return meta.get("house_reputation_score", 0.5)
    return 0.5


def get_all_sources_meta() -> List[Dict[str, Any]]:
    return list(CONNECTOR_METAS.values())
