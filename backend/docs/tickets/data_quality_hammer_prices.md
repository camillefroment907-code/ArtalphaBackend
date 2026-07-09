# Data Quality — hammer_prices : corruption artist_name_normalized

**Priorité :** faible (non bloquant cette semaine)  
**Composants :** `app/connectors/auctionet_connector.py`, `app/engines/artist_enrichment.py`, `hammer_prices` table

---

## Contexte

Deux bugs d'extraction introduisent des valeurs corrompues dans `hammer_prices.artist_name_normalized` : le titre de l'œuvre se retrouve concaténé au nom de l'artiste.

Exemple observé : `"felix vallotton andromede"` au lieu de `"felix vallotton"`.

Impact mesuré lors de la validation v2 (juin 2026) :
- Picasso : ~99,4 % des lots propres
- Vallotton (pire cas testé) : ~75 % des lots propres

Non bloquant — le moteur comparable v2 continue de fonctionner sur les lots propres. Mais la couverture de certains artistes niche est dégradée.

---

## Bug 1 — `auctionet_connector.py` : `_ARTIST_RE` trop greedy

**Fichier :** `app/connectors/auctionet_connector.py`, ligne ~46

```python
_ARTIST_RE = re.compile(
    r"^([A-ZÅÄÖÉÈÀÜÏËÆØÑ][A-ZÅÄÖa-zåäöéèàüïëæøñ\-\'\.]+(?:\s+[A-ZÅÄÖÉÈÀÜÏËÆØÑ][A-ZÅÄÖa-zåäöéèàüïëæøñ\-\'\.]+){1,4})"
    r"\s*[\.\(]"
)
```

Le quantificateur `{1,4}` autorise jusqu'à 5 tokens avant le `.` ou `(`. Pour les titres Auctionet malformés où le point suit le titre d'œuvre plutôt que le nom d'artiste :

```
Format attendu  : "FÉLIX VALLOTTON. Andromède, huile sur toile"
Format malformé : "FÉLIX VALLOTTON Andromède. huile sur toile"
```

Dans le cas malformé, la regex capture `"FÉLIX VALLOTTON Andromède"` comme nom d'artiste. Après `normalize_artist_name` : `"felix vallotton andromede"`.

**Correction proposée :** réduire `{1,4}` à `{1,2}` (noms en 3 tokens max couvrent 99 %+ des cas réels).

---

## Bug 2 — `artist_enrichment.py` : `_detect_artist_from_title` pattern 1 trop large

**Fichier :** `app/engines/artist_enrichment.py`, ligne ~198

```python
patterns = [
    r"^([A-ZÀ-Ÿ][a-zà-ÿ]+(?: [A-ZÀ-Ÿ][a-zà-ÿ]+){1,3})\s*[—\-,]",  # ← {1,3}
    ...
]
```

Ce pattern est déclenché quand `artist_name_raw` est `None` (ex : LiveAuctioneers ne fournit pas de champ artiste séparé) et que le titre est parsé à la volée.

Pour `"Félix Vallotton Andromède, huile sur toile"` : "Andromède" commence par une majuscule et précède la `,` → le pattern capture `"Félix Vallotton Andromède"` comme artiste.

**Correction proposée :** réduire `{1,3}` à `{1,2}` (3 tokens max) ou ajouter une validation post-extraction par cross-check avec la table `artists`.

---

## Travail requis

- [ ] Corriger `_ARTIST_RE` dans `auctionet_connector.py` (`{1,4}` → `{1,2}`)
- [ ] Corriger pattern 1 dans `_detect_artist_from_title` dans `artist_enrichment.py` (`{1,3}` → `{1,2}`)
- [ ] Tests unitaires `_extract_artist()` :
  - format normal `"FÉLIX VALLOTTON. Andromède, huile"` → `"FÉLIX VALLOTTON"` ✓
  - malformé `"FÉLIX VALLOTTON Andromède. huile"` → `"FÉLIX VALLOTTON"` ✓ (après fix)
  - nom 2 tokens `"PIERRE SOULAGES. Peinture"` → `"PIERRE SOULAGES"` ✓
  - faux positif `"OLJA PÅ DUK. Signerat"` → `None` ✓
- [ ] Tests unitaires `_detect_artist_from_title()` :
  - séparateur `—` : `"Félix Vallotton — Andromède"` → `"Félix Vallotton"` ✓
  - séparateur `,` après 2 tokens : `"Félix Vallotton, huile sur toile"` → `"Félix Vallotton"` ✓
  - séparateur `,` après 3 tokens (titre) : `"Félix Vallotton Andromède, huile"` → `"Félix Vallotton"` ✓ (après fix)
- [ ] Stratégie de nettoyage DB (voir ci-dessous)

---

## Stratégie de nettoyage DB (à planifier)

**Important :** `phase1_hammer_normalize.py` re-normalise depuis la colonne `artist_name` qui contient déjà la valeur corrompue. Re-lancer ce script ne corrige rien.

**Étape 1 — Identifier les rows corrompus**
```sql
SELECT artist_name_normalized, COUNT(*) AS n
FROM hammer_prices
WHERE array_length(string_to_array(artist_name_normalized, ' '), 1) >= 3
  AND artist_name_normalized NOT LIKE '%van %'
  AND artist_name_normalized NOT LIKE '% de %'
  AND artist_name_normalized NOT LIKE '%el %'
GROUP BY artist_name_normalized
HAVING COUNT(*) < 10
ORDER BY n;
```
Les entrées à 3+ tokens avec peu de lots sont des candidates à la corruption.

**Étape 2 — Pour chaque corruption confirmée**
```sql
-- Exemple : corriger "felix vallotton andromede" → "felix vallotton"
UPDATE hammer_prices
SET artist_name_normalized = 'felix vallotton'
WHERE artist_name_normalized = 'felix vallotton andromede';
```

**Données Artsy historical (source='artsy') :** propres — ne pas toucher.  
**Données Auctionet et lots sans `artist_name_raw` :** candidates à vérifier en priorité.

---

## Notes

- La normalisation `normalize_artist_name()` est saine — le problème est en amont, dans l'extraction.
- Les données corrigées par ce ticket amélioreront la couverture des artistes niche (Vallotton, Giacometti suisse, artistes scandinaves).
- Lier à la tâche de re-scraping Auctionet si planifiée.

---

## Bug 3 — `normalize_medium_category()` : medium_category = 'other' pour tous les lots Vallotton

**Fichier :** `app/jobs/quality_filter.py`, ligne ~286  
**Confirmé par SQL :** 155 lots propres (`artist_name_normalized = 'felix vallotton'`), tous avec `medium_category = 'other'`.

### Cause racine (trois facteurs cumulés)

**A. `medium IS NULL` — probable cause principale**

L'`artsy_historical_scraper` stocke `node.get("mediumText")`. Artsy ne garantit pas ce champ pour les lots anciens (Vallotton, décédé 1925 — ventes souvent issues de catalogues papier numérisés). Si `mediumText` est absent de la réponse GraphQL → `medium = NULL` en base.

```python
def normalize_medium_category(medium: str | None) -> str:
    if not medium:      # ← NULL ou "" → retour immédiat
        return "other"
    ...
```

Vérification : `SELECT COUNT(*) FROM hammer_prices WHERE artist_name_normalized = 'felix vallotton' AND medium IS NULL;`

**B. Termes allemands absents du dictionnaire**

Vallotton est suisse. Ses ventes majeures passent par Kornfeld (Berne), Koller (Zurich), Lempertz (Cologne) — maisons qui cataloguent en allemand. Artsy reprend ces termes tels quels :

| Valeur brute | Devrait mapper | Résultat actuel |
|---|---|---|
| `"Holzschnitt"` | `print` | **`other`** — "woodcut" absent dans "holzschnitt" |
| `"Farbholzschnitt"` | `print` | **`other`** |
| `"Öl auf Leinwand"` | `painting` | **`other`** — "oil" ≠ "öl", "canvas" ≠ "leinwand" |
| `"Öl auf Holz"` | `painting` | **`other`** |
| `"Radierung"` | `print` | **`other`** — "etching" absent dans "radierung" |
| `"Aquatinta"` | `print` | **`other`** — "aquatint" absent dans "aquatinta" |
| `"Bleistift"` | `drawing` | **`other`** — "pencil" absent dans "bleistift" |
| `"Tusche"` | `drawing` | **`other`** — "ink" absent dans "tusche" |

La fonction fait une recherche par sous-chaîne exacte (`kw in m`). Aucun terme anglais ou français du dictionnaire ne matche les équivalents allemands.

**C. Termes français rares non couverts**

| Valeur brute | Devrait mapper | Résultat actuel |
|---|---|---|
| `"Eau-forte"` | `print` | **`other`** — "etching" absent dans "eau-forte" |
| `"Bois gravé"` / `"Bois original"` | `print` | **`other`** — "woodcut" absent, "bois" absent |
| `"Xylographie"` | `print` | **`other`** — absent du dictionnaire |

### Impact

Tout artiste dont les ventes proviennent majoritairement de maisons suisses, allemandes ou autrichiennes est potentiellement affecté : Hodler, Giacometti (Alberto), Ernst, Klee, Nolde, etc.

### Correction à planifier

Ajouter les termes allemands à `_MEDIUM_KEYWORDS` dans `quality_filter.py` :

```python
("print", [
    ...,                          # termes existants
    "holzschnitt", "farbholzschnitt", "radierung", "aquatinta",
    "lithografie",                # allemand
    "eau-forte", "bois gravé", "xylographie",  # français rares
]),
("painting", [
    ...,                          # termes existants
    "öl", "leinwand",             # allemand
    "gouache sur",                # déjà couvert via "gouache"
]),
("drawing", [
    ...,                          # termes existants
    "bleistift", "tusche", "kohle",  # allemand
]),
```

Puis relancer `backfill_medium_category.py` sur les rows avec `medium_category = 'other'` qui ont un `medium` non NULL.

**Priorité :** à traiter dans le même sprint que les bugs 1 et 2.
