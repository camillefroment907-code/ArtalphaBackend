from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, JSON, Enum, Index, ARRAY, UniqueConstraint, text
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum


class Base(DeclarativeBase):
    pass


class AuctionHouse(str, enum.Enum):
    DROUOT = "drouot"
    INTERENCHERES = "interencheres"
    INVALUABLE = "invaluable"
    CHRISTIES = "christies"
    SOTHEBYS = "sothebys"
    BONHAMS = "bonhams"
    OTHER = "other"


class LotStatus(str, enum.Enum):
    UPCOMING = "upcoming"
    LIVE = "live"
    SOLD = "sold"
    UNSOLD = "unsold"
    WITHDRAWN = "withdrawn"


class MarketType(str, enum.Enum):
    AUCTION = "AUCTION"
    PRIMARY = "PRIMARY"
    GALLERY = "GALLERY"


class AlertChannel(str, enum.Enum):
    TELEGRAM = "telegram"
    EMAIL = "email"
    BOTH = "both"


class SubscriptionPlan(str, enum.Enum):
    FREE = "FREE"
    STARTER = "STARTER"
    INVESTOR = "INVESTOR"
    PRO = "PRO"
    INSTITUTIONAL = "INSTITUTIONAL"
    ELITE = "ELITE"    # legacy → maps to institutional
    EXPERT = "EXPERT"  # legacy → maps to institutional


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CANCELED = "CANCELED"
    PAST_DUE = "PAST_DUE"
    TRIALING = "TRIALING"


class TrendDirection(str, enum.Enum):
    UP = "up"
    STABLE = "stable"
    DOWN = "down"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # unique=True already creates an implicit index — no index=True, no explicit Index()
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    preferences = relationship("UserPreference", back_populates="user", uselist=False)
    alerts = relationship("Alert", back_populates="user")
    subscription = relationship("Subscription", back_populates="user", uselist=False)
    wishlist = relationship("Wishlist", back_populates="user", cascade="all, delete-orphan")

    @property
    def active_plan(self) -> "SubscriptionPlan":
        if self.subscription and self.subscription.status == SubscriptionStatus.ACTIVE:
            return self.subscription.plan
        return SubscriptionPlan.FREE


class UserPreference(Base):
    __tablename__ = "preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # unique=True creates implicit index — no extra index needed
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    favorite_artists = Column(ARRAY(String), default=list)
    categories = Column(ARRAY(String), default=list)
    budget_max = Column(Float, nullable=True)
    min_deal_score = Column(Integer, default=75)
    alert_channel = Column(Enum(AlertChannel), default=AlertChannel.EMAIL)
    telegram_chat_id = Column(String(100), nullable=True)
    alert_email = Column(String(255), nullable=True)
    auction_houses = Column(ARRAY(String), default=list)
    is_alerts_enabled = Column(Boolean, default=True)
    language = Column(String(10), default="fr")  # "fr" or "en"
    notify_sms = Column(Boolean, default=False)
    collector_type = Column(String(50), nullable=True)
    investment_horizon = Column(String(50), nullable=True)
    min_lot_budget_eur = Column(Float, nullable=True)
    max_lot_budget_eur = Column(Float, nullable=True)
    preferred_periods = Column(ARRAY(String), default=list)
    preferred_regions = Column(ARRAY(String), default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="preferences")


class Artist(Base):
    __tablename__ = "artists"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(500), nullable=False)
    # Single index declaration via __table_args__ only — no index=True on column
    name_normalized = Column(String(500), nullable=False)
    nationality = Column(String(100), nullable=True)
    birth_year = Column(Integer, nullable=True)
    death_year = Column(Integer, nullable=True)
    movement = Column(String(200), nullable=True)
    medium = Column(String(200), nullable=True)

    # Market data
    popularity_score = Column(Float, default=50.0)
    avg_auction_price = Column(Float, nullable=True)
    median_auction_price = Column(Float, nullable=True)
    price_volatility = Column(Float, default=0.3)
    liquidity_score = Column(Float, default=50.0)
    trend = Column(Enum(TrendDirection), default=TrendDirection.STABLE)
    total_lots_sold = Column(Integer, default=0)
    sell_through_rate = Column(Float, default=0.7)

    # Meta
    last_enriched_at = Column(DateTime, nullable=True)
    data_confidence = Column(Float, default=0.5)
    external_ids = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lots = relationship("Lot", back_populates="artist")

    __table_args__ = (
        Index("ix_artists_name", "name"),
        Index("ix_artists_name_normalized", "name_normalized"),
    )


class Lot(Base):
    __tablename__ = "lots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(String(500), nullable=True)
    source = Column(Enum(AuctionHouse), nullable=False)
    url = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)

    # Lot metadata
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    lot_number = Column(String(50), nullable=True)
    category = Column(String(200), nullable=True)
    medium = Column(String(300), nullable=True)
    dimensions = Column(String(300), nullable=True)
    period = Column(String(200), nullable=True)
    provenance = Column(Text, nullable=True)
    condition = Column(String(200), nullable=True)

    # Artist — no index=True here, index declared below
    artist_id = Column(UUID(as_uuid=True), ForeignKey("artists.id"), nullable=True)
    artist_name_raw = Column(String(500), nullable=True)

    # Pricing
    estimate_low = Column(Float, nullable=True)
    estimate_high = Column(Float, nullable=True)
    current_price = Column(Float, nullable=True)
    hammer_price = Column(Float, nullable=True)
    currency = Column(String(10), default="EUR")

    # Auction timing — no index=True, all indexes in __table_args__
    auction_date = Column(DateTime, nullable=True)
    auction_house_name = Column(String(300), nullable=True)
    auction_sale_title = Column(String(500), nullable=True)
    status = Column(Enum(LotStatus), default=LotStatus.UPCOMING)

    # Market type — auction vs primary/gallery market
    market_type = Column(Enum(MarketType), default=MarketType.AUCTION, nullable=True)
    is_buy_now = Column(Boolean, default=False, nullable=True)
    gallery_name = Column(String(300), nullable=True)
    artist_website = Column(Text, nullable=True)
    primary_score = Column(Float, nullable=True)

    # Deal intelligence — no index=True, indexes in __table_args__
    deal_score = Column(Float, nullable=True)
    pct_below_low_estimate = Column(Float, nullable=True)
    pct_below_market_avg = Column(Float, nullable=True)
    score_breakdown = Column(JSON, nullable=True)
    is_deal = Column(Boolean, default=False)
    enriched_at = Column(DateTime, nullable=True)
    scored_at = Column(DateTime, nullable=True)

    # Intelligence layer
    score_rationale = Column(Text, nullable=True)        # GPT-4o-mini explanation
    confidence_score = Column(Float, nullable=True)       # 0-100 data quality score

    # Meta
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    raw_data = Column(JSON, nullable=True)

    artist = relationship("Artist", back_populates="lots")
    alerts = relationship("Alert", back_populates="lot")

    __table_args__ = (
        Index("ix_lots_artist_id", "artist_id"),
        Index("ix_lots_auction_date", "auction_date"),
        Index("ix_lots_status", "status"),
        Index("ix_lots_deal_score", "deal_score"),
        Index("ix_lots_is_deal", "is_deal"),
        Index("ix_lots_created_at", "created_at"),
        Index("ix_lots_market_type", "market_type"),
        Index("ix_lots_confidence_score", "confidence_score"),
        # Partial unique index — prevents duplicate (source, external_id) pairs.
        # WHERE external_id IS NOT NULL: lots ingested without an id are still allowed.
        Index(
            "uq_lots_source_external",
            "source", "external_id",
            unique=True,
            postgresql_where=text("external_id IS NOT NULL"),
        ),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # No index=True — index declared in __table_args__
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    lot_id = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="SET NULL"), nullable=True)

    channel = Column(Enum(AlertChannel), nullable=False)
    recipient = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    deal_score_at_send = Column(Float, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    is_delivered = Column(Boolean, default=False)
    delivery_error = Column(Text, nullable=True)

    user = relationship("User", back_populates="alerts")
    lot = relationship("Lot", back_populates="alerts")

    __table_args__ = (
        Index("ix_alerts_user_id", "user_id"),
        Index("ix_alerts_user_sent", "user_id", "sent_at"),
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    plan = Column(Enum(SubscriptionPlan), default=SubscriptionPlan.FREE, nullable=False)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE, nullable=False)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    stripe_price_id = Column(String(255), nullable=True)
    billing_interval = Column(String(20), default="monthly", nullable=True)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="subscription")

    __table_args__ = (
        Index("ix_subscriptions_user_id", "user_id"),
        Index("ix_subscriptions_stripe_customer", "stripe_customer_id"),
    )


class Wishlist(Base):
    __tablename__ = "wishlist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lot_id = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="CASCADE"), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="wishlist")
    lot = relationship("Lot")

    __table_args__ = (
        UniqueConstraint("user_id", "lot_id", name="uq_wishlist_user_lot"),
        Index("ix_wishlist_user_id", "user_id"),
    )


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lot_id = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="SET NULL"), nullable=True)

    # Artwork info
    title = Column(Text, nullable=False)
    artist_name = Column(String(500), nullable=True)
    medium = Column(String(300), nullable=True)
    dimensions = Column(String(300), nullable=True)
    year_created = Column(Integer, nullable=True)
    image_url = Column(Text, nullable=True)

    # Purchase info
    purchase_price_eur = Column(Float, nullable=False)
    purchase_date = Column(DateTime, nullable=True)
    purchase_source = Column(String(300), nullable=True)

    # Valuation
    estimated_current_value_eur = Column(Float, nullable=True)
    last_valuation_at = Column(DateTime, nullable=True)

    # User data
    notes = Column(Text, nullable=True)
    is_for_sale = Column(Boolean, default=False)
    asking_price_eur = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="portfolio_items")
    lot = relationship("Lot", backref="portfolio_references")

    __table_args__ = (
        Index("ix_portfolio_user_id", "user_id"),
    )


class ScoringModel(Base):
    """Tracks scoring model versions for ML future-proofing."""
    __tablename__ = "scoring_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version = Column(String(50), nullable=False)
    weights = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=False)
    mae = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AgentAlert(Base):
    """One targeted AI alert per user. Users can have multiple. Like a saved search with AI."""
    __tablename__ = "agent_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    is_active = Column(Boolean, default=True)
    name = Column(String(200), nullable=False)  # User-defined label e.g. "Picasso < €50K"

    # Targeting criteria
    artist_name = Column(String(200), nullable=True)       # exact or partial match
    category = Column(String(100), nullable=True)          # e.g. "Joaillerie"
    subcategory = Column(String(100), nullable=True)       # e.g. "Bague"
    keywords = Column(ARRAY(String), default=list)         # additional title keywords
    budget_min_eur = Column(Float, nullable=True)
    budget_max_eur = Column(Float, nullable=True)
    investment_horizon = Column(String(20), nullable=True)  # short/medium/long
    risk_tolerance = Column(String(20), default="medium")
    min_conviction_score = Column(Integer, default=65)
    notify_email = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="agent_alerts")
    recommendations = relationship("AgentRecommendation", back_populates="alert", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_agent_alerts_user_id", "user_id"),
    )


class AgentRecommendation(Base):
    """GPT-4o recommendation for a specific alert × lot pair."""
    __tablename__ = "agent_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    alert_id = Column(UUID(as_uuid=True), ForeignKey("agent_alerts.id", ondelete="CASCADE"))
    lot_id = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="SET NULL"), nullable=True)

    verdict = Column(String(20), nullable=False)        # STRONG_BUY/BUY/WATCH/PASS
    conviction_score = Column(Integer, nullable=False)
    reasoning = Column(Text, nullable=False)
    bull_case = Column(Text, nullable=True)
    bear_case = Column(Text, nullable=True)
    suggested_max_price_eur = Column(Float, nullable=True)
    estimated_return_pct = Column(Float, nullable=True)
    hold_period_months = Column(Integer, nullable=True)

    is_read = Column(Boolean, default=False)
    is_acted_on = Column(Boolean, default=False)
    notified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="agent_recommendations")
    lot = relationship("Lot", backref="agent_recommendations")
    alert = relationship("AgentAlert", back_populates="recommendations")

    __table_args__ = (
        Index("ix_agent_recs_user_id", "user_id"),
        Index("ix_agent_recs_created_at", "created_at"),
        UniqueConstraint("alert_id", "lot_id", name="uq_agent_rec_alert_lot"),
    )


class ChatMessage(Base):
    """Larry chat history — kept 30 days then purged by daily_cleanup."""
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    role = Column(String(20), nullable=False)   # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="chat_messages")

    __table_args__ = (
        Index("ix_chat_messages_user_id", "user_id"),
        Index("ix_chat_messages_created_at", "created_at"),
    )


class GalleryTier(Base):
    """
    Gallery credibility score derived from Artsy data.
    Updated weekly. Used to enrich lot scoring.
    """
    __tablename__ = "gallery_tiers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artsy_id = Column(String(200), unique=True, nullable=False)
    name = Column(String(500), nullable=False)
    tier = Column(Integer, default=3)  # 1=top, 2=mid, 3=emerging
    followers = Column(Integer, default=0)
    location_count = Column(Integer, default=1)
    fair_count = Column(Integer, default=0)  # art fairs participated
    artsy_url = Column(Text, nullable=True)
    raw_data = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_gallery_tiers_tier", "tier"),
    )


class ArtistProfile(Base):
    """
    Enriched artist profile from Artsy.
    Core intelligence layer for Nautilus investment decisions.
    """
    __tablename__ = "artist_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artsy_id = Column(String(200), unique=True, nullable=True)
    name = Column(String(500), nullable=False)
    nationality = Column(String(100), nullable=True)
    birth_year = Column(Integer, nullable=True)
    death_year = Column(Integer, nullable=True)
    biography = Column(Text, nullable=True)

    # Market signals
    gallery_tier_avg = Column(Float, nullable=True)  # avg tier of representing galleries
    gallery_count = Column(Integer, default=0)
    top_gallery_name = Column(String(300), nullable=True)
    public_collections_count = Column(Integer, default=0)  # MoMA, Tate, etc.
    shows_last_12m = Column(Integer, default=0)
    shows_prev_12m = Column(Integer, default=0)

    # Computed scores
    momentum_score = Column(Float, nullable=True)        # 0-100
    liquidity_score = Column(Float, nullable=True)       # 0-100
    institutional_score = Column(Float, nullable=True)   # 0-100
    is_pre_auction = Column(Boolean, default=False)      # in gallery but not yet at auction
    investment_tier = Column(String(20), nullable=True)  # "blue_chip", "mid_career", "emerging"

    # Meta
    artsy_url = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_artist_profiles_name", "name"),
        Index("ix_artist_profiles_momentum", "momentum_score"),
        Index("ix_artist_profiles_investment_tier", "investment_tier"),
    )


# ── Proprietary data accumulation ────────────────────────────────────────────

class HammerPrice(Base):
    """Historical hammer prices — scarce data, huge moat."""
    __tablename__ = "hammer_prices"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artist_name   = Column(String(500), index=True, nullable=False)
    artwork_title = Column(String(1000), nullable=True)
    year_created  = Column(Integer, nullable=True)
    medium        = Column(String(300), nullable=True)
    dimensions    = Column(String(200), nullable=True)
    sale_date     = Column(DateTime, index=True, nullable=False)
    hammer_price  = Column(Float, nullable=False)
    currency      = Column(String(10), default="EUR")
    auction_house = Column(String(300), index=True, nullable=True)
    estimate_low  = Column(Float, nullable=True)
    estimate_high = Column(Float, nullable=True)
    premium_paid  = Column(Float, nullable=True)   # hammer / estimate_low ratio
    lot_id        = Column(UUID(as_uuid=True), ForeignKey("lots.id"), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_hammer_prices_artist_date", "artist_name", "sale_date"),
    )


class ScorePerformance(Base):
    """Nautilus score performance tracking — proves our edge over time."""
    __tablename__ = "score_performance"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lot_id               = Column(UUID(as_uuid=True), ForeignKey("lots.id"), nullable=False, index=True)
    nautilus_score       = Column(Float, nullable=False)   # score at time of recommendation
    predicted_upside     = Column(Float, nullable=True)
    actual_hammer_price  = Column(Float, nullable=True)    # filled after auction
    actual_upside        = Column(Float, nullable=True)
    prediction_correct   = Column(Boolean, nullable=True)
    auction_date         = Column(DateTime, nullable=False, index=True)
    verified_at          = Column(DateTime, nullable=True)
    created_at           = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("lot_id", name="uq_score_performance_lot"),
    )


class ArtistMarketData(Base):
    """Artist market trajectory — proprietary momentum data by quarter."""
    __tablename__ = "artist_market_data"

    id                     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artist_name            = Column(String(500), index=True, nullable=False)
    period                 = Column(String(20), nullable=False)   # e.g. "2024-Q1"
    total_lots             = Column(Integer, default=0)
    total_hammer_value     = Column(Float, default=0.0)
    avg_premium            = Column(Float, nullable=True)          # avg hammer/estimate ratio
    sell_through_rate      = Column(Float, nullable=True)          # % lots that sold
    price_index            = Column(Float, nullable=True)          # normalized price index
    nautilus_momentum_score = Column(Float, nullable=True)
    created_at             = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("artist_name", "period", name="uq_artist_market_data_period"),
        Index("ix_artist_market_data_artist", "artist_name"),
        Index("ix_artist_market_data_period", "period"),
    )


class UserSignal(Base):
    """User behavior signals — personalization moat."""
    __tablename__ = "user_signals"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)
    lot_id           = Column(UUID(as_uuid=True), ForeignKey("lots.id"), nullable=True)
    signal_type      = Column(String(50), nullable=False)   # "view", "watchlist", "memo_generated", "purchased"
    duration_seconds = Column(Integer, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_user_signals_user_type", "user_id", "signal_type"),
        Index("ix_user_signals_lot", "lot_id"),
    )
