"""add_composite_indexes_lots

Revision ID: a8b9c0d1e2f3
Revises: z7a8b9c0d1e2
Create Date: 2026-06-07 00:00:00.000000

Additive-only migration — adds composite indexes to the lots table to
speed up the three most-used query patterns:

  1. (status, market_type, deal_score DESC) — used by every recommendation
     strategy, the main /api/lots list, and market-brief.
  2. (auction_date, status) — used by closing-soon, calendar, En direct.
  3. (created_at, status, market_type) — used by new_lots_count in market-brief.

All indexes are CREATE INDEX CONCURRENTLY so they build without locking writes.

Rollback:
  DROP INDEX CONCURRENTLY IF EXISTS ix_lots_status_mkt_score;
  DROP INDEX CONCURRENTLY IF EXISTS ix_lots_auction_date_status;
  DROP INDEX CONCURRENTLY IF EXISTS ix_lots_created_status_mkt;
"""
from typing import Sequence, Union
from alembic import op


revision: str = 'a8b9c0d1e2f3'
down_revision: Union[str, None] = 'z7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # CONCURRENTLY avoids table lock — safe in production
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_lots_status_mkt_score
        ON lots (status, market_type, deal_score DESC NULLS LAST)
        WHERE deal_score IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_lots_auction_date_status
        ON lots (auction_date, status)
        WHERE auction_date IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_lots_created_status_mkt
        ON lots (created_at DESC, status, market_type)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_lots_status_mkt_score")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_lots_auction_date_status")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_lots_created_status_mkt")
