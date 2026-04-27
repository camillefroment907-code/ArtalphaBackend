"""
Web intelligence service for Larry — fetches real-time art market data.

Strategy (no API key required):
1. Perplexity.ai via Playwright browser automation (primary)
2. DuckDuckGo Instant Answer API (free, no key)
3. Wikipedia summary REST API (free, no key)
"""
import asyncio
import re
import urllib.parse
import structlog
import httpx

logger = structlog.get_logger(__name__)

_WEB_TIMEOUT = 12  # seconds per attempt


async def _try_perplexity(query: str) -> str | None:
    """Automate perplexity.ai to get a real-time answer."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return None

    url = f"https://www.perplexity.ai/?q={urllib.parse.quote(query)}"
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.set_extra_http_headers({
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                )
            })
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)

            # Wait for answer block to appear
            selectors = [
                "[class*='prose']",
                "[class*='answer']",
                "[data-testid='answer']",
                "div.relative.default p",
            ]
            answer_text: list[str] = []
            for sel in selectors:
                try:
                    await page.wait_for_selector(sel, timeout=8000)
                    elements = await page.query_selector_all(sel)
                    for el in elements[:3]:
                        txt = (await el.inner_text()).strip()
                        if len(txt) > 80:
                            answer_text.append(txt)
                    if answer_text:
                        break
                except Exception:
                    continue

            await browser.close()
            if answer_text:
                combined = " ".join(answer_text)[:1200]
                logger.info("web_intelligence.perplexity_ok", chars=len(combined))
                return combined
    except Exception as exc:
        logger.debug("web_intelligence.perplexity_failed", error=str(exc))
    return None


async def _try_duckduckgo(query: str) -> str | None:
    """DuckDuckGo Instant Answer API — free, no key, best for named entities."""
    url = "https://api.duckduckgo.com/"
    params = {
        "q": query,
        "format": "json",
        "no_html": "1",
        "skip_disambig": "1",
    }
    try:
        async with httpx.AsyncClient(timeout=_WEB_TIMEOUT) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()

        abstract = data.get("AbstractText", "").strip()
        if abstract and len(abstract) > 40:
            logger.info("web_intelligence.duckduckgo_ok", chars=len(abstract))
            return abstract[:800]

        # Try related topics snippets
        snippets = []
        for topic in data.get("RelatedTopics", [])[:4]:
            text = topic.get("Text", "").strip()
            if text and len(text) > 30:
                snippets.append(text)
        if snippets:
            combined = " | ".join(snippets)[:800]
            logger.info("web_intelligence.duckduckgo_topics_ok", chars=len(combined))
            return combined
    except Exception as exc:
        logger.debug("web_intelligence.duckduckgo_failed", error=str(exc))
    return None


async def _try_wikipedia(query: str) -> str | None:
    """Wikipedia summary REST API — great for artist biographies."""
    # Extract likely artist name from query
    # e.g. "Basquiat recent exhibition" → "Basquiat"
    words = query.split()
    candidates = [
        "_".join(words[:3]),
        "_".join(words[:2]),
        "_".join(words[:1]),
    ]
    base = "https://en.wikipedia.org/api/rest_v1/page/summary/"
    try:
        async with httpx.AsyncClient(timeout=_WEB_TIMEOUT) as client:
            for candidate in candidates:
                slug = urllib.parse.quote(candidate)
                try:
                    r = await client.get(base + slug)
                    if r.status_code == 200:
                        data = r.json()
                        extract = data.get("extract", "").strip()
                        if extract and len(extract) > 60:
                            logger.info("web_intelligence.wikipedia_ok", slug=candidate)
                            return extract[:700]
                except Exception:
                    continue
    except Exception as exc:
        logger.debug("web_intelligence.wikipedia_failed", error=str(exc))
    return None


async def query_web_intelligence(message: str) -> str | None:
    """
    Try all web intelligence strategies in order.
    Returns a context string for Larry, or None if all fail.
    """
    # Run perplexity and duckduckgo concurrently; fall back to wikipedia
    perplexity_task = asyncio.create_task(_try_perplexity(message))
    ddg_task = asyncio.create_task(_try_duckduckgo(message))

    # Wait for both, take first non-None result
    done, pending = await asyncio.wait(
        [perplexity_task, ddg_task],
        timeout=_WEB_TIMEOUT + 2,
        return_when=asyncio.FIRST_COMPLETED,
    )

    result: str | None = None

    # Check completed tasks in priority order
    for task in [perplexity_task, ddg_task]:
        if task in done and not task.cancelled():
            try:
                val = task.result()
                if val:
                    result = val
                    break
            except Exception:
                pass

    # Cancel pending tasks
    for task in pending:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass

    if result:
        return result

    # Last resort: Wikipedia
    return await _try_wikipedia(message)


def needs_web_search(message: str) -> bool:
    """Determine if the user's message warrants a real-time web lookup."""
    keywords = [
        "recent", "latest", "news", "exhibition", "show", "press",
        "sold", "auction", "2024", "2025", "2026", "currently", "now",
        "today", "this year", "last year", "just", "announced", "record",
        "price", "estimate", "hammer", "lot", "sotheby", "christie",
        "phillips", "bonham", "artsy", "contemporary", "market",
    ]
    msg_lower = message.lower()
    return any(kw in msg_lower for kw in keywords)
