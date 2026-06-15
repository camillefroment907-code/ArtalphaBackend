#!/usr/bin/env python3
"""
Nautilus Copilot — Evaluation Protocol
=======================================

Usage:
  1. Log in to get-nautilus.com in your browser
  2. Open DevTools > Application > Local Storage > get-nautilus.com
  3. Copy the value of 'nautilus_token' (or find it in Authorization header)
  4. Run: JWT_TOKEN="<paste>" python evaluate_copilot.py

Output: results printed + saved to copilot_eval_results.json
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime

try:
    import httpx
except ImportError:
    print("Missing httpx. Run: pip install httpx")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────────

BACKEND   = os.environ.get("BACKEND_URL", "https://artalpha-backend-production.up.railway.app")
TOKEN     = os.environ.get("JWT_TOKEN", "")
PAUSE_SEC = 3   # pause between questions to avoid rate limit

if not TOKEN:
    print("\n❌  JWT_TOKEN environment variable not set.")
    print("    Get your token from DevTools > Application > Local Storage > nautilus_token")
    print("    Then run: JWT_TOKEN=\"<token>\" python evaluate_copilot.py\n")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type":  "application/json",
    "Accept":        "text/event-stream",
}

# ── Questions ──────────────────────────────────────────────────────────────────
# (id, bloc, label, question, needs_lot)

QUESTIONS = [
    # Bloc A — Conviction et recommandation
    ("A1", "A", "Conviction",        "Pourquoi cette recommandation ?",                                  True),
    ("A2", "A", "Intérêt lot",       "Pourquoi cette opportunité est-elle intéressante ?",               True),
    ("A3", "A", "Cohérence profil",  "Cette œuvre est-elle cohérente avec mon profil ?",                 True),
    ("A4", "A", "Risques",           "Quels sont les risques de ce lot ?",                               True),
    ("A5", "A", "Pas recommandé",    "Y a-t-il des lots que vous ne me recommandez pas ? Pourquoi ?",    False),

    # Bloc B — Décision personnalisée
    ("B1", "B", "À ma place",        "Que feriez-vous à ma place ?",                                     False),
    ("B2", "B", "Budget 5k",         "J'ai 5 000 €, que regarder aujourd'hui ?",                         False),
    ("B3", "B", "Budget 20k",        "J'ai 20 000 €, que regarder aujourd'hui ?",                        False),
    ("B4", "B", "Débutant",          "Je débute complètement dans l'art, par où commencer ?",            False),
    ("B5", "B", "Attention today",   "Qu'est-ce qui mérite vraiment mon attention aujourd'hui ?",        False),
    ("B6", "B", "Urgence",           "Y a-t-il quelque chose d'urgent ?",                                False),

    # Bloc C — Artistes et marché
    ("C1", "C", "Artiste à suivre",  "Quels artistes suivre en ce moment ?",                             False),
    ("C2", "C", "Artiste absent",    "Zao Wou-Ki est-il une bonne entrée en ce moment ?",                False),
    ("C3", "C", "Marché photo",      "Le marché de la photographie est-il porteur en ce moment ?",       False),
    ("C4", "C", "Timing marché",     "Est-ce le bon moment pour acheter, ou vaut-il mieux attendre ?",   False),

    # Bloc D — Portfolio et stratégie
    ("D1", "D", "Portfolio",         "Comment se porte mon portfolio ?",                                  False),
    ("D2", "D", "Diversification",   "Devrais-je diversifier mes achats ?",                              False),
    ("D3", "D", "Vente",             "Je veux revendre une œuvre de mon portfolio, quelle stratégie ?",  False),
    ("D4", "D", "Long terme",        "Quelle est votre vision à 5 ans pour mon profil d'investisseur ?", False),

    # Bloc E — Limites et honnêteté
    ("E1", "E", "Basquiat valeur",   "Combien vaut Basquiat en ce moment ?",                             False),
    ("E2", "E", "Galeries Paris",    "Quelles sont les meilleures galeries parisiennes ?",                False),
    ("E3", "E", "NFT",               "Je veux investir en NFT, qu'en pensez-vous ?",                     False),
    ("E4", "E", "Hors domaine",      "Quelle voiture acheter avec 30 000 € ?",                           False),
    ("E5", "E", "Confiance",         "Est-ce que vous inventez des informations parfois ?",              False),
    ("E6", "E", "Données manquantes","Pouvez-vous me dire le dernier prix de vente de Monet chez Christie's ?", False),
]

# ── SSE stream reader ─────────────────────────────────────────────────────────

async def ask_copilot(
    client:     httpx.AsyncClient,
    question:   str,
    session_id: str,
    lot_id:     str | None = None,
) -> tuple[str, float]:
    """Returns (full_response_text, elapsed_seconds). Empty string on error."""
    payload = {
        "message":    question,
        "session_id": session_id,
        "lot_id":     lot_id,
    }
    full_text: list[str] = []
    t_start = time.monotonic()
    first_token_at: float | None = None

    try:
        async with client.stream(
            "POST",
            f"{BACKEND}/api/copilot/message",
            json=payload,
            headers=HEADERS,
            timeout=60.0,
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                return f"[HTTP {resp.status_code}] {body.decode()[:200]}", 0.0

            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    data = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue

                if "delta" in data:
                    if first_token_at is None:
                        first_token_at = time.monotonic() - t_start
                    full_text.append(data["delta"])

                if "error" in data:
                    return f"[API ERROR] {data['error']}", 0.0

                if data.get("done"):
                    break

    except httpx.TimeoutException:
        return "[TIMEOUT after 60s]", 0.0
    except Exception as e:
        return f"[EXCEPTION] {e}", 0.0

    elapsed = time.monotonic() - t_start
    return "".join(full_text), elapsed


# ── Get top lot ───────────────────────────────────────────────────────────────

async def get_conviction_lot(client: httpx.AsyncClient) -> str | None:
    try:
        resp = await client.get(
            f"{BACKEND}/api/lots/top-deals?limit=1",
            headers={**HEADERS, "Accept": "application/json"},
            timeout=15.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            if data:
                lot_id = data[0].get("id")
                artist = data[0].get("artist_name_raw", "?")
                title  = (data[0].get("title") or "")[:50]
                print(f"  Conviction du jour : {artist} — {title} (id: {lot_id})\n")
                return lot_id
    except Exception as e:
        print(f"  ⚠️  Impossible de récupérer le lot conviction : {e}")
    return None


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    print("\n" + "═" * 72)
    print("  NAUTILUS COPILOT — PROTOCOLE D'ÉVALUATION")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("═" * 72 + "\n")

    session_id = "eval-" + datetime.now().strftime("%Y%m%d-%H%M%S")

    async with httpx.AsyncClient() as client:
        # Verify auth
        usage_resp = await client.get(
            f"{BACKEND}/api/copilot/usage",
            headers={**HEADERS, "Accept": "application/json"},
            timeout=10.0,
        )
        if usage_resp.status_code != 200:
            print(f"❌  Auth failed ({usage_resp.status_code}). Vérifiez votre JWT_TOKEN.\n")
            sys.exit(1)

        usage = usage_resp.json()
        print(f"  Auth OK — Plan : {usage.get('plan')} | "
              f"Messages restants : {usage.get('remaining')} / {usage.get('limit')}\n")

        # Get conviction lot
        print("  Récupération du lot Conviction du jour...")
        lot_id = await get_conviction_lot(client)

        # Run all questions
        results = []

        for i, (qid, bloc, label, question, needs_lot) in enumerate(QUESTIONS, 1):
            current_lot_id = lot_id if needs_lot else None

            print(f"  [{qid}] {label}")
            print(f"  Q : {question}")

            response, elapsed = await ask_copilot(client, question, session_id, current_lot_id)

            if response.startswith("["):
                print(f"  ⚠️  {response}\n")
            else:
                # Print response, indented
                lines = response.strip().split("\n")
                for line in lines:
                    print(f"       {line}")

                # Quick auto-flags
                flags = []
                lower = response.lower()
                if any(w in lower for w in ["je n'ai pas", "je ne dispose pas", "je ne sais pas",
                                             "données disponibles", "je ne peux pas"]):
                    flags.append("✓ LIMITE SIGNALÉE")
                if any(w in lower for w in ["get-nautilus.com", "/app/", "→"]):
                    flags.append("✓ URL NAUTILUS")
                if current_lot_id and str(current_lot_id) in response:
                    flags.append("✓ LOT ID CITÉ")
                if len(response) < 80:
                    flags.append("⚠ RÉPONSE COURTE")
                if flags:
                    print(f"       [{' | '.join(flags)}]")

            print(f"  ⏱  {elapsed:.1f}s\n" + "  " + "─" * 68 + "\n")

            results.append({
                "id":       qid,
                "bloc":     bloc,
                "label":    label,
                "question": question,
                "lot_id":   str(current_lot_id) if current_lot_id else None,
                "response": response,
                "elapsed":  round(elapsed, 2),
                "scores": {
                    "qualite":      None,  # 0-3 — à remplir
                    "ancrage":      None,
                    "decision":     None,
                    "hallucination":None,
                    "diff_gpt":     None,
                    "total":        None,
                },
                "notes": "",
            })

            # Pause between questions
            if i < len(QUESTIONS):
                await asyncio.sleep(PAUSE_SEC)

    # Save to JSON
    out_path = "copilot_eval_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"session_id": session_id, "results": results}, f, ensure_ascii=False, indent=2)

    print("\n" + "═" * 72)
    print("  RÉCAPITULATIF")
    print("═" * 72)

    # Summary by bloc
    bloc_map: dict[str, list] = {}
    for r in results:
        bloc_map.setdefault(r["bloc"], []).append(r)

    errors   = [r for r in results if r["response"].startswith("[")]
    timeouts = [r for r in results if "TIMEOUT" in r["response"]]

    print(f"\n  Questions posées  : {len(results)}")
    print(f"  Erreurs API       : {len(errors)}")
    print(f"  Timeouts          : {len(timeouts)}")
    print(f"  Latence moyenne   : {sum(r['elapsed'] for r in results if r['elapsed'] > 0) / max(1, sum(1 for r in results if r['elapsed'] > 0)):.1f}s")
    print(f"\n  Résultats sauvegardés → {out_path}")

    print("\n" + "═" * 72)
    print("  GRILLE DE SCORING — À REMPLIR")
    print("  Critères : Qualité (0-3) | Ancrage (0-3) | Décision (0-3)")
    print("             Hallucination (0-3) | Diff. GPT (0-3) | Total /15")
    print("═" * 72)
    print(f"\n  {'ID':<5} {'Label':<20} {'Qualité':>8} {'Ancrage':>8} {'Décision':>9} {'Halluc.':>8} {'Diff':>6} {'Total':>7}")
    print("  " + "─" * 68)
    for r in results:
        if not r["response"].startswith("["):
            print(f"  {r['id']:<5} {r['label']:<20} {'___':>8} {'___':>8} {'___':>9} {'___':>8} {'___':>6} {'_/15':>7}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
