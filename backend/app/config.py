from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    app_name: str = "ArtAlpha"
    environment: str = "development"
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/hono"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # Auth
    jwt_secret: str = "change-me-in-production-set-a-secure-key"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    @field_validator('jwt_secret')
    @classmethod
    def jwt_secret_must_be_strong(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError('JWT_SECRET must be at least 32 characters — set a strong secret in environment variables')
        return v

    # Supabase (optional)
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_key: Optional[str] = None

    # External auction APIs
    liveauctioneers_api_key: Optional[str] = None
    artsy_api_key: Optional[str] = None  # optional, public API works without
    apify_api_token: Optional[str] = None       # APIFY_API_TOKEN — cloud scraping proxy
    apify_actor_id: str = "jupri/liveauctioneers-scraper"  # APIFY_ACTOR_ID

    # AI
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o"

    # Alerts
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    # Resend (replaces SendGrid)
    resend_api_key: Optional[str] = None           # RESEND_API_KEY
    transac_from_email: str = "hello@get-nautilus.com"     # TRANSAC_FROM_EMAIL
    alert_from_email: str = "insights@get-nautilus.com"    # ALERT_FROM_EMAIL

    # Stripe
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    # Price IDs — field names must match Railway var names lowercased
    # STRIPE_PRICE_COLLECTOR_MONTHLY → stripe_price_collector_monthly
    stripe_price_collector_monthly: str = ""
    stripe_price_collector_annual: str = ""
    stripe_price_investor_monthly: str = ""
    stripe_price_investor_annual: str = ""
    stripe_price_pro_monthly: str = ""
    stripe_price_pro_annual: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # n8n integration
    n8n_api_key: Optional[str] = None

    # Admin
    admin_emails: str = "demo@artalpha.io"

    # Business Logic
    deal_score_threshold: int = 60
    poll_interval_minutes: int = 15

    # Scoring weights (must sum to 1.0)
    weight_below_estimate: float = 0.30
    weight_below_market: float = 0.30
    weight_artist_liquidity: float = 0.20
    weight_house_reputation: float = 0.10
    weight_confidence: float = 0.10

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
