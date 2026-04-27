import asyncio
import os
import sys

# Load .env from parent directory before importing app modules
_env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS artist_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
    computed_at TIMESTAMP DEFAULT NOW(),
    vol_30d INTEGER,
    vol_90d INTEGER,
    vol_180d INTEGER,
    vol_growth_ratio FLOAT,
    price_median_90d FLOAT,
    price_median_180d FLOAT,
    price_growth_ratio FLOAT,
    unsold_rate_90d FLOAT,
    buyer_concentration FLOAT,
    museum_collection BOOLEAN DEFAULT FALSE,
    tier1_gallery BOOLEAN DEFAULT FALSE,
    major_fair BOOLEAN DEFAULT FALSE,
    major_prize BOOLEAN DEFAULT FALSE,
    press_mentions_90d INTEGER DEFAULT 0,
    press_velocity FLOAT DEFAULT 0,
    repeat_buyer_detected BOOLEAN DEFAULT FALSE,
    repeat_buyer_count INTEGER DEFAULT 0,
    supply_compression FLOAT DEFAULT 0,
    oracle_score_6m FLOAT,
    oracle_score_18m FLOAT,
    oracle_signal VARCHAR(20),
    oracle_window VARCHAR(50),
    oracle_target_upside VARCHAR(20),
    active_signals JSONB,
    oracle_narrative TEXT,
    confidence FLOAT
);
CREATE INDEX IF NOT EXISTS idx_artist_signals_artist_id ON artist_signals(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_signals_computed_at ON artist_signals(computed_at);
"""


async def main():
    from app.database import BgSessionLocal
    from sqlalchemy import text

    # Step 1: ensure table exists
    async with BgSessionLocal() as db:
        for stmt in CREATE_TABLE_SQL.strip().split(';'):
            stmt = stmt.strip()
            if stmt:
                await db.execute(text(stmt))
        await db.commit()
        print("Table artist_signals ready.")

    # Step 2: run Oracle
    from app.services.oracle_service import compute_oracle_for_all_artists
    result = await compute_oracle_for_all_artists(min_lots=3)
    print(f"Oracle computed: {result}")


asyncio.run(main())
