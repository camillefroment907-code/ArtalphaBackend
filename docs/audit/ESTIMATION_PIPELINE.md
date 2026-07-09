# ESTIMATION_PIPELINE.md
## Nautilus — Audit Session 1
**Date :** 2026-06-12  
**Règle :** Aucune modification de fichier. Toute conclusion cite fichier + numéro de ligne.

---

## 1. Objectif

Tracer le chemin complet de données depuis la création d'un item de collection jusqu'à l'affichage d'une valeur estimée sur le frontend.

---

## 2. Pipeline actuel (as-is)

### Étape 1 — Création item (frontend → backend)

**Frontend :** `mobile/services/api.ts` — `portfolioService.addItem()`  
**Endpoint :** `POST /api/portfolio/items`  
**Backend :** `backend/app/api/collection.py`

Champs envoyés par le client :
```json
{
  "artist_id": "...",
  "title": "...",
  "medium": "...",
  "year": 2019,
  "purchase_price_eur": 12000,
  "estimated_current_value_eur": 15000   // ← saisi par l'utilisateur
}
```

**Aucun calcul serveur.** La valeur estimée est stockée telle quelle.

### Étape 2 — Lecture collection (backend → frontend)

**Endpoint :** `GET /api/portfolio/items`  
**Backend :** `backend/app/api/collection.py`  
**Frontend :** `mobile/app/(tabs)/index.tsx` via `portfolioService.items()`

Le backend retourne `estimated_current_value_eur` tel qu'il a été stocké.

### Étape 3 — Affichage valeur (frontend)

**Fichier :** `mobile/app/(tabs)/index.tsx`
```typescript
const heroValue = items.reduce((s, i) => s + (i.estimated_current_value_eur ?? 0), 0);
```

**Fichier :** `mobile/app/(tabs)/profile.tsx`
```typescript
const totalValue = items.reduce((s, i) => s + (i.estimated_current_value_eur ?? 0), 0);
```

---

## 3. Pipeline de valorisation manuelle (optionnel)

### Création d'une valorisation

**Endpoint :** `POST /api/collection/items/{id}/valuations`  
**Backend :** `backend/app/api/collection.py`

Ce endpoint existe mais :
1. Il reçoit `value_eur` — fournie par l'appelant
2. Il reçoit `comparables_used` — liste fournie par l'appelant, pas calculée
3. Il ne met PAS à jour `estimated_current_value_eur` automatiquement

**Verdict :** Ce pipeline de "valorisation" est un système de prise de notes enrichi, pas un moteur de calcul.

---

## 4. Pipeline de scoring (scoring.py) — NE PAS CONFONDRE

**Fichier :** `backend/app/engines/scoring.py`

Ce pipeline score des **lots d'enchères** pour identifier des opportunités d'achat :

```python
def compute_deal_score(lot: dict, artist_stats: dict, oracle_signal: str) -> dict:
    # 5 composantes :
    # - below_estimate_score (30%)   : lot sous son estimation
    # - below_market_avg_score (30%) : lot sous la moyenne marché
    # - liquidity_score (20%)        : liquidité de l'artiste
    # - house_reputation_score (10%) : réputation maison de vente
    # - data_confidence_score (10%)  : confiance dans les données
```

**Ce scoring NE valorise PAS une œuvre déjà achetée.** Il évalue une opportunité d'achat future.

---

## 5. Pipeline Oracle (oracle_service.py) — NE PAS CONFONDRE

**Fichier :** `backend/app/services/oracle_service.py`

Génère des signaux timing sur les artistes : `BUY_NOW`, `WATCH`, `HOLD`, `AVOID`.  
Basé sur volume d'enchères récentes et tendances de prix.  
**Ce service NE calcule PAS la valeur d'une œuvre.**

---

## 6. Pipeline de projections (projections.py) — NE PAS CONFONDRE

**Fichier :** `backend/app/engines/projections.py`

Prend une valeur courante en entrée et projette vers le futur :
```python
def project_value(current_value: float, artist_tier: str, years: int) -> float:
```

**Ce pipeline NE calcule PAS `current_value`** — il la reçoit.

---

## 7. Données disponibles pour un pipeline futur

Ces tables existent dans la DB et pourraient alimenter un moteur de valorisation :

| Table | Contenu | Utilité potentielle |
|---|---|---|
| `hammer_prices` | Prix marteau historiques par lot | Base de comparables |
| `hammer_artist_stats` | Stats agrégées par artiste | Médiane de prix, volume, tendance |
| `hammer_artist_medium_stats` | Stats par artiste × médium | Comparable plus précis (huile vs dessin) |
| `lots` | Lots d'enchères avec dimensions, médium, provenance | Filtrage de comparables |
| `artists` | Profil artiste avec tier | Facteur de valorisation |

**Ces données existent. Le moteur qui les exploite pour valoriser une collection n'existe pas.**

---

## 8. Gap critique — Étapes manquantes

Pour un pipeline complet, il faudrait :

```
POST /items → [1] identifier l'artiste + médium + dimensions
            → [2] requêter hammer_prices pour comparables (même artiste, même médium, ±30% taille)
            → [3] calculer médiane prix/cm² des 24 derniers mois
            → [4] ajuster par tier artiste + liquidité
            → [5] stocker estimated_current_value_eur calculé
            → [6] job nightly : revaloriser si nouvelles enchères > 90 jours
```

**Étapes 1–6 : NON TROUVÉES dans le codebase.**

---

## 9. Résumé

| Étape pipeline | Statut |
|---|---|
| Saisie manuelle de valeur | IMPLÉMENTÉE |
| Stockage valuation en DB | IMPLÉMENTÉ |
| Calcul automatique au moment de la création | **ABSENT** |
| Recherche de comparables côté serveur | **ABSENT** |
| Revalorisation périodique automatique | **ABSENT** |
| Projection future (à partir d'une valeur connue) | IMPLÉMENTÉE |
| Scoring opportunités d'achat | IMPLÉMENTÉ (usage différent) |
