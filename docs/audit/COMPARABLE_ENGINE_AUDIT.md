# COMPARABLE_ENGINE_AUDIT.md
## Nautilus — Audit Session 1
**Date :** 2026-06-12  
**Règle :** Aucune modification de fichier. Toute conclusion cite fichier + numéro de ligne.

---

## 1. Question centrale

> Existe-t-il un moteur de recherche de comparables d'enchères pour valoriser une œuvre de la collection ?

**Réponse :** **NON TROUVÉ.**

---

## 2. Recherche exhaustive effectuée

### 2.1 Fonctions recherchées

Termes recherchés dans tout le backend :
- `get_comparables`
- `find_comparables`
- `comparable_search`
- `search_comparables`
- `comparables`
- `comparable_lots`
- `similar_lots`
- `find_similar`

**Résultat :** Aucune fonction de calcul de comparables trouvée.

Le seul endroit où `comparables_used` apparaît est dans le modèle `CollectionValuation` comme champ de stockage d'une liste fournie par l'appelant.

**Fichier :** `backend/app/models/db_models.py`
```python
class CollectionValuation(Base):
    ...
    comparables_used = Column(JSON, nullable=True)  # fourni par l'appelant
```

**Fichier :** `backend/app/api/collection.py`
```python
valuation = CollectionValuation(
    ...
    comparables_used=body.get("comparables_used"),  # entrée, pas sortie
)
```

---

## 3. Moteurs EXISTANTS — Ce qu'ils font (et ne font pas)

### 3.1 scoring.py — Score de deal

**Fichier :** `backend/app/engines/scoring.py`

Ce moteur identifie des **opportunités d'achat** en comparant un lot à venir à des statistiques historiques :

```python
def compute_deal_score(lot: dict, artist_stats: dict, oracle_signal: str) -> dict:
    # Composantes :
    below_estimate_score   # lot sous estimation maison de vente
    below_market_avg_score # lot sous prix moyen historique
    liquidity_score        # liquidité artiste
    house_reputation_score # réputation maison de vente
    data_confidence_score  # confiance dans les données
```

**Il utilise `artist_stats` (pré-agrégés) mais ne cherche pas de lots comparables individuels.**  
**Il ne valorise pas une œuvre déjà possédée.**

### 3.2 feature_engineering.py — Features ML

**Fichier :** `backend/app/engines/feature_engineering.py`

Construit des vecteurs de features pour l'entraînement d'un modèle ML.  
Utilise `hammer_prices` avec garde anti-leakage temporel.  
**N'est pas un moteur de comparable — c'est un préprocesseur d'entraînement.**

### 3.3 projections.py — Projections futures

**Fichier :** `backend/app/engines/projections.py`

Prend une valeur en entrée et projette vers le futur via CAGR.  
**Aucune logique de comparable.**

### 3.4 oracle_service.py — Signaux artiste

**Fichier :** `backend/app/services/oracle_service.py`

Calcule des signaux de timing (BUY_NOW / WATCH / HOLD / AVOID).  
Basé sur volume et tendances de prix agrégés.  
**Aucune logique de comparable individuel.**

---

## 4. Données disponibles pour implémenter un moteur

### 4.1 Table `hammer_prices`

**Fichier :** `backend/app/models/db_models.py`

Champs utilisables pour filtrer des comparables :
```
artist_id        → même artiste
medium           → même médium (peinture, dessin, etc.)
dimensions_cm    → taille similaire
sale_date        → période récente (24 derniers mois)
hammer_price_eur → prix de vente effectif
condition_notes  → état comparable
```

### 4.2 Table `hammer_artist_medium_stats`

Agrégats pré-calculés par artiste × médium :
```
artist_id
medium
median_price_eur
avg_price_eur
lot_count
sale_period     → fenêtre temporelle
```

**Ces tables existent. Un moteur qui les interroge pour trouver des comparables N'EXISTE PAS.**

---

## 5. Ce qu'il faudrait implémenter

### Algorithme minimal de comparable

```python
# PSEUDO-CODE — à implémenter
async def get_comparables(
    artist_id: int,
    medium: str,
    dimensions_cm2: float,
    years_back: int = 2,
    max_results: int = 5,
    size_tolerance: float = 0.3,   # ±30%
) -> list[ComparableLot]:
    
    # 1. Filtrer par artiste + médium normalisé
    # 2. Filtrer par surface ±30%
    # 3. Filtrer par date (< years_back ans)
    # 4. Trier par pertinence (date DESC, proximité taille)
    # 5. Retourner les max_results meilleurs
    
    return comparable_lots
```

### Calcul de valeur estimée

```python
# PSEUDO-CODE — à implémenter
async def estimate_artwork_value(item: PortfolioItem) -> EstimationResult:
    comparables = await get_comparables(
        artist_id=item.artist_id,
        medium=item.medium,
        dimensions_cm2=parse_dimensions(item.dimensions),
    )
    if len(comparables) < 3:
        # Fallback : stats agrégées par médium
        stats = await get_artist_medium_stats(item.artist_id, item.medium)
        return EstimationResult(
            value_eur=stats.median_price_eur,
            confidence="low",
            method="aggregate_stats",
            comparable_count=stats.lot_count,
        )
    
    median_price = median([c.hammer_price_eur for c in comparables])
    return EstimationResult(
        value_eur=median_price,
        confidence="medium" if len(comparables) >= 5 else "low",
        method="comparable_lots",
        comparable_count=len(comparables),
        comparables_used=[c.lot_id for c in comparables],
    )
```

---

## 6. Problèmes bloquants à résoudre avant l'implémentation

| Problème | Description | Complexité |
|---|---|---|
| Parsing dimensions | `"80 x 60 cm"` → `4800 cm²` — formats variables | Moyenne |
| Normalisation médium | `"huile sur toile"` vs `"oil on canvas"` vs `"HST"` | Moyenne |
| Seuil de confiance | Combien de comparables minimum ? | Décision produit |
| Données insuffisantes | Artistes peu actifs = 0 comparable | Fallback à définir |
| Leakage temporel | Ne pas utiliser de ventes futures par rapport à la date d'achat | Déjà géré dans `feature_engineering.py` |

---

## 7. Verdict

| Question | Réponse |
|---|---|
| Moteur de comparable existe ? | **NON TROUVÉ** |
| Données sources disponibles ? | **OUI** (`hammer_prices`, `hammer_artist_medium_stats`) |
| Parsing dimensions implémenté ? | **NON TROUVÉ** |
| Normalisation médium implémentée ? | **NON TROUVÉ** |
| `comparables_used` est calculé ? | **NON** — c'est une entrée utilisateur |
