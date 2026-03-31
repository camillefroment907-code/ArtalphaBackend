.PHONY: help up down build seed logs shell-backend shell-db migrate test lint

# ─────────────────────────────────────────────────────────────────────────────
# HONO — Developer Makefile
# Usage: make <command>
# ─────────────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "  HONO — AI Auction Deal Finder"
	@echo "  ─────────────────────────────"
	@echo "  make up          Start all services (Docker)"
	@echo "  make down        Stop all services"
	@echo "  make build       Rebuild images"
	@echo "  make seed        Seed database with demo data"
	@echo "  make migrate     Run Alembic migrations"
	@echo "  make logs        Follow all service logs"
	@echo "  make logs-api    Follow backend API logs"
	@echo "  make logs-worker Follow Celery worker logs"
	@echo "  make shell-back  Shell into backend container"
	@echo "  make shell-db    psql into Postgres"
	@echo "  make poll        Manually trigger one poll cycle"
	@echo "  make test        Run backend tests"
	@echo "  make lint        Lint Python code"
	@echo "  make fe-install  Install frontend dependencies"
	@echo "  make fe-dev      Start frontend dev server"
	@echo ""

# ── Docker ────────────────────────────────────────────────────────────────────

up:
	docker compose up -d
	@echo "✓  Services started"
	@echo "   API:      http://localhost:8000/docs"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Flower:   http://localhost:5555"

down:
	docker compose down

build:
	docker compose build --no-cache

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f backend

logs-worker:
	docker compose logs -f celery_worker

# ── Database ──────────────────────────────────────────────────────────────────

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python scripts/seed.py

shell-back:
	docker compose exec backend bash

shell-db:
	docker compose exec postgres psql -U postgres -d hono

# ── Celery ────────────────────────────────────────────────────────────────────

poll:
	docker compose exec backend python -c "from app.jobs.tasks import poll_and_score_lots; import asyncio; from app.jobs.tasks import _poll_and_score_async; asyncio.run(_poll_and_score_async())"

# ── Testing ───────────────────────────────────────────────────────────────────

test:
	docker compose exec backend pytest backend/tests/ -v --tb=short

lint:
	docker compose exec backend ruff check app/
	docker compose exec backend mypy app/ --ignore-missing-imports

# ── Frontend ──────────────────────────────────────────────────────────────────

fe-install:
	cd frontend && npm install

fe-dev:
	cd frontend && npm run dev

fe-build:
	cd frontend && npm run build

# ── Full local setup (no Docker) ──────────────────────────────────────────────

local-setup:
	@echo "Starting Postgres & Redis with Docker, running backend & frontend locally..."
	docker compose up -d postgres redis
	cd backend && pip install -r requirements.txt
	cd backend && uvicorn app.main:app --reload &
	cd backend && celery -A app.jobs.celery_app worker --loglevel=info &
	cd frontend && npm install && npm run dev
