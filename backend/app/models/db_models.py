from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date, Text,
    ForeignKey, JSON, Enum, Index, ARRAY, UniqueConstraint, text, TypeDecorator
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum
import logging

_logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


class _FaultTolerantEnum(TypeDecorator):
    """
    Maps the 'auctionhouse' PG enum column to Python AuctionHouse members.

    TypeDecorator is the correct SQLAlchemy extension point: process_result_value
    is guaranteed to be called even after dialect type adaptation, unlike Enum
    subclassing which breaks when SQLAlchemy copies the type for the PG dialect.

    asyncpg returns PG enum values as plain strings.  This decorator converts
    them to AuctionHouse members, handling both lowercase values ('artsy') and
    legacy uppercase labels ('ARTSY').

    Usage:
        source = Column(_FaultTolerantEnum(AuctionHouse, fallback=AuctionHouse.OTHER))
    """

    impl = String
    cache_ok = True

    def __init__(self, enum_class, *args, fallback=None, **kwargs):
        self._enum_class = enum_class
        self._fallback_member = fallback
        super().__init__(*args, **kwargs)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, self._enum_class):
            return value.value
        return str(value) if value is not None else None

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        ec = self._enum_class
        # 1. Direct value match ('artsy' → AuctionHouse.ARTSY)
        try:
            return ec(value)
        except (ValueError, KeyError):
            pass
        if isinstance(value, str):
            # 2. Case-insensitive value ('ARTSY' stored as label)
            try:
                return ec(value.lower())
            except (ValueError, KeyError):
                pass
            # 3. Name-based lookup ('ARTSY' → AuctionHouse['ARTSY'])
            try:
                return ec[value.upper()]
            except (KeyError, AttributeError):
                pass
        if self._fallback_member is not None:
            _logger.warning(
                "Unknown enum value %r — mapped to %r", value, self._fallback_member.value
            )
            return self._fallback_member
        return value  # pass-through as last resort


class AuctionHouse(str, enum.Enum):
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
    AUCTIONET = "auctionet"
    CATAWIKI = "catawiki"
    ARTCURIAL = "artcurial"
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
    accepted_terms_at = Column(DateTime, nullable=True)
    accepted_terms_ip = Column(String(45), nullable=True)
    accepted_terms_version = Column(String(10), nullable=True)
    marketing_consent = Column(Boolean, default=False)
    onboarding_completed = Column(Boolean, default=False, nullable=False)
    language = Column(String(2), nullable=False, server_default="fr", default="fr")
    payment_failed_at = Column(DateTime, nullable=True)
    trial_end = Column(DateTime, nullable=True)

    preferences = relationship("UserPreference", back_populates="user", uselist=False)
    alerts = relationship("Alert", back_populates="user")
    subscription = relationship("Subscription", back_populates="user", uselist=False)
    wishlist = relationship("Wishlist", back_populates="user", cascade="all, delete-orphan")

    @property
    def active_plan(self) -> "SubscriptionPlan":
        if self.subscription:
            if self.subscription.status == SubscriptionStatus.ACTIVE:
                return self.subscription.plan
            if self.subscription.status == SubscriptionStatus.TRIALING:
                if self.trial_end and self.trial_end > datetime.utcnow():
                    return self.subscription.plan
        return SubscriptionPlan.FREE

    @property
    def trial_active(self) -> bool:
        return (
            self.trial_end is not None
            and self.trial_end > datetime.utcnow()
            and self.subscription is not None
            and self.subscription.status == SubscriptionStatus.TRIALING
        )

    @property
    def plan(self) -> str:
        return self.active_plan.value.lower()


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
    preferred_market_type = Column(ARRAY(String), nullable=True)
    preferred_career_stages = Column(ARRAY(String), nullable=True)
    strategy_preset = Column(String(50), nullable=True)
    expected_return_pct = Column(Float, nullable=True)  # target annual return %
    goals = Column(Text, nullable=True)  # free text investment goals
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

    # Sprint 2 — per-artist CAGR (computed from hammer_prices)
    cagr_by_medium = Column(JSON, nullable=True)     # Sprint 2.5: per-medium breakdown
    cagr_calculated = Column(Float, nullable=True)   # capped 0–15%
    cagr_raw = Column(Float, nullable=True)           # uncapped
    cagr_confidence = Column(String(20), nullable=True)  # HIGH / MEDIUM / LOW
    cagr_source = Column(String(30), nullable=True)       # COMPUTED / TIER_FALLBACK
    cagr_n_sales = Column(Integer, nullable=True)
    cagr_window_start = Column(Date, nullable=True)
    cagr_window_end = Column(Date, nullable=True)
    cagr_computed_at = Column(DateTime, nullable=True)

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
    source = Column(_FaultTolerantEnum(AuctionHouse, fallback=AuctionHouse.OTHER), nullable=False)
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
    artist_nationality = Column(String(100), nullable=True)

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
    status = Column(_FaultTolerantEnum(LotStatus, fallback=LotStatus.UPCOMING), default=LotStatus.UPCOMING)

    # Market type — auction vs primary/gallery market
    market_type = Column(Enum(MarketType), default=MarketType.AUCTION, nullable=True)
    is_buy_now = Column(Boolean, default=False, nullable=True)
    gallery_name = Column(String(300), nullable=True)
    artist_website = Column(Text, nullable=True)
    primary_score = Column(Float, nullable=True)

    # Deal intelligence — no index=True, indexes in __table_args__
    deal_score = Column(Float, nullable=True)
    quality_tier = Column(String(1), nullable=True, index=True)
    pct_below_low_estimate = Column(Float, nullable=True)
    pct_below_market_avg = Column(Float, nullable=True)
    score_breakdown = Column(JSON, nullable=True)
    is_deal = Column(Boolean, default=False)
    enriched_at = Column(DateTime, nullable=True)
    scored_at = Column(DateTime, nullable=True)

    # Intelligence layer
    score_rationale = Column(Text, nullable=True)        # GPT-4o-mini explanation
    confidence_score = Column(Float, nullable=True)       # 0-100 data quality score

    # Content-based deduplication — hash of (title + artist + est_low + est_high).
    # Prevents the same lot appearing from multiple connectors covering the same house.
    lot_fingerprint = Column(String(64), nullable=True)

    # Meta
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=text('NOW()'))
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=text('NOW()'), onupdate=datetime.utcnow)
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
        # Content fingerprint unique index — cross-source deduplication.
        # Prevents the same lot appearing from multiple connectors.
        Index(
            "uq_lots_fingerprint",
            "lot_fingerprint",
            unique=True,
            postgresql_where=text("lot_fingerprint IS NOT NULL"),
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
    title = Column(Text, nullable=True)
    artist_name = Column(String(500), nullable=True)
    medium = Column(String(300), nullable=True)
    dimensions = Column(String(300), nullable=True)
    year_created = Column(Integer, nullable=True)
    image_url = Column(Text, nullable=True)

    # Purchase info
    purchase_price_eur = Column(Float, nullable=True)
    purchase_date = Column(DateTime, nullable=True)
    purchase_source = Column(String(300), nullable=True)
    acquisition_type = Column(String(100), nullable=True)  # purchase_gallery|purchase_auction|purchase_private|inheritance|succession|gift|donation|exchange|other

    # Valuation
    estimated_current_value_eur = Column(Float, nullable=True)
    last_valuation_at = Column(DateTime, nullable=True)

    # Artwork identity
    artist_id                   = Column(UUID(as_uuid=True), ForeignKey("artists.id", ondelete="SET NULL"), nullable=True)
    matched_lot_id              = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="SET NULL"), nullable=True)
    matched_confidence          = Column(Float, nullable=True)
    edition                     = Column(String(200), nullable=True)
    condition                   = Column(String(100), nullable=True)
    provenance                  = Column(Text, nullable=True)

    # Extended purchase info
    purchase_auction_house      = Column(String(300), nullable=True)
    purchase_location           = Column(String(300), nullable=True)

    # Authentication & documentation
    certificate_of_authenticity = Column(Boolean, default=False)
    authenticated_by            = Column(String(300), nullable=True)
    authentication_date         = Column(DateTime, nullable=True)
    authentication_document_url = Column(String(500), nullable=True)
    catalogue_raisonne_reference = Column(String(300), nullable=True)
    image_urls                  = Column(JSON, default=list)
    document_urls               = Column(JSON, default=list)

    # Valuation (extended)
    current_estimated_value_eur = Column(Float, nullable=True)
    last_estimated_at           = Column(DateTime, nullable=True)
    estimation_confidence       = Column(Float, nullable=True)

    # Sale management
    sale_status                 = Column(String(50), nullable=True)
    recommended_auction_house   = Column(String(200), nullable=True)
    recommended_reserve_price   = Column(Float, nullable=True)
    recommended_sale_timing     = Column(String(100), nullable=True)
    timing_reasoning            = Column(Text, nullable=True)

    # Insurance & storage
    insured_value_eur           = Column(Float, nullable=True)
    insurance_provider          = Column(String(200), nullable=True)
    insurance_expiry_date       = Column(DateTime, nullable=True)
    storage_location            = Column(String(300), nullable=True)
    last_condition_report_date  = Column(DateTime, nullable=True)

    # Succession
    beneficiary_name            = Column(String(200), nullable=True)
    beneficiary_contact         = Column(String(200), nullable=True)
    inheritance_notes           = Column(Text, nullable=True)

    # History & compliance
    previous_owners             = Column(JSON, default=list)
    exhibition_history          = Column(JSON, default=list)
    literature_references       = Column(JSON, default=list)
    auction_history             = Column(JSON, default=list)
    country_of_origin           = Column(String(100), nullable=True)
    acquisition_tax_paid_eur    = Column(Float, nullable=True)
    import_duties_eur           = Column(Float, nullable=True)

    # User data
    notes = Column(Text, nullable=True)
    is_for_sale = Column(Boolean, default=False)
    asking_price_eur = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Artist resolution
    artist_name_display = Column(Text, nullable=True)
    artist_match_status = Column(String(20), nullable=True, server_default="unresolved")
    match_metadata = Column(JSON, nullable=True, server_default=text("'{}'::json"))

    user = relationship("User", backref="portfolio_items")
    lot = relationship("Lot", foreign_keys=[lot_id], backref="portfolio_references")

    __table_args__ = (
        Index("ix_portfolio_user_id", "user_id"),
        Index("ix_portfolio_items_artist_match_status", "artist_match_status"),
    )


class ArtistAlias(Base):
    """Alternate names for canonical artists — powers fuzzy autocomplete."""
    __tablename__ = "artist_aliases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artist_id = Column(UUID(as_uuid=True), ForeignKey("artists.id", ondelete="CASCADE"), nullable=False)
    alias = Column(Text, nullable=False)
    alias_normalized = Column(Text, nullable=False)
    alias_type = Column(String(50), nullable=True)  # full_name/surname_only/first_initial/transliteration/pseudonym/birth_name/localized
    created_at = Column(DateTime, server_default=text("NOW()"), nullable=False)

    artist = relationship("Artist", backref="aliases")

    __table_args__ = (
        Index("ix_artist_aliases_artist_id", "artist_id"),
    )


class PortfolioItemPhoto(Base):
    """Photos attached to a portfolio item — slot for future vision pipeline."""
    __tablename__ = "portfolio_item_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_item_id = Column(UUID(as_uuid=True), ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(Text, nullable=True)
    analysis_status = Column(String(20), nullable=False, server_default="skipped")  # skipped/pending/processing/done
    vision_results = Column(JSON, nullable=True)
    suggestions_accepted = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=text("NOW()"), nullable=False)

    portfolio_item = relationship("PortfolioItem", backref="photos")

    __table_args__ = (
        Index("ix_portfolio_item_photos_item_id", "portfolio_item_id"),
    )


class PortfolioSnapshot(Base):
    """Weekly snapshot of a user's collection value — powers the Collection Timeline graph."""
    __tablename__ = "portfolio_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    snapshot_date = Column(Date, nullable=False)          # ISO date of the snapshot (weekly)
    total_value_eur = Column(Float, nullable=True)        # sum of estimated_current_value_eur
    purchase_cost_eur = Column(Float, nullable=True)      # sum of purchase_price_eur
    item_count = Column(Integer, nullable=False, default=0)
    health_score = Column(Integer, nullable=True)         # 0–100 at snapshot time
    health_breakdown = Column(JSON, nullable=True)        # {diversification, liquidity, ...}

    created_at = Column(DateTime, server_default=text("NOW()"), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "snapshot_date", name="uq_portfolio_snapshot_user_date"),
        Index("ix_portfolio_snapshots_user_date", "user_id", "snapshot_date"),
    )


class PortfolioRecommendation(Base):
    """Persisted Advisor actions — so users can track/dismiss them across sessions."""
    __tablename__ = "portfolio_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    recommendation_id = Column(String(100), nullable=False)  # e.g. "complete_documentation"
    type = Column(String(50), nullable=False)                  # DATA_QUALITY / VALUATION / RISK / MARKET_SIGNAL
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    impact = Column(String(20), nullable=True)                 # ÉLEVÉ / MOYEN / FAIBLE
    cta_label = Column(String(100), nullable=True)
    cta_url = Column(String(300), nullable=True)
    affected_items = Column(Integer, nullable=True)

    status = Column(String(20), nullable=False, default="pending")  # pending / done / dismissed
    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    dismissed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=text("NOW()"), nullable=False)

    __table_args__ = (
        Index("ix_portfolio_reco_user_status", "user_id", "status"),
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


class CopilotMemory(Base):
    """
    Episodic memory for the Copilot advisor.
    Stores inferred or stated user preferences, decisions, and interests.
    Survives across sessions. Grows over time as Nautilus learns the user.
    """
    __tablename__ = "copilot_memories"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    memory_key      = Column(String(200), nullable=False)   # e.g. "interest:sculptor", "budget:stated"
    memory_value    = Column(JSONB, nullable=False)          # structured value
    confidence      = Column(Float, default=1.0)             # 0–1, decays over time
    source          = Column(String(50), nullable=True)      # "stated" | "inferred" | "observed"
    created_at      = Column(DateTime, server_default=text("NOW()"), nullable=False)
    last_reinforced = Column(DateTime, server_default=text("NOW()"), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "memory_key", name="uq_copilot_memory_user_key"),
        Index("ix_copilot_memory_user_id", "user_id"),
        Index("ix_copilot_memory_key", "memory_key"),
    )


class CopilotConversation(Base):
    """
    Full interaction log for every Copilot touchpoint.
    Phase 2: chip clicks (role="user", no assistant response).
    Phase 3+: full message pairs with assembled context snapshot.
    Retention: 365 days.
    """
    __tablename__ = "copilot_conversations"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id       = Column(UUID(as_uuid=True), nullable=False, default=uuid.uuid4)
    role             = Column(String(20), nullable=False)    # "user" | "assistant"
    content          = Column(Text, nullable=False)
    intent           = Column(String(50), nullable=True)     # taxonomy: conviction_explain | urgency_check | …
    source_page      = Column(String(50), nullable=True)     # "today" | "lot_detail" | "market" | …
    context_snapshot = Column(JSONB, nullable=True)          # assemble_user_context() output at interaction time
    lot_id           = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="SET NULL"), nullable=True)
    artist_id        = Column(UUID(as_uuid=True), ForeignKey("artists.id", ondelete="SET NULL"), nullable=True)
    created_at       = Column(DateTime, server_default=text("NOW()"), nullable=False)

    __table_args__ = (
        Index("ix_copilot_conv_user_id", "user_id"),
        Index("ix_copilot_conv_session_id", "session_id"),
        Index("ix_copilot_conv_intent", "intent"),
        Index("ix_copilot_conv_created_at", "created_at"),
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

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id      = Column(String(500), unique=True, nullable=True, index=True)
    artist_name            = Column(String(500), index=True, nullable=False)
    artist_name_normalized = Column(String(500), nullable=True, index=True)
    artwork_title          = Column(String(1000), nullable=True)
    year_created     = Column(Integer, nullable=True)
    medium           = Column(String(300), nullable=True)
    medium_category  = Column(String(20),  nullable=True, index=True)
    dimensions       = Column(String(200), nullable=True)
    sale_date        = Column(DateTime, index=True, nullable=True)
    hammer_price     = Column(Float, nullable=True)
    currency         = Column(String(10), default="EUR")
    hammer_price_eur = Column(Float, nullable=True)   # normalized to EUR
    auction_house    = Column(String(300), index=True, nullable=True)
    estimate_low     = Column(Float, nullable=True)
    estimate_high    = Column(Float, nullable=True)
    premium_paid     = Column(Float, nullable=True)   # legacy
    premium_ratio    = Column(Float, nullable=True)   # hammer / estimate_low
    source           = Column(String(100), default="unknown")
    image_url        = Column(String(1000), nullable=True)
    lot_url          = Column(String(1000), nullable=True)
    lot_number       = Column(String(100), nullable=True)
    lot_id           = Column(UUID(as_uuid=True), ForeignKey("lots.id"), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    signed           = Column(Boolean, nullable=True)
    edition_number   = Column(Integer, nullable=True)
    edition_size     = Column(Integer, nullable=True)
    is_ea            = Column(Boolean, nullable=True)

    __table_args__ = (
        Index("ix_hammer_prices_artist_date", "artist_name", "sale_date"),
    )


class HammerArtistStats(Base):
    """Pre-aggregated hammer price stats per normalized artist (≥5 sales)."""
    __tablename__ = "hammer_artist_stats"

    artist_name_normalized = Column(String(500), primary_key=True)
    avg_eur                = Column(Float, nullable=True)
    median_eur             = Column(Float, nullable=True)
    sale_count             = Column(Integer, default=0)
    last_updated           = Column(DateTime, default=datetime.utcnow)


class HammerArtistMediumStats(Base):
    """Pre-aggregated hammer price stats per artist × medium category (≥3 sales).

    Exists alongside HammerArtistStats to enable medium-aware comparisons:
    a Warhol lithograph should be benchmarked against other Warhol prints,
    not against Warhol oil paintings sold at Christie's for $50M.
    """
    __tablename__ = "hammer_artist_medium_stats"

    artist_name_normalized = Column(String(500), primary_key=True)
    medium_category        = Column(String(50),  primary_key=True)   # print/painting/photography/drawing/sculpture/other
    avg_eur                = Column(Float, nullable=True)
    median_eur             = Column(Float, nullable=True)
    sale_count             = Column(Integer, default=0)
    last_updated           = Column(DateTime, default=datetime.utcnow)


class ScorePerformance(Base):
    """Nautilus score performance tracking — proves our edge over time."""
    __tablename__ = "score_performance"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lot_id               = Column(UUID(as_uuid=True), ForeignKey("lots.id"), nullable=False, index=True)
    nautilus_score       = Column(Float, nullable=False)   # score at time of recommendation
    predicted_upside     = Column(Float, nullable=True)
    ml_upside_prob       = Column(Float, nullable=True)    # ML model prediction (0–1); populated by generate_upside_predictions
    actual_hammer_price  = Column(Float, nullable=True)    # filled after auction
    actual_upside        = Column(Float, nullable=True)
    prediction_correct   = Column(Boolean, nullable=True)
    auction_date         = Column(DateTime, nullable=False, index=True)
    verified_at          = Column(DateTime, nullable=True)
    created_at           = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("lot_id", name="uq_score_performance_lot"),
    )


class DecisionArchive(Base):
    """
    User's private deal history — the Nautilus proprietary moat.
    Each row = one purchase decision with full context: what Nautilus said,
    what the user paid, and (later) what happened at resale.
    Feeds calibration engine + personal track record screen.
    """
    __tablename__ = "decision_archive"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lot_id           = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Nautilus context at time of purchase
    signal_score     = Column(Float, nullable=True)   # deal_score at moment of buy
    max_bid_at_time  = Column(Float, nullable=True)   # what Nautilus said not to exceed

    # Purchase details (filled on creation)
    purchase_price   = Column(Float, nullable=False)  # hammer price paid (pre-premium)
    purchase_date    = Column(DateTime, nullable=False)
    purchase_source  = Column(String(50), nullable=True)  # 'auction', 'gallery', 'private'

    # Outcome (filled later when sold)
    outcome_price    = Column(Float, nullable=True)
    outcome_date     = Column(DateTime, nullable=True)
    outcome_source   = Column(String(50), nullable=True)

    notes            = Column(Text, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_decision_archive_user_id", "user_id"),
        Index("ix_decision_archive_lot_id", "lot_id"),
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


class CollectorDNA(Base):
    """
    Per-user behavioral fingerprint powering the 20-type recommendation engine.
    Updated incrementally on every signal (view, save, dismiss, search, purchase).
    """
    __tablename__ = "collector_dna"

    id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Artist affinity (top artists the user engaged with)
    top_artists        = Column(ARRAY(String), default=list)    # artist names, ranked by engagement
    dismissed_artists  = Column(ARRAY(String), default=list)

    # Category / medium preference
    top_categories     = Column(ARRAY(String), default=list)    # e.g. ["Painting","Sculpture"]
    top_periods        = Column(ARRAY(String), default=list)    # e.g. ["Contemporary","Modern"]
    top_regions        = Column(ARRAY(String), default=list)    # e.g. ["France","USA"]

    # Price range inferred from engagement
    inferred_budget_min = Column(Float, nullable=True)
    inferred_budget_max = Column(Float, nullable=True)

    # Deal-hunting style
    avg_deal_score_viewed  = Column(Float, nullable=True)   # mean score of viewed lots
    pct_below_estimate_pref = Column(Float, nullable=True)  # preferred discount depth

    # Session behavior
    total_lots_viewed  = Column(Integer, default=0)
    total_saves        = Column(Integer, default=0)
    total_dismissals   = Column(Integer, default=0)
    total_memos        = Column(Integer, default=0)

    # Collector profile type (derived)
    collector_type     = Column(String(50), nullable=True)   # "trophy", "deal_hunter", "emerging", "blue_chip"
    investment_horizon = Column(String(20), nullable=True)   # "short", "medium", "long"
    risk_profile       = Column(String(20), nullable=True)   # "conservative", "moderate", "aggressive"

    # Raw signal store (last 200 lot IDs per action type, as JSON arrays)
    viewed_lot_ids     = Column(JSON, default=list)    # capped at 200
    saved_lot_ids      = Column(JSON, default=list)
    dismissed_lot_ids  = Column(JSON, default=list)

    # Collector profile (self-declared + inferred)
    nationality                  = Column(String(100), nullable=True)
    country_of_residence         = Column(String(100), nullable=True)
    profession                   = Column(String(200), nullable=True)
    annual_art_budget_eur        = Column(Float, nullable=True)
    total_collection_value_eur   = Column(Float, nullable=True)
    years_collecting             = Column(Integer, nullable=True)
    favorite_periods             = Column(JSON, default=list)
    favorite_movements           = Column(JSON, default=list)
    geographic_focus             = Column(JSON, default=list)
    liquidity_preference         = Column(String(50), nullable=True)
    target_return_pct            = Column(Float, nullable=True)
    tax_jurisdiction             = Column(String(100), nullable=True)
    preferred_auction_houses     = Column(JSON, default=list)
    preferred_galleries          = Column(JSON, default=list)
    profile_completeness_pct     = Column(Float, nullable=True)
    onboarding_completed_at      = Column(DateTime, nullable=True)
    last_active_at               = Column(DateTime, nullable=True)
    total_lots_viewed_all        = Column(Integer, default=0)
    avg_session_duration_s       = Column(Float, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="collector_dna")

    __table_args__ = (
        Index("ix_collector_dna_user_id", "user_id"),
    )


class RecommendationEvent(Base):
    """
    Every recommendation shown to a user — tracks impressions, reads, dismissals, and actions.
    Powers feedback loop for the recommendation engine.
    """
    __tablename__ = "recommendation_events"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lot_id      = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="SET NULL"), nullable=True)

    rec_type    = Column(String(50), nullable=False)    # one of 20 types e.g. "deal_alert", "artist_momentum"
    score       = Column(Float, nullable=True)           # recommendation confidence 0-100
    reason      = Column(Text, nullable=True)            # human-readable "why" string

    # Lifecycle
    shown_at    = Column(DateTime, default=datetime.utcnow)
    read_at     = Column(DateTime, nullable=True)
    dismissed_at = Column(DateTime, nullable=True)
    acted_at    = Column(DateTime, nullable=True)        # user clicked through / generated memo

    __table_args__ = (
        Index("ix_rec_events_user_id", "user_id"),
        Index("ix_rec_events_rec_type", "rec_type"),
        Index("ix_rec_events_shown_at", "shown_at"),
    )


class BlogPost(Base):
    """
    Nautilus blog / market intelligence articles.
    Managed via admin API or directly in the DB.
    """
    __tablename__ = "blog_posts"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug        = Column(String(300), unique=True, nullable=False)
    title       = Column(String(500), nullable=False)
    excerpt     = Column(Text, nullable=True)
    content     = Column(Text, nullable=False)            # Markdown / HTML
    cover_image = Column(Text, nullable=True)
    author      = Column(String(200), default="Nautilus Editorial")
    tags        = Column(ARRAY(String), default=list)
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime, nullable=True)
    read_time_minutes = Column(Integer, default=5)
    lang        = Column(String(2), nullable=False, server_default="fr", default="fr")
    translations = Column(JSON, nullable=True)            # {"fr": "slug-fr", "en": "slug-en"}
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_blog_slug",         "slug"),
        Index("ix_blog_published_at", "published_at"),
        Index("ix_blog_is_published", "is_published"),
    )


class WaitlistEntry(Base):
    """Pre-launch waitlist — converts to User on launch day."""
    __tablename__ = "waitlist"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email          = Column(String(255), unique=True, nullable=False)
    first_name     = Column(String(255), nullable=True)
    referral_code  = Column(String(20), unique=True, nullable=False)
    referred_by    = Column(String(20), nullable=True)   # referral_code of the referrer
    position       = Column(Integer, nullable=False)
    converted_to_user = Column(Boolean, default=False)
    joined_at      = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_waitlist_email", "email"),
        Index("ix_waitlist_referral_code", "referral_code"),
    )


class ArtistSignal(Base):
    """
    Nautilus Oracle — predictive signals for a given artist.
    One row per artist; recomputed weekly via Celery.
    """
    __tablename__ = "artist_signals"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artist_id       = Column(UUID(as_uuid=True), ForeignKey("artists.id", ondelete="CASCADE"), nullable=True)
    computed_at     = Column(DateTime, default=datetime.utcnow)

    # Market signals (from lots table)
    vol_30d         = Column(Integer, nullable=True)
    vol_90d         = Column(Integer, nullable=True)
    vol_180d        = Column(Integer, nullable=True)
    vol_growth_ratio  = Column(Float, nullable=True)   # vol_90d / vol_90d_prior
    price_median_90d  = Column(Float, nullable=True)
    price_median_180d = Column(Float, nullable=True)
    price_growth_ratio = Column(Float, nullable=True)
    unsold_rate_90d   = Column(Float, nullable=True)
    buyer_concentration = Column(Float, nullable=True)  # 1 - (unique_buyers / total_lots)

    # Institutional signals (manual/scraped)
    museum_collection = Column(Boolean, default=False)
    tier1_gallery     = Column(Boolean, default=False)
    major_fair        = Column(Boolean, default=False)
    major_prize       = Column(Boolean, default=False)

    # Media signals
    press_mentions_90d = Column(Integer, default=0)
    press_velocity     = Column(Float, default=0.0)

    # Cornering signals
    repeat_buyer_detected = Column(Boolean, default=False)
    repeat_buyer_count    = Column(Integer, default=0)
    supply_compression    = Column(Float, default=0.0)

    # Oracle output
    oracle_score_6m       = Column(Float, nullable=True)
    oracle_score_18m      = Column(Float, nullable=True)
    oracle_signal         = Column(String(20), nullable=True)   # BUY_NOW / WATCH / HOLD / AVOID
    oracle_window         = Column(String(50), nullable=True)
    oracle_target_upside  = Column(String(20), nullable=True)
    active_signals        = Column(JSON, default=list)
    oracle_narrative      = Column(Text, nullable=True)
    confidence            = Column(Float, nullable=True)

    artist = relationship("Artist", foreign_keys=[artist_id])

    __table_args__ = (
        Index("idx_artist_signals_artist_id", "artist_id"),
        Index("idx_artist_signals_computed_at", "computed_at"),
    )


class UserAlertPreferences(Base):
    __tablename__ = "user_alert_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    exceptional_opportunity = Column(Boolean, default=True)
    lot_below_market = Column(Boolean, default=True)
    new_auction_house = Column(Boolean, default=True)
    new_lot_followed_artist = Column(Boolean, default=True)
    artist_momentum_change = Column(Boolean, default=True)
    auction_closing_24h = Column(Boolean, default=True)
    portfolio_value_change = Column(Boolean, default=True)
    optimal_sell_window = Column(Boolean, default=True)
    weekly_brief = Column(Boolean, default=True)
    monthly_report = Column(Boolean, default=True)
    email_notifications = Column(Boolean, default=True)
    last_alert_sent_at  = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="alert_preferences")

    __table_args__ = (
        Index("ix_user_alert_prefs_user_id", "user_id"),
    )


class ScrapingRun(Base):
    """
    Pipeline run log — one row per connector per poll cycle.
    Powers the admin health dashboard and circuit-breaker logic.
    """
    __tablename__ = "scraping_runs"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connector        = Column(String(100), nullable=False)   # e.g. "drouot_real", "artmarketapi"
    started_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at      = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    lots_fetched     = Column(Integer, default=0)
    lots_inserted    = Column(Integer, default=0)
    lots_updated     = Column(Integer, default=0)
    status           = Column(String(20), default="running")  # "running", "success", "error"
    error_message    = Column(Text, nullable=True)

    __table_args__ = (
        Index("ix_scraping_runs_connector", "connector"),
        Index("ix_scraping_runs_started_at", "started_at"),
    )


class ArtsperArtistSnapshot(Base):
    """
    Artist market snapshot aggregated from Artsper primary market data.
    Covers 193k+ artworks across thousands of artists via Algolia.
    Refreshed weekly — each sync appends a row to price_history for trend tracking.

    This is Nautilus' primary market moat: primary price anchors, gallery
    representation depth, medium distribution, and sell-through signals that
    auction-only data cannot provide.
    """
    __tablename__ = "artsper_artist_snapshots"

    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artsper_artist_id     = Column(Integer, unique=True, nullable=False)
    artist_name           = Column(String(500), nullable=False)
    artist_name_normalized = Column(String(500), nullable=False)

    # Primary market presence
    total_works           = Column(Integer, default=0)    # all works indexed on Artsper
    works_available       = Column(Integer, default=0)    # not sold
    works_sold            = Column(Integer, default=0)    # sold / unavailable

    # Price data (EUR)
    price_min             = Column(Float, nullable=True)
    price_max             = Column(Float, nullable=True)
    price_avg             = Column(Float, nullable=True)
    price_median          = Column(Float, nullable=True)
    price_p25             = Column(Float, nullable=True)  # 25th percentile
    price_p75             = Column(Float, nullable=True)  # 75th percentile

    # Gallery representation
    gallery_count         = Column(Integer, default=0)
    gallery_names         = Column(JSON, default=list)    # ["Galerie Templon", ...]

    # Work breakdown
    categories            = Column(JSON, default=dict)    # {"Painting": 15, "Sculpture": 3}
    mediums               = Column(JSON, default=dict)    # {"oil": 8, "acrylic": 4}

    # Quality/popularity signals
    has_staff_pick        = Column(Boolean, default=False)
    is_top_seller         = Column(Boolean, default=False)

    # Artsper artist page URL
    artsper_url           = Column(String(1000), nullable=True)

    # Link to our Artist record (nullable — matched by normalized name)
    artist_id             = Column(UUID(as_uuid=True), ForeignKey("artists.id"), nullable=True)

    # Historical snapshots — appended on every sync
    # [{"date": "2026-04-25", "total_works": 10, "price_avg": 1500, "works_sold": 2}, ...]
    price_history         = Column(JSON, default=list)

    first_seen_at         = Column(DateTime, default=datetime.utcnow)
    last_synced_at        = Column(DateTime, default=datetime.utcnow)
    created_at            = Column(DateTime, default=datetime.utcnow)
    updated_at            = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_artsper_snapshots_name_normalized", "artist_name_normalized"),
        Index("ix_artsper_snapshots_artist_id", "artist_id"),
        Index("ix_artsper_snapshots_price_avg", "price_avg"),
        Index("ix_artsper_snapshots_total_works", "total_works"),
    )


class ClickEvent(Base):
    """Affiliate click tracking — one row per outbound lot click."""
    __tablename__ = "click_events"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    lot_id          = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="SET NULL"), nullable=True)
    destination_url = Column(Text, nullable=False)
    clicked_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip              = Column(String(45), nullable=True)   # IPv4 or IPv6

    __table_args__ = (
        Index("ix_click_events_lot_id",    "lot_id"),
        Index("ix_click_events_user_id",   "user_id"),
        Index("ix_click_events_clicked_at","clicked_at"),
    )


class EmergingArtist(Base):
    """Emerging artists sourced from Artsy gallery listings."""
    __tablename__ = "emerging_artists"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artist_name    = Column(String(500), nullable=False)
    nationality    = Column(String(100), nullable=True)
    birth_year     = Column(Integer, nullable=True)
    gallery_name   = Column(String(500), nullable=True)
    avg_price      = Column(Float, nullable=True)
    lot_count      = Column(Integer, default=1)
    last_seen_at   = Column(DateTime, default=datetime.utcnow)
    momentum_score = Column(Float, default=50.0)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("artist_name", name="uq_emerging_artist_name"),
        Index("ix_emerging_artists_momentum", "momentum_score"),
        Index("ix_emerging_artists_birth_year", "birth_year"),
    )


class CollectionValuation(Base):
    """AI-generated or manual valuation for a collection item."""
    __tablename__ = "collection_valuations"

    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_item_id    = Column(UUID(as_uuid=True), ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False)
    user_id               = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    estimated_value_eur   = Column(Float, nullable=False)
    estimation_date       = Column(DateTime, nullable=False)
    method                = Column(String(100), nullable=True)   # comparables/gpt/hybrid
    confidence            = Column(Float, nullable=True)         # numeric: 0.9/0.6/0.3/0.0
    comparables_used      = Column(JSON, default=list)
    comparable_lots_ids   = Column(JSON, default=list)
    market_trend_3m       = Column(Float, nullable=True)
    market_trend_12m      = Column(Float, nullable=True)
    liquidity_score       = Column(Float, nullable=True)         # 0-100
    best_time_to_sell     = Column(String(50), nullable=True)    # now/q1/q2/q3/q4/wait
    market_context        = Column(Text, nullable=True)
    # Valuation engine columns
    # value_low / value_high / comparables_count pre-existed in DB (no _eur suffix)
    # source / warning added by migration d5e6f7a8b9c0
    value_low             = Column(Float, nullable=True)         # P25 of comparable prices
    value_high            = Column(Float, nullable=True)         # P75 of comparable prices
    comparables_count     = Column(Integer, nullable=True)       # number of lots used
    source                = Column(String(200), nullable=True)   # engine version identifier
    warning               = Column(Text, nullable=True)          # user-facing caveat
    created_at            = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_collection_valuations_item_id", "collection_item_id"),
        Index("ix_collection_valuations_user_id", "user_id"),
        Index("ix_collection_valuations_date",    "estimation_date"),
    )


class CollectionLoan(Base):
    """Loan of a collection item to an institution."""
    __tablename__ = "collection_loans"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_item_id   = Column(UUID(as_uuid=True), ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False)
    user_id              = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    institution_name     = Column(String(300), nullable=False)
    exhibition_name      = Column(String(300), nullable=True)
    loan_start_date      = Column(DateTime, nullable=True)
    loan_end_date        = Column(DateTime, nullable=True)
    loan_status          = Column(String(50), default="active")  # active/returned/extended
    contact_name         = Column(String(200), nullable=True)
    contact_email        = Column(String(200), nullable=True)
    insurance_value_eur  = Column(Float, nullable=True)
    notes                = Column(Text, nullable=True)
    document_url         = Column(String(500), nullable=True)
    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_collection_loans_item_id",  "collection_item_id"),
        Index("ix_collection_loans_user_id",  "user_id"),
        Index("ix_collection_loans_status",   "loan_status"),
    )


class CollectionIntervention(Base):
    """Restoration, cleaning, or other physical intervention on a collection item."""
    __tablename__ = "collection_interventions"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_item_id   = Column(UUID(as_uuid=True), ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False)
    user_id              = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    intervention_type    = Column(String(100), nullable=False)   # restoration/cleaning/framing/authentication/expertise/photography
    intervention_date    = Column(DateTime, nullable=True)
    provider             = Column(String(300), nullable=True)
    cost_eur             = Column(Float, nullable=True)
    notes                = Column(Text, nullable=True)
    document_url         = Column(String(500), nullable=True)
    before_image_url     = Column(String(500), nullable=True)
    after_image_url      = Column(String(500), nullable=True)
    created_at           = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_collection_interventions_item_id", "collection_item_id"),
        Index("ix_collection_interventions_user_id", "user_id"),
    )


class SaleRequest(Base):
    """User request to sell a collection item via Nautilus."""
    __tablename__ = "sale_requests"

    id                             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_item_id             = Column(UUID(as_uuid=True), ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False)
    user_id                        = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status                         = Column(String(50), default="draft")    # draft/submitted/matched/negotiating/sold/cancelled
    preferred_auction_house        = Column(String(200), nullable=True)
    reserve_price_eur              = Column(Float, nullable=True)
    nautilus_recommended_house     = Column(String(200), nullable=True)
    nautilus_recommended_price     = Column(Float, nullable=True)
    nautilus_recommended_timing    = Column(String(100), nullable=True)
    comparable_lots                = Column(JSON, default=list)
    market_analysis                = Column(Text, nullable=True)
    catalogue_notice_fr            = Column(Text, nullable=True)
    catalogue_notice_en            = Column(Text, nullable=True)
    comparables_report_url         = Column(String(500), nullable=True)
    valuation_certificate_url      = Column(String(500), nullable=True)
    estimated_capital_gain_eur     = Column(Float, nullable=True)
    tax_rate_applicable            = Column(Float, nullable=True)
    net_proceeds_after_tax_eur     = Column(Float, nullable=True)
    buyer_user_id                  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    transaction_status             = Column(String(50), nullable=True)
    escrow_status                  = Column(String(50), nullable=True)
    submitted_at                   = Column(DateTime, nullable=True)
    matched_at                     = Column(DateTime, nullable=True)
    sold_at                        = Column(DateTime, nullable=True)
    sold_price_eur                 = Column(Float, nullable=True)
    commission_rate                = Column(Float, nullable=True)
    created_at                     = Column(DateTime, default=datetime.utcnow)
    updated_at                     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user  = relationship("User", foreign_keys=[user_id],       backref="sale_requests")
    buyer = relationship("User", foreign_keys=[buyer_user_id], backref="purchases")

    __table_args__ = (
        Index("ix_sale_requests_item_id",  "collection_item_id"),
        Index("ix_sale_requests_user_id",  "user_id"),
        Index("ix_sale_requests_status",   "status"),
    )


class SaleDocument(Base):
    """AI-generated document (catalogue notice, comparables report, etc.) for a sale."""
    __tablename__ = "sale_documents"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_request_id      = Column(UUID(as_uuid=True), ForeignKey("sale_requests.id", ondelete="CASCADE"), nullable=True)
    collection_item_id   = Column(UUID(as_uuid=True), ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False)
    user_id              = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    document_type        = Column(String(100), nullable=False)   # catalogue_notice/comparables_report/valuation_certificate/pitch_auction_house
    content_html         = Column(Text, nullable=True)
    content_pdf_url      = Column(String(500), nullable=True)
    generated_at         = Column(DateTime, nullable=False)
    generated_by         = Column(String(100), nullable=True)    # e.g. gpt-4o
    language             = Column(String(10), default="fr")
    created_at           = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_sale_documents_sale_request_id",    "sale_request_id"),
        Index("ix_sale_documents_collection_item_id", "collection_item_id"),
        Index("ix_sale_documents_user_id",            "user_id"),
    )


class PortfolioAlert(Base):
    """Configurable alert for collection portfolio events."""
    __tablename__ = "portfolio_alerts"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id             = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    collection_item_id  = Column(UUID(as_uuid=True), ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=True)
    alert_type          = Column(String(100), nullable=False)    # value_increase/value_decrease/best_time_to_sell/similar_lot_upcoming/artist_record_broken/insurance_expiry/loan_ending/market_peak
    threshold           = Column(Float, nullable=True)
    is_active           = Column(Boolean, default=True)
    last_triggered_at   = Column(DateTime, nullable=True)
    similar_lot_id      = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="SET NULL"), nullable=True)
    trigger_metadata    = Column(JSON, default=dict)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_portfolio_alerts_user_id",  "user_id"),
        Index("ix_portfolio_alerts_item_id",  "collection_item_id"),
        Index("ix_portfolio_alerts_type",     "alert_type"),
    )


class UserEvent(Base):
    """Granular product analytics event emitted by the frontend or backend."""
    __tablename__ = "user_events"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    session_id   = Column(String(100), nullable=True)
    event_type   = Column(String(100), nullable=False)   # view_lot/save_lot/dismiss_lot/generate_memo/view_artist/search/filter/click_cta/view_portfolio/add_artwork/request_valuation/request_sale/view_collection_item/view_sale_request/agent_alert_created/agent_alert_triggered
    entity_type  = Column(String(50), nullable=True)     # lot/artist/collection_item/sale_request
    entity_id    = Column(String(100), nullable=True)
    properties   = Column(JSON, default=dict)
    page         = Column(String(200), nullable=True)
    referrer     = Column(String(500), nullable=True)
    device       = Column(String(100), nullable=True)
    country      = Column(String(10), nullable=True)
    ip_hash      = Column(String(100), nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_user_events_user_event_date", "user_id", "event_type", "created_at"),
        Index("ix_user_events_session_id",      "session_id"),
        Index("ix_user_events_entity",          "entity_type", "entity_id"),
    )


class PlatformMetric(Base):
    """Daily platform KPI snapshot for internal dashboards."""
    __tablename__ = "platform_metrics"

    id                           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_date                = Column(DateTime, nullable=False, unique=True)
    total_users                  = Column(Integer, default=0)
    total_paying_users           = Column(Integer, default=0)
    total_collection_items       = Column(Integer, default=0)
    total_aum_eur                = Column(Float, default=0)
    total_sale_requests          = Column(Integer, default=0)
    total_valuations_generated   = Column(Integer, default=0)
    avg_collection_value_eur     = Column(Float, nullable=True)
    top_artists_held             = Column(JSON, default=dict)
    geographic_distribution      = Column(JSON, default=dict)
    total_agent_alerts           = Column(Integer, default=0)
    total_agent_emails_sent      = Column(Integer, default=0)
    created_at                   = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_platform_metrics_snapshot_date", "snapshot_date"),
    )


class EmailSentLog(Base):
    """Tracks non-transactional emails sent to users for rate-limiting purposes."""
    __tablename__ = "email_sent_log"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    email_type = Column(String, nullable=False)
    sent_at    = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_email_sent_log_user_type_sent", "user_id", "email_type", "sent_at"),
    )


class UpsideModelVersion(Base):
    """
    ML model artifact registry for the Upside Prediction Engine (Step 3).

    One row per trained model version. `is_active=True` marks the
    currently-deployed model. Never delete rows — always version.

    IMPORTANT: This table is additive-only.
    To roll back: DROP TABLE lot_upside_predictions; DROP TABLE upside_model_versions.
    """
    __tablename__ = "upside_model_versions"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version       = Column(Text, nullable=False, unique=True)   # e.g. "v1.0.0-2026-06-02"
    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=text("NOW()"))
    is_active     = Column(Boolean, nullable=False, default=False, server_default=text("FALSE"))
    artifact_path = Column(Text, nullable=False)                 # "models/upside/v1.0.0-2026-06-02.joblib"
    feature_list  = Column(JSONB, nullable=False)               # ordered list of feature names
    metrics       = Column(JSONB, nullable=False)               # roc_auc, precision_at_10, etc.
    baseline_metrics = Column(JSONB, nullable=True)             # baseline comparison
    train_size    = Column(Integer, nullable=True)
    val_size      = Column(Integer, nullable=True)
    test_size     = Column(Integer, nullable=True)
    train_cutoff  = Column(Date, nullable=True)
    val_cutoff    = Column(Date, nullable=True)
    test_cutoff   = Column(Date, nullable=True)
    promoted      = Column(Boolean, nullable=False, default=False, server_default=text("FALSE"))
    notes         = Column(Text, nullable=True)

    predictions = relationship("LotUpsidePrediction", back_populates="model_version")

    __table_args__ = (
        Index("ix_upside_model_versions_is_active", "is_active"),
        Index("ix_upside_model_versions_created_at", "created_at"),
    )


class LotUpsidePrediction(Base):
    """
    Per-lot upside prediction from the active ML model.

    One row per (lot_id, model_version_id) pair.
    Predictions are stored-only — they do NOT influence deal scores or rankings.

    IMPORTANT: This table is additive-only.
    """
    __tablename__ = "lot_upside_predictions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lot_id           = Column(UUID(as_uuid=True), ForeignKey("lots.id", ondelete="CASCADE"), nullable=False)
    model_version_id = Column(UUID(as_uuid=True), ForeignKey("upside_model_versions.id", ondelete="RESTRICT"), nullable=False)
    predicted_at     = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=text("NOW()"))
    upside_prob      = Column(Float, nullable=False)            # 0.0 to 1.0
    confidence_score = Column(Float, nullable=True)             # model calibration confidence
    signal_label     = Column(Text, nullable=True)              # "high" / "moderate" / "limited"
    feature_snapshot = Column(JSONB, nullable=True)             # features used for this prediction

    model_version = relationship("UpsideModelVersion", back_populates="predictions")
    lot = relationship("Lot", backref="upside_predictions")

    __table_args__ = (
        UniqueConstraint("lot_id", "model_version_id", name="uq_lot_upside_pred_lot_model"),
        Index("ix_lot_upside_predictions_lot_id", "lot_id"),
        Index("ix_lot_upside_predictions_model_version_id", "model_version_id"),
        Index("ix_lot_upside_predictions_upside_prob", "upside_prob"),
    )


class ArtistCycleStats(Base):
    """
    Pre-computed cycle intelligence for an eligible artist.

    One row per artist (UNIQUE constraint on artist_id).
    Computed by the CLI script compute_artist_cycle_stats.py.
    Read by the /api/v1/cycle router.

    IMPORTANT: This table is additive-only.
    To roll back: DROP TABLE artist_cycle_stats.
    """
    __tablename__ = "artist_cycle_stats"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artist_id    = Column(
        UUID(as_uuid=True),
        ForeignKey("artists.id", ondelete="CASCADE"),
        nullable=False,
    )
    computed_at  = Column(DateTime, nullable=False, server_default=text("NOW()"), default=datetime.utcnow)

    # ── Eligibility ─────────────────────────────────────────────────────────────
    is_eligible         = Column(Boolean, nullable=False, default=False)
    total_sales         = Column(Integer, nullable=True)
    recent_sales_3y     = Column(Integer, nullable=True)
    estimate_coverage   = Column(Float, nullable=True)  # 0.0–1.0

    # ── Best configuration ───────────────────────────────────────────────────────
    best_medium         = Column(Text, nullable=True)
    best_medium_wilson  = Column(Float, nullable=True)
    best_size           = Column(Text, nullable=True)
    best_size_wilson    = Column(Float, nullable=True)
    best_house          = Column(Text, nullable=True)
    best_house_wilson   = Column(Float, nullable=True)
    best_month          = Column(Integer, nullable=True)  # calendar month 1–12
    best_month_wilson   = Column(Float, nullable=True)
    best_season         = Column(Text, nullable=True)
    best_season_wilson  = Column(Float, nullable=True)

    # ── Full segment detail (JSONB for flexibility and indexing) ─────────────────
    # Each JSONB column stores { segment_value: {sales_count, sold_above_low_pct, ...} }
    medium_stats        = Column(JSONB, nullable=True)
    size_stats          = Column(JSONB, nullable=True)
    house_stats         = Column(JSONB, nullable=True)
    month_stats         = Column(JSONB, nullable=True)
    season_stats        = Column(JSONB, nullable=True)

    artist = relationship("Artist", foreign_keys=[artist_id])

    __table_args__ = (
        UniqueConstraint("artist_id", name="uq_artist_cycle_stats_artist"),
        Index("ix_artist_cycle_stats_artist_id", "artist_id"),
        Index("ix_artist_cycle_stats_eligible", "is_eligible"),
    )
