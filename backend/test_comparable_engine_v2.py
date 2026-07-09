"""
Jeu de tests de validation — comparable_engine v2
===================================================
Lance ce script contre le backend Railway après déploiement.

Usage :
    API_URL=https://your-app.railway.app API_TOKEN=xxx python test_comparable_engine_v2.py

Les résultats sont affichés dans le terminal avec une synthèse par artiste.
"""

import os
import json
import sys
import urllib.request
import urllib.parse
import urllib.error

API_URL   = os.getenv("API_URL", "http://localhost:8000")
API_TOKEN = os.getenv("API_TOKEN", "")

# ── Cas de test ───────────────────────────────────────────────────────────────
# Chaque cas : (nom_artiste, médium, dimensions, year_created, commentaire)
TEST_CASES = [
    # ── Artistes avec marché large et homogène → estimation attendue ──────────
    ("Soulages",         "peinture",         "195 x 130 cm", 1985, "Peinture large format"),
    ("Soulages",         "gravure",          None,           1975, "Estampe — médium distinct"),
    ("Richter",          "huile sur toile",  "100 x 80 cm",  1990, "Peinture figurative tardive"),
    ("Richter",          "aquarelle",        "40 x 30 cm",   1995, "Médium secondaire — peut → indisponible"),
    ("Picasso",          "huile sur toile",  "65 x 54 cm",   1938, "Peinture période cubiste"),
    ("Picasso",          "gravure",          "50 x 65 cm",   1955, "Lithographie / estampe"),
    ("Hockney",          "acrylique",        "120 x 90 cm",  2005, "Peinture contemporaine"),
    ("Zao Wou-Ki",       "huile sur toile",  "100 x 73 cm",  1975, "Peinture abstraite"),
    ("Hartung",          "peinture",         "162 x 97 cm",  1970, "Grand format abstrait"),
    ("Buffet",           "huile sur toile",  "65 x 81 cm",   1960, "Peinture figurative"),

    # ── Artistes de niche → dispersion ou indisponible possible ──────────────
    ("Vallotton",        "huile sur toile",  "73 x 60 cm",   1910, "Peinture — doit être séparée des gravures"),
    ("Vallotton",        "gravure",          "18 x 22 cm",   1895, "Gravure sur bois — médium distinct"),
    ("Giovanni Giacometti", "huile sur toile", "55 x 46 cm", 1915, "Peintre suisse — niche"),
    ("Augusto Giacometti",  "pastel",          "40 x 30 cm", 1920, "Artiste suisse rare → probablement indisponible"),

    # ── Cas limite — dimensions très atypiques ────────────────────────────────
    ("Soulages",         "peinture",         "15 x 12 cm",   1985, "Format miniature — peu de comparables similaires"),
    ("Picasso",          "céramique",        None,           1950, "Médium atypique pour Picasso"),
]

# ─────────────────────────────────────────────────────────────────────────────

def _headers():
    h = {"Content-Type": "application/json"}
    if API_TOKEN:
        h["Authorization"] = f"Bearer {API_TOKEN}"
    return h


def _get(path):
    url = f"{API_URL}{path}"
    req = urllib.request.Request(url, headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode()}
    except Exception as e:
        return {"error": str(e)}


def _post(path, body):
    url = f"{API_URL}{path}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode()}
    except Exception as e:
        return {"error": str(e)}


def search_artist(name):
    q = urllib.parse.quote(name)
    res = _get(f"/api/artist-profiles/autocomplete?q={q}&limit=5")
    suggestions = res.get("suggestions", []) if isinstance(res, dict) else []
    # Prend la première suggestion avec un id
    for s in suggestions:
        if s.get("id"):
            return s["id"], s["name"]
    return None, None


def valuate(artist_id, medium, dimensions, year_created):
    body = {
        "artist_id": artist_id,
        "medium": medium,
        "dimensions": dimensions,
        "year_created": year_created,
    }
    return _post("/api/collection/valuate", body)


# ── Formatage de la sortie ────────────────────────────────────────────────────

def fmt_eur(v):
    if v is None:
        return "—"
    return f"€{v:,.0f}".replace(",", " ")


def fmt_score(s):
    if s is None:
        return "—"
    return f"{s:.1f}"


def print_result(case_num, artist_name, medium, dimensions, year_created, comment, result):
    conf = result.get("confidence", "?")
    method = result.get("method", "?")

    CONF_COLOR = {
        "high":   "\033[92m",   # vert
        "medium": "\033[93m",   # jaune
        "low":    "\033[33m",   # orange
        "none":   "\033[91m",   # rouge
        "error":  "\033[91m",
    }
    RESET = "\033[0m"
    color = CONF_COLOR.get(conf, "")

    print(f"\n{'─'*70}")
    print(f"[{case_num:02d}] {artist_name} — {medium or '(médium inconnu)'}")
    print(f"     Dims: {dimensions or '—'}   Année: {year_created or '—'}")
    print(f"     → {comment}")
    print()

    if result.get("error"):
        print(f"  ❌ ERREUR : {result}")
        return

    low    = fmt_eur(result.get("valuation_low"))
    median = fmt_eur(result.get("valuation_median"))
    high   = fmt_eur(result.get("valuation_high"))
    n      = result.get("comparables_count", 0)
    avg_s  = fmt_score(result.get("avg_score"))
    std_s  = fmt_score(result.get("score_std_dev"))
    lo_s   = fmt_score(result.get("lowest_score"))
    hi_s   = fmt_score(result.get("highest_score"))
    qual   = result.get("comparables_quality") or "—"
    expl   = result.get("explanation") or "—"
    warn   = result.get("warning")

    if conf == "none" or result.get("valuation_median") is None:
        print(f"  {color}⚠  ESTIMATION INDISPONIBLE{RESET}")
        print(f"     Raison : {warn}")
        print(f"     Méthode : {method}   n={n}")
        return

    print(f"  {color}▶ {low} – {median} – {high}   [{conf.upper()}]{RESET}")
    print(f"     Méthode  : {method}")
    print(f"     Qualité  : {qual}   n={n} comparables")
    print(f"     Scores   : avg={avg_s}  σ={std_s}  min={lo_s}  max={hi_s}")
    print(f"     Expl.    : {expl}")
    if warn:
        print(f"     ⚠ {warn}")

    # Top 5 comparables
    comps = result.get("comparables", [])[:5]
    if comps:
        print(f"     Comparables (top {len(comps)}) :")
        for c in comps:
            score_str = f"score={c.get('score', '—'):.1f}" if c.get("score") is not None else ""
            print(f"       · {fmt_eur(c.get('hammer_price_eur'))}  "
                  f"{c.get('sale_date','?')[:7]}  "
                  f"{c.get('auction_house','?'):<20}  "
                  f"{c.get('medium','?'):<25}  {score_str}")

    year_r = result.get("year_range")
    sale_r = result.get("sale_date_range")
    dim_r  = result.get("dimension_range_cm2")
    if year_r:
        print(f"     Période  : {year_r[0]}–{year_r[1]}")
    if sale_r:
        print(f"     Ventes   : {sale_r[0]} → {sale_r[1]}")
    if dim_r:
        print(f"     Formats  : {dim_r[0]:,}–{dim_r[1]:,} cm²")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"\n{'═'*70}")
    print(f"  VALIDATION comparable_engine v2")
    print(f"  API : {API_URL}")
    print(f"{'═'*70}")

    artist_cache = {}
    results_summary = []

    for i, (name, medium, dims, year, comment) in enumerate(TEST_CASES, 1):
        # Résolution artiste (avec cache)
        if name not in artist_cache:
            artist_id, resolved_name = search_artist(name)
            artist_cache[name] = (artist_id, resolved_name)
            if not artist_id:
                print(f"\n[{i:02d}] {name} — ⚠ artiste non trouvé en DB")
                results_summary.append((name, medium, "NOT_FOUND", None))
                continue
        else:
            artist_id, resolved_name = artist_cache[name]
            if not artist_id:
                continue

        result = valuate(artist_id, medium, dims, year)
        print_result(i, resolved_name or name, medium, dims, year, comment, result)

        conf = result.get("confidence", "error")
        median = result.get("valuation_median")
        results_summary.append((name, medium, conf, median))

    # ── Synthèse ──────────────────────────────────────────────────────────────
    print(f"\n\n{'═'*70}")
    print("  SYNTHÈSE")
    print(f"{'═'*70}")
    for name, medium, conf, median in results_summary:
        tag = {
            "high":     "✅ HIGH",
            "medium":   "✅ MED ",
            "low":      "⚠  LOW ",
            "none":     "🚫 INDISPONIBLE",
            "error":    "❌ ERREUR",
            "NOT_FOUND":"🔍 ARTISTE INTROUVABLE",
        }.get(conf, f"? {conf}")
        val = f"  médiane={fmt_eur(median)}" if median else ""
        print(f"  {tag}   {name:<25} {medium:<25}{val}")

    print()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        API_URL = sys.argv[1]
    if len(sys.argv) > 2:
        API_TOKEN = sys.argv[2]
    main()
