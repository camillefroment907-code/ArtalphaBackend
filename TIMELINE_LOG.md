# TIMELINE_LOG — Nautilus Launch Build

Last updated: 2026-04-19 (Phase 4 execution)

## Phase 4 Status (2026-04-19)

| Task | Status | Notes |
|------|--------|-------|
| T1 — Pipeline scale (ArtMarketAPI 500→5000 lots) | ✅ DONE | `artmarketapi_connector.py` |
| T1 — Recommendation SCORE_FLOOR 55→45 | ✅ DONE | Looser filter for launch |
| T1 — Global no-DNA fallback for For You tab | ✅ DONE | Always shows content |
| T1 — Wikidata enrichment job | ✅ DONE | `backend/app/jobs/wikidata_enrichment.py` |
| T1 — Deal score backfill endpoint | ✅ DONE | `POST /api/admin/backfill-scores` |
| T3 GAP 1 — og-image.svg fallback | ✅ DONE | `public/og-image.svg` |
| T3 GAP 2 — useSEO hook + react-helmet-async | ✅ DONE | `src/lib/useSEO.ts` |
| T3 GAP 3 — Today's Signals on landing | ✅ DONE | Public lots endpoint + section added |
| T3 GAP 5 — Testimonials on landing | ✅ DONE | 3 cards added |
| T3 GAP 6 — Trial ending + cancellation emails | ✅ ALREADY DONE | Phase 3 wired these |
| T3 GAP 7 — NPS feedback endpoint + page | ✅ DONE | `/api/feedback/nps` + `/feedback` |
| T4 — cache.ts performance utility | ✅ DONE | `src/lib/cache.ts` |
| T5 — Recommendation engine fallback | ✅ DONE | Non-empty For You guaranteed |
| T6 — Blog seeding | ⏳ IN PROGRESS | |
| T7 — Security audit | ✅ DONE | Stripe webhook ✓, CORS ✓, .gitignore ✓ |
| T8 — Deploy prep | ✅ DONE | .env.example updated, vercel.json verified |
| T9 — Smoke tests | ⏳ PENDING | TypeScript build check needed |
| T10 — Final report + status email | ⏳ PENDING | |

**Lot count status:** Pipeline scale-up requires ART_MARKET_API_KEY (Camille action). Without it, connector returns 0 lots. With key + 5k/cycle → estimate 50K–150K unique lots in first 3 weeks. See BLOCKERS.md.

---

## Full Phase History

| Date | Phase | Milestone | Status | Notes |
|------|-------|-----------|--------|-------|
| 2026-04-18 | Phase 1 | Codebase audit complet | ✅ OK | 108 TS files, 31 routes, design system intact |
| 2026-04-18 | Phase 1 | Landing page — ticker + exit intent + sticky CTA | ✅ OK | Added live ticker, exit intent popup, sticky CTA bar, updated copy |
| 2026-04-18 | Phase 1 | Page /waitlist | ✅ OK | Referral mécanique incluse |
| 2026-04-18 | Phase 1 | Pages /legal/* (terms, privacy, disclaimer) | ✅ OK | RGPD conforme |
| 2026-04-18 | Phase 1 | Log files créés (TIMELINE, BUILD, BLOCKERS) | ✅ OK | |
| 2026-04-19 | Phase 1 | Fix bugs critiques identifiés lors de l'audit | 🔄 EN COURS | |
| 2026-04-20 | Phase 1 | Audit backend + collectorDNA schema | ⏳ PLANIFIÉ | |
| 2026-04-21 | Phase 2 | Pipeline catalogue — ingestion 100K+ lots | ⏳ PLANIFIÉ | |
| 2026-04-24 | Phase 2 | 100K+ lots indexés vérifiés | ⏳ PLANIFIÉ | |
| 2026-04-25 | Phase 3 | Larry v2 + Scoring Engine v2 | ⏳ PLANIFIÉ | |
| 2026-04-27 | Phase 3 | Recommendation Engine v1 opérationnel (20 types) | ⏳ PLANIFIÉ | |
| 2026-04-27 | Phase 3 | CollectorDNA — modèle complet et mis à jour en temps réel | ⏳ PLANIFIÉ | |
| 2026-04-28 | Phase 3 | FEATURE FREEZE | ⏳ PLANIFIÉ | Pas de nouvelle feature après cette date |
| 2026-04-29 | Phase 4 | Tests fonctionnels complets | ⏳ PLANIFIÉ | |
| 2026-05-01 | Phase 4 | Tests perf, sécurité, mobile | ⏳ PLANIFIÉ | |
| 2026-05-02 | Phase 5 | PRE-LANCEMENT — /waitlist ouverte | ⏳ PLANIFIÉ | |
| 2026-05-02 | Phase 5 | Outreach email campagne lancée (10K prospects) | ⏳ PLANIFIÉ | |
| 2026-05-05 | Phase 5 | Beta privée 50 Founding Members | ⏳ PLANIFIÉ | |
| 2026-05-08 | Phase 5 | Feedbacks beta + corrections | ⏳ PLANIFIÉ | |
| 2026-05-11 | Phase 6 | Lancement production final | ⏳ PLANIFIÉ | |
| 2026-05-13 | LAUNCH | LANCEMENT PUBLIC — objectif 500 clients payants J0 | ⏳ PLANIFIÉ | |
