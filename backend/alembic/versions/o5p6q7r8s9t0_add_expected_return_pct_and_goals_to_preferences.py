"""add expected_return_pct and goals to user_preferences

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa

revision = 'o5p6q7r8s9t0'
down_revision = 'n4o5p6q7r8s9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('preferences', sa.Column('expected_return_pct', sa.Float(), nullable=True))
    op.add_column('preferences', sa.Column('goals', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('preferences', 'goals')
    op.drop_column('preferences', 'expected_return_pct')
