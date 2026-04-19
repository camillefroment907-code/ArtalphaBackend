/** Simple localStorage cache for API responses. */

const TTL_MS = {
  ticker: 5 * 60 * 1000,           // 5 min — live ticker
  recommendations: 30 * 60 * 1000, // 30 min — For You tab
  lots: 10 * 60 * 1000,            // 10 min — lot lists
  public: 15 * 60 * 1000,          // 15 min — public landing data
} as const;

type TTLKey = keyof typeof TTL_MS;

interface CacheEntry<T> {
  data: T;
  expires: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem('nautilus_cache_' + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expires) {
      localStorage.removeItem('nautilus_cache_' + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T, ttlKey: TTLKey): void {
  try {
    const entry: CacheEntry<T> = { data, expires: Date.now() + TTL_MS[ttlKey] };
    localStorage.setItem('nautilus_cache_' + key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function invalidateCache(prefix?: string): void {
  try {
    const keys = Object.keys(localStorage).filter(k =>
      prefix
        ? k.startsWith('nautilus_cache_' + prefix)
        : k.startsWith('nautilus_cache_')
    );
    keys.forEach(k => localStorage.removeItem(k));
  } catch {}
}
