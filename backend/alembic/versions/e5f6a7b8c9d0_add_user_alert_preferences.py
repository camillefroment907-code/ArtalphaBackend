"""add_user_alert_preferences

Revision ID: e5f6a7b8c9d0
Revises: d3e4f5a6b7c8
Create Date: 2026-04-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_alert_preferences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("exceptional_opportunity", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("lot_below_market", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("new_auction_house", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("new_lot_followed_artist", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("artist_momentum_change", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("auction_closing_24h", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("portfolio_value_change", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("optimal_sell_window", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("weekly_brief", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("monthly_report", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("email_notifications", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_user_alert_prefs_user_id", "user_alert_preferences", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_alert_prefs_user_id", table_name="user_alert_preferences")
    op.drop_table("user_alert_preferences")
