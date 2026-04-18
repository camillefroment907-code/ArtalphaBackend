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

### Checklist Delta
- [x] Landing page — live ticker actif
- [x] Exit intent popup actif
- [x] Sticky CTA bar active
- [x] Page waitlist créée (/waitlist)
- [x] Legal pages créées (/legal/*)
- [ ] A/B test headline
- [ ] Microsoft Clarity
- [ ] CollectorDNA schema
- [ ] "For You" tab Explorer
- [ ] Admin dashboards
