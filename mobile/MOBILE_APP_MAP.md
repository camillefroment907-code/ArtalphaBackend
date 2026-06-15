# MOBILE_APP_MAP.md — Nautilus Mobile
_Generated: 2026-06-11_

## Route Tree

```
/login
/onboarding/step1   (NEW)
/onboarding/step2   (NEW)
/onboarding/step3   (NEW)
/onboarding/step4   (NEW)
/onboarding/step5   (NEW)
/onboarding/step6   (NEW)
/onboarding/step7   (NEW)
/(tabs)
  ├── index          → Home / Dashboard
  ├── collection     → Collection grid
  ├── alerts         → Alert feed
  ├── larry          → AI chat
  └── profile        → Profile & settings
/artwork/[id]
/add-artwork         (modal)
  ├── index          → Mode selection
  ├── photo          → Camera capture
  ├── search         → Artist search
  ├── analyse        → Loading state
  ├── result         → AI result (stub)
  ├── manual         → Form + estimate
  ├── price          → Acquisition price
  └── success        → Wow moment
/collection-health
```

## Screen Inventory

| Screen | Route | Parent | Entry Points | Exit Points | CTAs | Risk |
|--------|-------|--------|-------------|-------------|------|------|
| Login | /login | root | cold start, logout, 401 | tabs, onboarding | Se connecter | LOW |
| Onboarding 1 | /onboarding/step1 | onboarding | post-login | step2 | Continuer | LOW |
| Onboarding 2 | /onboarding/step2 | onboarding | step1 | step3 | Continuer | LOW |
| Onboarding 3 | /onboarding/step3 | onboarding | step2 | step4 | Continuer, Passer | LOW |
| Onboarding 4 | /onboarding/step4 | onboarding | step3 | step5 | Continuer, Passer | LOW |
| Onboarding 5 | /onboarding/step5 | onboarding | step4 | step6 | Continuer, Passer | LOW |
| Onboarding 6 | /onboarding/step6 | onboarding | step5 | step7 | Continuer | LOW |
| Onboarding 7 | /onboarding/step7 | onboarding | step6 | tabs | Découvrir Nautilus | LOW |
| Home | /(tabs)/index | tabs | default tab | alerts, add-artwork, collection, collection-health, larry | Ajouter, Larry chips | MEDIUM |
| Collection | /(tabs)/collection | tabs | home card, tab | artwork/[id], add-artwork | + Add, mosaic cells | LOW |
| Alerts | /(tabs)/alerts | tabs | home, tab | — | Voir la vente, Compléter | MEDIUM |
| Larry | /(tabs)/larry | tabs | tab, home chips, artwork | — | Send, chips | LOW |
| Profile | /(tabs)/profile | tabs | tab | artwork/[id], collection-health, login | Déconnecter, Modifier (stub) | MEDIUM |
| Artwork Detail | /artwork/[id] | root | collection cells, profile | add-artwork/manual, larry | Modifier, Vendre | MEDIUM |
| Collection Health | /collection-health | root | home, profile | collection | Action rows | LOW |
| Add Mode Select | /add-artwork | root (modal) | + buttons | photo, search, manual | Mode cards | LOW |
| Photo | /add-artwork/photo | add-artwork | mode select | manual | Shutter, Galerie | LOW |
| Search | /add-artwork/search | add-artwork | mode select | manual | Result rows | MEDIUM |
| Manual Form | /add-artwork/manual | add-artwork | photo, search, result, artwork edit | price | Continuer | LOW |
| Price | /add-artwork/price | add-artwork | manual | success | Ajouter, Passer | LOW |
| Success | /add-artwork/success | add-artwork | price | collection | Continuer, Voir | LOW |

## Navigation Graph

```
Login ──────────→ Onboarding 1→2→3→4→5→6→7 ──→ (tabs)
                                                    │
                           ┌────────────────────────┤
                           ↓                        ↓
                        Home                   Collection
                           │                        │
                     ┌─────┼──────┐            Artwork [id]
                     ↓     ↓      ↓                 │
                  Alerts Larry Profile           add-artwork
                                  │             (modal)
                          Collection Health
```

## API Dependency Map

| Screen | APIs Used |
|--------|-----------|
| Login | POST /api/auth/login |
| Home | GET /api/portfolio/items, GET /api/alerts, GET /api/auth/me |
| Collection | GET /api/portfolio/items |
| Alerts | GET /api/alerts |
| Larry | GET /api/auth/me, GET /api/portfolio/items, POST /api/chat/message |
| Profile | GET /api/auth/me, GET /api/portfolio/items |
| Artwork Detail | GET /api/portfolio/items/{id} |
| Collection Health | GET /api/portfolio/items |
| Search | GET /api/artist-profiles/autocomplete, GET /api/artist-profiles/search/{q} |
| Manual | GET /api/artist-profiles/autocomplete, GET /api/artist-profiles/search/{q}, GET /api/artist-profiles/{name}/price-history, GET /api/artist-profiles/{name}/investment-grade |
| Price | POST /api/portfolio/items |
