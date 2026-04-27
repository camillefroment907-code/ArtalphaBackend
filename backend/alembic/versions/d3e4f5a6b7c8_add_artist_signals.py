"""add_artist_signals

Nautilus Oracle — predictive artist intelligence signals table.

Revision ID: d3e4f5a6b7c8
Revises: c1e2f3a4b5d6
Create Date: 2026-04-25
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c1e2f3a4b5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text(
        "SELECT EXISTS (SELECT FROM information_schema.tables "
        "WHERE table_name = 'artist_signals')"
    ))
    if not result.scalar():
        op.create_table(
            'artist_signals',
            sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
            sa.Column('artist_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('computed_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=True),
            # Market signals
            sa.Column('vol_30d', sa.Integer(), nullable=True),
            sa.Column('vol_90d', sa.Integer(), nullable=True),
            sa.Column('vol_180d', sa.Integer(), nullable=True),
            sa.Column('vol_growth_ratio', sa.Float(), nullable=True),
            sa.Column('price_median_90d', sa.Float(), nullable=True),
            sa.Column('price_median_180d', sa.Float(), nullable=True),
            sa.Column('price_growth_ratio', sa.Float(), nullable=True),
            sa.Column('unsold_rate_90d', sa.Float(), nullable=True),
            sa.Column('buyer_concentration', sa.Float(), nullable=True),
            # Institutional signals
            sa.Column('museum_collection', sa.Boolean(), server_default='false', nullable=True),
            sa.Column('tier1_gallery', sa.Boolean(), server_default='false', nullable=True),
            sa.Column('major_fair', sa.Boolean(), server_default='false', nullable=True),
            sa.Column('major_prize', sa.Boolean(), server_default='false', nullable=True),
            # Media signals
            sa.Column('press_mentions_90d', sa.Integer(), server_default='0', nullable=True),
            sa.Column('press_velocity', sa.Float(), server_default='0', nullable=True),
            # Cornering signals
            sa.Column('repeat_buyer_detected', sa.Boolean(), server_default='false', nullable=True),
            sa.Column('repeat_buyer_count', sa.Integer(), server_default='0', nullable=True),
            sa.Column('supply_compression', sa.Float(), server_default='0', nullable=True),
            # Oracle output
            sa.Column('oracle_score_6m', sa.Float(), nullable=True),
            sa.Column('oracle_score_18m', sa.Float(), nullable=True),
            sa.Column('oracle_signal', sa.String(20), nullable=True),
            sa.Column('oracle_window', sa.String(50), nullable=True),
            sa.Column('oracle_target_upside', sa.String(20), nullable=True),
            sa.Column('active_signals', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('oracle_narrative', sa.Text(), nullable=True),
            sa.Column('confidence', sa.Float(), nullable=True),
            sa.ForeignKeyConstraint(['artist_id'], ['artists.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('idx_artist_signals_artist_id', 'artist_signals', ['artist_id'])
        op.create_index('idx_artist_signals_computed_at', 'artist_signals', ['computed_at'])


def downgrade() -> None:
    op.drop_index('idx_artist_signals_computed_at', table_name='artist_signals')
    op.drop_index('idx_artist_signals_artist_id', table_name='artist_signals')
    op.drop_table('artist_signals')
