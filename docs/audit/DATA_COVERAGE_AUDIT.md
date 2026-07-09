# DATA_COVERAGE_AUDIT.md
## Nautilus — Audit Session 1
**Date :** 2026-06-12  
**Règle :** Aucune modification de fichier. Toute conclusion cite fichier + numéro de ligne.

---

## ⚠️ Note liminaire — Accès DB impossible

Les requêtes SQL directes n'ont pas pu être exécutées lors de cet audit.

**Raison :** Le mot de passe Neon présent dans les fichiers `.env` locaux (`ArtAlpha_ANCIEN/.env`) est révoqué — les deux drivers testés (`psycopg2` et `asyncpg`) retournent `password authentication failed for user 'neondb_owner'`.

**Le backend Railway fonctionne** (`https://artalpha-backend-production.up.railway.app/health` → `{"status":"ok","database":"ok"}`). Il utilise les credentials injectés par Railway, différents des credentials locaux.

**Action requise :** Exécuter les requêtes SQL de la section 5 depuis la console Neon (https://console.neon.tech) ou Railway.

---

## 1. Sources de données ingérées

| Source | Connecteur | Fichier | Statut |
|---|---|---|---|
| Artsy | `artsy_connector.py` | `backend/app/connectors/` | ACTIF |
| Invaluable | `invaluable_connector.py` | `backend/app/connectors/` | ACTIF |
| Autres | NON TROUVÉ | — | ABSENT |

**Artsy :** Enrichissement récent ajouté (dimensions, provenance, condition, rarity, signature, lot_number) — commit `cdff0d5`.

**Invaluable :** Fix `lot_performance=sold` quand `priceResult > 0` — commit `063282a`.

---

## 2. Tables de données historiques — Structure connue

### 2.1 `hammer_prices` — Lots vendus individuels

**Fichier :** `backend/app/models/db_models.py`

```sql
-- Colonnes clés
id, artist_id, lot_id, hammer_price_eur, low_estimate_eur, high_estimate_eur,
sale_date, auction_house, medium, dimensions_cm, provenance, condition_notes,
rarity_note, signature_info, lot_number, source
```

### 2.2 `hammer_artist_stats` — Agrégats par artiste

```sql
artist_id, median_price_eur, avg_price_eur, lot_count,
min_price_eur, max_price_eur, price_trend_pct, last_updated
```

### 2.3 `hammer_artist_medium_stats` — Agrégats par artiste × médium

```sql
artist_id, medium, median_price_eur, avg_price_eur, lot_count,
sale_period_start, sale_period_end, last_updated
```

### 2.4 `lots` — Lots d'enchères (à venir + récents)

```sql
id, artist_id, title, auction_house, sale_date, estimate_low_eur,
estimate_high_eur, hammer_price_eur, lot_performance (upcoming/live/sold/passed/withdrawn),
medium, dimensions_cm, provenance, condition_notes, source
```

---

## 3. Requêtes SQL à exécuter manuellement (console Neon)

### 3.1 Couverture de base

```sql
-- Nombre total d'artistes
SELECT COUNT(*) AS total_artists FROM artists;

-- Répartition par tier
SELECT tier, COUNT(*) AS count
FROM artists
GROUP BY tier
ORDER BY count DESC;

-- Nombre total de hammer_prices
SELECT COUNT(*) AS total_hammer_prices FROM hammer_prices;

-- Plage temporelle des ventes
SELECT
  MIN(sale_date) AS oldest_sale,
  MAX(sale_date) AS most_recent_sale
FROM hammer_prices;
```

### 3.2 Couverture artiste × données

```sql
-- Artistes avec au moins 1 hammer_price
SELECT COUNT(DISTINCT artist_id) AS artists_with_hammer_data
FROM hammer_prices;

-- Artistes sans aucune donnée de vente
SELECT COUNT(*) AS artists_no_data
FROM artists a
WHERE NOT EXISTS (
  SELECT 1 FROM hammer_prices hp WHERE hp.artist_id = a.id
);

-- Artistes avec hammer_prices mais sans stats agrégées
SELECT COUNT(DISTINCT hp.artist_id)
FROM hammer_prices hp
WHERE NOT EXISTS (
  SELECT 1 FROM hammer_artist_stats has WHERE has.artist_id = hp.artist_id
);
```

### 3.3 Couverture medium dans hammer_prices

```sql
-- Répartition par médium
SELECT
  medium,
  COUNT(*) AS lot_count,
  ROUND(AVG(hammer_price_eur)::numeric, 0) AS avg_price_eur
FROM hammer_prices
WHERE medium IS NOT NULL
GROUP BY medium
ORDER BY lot_count DESC
LIMIT 20;

-- Taux de remplissage des champs enrichis (post-commit cdff0d5)
SELECT
  COUNT(*) AS total,
  COUNT(dimensions_cm) AS has_dimensions,
  COUNT(provenance) AS has_provenance,
  COUNT(condition_notes) AS has_condition,
  COUNT(rarity_note) AS has_rarity,
  COUNT(signature_info) AS has_signature
FROM hammer_prices;
```

### 3.4 Couverture collection utilisateurs

```sql
-- Items de collection avec valeur estimée
SELECT
  COUNT(*) AS total_items,
  COUNT(estimated_current_value_eur) AS items_with_value,
  COUNT(purchase_price_eur) AS items_with_purchase_price
FROM portfolio_items;

-- Nombre de valuations manuelles créées
SELECT COUNT(*) AS total_valuations FROM collection_valuations;

-- Valuations avec comparables renseignés
SELECT
  COUNT(*) AS with_comparables
FROM collection_valuations
WHERE comparables_used IS NOT NULL
  AND comparables_used != 'null'::json;
```

### 3.5 Qualité du matching artiste

```sql
-- Lots sans artist_id (matching échoué lors ingestion)
SELECT COUNT(*) AS lots_without_artist
FROM hammer_prices
WHERE artist_id IS NULL;

-- Même chose pour lots
SELECT COUNT(*) AS lots_without_artist
FROM lots
WHERE artist_id IS NULL;
```

---

## 4. Données de coverage inférées (sans accès direct DB)

Ces estimations sont basées sur l'historique git et les commits récents :

| Indicateur | Source d'inférence | Estimation |
|---|---|---|
| Artistes actifs (tier != unknown) | Job `backfill_artist_real_data` — commit `809fb1d` traite des "500-artist batches" | Probablement > 1 000 artistes |
| Sources d'ingestion | Connectors Artsy + Invaluable | 2 sources |
| Enrichissement récent | Commit `cdff0d5` (Artsy) | dimensions, provenance, condition, rarity, signature maintenant collectés |
| Fix Invaluable lot_performance | Commit `063282a` | Lots Invaluable vendus maintenant correctement tagués `sold` |

---

## 5. Gaps de couverture identifiés (sans requêtes)

### Gap 1 — Champs manquants pour comparables

Le moteur de comparable aurait besoin de :
- `dimensions_cm` parsé en cm² → parsing non implémenté (voir COMPARABLE_ENGINE_AUDIT.md)
- `medium` normalisé → normalisation non implémentée (voir ARTIST_MATCHING_AUDIT.md)

### Gap 2 — Artistes sans données de vente

Les artistes "émergents" ou peu actifs sur le marché secondaire n'ont pas de `hammer_prices`. Pour ces artistes, toute valorisation serait basée sur les `CAGR_FALLBACKS` de `projections.py` — une estimation très grossière.

### Gap 3 — Fenêtre temporelle des comparables

Le commit `cdff0d5` montre que l'enrichissement Artsy est récent. Les lots plus anciens peuvent manquer de `dimensions_cm`, ce qui rendrait le filtrage par taille impossible pour ces lots.

---

## 6. Verdict

| Question | Réponse |
|---|---|
| Accès direct DB lors de l'audit | **IMPOSSIBLE** — credentials locaux révoqués |
| Requêtes SQL préparées | **OUI** — section 3, à exécuter sur console Neon |
| Sources d'ingestion actives | Artsy + Invaluable |
| Champs enrichis disponibles | dimensions, provenance, condition, rarity, signature (récent) |
| Couverture artistes émergents | **INSUFFISANTE** — à confirmer via console Neon |
| Taux de matching artiste à l'ingestion | **INCONNU** — requête SQL 3.5 à exécuter |
