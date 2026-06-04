#!/usr/bin/env python3
"""
Nautilus Copilot — Évaluation P0
=================================
Mesure l'impact des correctifs sur 6 questions clés.
Compare automatiquement avant/après sur 15 points.

Usage:
  JWT_TOKEN="<token>" python evaluate_p0.py
"""

import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime

try:
    import httpx
except ImportError:
    print("Missing httpx. Run: pip install httpx")
    sys.exit(1)

BACKEND   = os.environ.get("BACKEND_URL", "https://artalpha-backend-production.up.railway.app")
TOKEN     = os.environ.get("JWT_TOKEN", "")
PAUSE_SEC = 4

if not TOKEN:
    print("\n❌  JWT_TOKEN not set.\n    JWT_TOKEN=\"<token>\" python evaluate_p0.py\n")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type":  "application/json",
    "Accept":        "text/event-stream",
}

# ── Questions ──────────────────────────────────────────────────────────────────

QUESTIONS = [
    ("Q1", "Budget 5k",     "J'ai 5 000 €, que regarder aujourd'hui ?"),
    ("Q2", "Budget 20k",    "J'ai 20 000 €, que regarder aujourd'hui ?"),
    ("Q3", "Revente 3 ans", "Je cherche une œuvre à acheter et revendre dans 3 ans. Quels critères et quels lots regarder ?"),
    ("Q4", "Urgence",       "Y a-t-il quelque chose d'urgent à regarder aujourd'hui ?"),
    ("Q5", "Portfolio",     "Que recommandes-tu par rapport à mon portefeuille actuel ?"),
    ("Q6", "Marché photo",  "Le marché de la photographie est-il porteur en ce moment ?"),
]

# ── Scores AVANT (baseline eval précédente, moy. 7.96/15) ─────────────────────
# Issus du diagnostic : artefacts Hirst €100, cécité budgétaire,
# absence dates, 0 signaux urgence, répétition artiste.
AVANT = {
    "Q1": {"ancrage": 1, "perso": 0, "tempo": 0, "decision": 1, "signal": 0},  # 2/15
    "Q2": {"ancrage": 1, "perso": 0, "tempo": 0, "decision": 1, "signal": 0},  # 2/15
    "Q3": {"ancrage": 2, "perso": 1, "tempo": 1, "decision": 2, "signal": 1},  # 7/15
    "Q4": {"ancrage": 1, "perso": 1, "tempo": 0, "decision": 1, "signal": 0},  # 3/15
    "Q5": {"ancrage": 1, "perso": 2, "tempo": 0, "decision": 2, "signal": 1},  # 6/15
    "Q6": {"ancrage": 2, "perso": 1, "tempo": 1, "decision": 2, "signal": 1},  # 7/15
}


# ── SSE reader ─────────────────────────────────────────────────────────────────

async def ask_copilot(client, question, session_id):
    payload = {"message": question, "session_id": session_id}
    full_text = []
    t_start = time.monotonic()
    try:
        async with client.stream(
            "POST", f"{BACKEND}/api/copilot/message",
            json=payload, headers=HEADERS, timeout=90.0,
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                return f"[HTTP {resp.status_code}] {body.decode()[:300]}", 0.0
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    data = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
                if "delta" in data:
                    full_text.append(data["delta"])
                if "error" in data:
                    return f"[API ERROR] {data['error']}", 0.0
                if data.get("done"):
                    break
    except httpx.TimeoutException:
        return "[TIMEOUT]", 0.0
    except Exception as e:
        return f"[EXCEPTION] {e}", 0.0
    return "".join(full_text), time.monotonic() - t_start


async def get_context(client):
    try:
        resp = await client.get(
            f"{BACKEND}/api/copilot/context",
            headers={**HEADERS, "Accept": "application/json"},
            timeout=15.0,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return {}


# ── Auto-scoring ───────────────────────────────────────────────────────────────

# Artefacts signatures: very cheap lots with extreme discounts
ARTEFACT_PATTERNS = [
    r"hirst",
    r"spin painting",
    r"richter.*poster",
    r"€\s*(?:50|80|90|100|120|150)\b",   # suspiciously cheap price mentions
    r"(?:50|80|90|100|120|150)\s*€",
]

RISK_WORDS = [
    "risque", "attention", "liquidi", "volatile", "incertit",
    "prudence", "prudent", "limité", "spéculat", "cependant",
    "toutefois", "néanmoins", "en revanche", "bémol", "faible demande",
    "peu liquide", "marché étroit", "mais ", "difficile",
]

URGENCY_WORDS = [
    "⚡", "demain", "urgent", "ferme", "clôt", "rapidement",
    "jours restants", "dans 1", "dans 2", "dans 3", "dans 4", "dans 5",
    "dans 6", "dans 7", "se termine", "dernière chance",
]

DATE_PATTERNS = [
    r"\d{2}/\d{2}/20\d{2}",  # dd/mm/yyyy
    r"dans \d+j",
    r"dans \d+ jour",
    r"vente\s*:",
]


def score_response(qid, response, user_ctx):
    """
    5 dimensions × 0-3 = /15.

    1. Ancrage    : lots cités réels, URL présente, réponse substantielle
    2. Perso      : budget respecté, profil pris en compte
    3. Tempo      : dates enchères, urgence signalée
    4. Décision   : risque explicite, recommandation actionnable
    5. Signal     : pas d'artefact, diversité artistes, qualité globale
    """
    r = response.lower()
    r_raw = response
    flags = []
    scores = {}

    # ── 1. Ancrage (0-3) ─────────────────────────────────────────────────────
    a = 0
    has_url = "get-nautilus.com" in r or "/app/opportunities/" in r or "→" in r_raw
    if has_url:
        a += 1
        flags.append("✓ URL lot présente")
    else:
        flags.append("✗ Pas d'URL lot")

    is_error = response.startswith("[")
    if not is_error and len(response) > 250:
        a += 1
    if not is_error and len(response) > 450:
        a += 1
        flags.append("✓ Réponse substantielle")

    scores["ancrage"] = min(a, 3)

    # ── 2. Personnalisation / Budget (0-3) ──────────────────────────────────
    p = 0
    budget_raw = (user_ctx.get("preferences") or {}).get("budget_max") or \
                 (user_ctx.get("dna") or {}).get("inferred_budget_max")
    budget = float(budget_raw) if budget_raw else None

    # For budget questions: check amount is respected (no insanely priced lots)
    if qid == "Q1":  # 5k budget
        # Check no lot > €10k is recommended
        prices_found = re.findall(r"€\s*([\d,. ]+)", r_raw)
        over_budget = any(
            float(p.replace(",", "").replace(" ", "").replace(".", "", 1) if "." in p else p.replace(",", "").replace(" ", "")) > 10_000
            for p in prices_found
            if p.replace(",", "").replace(" ", "").replace(".", "").isdigit()
        )
        if not over_budget:
            p += 2
            flags.append("✓ Budget 5k respecté")
        else:
            flags.append("✗ Prix hors budget détecté")
        if any(w in r for w in ["5 000", "5000", "budget", "fourchette"]):
            p += 1
            flags.append("✓ Budget 5k référencé")
    elif qid == "Q2":  # 20k budget
        prices_found = re.findall(r"€\s*([\d,. ]+)", r_raw)
        over_budget = any(
            float(p.replace(",", "").replace(" ", "").replace(".", "", 1) if "." in p else p.replace(",", "").replace(" ", "")) > 30_000
            for p in prices_found
            if p.replace(",", "").replace(" ", "").replace(".", "").isdigit()
        )
        if not over_budget:
            p += 2
            flags.append("✓ Budget 20k respecté")
        else:
            flags.append("✗ Prix hors budget détecté")
        if any(w in r for w in ["20 000", "20000", "budget", "fourchette"]):
            p += 1
            flags.append("✓ Budget 20k référencé")
    else:
        # Non-budget questions: check personalization
        perso_words = ["profil", "votre", "vous", "ton", "vos", "votre portefeuille",
                       "portfolio", "vos préférences", "catégorie"]
        count = sum(1 for w in perso_words if w in r)
        p = min(count, 3)
        if p >= 2:
            flags.append("✓ Réponse personnalisée")
        elif p == 1:
            flags.append("~ Personnalisation partielle")
        else:
            flags.append("✗ Réponse générique")

    scores["perso"] = min(p, 3)

    # ── 3. Temporalité / Urgence (0-3) ──────────────────────────────────────
    t = 0
    has_urgency = any(w in r for w in URGENCY_WORDS)
    has_date    = any(re.search(pat, r) for pat in DATE_PATTERNS)

    if has_urgency:
        t += 2
        flags.append("✓ Signal urgence")
    elif qid == "Q4":
        flags.append("✗ Q4 sans signal urgence")

    if has_date:
        t += 1
        flags.append("✓ Date enchère présente")

    # For Q4 specifically: must have urgency to score > 1
    if qid == "Q4" and not has_urgency:
        t = min(t, 1)

    scores["tempo"] = min(t, 3)

    # ── 4. Décision (0-3) ───────────────────────────────────────────────────
    d = 0
    has_risk   = any(w in r for w in RISK_WORDS)
    has_action = any(w in r for w in ["recommande", "conseille", "privilégi", "opte",
                                       "regarde", "surveille", "mise sur", "achet",
                                       "intéressant", "opportunité"])

    if has_risk:
        d += 2
        flags.append("✓ Risque mentionné")
    else:
        flags.append("✗ Aucun risque")

    if has_action:
        d += 1
        flags.append("✓ Recommandation actionnable")

    scores["decision"] = min(d, 3)

    # ── 5. Signal / Qualité (0-3) ────────────────────────────────────────────
    s = 3

    # Artefacts
    artefact_hit = None
    for pat in ARTEFACT_PATTERNS:
        if re.search(pat, r):
            artefact_hit = pat
            break
    if artefact_hit:
        s -= 2
        flags.append(f"✗ Artefact détecté : {artefact_hit}")
    else:
        flags.append("✓ Pas d'artefact")

    # Artist repetition (same name 3+ times)
    artist_names = re.findall(r"\b([A-Z][a-z]+ [A-Z][a-z]+)\b", r_raw)
    from collections import Counter
    name_counts = Counter(artist_names)
    repeated = [n for n, c in name_counts.items() if c >= 3]
    if repeated:
        s -= 1
        flags.append(f"✗ Répétition artiste : {repeated[0]}")
    else:
        flags.append("✓ Diversité artistes")

    scores["signal"] = max(s, 0)

    total = sum(scores.values())
    return scores, total, flags


# ── Main ───────────────────────────────────────────────────────────────────────

async def main():
    session_id = "eval-p0-" + datetime.now().strftime("%Y%m%d-%H%M%S")

    print("\n" + "═" * 74)
    print("  NAUTILUS COPILOT — ÉVALUATION P0 (avant/après correctifs)")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("═" * 74)

    async with httpx.AsyncClient() as client:
        # Auth check
        usage_resp = await client.get(
            f"{BACKEND}/api/copilot/usage",
            headers={**HEADERS, "Accept": "application/json"},
            timeout=10.0,
        )
        if usage_resp.status_code != 200:
            print(f"\n❌  Auth failed ({usage_resp.status_code}). Vérifiez JWT_TOKEN.\n")
            sys.exit(1)
        usage = usage_resp.json()
        print(f"\n  Auth OK — Plan : {usage.get('plan')} | "
              f"Restant : {usage.get('remaining')}/{usage.get('limit')}\n")

        # User context (for scoring)
        print("  Chargement du contexte utilisateur...")
        user_ctx = await get_context(client)
        budget = (user_ctx.get("preferences") or {}).get("budget_max") or \
                 (user_ctx.get("dna") or {}).get("inferred_budget_max")
        cats   = (user_ctx.get("preferences") or {}).get("categories", [])
        port   = (user_ctx.get("portfolio") or {}).get("count", 0)
        print(f"  Budget : {f'€{int(float(budget)):,}' if budget else 'non renseigné'}")
        print(f"  Catégories : {', '.join(cats) if cats else 'non renseignées'}")
        print(f"  Portfolio : {port} œuvre(s)")
        print()

        results = []

        for qid, label, question in QUESTIONS:
            print(f"  ┌─ [{qid}] {label}")
            print(f"  │  Q : {question}")

            response, elapsed = await ask_copilot(client, question, session_id)

            is_error = response.startswith("[")
            if is_error:
                print(f"  │  ⚠️  {response}")
                scores_apres = {"ancrage": 0, "perso": 0, "tempo": 0, "decision": 0, "signal": 0}
                total_apres  = 0
                flags = ["[ERREUR API]"]
            else:
                scores_apres, total_apres, flags = score_response(qid, response, user_ctx)
                # Print response
                for line in response.strip().split("\n"):
                    print(f"  │  {line}")

            scores_avant = AVANT[qid]
            total_avant  = sum(scores_avant.values())
            delta        = total_apres - total_avant
            delta_str    = f"+{delta}" if delta >= 0 else str(delta)

            print(f"  │")
            print(f"  │  Flags : {' | '.join(flags)}")
            print(f"  │")
            print(f"  │  Scores         Ancrage  Perso  Tempo  Décision  Signal  TOTAL")
            print(f"  │  AVANT           {scores_avant['ancrage']}/3      {scores_avant['perso']}/3    {scores_avant['tempo']}/3    {scores_avant['decision']}/3       {scores_avant['signal']}/3     {total_avant}/15")
            print(f"  │  APRÈS           {scores_apres['ancrage']}/3      {scores_apres['perso']}/3    {scores_apres['tempo']}/3    {scores_apres['decision']}/3       {scores_apres['signal']}/3     {total_apres}/15  ({delta_str})")
            print(f"  └─ ⏱ {elapsed:.1f}s\n")

            results.append({
                "id": qid, "label": label,
                "avant": scores_avant, "avant_total": total_avant,
                "apres": scores_apres, "apres_total": total_apres,
                "delta": delta,
                "response": response,
                "flags": flags,
                "elapsed": round(elapsed, 2),
            })

            if qid != QUESTIONS[-1][0]:
                await asyncio.sleep(PAUSE_SEC)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("═" * 74)
    print("  RÉCAPITULATIF AVANT/APRÈS")
    print("═" * 74)
    print(f"\n  {'ID':<5} {'Label':<16}  {'AVANT':>6}  {'APRÈS':>6}  {'Δ':>5}")
    print("  " + "─" * 46)

    total_av = 0
    total_ap = 0
    for r in results:
        d = r["delta"]
        d_str = f"+{d}" if d >= 0 else str(d)
        bar = "▲" * max(0, d) if d > 0 else ("▼" * max(0, -d) if d < 0 else "=")
        print(f"  {r['id']:<5} {r['label']:<16}  {r['avant_total']:>4}/15  {r['apres_total']:>4}/15  {d_str:>4}  {bar}")
        total_av += r["avant_total"]
        total_ap += r["apres_total"]

    n = len(results) or 1
    avg_av = total_av / n
    avg_ap = total_ap / n
    delta_avg = avg_ap - avg_av

    print("  " + "─" * 46)
    print(f"  {'MOY':<5} {'':16}  {avg_av:>5.1f}/15  {avg_ap:>5.1f}/15  {f'+{delta_avg:.1f}' if delta_avg >= 0 else f'{delta_avg:.1f}':>5}")
    print()

    # Diagnosis
    print("  DIAGNOSTIC :")
    if avg_ap >= 11:
        print("  ✅  Seuil 11/15 atteint — correctifs P0 validés.")
    elif avg_ap >= 9:
        print("  🟡  Progression notable mais seuil 11/15 non atteint — P1 recommandé.")
    else:
        print("  🔴  Score insuffisant — intent routing P1 requis immédiatement.")

    # Per-dimension breakdown
    dims = ["ancrage", "perso", "tempo", "decision", "signal"]
    dim_labels = {"ancrage": "Ancrage lots", "perso": "Personnalisation",
                  "tempo": "Temporalité", "decision": "Décision/risque", "signal": "Qualité signal"}
    print()
    print("  PAR DIMENSION (moyenne /3) :")
    for dim in dims:
        av = sum(r["avant"][dim] for r in results) / n
        ap = sum(r["apres"][dim] for r in results) / n
        d  = ap - av
        bar = "▲" if d > 0.3 else ("▼" if d < -0.3 else "=")
        print(f"    {dim_labels[dim]:<22} {av:.1f} → {ap:.1f}  {bar}")

    print()

    # Save
    out = "copilot_eval_p0.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({
            "session_id": session_id,
            "avg_avant": round(avg_av, 2),
            "avg_apres": round(avg_ap, 2),
            "results": results,
        }, f, ensure_ascii=False, indent=2)
    print(f"  Résultats → {out}\n")


if __name__ == "__main__":
    asyncio.run(main())
