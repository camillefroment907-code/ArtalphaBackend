"""perf_critical_indexes

Revision ID: b0c1d2e3f4a5
Revises: z7a8b9c0d1e2
Create Date: 2026-06-03 00:00:00.000000

Performance indexes — all use IF NOT EXISTS so this migration is idempotent.

Note: CONCURRENTLY removed — it cannot run inside Alembic's transaction
block and causes 'multiple heads' + container startup failure on Railway.
Indexes are built with a brief table lock; acceptable for this stage.

Impact targets:
  ix_lots_is_deal_score      → hot_deals / explore feed:  O(log N) instead of full scan
  ix_lots_status_date        → upcoming lots sort:         avoids seq-scan + filesort
  ix_lots_source_idx         → source filtering:           eliminates cast+scan
  ix_lots_artist_hammer      → market-avg in get_lot:      covering index, no heap access
  ix_artist_profiles_lower   → artist profile lookup:      func(col) now index-scannable
  ix_artist_signals_lookup   → oracle signal per lot:      eliminates O(N) scan on artist_id
  ix_hammer_prices_norm_med  → comparables endpoint:       composite covers most WHERE clauses
  ix_lots_artist_name_lower  → fair_value sub-query:       func(col) now index-scannable
"""
from typing import Sequence, Union
from alembic import op


revision: str = "b0c1d2e3f4a5"
down_revision: Union[str, None] = "z7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── lots table ─────────────────────────────────────────────────────────────

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_lots_is_deal_score "
        "ON lots (deal_score DESC NULLS LAST) WHERE is_deal = true"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_lots_status_date "
        "ON lots (status, auction_date DESC NULLS LAST)"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_lots_source_idx "
        "ON lots (source)"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_lots_artist_hammer "
        "ON lots (artist_name_raw, hammer_price) "
        "WHERE hammer_price IS NOT NULL AND hammer_price > 0"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_lots_artist_name_lower "
        "ON lots (lower(artist_name_raw)) "
        "WHERE artist_name_raw IS NOT NULL"
    )

    # ── artist_profiles table ──────────────────────────────────────────────────

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_artist_profiles_lower "
        "ON artist_profiles (lower(name))"
    )

    # ── artist_signals table ───────────────────────────────────────────────────

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_artist_signals_lookup "
        "ON artist_signals (artist_id, computed_at DESC NULLS LAST)"
    )

    # ── hammer_prices table ────────────────────────────────────────────────────

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hammer_prices_norm_med "
        "ON hammer_prices (artist_name_normalized, medium_category, sale_date DESC NULLS LAST)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_lots_is_deal_score")
    op.execute("DROP INDEX IF EXISTS ix_lots_status_date")
    op.execute("DROP INDEX IF EXISTS ix_lots_source_idx")
    op.execute("DROP INDEX IF EXISTS ix_lots_artist_hammer")
    op.execute("DROP INDEX IF EXISTS ix_lots_artist_name_lower")
    op.execute("DROP INDEX IF EXISTS ix_artist_profiles_lower")
    op.execute("DROP INDEX IF EXISTS ix_artist_signals_lookup")
    op.execute("DROP INDEX IF EXISTS ix_hammer_prices_norm_med")
