"""
Live FX rates from Frankfurter (ECB data), cached 24h.
Single source of truth for all currency conversions in Nautilus.
Falls back to last-known rates if API unavailable.
"""
import time
from typing import Dict, Optional
import httpx
import structlog

logger = structlog.get_logger()

_FALLBACK_RATES: Dict[str, float] = {
    "EUR": 1.0, "USD": 0.92, "GBP": 1.17, "CHF": 1.05,
    "SEK": 0.087, "DKK": 0.134, "NOK": 0.087, "JPY": 0.006,
    "HKD": 0.118, "AUD": 0.60, "CAD": 0.68, "CNY": 0.13, "SGD": 0.68,
}

_cache: Dict[str, float] = {}
_cache_ts: float = 0.0
_CACHE_TTL = 86400

def get_rates_sync() -> Dict[str, float]:
    global _cache, _cache_ts
    now = time.time()
    if _cache and (now - _cache_ts) < _CACHE_TTL:
        return _cache
    try:
        resp = httpx.get("https://api.frankfurter.dev/v1/latest?base=EUR", timeout=5.0, follow_redirects=True)
        resp.raise_for_status()
        data = resp.json()
        rates: Dict[str, float] = {"EUR": 1.0}
        for currency, rate in data.get("rates", {}).items():
            if rate and rate > 0:
                rates[currency.upper()] = round(1.0 / rate, 6)
        _cache = rates
        _cache_ts = now
        logger.info("fx_rates_refreshed", source="frankfurter", count=len(rates))
        return rates
    except Exception as exc:
        logger.warning("fx_rates_fetch_failed", error=str(exc), fallback=True)
        return _cache if _cache else _FALLBACK_RATES

def to_eur(amount: float, currency: str) -> Optional[float]:
    if not amount or amount <= 0:
        return None
    currency = (currency or "EUR").upper()
    if currency == "EUR":
        return round(amount, 2)
    rate = get_rates_sync().get(currency)
    if rate is None:
        logger.warning("unknown_currency", currency=currency)
        return None
    return round(amount * rate, 2)

def get_rate(currency: str) -> Optional[float]:
    currency = (currency or "EUR").upper()
    if currency == "EUR":
        return 1.0
    return get_rates_sync().get(currency)
