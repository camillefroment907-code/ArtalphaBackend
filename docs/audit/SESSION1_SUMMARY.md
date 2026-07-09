# SESSION1_SUMMARY.md
## Nautilus — Audit Session 1 — Résumé Exécutif
**Date :** 2026-06-12  
**Règle :** Aucune modification de fichier. Toute conclusion cite fichier + numéro de ligne.

---

## 1. Verdict central

**La valorisation de collection Nautilus est entièrement manuelle.**

Il n'existe pas de pipeline automatique qui calcule `estimated_current_value_eur`. La valeur affichée dans l'app (dashboard hero, profil) est la somme des valeurs saisies par les utilisateurs eux-mêmes. Le backend ne déclenche aucun calcul au moment de la création d'un item.

---

## 2. Findings par document

### ESTIMATION_ARCHITECTURE.md
- **Finding principal :** Aucun moteur de valorisation automatique. `POST /collection/items` stocke la valeur fournie par le client sans calcul.
- **Source :** `backend/app/api/collection.py` — endpoint création item.
- **Ce qui existe :** Scoring de deal sur lots d'enchères (`scoring.py`), projections CAGR futures (`projections.py`), signaux Oracle (`oracle_service.py`) — aucun n'est un moteur de valorisation de collection.

### ESTIMATION_PIPELINE.md
- **Finding principal :** Pipeline réel = saisie utilisateur → POST → DB → GET → somme frontend. Pas de step de calcul serveur.
- **Source :** `mobile/app/(tabs)/index.tsx` (somme côté frontend), `backend/app/api/collection.py` (pas de calcul côté backend).
- **Gap :** Étapes 1–6 du pipeline idéal (recherche comparables → médiane → ajustement → stockage → revalorisation) sont toutes absentes.

### FIELD_MAPPING_AUDIT.md
- **Finding principal :** `estimated_current_value_eur` et `comparables_used` sont des inputs, pas des outputs.
- **Ce qui est fiable :** `artist score`, `price_trend_pct`, `hammer_price_eur` (données d'enchères calculées/ingérées).
- **Champ critique manquant :** Parser de dimensions (string `"80x60 cm"` → cm²) et normalisateur de médium.

### DATA_COVERAGE_AUDIT.md
- **Finding principal :** Accès direct DB impossible (credentials Neon révoqués localement). Requêtes SQL préparées pour exécution manuelle.
- **Ce qui est connu :** Artsy + Invaluable actifs, enrichissement récent (dimensions, provenance, condition, rarity, signature) via commit `cdff0d5`.
- **Action requise :** Exécuter les 5 blocs SQL de la section 3 depuis la console Neon.

### COMPARABLE_ENGINE_AUDIT.md
- **Finding principal :** **NON TROUVÉ.** Aucune fonction `get_comparables()`, `find_comparables()` ou similaire dans tout le backend.
- **`comparables_used`** dans `CollectionValuation` est un champ de stockage d'une liste fournie par l'appelant — pas une sortie d'un moteur.
- **Données disponibles :** `hammer_prices`, `hammer_artist_medium_stats` — les sources existent, le moteur qui les exploite n'existe pas.

### ARTIST_MATCHING_AUDIT.md
- **Finding principal :** Matching artiste = `name.lower().strip()` uniquement. Comparaison stricte insensible à la casse.
- **Fuzzy matching :** **NON TROUVÉ.** `rapidfuzz`, `difflib`, `Levenshtein` — aucun de ces packages n'est utilisé.
- **Risque :** Fragmentation des stats artiste si le même artiste est ingéré sous des noms différents (`"J. Miró"` vs `"Joan Miró"`).

---

## 3. Tableau de criticité

| Finding | Criticité | Impact produit |
|---|---|---|
| Pas de calcul automatique de valeur | 🔴 Critique | La valeur affichée n'est pas fiable — dépend entièrement de l'utilisateur |
| Pas de moteur de comparable | 🔴 Critique | Impossible de valoriser sans effort manuel de l'utilisateur |
| Matching artiste strict (pas de fuzzy) | 🟠 Élevé | Pertes à l'ingestion, fragmentation stats, artistes non trouvés |
| Parser dimensions absent | 🟠 Élevé | Bloque l'implémentation du comparable par taille |
| Normalisateur médium absent | 🟠 Élevé | Bloque le filtrage de comparables par médium |
| Credentials Neon locaux révoqués | 🟡 Moyen | Bloque les audits locaux, pas d'impact prod (Railway ok) |
| `projections.py` ne calcule pas la valeur courante | 🟡 Moyen | Confusion possible — la projection part d'une valeur non vérifiée |

---

## 4. Ce qui fonctionne bien

| Composant | Status |
|---|---|
| Ingestion Artsy + Invaluable | ✅ Actif, enrichi récemment |
| Scoring opportunités d'achat (`scoring.py`) | ✅ Complet, multi-composantes |
| Signaux Oracle artiste | ✅ Opérationnel |
| Projections CAGR futures | ✅ Opérationnel (mais dépend d'une valeur courante fiable) |
| `hammer_artist_stats` + `hammer_artist_medium_stats` | ✅ Pré-agrégés, prêts à consommer |
| Backend Railway | ✅ Opérationnel (`/health` → ok) |
| Frontend mobile Nautilus | ✅ Redesign complet livré et buildé |

---

## 5. Feuille de route recommandée (Session 2)

### Priorité 1 — Moteur de comparable (bloque tout le reste)

1. Parser dimensions string → cm² (`"80 x 60 cm"` → `4800`)
2. Normalisateur médium (table de mapping FR/EN/abréviation)
3. `get_comparables(artist_id, medium, cm2, years_back=2)` → query `hammer_prices`
4. `estimate_artwork_value(item)` → médiane comparables ou fallback stats agrégées

### Priorité 2 — Trigger automatique à la création

5. `POST /collection/items` → si `estimated_current_value_eur` non fourni → appeler moteur

### Priorité 3 — Job de revalorisation

6. Job nightly : revaloriser les items dont le dernier comparable date > 90 jours

### Priorité 4 — Fuzzy matching artiste

7. `rapidfuzz` dans les connecteurs (ratio > 85 pour l'ingestion)
8. Champ `aliases` JSON sur `Artist` pour les variantes connues

### Priorité 5 — Audit DB

9. Exécuter les 5 blocs SQL de `DATA_COVERAGE_AUDIT.md` section 3
10. Corriger les artistes fragmentés si le matching a créé des doublons

---

## 6. Fichiers à créer / modifier en Session 2

| Action | Fichier |
|---|---|
| CRÉER | `backend/app/utils/dimensions_parser.py` |
| CRÉER | `backend/app/utils/medium_normalizer.py` |
| CRÉER | `backend/app/engines/comparable_engine.py` |
| CRÉER | `backend/app/engines/valuation_engine.py` |
| MODIFIER | `backend/app/api/collection.py` — trigger au POST |
| CRÉER | `backend/app/jobs/revalue_collection.py` |
| MODIFIER | `backend/app/connectors/` — fuzzy matching artiste |

---

## 7. Métriques de succès (à mesurer après Session 2)

| Métrique | Cible |
|---|---|
| % items avec `estimated_current_value_eur` calculé automatiquement | > 80% |
| Nombre moyen de comparables par item | ≥ 3 |
| % lots ingérés avec `artist_id` résolu | > 95% |
| Latence endpoint valuation | < 500ms p95 |

---

*Fin de l'Audit Session 1. Aucun fichier modifié. Toutes les conclusions sont basées sur la lecture du code source uniquement.*
