"""
Artist Resolver Engine — Nautilus
Resolves ambiguous artist names using:
1. pg_trgm similarity on artists.name_normalized (free, ~5ms)
2. Claude Sonnet arbitration (with optional image) when DB is ambiguous (~$0.004/call)

Fast path : exactly 1 DB candidate with similarity > 0.60 → return directly.
Slow path : Sonnet arbitrates (0 strong OR 2+ ambiguous strong).
"""
import json
import logging
import unicodedata
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

logger = logging.getLogger(__name__)


def _norm(s: str) -> str:
    """Normalize string — matches autocomplete endpoint logic."""
    s = s.strip().lower()
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


async def resolve_artist(
    *,
    artist:             Optional[str],
    artist_confidence:  float,
    style:              Optional[str],
    period:             Optional[str],
    medium:             Optional[str],
    analysis:           Optional[str],
    image_url:          Optional[str],
    db:                 AsyncSession,
    anthropic_api_key:  str,
) -> list[dict]:
    """
    Returns up to 3 suggestions: [{ artist_name, artist_id, confidence }]
    confidence: "high" | "medium" | "low"
    """
    from app.models.db_models import Artist

    if not artist:
        return []

    nq = _norm(artist)
    sim = func.similarity(Artist.name_normalized, nq)

    # ── 1. pg_trgm lookup ────────────────────────────────────────────────────
    stmt = (
        select(Artist, sim.label("sim"))
        .where(sim > 0.20)
        .order_by(sim.desc())
        .limit(5)
    )
    rows = (await db.execute(stmt)).all()
    candidates: list[tuple] = [(a, float(s)) for a, s in rows]

    strong = [(a, s) for a, s in candidates if s > 0.60]
    strong_count = len(strong)

    logger.info(
        "[NAUTILUS_EVENT] resolve_artist_called artist=%r vision_conf=%.0f "
        "db_hits=%d strong=%d",
        artist, artist_confidence, len(candidates), strong_count,
    )

    # ── 2. Fast path — exactly 1 strong match → return directly ──────────────
    if strong_count == 1:
        logger.info(
            "[NAUTILUS_EVENT] resolve_artist_db_match artist_id=%s similarity=%.2f",
            str(strong[0][0].id), strong[0][1],
        )
        return _format_db([strong[0]])

    # Sonnet arbitrates for 0 strong (ambiguous) or 2+ strong (multiple candidates)
    if not anthropic_api_key or not candidates:
        return _format_db(candidates[:3])

    # ── 3. Sonnet arbitration ─────────────────────────────────────────────────
    logger.info(
        "[NAUTILUS_EVENT] resolve_artist_sonnet_called artist_confidence=%.0f",
        artist_confidence,
    )

    try:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=anthropic_api_key)

        ctx_parts = [p for p in [
            f"style: {style}"       if style    else None,
            f"période: {period}"    if period   else None,
            f"médium: {medium}"     if medium   else None,
            f"analyse: {(analysis or '')[:200]}" if analysis else None,
        ] if p]
        ctx = " | ".join(ctx_parts) or "aucun contexte additionnel"

        cand_lines = "\n".join(
            f"{i + 1}. {a.name}"
            f" ({a.nationality or '?'}, {a.birth_year or '?'}–{a.death_year or ''})"
            f" [sim={s:.2f}]"
            for i, (a, s) in enumerate(candidates)
        )

        prompt = (
            f'Vision AI a détecté l\'artiste "{artist}" (confiance {artist_confidence:.0f}/100).\n'
            f"Contexte de l'œuvre : {ctx}\n\n"
            f"Candidats en base de données :\n{cand_lines}\n\n"
            "Parmi ces candidats, lesquels correspondent à l'artiste détecté ?\n"
            "Réponds UNIQUEMENT avec ce JSON strict, aucun markdown :\n"
            '[{"candidate_index": N, "confidence": "high"|"medium"|"low"}, ...]\n\n'
            "Règles :\n"
            "- Max 3 entrées triées par confidence décroissante\n"
            '- "high" : quasi-certain (similarity > 0.60 ET contexte cohérent)\n'
            '- "medium" : probable mais incertain\n'
            '- "low" : faible signal\n'
            "- Tableau vide [] si aucun candidat ne correspond\n"
            "- candidate_index est le numéro de la liste (1-based)"
        )

        # ── Multimodal message (SDK 0.109.2 — source.type: "url") ────────────
        # Falls back to text-only if image_url is absent
        content: list[dict] = []
        if image_url:
            content.append({
                "type": "image",
                "source": {
                    "type": "url",
                    "url":  image_url,
                },
            })
        content.append({"type": "text", "text": prompt})

        message = await client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=256,
            temperature=0.1,
            messages=[{"role": "user", "content": content}],
        )

        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            raise ValueError("unexpected Sonnet response shape")

        suggestions = []
        for entry in parsed[:3]:
            idx = int(entry.get("candidate_index", 0)) - 1
            if not 0 <= idx < len(candidates):
                continue
            a, _ = candidates[idx]
            suggestions.append({
                "artist_name": a.name,
                "artist_id":   str(a.id),
                "confidence":  entry.get("confidence", "low"),
            })
        return suggestions

    except Exception as e:
        logger.warning("[resolver] Sonnet error: %s", e)
        return _format_db(candidates[:3])


def _format_db(rows: list[tuple]) -> list[dict]:
    """Convert DB candidates to suggestion format (no Sonnet)."""
    result = []
    for a, sim_score in rows:
        confidence = "high" if sim_score >= 0.60 else "medium" if sim_score >= 0.40 else "low"
        result.append({
            "artist_name": a.name,
            "artist_id":   str(a.id),
            "confidence":  confidence,
        })
    return result
