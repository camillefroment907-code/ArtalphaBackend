"""add_artsper_artist_snapshots

Revision ID: d2e3f4a5b6c7
Revises: e5f6a7b8c9d0
Create Date: 2026-04-25 20:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'artsper_artist_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('artsper_artist_id', sa.Integer(), nullable=False),
        sa.Column('artist_name', sa.String(500), nullable=False),
        sa.Column('artist_name_normalized', sa.String(500), nullable=False),
        # Primary market presence
        sa.Column('total_works', sa.Integer(), server_default='0'),
        sa.Column('works_available', sa.Integer(), server_default='0'),
        sa.Column('works_sold', sa.Integer(), server_default='0'),
        # Price data (EUR)
        sa.Column('price_min', sa.Float(), nullable=True),
        sa.Column('price_max', sa.Float(), nullable=True),
        sa.Column('price_avg', sa.Float(), nullable=True),
        sa.Column('price_median', sa.Float(), nullable=True),
        sa.Column('price_p25', sa.Float(), nullable=True),
        sa.Column('price_p75', sa.Float(), nullable=True),
        # Gallery representation
        sa.Column('gallery_count', sa.Integer(), server_default='0'),
        sa.Column('gallery_names', sa.JSON(), nullable=True),
        # Work breakdown
        sa.Column('categories', sa.JSON(), nullable=True),
        sa.Column('mediums', sa.JSON(), nullable=True),
        # Signals
        sa.Column('has_staff_pick', sa.Boolean(), server_default='false'),
        sa.Column('is_top_seller', sa.Boolean(), server_default='false'),
        sa.Column('artsper_url', sa.String(1000), nullable=True),
        # FK to artists table
        sa.Column('artist_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('artists.id'), nullable=True),
        # History
        sa.Column('price_history', sa.JSON(), nullable=True),
        # Timestamps
        sa.Column('first_seen_at', sa.DateTime(), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    op.create_unique_constraint(
        'uq_artsper_artist_snapshots_artsper_id',
        'artsper_artist_snapshots',
        ['artsper_artist_id'],
    )
    op.create_index(
        'ix_artsper_snapshots_name_normalized',
        'artsper_artist_snapshots',
        ['artist_name_normalized'],
    )
    op.create_index(
        'ix_artsper_snapshots_artist_id',
        'artsper_artist_snapshots',
        ['artist_id'],
    )
    op.create_index(
        'ix_artsper_snapshots_price_avg',
        'artsper_artist_snapshots',
        ['price_avg'],
    )
    op.create_index(
        'ix_artsper_snapshots_total_works',
        'artsper_artist_snapshots',
        ['total_works'],
    )


def downgrade() -> None:
    op.drop_index('ix_artsper_snapshots_total_works', 'artsper_artist_snapshots')
    op.drop_index('ix_artsper_snapshots_price_avg', 'artsper_artist_snapshots')
    op.drop_index('ix_artsper_snapshots_artist_id', 'artsper_artist_snapshots')
    op.drop_index('ix_artsper_snapshots_name_normalized', 'artsper_artist_snapshots')
    op.drop_constraint('uq_artsper_artist_snapshots_artsper_id', 'artsper_artist_snapshots')
    op.drop_table('artsper_artist_snapshots')
