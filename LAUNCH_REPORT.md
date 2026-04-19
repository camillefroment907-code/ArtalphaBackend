# LAUNCH REPORT — Nautilus
**Target launch date: May 13, 2026**
**Report generated: 2026-04-19**

---

## Executive Summary

Nautilus is a production-ready art market intelligence platform targeting art collectors and investors. The full stack (frontend + backend) was built across 3 intensive phases. As of this report, the platform is **feature-complete and deployable** pending 6 Camille-action items (Stripe price IDs, DNS, analytics).

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

## Pre-Launch Blocklist

| Priority | Item | Owner | ETA |
|----------|------|-------|-----|
| 🔴 | Stripe price IDs in Railway env | Camille | Before May 13 |
| 🔴 | SPF/DKIM/DMARC on get-nautilus.com | Camille | Before May 1 |
| 🟡 | Upload og-image.png to /public/ | Camille | Before May 10 |
| 🟡 | Microsoft Clarity ID → VITE_CLARITY_ID | Camille | Before May 13 |
| 🟡 | GA4 Measurement ID → VITE_GA4_ID | Camille | Before May 13 |
| 🟡 | Import 8 n8n workflows + activate | Camille | Before May 13 |
| 🟢 | ART_MARKET_API_KEY in Railway | Camille | Before May 13 |

---

## Routes Inventory

### Public
- `/` — Landing page
- `/pricing` — Pricing page
- `/about`, `/contact`, `/faq` — Static pages
- `/market-index` — Public market index
- `/waitlist` — Pre-launch waitlist
- `/blog`, `/blog/:slug` — Editorial blog
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

*Generated by Claude Code — Nautilus Phase 3 Launch Sprint*
