from pydantic import BaseModel, EmailStr, Field, validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


# ── Enums ─────────────────────────────────────────────────────────────────────

class AuctionHouseEnum(str, Enum):
    DROUOT = "drouot"
    INTERENCHERES = "interencheres"
    INVALUABLE = "invaluable"
    CHRISTIES = "christies"
    SOTHEBYS = "sothebys"
    BONHAMS = "bonhams"
    PHILLIPS = "phillips"
    ROSEBERYS = "roseberys"
    HERITAGE = "heritage"
    ARTMARKETAPI = "artmarketapi"
    LIVEAUCTIONEERS = "liveauctioneers"
    ARTSY = "artsy"
    CATAWIKI = "catawiki"
    ARTCURIAL = "artcurial"
    AUCTIONET = "auctionet"
    OTHER = "other"


class LotStatusEnum(str, Enum):
    UPCOMING = "upcoming"
    LIVE = "live"
    SOLD = "sold"
    UNSOLD = "unsold"
    WITHDRAWN = "withdrawn"


class AlertChannelEnum(str, Enum):
    TELEGRAM = "telegram"
    EMAIL = "email"
    BOTH = "both"


class TrendEnum(str, Enum):
    UP = "up"
    STABLE = "stable"
    DOWN = "down"


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    marketing_consent: bool = False
    language: str = "fr"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    is_new_user: bool = False
    is_verified: bool = True
    plan: str = "free"
    onboarding_completed: bool = False
    trial_end: Optional[datetime] = None
    trial_active: bool = False


class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime
    plan: str = "free"
    trial_end: Optional[datetime] = None
    trial_active: bool = False
    investment_budget: Optional[str] = None
    preferred_categories: Optional[List[str]] = None
    investment_horizon: Optional[str] = None

    class Config:
        from_attributes = True


# ── Artists ───────────────────────────────────────────────────────────────────

class ArtistOut(BaseModel):
    id: UUID
    name: str
    nationality: Optional[str]
    birth_year: Optional[int]
    death_year: Optional[int]
    movement: Optional[str]
    popularity_score: float
    avg_auction_price: Optional[float]
    liquidity_score: float
    trend: TrendEnum
    sell_through_rate: float
    total_lots_sold: int
    biography_fr: Optional[str] = None
    portrait_url: Optional[str] = None
    wikipedia_url: Optional[str] = None

    class Config:
        from_attributes = True


# ── Lots ──────────────────────────────────────────────────────────────────────

class LotNormalized(BaseModel):
    """Standard format from all connectors"""
    external_id: Optional[str] = None
    source: AuctionHouseEnum
    title: str
    artist_name_raw: Optional[str] = None
    description: Optional[str] = None
    lot_number: Optional[str] = None
    category: Optional[str] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    estimate_low: Optional[float] = None
    estimate_high: Optional[float] = None
    current_price: Optional[float] = None
    currency: str = "EUR"
    auction_date: Optional[datetime] = None
    auction_house_name: Optional[str] = None
    auction_sale_title: Optional[str] = None
    url: Optional[str] = None
    image_url: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    market_type: Optional[str] = "AUCTION"
    is_buy_now: Optional[bool] = False
    gallery_name: Optional[str] = None
    artist_website: Optional[str] = None


class ScoreBreakdown(BaseModel):
    below_estimate_score: float
    below_market_score: Optional[float] = None
    liquidity_score: float
    house_reputation_score: float
    confidence_score: float
    weights: Dict[str, float]
    pct_below_low_estimate: Optional[float]
    pct_below_market_avg: Optional[float]
    rationale: List[str] = []
    ai_insight: Optional[str] = None
    # Oracle signal component (Sprint C)
    oracle_score_6m: Optional[float] = None
    oracle_boost: Optional[float] = None     # points added/subtracted by oracle
    coherence_ratio: Optional[float] = None  # lot.current_price / avg_market_price; <0.05 with high score triggers warning


class LotOut(BaseModel):
    id: UUID
    external_id: Optional[str]
    source: AuctionHouseEnum
    title: str
    description: Optional[str]
    lot_number: Optional[str]
    category: Optional[str]
    medium: Optional[str]
    dimensions: Optional[str]
    artist_name_raw: Optional[str]
    artist: Optional[ArtistOut]
    estimate_low: Optional[float]
    estimate_high: Optional[float]
    current_price: Optional[float]
    currency: str
    auction_date: Optional[datetime]
    auction_house_name: Optional[str]
    auction_sale_title: Optional[str]
    status: LotStatusEnum
    deal_score: Optional[float]
    pct_below_low_estimate: Optional[float]
    pct_below_market_avg: Optional[float]
    score_breakdown: Optional[Dict[str, Any]]
    is_deal: bool
    url: Optional[str]
    image_url: Optional[str]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Computed fields extracted from score_breakdown or derived
    rationale: List[str] = []
    ai_insight: Optional[str] = None
    time_left_hours: Optional[float] = None
    fomo_level: Optional[str] = None
    score_rationale: Optional[str] = None
    confidence_score: Optional[float] = None
    estimate_low_eur: Optional[float] = None
    is_buy_now: bool = False
    market_type: Optional[str] = None

    class Config:
        from_attributes = True

    @model_validator(mode='after')
    def compute_derived_fields(self) -> 'LotOut':
        if self.score_breakdown:
            if not self.rationale:
                raw = self.score_breakdown.get('rationale', [])
                self.rationale = raw if isinstance(raw, list) else []
            if self.ai_insight is None:
                self.ai_insight = self.score_breakdown.get('ai_insight')
        if self.auction_date:
            delta = self.auction_date - datetime.utcnow()
            hours = delta.total_seconds() / 3600
            self.time_left_hours = round(max(0.0, hours), 1)
            if hours <= 24:
                self.fomo_level = 'critical'
            elif hours <= 72:
                self.fomo_level = 'high'
            elif hours <= 168:
                self.fomo_level = 'medium'
            else:
                self.fomo_level = 'low'
        _FX_TO_EUR = {
            'EUR': 1.0, 'USD': 0.92, 'GBP': 1.17,
            'SEK': 0.087, 'CHF': 1.05, 'DKK': 0.134,
            'NOK': 0.087, 'JPY': 0.006, 'HKD': 0.118,
            'AUD': 0.59, 'CAD': 0.68,
        }
        if self.estimate_low and self.currency:
            rate = _FX_TO_EUR.get(self.currency.upper(), None)
            if rate:
                self.estimate_low_eur = round(self.estimate_low * rate, 0)
        return self


class LotListResponse(BaseModel):
    items: List[LotOut]
    total: int
    page: int
    page_size: int
    pages: int


# ── Alerts ────────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: UUID
    channel: AlertChannelEnum
    recipient: str
    message: str
    deal_score_at_send: Optional[float]
    sent_at: datetime
    is_delivered: bool
    lot: Optional[LotOut]

    class Config:
        from_attributes = True


# ── Preferences ───────────────────────────────────────────────────────────────

_VALID_MARKET_TYPES = {"auction", "gallery", "both"}
_VALID_CAREER_STAGES = {"emerging", "mid_career", "established", "blue_chip"}
_VALID_STRATEGY_PRESETS = {"high_conviction", "short_term_flips", "undervalued_blue_chip", "emerging_artists"}


class PreferenceUpdate(BaseModel):
    favorite_artists: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    budget_max: Optional[float] = None
    min_deal_score: Optional[int] = Field(None, ge=0, le=100)
    alert_channel: Optional[AlertChannelEnum] = None
    telegram_chat_id: Optional[str] = None
    alert_email: Optional[str] = None
    auction_houses: Optional[List[str]] = None
    is_alerts_enabled: Optional[bool] = None
    preferred_market_type: Optional[List[str]] = None
    preferred_career_stages: Optional[List[str]] = None
    strategy_preset: Optional[str] = None

    @validator("preferred_market_type", each_item=True, pre=True)
    def validate_market_type(cls, v):
        if v not in _VALID_MARKET_TYPES:
            raise ValueError(f"preferred_market_type must be one of {_VALID_MARKET_TYPES}")
        return v

    @validator("preferred_career_stages", each_item=True, pre=True)
    def validate_career_stages(cls, v):
        if v not in _VALID_CAREER_STAGES:
            raise ValueError(f"preferred_career_stages must be one of {_VALID_CAREER_STAGES}")
        return v

    @validator("strategy_preset", pre=True)
    def validate_strategy_preset(cls, v):
        if v is not None and v not in _VALID_STRATEGY_PRESETS:
            raise ValueError(f"strategy_preset must be one of {_VALID_STRATEGY_PRESETS}")
        return v


class PreferenceOut(BaseModel):
    id: UUID
    favorite_artists: List[str]
    categories: List[str]
    budget_max: Optional[float]
    min_deal_score: int
    alert_channel: AlertChannelEnum
    telegram_chat_id: Optional[str]
    alert_email: Optional[str]
    auction_houses: List[str]
    is_alerts_enabled: bool
    preferred_market_type: Optional[List[str]] = None
    preferred_career_stages: Optional[List[str]] = None
    strategy_preset: Optional[str] = None

    class Config:
        from_attributes = True


# ── Alert Preferences ─────────────────────────────────────────────────────────

class AlertPreferencesOut(BaseModel):
    exceptional_opportunity: bool
    lot_below_market: bool
    new_auction_house: bool
    new_lot_followed_artist: bool
    artist_momentum_change: bool
    auction_closing_24h: bool
    portfolio_value_change: bool
    optimal_sell_window: bool
    weekly_brief: bool
    monthly_report: bool
    email_notifications: bool

    class Config:
        from_attributes = True


class AlertPreferencesUpdate(BaseModel):
    exceptional_opportunity: Optional[bool] = None
    lot_below_market: Optional[bool] = None
    new_auction_house: Optional[bool] = None
    new_lot_followed_artist: Optional[bool] = None
    artist_momentum_change: Optional[bool] = None
    auction_closing_24h: Optional[bool] = None
    portfolio_value_change: Optional[bool] = None
    optimal_sell_window: Optional[bool] = None
    weekly_brief: Optional[bool] = None
    monthly_report: Optional[bool] = None
    email_notifications: Optional[bool] = None


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_lots_tracked: int
    deals_detected_today: int
    avg_deal_score: float
    top_deal_score: float
    alerts_sent_today: int
    sources_active: int


class TopDeal(BaseModel):
    lot: LotOut
    rank: int
    estimated_saving_eur: Optional[float]
    estimated_saving_pct: Optional[float]


# ── Artist Cycle Intelligence (Step 4) ───────────────────────────────────────

class SegmentStats(BaseModel):
    """Statistics for one artist segment (e.g., a specific medium or auction house)."""
    sales_count: int
    sold_above_low_count: int
    n_with_estimate: int
    sold_above_low_pct: float
    median_premium_ratio: Optional[float] = None
    avg_premium_ratio: Optional[float] = None
    wilson_lower: float
    confidence_tier: str  # 'low' | 'medium' | 'high'


class ArtistCycleSummary(BaseModel):
    """Summary of an artist's best auction configuration (from artist_cycle_stats)."""
    artist_id: UUID
    computed_at: Optional[datetime] = None
    is_eligible: bool

    # Eligibility details
    total_sales: Optional[int] = None
    recent_sales_3y: Optional[int] = None
    estimate_coverage: Optional[float] = None

    # Best configuration
    best_medium: Optional[str] = None
    best_medium_wilson: Optional[float] = None
    best_size: Optional[str] = None
    best_size_wilson: Optional[float] = None
    best_house: Optional[str] = None
    best_house_wilson: Optional[float] = None
    best_month: Optional[int] = None
    best_month_wilson: Optional[float] = None
    best_season: Optional[str] = None
    best_season_wilson: Optional[float] = None

    class Config:
        from_attributes = True


class ArtistCycleDetail(ArtistCycleSummary):
    """Full cycle detail including per-segment stats (JSONB columns)."""
    medium_stats: Optional[Dict[str, Any]] = None
    size_stats: Optional[Dict[str, Any]] = None
    house_stats: Optional[Dict[str, Any]] = None
    month_stats: Optional[Dict[str, Any]] = None
    season_stats: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class CycleFitComponent(BaseModel):
    """Score contribution from one dimension (medium, house, season, size)."""
    lot_value: Optional[str] = None
    best_value: Optional[str] = None
    score: float
    segment_wilson: Optional[float] = None
    best_wilson: Optional[float] = None
    confidence_tier: Optional[str] = None
    available: bool


class CycleFitResult(BaseModel):
    """Result of a cycle fit computation for a specific lot configuration."""
    score: Optional[float] = None          # 0–100, or None if insufficient data
    components: Dict[str, Any] = {}
    confidence: float = 0.0               # 0–1
    reasons: List[str] = []
    data_quality: str = "insufficient"    # 'sufficient' | 'limited' | 'insufficient'


class CycleFitRequest(BaseModel):
    """Request body for POST /api/v1/cycle/fit."""
    artist_id: UUID
    medium: Optional[str] = None
    auction_house: Optional[str] = None
    sale_date: Optional[str] = None       # ISO date string e.g. "2026-03-15"
    dimensions_cm: Optional[Dict[str, Any]] = None  # {width_cm, height_cm}
    lang: Optional[str] = "en"           # 'en' | 'fr'


# ── Upside Prediction Engine (Step 3) ────────────────────────────────────────

class UpsideModelVersionOut(BaseModel):
    """Active upside model metadata returned by GET /api/v1/upside/model/active."""
    id: UUID
    version: str
    created_at: datetime
    is_active: bool
    artifact_path: str
    feature_list: List[str]
    metrics: Dict[str, Any]
    baseline_metrics: Optional[Dict[str, Any]] = None
    train_size: Optional[int] = None
    val_size: Optional[int] = None
    test_size: Optional[int] = None
    train_cutoff: Optional[str] = None
    val_cutoff: Optional[str] = None
    test_cutoff: Optional[str] = None
    promoted: bool
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class UpsidePredictionOut(BaseModel):
    """Upside prediction for a single lot — returned by GET /api/v1/upside/lot/{lot_id}."""
    id: UUID
    lot_id: UUID
    model_version_id: UUID
    predicted_at: datetime
    upside_prob: float
    confidence_score: Optional[float] = None
    signal_label: Optional[str] = None
    feature_snapshot: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class UpsideSignalOut(BaseModel):
    """Human-readable upside signal — returned by GET /api/v1/upside/lot/{lot_id}/signal."""
    lot_id: str
    upside_prob: Optional[float] = None         # None if no prediction available
    signal_label: Optional[str] = None          # "High upside signal" etc.
    explanation: Optional[str] = None           # 1–2 sentence explanation
    lang: str = "en"
    predicted_at: Optional[datetime] = None
    model_version: Optional[str] = None
    # Context stats extracted from feature_snapshot — power the tooltip
    house_sold_above_pct: Optional[float] = None   # 0–1, artist at this house
    house_sales_count: Optional[int] = None        # nb of artist sales at this house
    artist_sold_above_pct: Optional[float] = None  # 0–1, artist overall
    artist_total_sales: Optional[int] = None       # total artist sales in DB
    median_premium_pct: Optional[float] = None     # e.g. 18.0 means +18% above estimate
