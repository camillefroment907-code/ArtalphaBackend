"""
Tiered cache: L1 (in-process OrderedDict) + L2 (Redis).

Design:
  - L1 is always consulted first — zero-latency for hot keys.
  - L2 is consulted only on L1 miss. On hit, value is promoted to L1.
  - Writes go to both layers simultaneously (fire-and-forget for L2).
  - Redis is optional: if the connection fails at startup or any Redis
    operation raises, the code silently degrades to L1-only. The app
    never crashes because Redis is unavailable.

Usage:
    from app.utils.redis_cache import get_tiered, set_tiered, invalidate_tiered

All existing call-sites that use get_cached/set_cached (L1 only) continue
to work unchanged; this module adds an opt-in L2 layer for the highest-
traffic keys (lot_detail, comparables, hammer_history, for-you).
"""
from __future__ import annotations

import json
import logging
import time
import threading
from collections import OrderedDict
from typing import Any

log = logging.getLogger(__name__)

# ── L1 (in-process) ──────────────────────────────────────────────────────────
_lock = threading.Lock()
_store: OrderedDict[str, dict] = OrderedDict()
_MAX = 2_000

def _l1_get(key: str, ttl: int) -> Any | None:
    with _lock:
        entry = _store.get(key)
        if entry is None:
            return None
        if time.monotonic() - entry["ts"] > ttl:
            del _store[key]
            return None
        _store.move_to_end(key)
        return entry["data"]

def _l1_set(key: str, data: Any) -> None:
    with _lock:
        _store[key] = {"data": data, "ts": time.monotonic()}
        _store.move_to_end(key)
        while len(_store) > _MAX:
            _store.popitem(last=False)

def _l1_del(key: str) -> None:
    with _lock:
        _store.pop(key, None)

def _l1_del_prefix(prefix: str) -> None:
    with _lock:
        for k in [k for k in _store if k.startswith(prefix)]:
            del _store[k]


# ── L2 (Redis) ───────────────────────────────────────────────────────────────
_redis_client = None
_redis_init_attempted = False

def _get_redis():
    global _redis_client, _redis_init_attempted
    if _redis_init_attempted:
        return _redis_client
    _redis_init_attempted = True
    try:
        import redis as _redis
        from app.config import get_settings
        settings = get_settings()
        _redis_client = _redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
            decode_responses=False,
        )
        _redis_client.ping()
        log.info("redis_cache: L2 Redis connected at %s", settings.redis_url)
    except Exception as exc:
        log.warning("redis_cache: Redis unavailable — running L1-only: %s", exc)
        _redis_client = None
    return _redis_client


def _l2_get(key: str, ttl: int) -> Any | None:
    r = _get_redis()
    if r is None:
        return None
    try:
        raw = r.get(f"nautilus:{key}")
        if raw is None:
            return None
        payload = json.loads(raw)
        # Validate TTL residual (Redis TTL is set at write; extra guard here)
        if time.time() - payload.get("ts", 0) > ttl:
            r.delete(f"nautilus:{key}")
            return None
        return payload["data"]
    except Exception as exc:
        log.debug("redis_cache L2 get error key=%s: %s", key, exc)
        return None


def _l2_set(key: str, data: Any, ttl: int) -> None:
    r = _get_redis()
    if r is None:
        return
    try:
        payload = json.dumps({"data": data, "ts": time.time()}, default=str)
        r.setex(f"nautilus:{key}", ttl + 5, payload.encode())
    except Exception as exc:
        log.debug("redis_cache L2 set error key=%s: %s", key, exc)


def _l2_del(key: str) -> None:
    r = _get_redis()
    if r is None:
        return
    try:
        r.delete(f"nautilus:{key}")
    except Exception:
        pass


def _l2_del_prefix(prefix: str) -> None:
    r = _get_redis()
    if r is None:
        return
    try:
        keys = r.keys(f"nautilus:{prefix}*")
        if keys:
            r.delete(*keys)
    except Exception:
        pass


# ── Public API ────────────────────────────────────────────────────────────────

def get_tiered(key: str, ttl: int = 60) -> Any | None:
    """L1 → L2 lookup. Promotes L2 hits to L1."""
    hit = _l1_get(key, ttl)
    if hit is not None:
        return hit
    hit = _l2_get(key, ttl)
    if hit is not None:
        _l1_set(key, hit)
    return hit


def set_tiered(key: str, data: Any, ttl: int = 60) -> None:
    """Write to both L1 and L2."""
    _l1_set(key, data)
    _l2_set(key, data, ttl)


def invalidate_tiered(key: str) -> None:
    _l1_del(key)
    _l2_del(key)


def invalidate_tiered_prefix(prefix: str) -> None:
    _l1_del_prefix(prefix)
    _l2_del_prefix(prefix)
