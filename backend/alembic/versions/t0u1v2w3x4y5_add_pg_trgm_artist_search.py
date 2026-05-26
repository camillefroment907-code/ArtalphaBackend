"""add_pg_trgm_artist_search

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-05-26 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = 't0u1v2w3x4y5'
down_revision: Union[str, None] = 's9t0u1v2w3x4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_lot_artist_trgm "
        "ON lots USING GIN (artist_name_raw gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_lot_artist_trgm")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
