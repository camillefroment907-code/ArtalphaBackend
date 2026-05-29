"""add_portfolio_snapshots_and_recommendations

Revision ID: v2w3x4y5z6a7
Revises: u1v2w3x4y5z6
Create Date: 2026-05-29 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "v2w3x4y5z6a7"
down_revision: Union[str, None] = "u1v2w3x4y5z6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── portfolio_snapshots ───────────────────────────────────────────────────
    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("total_value_eur", sa.Float(), nullable=True),
        sa.Column("purchase_cost_eur", sa.Float(), nullable=True),
        sa.Column("item_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("health_score", sa.Integer(), nullable=True),
        sa.Column("health_breakdown", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("user_id", "snapshot_date", name="uq_portfolio_snapshot_user_date"),
    )
    op.create_index("ix_portfolio_snapshots_user_date", "portfolio_snapshots", ["user_id", "snapshot_date"])

    # ── portfolio_recommendations ─────────────────────────────────────────────
    op.create_table(
        "portfolio_recommendations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recommendation_id", sa.String(100), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("impact", sa.String(20), nullable=True),
        sa.Column("cta_label", sa.String(100), nullable=True),
        sa.Column("cta_url", sa.String(300), nullable=True),
        sa.Column("affected_items", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("generated_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_portfolio_reco_user_status", "portfolio_recommendations", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_portfolio_reco_user_status", table_name="portfolio_recommendations")
    op.drop_table("portfolio_recommendations")
    op.drop_index("ix_portfolio_snapshots_user_date", table_name="portfolio_snapshots")
    op.drop_table("portfolio_snapshots")
