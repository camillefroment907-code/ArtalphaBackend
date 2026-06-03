"""
In-process LRU cache with per-entry TTL.

Replaces the naive dict with an OrderedDict so eviction is O(1).
Thread-safe via a single lock — safe for asyncio + threaded Celery workers
on the same process (FastAPI runs in a single process with async workers).

Capacity: 2 000 entries (up from 1 000).
Default TTL: 60 s (callers override per use-case).

Public API (unchanged from v1 — all call-sites remain compatible):
    get_cached(key, ttl=60) → Any | None
    set_cached(key, data)   → None          ← signature unchanged
    invalidate(key)         → None          ← new helper
    invalidate_prefix(pfx)  → None          ← new helper
"""
from __future__ import annotations

import time
import threading
from collections import OrderedDict
from typing import Any

_lock = threading.Lock()
_store: OrderedDict[str, dict] = OrderedDict()
_MAX = 2_000


# ── Public API ────────────────────────────────────────────────────────────────

def get_cached(key: str, ttl: int = 60) -> Any | None:
    """Return cached value if it exists and has not expired, else None."""
    with _lock:
        entry = _store.get(key)
        if entry is None:
            return None
        if time.monotonic() - entry["ts"] > ttl:
            # Expired — remove immediately so stale data never leaks
            del _store[key]
            return None
        # Move to end = mark as most-recently used
        _store.move_to_end(key)
        return entry["data"]


def set_cached(key: str, data: Any) -> None:
    """Insert or update a cache entry, evicting the LRU entry when over capacity."""
    with _lock:
        _store[key] = {"data": data, "ts": time.monotonic()}
        _store.move_to_end(key)
        # Evict least-recently-used entries until under capacity
        while len(_store) > _MAX:
            _store.popitem(last=False)


def invalidate(key: str) -> None:
    """Remove a single entry. No-op if the key is absent."""
    with _lock:
        _store.pop(key, None)


def invalidate_prefix(prefix: str) -> None:
    """Remove all entries whose key starts with *prefix*."""
    with _lock:
        to_delete = [k for k in _store if k.startswith(prefix)]
        for k in to_delete:
            del _store[k]
