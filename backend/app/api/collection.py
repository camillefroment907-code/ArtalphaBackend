"""
Collection management API — authenticated users.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, model_validator
import uuid as uuid_lib
import httpx

import logging

from app.database import get_db
from app.api.auth_utils import get_current_user
from app.models.db_models import User, PortfolioItem, CollectionValuation, SaleRequest
from app.api.billing import _get_user_plan, PLAN_LIMITS
from app.engines.valuation_engine import valuate_item, _claude_review_estimate
from app.engines.comparable_engine import find_comparables_and_estimate
from app.engines.vision_engine import analyze_artwork_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/collection", tags=["collection"])


# ── Serializers ───────────────────────────────────────────────────────────────

def _serialize_item(item: PortfolioItem, latest_valuation=None) -> dict:
    return {
        "id":                            str(item.id),
        "user_id":                       str(item.user_id),
        "lot_id":                        str(item.lot_id) if item.lot_id else None,
        # Artwork info
        "title":                         item.title,
        "artist_name":                   item.artist_name,
        "medium":                        item.medium,
        "dimensions":                    item.dimensions,
        "year_created":                  item.year_created,
        "image_url":                     item.image_url,
        # Purchase info
        "purchase_price_eur":            item.purchase_price_eur,
        "purchase_date":                 item.purchase_date.isoformat() if item.purchase_date else None,
        "purchase_source":               item.purchase_source,
        "acquisition_type":              item.acquisition_type,
        # Valuation (legacy fields)
        "estimated_current_value_eur":   item.estimated_current_value_eur,
        "last_valuation_at":             item.last_valuation_at.isoformat() if item.last_valuation_at else None,
        # Artwork identity
        "artist_id":                     str(item.artist_id) if item.artist_id else None,
        "matched_lot_id":                str(item.matched_lot_id) if item.matched_lot_id else None,
        "matched_confidence":            item.matched_confidence,
        "edition":                       item.edition,
        "condition":                     item.condition,
        "provenance":                    item.provenance,
        # Extended purchase info
        "purchase_auction_house":        item.purchase_auction_house,
        "purchase_location":             item.purchase_location,
        # Authentication & documentation
        "certificate_of_authenticity":   item.certificate_of_authenticity,
        "authenticated_by":              item.authenticated_by,
        "authentication_date":           item.authentication_date.isoformat() if item.authentication_date else None,
        "authentication_document_url":   item.authentication_document_url,
        "catalogue_raisonne_reference":  item.catalogue_raisonne_reference,
        "image_urls":                    item.image_urls or [],
        "document_urls":                 item.document_urls or [],
        # Valuation (extended)
        "current_estimated_value_eur":   item.current_estimated_value_eur,
        "last_estimated_at":             item.last_estimated_at.isoformat() if item.last_estimated_at else None,
        "estimation_confidence":         item.estimation_confidence,
        # Sale management
        "sale_status":                   item.sale_status,
        "recommended_auction_house":     item.recommended_auction_house,
        "recommended_reserve_price":     item.recommended_reserve_price,
        "recommended_sale_timing":       item.recommended_sale_timing,
        "timing_reasoning":              item.timing_reasoning,
        # Insurance & storage
        "insured_value_eur":             item.insured_value_eur,
        "insurance_provider":            item.insurance_provider,
        "insurance_expiry_date":         item.insurance_expiry_date.isoformat() if item.insurance_expiry_date else None,
        "storage_location":              item.storage_location,
        "last_condition_report_date":    item.last_condition_report_date.isoformat() if item.last_condition_report_date else None,
        # Succession
        "beneficiary_name":              item.beneficiary_name,
        "beneficiary_contact":           item.beneficiary_contact,
        "inheritance_notes":             item.inheritance_notes,
        # History & compliance
        "previous_owners":               item.previous_owners or [],
        "exhibition_history":            item.exhibition_history or [],
        "literature_references":         item.literature_references or [],
        "auction_history":               item.auction_history or [],
        "country_of_origin":             item.country_of_origin,
        "acquisition_tax_paid_eur":      item.acquisition_tax_paid_eur,
        "import_duties_eur":             item.import_duties_eur,
        # User data
        "notes":                         item.notes,
        "is_for_sale":                   item.is_for_sale,
        "asking_price_eur":              item.asking_price_eur,
        # Timestamps
        "created_at":                    item.created_at.isoformat() if item.created_at else None,
        "updated_at":                    item.updated_at.isoformat() if item.updated_at else None,
        # Computed
        "latest_valuation":              _serialize_valuation(latest_valuation) if latest_valuation else None,
    }


def _serialize_valuation(v: CollectionValuation) -> dict:
    return {
        "id":                   str(v.id),
        "collection_item_id":   str(v.collection_item_id),
        "user_id":              str(v.user_id),
        "estimated_value_eur":  v.estimated_value_eur,
        "value_low":            v.value_low,
        "value_high":           v.value_high,
        "estimation_date":      v.estimation_date.isoformat() if v.estimation_date else None,
        "method":               v.method,
        "confidence":           v.confidence,
        "comparables_count":    v.comparables_count,
        "source":               v.source,
        "warning":              v.warning,
        "comparables_used":     v.comparables_used or [],
        "comparable_lots_ids":  v.comparable_lots_ids or [],
        "market_trend_3m":      v.market_trend_3m,
        "market_trend_12m":     v.market_trend_12m,
        "liquidity_score":      v.liquidity_score,
        "best_time_to_sell":    v.best_time_to_sell,
        "market_context":       v.market_context,
        "created_at":           v.created_at.isoformat() if v.created_at else None,
    }


def _serialize_sale_request(r: SaleRequest) -> dict:
    return {
        "id":                           str(r.id),
        "collection_item_id":           str(r.collection_item_id),
        "user_id":                      str(r.user_id),
        "status":                       r.status,
        "preferred_auction_house":      r.preferred_auction_house,
        "reserve_price_eur":            r.reserve_price_eur,
        "nautilus_recommended_house":   r.nautilus_recommended_house,
        "nautilus_recommended_price":   r.nautilus_recommended_price,
        "nautilus_recommended_timing":  r.nautilus_recommended_timing,
        "comparable_lots":              r.comparable_lots or [],
        "market_analysis":              r.market_analysis,
        "catalogue_notice_fr":          r.catalogue_notice_fr,
        "catalogue_notice_en":          r.catalogue_notice_en,
        "comparables_report_url":       r.comparables_report_url,
        "valuation_certificate_url":    r.valuation_certificate_url,
        "estimated_capital_gain_eur":   r.estimated_capital_gain_eur,
        "tax_rate_applicable":          r.tax_rate_applicable,
        "net_proceeds_after_tax_eur":   r.net_proceeds_after_tax_eur,
        "buyer_user_id":                str(r.buyer_user_id) if r.buyer_user_id else None,
        "transaction_status":           r.transaction_status,
        "escrow_status":                r.escrow_status,
        "submitted_at":                 r.submitted_at.isoformat() if r.submitted_at else None,
        "matched_at":                   r.matched_at.isoformat() if r.matched_at else None,
        "sold_at":                      r.sold_at.isoformat() if r.sold_at else None,
        "sold_price_eur":               r.sold_price_eur,
        "commission_rate":              r.commission_rate,
        "created_at":                   r.created_at.isoformat() if r.created_at else None,
        "updated_at":                   r.updated_at.isoformat() if r.updated_at else None,
    }


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class PortfolioItemCreate(BaseModel):
    # Core identifiers — at least one required
    title: Optional[str] = None
    artist_name: Optional[str] = None
    image_url: Optional[str] = None
    # Artist resolution
    artist_id: Optional[str] = None
    artist_name_display: Optional[str] = None
    artist_match_status: Optional[str] = None
    # Acquisition
    purchase_price_eur: Optional[float] = None
    lot_id: Optional[str] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    year_created: Optional[int] = None
    purchase_date: Optional[datetime] = None
    purchase_source: Optional[str] = None
    acquisition_type: Optional[str] = None
    purchase_auction_house: Optional[str] = None
    purchase_location: Optional[str] = None
    edition: Optional[str] = None
    condition: Optional[str] = None
    provenance: Optional[str] = None
    certificate_of_authenticity: Optional[bool] = None
    authenticated_by: Optional[str] = None
    authentication_date: Optional[datetime] = None
    authentication_document_url: Optional[str] = None
    catalogue_raisonne_reference: Optional[str] = None
    image_urls: Optional[List[str]] = None
    document_urls: Optional[List[str]] = None
    insured_value_eur: Optional[float] = None
    insurance_provider: Optional[str] = None
    insurance_expiry_date: Optional[datetime] = None
    storage_location: Optional[str] = None
    beneficiary_name: Optional[str] = None
    beneficiary_contact: Optional[str] = None
    inheritance_notes: Optional[str] = None
    previous_owners: Optional[list] = None
    exhibition_history: Optional[list] = None
    literature_references: Optional[list] = None
    auction_history: Optional[list] = None
    country_of_origin: Optional[str] = None
    acquisition_tax_paid_eur: Optional[float] = None
    import_duties_eur: Optional[float] = None
    notes: Optional[str] = None
    is_for_sale: Optional[bool] = None
    asking_price_eur: Optional[float] = None

    @model_validator(mode="after")
    def at_least_one_identifier(self) -> "PortfolioItemCreate":
        if not self.title and not self.artist_name and not self.image_url:
            raise ValueError("At least one of title, artist_name, or image_url is required.")
        return self


class PortfolioItemUpdate(BaseModel):
    title: Optional[str] = None
    artist_name: Optional[str] = None
    purchase_price_eur: Optional[float] = None
    lot_id: Optional[str] = None
    artist_id: Optional[str] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    year_created: Optional[int] = None
    image_url: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_source: Optional[str] = None
    acquisition_type: Optional[str] = None
    purchase_auction_house: Optional[str] = None
    purchase_location: Optional[str] = None
    edition: Optional[str] = None
    condition: Optional[str] = None
    provenance: Optional[str] = None
    certificate_of_authenticity: Optional[bool] = None
    authenticated_by: Optional[str] = None
    authentication_date: Optional[datetime] = None
    authentication_document_url: Optional[str] = None
    catalogue_raisonne_reference: Optional[str] = None
    image_urls: Optional[list] = None
    document_urls: Optional[list] = None
    current_estimated_value_eur: Optional[float] = None
    last_estimated_at: Optional[datetime] = None
    estimation_confidence: Optional[float] = None
    sale_status: Optional[str] = None
    recommended_auction_house: Optional[str] = None
    recommended_reserve_price: Optional[float] = None
    recommended_sale_timing: Optional[str] = None
    timing_reasoning: Optional[str] = None
    insured_value_eur: Optional[float] = None
    insurance_provider: Optional[str] = None
    insurance_expiry_date: Optional[datetime] = None
    storage_location: Optional[str] = None
    last_condition_report_date: Optional[datetime] = None
    beneficiary_name: Optional[str] = None
    beneficiary_contact: Optional[str] = None
    inheritance_notes: Optional[str] = None
    previous_owners: Optional[list] = None
    exhibition_history: Optional[list] = None
    literature_references: Optional[list] = None
    auction_history: Optional[list] = None
    country_of_origin: Optional[str] = None
    acquisition_tax_paid_eur: Optional[float] = None
    import_duties_eur: Optional[float] = None
    notes: Optional[str] = None
    is_for_sale: Optional[bool] = None
    asking_price_eur: Optional[float] = None


class CollectionValuationCreate(BaseModel):
    estimated_value_eur: float
    estimation_date: datetime
    method: Optional[str] = None
    confidence: Optional[float] = None
    market_context: Optional[str] = None
    comparables_used: Optional[list] = None
    market_trend_3m: Optional[float] = None
    market_trend_12m: Optional[float] = None
    liquidity_score: Optional[float] = None
    best_time_to_sell: Optional[str] = None


class SaleRequestCreate(BaseModel):
    collection_item_id: str
    preferred_auction_house: Optional[str] = None
    reserve_price_eur: Optional[float] = None
    market_analysis: Optional[str] = None


class SaleRequestUpdate(BaseModel):
    status: Optional[str] = None
    preferred_auction_house: Optional[str] = None
    reserve_price_eur: Optional[float] = None
    nautilus_recommended_house: Optional[str] = None
    nautilus_recommended_price: Optional[float] = None
    nautilus_recommended_timing: Optional[str] = None
    comparable_lots: Optional[list] = None
    market_analysis: Optional[str] = None
    catalogue_notice_fr: Optional[str] = None
    catalogue_notice_en: Optional[str] = None
    comparables_report_url: Optional[str] = None
    valuation_certificate_url: Optional[str] = None
    estimated_capital_gain_eur: Optional[float] = None
    tax_rate_applicable: Optional[float] = None
    net_proceeds_after_tax_eur: Optional[float] = None
    transaction_status: Optional[str] = None
    escrow_status: Optional[str] = None
    submitted_at: Optional[datetime] = None
    matched_at: Optional[datetime] = None
    sold_at: Optional[datetime] = None
    sold_price_eur: Optional[float] = None
    commission_rate: Optional[float] = None


# ── Valuation schemas ─────────────────────────────────────────────────────────

class ValuateRequest(BaseModel):
    artist_id: str
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    year_created: Optional[int] = None
    item_id: Optional[str] = None   # si fourni, persiste la valorisation sur l'item
    # Contexte qualitatif pour ajustement précis
    artist_name: Optional[str] = None
    artwork_category: Optional[str] = None
    style: Optional[str] = None
    period: Optional[str] = None
    signature_detected: Optional[bool] = None
    condition: Optional[str] = None
    provenance: Optional[str] = None


class ArchiveItemBody(BaseModel):
    exit_reason: str  # sold | given | stolen | destroyed | error
    notes: Optional[str] = None


# ── Valuation endpoints ───────────────────────────────────────────────────────

@router.post("/valuate")
async def valuate_artwork(
    body: ValuateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Estime la valeur d'une œuvre à partir de ses caractéristiques.

    Peut être appelé :
    - Avant création (flow "add artwork" — estimation immédiate)
    - Sur un item existant via item_id (persiste et met à jour estimated_current_value_eur)

    Returns:
        JSON avec valuation_low, valuation_median, valuation_high,
        confidence (str), comparables_count, method, comparables (list).
        Jamais une 500 : retourne confidence='none' si aucune donnée.
    """
    # Si item_id fourni et appartient à l'utilisateur → persister la valorisation
    if body.item_id:
        result = await db.execute(
            select(PortfolioItem).where(
                and_(
                    PortfolioItem.id == body.item_id,
                    PortfolioItem.user_id == current_user.id,
                )
            )
        )
        item = result.scalar_one_or_none()
        if item:
            return await valuate_item(db, item, update_item=True)

    # Estimation à la volée sans persistance
    result = await find_comparables_and_estimate(
        db=db,
        artist_id=body.artist_id,
        medium=body.medium,
        dimensions=body.dimensions,
        year_created=body.year_created,
    )

    # Claude review avec contexte qualitatif complet
    if result.get("valuation_median"):
        result = await _claude_review_estimate(
            result=result,
            item_context={
                "artist_name":        body.artist_name,
                "medium":             body.medium,
                "dimensions":         body.dimensions,
                "year_created":       body.year_created,
                "style":              body.style,
                "period":             body.period,
                "artwork_category":   body.artwork_category,
                "signature_detected": body.signature_detected,
                "condition":          body.condition,
                "provenance":         body.provenance,
            },
        )

    return result


@router.post("/items/{item_id}/revaluate")
async def revaluate_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Revalorise un item existant de la collection.
    Met à jour estimated_current_value_eur avec les données de marché actuelles.
    """
    result = await db.execute(
        select(PortfolioItem).where(
            and_(
                PortfolioItem.id == item_id,
                PortfolioItem.user_id == current_user.id,
            )
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item introuvable.")

    return await valuate_item(db, item, update_item=True)


# ── Collection item endpoints ─────────────────────────────────────────────────

@router.get("/items")
async def list_items(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem)
        .where(PortfolioItem.user_id == current_user.id)
        .where(
            or_(
                PortfolioItem.sale_status.is_(None),
                PortfolioItem.sale_status == "active",
            )
        )
        .order_by(PortfolioItem.created_at.desc())
    )
    items = result.scalars().all()
    return [_serialize_item(item) for item in items]


@router.post("/items", status_code=201)
async def create_item(
    body: PortfolioItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await _get_user_plan(current_user, db)
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    max_items = limits.get("max_collection_items", 9999)
    if max_items < 9999:
        count_result = await db.execute(
            select(func.count(PortfolioItem.id)).where(PortfolioItem.user_id == current_user.id)
        )
        count = count_result.scalar() or 0
        if count >= max_items:
            raise HTTPException(
                status_code=403,
                detail={"code": "COLLECTION_LIMIT", "limit": max_items},
            )
    data = body.model_dump(exclude_none=True)
    item = PortfolioItem(user_id=current_user.id, **data)
    db.add(item)
    await db.commit()
    await db.refresh(item)

    # Trigger valorisation automatique si aucune valeur saisie manuellement.
    # Ce bloc ne doit JAMAIS bloquer la création de l'item — try/except obligatoire.
    if not data.get("estimated_current_value_eur"):
        try:
            await valuate_item(db, item, update_item=True)
            await db.refresh(item)
        except Exception as e:
            logger.warning(f"[collection] Auto-valuation failed for item {item.id}: {e}")

    val_result = await db.execute(
        select(CollectionValuation)
        .where(CollectionValuation.collection_item_id == item.id)
        .order_by(CollectionValuation.estimation_date.desc())
        .limit(1)
    )
    latest_valuation = val_result.scalar_one_or_none()
    return _serialize_item(item, latest_valuation)


@router.get("/items/{item_id}")
async def get_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem).where(
            and_(PortfolioItem.id == item_id, PortfolioItem.user_id == current_user.id)
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item introuvable.")

    val_result = await db.execute(
        select(CollectionValuation)
        .where(CollectionValuation.collection_item_id == item.id)
        .order_by(CollectionValuation.estimation_date.desc())
        .limit(1)
    )
    latest_valuation = val_result.scalar_one_or_none()

    return _serialize_item(item, latest_valuation)


@router.patch("/items/{item_id}")
async def update_item(
    item_id: str,
    body: PortfolioItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioItem).where(
            and_(PortfolioItem.id == item_id, PortfolioItem.user_id == current_user.id)
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item introuvable.")

    updated_fields = body.model_dump(exclude_none=True)
    for field, value in updated_fields.items():
        setattr(item, field, value)
    item.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(item)

    VALUATION_FIELDS = {"artist_id", "medium", "dimensions", "year_created"}
    if updated_fields.keys() & VALUATION_FIELDS and item.artist_id:
        try:
            await valuate_item(db, item, update_item=True)
            await db.refresh(item)
        except Exception as e:
            logger.warning(f"[collection] Re-valuation failed after PATCH on item {item.id}: {e}")

    val_result = await db.execute(
        select(CollectionValuation)
        .where(CollectionValuation.collection_item_id == item.id)
        .order_by(CollectionValuation.estimation_date.desc())
        .limit(1)
    )
    latest_valuation = val_result.scalar_one_or_none()
    return _serialize_item(item, latest_valuation)


@router.patch("/items/{item_id}/archive", status_code=200)
async def archive_item(
    item_id: UUID,
    body: ArchiveItemBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Archive une œuvre. Ne supprime JAMAIS physiquement.
    sale_status : sold | given | stolen | destroyed | error
    """
    item = await db.get(PortfolioItem, item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")

    VALID_REASONS = {"sold", "given", "stolen", "destroyed", "error"}
    if body.exit_reason not in VALID_REASONS:
        raise HTTPException(
            status_code=422,
            detail=f"exit_reason must be one of: {', '.join(VALID_REASONS)}"
        )

    item.sale_status = body.exit_reason
    if body.notes:
        existing = item.notes or ""
        separator = "\n\n" if existing else ""
        item.notes = f"{existing}{separator}[Sortie collection — {body.exit_reason}] {body.notes}"

    await db.commit()
    await db.refresh(item)
    return {"id": str(item.id), "sale_status": item.sale_status}


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(PortfolioItem, item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    item.sale_status = "error"
    await db.commit()
    return Response(status_code=204)


@router.post("/items/{item_id}/upload-photo")
async def upload_item_photo(
    item_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a photo for a collection item and store the public URL."""
    from app.config import get_settings
    settings = get_settings()

    result = await db.execute(
        select(PortfolioItem).where(
            and_(PortfolioItem.id == item_id, PortfolioItem.user_id == current_user.id)
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item introuvable.")

    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(503, "Service de stockage non configuré.")

    # Read file bytes (max 10 MB)
    contents = await file.read(10 * 1024 * 1024 + 1)
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image trop grande (max 10 Mo).")

    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(415, "Seules les images sont acceptées.")

    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    filename = f"{current_user.id}/{item_id}/{uuid_lib.uuid4().hex}.{ext}"
    bucket = "artwork-photos"

    supabase_url = settings.supabase_url.rstrip("/")
    if not supabase_url.startswith(("http://", "https://")):
        supabase_url = f"https://{supabase_url}"
    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{filename}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                upload_url,
                content=contents,
                headers={
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
            )
    except Exception as e:
        logger.error(f"[upload-photo] httpx error: {e}")
        raise HTTPException(502, "Impossible de contacter le service de stockage.")

    if resp.status_code not in (200, 201):
        logger.error(f"[upload-photo] Supabase error {resp.status_code}: {resp.text[:200]}")
        raise HTTPException(502, f"Erreur stockage ({resp.status_code}).")

    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{filename}"

    existing_urls: list = list(item.image_urls or [])
    existing_urls.append(public_url)
    item.image_urls = existing_urls
    if not item.image_url:
        item.image_url = public_url
    item.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(item)

    return {"url": public_url, "image_url": item.image_url, "image_urls": item.image_urls}


# ── Vision Engine endpoint ────────────────────────────────────────────────────

_KNOWN_EVIDENCE_TYPES = {"main", "signature", "back", "certificate"}

def _evidence_type_from_filename(filename: Optional[str]) -> str:
    """Dérive le type de preuve depuis le nom de fichier (ex: 'signature.jpg' → 'signature').
    Fallback sur 'main' si le nom est absent ou inconnu."""
    if not filename:
        return "main"
    stem = filename.rsplit(".", 1)[0].lower() if "." in filename else filename.lower()
    return stem if stem in _KNOWN_EVIDENCE_TYPES else "main"


@router.post("/vision/analyze")
async def vision_analyze(
    files: List[UploadFile] = File(...),
    current_user: User      = Depends(get_current_user),
    db: AsyncSession        = Depends(get_db),
):
    """
    Analyse une ou plusieurs images d'œuvre via Claude Vision.
    Accepte plusieurs preuves dans un seul appel.
    Le type de chaque preuve est déduit du nom de fichier :
      main.jpg → main, signature.jpg → signature, back.jpg → back, certificate.jpg → certificate.
    Ne crée pas d'item — uniquement l'analyse.
    """
    from app.config import get_settings
    settings = get_settings()

    if len(files) == 0:
        raise HTTPException(422, "Au moins un fichier est requis.")
    if len(files) > 5:
        raise HTTPException(400, "Maximum 5 fichiers par analyse.")

    if not settings.anthropic_api_key and not settings.openai_api_key:
        raise HTTPException(503, "Service de vision non configuré.")

    # Lire et valider chaque fichier — dériver le type depuis le filename
    images: list[tuple[bytes, str, str]] = []
    main_contents: Optional[bytes] = None
    main_content_type: str = "image/jpeg"

    for upload_file in files:
        evidence_type = _evidence_type_from_filename(upload_file.filename)
        contents = await upload_file.read(10 * 1024 * 1024 + 1)
        size_kb = len(contents) / 1024
        logger.info(f"[vision] file={upload_file.filename!r} evidence={evidence_type} size={size_kb:.0f}KB")
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(413, f"Image '{evidence_type}' trop grande (max 10 Mo).")
        content_type = upload_file.content_type or "image/jpeg"
        if not content_type.startswith("image/"):
            raise HTTPException(415, f"'{evidence_type}' : seules les images sont acceptées.")
        images.append((contents, content_type, evidence_type))
        if evidence_type == "main":
            main_contents = contents
            main_content_type = content_type

    # Si aucun fichier "main", prendre le premier (rétrocompatibilité)
    if main_contents is None:
        main_contents, main_content_type, _ = images[0]

    # Upload vers Supabase Storage — uniquement la photo principale
    image_url: Optional[str] = None
    if settings.supabase_url and settings.supabase_service_key:
        try:
            ext = main_content_type.split("/")[-1].replace("jpeg", "jpg")
            fname = f"vision/{current_user.id}/{uuid_lib.uuid4().hex}.{ext}"
            supabase_url = settings.supabase_url.rstrip("/")
            upload_url = f"{supabase_url}/storage/v1/object/artwork-photos/{fname}"
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    upload_url,
                    content=main_contents,
                    headers={
                        "Authorization": f"Bearer {settings.supabase_service_key}",
                        "Content-Type": main_content_type,
                        "x-upsert": "true",
                    },
                )
            if resp.status_code in (200, 201):
                image_url = f"{supabase_url}/storage/v1/object/public/artwork-photos/{fname}"
        except Exception as e:
            logger.warning(f"[vision] Storage upload skipped: {e}")

    # Analyse vision
    result = await analyze_artwork_image(
        images=images,
        anthropic_api_key=settings.anthropic_api_key,
        openai_api_key=settings.openai_api_key,
    )

    if result.error:
        raise HTTPException(502, result.error)

    # Tentative de matching artiste dans notre base — pg_trgm sur name_normalized
    artist_id: Optional[str] = None
    if result.artist:
        try:
            from app.models.db_models import Artist
            from app.engines.artist_resolver import _norm
            from sqlalchemy import func as sqlfunc
            nq = _norm(result.artist)
            sim = sqlfunc.similarity(Artist.name_normalized, nq)
            artist_q = await db.execute(
                select(Artist, sim.label("sim"))
                .where(sim > 0.20)
                .order_by(sim.desc())
                .limit(1)
            )
            row = artist_q.first()
            if row and float(row[1]) > 0.45:
                artist_id = str(row[0].id)
        except Exception as e:
            logger.warning(f"[vision] artist matching failed: {e}")

    logger.info(f"[vision] user={current_user.id} evidence_count={len(files)} artist={result.artist!r} conf={result.confidence}")

    return {
        "artist":               result.artist,
        "artist_id":            artist_id,
        "artist_confidence":    result.artist_confidence,
        "title":                result.title,
        "medium":               result.medium,
        "artwork_category":     result.artwork_category,
        "year_estimate":        result.year_estimate,
        "signature_detected":   result.signature_detected,
        "signature_position":   result.signature_position,
        "style":                result.style,
        "period":               result.period,
        "condition_apparent":   result.condition_apparent,
        "confidence":           result.confidence,
        "confidence_breakdown": result.confidence_breakdown,
        "analysis":             result.analysis,
        "image_url":            image_url,
    }


# ── Artist Resolver endpoint ───────────────────────────────────────────────────

class ResolveArtistPayload(BaseModel):
    artist:            Optional[str] = None
    artist_confidence: float         = 0.0
    style:             Optional[str] = None
    period:            Optional[str] = None
    medium:            Optional[str] = None
    analysis:          Optional[str] = None
    image_url:         Optional[str] = None


@router.post("/vision/resolve-artist")
async def vision_resolve_artist(
    payload: ResolveArtistPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Résout un artiste ambigu détecté par Vision AI.
    Interroge d'abord la DB (pg_trgm), puis Claude Sonnet (multimodal) si nécessaire.
    Retourne max 3 suggestions triées par confidence.
    """
    from app.config import get_settings
    from app.engines.artist_resolver import resolve_artist

    settings = get_settings()

    suggestions = await resolve_artist(
        artist=payload.artist,
        artist_confidence=payload.artist_confidence,
        style=payload.style,
        period=payload.period,
        medium=payload.medium,
        analysis=payload.analysis,
        image_url=payload.image_url,
        db=db,
        anthropic_api_key=settings.anthropic_api_key or "",
    )

    logger.info(
        "[resolve-artist] user=%s artist=%r suggestions=%d",
        current_user.id, payload.artist, len(suggestions),
    )

    return {"suggestions": suggestions}


# ── Valuation endpoints ───────────────────────────────────────────────────────

@router.get("/items/{item_id}/valuations")
async def list_valuations(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    item_result = await db.execute(
        select(PortfolioItem).where(
            and_(PortfolioItem.id == item_id, PortfolioItem.user_id == current_user.id)
        )
    )
    if not item_result.scalar_one_or_none():
        raise HTTPException(404, "Item introuvable.")

    result = await db.execute(
        select(CollectionValuation)
        .where(CollectionValuation.collection_item_id == item_id)
        .order_by(CollectionValuation.estimation_date.desc())
    )
    valuations = result.scalars().all()
    return [_serialize_valuation(v) for v in valuations]


@router.post("/items/{item_id}/valuations", status_code=201)
async def create_valuation(
    item_id: str,
    body: CollectionValuationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item_result = await db.execute(
        select(PortfolioItem).where(
            and_(PortfolioItem.id == item_id, PortfolioItem.user_id == current_user.id)
        )
    )
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item introuvable.")

    valuation = CollectionValuation(
        collection_item_id=item.id,
        user_id=current_user.id,
        **body.model_dump(exclude_none=True),
    )
    db.add(valuation)

    item.current_estimated_value_eur = body.estimated_value_eur
    item.last_estimated_at = body.estimation_date
    item.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(valuation)
    return _serialize_valuation(valuation)


# ── Sale request endpoints ────────────────────────────────────────────────────

@router.get("/sale-requests")
async def list_sale_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SaleRequest)
        .where(SaleRequest.user_id == current_user.id)
        .order_by(SaleRequest.created_at.desc())
    )
    requests = result.scalars().all()
    return [_serialize_sale_request(r) for r in requests]


@router.post("/sale-requests", status_code=201)
async def create_sale_request(
    body: SaleRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item_result = await db.execute(
        select(PortfolioItem).where(
            and_(
                PortfolioItem.id == body.collection_item_id,
                PortfolioItem.user_id == current_user.id,
            )
        )
    )
    if not item_result.scalar_one_or_none():
        raise HTTPException(404, "Item introuvable.")

    data = body.model_dump(exclude_none=True)
    sale_request = SaleRequest(
        user_id=current_user.id,
        status="draft",
        **data,
    )
    db.add(sale_request)
    await db.commit()
    await db.refresh(sale_request)
    return _serialize_sale_request(sale_request)


@router.get("/sale-requests/{request_id}")
async def get_sale_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SaleRequest).where(
            and_(SaleRequest.id == request_id, SaleRequest.user_id == current_user.id)
        )
    )
    sale_request = result.scalar_one_or_none()
    if not sale_request:
        raise HTTPException(404, "Demande de vente introuvable.")
    return _serialize_sale_request(sale_request)


@router.patch("/sale-requests/{request_id}")
async def update_sale_request(
    request_id: str,
    body: SaleRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SaleRequest).where(
            and_(SaleRequest.id == request_id, SaleRequest.user_id == current_user.id)
        )
    )
    sale_request = result.scalar_one_or_none()
    if not sale_request:
        raise HTTPException(404, "Demande de vente introuvable.")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(sale_request, field, value)
    sale_request.updated_at = datetime.utcnow()

    await db.commit()
    return _serialize_sale_request(sale_request)
