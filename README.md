# HONO — AI Auction Deal Finder

> Intelligence at the gavel.

HONO is a production-grade SaaS platform that detects underpriced auction lots across major auction houses, enriches them with market intelligence, scores them using a proprietary algorithm, and alerts collectors in real-time.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend | Python FastAPI |
| Database | PostgreSQL (Supabase/Neon) |
| Cache/Queue | Redis + Celery |
| AI | OpenAI GPT-4o |
| Auth | Supabase Auth / JWT |
| Deploy | Vercel (FE) + Railway (BE) |

## Quick Start

```bash
# 1. Copy env
cp .env.example .env
# Fill in your keys

# 2. Start all services
docker compose up --build

# 3. Seed database
docker compose exec backend python scripts/seed.py

# 4. Frontend
cd frontend && npm install && npm run dev
```

## Architecture

```
Auction Sources → Connectors → Normalization → Enrichment → Scoring → Alerts
                                                    ↓
                                              Dashboard UI
```

## Modules

- `backend/app/connectors/` — Auction house adapters
- `backend/app/engines/` — Enrichment + scoring logic
- `backend/app/jobs/` — Celery background tasks
- `backend/app/api/` — FastAPI routes
- `frontend/app/` — Next.js pages
- `frontend/components/` — UI components
