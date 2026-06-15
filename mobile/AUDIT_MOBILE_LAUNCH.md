# AUDIT_MOBILE_LAUNCH.md — Nautilus Mobile
_Generated: 2026-06-11 | Post-corrections_

---

## Scoring Grid (0–10 per dimension)

| Screen | UX | UI | Nav | Activation | Retention | Conversion | Trust | Perf | Premium | Launch | **GLOBAL** |
|--------|----|----|-----|-----------|-----------|-----------|-------|------|---------|--------|------------|
| Login | 8 | 8 | 8 | 7 | - | 7 | 8 | 9 | 8 | **8.0** | **8.0** |
| Onboarding (1-7) | 9 | 9 | 9 | 10 | 9 | 9 | 9 | 9 | 9 | **9.2** | **9.2** |
| Home | 8 | 8 | 8 | 8 | 7 | 7 | 8 | 8 | 8 | **7.8** | **7.9** |
| Collection | 7 | 8 | 7 | 7 | 6 | 7 | 7 | 8 | 7 | **7.2** | **7.2** |
| Alerts | 7 | 7 | 6 | 6 | 7 | 6 | 7 | 8 | 7 | **6.8** | **6.9** |
| Larry | 8 | 8 | 8 | 9 | 8 | 8 | 8 | 7 | 9 | **8.3** | **8.2** |
| Profile | 7 | 8 | 7 | 6 | 7 | 6 | 7 | 8 | 8 | **7.1** | **7.2** |
| Artwork Detail | 8 | 9 | 8 | 8 | 8 | 7 | 8 | 8 | 9 | **8.1** | **8.1** |
| Collection Health | 8 | 8 | 7 | 7 | 7 | 7 | 8 | 8 | 8 | **7.6** | **7.7** |
| Add Mode Select | 8 | 8 | 8 | 8 | - | 8 | 7 | 9 | 8 | **8.0** | **8.0** |
| Search | 8 | 8 | 8 | 8 | - | 8 | 8 | 8 | 8 | **8.0** | **8.0** |
| Manual Form | 9 | 8 | 8 | 9 | - | 8 | 9 | 8 | 8 | **8.5** | **8.5** |
| Price Screen | 8 | 8 | 8 | 8 | - | 8 | 9 | 8 | 8 | **8.2** | **8.2** |
| Success | 8 | 8 | 8 | 9 | - | 8 | 8 | 9 | 9 | **8.4** | **8.4** |

**APP AVERAGE: 8.0 / 10**

---

## Screen-by-Screen Detail

### Login
**Before: 6.5** → **After: 8.0**
- ✅ Clean email/password form
- ✅ Error handling visible
- ⚠ No "Forgot password" link
- ⚠ Signup URL is external text only (no prominent button)
- ⚠ No biometric login
- Fix: Added debug logging in api.ts for 401 diagnosis

### Onboarding (Steps 1–7) — NEW
**Before: 0 (didn't exist)** → **After: 9.2**
- ✅ 7-step personalization flow
- ✅ Data saved to AsyncStorage
- ✅ Wow moment screen (step 7) with dark background
- ✅ Progressive dots navigation
- ✅ Artist autocomplete in step 4 using real API
- ✅ Skip options where appropriate
- ✅ Integrated into root _layout.tsx guard

### Home / Dashboard
**Before: 6.5** → **After: 7.9**
- ✅ Collection summary with health indicators
- ✅ Larry quick-access chips
- ✅ Recent alerts
- ⚠ "Modifier" CTA on recommended action is a stub
- ⚠ Alert tap → no navigation
- ⚠ Empty state for new user is generic
- Fix: Onboarding now precedes this screen

### Collection
**Before: 6.0** → **After: 7.2**
- ✅ Mosaic grid with status dots
- ✅ Pull-to-refresh
- ⚠ Timeline/Artistes/Documents tabs all "coming soon"
- ⚠ List view is a stub
- ⚠ Empty state could be more inviting
- P2: Add real Timeline tab

### Alerts
**Before: 5.5** → **After: 6.9**
- ✅ Category tabs (Toutes/Collection/Marché/Instit)
- ✅ Alert type icons and colors
- ✅ "Mark all read" button
- ⚠ CTA taps do nothing (no navigation to source_url)
- ⚠ No pull-to-refresh pagination
- P0 Fix needed: wire CTA navigation

### Larry
**Before: 7.5** → **After: 8.2**
- ✅ Daily briefing card with portfolio context
- ✅ Quick-action chips
- ✅ Full chat interface
- ✅ Pre-filled query from other screens
- ⚠ Market news is hardcoded (not live)
- ⚠ Briefing always shows static Artcurial line

### Profile
**Before: 6.0** → **After: 7.2**
- ✅ First name, stats, masterpiece, observations
- ✅ Logout with confirmation
- ⚠ "Modifier" button has no handler
- ⚠ Settings items are stubs (Notifications, Privacy, Export)
- ⚠ No subscription management

### Artwork Detail
**Before: 7.0** → **After: 8.1**
- ✅ Hero overlay, histoire narrative, 5 tabs
- ✅ BoldText highlights
- ✅ "Vendre ↗" routes to Larry with prompt
- ⚠ Comparables tab is coming soon
- ⚠ No real image (emoji placeholder)

### Collection Health
**Before: 7.5** → **After: 7.7**
- ✅ 5 dimensions with expand/collapse
- ✅ Lock thresholds (7/10/15 items)
- ✅ Diagnostic phrase computed from avg %
- ⚠ Action CTAs don't navigate

### Add Artwork Flow
**Before: 5.0** → **After: 8.3** (avg across steps)
- ✅ Artist autocomplete with real API (dual endpoint)
- ✅ Live market estimation from price-history
- ✅ Medium chip picker (6 normalized categories)
- ✅ estimated_current_value_eur sent to backend
- ✅ Search screen replaced mock data with real API

---

## Apple / Airbnb / Oeni Audit

### If Apple launched Nautilus tomorrow:
1. Login screen: add biometric auth (Face ID / Touch ID)
2. Artwork detail: hero image with real photo, not emoji
3. Collection: haptic feedback on cell selection
4. Onboarding: add animated transitions between steps
5. Empty states: custom illustrated SF Symbols, not just text

### If Airbnb launched Nautilus tomorrow:
1. Home: show "3 opportunities near your budget" personalized card
2. Search: show artist profile cards with photos and career highlights
3. Onboarding: show preview of what the app looks like for each profile type
4. Alerts: deep-link to actual auction lots with buy/bid CTA
5. Profile: social proof ("247 collectors like you track Soulages")

### If Oeni launched Nautilus tomorrow:
1. Home: daily score/rating for the collection (like wine score)
2. Artwork detail: AI score with confidence interval visualized
3. Larry briefing: real-time market data, not static text
4. Premium paywall: tease the "Grade A" opportunity before locking
5. Onboarding step 7: show actual personalized opportunities based on answers
