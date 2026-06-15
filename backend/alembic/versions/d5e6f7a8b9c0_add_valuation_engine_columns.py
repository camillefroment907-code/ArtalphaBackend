"""add_valuation_engine_columns

Adds columns required by the Nautilus Collection Value Engine (Session 2).

DB audit (2026-06-15) confirmed these columns already exist in collection_valuations:
  - value_low         Float  nullable  (P25) — pre-existing, no _eur suffix
  - value_high        Float  nullable  (P75) — pre-existing, no _eur suffix
  - comparables_count Int    nullable  — pre-existing
  - model_version     Varchar nullable — pre-existing (not used by engine)

Only missing columns (added here):
  - source            String nullable  (engine version identifier)
  - warning           Text   nullable  (user-facing caveat or null if clean)

Uses ADD COLUMN IF NOT EXISTS for idempotency — safe to re-run.

Revision ID: d5e6f7a8b9c0
Revises: c1d2e3f4a5b6
Create Date: 2026-06-15 00:00:00.000000
"""

from alembic import op

revision = 'd5e6f7a8b9c0'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    # value_low, value_high, comparables_count already exist — skipped.
    # Only adding truly missing columns, using IF NOT EXISTS for idempotency.
    op.execute(
        "ALTER TABLE collection_valuations "
        "ADD COLUMN IF NOT EXISTS source VARCHAR(200)"
    )
    op.execute(
        "ALTER TABLE collection_valuations "
        "ADD COLUMN IF NOT EXISTS warning TEXT"
    )


def downgrade():
    op.execute(
        "ALTER TABLE collection_valuations DROP COLUMN IF EXISTS warning"
    )
    op.execute(
        "ALTER TABLE collection_valuations DROP COLUMN IF EXISTS source"
    )
