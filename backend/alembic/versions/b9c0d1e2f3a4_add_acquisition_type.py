"""add_acquisition_type

Revision ID: b9c0d1e2f3a4
Revises: a8b9c0d1e2f3
Create Date: 2026-06-16 00:00:00.000000

Additive migration — adds acquisition_type to portfolio_items.
"""

from alembic import op
import sqlalchemy as sa

revision = 'b9c0d1e2f3a4'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'portfolio_items',
        sa.Column('acquisition_type', sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('portfolio_items', 'acquisition_type')
