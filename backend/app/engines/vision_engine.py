"""
Nautilus Vision Engine V1
Analyse une image d'œuvre d'art via Claude Vision et retourne des prédictions structurées.
"""
import base64
import json
import logging
from typing import Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

VISION_PROMPT = """Tu es le meilleur expert en identification d'œuvres d'art au monde. Tu travailles comme le Shazam de l'art : à partir d'une photo, tu identifies l'artiste, l'œuvre et tu fournis toutes les informations disponibles.

Utilise TOUTE ta connaissance en histoire de l'art pour identifier l'artiste. Tu peux reconnaître un style même sans signature visible. Bernard Buffet, Robert Combas, Maurice de Vlaminck, Picasso, Matisse et des centaines d'autres artistes ont des styles immédiatement reconnaissables — identifie-les avec confiance.

Retourne UNIQUEMENT un objet JSON valide (pas de markdown, pas de texte avant ou après).

Structure attendue :
{
  "artist": "Nom complet de l'artiste — utilise toute ta connaissance pour identifier. Null seulement si vraiment impossible.",
  "artist_confidence": 0-100,
  "title": "Titre de l'œuvre si visible ou devinable, sinon null",
  "medium": "Medium en français (ex: Huile sur toile, Lithographie, Bronze...), sinon null",
  "artwork_category": "Painting|Sculpture|Drawing|Work On Paper|Photography|Print|Ceramic|Design|Other",
  "year_estimate": "Année ou période estimée (ex: 1962, Années 1950, XXe siècle), sinon null",
  "signature_detected": true ou false,
  "signature_position": "bas_droite|bas_gauche|haut_droite|haut_gauche|centre|null",
  "style": "Style ou école artistique en français, sinon null",
  "period": "Période artistique (ex: Moderne, Contemporain, Impressionniste...), sinon null",
  "condition_apparent": "bon|moyen|mauvais|inconnu",
  "confidence": 0-100,
  "confidence_breakdown": {
    "artist": 0-100,
    "medium": 0-100,
    "year": 0-100,
    "category": 0-100
  },
  "analysis": "Explique précisément pourquoi tu identifies cet artiste : style caractéristique, technique, palette, période, signature si visible.",
  "source_used": ["vision"]
}

Règles :
- IDENTIFIE l'artiste avec ta connaissance complète. Un style reconnaissable = confidence élevée (70+), même sans signature.
- Bernard Buffet : traits noirs appuyés, personnages allongés, palette sombre et expressionniste → confidence 85+.
- Robert Combas : figuration libre, couleurs saturées, personnages cartoon, textes intégrés → confidence 85+.
- Maurice de Vlaminck : fauvisme, touches larges, couleurs vives, paysages → confidence 80+.
- Si la signature est visible et lisible → artist_confidence 90+.
- Pour artwork_category : Painting = peinture sur toile/panneau, Drawing = dessin, Work On Paper = aquarelle/gouache/pastel sur papier, Print = gravure/lithographie/sérigraphie.
- confidence global = moyenne pondérée des confidence_breakdown.
- Ne retourne jamais null pour artist si tu reconnais un style caractéristique.
"""


EVIDENCE_LABELS: dict[str, str] = {
    "main":        "Photo principale de l'œuvre",
    "signature":   "Photo rapprochée de la signature de l'artiste",
    "back":        "Photo du verso (peut contenir : titre manuscrit, date, tampon de galerie, étiquette de vente, dédicace, numéro d'inventaire, provenance)",
    "certificate": "Certificat d'authenticité (fait autorité pour : artiste, titre, dimensions, médium, année, provenance)",
}

VISION_PROMPT_MULTI = """Tu es le meilleur expert en identification d'œuvres d'art au monde. Tu travailles comme le Shazam de l'art.

Tu disposes de plusieurs preuves documentaires présentées ci-dessus, chacune étiquetée selon son rôle.

Rôle de chaque type de preuve :

\u2022 Photo principale : source primaire d'identification stylistique. Analyse le style, la technique, la palette, la composition et les caractéristiques distinctives de l'artiste. Base ta confiance sur la clarté et la cohérence des indices visuels.

\u2022 Signature : observe-la attentivement. Une signature lisible et reconnaissable est la preuve la plus directe de l'attribution — elle doit fortement augmenter ta confiance dans l'identification de l'artiste. Transcris-la exactement dans le champ "artist".

\u2022 Verso : recherche un titre manuscrit, une date, un tampon de galerie, une étiquette de vente aux enchères, une dédicace, un numéro d'inventaire ou une mention de provenance. Ces éléments enrichissent title, year_estimate, medium et analysis.

\u2022 Certificat d'authenticité : fait autorité. Ses informations (artiste, titre, dimensions, médium, année, provenance) ont priorité sur toute autre source. Un certificat cohérent avec les autres preuves doit produire une confiance élevée.

Croise systématiquement toutes les preuves disponibles. Des preuves convergentes augmentent la confiance. Des preuves contradictoires doivent être mentionnées dans analysis et réduire la confiance en conséquence.

Retourne UNIQUEMENT un objet JSON valide (pas de markdown, pas de texte avant ou après).

Structure attendue :
{
  "artist": "Nom complet de l'artiste — utilise toute ta connaissance pour identifier. Null seulement si vraiment impossible.",
  "artist_confidence": 0-100,
  "title": "Titre de l'oeuvre si visible ou devinable, sinon null",
  "medium": "Medium en français (ex: Huile sur toile, Lithographie, Bronze...), sinon null",
  "artwork_category": "Painting|Sculpture|Drawing|Work On Paper|Photography|Print|Ceramic|Design|Other",
  "year_estimate": "Année ou période estimée (ex: 1962, Années 1950, XXe siècle), sinon null",
  "signature_detected": true ou false,
  "signature_position": "bas_droite|bas_gauche|haut_droite|haut_gauche|centre|null",
  "style": "Style ou école artistique en français, sinon null",
  "period": "Période artistique (ex: Moderne, Contemporain, Impressionniste...), sinon null",
  "condition_apparent": "bon|moyen|mauvais|inconnu",
  "confidence": 0-100,
  "confidence_breakdown": {
    "artist": 0-100,
    "medium": 0-100,
    "year": 0-100,
    "category": 0-100
  },
  "analysis": "Explique précisément pourquoi tu identifies cet artiste en croisant toutes les preuves disponibles : style, technique, signature, informations du verso ou du certificat.",
  "source_used": ["vision"]
}

Règles :
- IDENTIFIE l'artiste avec ta connaissance complète. Un style reconnaissable suffit à une identification confiante.
- Pour artwork_category : Painting = peinture sur toile/panneau, Drawing = dessin, Work On Paper = aquarelle/gouache/pastel sur papier, Print = gravure/lithographie/sérigraphie.
- confidence global = moyenne pondérée des confidence_breakdown.
- Ne retourne jamais null pour artist si tu reconnais un style caractéristique ou si une preuve l'identifie clairement.
"""


@dataclass
class VisionAnalysisResult:
    artist: Optional[str] = None
    artist_confidence: int = 0
    title: Optional[str] = None
    medium: Optional[str] = None
    artwork_category: Optional[str] = None
    year_estimate: Optional[str] = None
    signature_detected: bool = False
    signature_position: Optional[str] = None
    style: Optional[str] = None
    period: Optional[str] = None
    condition_apparent: str = "inconnu"
    confidence: int = 0
    confidence_breakdown: dict = field(default_factory=dict)
    analysis: str = ""
    source_used: list = field(default_factory=lambda: ["vision"])
    error: Optional[str] = None


async def analyze_artwork_image(
    images: list[tuple[bytes, str, str]],
    anthropic_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
) -> VisionAnalysisResult:
    """
    Analyse une ou plusieurs images via Claude Vision (fallback GPT-4o).
    images : liste de (data: bytes, content_type: str, evidence_type: str)
    Retourne un VisionAnalysisResult structuré.
    """
    allowed = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    b64_images = [
        (
            base64.standard_b64encode(data).decode(),
            ct if ct in allowed else "image/jpeg",
            et,
        )
        for (data, ct, et) in images
    ]

    # ── Essai Anthropic ──────────────────────────────────────────────────────
    if anthropic_api_key:
        try:
            result = await _analyze_with_anthropic(b64_images, anthropic_api_key)
            if result and not result.error:
                return result
        except Exception as e:
            logger.warning(f"[vision] Anthropic failed: {e}")

    # ── Fallback OpenAI ──────────────────────────────────────────────────────
    if openai_api_key:
        try:
            result = await _analyze_with_openai(b64_images, openai_api_key)
            if result and not result.error:
                return result
        except Exception as e:
            logger.warning(f"[vision] OpenAI failed: {e}")

    return VisionAnalysisResult(error="Aucun service de vision disponible ou configuré.")


async def _analyze_with_anthropic(
    images: list[tuple[str, str, str]],  # (b64, content_type, evidence_type)
    api_key: str,
) -> VisionAnalysisResult:
    from anthropic import AsyncAnthropic

    content: list[dict] = []
    for (b64, content_type, evidence_type) in images:
        label = EVIDENCE_LABELS.get(evidence_type, f"Preuve documentaire ({evidence_type})")
        content.append({"type": "text", "text": f"[{label}]"})
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": content_type, "data": b64},
        })

    prompt = VISION_PROMPT_MULTI if len(images) > 1 else VISION_PROMPT
    content.append({"type": "text", "text": prompt})

    client = AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1500,
        messages=[{"role": "user", "content": content}],
    )
    raw_text = response.content[0].text.strip()
    return _parse_vision_response(raw_text)


async def _analyze_with_openai(
    images: list[tuple[str, str, str]],  # (b64, content_type, evidence_type)
    api_key: str,
) -> VisionAnalysisResult:
    import asyncio
    from openai import OpenAI

    content: list[dict] = []
    for (b64, content_type, evidence_type) in images:
        label = EVIDENCE_LABELS.get(evidence_type, f"Preuve documentaire ({evidence_type})")
        content.append({"type": "text", "text": f"[{label}]"})
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{content_type};base64,{b64}"},
        })

    prompt = VISION_PROMPT_MULTI if len(images) > 1 else VISION_PROMPT
    content.append({"type": "text", "text": prompt})

    def _sync_call():
        client = OpenAI(api_key=api_key)
        return client.chat.completions.create(
            model="gpt-4o",
            max_tokens=1500,
            messages=[{"role": "user", "content": content}],
        )

    response = await asyncio.to_thread(_sync_call)
    raw_text = response.choices[0].message.content.strip()
    return _parse_vision_response(raw_text)


def _parse_vision_response(raw_text: str) -> VisionAnalysisResult:
    """Parse la réponse JSON du LLM en VisionAnalysisResult."""
    # Nettoyer les éventuels blocs markdown
    text = raw_text
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"[vision] JSON parse error: {e}\nRaw: {raw_text[:300]}")
        return VisionAnalysisResult(error=f"Réponse invalide du modèle: {e}")

    return VisionAnalysisResult(
        artist=data.get("artist"),
        artist_confidence=int(data.get("artist_confidence", 0)),
        title=data.get("title"),
        medium=data.get("medium"),
        artwork_category=data.get("artwork_category"),
        year_estimate=data.get("year_estimate"),
        signature_detected=bool(data.get("signature_detected", False)),
        signature_position=data.get("signature_position"),
        style=data.get("style"),
        period=data.get("period"),
        condition_apparent=data.get("condition_apparent", "inconnu"),
        confidence=int(data.get("confidence", 0)),
        confidence_breakdown=data.get("confidence_breakdown", {}),
        analysis=data.get("analysis", ""),
        source_used=data.get("source_used", ["vision"]),
        error=None,
    )
