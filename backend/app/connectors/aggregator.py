"""
Auction Aggregator — orchestrates all connectors.
REAL DATA ONLY. No mock/fake lots.
"""
import asyncio
from typing import List, Dict, Any
import structlog

from app.models.schemas import LotNormalized, AuctionHouseEnum
from app.connectors import drouot_connector, interencheres_connector, invaluable_connector

logger = structlog.get_logger()

CONNECTORS = {
    AuctionHouseEnum.DROUOT: drouot_connector,
    AuctionHouseEnum.INTERENCHERES: interencheres_connector,
    AuctionHouseEnum.INVALUABLE: invaluable_connector,
}

CONNECTOR_METAS = {
    AuctionHouseEnum.DROUOT: drouot_connector.CONNECTOR_META,
    AuctionHouseEnum.INTERENCHERES: interencheres_connector.CONNECTOR_META,
    AuctionHouseEnum.INVALUABLE: invaluable_connector.CONNECTOR_META,
}


async def fetch_all_lots(lots_per_source: int = 500) -> List[LotNormalized]:
    """
    Fetch REAL lots only. Never returns mock/fake data.

    Sources:
    1. DrouotRealConnector — Playwright scraping of drouot.com (always works)
    2. Live Auctioneers — REST API (requires LIVEAUCTIONEERS_API_KEY in .env)
    """
    real_lots: List[LotNormalized] = []
    seen_ids: set = set()

    # --- Drouot real scraper (Playwright) ---
    try:
        from app.connectors.drouot_real import DrouotRealConnector
        drouot = DrouotRealConnector()
        lots = await drouot.fetch_lots(lots_per_source)
        for lot in lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
        logger.info("Drouot real: fetched", count=len(lots))
    except Exception as e:
        logger.error("Drouot real connector failed", error=str(e))

    # --- Interenchères — Playwright scraping (fails gracefully if Cloudflare blocks) ---
    try:
        from app.connectors.interencheres_real_connector import fetch_lots as ie_fetch
        lots = await ie_fetch(lots_per_source)
        added = 0
        for lot in lots:
            if lot.external_id not in seen_ids:
                seen_ids.add(lot.external_id)
                real_lots.append(lot)
                added += 1
        if added:
            logger.info("Interenchères real: fetched", count=added)
    except Exception as e:
        logger.warning("Interenchères real connector skipped", error=str(e))

    # --- Invaluable — JSON API scraping ---
    try:
        from app.connectors.invaluable_connector import fetch_lots as inv_fetch
        inv_lots = await inv_fetch(lots_per_source)
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

    # --- Live Auctioneers API (requires key) ---
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

    # --- Artsy — free public API ---
    try:
        from app.connectors.artsy_connector import fetch_lots as artsy_fetch
        artsy_lots = await artsy_fetch(lots_per_source)
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

    # --- Artsy primary market — for sale artworks ---
    try:
        from app.connectors.artsy_connector import fetch_primary_lots as artsy_primary_fetch
        artsy_primary_lots = await artsy_primary_fetch(min(100, lots_per_source))
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
