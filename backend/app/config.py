from pydantic_settings import BaseSettings
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
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    # Supabase (optional)
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_key: Optional[str] = None

    # External auction APIs
    liveauctioneers_api_key: Optional[str] = None
    artsy_api_key: Optional[str] = None  # optional, public API works without

    # AI
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o"

    # Alerts
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    # Resend (replaces SendGrid)
    resend_api_key: Optional[str] = None           # RESEND_API_KEY
    transac_from_email: str = "hello@artalpha.io"  # TRANSAC_FROM_EMAIL
    alert_from_email: str = "alerts@artalpha.io"   # ALERT_FROM_EMAIL

    # Stripe
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    # Legacy (kept for migration)
    stripe_price_pro: Optional[str] = None
    stripe_price_expert: Optional[str] = None
    # Price IDs
    stripe_price_starter_monthly: Optional[str] = None
    stripe_price_starter_yearly: Optional[str] = None
    stripe_price_investor_monthly: Optional[str] = None
    stripe_price_investor_yearly: Optional[str] = None
    stripe_price_pro_monthly: Optional[str] = None
    stripe_price_pro_yearly: Optional[str] = None
    stripe_price_elite_monthly: Optional[str] = None
    stripe_price_elite_yearly: Optional[str] = None
    # Legacy
    stripe_price_expert_monthly: Optional[str] = None
    stripe_price_expert_yearly: Optional[str] = None

    # n8n integration
    n8n_api_key: Optional[str] = None

    # Admin
    admin_emails: str = "demo@artalpha.io"

    # Business Logic
    deal_score_threshold: int = 75
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
