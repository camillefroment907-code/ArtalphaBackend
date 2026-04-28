"""add_emerging_artists

Revision ID: f1e2d3c4b5a6
Revises: d2e3f4a5b6c7
Create Date: 2026-04-28 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f1e2d3c4b5a6'
down_revision: Union[str, None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'emerging_artists',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('artist_name', sa.String(500), nullable=False),
        sa.Column('nationality', sa.String(100), nullable=True),
        sa.Column('birth_year', sa.Integer, nullable=True),
        sa.Column('gallery_name', sa.String(500), nullable=True),
        sa.Column('avg_price', sa.Float, nullable=True),
        sa.Column('lot_count', sa.Integer, default=1),
        sa.Column('last_seen_at', sa.DateTime, nullable=True),
        sa.Column('momentum_score', sa.Float, default=50.0),
        sa.Column('created_at', sa.DateTime, nullable=True),
        sa.Column('updated_at', sa.DateTime, nullable=True),
        sa.UniqueConstraint('artist_name', name='uq_emerging_artist_name'),
    )
    op.create_index('ix_emerging_artists_momentum', 'emerging_artists', ['momentum_score'])
    op.create_index('ix_emerging_artists_birth_year', 'emerging_artists', ['birth_year'])


def downgrade() -> None:
    op.drop_index('ix_emerging_artists_birth_year', table_name='emerging_artists')
    op.drop_index('ix_emerging_artists_momentum', table_name='emerging_artists')
    op.drop_table('emerging_artists')
