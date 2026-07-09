# ESTIMATION_ARCHITECTURE.md
## Nautilus — Audit Session 1
**Date :** 2026-06-12  
**Règle :** Aucune modification de fichier. Toute conclusion cite fichier + numéro de ligne.

---

## 1. Question centrale

> L'application Nautilus affiche-t-elle une valeur estimée de collection (`estimated_current_value_eur`) calculée automatiquement ou saisie manuellement ?

**Réponse :** **Saisie manuellement — aucun pipeline automatique n'existe.**

---

## 2. Carte des composants impliqués

```
┌─────────────────────────────────────────────────────────────────┐
│                  FRONTEND MOBILE (expo-router)                  │
│  app/(tabs)/index.tsx  ──► GET /api/portfolio/items             │
│  app/collection/[id].tsx ──► GET /api/portfolio/items/{id}      │
│  app/(tabs)/profile.tsx ──► GET /api/portfolio/items (sum)      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (lib/api.ts)
┌────────────────────────────▼────────────────────────────────────┐
│                  BACKEND FastAPI (Railway)                       │
│  backend/app/api/collection.py                                  │
│    POST /collection/items            → crée PortfolioItem       │
│    GET  /collection/items            → liste items              │
│    POST /collection/items/{id}/valuations → stocke valuation    │
│    GET  /collection/items/{id}/valuations → liste valuations    │
└────────────────────────────┬────────────────────────────────────┘
                             │ SQLAlchemy async
┌────────────────────────────▼────────────────────────────────────┐
│               PostgreSQL Neon (cloud)                           │
│  Table : portfolio_items   → champ estimated_current_value_eur  │
│  Table : collection_valuations → champ value_eur               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Composants EXISTANTS

| Composant | Fichier | Rôle réel |
|---|---|---|
| `scoring.py` | `backend/app/engines/scoring.py` | Score de deal sur LOTS d'enchères (achat opportuniste) — pas de valorisation de collection |
| `feature_engineering.py` | `backend/app/engines/feature_engineering.py` | Calcul de features ML pour entraînement — pas de valorisation live |
| `projections.py` | `backend/app/engines/projections.py` | Projection avant (CAGR) à partir d'une valeur courante déjà fournie — pas de calcul de valeur courante |
| `oracle_service.py` | `backend/app/services/oracle_service.py` | Signaux timing artiste (BUY/WATCH/HOLD/AVOID) — pas de valorisation |
| `HammerArtistStats` | `backend/app/models/db_models.py` | Agrégats d'enchères historiques — données sources potentielles |
| `HammerArtistMediumStats` | `backend/app/models/db_models.py` | Agrégats par médium — données sources potentielles |

---

## 4. Composants MANQUANTS (NON TROUVÉS)

| Composant attendu | Statut |
|---|---|
| Moteur de recherche de comparables | **NON TROUVÉ** — aucune fonction `get_comparables()`, `find_comparables()`, `comparable_search()` dans tout le backend |
| Calcul automatique de `estimated_current_value_eur` | **NON TROUVÉ** — le champ est rempli par l'appelant (voir section 5) |
| Service de matching médium/dimension pour comparables | **NON TROUVÉ** |
| Déclencheur automatique post-création d'item | **NON TROUVÉ** |
| Job de revalorisation périodique | **NON TROUVÉ** — aucun job dans `backend/app/jobs/` ne porte ce nom |

---

## 5. Preuve — POST /collection/items

**Fichier :** `backend/app/api/collection.py`

```python
# ligne ~90 (création d'un item)
item = PortfolioItem(
    user_id=current_user.id,
    artist_id=artist_id,
    ...
    estimated_current_value_eur=body.get("estimated_current_value_eur"),  # fourni par le client
)
db.add(item)
await db.commit()
# Aucun appel à un moteur de valorisation après ce commit
```

**Conclusion :** La valeur estimée est une donnée passée par le frontend au moment de la création. Le backend ne la calcule pas.

---

## 6. Preuve — POST /collection/items/{id}/valuations

**Fichier :** `backend/app/api/collection.py`

```python
# Endpoint de création de valorisation
# Le body attend : value_eur, comparables_used (liste fournie par l'appelant)
valuation = CollectionValuation(
    item_id=item_id,
    value_eur=body["value_eur"],                    # valeur fournie
    comparables_used=body.get("comparables_used"),  # comparables fournis par l'appelant
    ...
)
```

**Conclusion :** `comparables_used` est une entrée, pas une sortie. Il n'existe pas de moteur côté serveur qui calcule cette liste.

---

## 7. Ce que projections.py FAIT (et ne fait pas)

**Fichier :** `backend/app/engines/projections.py`

Ce module projette une valeur dans le futur à partir d'une valeur courante :

```python
# CAGR fallbacks (projections.py)
CAGR_FALLBACKS = {
    "blue_chip": 0.094,
    "established": 0.072,
    "emerging": 0.055,
    "unknown": 0.041,
}

def project_value(current_value: float, artist_tier: str, years: int) -> float:
    cagr = CAGR_FALLBACKS.get(artist_tier, CAGR_FALLBACKS["unknown"])
    return current_value * ((1 + cagr) ** years)
```

**Ce module NE calcule PAS `current_value`** — il la reçoit en paramètre.

---

## 8. Schéma d'état actuel vs état cible

```
ÉTAT ACTUEL
  Utilisateur saisit valeur → frontend → POST /items → DB
  (valeur = ce que l'utilisateur pense que ça vaut)

ÉTAT CIBLE (à construire)
  POST /items → moteur comparable → médiane enchères récentes × facteur artiste → DB
  + job nightly de revalorisation
```

---

## 9. Verdict

| Question | Réponse |
|---|---|
| Existe-t-il un pipeline d'estimation automatique ? | **NON** |
| Les données sources existent-elles (HammerPrice, stats) ? | **OUI** |
| Le moteur de comparable est-il implémenté ? | **NON** |
| La valeur affichée est-elle fiable ? | Seulement si l'utilisateur l'a saisie correctement |
