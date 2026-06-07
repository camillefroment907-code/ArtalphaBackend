/**
 * Module-level in-memory API cache.
 * Lives for the duration of the browser session (cleared on page refresh).
 * Eliminates redundant fetches when navigating between pages.
 *
 * Usage:
 *   import { cachedFetch } from '../../lib/apiCache';
 *   const data = await cachedFetch('/api/recommendations/market-brief', { headers }, 300_000);
 */

interface CacheEntry {
  data: unknown;
  ts: number;
}

const _cache = new Map<string, CacheEntry>();

/**
 * Fetch with in-memory cache. Returns cached data if still fresh.
 * @param url     Full URL to fetch
 * @param init    RequestInit (headers, method, etc.)
 * @param ttlMs   Cache TTL in milliseconds (default 5 minutes)
 */
export async function cachedFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
  ttlMs = 300_000,
): Promise<T | null> {
  const entry = _cache.get(url);
  if (entry && Date.now() - entry.ts < ttlMs) {
    return entry.data as T;
  }
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const data = await res.json();
    _cache.set(url, { data, ts: Date.now() });
    return data as T;
  } catch {
    return null;
  }
}

/** Manually invalidate a cached URL (e.g. after a mutation) */
export function invalidateCache(url: string) {
  _cache.delete(url);
}

/** Invalidate all cache entries whose key includes the given substring */
export function invalidateCachePattern(pattern: string) {
  for (const key of _cache.keys()) {
    if (key.includes(pattern)) _cache.delete(key);
  }
}
