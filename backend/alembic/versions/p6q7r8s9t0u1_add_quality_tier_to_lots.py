"""add quality_tier to lots

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'p6q7r8s9t0u1'
down_revision = 'o5p6q7r8s9t0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('lots', sa.Column('quality_tier', sa.String(1), nullable=True))
    op.create_index('ix_lots_quality_tier', 'lots', ['quality_tier'])


def downgrade():
    op.drop_index('ix_lots_quality_tier', table_name='lots')
    op.drop_column('lots', 'quality_tier')
