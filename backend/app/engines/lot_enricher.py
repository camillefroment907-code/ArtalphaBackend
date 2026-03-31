"""
Lot Enricher — fetches full lot details from Drouot lot pages via Playwright.
Fills in: estimate_low, estimate_high, description, category.
"""
import asyncio
import json
import re
from typing import Optional
import structlog

logger = structlog.get_logger().bind(engine="lot_enricher")


def _parse_price(text: str) -> Optional[float]:
    if not text:
        return None
    cleaned = re.sub(r"[€$£¥\s\u00a0\u202f]", "", str(text)).replace(",", "").replace("\xa0", "")
    # Remove non-numeric except decimal point
    nums = re.findall(r"\d+(?:\.\d+)?", cleaned)
    for n in nums:
        try:
            val = float(n)
            if val > 0:
                return val
        except ValueError:
            continue
    return None


async def enrich_drouot_lot(url: str) -> dict:
    """Fetch full lot details from a Drouot lot page via Playwright."""
    result = {}
    try:
        from playwright.async_api import async_playwright
        from bs4 import BeautifulSoup

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            ctx = await browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 900},
            )
            page = await ctx.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(2000)
            html = await page.content()
            await browser.close()

        soup = BeautifulSoup(html, "lxml")

        # 1. JSON-LD structured data (Drouot uses Product schema)
        for script in soup.select("script[type='application/ld+json']"):
            try:
                data = json.loads(script.string or "")
                if isinstance(data, list):
                    data = data[0] if data else {}
                if isinstance(data, dict):
                    desc = data.get("description")
                    if desc:
                        result["description"] = str(desc)[:2000]

                    # Category directly from JSON-LD
                    cat = data.get("category")
                    if cat and not result.get("category"):
                        result["category"] = str(cat)

                    offers = data.get("offers", {})
                    if isinstance(offers, dict):
                        p = _parse_price(str(offers.get("price", "")))
                        if p:
                            result["current_price"] = p
                        result["currency"] = offers.get("priceCurrency", "EUR")

                    price_spec = data.get("priceSpecification", {})
                    if isinstance(price_spec, dict):
                        lo = _parse_price(str(price_spec.get("minPrice", "")))
                        hi = _parse_price(str(price_spec.get("maxPrice", "")))
                        if lo:
                            result["estimate_low"] = lo
                        if hi:
                            result["estimate_high"] = hi
            except Exception:
                pass

        # 2. __NEXT_DATA__
        nd = soup.select_one("script#__NEXT_DATA__")
        if nd:
            try:
                ndata = json.loads(nd.string or "")
                props = ndata.get("props", {}).get("pageProps", {})
                lot_data = props.get("lot") or props.get("item") or props.get("data") or props

                if isinstance(lot_data, dict):
                    for key in ["estimationMin", "estimate_low", "lowEstimate", "prixMin", "starting_bid"]:
                        val = lot_data.get(key)
                        if val and not result.get("estimate_low"):
                            p = _parse_price(str(val))
                            if p:
                                result["estimate_low"] = p

                    for key in ["estimationMax", "estimate_high", "highEstimate", "prixMax"]:
                        val = lot_data.get(key)
                        if val and not result.get("estimate_high"):
                            p = _parse_price(str(val))
                            if p:
                                result["estimate_high"] = p

                    for key in ["description", "designation", "lot_description", "lotDescription", "title_detail"]:
                        val = lot_data.get(key)
                        if val and not result.get("description"):
                            result["description"] = str(val)[:2000]

                    for key in ["category", "categoryName", "rubrique", "type"]:
                        val = lot_data.get(key)
                        if val and not result.get("category"):
                            result["category"] = str(val)
            except Exception:
                pass

        # 3. HTML fallback — look for price/estimate text
        if not result.get("estimate_low"):
            full_text = soup.get_text()
            # Look for "Estimation : X € - Y €" or "X 000 - Y 000 €"
            est_match = re.search(
                r"[Ee]stimat[ion]*\s*[:：]?\s*([\d\s\u00a0\u202f]+)\s*[-–]\s*([\d\s\u00a0\u202f]+)\s*€",
                full_text
            )
            if est_match:
                lo = _parse_price(est_match.group(1))
                hi = _parse_price(est_match.group(2))
                if lo:
                    result["estimate_low"] = lo
                if hi:
                    result["estimate_high"] = hi
            else:
                # Single estimate
                single = re.search(
                    r"[Ee]stimat[ion]*\s*[:：]?\s*([\d\s\u00a0\u202f]+)\s*€",
                    full_text
                )
                if single:
                    lo = _parse_price(single.group(1))
                    if lo:
                        result["estimate_low"] = lo
                        result["estimate_high"] = round(lo * 1.5)

        # 4. Description from visible elements
        if not result.get("description"):
            for sel in [
                "[class*=description]", "[class*=Description]",
                "[class*=designation]", "[class*=Designation]",
                ".lot-description", ".description",
            ]:
                el = soup.select_one(sel)
                if el:
                    t = el.get_text(strip=True)
                    if len(t) > 30:
                        result["description"] = t[:2000]
                        break

        # 5. Category from breadcrumb
        if not result.get("category"):
            for sel in ["[aria-label=breadcrumb]", "[class*=breadcrumb]", "nav ol", "nav ul"]:
                el = soup.select_one(sel)
                if el:
                    links = el.select("a, li")
                    texts = [l.get_text(strip=True) for l in links if l.get_text(strip=True)]
                    if len(texts) >= 2:
                        result["category"] = texts[-1]
                        break

    except Exception as e:
        logger.warning("Enrichment failed", url=url, error=str(e))

    return result


async def enrich_lot_batch(lot_ids: list, db) -> int:
    """Enrich a batch of lots. Returns count enriched."""
    from sqlalchemy import text
    enriched = 0

    for lot_id, url, source in lot_ids:
        try:
            if "drouot.com" in (url or ""):
                details = await enrich_drouot_lot(url)
            else:
                details = {}

            if not details:
                continue

            updates = []
            params = {"id": str(lot_id)}

            if details.get("estimate_low"):
                updates.append("estimate_low = :est_low")
                params["est_low"] = float(details["estimate_low"])

            if details.get("estimate_high"):
                updates.append("estimate_high = :est_high")
                params["est_high"] = float(details["estimate_high"])

            if details.get("description"):
                desc = details["description"][:2000]
                # Skip bot-protection pages
                if "security service" in desc.lower() or "verifies you are not a bot" in desc.lower():
                    desc = None
                if desc:
                    updates.append("description = :desc")
                    params["desc"] = desc

            if details.get("category"):
                updates.append("category = :cat")
                params["cat"] = details["category"]

            if updates:
                await db.execute(
                    text(f"UPDATE lots SET {', '.join(updates)} WHERE id = :id"),
                    params
                )
                enriched += 1

            await asyncio.sleep(1.0)

        except Exception as e:
            logger.warning("Lot enrichment error", lot_id=lot_id, error=str(e))

    await db.commit()
    return enriched
