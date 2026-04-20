"""add_auction_house_enum_values

Add liveauctioneers, artsy, catawiki, artcurial to the auctionhouse enum.
These were missing from the PostgreSQL enum type, causing silent insert failures
for all lots from those sources.

Revision ID: c1e2f3a4b5d6
Revises: b7e4d9f2a1c3
Create Date: 2026-04-20
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'c1e2f3a4b5d6'
down_revision: Union[str, None] = 'b7e4d9f2a1c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE is non-blocking and non-transactional in PostgreSQL.
    # Must run outside a transaction (execute_if guards make it idempotent).
    op.execute("ALTER TYPE auctionhouse ADD VALUE IF NOT EXISTS 'liveauctioneers'")
    op.execute("ALTER TYPE auctionhouse ADD VALUE IF NOT EXISTS 'artsy'")
    op.execute("ALTER TYPE auctionhouse ADD VALUE IF NOT EXISTS 'catawiki'")
    op.execute("ALTER TYPE auctionhouse ADD VALUE IF NOT EXISTS 'artcurial'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    # Downgrade is a no-op — the extra values are harmless.
    pass
