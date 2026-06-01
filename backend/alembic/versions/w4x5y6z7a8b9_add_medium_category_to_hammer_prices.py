"""add_medium_category_to_hammer_prices

Revision ID: w4x5y6z7a8b9
Revises: v3x4y5z6a7b8
Create Date: 2026-06-01 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "w4x5y6z7a8b9"
down_revision: Union[str, None] = "v3x4y5z6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "hammer_prices",
        sa.Column("medium_category", sa.String(20), nullable=True),
    )
    op.create_index(
        "ix_hammer_prices_medium_category",
        "hammer_prices",
        ["medium_category"],
    )


def downgrade() -> None:
    op.drop_index("ix_hammer_prices_medium_category", table_name="hammer_prices")
    op.drop_column("hammer_prices", "medium_category")
