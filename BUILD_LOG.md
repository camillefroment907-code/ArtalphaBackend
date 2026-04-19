# BUILD_LOG — Nautilus

## Session 2026-04-18 — Phase 1: Audit + Landing + Missing Pages

### Actions
1. **Audit complet codebase** — 108 TS files cartographiés, 31 routes, design system intact
   - Design tokens confirmés dans custom.css (navy #0A1628, gold #C6A85A, Playfair, JetBrains Mono)
   - Fonctionnalités existantes : Explorer (4 tabs), Larry, Portfolio, Artist Intelligence, Alerts, Stripe billing
   - Manquant : Live ticker, exit intent, sticky CTA, /waitlist, /legal/*, collectorDNA, "For You" tab, admin dashboards

2. **Landing page — enrichissement** (PRESERVE + COMPLETE)
   - Ajouté : live ticker sous le header avec données API réelles
   - Ajouté : exit intent popup (capture email sur mouseout du viewport)
   - Ajouté : sticky CTA bar après 50% de scroll
   - Mis à jour : headline → "The art market's best-kept secret is now yours."
   - Mis à jour : subheadline avec copy complet de la spec
   - Ajouté : social proof "Trusted by collectors in 28 countries" avec avatars + 4.9/5
   - Ajouté : 2 CTAs distincts [Start free] + [See live opportunities →]

3. **Page /waitlist** — créée
   - Headline + perks Founding Member
   - Mécanique referral (code unique, +10 positions par referral)
   - Form email + intégration backend /api/waitlist

4. **Pages /legal*** — créées
   - /legal/terms — CGU
   - /legal/privacy — RGPD complet
   - /legal/disclaimer — Not financial advice
   - Cookie banner RGPD

5. **Routes** — mis à jour
   - /waitlist → Waitlist
   - /legal/terms → Legal (Terms)
   - /legal/privacy → Legal (Privacy)
   - /legal/disclaimer → Legal (Disclaimer)

### Checklist Delta Phase 1
- [x] Landing page — live ticker actif
- [x] Exit intent popup actif
- [x] Sticky CTA bar active
- [x] Page waitlist créée (/waitlist)
- [x] Legal pages créées (/legal/*)

---

## Session 2026-04-18 — Phase 2: Backend, CollectorDNA, Rec Engine, Admin, Blog

### FIX 1 — /api/waitlist ✓
- `backend/app/api/waitlist.py` — POST /api/waitlist (idempotent, referral boost), GET /count, GET /position/:email
- `WaitlistEntry` model added to db_models.py — auto-creates table on next deploy

### FIX 2 — CollectorDNA schema ✓
- `CollectorDNA` model — behavioral fingerprint (top_artists, top_categories, budget, signals)
- `RecommendationEvent` model — impression/read/dismiss/action tracking

### FIX 3 — Stripe price IDs ⏳ Camille action required
- IDs need to be confirmed in Stripe Dashboard and set as Railway env vars
- See BLOCKERS.md for exact variable names

### FIX 4 — Email DNS ✓ (documentation)
- EMAIL_DNS_SETUP.md created with exact SPF/DKIM/DMARC records for Resend + get-nautilus.com
- CORS: added get-nautilus.com to backend allow_origins

### Task 1 — CollectorDNA FastAPI layer ✓
- `backend/app/api/collector.py` — GET/PATCH /api/collector/dna + POST /api/collector/signal

### Task 2 — dnaSignal.ts frontend ✓
- `src/lib/dnaSignal.ts` — fire-and-forget signals: view, save, dismiss, search, memo, portfolio_add

### Task 3 — Recommendation Engine ✓
- `backend/app/api/recommendations.py` — GET /api/recommendations/for-you (11 strategies)
- Explore.tsx "For You" tab wired to new endpoint
- POST /api/recommendations/dismiss/:lot_id and /read/:lot_id

### Task 4 — Wishlist Parser ✓
- `backend/app/api/wishlist.py` extended with POST /api/wishlist/parse
- GPT-4o-mini NLP → structured criteria → DB search

### Task 5 — RecommendationPopup ✓
- `src/app/components/RecommendationPopup.tsx` — shown 4s post-login, once per session
- Added to Root.tsx

### Task 6 — Larry Proactive Sidebar ✓
- Larry.tsx: 30s proactive trigger — fetches recommendations, shows unread badge
- (Backend larry_proactive.py was already solid)

### Task 7 — Admin Dashboards ✓
- Backend: GET /api/admin/health, /launch, /recommendations
- Frontend: /admin/health, /admin/launch, /admin/recommendations

### Task 8 — Blog System ✓
- `BlogPost` model + `backend/app/api/blog.py` (CRUD, admin-gated write)
- `src/app/pages/Blog.tsx` — /blog listing page
- `src/app/pages/BlogPost.tsx` — /blog/:slug detail page

### Task 9 — Self-healing layer ✓
- `src/lib/apiClient.ts` — retry, circuit breaker, 401 redirect, request deduplication
- `public/lot-placeholder.svg` — branded placeholder for broken lot images

### Task 10 — n8n Workflows ✓
- `n8n-workflows/01-welcome-email.json`
- `n8n-workflows/02-waitlist-confirmation.json`
- `n8n-workflows/03-deal-alert.json`
- `n8n-workflows/04-weekly-digest.json`
- `n8n-workflows/05-launch-day-blast.json`
- `n8n-workflows/06-upgrade-prompt.json`
- `n8n-workflows/07-subscription-confirmed.json`
- `n8n-workflows/08-churn-recovery.json`

### Checklist Delta Phase 2
- [x] /api/waitlist backend
- [x] CollectorDNA schema + API
- [x] Recommendation Engine (11 strategies)
- [x] Wishlist Parser (GPT-4o-mini)
- [x] RecommendationPopup frontend
- [x] Larry proactive 30s trigger
- [x] Admin dashboards (/admin/health, /launch, /recommendations)
- [x] Blog system (/blog, /blog/:slug)
- [x] Self-healing apiClient.ts
- [x] n8n workflows (8 emails)
- [ ] Stripe price IDs — Camille must set in Railway env
- [ ] Email DNS (SPF/DKIM/DMARC) — Camille must configure on get-nautilus.com
- [ ] Import n8n workflows in n8n dashboard
- [ ] Microsoft Clarity analytics tag

---

## Session 2026-04-18 — Phase 3: Final Launch Sprint

### Task 1 — Pipeline Audit ✓

**Connector inventory (24 files in backend/app/connectors/):**

| Connector | Status | Method |
|-----------|--------|--------|
| Drouot Real | ✅ Active | Playwright headless |
| Invaluable | ✅ Active | JSON API scraping |
| LiveAuctioneers | ✅ Active | Apify actor or direct API |
| Artsy | ✅ Active | Public GraphQL API |
| ArtMarket API | ✅ Active | Paid REST API (Christie's, Sotheby's, Bonhams, Phillips, Heritage, Drouot, Artcurial, Tajan, Millon, Cornette) |
| Phillips | ✅ Active | Public JSON API |
| Artcurial | ✅ Active | Public JSON API |
| Bonhams | ✅ Active | Public JSON API |
| Christie's | ✅ Active | Public JSON API |
| Sotheby's | ✅ Active | Public JSON API |
| eBay Art | ✅ Active | eBay REST API |
| Artsper | ✅ Active | Gallery/primary API |
| Saatchi Art | ✅ Active | Primary market API |
| Singulart | ✅ Active | Primary market API |
| Interenchères | ❌ Disabled | Cloudflare blocks all |
| Heritage (direct) | ❌ Disabled | Railway IP blocked |
| Catawiki | ❌ Disabled | Railway IP blocked |
| Barnebys | ❌ Disabled | No public API |

**Schedule (startup_beat.py):** poll every 15 min · rescore every 60 min · historical daily 04:00 UTC · enrichment every 6h

**Scale-up actions:** ScrapingRun tracking table added; ArtMarket API lots-per-cycle increased to 5000.

### Task 1 Checklist
- [x] Connector audit logged
- [x] ScrapingRun DB model added
- [ ] Wikidata artist enrichment (requires WIKIDATA_SPARQL env + cron)

### Task 2 — Mobile Optimization ✓
- Header.tsx: hamburger menu (mobile ≤768px), drawer with all nav items, 44px touch targets
- Body: `overflow-x: hidden` on mobile via CSS class

### Task 3 — Performance ✓
- index.html: preconnect to backend + Google Fonts
- apiClient.ts: localStorage caching (GET requests, TTL-aware)

### Task 4 — SEO Complete ✓
- index.html: og:image, canonical, Twitter card meta tags
- public/sitemap.xml: static routes + blog
- public/robots.txt: allow all, sitemap pointer
- vercel.json: CSP headers, HSTS, Permissions-Policy

### Phase 3 Checklist
- [x] Task 1: Pipeline audit + ScrapingRun model
- [x] Task 2: Mobile optimization (Header hamburger)
- [x] Task 3: Performance (preconnect, caching)
- [x] Task 4: SEO (sitemap, robots, meta tags, CSP)
- [ ] Task 5: Stripe production (audit billing.py webhooks)
- [ ] Task 6: Transactional email complete (11 missing templates)
- [ ] Task 7: Onboarding flow (5-step)
- [ ] Task 8: Landing page final polish
- [ ] Task 9: Error states + ErrorBoundary
- [ ] Task 10: Security hardening (done: vercel.json CSP)
- [ ] Task 11: Production deployment checklist
- [ ] Task 12: Launch Report
