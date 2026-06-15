# LAUNCH_SCORE.md — Nautilus Mobile
_Generated: 2026-06-11_

---

## Composite Launch Score

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|---------|
| UX / Flows | 20% | 8.2 | 1.64 |
| UI / Visual Design | 15% | 8.1 | 1.22 |
| Core Value Delivery | 20% | 7.8 | 1.56 |
| Onboarding / Activation | 15% | 9.0 | 1.35 |
| Retention Hooks | 10% | 5.5 | 0.55 |
| Monetization Readiness | 10% | 2.0 | 0.20 |
| Technical Stability | 10% | 8.0 | 0.80 |
| **TOTAL** | 100% | — | **7.32 / 10** |

**LAUNCH SCORE: 73 / 100**

---

## What's Pulling the Score Down

### 1. Monetization (2/10) — Biggest blocker
No in-app paywall exists. Users on trial see their trial countdown in Profile, but there is no upgrade CTA, no Stripe checkout, no plan comparison screen. Without this, the product cannot generate revenue.

**Impact**: -18 points from weighted score

### 2. Retention Hooks (5.5/10)
No push notifications = zero external triggers. Users must self-motivate to return. The Larry briefing is static. Alerts CTA now opens URLs but notifications aren't sent proactively.

**Impact**: -4.5 points from weighted score

---

## What's Strong

### Onboarding (9/10)
The 7-step flow is polished, skippable, and ends with a premium wow moment. Progress dots, dual-API autocomplete in step 4, and a dark-background final screen create a product-level first impression. **Best flow in the app.**

### UX / Flows (8.2/10)
Navigation graph is coherent. Auth guard + onboarding guard work correctly. Add artwork flow goes from search → estimate → price → success without dead ends. Back navigation works throughout.

### Core Value — Artist Estimation (7.8/10)
P25-P75 winsorized price estimation from real auction data is genuinely useful. Medium filtering, investment grade, confidence level, trend direction — the data pipeline is solid. The UX surface reflects it well.

---

## Screen Scores (for reference)

| Screen | Score |
|--------|-------|
| Onboarding | **9.2** |
| Manual Form | **8.5** |
| Success | **8.4** |
| Larry | **8.2** |
| Price Screen | **8.2** |
| Login | **8.0** |
| Add Mode Select | **8.0** |
| Search | **8.0** |
| Artwork Detail | **8.1** |
| Home | **7.9** |
| Collection Health | **7.7** |
| Collection | **7.2** |
| Profile | **7.2** |
| Alerts | **6.9** |

**App Average: 8.0 / 10**

---

## Path to 90 / 100

To reach a 90/100 launch score, these are the required changes in priority order:

### Sprint 2 — Required for commercial launch

| Fix | Score Delta |
|-----|------------|
| Build paywall screen with Stripe checkout | +8 points (monetization 2→8) |
| Implement push notifications (expo-notifications) | +3 points (retention) |
| Wire onboarding data → Larry briefing personalization | +2 points (retention + core value) |
| Add forgot password link on login | +1 point (UX) |
| Hide photo mode or add clear "coming soon" label | +0.5 |
| Wire Collection Health action CTAs | +0.5 |

**Projected score after Sprint 2: ~85 / 100**

### Sprint 3 — For premium positioning

| Fix | Score Delta |
|-----|------------|
| Real artwork images (upload or Artsy API) | +2 points |
| Live market news in Larry briefing | +1 point |
| Biometric login (expo-local-authentication) | +0.5 |
| Post-first-artwork retention prompt | +0.5 |
| Social proof in onboarding ("4,200 collectors use Nautilus") | +0.5 |

**Projected score after Sprint 3: ~90 / 100**

---

## Launch Readiness Verdict

| Criteria | Go / No-Go |
|----------|-----------|
| Core product works (collection OS) | ✅ GO |
| Onboarding converts | ✅ GO |
| Data is real (not mocked) | ✅ GO |
| No crash blockers | ✅ GO |
| In-app monetization | ❌ **NO-GO** |
| Retention mechanism | ❌ **NO-GO** |

**Verdict: SOFT LAUNCH READY (beta / invite-only)**

The product is solid enough for a controlled beta with 50-100 collectors. It is **not** ready for a public App Store launch without a paywall and push notifications. Ship to TestFlight now, build monetization + notifications in the next 2 weeks.
