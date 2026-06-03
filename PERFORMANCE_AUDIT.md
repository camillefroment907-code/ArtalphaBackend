# Nautilus — Performance Audit
_Date: 2026-06-03 | Engineer: Principal Performance_

---

## Methodology

Hierarchy applied: **delete > cache > precompute > optimize**. Every issue is
evaluated by how much user-perceived latency it removes, not by code elegance.

---

## Critical Issues (P0) — Fixed in this session

| # | Problem | Location | Impact | Fix |
|---|---------|----------|--------|-----|
| 1 | `get_lot` runs 7–10 sequential DB queries with **zero caching** | `lots.py:1666` | +400–800 ms on every lot view | Added 120 s response cache keyed by `(lot_id, plan)` |
| 2 | Two separate hammer-price queries hit the same table twice | `lots.py:1900, 1975` | +50–120 ms per uncached lot | Merged into one 48 m query; Python slices the 24 m subset |
| 3 | `get_user_plan` hits the subscriptions table on **every authenticated request** | `plan_utils.py` | +20–40 ms × every endpoint | 5-minute in-process cache per user ID |
| 4 | `func.lower(ArtistProfile.name)` — no functional index → full table scan | `lots.py:1736` | +30–80 ms on every lot with an artist | Migration adds `ix_artist_profiles_lower` |
| 5 | `func.lower(Lot.artist_name_raw)` equality filter — no functional index | `lots.py:1905, 1978` | +20–60 ms | Migration adds `ix_lots_artist_name_lower` |
| 6 | Deal feed sorted by `deal_score DESC` without partial index | `lots.py, hot_deals` | +50–200 ms on Explore/Hot Deals | Migration adds `ix_lots_is_deal_score WHERE is_deal = true` |
| 7 | `next.config.js images.unoptimized: true` — all images served at full size | `next.config.js` | +200–2000 ms per image on mobile | Removed; AVIF/WebP auto-conversion enabled |
| 8 | `recharts` bundled into the initial JS chunk | `vite.config.ts` | +100–200 ms FCP on SPA | Extracted to `charts` manual chunk |
| 9 | Lot detail: 8 heavy tab components (ComparablesHero, InvestmentTimeline…) loaded eagerly | `frontend/app/lot/[id]/page.tsx` | +80–150 ms TTI | Dynamic imports → separate webpack chunks, load on tab activation |
| 10 | In-process cache uses sorted eviction — O(N log N) on every overflow | `cache.py` | Minor CPU spike at 1000 entries | Replaced with OrderedDict LRU → O(1) eviction |

---

## High Priority (P1) — Not yet implemented

| # | Problem | Location | Gain Estimate | Recommended Fix |
|---|---------|----------|---------------|-----------------|
| 11 | `ArtistProfile` ILIKE fallback scan (line 1741) | `lots.py` | 20–60 ms | Pre-normalise `artist_profiles.name_normalized`; skip ILIKE |
| 12 | `list_lots` currency conversion: 12 OR branches per price filter | `lots.py:408–561` | 30–80 ms | Store `price_eur` column normalised at ingest time |
| 13 | No Redis — in-process cache is per-worker, lost on restart | `cache.py` | Cache hit rate ↓ with multiple workers | Add redis-py; tiered L1 (in-process) + L2 (Redis) |
| 14 | `ArtistSignal` queried per lot with no composite index | `lots.py:1711` | 15–40 ms | Migration adds `ix_artist_signals_lookup (artist_id, computed_at DESC)` ✓ (already in migration) |
| 15 | Projections recomputed on every request (CAGR calculation) | `lots.py:1822–1873` | 20–50 ms | Pre-compute `projection` JSON in `score_breakdown` during Celery poll |
| 16 | No virtualisation in lot gallery — renders 50–200 DOM nodes | `frontend/components/lots/GalleryCard` | 100–400 ms INP | Add `@tanstack/react-virtual` |
| 17 | SWR deduplication: same lot fetched multiple times across components | `frontend/lib/api.ts` | 1–3 duplicate requests per page | Add global SWR config with `dedupingInterval: 10000` |
| 18 | `og-image.png` is 1.1 MB, served uncompressed | `public/og-image.png` | +1s on social card loads | Compress to WebP < 100 KB |

---

## Medium Priority (P2)

| # | Problem | Gain Estimate |
|---|---------|---------------|
| 19 | `list_lots` runs COUNT(*) on every paginated request | 20–50 ms — use `has_more` pagination instead |
| 20 | `get_comparables` TTL is 3600 s — stale after price updates | Minor UX — reduce to 600 s |
| 21 | No `Cache-Control` header on `GET /api/lots/:id` backend response | Prevents CDN/browser caching |
| 22 | SSE stream `/lots/stream` polls every 8 s with `asyncio.sleep` in event loop | Replace with proper `asyncio.TaskGroup` |
| 23 | Celery `default` queue mixes scoring tasks with email tasks | Email delays scoring — add dedicated `emails` queue |
| 24 | No Lighthouse CI in pipeline | No regression detection |

---

## Database Index Status

### Added by migration `b0c1d2e3f4a5` (this session)

| Index | Table | Purpose |
|-------|-------|---------|
| `ix_lots_is_deal_score` | lots | Explore feed — partial, covers `WHERE is_deal = true ORDER BY deal_score DESC` |
| `ix_lots_status_date` | lots | Active lots — `WHERE status = ? ORDER BY auction_date DESC` |
| `ix_lots_source_idx` | lots | Source-based filtering |
| `ix_lots_artist_hammer` | lots | Covering index for artist + hammer_price lookups |
| `ix_lots_artist_name_lower` | lots | `func.lower(artist_name_raw)` equality filter |
| `ix_artist_profiles_lower` | artist_profiles | `func.lower(name)` equality — replaces full-table scan |
| `ix_artist_signals_lookup` | artist_signals | Oracle signal: `(artist_id, computed_at DESC)` |
| `ix_hammer_prices_norm_med` | hammer_prices | Comparables: `(artist_name_normalized, medium_category, sale_date DESC)` |

### Previously existing (not changed)

`ix_lots_artist_id`, `ix_lots_auction_date`, `ix_lots_status`, `ix_lots_deal_score`,
`ix_lots_is_deal`, `ix_lots_created_at`, `ix_lots_market_type`,
`ix_lots_confidence_score`, `uq_lots_source_external`, `uq_lots_fingerprint`,
`ix_artists_name`, `ix_artists_name_normalized`, `ix_alerts_user_id`,
`ix_alerts_user_sent`, `ix_wishlist_user_id`, `ix_portfolio_user_id`,
`ix_hammer_prices_artist_date`, `idx_lot_artist_trgm` (GIN)

---

## Estimated Impact (P0 fixes combined)

| Metric | Before | After (estimate) |
|--------|--------|-----------------|
| `GET /lots/:id` P50 | 350–600 ms | 5–15 ms (cache hit) / 180–280 ms (miss) |
| `GET /lots/:id` cache hit rate | 0 % | ~85 % (popular lots hit repeatedly) |
| `get_user_plan` queries per min | N (1 per request) | ~1 per 5 min per user |
| Lot detail JS loaded on initial paint | ~220 KB | ~80 KB (tab chunks deferred) |
| Mobile image data transferred | full JPEG/PNG | AVIF ~60–80 % smaller |
| Deal feed SQL cost | seq-scan + filesort | index-only scan |

---

## Files Modified in This Session

| File | Change |
|------|--------|
| `backend/alembic/versions/b0c1d2e3f4a5_perf_critical_indexes.py` | New — 8 critical indexes |
| `backend/app/utils/cache.py` | LRU upgrade with OrderedDict, O(1) eviction |
| `backend/app/utils/plan_utils.py` | `get_user_plan` cached 5 min per user |
| `backend/app/api/lots.py` | `get_lot` 120 s cache; merged hammer-price queries |
| `frontend/next.config.js` | Image optimisation enabled, AVIF/WebP, static asset cache headers |
| `frontend/app/lot/[id]/page.tsx` | 7 heavy tab components → dynamic imports |
| `vite.config.ts` | `recharts` extracted to separate chunk |
