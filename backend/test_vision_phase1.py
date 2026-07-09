"""
Vision Engine Phase 1 — Test utilisateur réel
Test les 5 artistes avec de vraies images d'œuvres.
"""
import asyncio
import time
import json
import sys
import os
import urllib.request

# Ajoute le backend au path
sys.path.insert(0, os.path.dirname(__file__))

from app.engines.vision_engine import analyze_artwork_image

API_KEY = "os.environ.get("ANTHROPIC_API_KEY")"

TESTS = [
    {
        "artist":    "Pierre Soulages",
        "expected":  {"artist": "Pierre Soulages", "medium": "Peinture/Huile", "category": "Painting", "year": "2002"},
        "local":     "/tmp/vision_test/soulages_outrenoir.jpg",
        "title_ref": "Peinture 200×220 cm, 22 avril 2002 (Outrenoir) — Centre Pompidou",
    },
    {
        "artist":    "Pablo Picasso",
        "expected":  {"artist": "Pablo Picasso", "medium": "Huile sur toile", "category": "Painting", "year": "1937"},
        "local":     "/tmp/vision_test/picasso_guernica.jpg",
        "title_ref": "Guernica (1937) — Museo Reina Sofia",
    },
    {
        "artist":    "Jean-Michel Basquiat",
        "expected":  {"artist": "Jean-Michel Basquiat", "medium": "Peinture", "category": "Painting", "year": "1982"},
        "local":     "/tmp/vision_test/basquiat_skull.jpg",
        "title_ref": "Untitled (1982) — crâne / skull",
    },
    {
        "artist":    "César",
        "expected":  {"artist": "César", "medium": "Bronze", "category": "Sculpture", "year": "1965"},
        "local":     "/tmp/vision_test/cesar_pouce.jpg",
        "title_ref": "Le Pouce (1965) — Bronze, Fondation Gianadda Martigny",
    },
]

def download_image(local_path: str) -> bytes:
    with open(local_path, "rb") as f:
        return f.read()

def score_result(result, expected: dict) -> dict:
    scores = {}
    # Artist accuracy
    predicted_artist = (result.artist or "").lower()
    expected_artist  = expected["artist"].lower()
    artist_parts = expected_artist.split()
    scores["artist_match"] = any(p in predicted_artist for p in artist_parts)

    # Medium accuracy (loose)
    predicted_medium = (result.medium or "").lower()
    exp_medium = expected["medium"].lower()
    scores["medium_match"] = any(w in predicted_medium for w in exp_medium.split("/"))

    # Category accuracy
    scores["category_match"] = (result.artwork_category or "").lower() == expected["category"].lower()

    # Year accuracy (within 5 years or correct decade)
    try:
        exp_year = int(expected["year"])
        pred_year_str = result.year_estimate or ""
        # Extract first 4-digit number
        import re
        nums = re.findall(r'\d{4}', pred_year_str)
        if nums:
            pred_year = int(nums[0])
            scores["year_match"] = abs(pred_year - exp_year) <= 5
        else:
            scores["year_match"] = False
    except Exception:
        scores["year_match"] = False

    return scores


async def run_tests():
    print("\n" + "═"*60)
    print("  NAUTILUS VISION ENGINE — TEST PHASE 1")
    print("  Test utilisateur réel · Claude Vision (Haiku)")
    print("═"*60)

    results_summary = []
    errors = []

    for i, test in enumerate(TESTS, 1):
        print(f"\n[{i}/{len(TESTS)}] {test['artist'].upper()}")
        print(f"    Œuvre  : {test['title_ref']}")
        print(f"    Fichier: {test['local'].split('/')[-1]}")

        # Download image
        try:
            t0 = time.time()
            print(f"    ↓ Chargement : {test['local'].split('/')[-1]}", end=" ", flush=True)
            img_data = download_image(test["local"])
            dl_time = time.time() - t0
            print(f"OK ({len(img_data)//1024} KB)")
        except Exception as e:
            print(f"ERREUR: {e}")
            errors.append({"artist": test["artist"], "step": "load", "error": str(e)})
            continue

        # Detect content type
        content_type = "image/jpeg"
        if test["local"].endswith(".png"):
            content_type = "image/png"

        # Run Vision analysis
        print("    🔍 Analyse Vision AI…", end=" ", flush=True)
        t_vision = time.time()
        try:
            result = await analyze_artwork_image(
                image_data=img_data,
                content_type=content_type,
                anthropic_api_key=API_KEY,
            )
            vision_time = time.time() - t_vision
        except Exception as e:
            vision_time = time.time() - t_vision
            print(f"ERREUR ({vision_time:.1f}s): {e}")
            errors.append({"artist": test["artist"], "step": "vision", "error": str(e)})
            continue

        if result.error:
            print(f"ERREUR Vision: {result.error}")
            errors.append({"artist": test["artist"], "step": "vision", "error": result.error})
            continue

        total_time = dl_time + vision_time
        print(f"OK ({vision_time:.1f}s)")

        # Score
        scores = score_result(result, test["expected"])

        # Print result
        print(f"\n    ┌── RÉSULTAT VISION AI ──────────────────────────────")
        print(f"    │  Artiste     : {result.artist or '—'} ({result.artist_confidence}% confiance)")
        print(f"    │  Titre       : {result.title or '—'}")
        print(f"    │  Médium      : {result.medium or '—'}")
        print(f"    │  Catégorie   : {result.artwork_category or '—'}")
        print(f"    │  Année       : {result.year_estimate or '—'}")
        print(f"    │  Style       : {result.style or '—'}")
        print(f"    │  Période     : {result.period or '—'}")
        print(f"    │  Signature   : {'✓ détectée' if result.signature_detected else '✗ non détectée'}")
        print(f"    │  Confiance   : {result.confidence}%")
        print(f"    │  Analyse     : {(result.analysis or '')[:120]}")
        print(f"    │  Temps total : {total_time:.1f}s (vision: {vision_time:.1f}s)")
        print(f"    ├── ACCURACY ──────────────────────────────────────────")
        print(f"    │  Artiste   : {'✅' if scores['artist_match'] else '❌'}")
        print(f"    │  Médium    : {'✅' if scores['medium_match'] else '❌'}")
        print(f"    │  Catégorie : {'✅' if scores['category_match'] else '❌'}")
        print(f"    │  Année     : {'✅' if scores['year_match'] else '❌'}")
        print(f"    └─────────────────────────────────────────────────────")

        # Full JSON
        full_json = {
            "artist":            result.artist,
            "artist_id":         None,  # pas de DB lookup ici
            "artist_confidence": result.artist_confidence,
            "title":             result.title,
            "medium":            result.medium,
            "artwork_category":  result.artwork_category,
            "year_estimate":     result.year_estimate,
            "signature_detected": result.signature_detected,
            "signature_position": result.signature_position,
            "style":             result.style,
            "period":            result.period,
            "condition_apparent": result.condition_apparent,
            "confidence":        result.confidence,
            "confidence_breakdown": result.confidence_breakdown,
            "analysis":          result.analysis,
            "source_used":       result.source_used,
        }
        print(f"\n    JSON complet:")
        print("    " + json.dumps(full_json, ensure_ascii=False, indent=2).replace("\n", "\n    "))

        results_summary.append({
            "artist":       test["artist"],
            "title_ref":    test["title_ref"],
            "predicted":    result.artist,
            "confidence":   result.confidence,
            "artist_conf":  result.artist_confidence,
            "time_s":       round(total_time, 1),
            "vision_s":     round(vision_time, 1),
            "scores":       scores,
        })

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n" + "═"*60)
    print("  SYNTHÈSE")
    print("═"*60)

    if results_summary:
        artist_acc  = sum(1 for r in results_summary if r["scores"]["artist_match"]) / len(results_summary) * 100
        medium_acc  = sum(1 for r in results_summary if r["scores"]["medium_match"])  / len(results_summary) * 100
        cat_acc     = sum(1 for r in results_summary if r["scores"]["category_match"]) / len(results_summary) * 100
        year_acc    = sum(1 for r in results_summary if r["scores"]["year_match"])    / len(results_summary) * 100
        avg_time    = sum(r["time_s"] for r in results_summary) / len(results_summary)
        avg_conf    = sum(r["confidence"] for r in results_summary) / len(results_summary)

        print(f"\n  Métriques d'accuracy:")
        print(f"    Artist Accuracy   : {artist_acc:.0f}% ({sum(1 for r in results_summary if r['scores']['artist_match'])}/{len(results_summary)})")
        print(f"    Medium Accuracy   : {medium_acc:.0f}%")
        print(f"    Category Accuracy : {cat_acc:.0f}%")
        print(f"    Year Accuracy     : {year_acc:.0f}%")
        print(f"\n  Performance:")
        print(f"    Temps moyen       : {avg_time:.1f}s")
        print(f"    Confiance moyenne : {avg_conf:.0f}%")
        print(f"    Taux d'échec      : {len(errors)}/{len(TESTS)} erreurs")

        print(f"\n  Détail par artiste:")
        for r in results_summary:
            marks = f"{'✅' if r['scores']['artist_match'] else '❌'} {'✅' if r['scores']['medium_match'] else '❌'} {'✅' if r['scores']['category_match'] else '❌'} {'✅' if r['scores']['year_match'] else '❌'}"
            print(f"    {r['artist']:<22} → {r['predicted'] or '—':<22} conf:{r['confidence']}% {r['vision_s']}s  [{marks}]")

    if errors:
        print(f"\n  Erreurs:")
        for e in errors:
            print(f"    {e['artist']}: [{e['step']}] {e['error']}")

    print("\n" + "═"*60)


if __name__ == "__main__":
    asyncio.run(run_tests())
