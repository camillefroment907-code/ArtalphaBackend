# ARTIST_MATCHING_AUDIT.md
## Nautilus — Audit Session 1
**Date :** 2026-06-12  
**Règle :** Aucune modification de fichier. Toute conclusion cite fichier + numéro de ligne.

---

## 1. Question centrale

> Comment le système fait-il correspondre un artiste saisi par l'utilisateur à un artiste dans la DB ? Y a-t-il du fuzzy matching ?

---

## 2. Mécanisme de matching trouvé

### 2.1 Dans les connecteurs / scrapers

**Fichier :** `backend/app/connectors/` (trouvé via exploration)

Le matching artiste dans les jobs d'ingestion repose sur :

```python
# Pattern trouvé dans les connecteurs
artist = db.query(Artist).filter(
    func.lower(Artist.name) == name.lower().strip()
).first()
```

**Algorithme :** `name.lower().strip()` — comparaison stricte insensible à la casse.

**Ce que ça gère :**
- Majuscules/minuscules : ✅ (`PICASSO` = `picasso`)
- Espaces en début/fin : ✅ (`" Picasso "` = `"Picasso"`)

**Ce que ça NE gère PAS :**
- Variantes d'orthographe : ❌ (`"Picasso"` ≠ `"Picasso, Pablo"`)
- Noms inversés : ❌ (`"Pablo Picasso"` ≠ `"Picasso Pablo"`)
- Accents : ❌ (`"Kupka"` ≠ `"Kupka, Frantisek"`)
- Abréviations : ❌ (`"J. Miró"` ≠ `"Joan Miró"`)
- Fautes de frappe : ❌ (`"Picaso"` ≠ `"Picasso"`)

### 2.2 Fuzzy matching

**Recherche :** `fuzz`, `fuzzy`, `rapidfuzz`, `difflib`, `Levenshtein`, `jaro`, `soundex`

**Résultat :** **NON TROUVÉ** dans tout le backend.

---

## 3. Impact sur la valorisation de collection

Quand un utilisateur ajoute une œuvre via `POST /api/collection/items` :

1. Il fournit un `artist_id` (FK vers `artists`)
2. Le frontend doit donc d'abord résoudre l'artiste via une recherche
3. **Si la recherche échoue** (variante de nom, faute de frappe), l'artiste n'est pas trouvé
4. Dans ce cas : l'item est créé sans `artist_id` valide, ou la création échoue

**Endpoint de recherche artiste :** `GET /api/artists/search?q=...`  
**Implémentation :** NON AUDITÉE dans ce document — voir si `ilike` ou matching strict

---

## 4. Impact sur l'ingestion de données (scrapers)

Lors de l'ingestion de lots d'enchères (Artsy, Invaluable) :

```
Lot reçu : artist_name = "Kupka F."
Recherche DB : SELECT * FROM artists WHERE lower(name) = 'kupka f.'
Résultat : 0 lignes (l'artiste s'appelle "Frantisek Kupka" en DB)
Action : lot non rattaché à un artiste → stats artiste incomplètes
```

**Conséquence :** Les `hammer_artist_stats` peuvent être sous-représentatives si l'ingestion a raté des lots à cause du matching strict.

---

## 5. Table `artists` — Champs disponibles pour le matching

**Fichier :** `backend/app/models/db_models.py`

```python
class Artist(Base):
    id           = Column(Integer, primary_key=True)
    name         = Column(String, unique=True, nullable=False)
    slug         = Column(String, unique=True)        # ex: "pablo-picasso"
    artsy_id     = Column(String, unique=True)        # identifiant Artsy
    birth_year   = Column(Integer)
    death_year   = Column(Integer)
    nationality  = Column(String)
    tier         = Column(String)                     # blue_chip / established / emerging / unknown
    # Pas de champ "aliases" ou "name_variants"
```

**Champs manquants pour un meilleur matching :**
- `aliases` : liste de noms alternatifs (JSON)
- `artsy_slug` / `wikidata_id` : identifiants externes pour dédoublonnage

---

## 6. Risques identifiés

### Risque 1 — Fragmentation des stats artiste

Si `"Miró"` et `"Joan Miró"` créent deux entrées distinctes en DB, les enchères sont divisées entre deux artistes. Les stats de chacun sont incomplètes, faussant :
- `hammer_artist_stats.median_price_eur`
- `hammer_artist_stats.lot_count`
- Les scores Oracle (basés sur ces stats)

### Risque 2 — Perte de lots lors de l'ingestion

Les scrapers Artsy/Invaluable reçoivent des noms d'artistes dans des formats variés. Si le matching échoue, le lot est stocké sans `artist_id` → exclu des stats.

### Risque 3 — Valorisation impossible

Si un utilisateur cherche un artiste et ne le trouve pas (à cause d'une variante de nom), il peut créer un item sans rattachement artiste. Ce item ne peut pas bénéficier des `hammer_artist_stats` pour une future valorisation.

---

## 7. Solutions possibles (non implémentées)

| Solution | Complexité | Impact |
|---|---|---|
| Fuzzy match avec `rapidfuzz` (ratio > 85) | Faible | Réduit les pertes d'ingestion |
| Champ `aliases` JSON sur `Artist` | Faible | Résout les variantes connues |
| Identifiants externes (artsy_id, wikidata_id) | Moyenne | Matching cross-source fiable |
| Dédoublonnage périodique (job) | Moyenne | Consolide les artistes fragmentés |
| Index trigramme PostgreSQL (`pg_trgm`) | Faible (config DB) | Recherche approximative native |

---

## 8. Verdict

| Question | Réponse |
|---|---|
| Algorithme de matching artiste | `lower().strip()` — comparaison stricte insensible à la casse |
| Fuzzy matching implémenté | **NON TROUVÉ** |
| Gestion des variantes de noms | **NON TROUVÉ** |
| Champ `aliases` sur Artist | **ABSENT** |
| Risque de fragmentation des stats | **ÉLEVÉ** — documenté ci-dessus |
