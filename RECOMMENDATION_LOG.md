# RECOMMENDATION_LOG — Nautilus Recommendation Engine

Last updated: 2026-04-18

## Status du moteur

| Composant | Statut | Notes |
|-----------|--------|-------|
| CollectorDNA schema (backend) | ⏳ À créer | Endpoint /api/recommendations/dna |
| Endpoint /api/agent/recommendations | ✅ Existant | Déjà en prod |
| 20 types de recommandations (logique) | ⏳ À implémenter | Backend + frontend |
| Popup connexion (Surface 1) | ⏳ À implémenter | |
| Section "For You" dans Explorer (Surface 2) | ⏳ À implémenter | Onglet Tab 5 |
| Larry proactif sidebar (Surface 3) | ✅ Partiel | Larry existe, logique proactive à enrichir |
| Email Weekly Brief (Surface 4) | ⏳ À configurer | n8n workflow |
| Email Urgent Alert (Surface 5) | ⏳ À configurer | n8n workflow |
| Notifications in-app / cloche (Surface 6) | ⏳ À implémenter | |
| Feedback loop (thumbs up/down) | ⏳ À implémenter | |
| Auto-recalibration hebdomadaire | ⏳ À implémenter | Cron job n8n |
| Dashboard /admin/recommendations | ⏳ À implémenter | |

## Métriques (baseline — à remplir au lancement)

| Métrique | Valeur cible | Valeur actuelle |
|----------|-------------|-----------------|
| Taux de clic global | >15% | — |
| Collection Completion (Type 1) | >20% CTR | — |
| Style Twin (Type 2) | >18% CTR | — |
| Price Gap Alert (Type 3) | >35% CTR | — |
| What Collectors Like You (Type 4) | >12% CTR | — |
| Artist Momentum (Type 5) | >22% CTR | — |
| Portfolio Diversification (Type 6) | >10% CTR | — |
| Auction House Selector (Type 7) | >15% CTR | — |
| Seasonal Intelligence (Type 8) | >12% CTR | — |
| Record Proximity (Type 9) | >30% CTR | — |
| Cross-Market Arbitrage (Type 10) | >25% CTR | — |
| Provenance Premium (Type 11) | >18% CTR | — |
| Complete the Set (Type 12) | >28% CTR | — |
| Emerging Artist Radar (Type 13) | >14% CTR | — |
| Larry Contextual Nudge (Type 14) | >40% CTR | — |
| Post-Purchase Intelligence (Type 15) | >50% CTR | — |
| Portfolio Valuation Alert (Type 16) | >35% CTR | — |
| Buy the Dip (Type 17) | >20% CTR | — |
| Taste Evolution Tracker (Type 18) | >16% CTR | — |
| Geographic Opportunity (Type 19) | >18% CTR | — |
| Wishlist Match (Type 20) | >45% CTR | — |

## Plan d'implémentation

### Phase 1 — Infrastructure (21-24 avril)
- Créer table `collector_dna` en base PostgreSQL
- Créer endpoint PATCH /api/recommendations/dna (met à jour en temps réel)
- Créer endpoint GET /api/recommendations/for-you (récupère les recos personnalisées)
- Implémenter les 20 types de logique côté backend

### Phase 2 — Frontend (25-27 avril)
- Tab "For You" dans /app/explore
- Popup de connexion (recommandation haute pertinence)
- Notifications in-app (cloche)
- Feedback buttons (thumbs up/down, dismiss)

### Phase 3 — Email + n8n (28 avril)
- 8 workflows n8n pour les 8 emails de recommandation
- Weekly Intelligence Brief (lundi 8h)
- Alertes urgentes (temps réel)

### Phase 4 — Admin dashboard (avant le 2 mai)
- /admin/recommendations dashboard
- Métriques temps réel
- Actions admin (forcer reco, suspendre type, ajuster fréquence)
