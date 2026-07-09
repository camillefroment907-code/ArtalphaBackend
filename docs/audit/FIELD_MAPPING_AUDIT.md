# FIELD_MAPPING_AUDIT.md
## Nautilus — Audit Session 1
**Date :** 2026-06-12  
**Règle :** Aucune modification de fichier. Toute conclusion cite fichier + numéro de ligne.

---

## 1. Objectif

Mapper chaque champ affiché sur le frontend mobile vers sa source de données backend/DB, et identifier les champs sans source fiable.

---

## 2. Tableau principal — PortfolioItem

| Champ frontend | Type | Source backend | Table DB | Fiabilité |
|---|---|---|---|---|
| `title` | string | `POST /items` body | `portfolio_items.title` | ✅ Saisie utilisateur |
| `artist_name` | string | Join `artists.name` | `portfolio_items.artist_id` → `artists` | ✅ FK lookup |
| `medium` | string | `POST /items` body | `portfolio_items.medium` | ✅ Saisie utilisateur |
| `year` | int | `POST /items` body | `portfolio_items.year` | ✅ Saisie utilisateur |
| `purchase_price_eur` | float | `POST /items` body | `portfolio_items.purchase_price_eur` | ✅ Saisie utilisateur |
| `estimated_current_value_eur` | float | `POST /items` body OU `POST /valuations` | `portfolio_items.estimated_current_value_eur` | ⚠️ Saisie manuelle — pas calculée |
| `dimensions` | string | `POST /items` body | `portfolio_items.dimensions` | ✅ Saisie utilisateur |
| `provenance` | text | `POST /items` body | `portfolio_items.provenance` | ✅ Saisie utilisateur |
| `image_url` | string | `POST /items` body | `portfolio_items.image_url` | ✅ Upload utilisateur |
| `condition` | string | `POST /items` body | `portfolio_items.condition` | ✅ Saisie utilisateur |

---

## 3. Tableau — CollectionValuation

| Champ | Source | Table DB | Fiabilité |
|---|---|---|---|
| `value_eur` | Fourni par l'appelant | `collection_valuations.value_eur` | ⚠️ Externe — pas calculé |
| `comparables_used` | Fourni par l'appelant (JSON) | `collection_valuations.comparables_used` | ⚠️ Externe — pas calculé |
| `valuation_date` | `datetime.utcnow()` | `collection_valuations.valuation_date` | ✅ Horodatage serveur |
| `methodology` | Fourni par l'appelant | `collection_valuations.methodology` | ⚠️ Texte libre |
| `appraiser` | Fourni par l'appelant | `collection_valuations.appraiser` | ⚠️ Texte libre |

**Fichier de référence :** `backend/app/models/db_models.py`

---

## 4. Tableau — ArtistScore (affiché dans app/artist/[id].tsx)

| Champ affiché | Calculé par | Source | Fiabilité |
|---|---|---|---|
| `score` (0–100) | `oracle_service.py` | Signaux timing marché | ✅ Calculé |
| `signal` (BUY/WATCH/HOLD/AVOID) | `oracle_service.py` | Volume enchères + tendance prix | ✅ Calculé |
| `avg_price_eur` | `hammer_artist_stats` | Agrégat enchères historiques | ✅ Calculé (mais peut être ancien) |
| `lot_count` | `hammer_artist_stats` | Comptage lots | ✅ Calculé |
| `price_trend_pct` | `hammer_artist_stats` | Comparaison N vs N-1 | ✅ Calculé |

**Attention :** Ces scores mesurent l'opportunité d'ACHAT, pas la valeur d'une œuvre déjà possédée.

---

## 5. Tableau — Valeur affichée dans le dashboard (index.tsx)

**Fichier :** `mobile/app/(tabs)/index.tsx`

```typescript
// Valeur totale de collection
const heroValue = items.reduce((s, i) => s + (i.estimated_current_value_eur ?? 0), 0);

// Plus-value
const totalGain = heroValue - items.reduce((s, i) => s + (i.purchase_price_eur ?? 0), 0);
const gainPct = totalPurchase > 0 ? (totalGain / totalPurchase) * 100 : 0;
```

| Valeur affichée | Formule | Fiabilité |
|---|---|---|
| Valeur totale (hero) | Somme `estimated_current_value_eur` | ⚠️ Somme de saisies manuelles |
| Plus-value (€) | hero - somme `purchase_price_eur` | ⚠️ Dépend de la valeur estimée |
| Plus-value (%) | gain / coût_total × 100 | ⚠️ Dépend de la valeur estimée |
| Nombre d'œuvres | `items.length` | ✅ Fiable |
| Nombre d'artistes | `new Set(items.map(i => i.artist_name)).size` | ✅ Fiable |

---

## 6. Tableau — Champs HammerPrice (données sources brutes)

**Fichier :** `backend/app/models/db_models.py`

| Champ | Type | Description |
|---|---|---|
| `hammer_price_eur` | float | Prix marteau converti en EUR |
| `low_estimate_eur` | float | Estimation basse de la maison de vente |
| `high_estimate_eur` | float | Estimation haute |
| `lot_number` | string | Numéro de lot |
| `sale_date` | date | Date de vente |
| `auction_house` | string | Maison de vente |
| `medium` | string | Médium de l'œuvre vendue |
| `dimensions_cm` | string | Dimensions en cm |
| `provenance` | text | Provenance |
| `condition_notes` | text | État de conservation |
| `rarity_note` | text | Note de rareté |
| `signature_info` | text | Informations signature |
| `artist_id` | FK → artists | Artiste |

**Ces données existent et sont riches. Elles ne sont pas utilisées pour valoriser la collection.**

---

## 7. Champs MANQUANTS pour un moteur de comparable

Pour apparier un item de collection à des comparables dans `hammer_prices`, il faudrait :

| Champ requis | Dans `portfolio_items` ? | Dans `hammer_prices` ? |
|---|---|---|
| `medium` | ✅ Oui (libre) | ✅ Oui (libre) |
| `dimensions` | ✅ Oui (string libre, ex. "80x60 cm") | ✅ Oui (`dimensions_cm`) |
| `year` de création | ✅ Oui | ✅ Oui |
| `artist_id` | ✅ Oui | ✅ Oui |
| Parsing dimensions → cm² | ❌ Pas de parser | ❌ Pas de parser |
| Normalisation médium | ❌ Pas de normalisation | ❌ Pas de normalisation |

**Le parser de dimensions et le normalisateur de médium sont ABSENTS.**

---

## 8. Verdict par champ critique

| Champ | Source | Calculé automatiquement ? |
|---|---|---|
| `estimated_current_value_eur` | Saisie utilisateur | **NON** |
| `comparables_used` | Saisie utilisateur | **NON** |
| `artist score` | `oracle_service.py` | OUI (mais c'est un signal d'achat) |
| `hammer_price_eur` | Scraping Artsy/Invaluable | OUI (ingestion externe) |
| `price_trend_pct` | `hammer_artist_stats` | OUI (agrégat SQL) |
