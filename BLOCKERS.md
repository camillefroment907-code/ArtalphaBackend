# BLOCKERS — Nautilus Launch

Last updated: 2026-04-19

## 🔴 BLOQUANTS CRITIQUES

_Aucun bloquant critique identifié à date._

## 🟡 ATTENTION — Requires Camille action

| # | Blocage | Impact | Action requise | Statut |
|---|---------|--------|----------------|--------|
| 3 | Stripe production price IDs non confirmés | Billing peut échouer en prod | Vérifier/créer dans Stripe Dashboard, puis setter dans Railway env: `STRIPE_PRICE_COLLECTOR_MONTHLY`, `STRIPE_PRICE_COLLECTOR_ANNUAL`, `STRIPE_PRICE_INVESTOR_MONTHLY`, `STRIPE_PRICE_INVESTOR_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL` | ⏳ Camille |
| 5 | SPF/DKIM/DMARC non configurés | Emails outreach vont en spam | Voir EMAIL_DNS_SETUP.md | ⏳ Camille |
| 6 | Microsoft Clarity analytics ID non configuré | Analytics consent-gated CookieBanner ne chargera pas Clarity | Créer un projet sur clarity.microsoft.com, copier l'ID, setter `VITE_CLARITY_ID=<id>` dans Vercel env | ⏳ Camille |
| 7 | GA4 Measurement ID non configuré | Conversion tracking absent | Créer propriété dans Google Analytics 4, setter `VITE_GA4_ID=<G-XXXXXX>` dans Vercel env | ⏳ Camille |
| 8 | og:image (Open Graph) absent | Social shares sans preview image | Créer un 1200×630px PNG brandé et uploader sur Vercel → chemin `/og-image.png` | ⏳ Camille |
| 9 | ART_MARKET_API_KEY | ArtMarket API connector silently returns 0 lots | Obtenir clé sur artmarketapi.com, setter `ART_MARKET_API_KEY` dans Railway env | ⏳ Camille |
| 10 | Import n8n workflows | 9 workflow JSON files ready but not imported (includes new 09-weekly-blog.json) | Se connecter à n8n dashboard → Import chaque fichier dans `n8n-workflows/` → Activer chaque workflow | ⏳ Camille |

## 🟢 RÉSOLUS

| # | Blocage | Résolution | Date |
|---|---------|------------|------|
| 1 | Design system — confusion Inter vs Playfair | Confirmé : custom.css a les bons tokens | 2026-04-18 |
| 1P2 | Backend /api/waitlist inexistant | Créé: `app/api/waitlist.py` + `WaitlistEntry` model — auto-creates table on deploy | 2026-04-18 |
| 2P2 | CollectorDNA schema inexistant | Créé: `CollectorDNA` + `RecommendationEvent` models in db_models.py | 2026-04-18 |
| 4 | CORS get-nautilus.com non configuré | Ajouté https://get-nautilus.com et https://www.get-nautilus.com dans main.py CORS allow_origins | 2026-04-18 |
| P3-1 | Pipeline scale tracking | ScrapingRun model added to db_models.py | 2026-04-19 |
| P3-2 | Missing email templates | Added 6 missing email functions to email_service.py | 2026-04-19 |
| P3-3 | Billing missing payment success email | _handle_payment_succeeded now sends send_payment_success_email | 2026-04-19 |
| P3-4 | Email branding ArtAlpha → Nautilus | Updated _wrap_html, send_deal_alert_email URLs | 2026-04-19 |
| P3-5 | Security headers | vercel.json upgraded with CSP, HSTS, Permissions-Policy | 2026-04-19 |
| P3-6 | ErrorBoundary missing | Created ErrorBoundary.tsx, wired into App.tsx | 2026-04-19 |
| P3-7 | GDPR cookie banner missing | CookieBanner.tsx created with consent-gated Clarity load | 2026-04-19 |
| P3-8 | SEO basics | index.html: og:image, canonical, Twitter card, schema.org; sitemap.xml; robots.txt | 2026-04-19 |
| P3-9 | Mobile navigation | Header.tsx: hamburger menu with drawer, 44px touch targets | 2026-04-19 |
| P3-10 | Onboarding incomplete | Onboarding.tsx: added personalized lots preview + Meet Larry steps | 2026-04-19 |

## Production Deployment Checklist (Task 11)

### Frontend (Vercel)
- [x] vercel.json — SPA rewrite + CSP + HSTS headers
- [x] public/sitemap.xml — static routes
- [x] public/robots.txt — allow public, block /app/ /admin/ /api/
- [x] index.html — og:image, canonical, Twitter card, schema.org
- [x] CookieBanner.tsx — GDPR consent gate for analytics
- [ ] `VITE_API_URL` set to Railway backend URL in Vercel env
- [ ] `VITE_CLARITY_ID` set (get from clarity.microsoft.com)
- [ ] `VITE_GA4_ID` set (get from analytics.google.com)
- [ ] Upload og-image.png to /public/

### Backend (Railway)
- [ ] `STRIPE_PRICE_*` env vars set (6 price IDs)
- [ ] `STRIPE_WEBHOOK_SECRET` set (Stripe Dashboard → Webhooks)
- [ ] `ART_MARKET_API_KEY` set
- [ ] `RESEND_API_KEY` set
- [ ] `OPENAI_API_KEY` set
- [ ] `APIFY_API_TOKEN` set (for LiveAuctioneers)
- [ ] Database migrations run (auto via startup)
- [ ] Backend health check: GET https://artalpha-backend-production.up.railway.app/health

### DNS & Email (get-nautilus.com)
- [ ] SPF: v=spf1 include:amazonses.com include:_spf.resend.com ~all
- [ ] DKIM: see EMAIL_DNS_SETUP.md
- [ ] DMARC: see EMAIL_DNS_SETUP.md
- [ ] www.get-nautilus.com → Vercel

### n8n (Railway instance)
- [ ] Import 8 workflow files from n8n-workflows/
- [ ] Set RESEND SMTP credentials in n8n
- [ ] Activate all 8 workflows

## Actions immédiates requises (humain)

1. **Camille** : Setter les 6 Stripe price IDs dans Railway env vars
2. **Camille** : Configurer SPF/DKIM/DMARC sur get-nautilus.com — voir EMAIL_DNS_SETUP.md
3. **Camille** : Créer un compte Microsoft Clarity + setter VITE_CLARITY_ID dans Vercel
4. **Camille** : Uploader og-image.png (1200×630) dans /public/
5. **Camille** : Vérifier que get-nautilus.com pointe sur Vercel
6. **Camille** : Importer les 8 n8n workflows depuis le dossier n8n-workflows/
