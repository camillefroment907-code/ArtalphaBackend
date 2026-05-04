"""add_cagr_columns_to_artists

Revision ID: i4j5k6l7m8n9
Revises: 6e1db7591d6e
Create Date: 2026-05-04 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'i4j5k6l7m8n9'
down_revision: Union[str, None] = '6e1db7591d6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('artists', sa.Column('cagr_calculated', sa.Float(), nullable=True))
    op.add_column('artists', sa.Column('cagr_raw', sa.Float(), nullable=True))
    op.add_column('artists', sa.Column('cagr_confidence', sa.String(length=20), nullable=True))
    op.add_column('artists', sa.Column('cagr_source', sa.String(length=30), nullable=True))
    op.add_column('artists', sa.Column('cagr_n_sales', sa.Integer(), nullable=True))
    op.add_column('artists', sa.Column('cagr_window_start', sa.Date(), nullable=True))
    op.add_column('artists', sa.Column('cagr_window_end', sa.Date(), nullable=True))
    op.add_column('artists', sa.Column('cagr_computed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('artists', 'cagr_computed_at')
    op.drop_column('artists', 'cagr_window_end')
    op.drop_column('artists', 'cagr_window_start')
    op.drop_column('artists', 'cagr_n_sales')
    op.drop_column('artists', 'cagr_source')
    op.drop_column('artists', 'cagr_confidence')
    op.drop_column('artists', 'cagr_raw')
    op.drop_column('artists', 'cagr_calculated')
