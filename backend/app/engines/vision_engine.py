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

VISION_PROMPT = """Tu es un expert en histoire de l'art et en catalogage d'œuvres pour maisons de vente.

Analyse cette image d'une œuvre d'art et retourne UNIQUEMENT un objet JSON valide (pas de markdown, pas de texte avant ou après).

Structure attendue :
{
  "artist": "Nom complet de l'artiste si identifiable, sinon null",
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
  "analysis": "Description brève de ton analyse en 1-2 phrases (ce que tu vois, pourquoi tu penses à cet artiste)",
  "source_used": ["vision"]
}

Règles :
- Sois précis et factuel. Ne devine pas si tu n'as pas de signaux forts.
- Si la signature est visible et lisible, booste artist_confidence à 80+.
- Pour artwork_category : Painting = peinture sur toile/panneau, Drawing = dessin, Work On Paper = aquarelle/gouache/pastel sur papier, Print = gravure/lithographie/sérigraphie.
- Retourne null pour les champs que tu ne peux pas déterminer avec un minimum de certitude.
- confidence global = moyenne pondérée des confidence_breakdown.
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
    image_data: bytes,
    content_type: str = "image/jpeg",
    anthropic_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
) -> VisionAnalysisResult:
    """
    Analyse une image via Claude Vision (fallback GPT-4o).
    Retourne un VisionAnalysisResult structuré.
    """
    # Valider le content_type
    allowed = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    if content_type not in allowed:
        content_type = "image/jpeg"

    b64 = base64.standard_b64encode(image_data).decode()

    # ── Essai Anthropic ──────────────────────────────────────────────────────
    if anthropic_api_key:
        try:
            result = await _analyze_with_anthropic(b64, content_type, anthropic_api_key)
            if result and not result.error:
                return result
        except Exception as e:
            logger.warning(f"[vision] Anthropic failed: {e}")

    # ── Fallback OpenAI ──────────────────────────────────────────────────────
    if openai_api_key:
        try:
            result = await _analyze_with_openai(b64, content_type, openai_api_key)
            if result and not result.error:
                return result
        except Exception as e:
            logger.warning(f"[vision] OpenAI failed: {e}")

    return VisionAnalysisResult(error="Aucun service de vision disponible ou configuré.")


async def _analyze_with_anthropic(b64: str, content_type: str, api_key: str) -> VisionAnalysisResult:
    import asyncio
    import anthropic as ant

    def _sync_call():
        client = ant.Anthropic(api_key=api_key)
        return client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": content_type,
                                "data": b64,
                            },
                        },
                        {"type": "text", "text": VISION_PROMPT},
                    ],
                }
            ],
        )

    response = await asyncio.to_thread(_sync_call)
    raw_text = response.content[0].text.strip()
    return _parse_vision_response(raw_text)


async def _analyze_with_openai(b64: str, content_type: str, api_key: str) -> VisionAnalysisResult:
    import asyncio
    from openai import OpenAI

    def _sync_call():
        client = OpenAI(api_key=api_key)
        return client.chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{content_type};base64,{b64}"},
                        },
                        {"type": "text", "text": VISION_PROMPT},
                    ],
                }
            ],
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
