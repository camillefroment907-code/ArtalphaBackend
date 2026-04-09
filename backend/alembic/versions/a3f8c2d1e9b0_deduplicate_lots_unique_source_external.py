"""deduplicate_lots_unique_source_external

Delete all duplicate lots (keep best deal_score per source+external_id),
then add a partial UNIQUE index so it can never happen again.

Revision ID: a3f8c2d1e9b0
Revises: 170a5386e89c
Create Date: 2026-04-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a3f8c2d1e9b0'
down_revision: Union[str, None] = '170a5386e89c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Step 1: purge duplicates ──────────────────────────────────────────────
    # For each (source, external_id) pair, keep ONE row:
    # - the one with the highest deal_score
    # - tie-break: the earliest created_at (the "original" insert)
    # Rows with external_id IS NULL are never touched (no key → can't dedup).
    op.execute(sa.text("""
        DELETE FROM lots
        WHERE id NOT IN (
            SELECT DISTINCT ON (source, external_id) id
            FROM lots
            WHERE external_id IS NOT NULL
            ORDER BY source, external_id,
                     deal_score DESC NULLS LAST,
                     created_at ASC
        )
        AND external_id IS NOT NULL
    """))

    # ── Step 2: drop old non-unique index ────────────────────────────────────
    op.drop_index("ix_lots_source_external", table_name="lots", if_exists=True)

    # ── Step 3: create partial UNIQUE index (external_id NOT NULL only) ──────
    # Partial because lots ingested without an external_id must still be allowed.
    op.execute(sa.text("""
        CREATE UNIQUE INDEX uq_lots_source_external
        ON lots (source, external_id)
        WHERE external_id IS NOT NULL
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS uq_lots_source_external"))
    op.create_index("ix_lots_source_external", "lots", ["source", "external_id"])
