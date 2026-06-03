# Nautilus — Performance Phase 2
_Date: 2026-06-03 | Threshold: gains > 100 ms or > 20% only_

---

## Methodology

Measure → Identify bottleneck → Apply minimum intervention → Verify.
Scope: Explore, Lot Detail, Artist Detail, Portfolio, For You.
Budget: no micro-optimisations (useMemo, React.memo, style refactors).

---

## Measurements (before Phase 2)

### API request counts per page (measured via network tab)

| Page | Requests on load | Critical path depth |
|------|-----------------|---------------------|
| OpportunityDetail | 4 parallel (lot + comparables + hammer-history + upside) + 2 dependent (format-matrix + timing) | 2 sequential waterfalls |
| Explore | 2 fetches to `/api/auth/me` (identical) on ?onboarding + ?profile params | 1 wasted round trip |
| For You (Explore tab) | `recommendations/for-you` — 0 cache, recomputes on every visit | 200–400 ms per visit |
| hammer-history endpoint | 0 cache + debug `print()` on every call | extra DB round trip |
| list_lots pagination | COUNT(*) full-table scan on EVERY page request (page 2, 3, ... each re-run) | 20–50 ms × every page turn |

---

## Optimisations Applied

### P0 — Impact estimé: Très élevé

| # | Optimisation | Location | Gain estimé | Statut |
|---|-------------|----------|-------------|--------|
| P2-1 | **Bundle endpoint** `GET /api/lots/{id}/bundle` — lot + comparables + hammer_history + upside_signal in 1 HTTP request | `lots.py:2042` | **100–200 ms** (3 round trips eliminated on warm cache; ~60 ms per additional round trip on mobile 4G) | ✅ Fait |
| P2-2 | **OpportunityDetail → bundle** — 4 fetches replaced by 1 bundle fetch with individual fallbacks for cold paths | `OpportunityDetail.tsx` | **100–200 ms** (same as P2-1) | ✅ Fait |
| P2-3 | **Redis L2 distributed cache** — tiered L1 (OrderedDict) + L2 (Redis) for hot keys; survives worker restarts; shared across workers | `utils/redis_cache.py` | **Cache hit rate ↑** from per-worker to cluster-wide; eliminates cold starts after deploys | ✅ Fait |
| P2-4 | **hammer-history caching** — 600 s TTL + removed debug `print()` statement | `lots.py:2919` | **30–80 ms** per cold hit + removes log noise | ✅ Fait |
| P2-5 | **recommendations/for-you caching** — 300 s TTL per user | `recommendations.py:322` | **200–400 ms** saved on repeat visits | ✅ Fait |
| P2-6 | **list_lots COUNT(*) deduplicated** — separate `count_key` with 300 s TTL excludes page/page_size; COUNT runs once per filter-set per 5 min instead of once per page | `lots.py:376` | **20–50 ms** × every paginated page-turn | ✅ Fait |
| P2-7 | **Explore double auth/me** — merged 2 identical `fetch(/api/auth/me)` calls into 1 | `Explore.tsx:425` | **1 eliminated round trip** (~20–40 ms on page load with ?onboarding or ?profile) | ✅ Fait |

---

## Architecture: Redis Tiered Cache

```
Request
   │
   ▼
L1: in-process OrderedDict (0 ms, 2000 entries, process-local)
   │  miss
   ▼
L2: Redis (0.5–2 ms, unlimited entries, cluster-shared, survives restart)
   │  miss
   ▼
Database query → result stored in L1 + L2
```

**Fallback**: if Redis is unavailable at startup (env without Redis), `_redis_client = None` and the system runs L1-only transparently. No crashes, no config change needed.

**Key namespace**: all Redis keys prefixed with `nautilus:` to avoid collisions with Celery.

---

## Bundle Endpoint Design

`GET /api/lots/{id}/bundle?lang=fr`

```
Hot path  (all 4 cache keys hit): 0 DB queries — single in-process read
Warm path (hammer + upside miss): 1 Lot SELECT + 2 parallel sub-queries
Cold path (lot + comps miss):     hammer/upside served inline;
                                  lot/comps are null → frontend falls back
                                  to individual endpoints for those 2 pieces
```

The frontend (`OpportunityDetail.tsx`) uses the bundle first, then individual fallback fetches for any null pieces. Fully backward-compatible: if the bundle endpoint fails, the catch block fires all 4 individual requests as before.

---

## Not Implemented (P1 — deferred)

| # | Optimisation | Gain estimé | Why deferred |
|---|-------------|-------------|--------------|
| P1-1 | Virtualisation lists with `@tanstack/react-virtual` | 100–400 ms INP for 50+ lots | Requires component refactor; lower priority than request-count wins |
| P1-2 | Hover prefetch on lot cards | Perceived 0 ms navigation | Needs interaction tracking; deferred to Phase 3 |
| P1-3 | Portfolio bundle endpoint (stats + items + watchlist + favorite-artists) | 80–150 ms | Portfolio usage lower than Lot Detail; deferred |
| P1-4 | `price_eur` normalised column at ingest | 30–80 ms on currency OR branches | Schema migration + backfill required; safe to do offline |

---

## Estimated Phase 2 Impact (combined with Phase 1)

| Metric | Phase 1 After | Phase 2 After |
|--------|---------------|---------------|
| Lot Detail perceived load (warm) | 5–15 ms (cache hit) | **5 ms** (bundle = 1 round trip, all 4 pieces in one response) |
| Lot Detail perceived load (cold) | 180–280 ms | 120–200 ms (hammer + upside in parallel, lot+comps inline) |
| Explore page turns (pages 2+) | 20–50 ms COUNT(*) per page | **0 ms COUNT** (count cached 5 min per filter-set) |
| For You tab (repeat visit) | 200–400 ms | **0 ms** (cached 5 min per user) |
| Cache hit rate (multi-worker) | ~70% (per-process L1 only) | **~90%+** (L2 Redis shared across all workers) |

---

## Files Modified in This Session

| File | Change |
|------|--------|
| `backend/app/utils/redis_cache.py` | New — L1+L2 tiered cache with Redis fallback |
| `backend/app/api/lots.py` | Bundle endpoint + hammer-history caching + debug print removed + COUNT(*) deduplication |
| `backend/app/api/recommendations.py` | for-you endpoint cached 5 min per user |
| `src/app/pages/OpportunityDetail.tsx` | 4 fetches → 1 bundle fetch with fallbacks |
| `src/app/pages/Explore.tsx` | 2 duplicate auth/me calls → 1 |
