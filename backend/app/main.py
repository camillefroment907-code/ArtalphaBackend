"""
Nautilus — AI Auction Deal Finder
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
from app.api.feedback import router as feedback_router
from app.api.analytics import router as analytics_router
from app.api.emerging import router as emerging_router, emerging_artists_router
from app.api.admin_scoring import router as admin_scoring_router
from app.api.tracking import router as tracking_router
from app.api.collection import router as collection_router
from app.api.copilot import router as copilot_router
from app.api.collection_os import router as collection_os_router
from app.routers.cycle import router as cycle_router
from app.routers.upside import router as upside_router
from app.api.market_signals import router as market_signals_router

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


# Scrapers / bots known to be used for data harvesting
_BOT_UA_FRAGMENTS = [
    "python-requests", "python-httpx", "python-urllib",
    "scrapy", "aiohttp",
    "curl/", "wget/",
    "go-http-client",
    "libwww-perl",
    "java/", "apache-httpclient",
    "scraperapi", "dataforseo",
    "headlesschrome", "phantomjs",
    "okhttp",
    "postmanruntime",
]

# Paths that must never be blocked regardless of headers (OAuth redirects, etc.)
_BOT_EXEMPT_PREFIXES = (
    "/api/auth/google",
    "/app/auth/callback",
)

# Data paths that must be protected from bots (not marketing/auth/health)
_PROTECTED_PREFIXES = (
    "/api/lots",
    "/api/artist",
    "/api/v1/",
    "/api/emerging",
    "/api/collector",
    "/api/recommendations",
    "/api/market-sentiment",
    "/api/portfolio",
    "/api/collection-os",
    "/api/chat",
    "/api/agent",
)


class BotProtectionMiddleware(BaseHTTPMiddleware):
    """Block known scraper User-Agents on protected data routes."""
    async def dispatch(self, request: StarletteRequest, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in _BOT_EXEMPT_PREFIXES):
            return await call_next(request)
        if any(path.startswith(p) for p in _PROTECTED_PREFIXES):
            ua = request.headers.get("user-agent", "").lower()
            if any(frag in ua for frag in _BOT_UA_FRAGMENTS):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Automated access is not permitted."},
                )
            # Require at least one browser-style header (Accept or Accept-Language)
            has_accept = bool(request.headers.get("accept"))
            has_lang = bool(request.headers.get("accept-language"))
            if not ua or (not has_accept and not has_lang):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Automated access is not permitted."},
                )
        return await call_next(request)


# ── Rate limiter — keyed by authenticated user ID when JWT present, else IP ───
def _user_or_ip_key(request: StarletteRequest) -> str:
    """Use JWT sub as rate-limit key so VPN/proxy rotation doesn't help."""
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        try:
            from jose import jwt as _jwt
            from app.config import get_settings as _gs
            _s = _gs()
            payload = _jwt.decode(token, _s.jwt_secret, algorithms=[_s.jwt_algorithm])
            uid = payload.get("sub")
            if uid:
                return f"user:{uid}"
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_user_or_ip_key, default_limits=["60/minute"])

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        logging.DEBUG if settings.environment == "development" else logging.INFO
    )
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Nautilus API", env=settings.environment)

    # Retry DB connection up to 5 times with a hard 5-second timeout per attempt.
    # asyncpg's default TCP timeout can be 60s, which causes Railway's 300s healthcheck
    # to expire (5 retries × 60s + sleeps ≈ 618s). The timeout keeps startup under 60s.
    import asyncio
    db_ok = False
    for attempt in range(5):
        try:
            db_ok = await asyncio.wait_for(check_db_connection(), timeout=5.0)
        except asyncio.TimeoutError:
            db_ok = False
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

    logger.info("Nautilus API shutting down")


async def _run_migrations_bg():
    """Run ALTER TABLE / CREATE INDEX after startup — avoids blocking healthcheck."""
    from app.database import run_migrations
    try:
        await run_migrations()
    except Exception as e:
        pass  # already logged inside run_migrations


app = FastAPI(
    title="Nautilus — AI Auction Deal Finder",
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
app.add_middleware(BotProtectionMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://get-nautilus.com",
        "https://www.get-nautilus.com",
    ],
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
app.include_router(copilot_router,          prefix="/api")
app.include_router(blog_router,             prefix="/api")
app.include_router(feedback_router,         prefix="/api")
app.include_router(analytics_router,       prefix="/api")
app.include_router(emerging_router,         prefix="/api")
app.include_router(emerging_artists_router, prefix="/api")
app.include_router(admin_scoring_router,    prefix="/api")
app.include_router(tracking_router,         prefix="/api")
app.include_router(collection_router,       prefix="/api")
app.include_router(collection_os_router,    prefix="/api")
app.include_router(cycle_router,            prefix="/api")
app.include_router(upside_router,           prefix="/api")
app.include_router(market_signals_router,   prefix="/api")


@app.get("/")
async def root():
    return {"name": "Nautilus API", "version": "5.0.0", "docs": "/docs", "status": "operational"}


@app.get("/health")
async def health():
    from datetime import datetime
    db_ok = await check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "version": "5.0",
        "database": "ok" if db_ok else "error",
        "environment": settings.environment,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/health")
async def api_health():
    from datetime import datetime
    db_ok = await check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "version": "5.0",
        "database": "ok" if db_ok else "error",
        "environment": settings.environment,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error", path=str(request.url.path), error=str(exc))
    return JSONResponse(
        status_code=503,
        content={"detail": "Service temporarily unavailable. Please try again."},
    )
