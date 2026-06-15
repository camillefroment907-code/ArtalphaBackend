# FUNNEL_AUDIT.md — Nautilus Mobile
_Generated: 2026-06-11_

---

## Funnel Overview

```
ACQUISITION
    ↓
[App Install]
    ↓  DROP 1: Cold friction — no biometrics, no social auth
[Login]
    ↓  DROP 2: Skipped onboarding? Unclear value
[Onboarding 1–7]           ← NEW (was zero)
    ↓  ACTIVATION: First value moment at step 7
[Home / Dashboard]
    ↓  DROP 3: Empty state, no artwork = no retention
[Add First Artwork]
    ↓  DROP 4: Artist not found = rage quit
[Manual Form + Estimation]
    ↓  DROP 5: Price friction
[Acquisition Price]
    ↓
[Success → Collection]     ← WOW moment
    ↓
RETENTION: Larry / Alerts / Collection Health
    ↓
CONVERSION: Plan upgrade (paywall)
```

---

## Stage-by-Stage Analysis

### Stage 1 — Login
| Metric | Status |
|--------|--------|
| Barrier to entry | MEDIUM — email/password only |
| Error recovery | OK — error messages visible |
| Forgot password | ❌ MISSING |
| Social auth | ❌ MISSING |
| Biometrics | ❌ MISSING (P2) |
| **Est. drop rate** | ~15% at login |

**Biggest blocker**: Users who forget their password have no self-service recovery. They churn.

---

### Stage 2 — Onboarding (NEW)
| Metric | Status |
|--------|--------|
| Completion expected | ~75% (7 short steps) |
| Skip options | Steps 3, 4, 5 skippable ✅ |
| Value clarity | Step 7 wow moment ✅ |
| Data usage | Saved to AsyncStorage ✅ |
| Personalization downstream | ⚠ Not yet used in Home/Larry |
| **Est. completion** | ~75% |

**Biggest opportunity**: Onboarding data (artists, goals, budget) is captured but NOT yet used to personalize Home screen or Larry briefing. The "personalized app" promise is not yet delivered.

---

### Stage 3 — First Artwork Add (Activation)
| Metric | Status |
|--------|--------|
| Entry points | Home + button, Collection + button, tabs |
| Mode selection | 3 modes: Photo, Search, Manual ✅ |
| Artist autocomplete | Dual-API working ✅ |
| No-results recovery | Manual link shown ✅ |
| Estimation display | P25-P75 range shown ✅ |
| **Est. completion** | ~60% for users who start the flow |

**Biggest blocker**: Photo mode is a stub (camera → manual). Users who choose "Photo" expecting AI recognition will be disappointed. Should be hidden or clearly labeled "coming soon."

---

### Stage 4 — Retention Loop
| Trigger | Status |
|---------|--------|
| Alerts feed | ✅ Working (category tabs, pull-to-refresh) |
| Alert CTA → external URL | ✅ Fixed (Linking.openURL) |
| Larry daily briefing | ⚠ Static content |
| Collection Health | ✅ Working |
| Home → action card | ✅ Navigates correctly |
| Push notifications | ❌ NOT CONFIGURED |

**Biggest gap**: No push notifications = no external trigger to bring users back. Users only return if they remember the app.

---

### Stage 5 — Conversion (Paywall)
| State | Status |
|-------|--------|
| Collection Health lock (7/10/15 items) | ✅ Logic present |
| Plan display in Profile | ✅ Shows current plan |
| Upgrade CTA | ❌ MISSING — no paywall screen |
| Stripe integration | ❓ Unknown |
| Trial countdown | ✅ Shows days remaining |
| **Conversion funnel** | BLOCKED — no way to upgrade in-app |

---

## Drop-off Summary

| Stage | Est. Drop | Root Cause | Fix Priority |
|-------|-----------|------------|--------------|
| Login | 15% | No biometrics / forgot password | P2 |
| Onboarding | 25% | Multi-step flow, no skip all | Low |
| Add artwork (start) | 40% | Empty home state doesn't prompt | P1 |
| Add artwork (complete) | 35% | Photo stub disappoints | P1 |
| Retention | 60% 7-day | No push notifications | P1 |
| Conversion | ~0% | No paywall screen | **P0** |

---

## Activation Metric Definition

**Activated user** = has added ≥ 1 artwork with an estimated_current_value_eur.

**Target**: 40% of new registrations → activated within 7 days.

**Current estimated rate**: Unknown (no analytics). Recommend: add posthog/mixpanel event on `POST /api/portfolio/items` success.

---

## Recommendations (Prioritized)

### P0 — Must fix before launch
1. **Paywall screen** — without it, product cannot monetize
2. **Push notifications** — without it, D7 retention will be near zero

### P1 — Ship week 1
3. **Photo mode** — hide or add "coming soon" label (current UX is deceptive)
4. **Onboarding → Home personalization** — use `artists` and `profileType` from onboarding to populate Larry briefing context and Home recommendations
5. **Forgot password** — link to `https://app.nautilus.art/reset-password` or equivalent

### P2 — Ship week 2
6. **Biometric login** — Face ID / Touch ID (expo-local-authentication)
7. **Post-add prompt** — after adding first artwork, prompt to add another ("Votre collection commence. Ajoutez une deuxième œuvre pour activer l'analyse de portefeuille.")

---

## AARRR Score

| Metric | Score | Notes |
|--------|-------|-------|
| Acquisition | 6/10 | Email/PW only, no social |
| Activation | 7/10 | Onboarding new + estimation working |
| Retention | 4/10 | No push, static Larry |
| Revenue | 2/10 | No paywall in-app |
| Referral | 1/10 | No referral mechanism |
| **Overall** | **4/10** | Revenue + retention must be solved |
