"""
HONO — AI Auction Deal Finder
FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
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

settings = get_settings()

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
    else:
        logger.error("Database connection failed after retries — exiting")
        raise RuntimeError("Cannot connect to database")

    await create_tables()
    logger.info("Database ready")

    # Start Celery beat scheduler in background thread
    # (single-process deployment: beat runs embedded alongside the API)
    try:
        from app.jobs.startup_beat import start_beat_in_background
        start_beat_in_background()
        logger.info("Celery beat scheduler started")
    except Exception as e:
        logger.warning("Celery beat failed to start — tasks must be triggered manually", error=str(e))

    yield

    logger.info("HONO API shutting down")


app = FastAPI(
    title="HONO — AI Auction Deal Finder",
    description="Detect underpriced auction lots across major platforms",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow frontend on 3000
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
