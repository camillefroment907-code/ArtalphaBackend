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


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    is_new_user: bool = False
    plan: str = "free"


class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime
    plan: str = "free"

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
    below_market_score: float
    liquidity_score: float
    house_reputation_score: float
    confidence_score: float
    weights: Dict[str, float]
    pct_below_low_estimate: Optional[float]
    pct_below_market_avg: Optional[float]
    rationale: List[str] = []
    ai_insight: Optional[str] = None


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
    # Computed fields extracted from score_breakdown or derived
    rationale: List[str] = []
    ai_insight: Optional[str] = None
    time_left_hours: Optional[float] = None
    fomo_level: Optional[str] = None
    score_rationale: Optional[str] = None
    confidence_score: Optional[float] = None

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
