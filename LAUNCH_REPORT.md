# LAUNCH REPORT — Nautilus
**Target launch date: May 13, 2026**
**Report updated: 2026-04-19 (Phase 5 — Production deploy complete)**

---

## Executive Summary

Nautilus is a **live, production-deployed** art market intelligence platform. The full stack (frontend + backend) is deployed across 5 phases and running in production. Production URLs:
- **Frontend:** https://artalpha-figma.vercel.app → target: https://get-nautilus.com
- **Backend:** https://artalpha-backend-production.up.railway.app
- **Admin:** https://artalpha-figma.vercel.app/admin/launch

**Build: PASS — 0 TypeScript errors. 1699 modules. 3.41s.**  
**Production DB (2026-04-19): 1,941 lots · 3 users · 4 blog posts · avg deal score 60.0 · version 5.0**

---

## Phase 5 Completed Items (2026-04-19)

### Production Deploy
- **Critical fix:** All Phase 3/4 backend code was uncommitted — committed and pushed to Railway
- **Critical fix:** `/api/lots/public` shadowed by `/{lot_id}` route — moved before path param handler
- **`GET /api/health`** endpoint added (`{"status":"ok","version":"5.0","database":"ok"}`)
- **`POST /api/admin/set-plan`** endpoint — manually set plan for demo/comp accounts
- Backend fully deployed: `/api/lots/public`, `/api/feedback/*`, `/api/blog/seed`, `/api/admin/stats`, `/api/portfolio-ai`
- **Production smoke tests:** `/api/health` ✓, `/api/lots/public` ✓, `/api/admin/stats` ✓, `/api/blog` ✓

### NPS Survey
- `NPSSurvey.tsx` wired into `Root.tsx` (renders after 60s on app pages)
- CSS keyframe animations in `custom.css`
- `POST /api/feedback/nps` backend endpoint with optional comment field
- DB migration: `ALTER TABLE nps_responses ADD COLUMN IF NOT EXISTS comment TEXT`

### n8n Workflows
- All 9 workflows: credential references fixed (`"id": "1"`, name `"Resend SMTP"`)
- Workflow 09: hardcoded production backend URL (removed `$env.BACKEND_URL` dependency)
- Workflow 02: repurposed from "waitlist confirmation" → "early access confirmation"
- Workflow 05: repurposed from "launch day blast" → "monthly growth report"
- `CREDENTIAL_SETUP.md` added with step-by-step import instructions

### Waitlist Removal
- Nav: `/waitlist` link → `/blog`
- Landing CTA: "Join the waitlist →" → "See plans →" (navigates to `/pricing`)
- `/waitlist` route: redirects to `/app/signup`
- Blog empty state: waitlist link removed
- Market.tsx placeholder text: "launching soon" → "contact us to enable"
- AdminLaunch.tsx: "DAYS TO LAUNCH" → "DAYS LIVE"
- `public/sitemap.xml`: `/waitlist` entry removed

### Database Baseline (Production 2026-04-19 Phase 5)
| Metric | Value |
|--------|-------|
| Total lots | 1,941 |
| Deal lots (score ≥ threshold) | 1,052 (54.2%) |
| Average deal score | 60.0 |
| Top deal score | 86.8 (Marc Gimat — Paysage sous le neige) |
| Total users | 3 |
| Blog posts | 4 (seeded: weekly opps, Anna Weyant, methodology, 2026 market guide) |
| Alerts | 941 |
| Sources | artmarketapi (1,545), phillips (136), heritage (109), other (99), roseberys (52) |

### Code Quality
- `Pricing.tsx`: removed 5 debug `console.log` statements (token, price key, response body)
- `AIAnalyst.tsx`: removed operational `console.log`

---

---

## Phase 4 Completed Items (2026-04-19)

### Pipeline
- ArtMarketAPIConnector default limit 500 → **5,000 lots per cycle**
- Recommendation engine `_SCORE_FLOOR` 55 → **45** (wider net for launch)
- `_UPCOMING_DAYS` 30 → **45** (early-access window)
- **Global no-DNA fallback**: For You tab never empty for any user
- **Wikidata enrichment job** — `backend/app/jobs/wikidata_enrichment.py`
- **Deal score backfill** — `POST /api/admin/backfill-scores` (SQL UPDATE for NULL scores)
- **Admin DB stats** — `GET /api/admin/stats` (lot count, user count, waitlist count)

### Landing Page
- **Today's Signals section** — 3 real lots from `/api/lots/public`, cards 2-3 blurred with lock overlay + signup CTA
- **Testimonials section** — 3 collector testimonials with gold separator + disclaimer
- Daily-changing stats (member count, lot count) via `src/lib/dailyStats.ts`
- "Start free" CTA: blue (#4B6CF5), uppercase, gated to `/app/signup`
- "See live opportunities" gated to `/app/signup`

### Backend
- `/api/lots/public` — public (no auth) endpoint for landing page Today's Signals
- `/api/feedback/nps` — NPS score collection + admin notification on detractors
- `/api/feedback/cancellation` — one-click cancellation survey + thank-you page
- `/api/feedback/submit` — freeform feedback storage + admin email
- `/api/blog/generate` — GPT-4o-mini auto-generation for blog posts
- `/api/blog/seed` — seed all 4 launch posts in one call
- `POST /api/admin/backfill-scores` — SQL backfill for NULL deal_scores
- `POST /api/admin/enrich-artists` — trigger Wikidata batch enrichment
- `GET /api/admin/stats` — DB counts for monitoring

### Frontend
- `/feedback` route — suggestions / help forms + submission
- `src/lib/useSEO.ts` — dynamic meta tags, og tags, canonical URL per page
- `src/lib/cache.ts` — TTL-aware localStorage cache utility
- SEO applied to: Landing, Waitlist pages
- `og-image.svg` — branded SVG fallback (navy + gold, Nautilus wordmark)
- react-helmet-async installed

### Infrastructure
- Frontend `.env.example` — correct VITE_ vars with docs
- Backend `.env.example` — all required Railway vars documented
- Frontend `.gitignore` — added `.env.local`, `.env.*` variants
- `n8n-workflows/09-weekly-blog.json` — Monday 6am auto-generation workflow

### Security
- Hardcoded secrets scan: **CLEAN** — no sk_live, sk_test, process.env violations
- Stripe webhook `construct_event()` validation: **CONFIRMED** ✓
- CORS no wildcards on production URLs: **CONFIRMED** ✓

---

## What was built

### Phase 1 — Foundation
- Landing page with live ticker, exit-intent popup, sticky CTA
- `/waitlist` referral system
- Legal pages (`/legal/terms`, `/legal/privacy`, `/legal/disclaimer`)

### Phase 2 — Intelligence Layer
- CollectorDNA behavioral fingerprint engine
- 11-strategy recommendation engine (`/api/recommendations/for-you`)
- Wishlist parser via GPT-4o-mini NLP
- RecommendationPopup (4s post-login, once per session)
- Larry AI: 30s proactive trigger + unread badge
- Admin dashboards: `/admin/health`, `/admin/launch`, `/admin/recommendations`
- Blog system: `/blog`, `/blog/:slug` + CRUD API
- Self-healing API client (retry, circuit breaker, dedup)
- 8 n8n email workflow automations
- Full waitlist backend with referral mechanics

### Phase 3 — Launch Sprint
- **Pipeline:** ScrapingRun tracking table; 15+ active connectors; pipeline runs every 15 min
- **Mobile:** Hamburger nav with full drawer menu; 44px touch targets; mobile-responsive
- **SEO:** sitemap.xml, robots.txt, og:image meta, schema.org Organization, Twitter card
- **Security:** CSP + HSTS + Permissions-Policy in vercel.json
- **Transactional email:** 6 new email templates (trial started/expired, payment success, password reset, NPS, monthly report); branding updated to Nautilus/get-nautilus.com
- **Stripe:** Payment success email wired; trial-started email wired; billing portal x2 endpoints
- **Onboarding:** 7-step flow (welcome → profile → budget → horizon → categories → personalized lots → meet Larry → confirmation)
- **Error handling:** Global ErrorBoundary in App.tsx with dev stack trace
- **GDPR:** CookieBanner with consent-gated analytics (Clarity + GA4)

---

## Architecture Overview

| Layer | Service | URL |
|-------|---------|-----|
| Frontend | Vercel (React 18 / Vite / TypeScript) | get-nautilus.com |
| Backend | Railway (FastAPI / Python 3.11) | artalpha-backend-production.up.railway.app |
| Database | Neon PostgreSQL (serverless) | — |
| AI | OpenAI GPT-4o / GPT-4o-mini | — |
| Email | Resend v2 | hello@get-nautilus.com |
| Automation | n8n (Railway) | primary-production-acb7.up.railway.app |
| Payments | Stripe | Production mode (price IDs needed) |

---

## Data Pipeline Status

| Connector | Status | Method |
|-----------|--------|--------|
| ArtMarket API (Christie's, Sotheby's, Bonhams, Phillips, Heritage, Drouot…) | ✅ Active | Paid REST API |
| Drouot Real | ✅ Active | Playwright headless |
| Invaluable | ✅ Active | JSON API |
| LiveAuctioneers | ✅ Active | Apify actor |
| Artsy | ✅ Active | Public GraphQL |
| Phillips, Artcurial, Bonhams, Christie's, Sotheby's | ✅ Active | Public JSON APIs |
| eBay Art, Artsper, Saatchi, Singulart | ✅ Active | REST APIs |
| Interenchères, Heritage (direct), Catawiki, Barnebys | ❌ Blocked | Cloudflare/IP block/no API |

**Poll frequency:** every 15 minutes  
**Historical data:** daily Artsy scrape for top 20 artists

---

## Pre-Launch Blocklist (Updated Phase 4)

| Priority | Item | Owner | ETA | Notes |
|----------|------|-------|-----|-------|
| 🔴 | Stripe price IDs in Railway env | Camille | Before May 13 | 6 vars — see BLOCKERS.md |
| 🔴 | SPF/DKIM/DMARC on get-nautilus.com | Camille | Before May 1 | See EMAIL_DNS_SETUP.md |
| 🔴 | ART_MARKET_API_KEY in Railway | Camille | Before May 13 | Pipeline returns 0 lots without this |
| 🟡 | Upload og-image.png to /public/ | Camille | Before May 10 | SVG fallback active — PNG replaces it |
| 🟡 | Microsoft Clarity ID → VITE_CLARITY_ID | Camille | Before May 13 | clarity.microsoft.com |
| 🟡 | GA4 Measurement ID → VITE_GA4_ID | Camille | Before May 13 | analytics.google.com |
| 🟡 | Import 9 n8n workflows + activate | Camille | Before May 13 | New: 09-weekly-blog.json |

---

## Routes Inventory

### Public
- `/` — Landing page (Today's Signals + Testimonials)
- `/pricing` — Pricing page
- `/about`, `/contact`, `/faq` — Static pages
- `/market-index` — Public market index
- `/waitlist` — Redirects to `/app/signup` (waitlist removed)
- `/blog`, `/blog/:slug` — Editorial blog (4 seeded posts)
- `/feedback` — NPS + cancellation survey + freeform feedback
- `/legal/terms`, `/legal/privacy`, `/legal/disclaimer` — Legal pages

### Protected App
- `/app/dashboard` — Signal Feed
- `/app/explore` — Explorer (Best Lots / All Auctions / Primary / Convictions / For You)
- `/app/artists` — Artist Intelligence
- `/app/portfolio` — Portfolio tracker
- `/app/alerts` — Price alerts
- `/app/agent` — Larry AI chat
- `/app/calendar` — Auction calendar
- `/app/visualizer` — Room Visualizer
- `/app/onboarding` — 7-step onboarding

### Admin
- `/admin/health` — Pipeline health dashboard
- `/admin/launch` — Launch metrics dashboard
- `/admin/recommendations` — Rec engine analytics

---

## Conversion Funnel

```
Landing → Waitlist/Signup → Onboarding → Explore → Alerts → Subscription
                                 ↑
                          7-step profile setup
                          Personalized lots preview
                          Meet Larry introduction
```

---

## Revenue Model

| Plan | Price | Target |
|------|-------|--------|
| Free | €0 | Lead capture, virality |
| Collector | €9/mo | Entry-level users |
| Investor | €29/mo | Core paying segment |
| Family Office | €99/mo | High-value accounts |
| Institutional | Contact Sales | B2B, family offices |

**7-day free trial** on all paid plans. **30-day money-back** guarantee on new subscriptions.

---

## Success Metrics (Day 1)

| Metric | Target |
|--------|--------|
| Waitlist conversions | 500 |
| Signups in first 48h | 100 |
| Trial starts in first week | 50 |
| Paying subscribers by Day 30 | 50 |
| MRR by Day 30 | €1,450 (50 × €29) |

---

## Known Limitations

1. **Heritage & Catawiki disabled** — Railway IP blocked by their anti-scraping. Re-enable via proxy service if needed.
2. **Interenchères disabled** — Cloudflare. Alternative: use ArtMarket API which covers French auction data.
3. **Barnebys** — No public API. Status: permanent skip.
4. **Email branding** — `from_email` in code still resolves from `settings.transac_from_email`. Ensure Railway env var `TRANSAC_FROM_EMAIL=hello@get-nautilus.com`.

---

## Build Status

**Build is done. Code is frozen. Ready to deploy on May 11.**

```
TypeScript build: PASS — 0 errors
Modules bundled: 1699
Largest bundle: Portfolio (85KB gzip: 17KB)
Build time: 3.26s

Backend files modified in Phase 4:
  app/connectors/artmarketapi_connector.py   — limit 500 → 5000
  app/api/recommendations.py                 — SCORE_FLOOR 55 → 45, fallback strategy
  app/api/lots.py                            — /api/lots/public endpoint
  app/api/blog.py                            — /generate + /seed endpoints
  app/api/admin.py                           — backfill-scores, enrich-artists, stats
  app/api/feedback.py                        — NEW: NPS + cancellation + submit
  app/jobs/wikidata_enrichment.py            — NEW: artist enrichment batch job
  app/main.py                                — feedback router registered
  .env.example                               — NEW: all Railway vars documented

Frontend files modified/created in Phase 4:
  src/app/pages/Landing.tsx                  — Today's Signals, Testimonials, useSEO
  src/app/pages/Waitlist.tsx                 — useSEO
  src/app/pages/FeedbackPage.tsx             — NEW: /feedback route
  src/app/routes.ts                          — /feedback route added
  src/lib/useSEO.ts                          — NEW: dynamic meta tags hook
  src/lib/cache.ts                           — NEW: TTL localStorage cache
  src/lib/dailyStats.ts                      — NEW: daily-seeded social proof stats
  public/og-image.svg                        — NEW: branded SVG og fallback
  n8n-workflows/09-weekly-blog.json          — NEW: Monday 6am blog generation
  .gitignore                                 — added .env.* variants
  .env.example                               — NEW: correct VITE_ vars
```

---

*Updated by Claude Code — Nautilus Phase 5 Production Deploy Complete*
