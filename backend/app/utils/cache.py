import time
from typing import Any

_cache: dict = {}


def get_cached(key: str, ttl: int = 60) -> Any | None:
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < ttl:
        return entry["data"]
    return None


def set_cached(key: str, data: Any) -> None:
    _cache[key] = {"data": data, "ts": time.time()}
    # Evict oldest entries if cache grows too large
    if len(_cache) > 1000:
        oldest = sorted(_cache.items(), key=lambda x: x[1]["ts"])[:100]
        for k, _ in oldest:
            del _cache[k]
