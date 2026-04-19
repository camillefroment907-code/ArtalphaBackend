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

    # --- Drouot real scraper (Playwright) — 90s timeout, may hang on Railway ---
    try:
        from app.connectors.drouot_real import DrouotRealConnector
        drouot = DrouotRealConnector()
        lots = await _with_timeout(drouot.fetch_lots(lots_per_source), timeout=90, name="drouot")
        for lot in lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
        if lots:
            logger.info("Drouot real: fetched", count=len(lots))
    except Exception as e:
        logger.error("Drouot real connector failed", error=str(e))

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

    # --- LiveAuctioneers via Apify (preferred when APIFY_API_TOKEN is set) ---
    _apify_token = None
    try:
        from app.config import get_settings as _gs
        _apify_token = _gs().apify_api_token
    except Exception:
        import os as _os
        _apify_token = _os.environ.get("APIFY_API_TOKEN")

    if _apify_token:
        try:
            from app.connectors.apify_liveauctioneers_connector import fetch_liveauctioneers_via_apify
            apify_lots = await fetch_liveauctioneers_via_apify(lots_per_source)
            added = 0
            for lot in apify_lots:
                if lot.external_id not in seen_ids:
                    seen_ids.add(lot.external_id)
                    real_lots.append(lot)
                    added += 1
            if added:
                logger.info("LiveAuctioneers (Apify): fetched", count=added)
        except Exception as e:
            logger.warning("LiveAuctioneers Apify connector skipped", error=str(e))
    else:
        # --- Live Auctioneers direct API (requires LIVEAUCTIONEERS_API_KEY) ---
        try:
            from app.connectors.liveauctioneers_connector import fetch_lots as la_fetch
            lots = await la_fetch(lots_per_source)
            for lot in lots:
                if lot.external_id not in seen_ids:
                    seen_ids.add(lot.external_id)
                    real_lots.append(lot)
            if lots:
                logger.info("Live Auctioneers: fetched", count=len(lots))
        except Exception as e:
            logger.error("Live Auctioneers connector failed", error=str(e))

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

    # --- ArtMarket API — Christie's, Sotheby's, Bonhams, Phillips via aggregator (1800s timeout) ---
    try:
        from app.connectors.artmarketapi_connector import ArtMarketAPIConnector
        amapi = ArtMarketAPIConnector()
        amapi_lots = await _with_timeout(amapi.fetch_lots(lots_per_source), timeout=1800, name="artmarketapi")
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
        phillips_lots = await phillips_fetch(lots_per_source)
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
        artcurial_lots = await artcurial_fetch(lots_per_source)
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
        artsper_lots = await artsper_fetch(lots_per_source)
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
        saatchi_lots = await saatchi_fetch(lots_per_source)
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
        singulart_lots = await singulart_fetch(lots_per_source)
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

    # --- Catawiki — fine art auction lots ---
    if False:  # Blocked by Railway IP — re-enable if proxy added
        try:
            from app.connectors.catawiki_connector import fetch_lots as catawiki_fetch
            catawiki_lots = await catawiki_fetch(lots_per_source)
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

    logger.info("Aggregation complete — real lots only", total=len(real_lots))
    return real_lots


def get_house_reputation(source: AuctionHouseEnum) -> float:
    meta = CONNECTOR_METAS.get(source)
    if meta:
        return meta.get("house_reputation_score", 0.5)
    return 0.5


def get_all_sources_meta() -> List[Dict[str, Any]]:
    return list(CONNECTOR_METAS.values())
