"""add lang and translations to blog_posts

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa

revision = 'q7r8s9t0u1v2'
down_revision = 'p6q7r8s9t0u1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('blog_posts', sa.Column('lang', sa.String(2), nullable=False, server_default='fr'))
    op.add_column('blog_posts', sa.Column('translations', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('blog_posts', 'translations')
    op.drop_column('blog_posts', 'lang')
