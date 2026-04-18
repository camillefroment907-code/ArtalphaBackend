"""
HONO — AI Auction Deal Finder
FastAPI Application
"""
from contextlib import asynccontextmanager
import re
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import structlog
import logging

from app.config import get_settings
from app.database import create_tables, check_db_connection
from app.api.auth import router as auth_router
from app.api.lots import router as lots_router
from app.api.alerts_prefs import alerts_router, prefs_router
from app.api.artists_external import artists_router, external_router
from app.api.artists import router as artist_profiles_router
from app.api.billing import router as billing_router
from app.api.wishlist import router as wishlist_router
from app.api.admin import router as admin_router
from app.api.portfolio import router as portfolio_router
from app.api.profile import router as profile_router
from app.api.n8n import router as n8n_router
from app.api.agent import router as agent_router
from app.api.chat import router as chat_router
from app.api.memo import router as memo_router
from app.api.larry_proactive import router as larry_proactive_router
from app.api.portfolio_ai import router as portfolio_ai_router
from app.api.market_sentiment import router as market_sentiment_router
from app.api.contact import router as contact_router
from app.api.waitlist import router as waitlist_router
from app.api.collector import router as collector_router
from app.api.recommendations import router as recommendations_router
from app.api.blog import router as blog_router

settings = get_settings()


def sanitize_log(data: str) -> str:
    """Mask emails and tokens in logs."""
    data = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '***@***.***', data)
    data = re.sub(r'eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+', '[JWT_REDACTED]', data)
    data = re.sub(r'sk_(live|test)_[a-zA-Z0-9]+', '[STRIPE_KEY_REDACTED]', data)
    return data


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


# ── Rate limiter (in-memory; swap storage= to Redis in prod if desired) ────────
limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.DEBUG if settings.environment == "development" else logging.INFO
    )
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting HONO API", env=settings.environment)

    # Retry DB connection up to 10 times (Docker startup race)
    import asyncio
    for attempt in range(10):
        db_ok = await check_db_connection()
        if db_ok:
            break
        logger.warning("DB not ready, retrying...", attempt=attempt + 1)
        await asyncio.sleep(2)

    if db_ok:
        try:
            await create_tables()   # fast: create_all only
            logger.info("Database ready")
        except Exception as e:
            logger.error("create_tables failed — continuing anyway", error=str(e))
    else:
        logger.error("Database connection failed after retries — starting in degraded mode")

    # Start Celery beat scheduler in background thread
    try:
        from app.jobs.startup_beat import start_beat_in_background
        start_beat_in_background()
        logger.info("Celery beat scheduler started")
    except Exception as e:
        logger.warning("Celery beat failed to start — tasks must be triggered manually", error=str(e))

    # Yield immediately so Railway healthcheck can reach /health
    # Slow migrations (ALTER TABLE / CREATE INDEX) run in background
    if db_ok:
        import asyncio
        asyncio.create_task(_run_migrations_bg())

    yield

    logger.info("HONO API shutting down")


async def _run_migrations_bg():
    """Run ALTER TABLE / CREATE INDEX after startup — avoids blocking healthcheck."""
    from app.database import run_migrations
    try:
        await run_migrations()
    except Exception as e:
        pass  # already logged inside run_migrations


app = FastAPI(
    title="HONO — AI Auction Deal Finder",
    description="Detect underpriced auction lots across major platforms",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Rate limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS — allow frontend on 3000 ─────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "https://artalpha-figma.vercel.app",
        "https://nautilus-app.vercel.app",
        "https://get-nautilus.com",
        "https://www.get-nautilus.com",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth_router,    prefix="/api")
app.include_router(lots_router,    prefix="/api")
app.include_router(alerts_router,  prefix="/api")
app.include_router(prefs_router,   prefix="/api")
app.include_router(artists_router, prefix="/api")
app.include_router(external_router, prefix="/api")
app.include_router(billing_router, prefix="/api")
app.include_router(wishlist_router, prefix="/api")
app.include_router(admin_router,   prefix="/api")
app.include_router(portfolio_router, prefix="/api")
app.include_router(profile_router,  prefix="/api")
app.include_router(n8n_router,      prefix="/api")
app.include_router(agent_router,    prefix="/api")
app.include_router(chat_router,           prefix="/api")
app.include_router(artist_profiles_router, prefix="/api")
app.include_router(memo_router,            prefix="/api")
app.include_router(larry_proactive_router, prefix="/api")
app.include_router(portfolio_ai_router,    prefix="/api")
app.include_router(market_sentiment_router, prefix="/api")
app.include_router(contact_router,          prefix="/api")
app.include_router(waitlist_router,         prefix="/api")
app.include_router(collector_router,        prefix="/api")
app.include_router(recommendations_router,  prefix="/api")
app.include_router(blog_router,             prefix="/api")


@app.get("/")
async def root():
    return {"name": "HONO API", "version": "1.1.0", "docs": "/docs", "status": "operational"}


@app.get("/health")
async def health():
    db_ok = await check_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "ok" if db_ok else "error",
        "environment": settings.environment,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error", path=str(request.url.path), error=str(exc))
    return JSONResponse(
        status_code=503,
        content={"detail": "Service temporarily unavailable. Please try again."},
    )
