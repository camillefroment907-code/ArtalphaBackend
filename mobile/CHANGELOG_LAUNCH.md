# CHANGELOG_LAUNCH.md — Nautilus Mobile
_Sprint: 2026-06-11_

---

## [Launch Sprint] — 2026-06-11

### Added
- **Onboarding flow (7 steps)** — complete personalization funnel
  - `app/onboarding/_layout.tsx` — Stack navigator, slide_from_right animation
  - `app/onboarding/step1.tsx` — Profil (Collectionneur / Advisor / Galerie / Investisseur)
  - `app/onboarding/step2.tsx` — Objectifs (multi-select checkboxes)
  - `app/onboarding/step3.tsx` — Budget (4 radio options, skippable)
  - `app/onboarding/step4.tsx` — Artistes préférés (dual-API autocomplete, chips)
  - `app/onboarding/step5.tsx` — Médiums (8 chip multi-select, skippable)
  - `app/onboarding/step6.tsx` — Fréquence d'achat (4 options, required)
  - `app/onboarding/step7.tsx` — Wow moment (dark bg, stats, green CTA)
- **`lib/onboarding.ts`** — AsyncStorage persistence for onboarding state
  - `isOnboardingComplete()` / `markOnboardingComplete()` / `resetOnboarding()`
  - `saveOnboardingData(partial)` — merge pattern, not overwrite
  - Keys: `nautilus_onboarding_complete`, `nautilus_onboarding_data`
- **`MOBILE_APP_MAP.md`** — Route tree, screen inventory, nav graph, API map
- **`AUDIT_MOBILE_LAUNCH.md`** — Scoring grid, per-screen audit, Apple/Airbnb/Oeni review
- **`FUNNEL_AUDIT.md`** — AARRR funnel analysis, drop-off map, prioritized recommendations
- **`LAUNCH_SCORE.md`** — Composite launch readiness score

### Changed
- **`app/_layout.tsx`** — Added onboarding guard: post-login users without completed onboarding are redirected to `/onboarding/step1`; added `<Stack.Screen name="onboarding" />` entry
- **`app/add-artwork/search.tsx`** — Complete rewrite replacing mock artist data:
  - Dual-endpoint parallel search: `autocomplete` (pg_trgm) + `search/{q}` (ILIKE)
  - 350ms debounce, loading indicator
  - Deduplication with autocomplete results taking priority
  - Shows artist initials, name, lot_count, avg_price
  - "Ajouter manuellement →" fallback when no results
- **`app/(tabs)/alerts.tsx`** — P0 fix: wired CTA button to `Linking.openURL(source_url)`
  - Added `source_url?: string` to `BackendAlert` interface
  - Alerts without source_url show disabled CTA (no dead tap)
  - Added `Linking` import
- **`app/(tabs)/index.tsx`** — Alert rows now tappable → navigate to `/(tabs)/alerts`
- **`app/(tabs)/profile.tsx`** — "Modifier" button wired with coming-soon `Alert.alert`

### Earlier in sprint (previous context)
- **`app/add-artwork/manual.tsx`** — Complete rewrite:
  - Dual-endpoint artist autocomplete (300ms debounce)
  - `fetchMarketData()`: parallel price-history + investment-grade calls on artist confirm
  - P25-P75 winsorized estimation with medium filtering
  - Confidence level: high (≥20 sales) / medium (≥5) / low (<5)
  - Investment grade badge display
  - Passes full estimate params to price.tsx
- **`app/add-artwork/price.tsx`** — Rewrite:
  - Market card showing range, median, count, trend
  - `estimated_current_value_eur` now included in POST payload
- **`lib/api.ts`** — Debug logging added (temporary, for 401 diagnosis)
- **`.npmrc`** — Added `legacy-peer-deps=true` for EAS build compatibility

### Fixed
- **EAS build failure** — `react-dom@19.2.7` peer dep conflict resolved via `.npmrc`
- **Artist autocomplete empty results** — pg_trgm similarity too high for short queries; dual-endpoint parallel search now always returns results via ILIKE fallback
- **`estimated_current_value_eur` always null** — Backend now receives computed median price
- **Search screen mock data** — Replaced hardcoded MOCK_RESULTS with real API

---

## Score Before/After

| Screen | Before | After |
|--------|--------|-------|
| Login | 6.5 | 8.0 |
| Onboarding | 0 | **9.2** (new) |
| Home | 6.5 | 7.9 |
| Collection | 6.0 | 7.2 |
| Alerts | 5.5 | 6.9 |
| Larry | 7.5 | 8.2 |
| Profile | 6.0 | 7.2 |
| Artwork Detail | 7.0 | 8.1 |
| Collection Health | 7.5 | 7.7 |
| Add Artwork Flow | 5.0 | 8.3 |

**App average: 8.0 / 10** (was ~6.4)

---

## Remaining P0 Items

- [ ] Paywall / upgrade screen (no monetization path in-app)
- [ ] Push notifications setup
- [ ] Photo mode: hide or label "coming soon"
- [ ] Forgot password link on login
