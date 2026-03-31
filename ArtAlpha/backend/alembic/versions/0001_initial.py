"""Initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("is_verified", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # artists
    op.create_table(
        "artists",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("name_normalized", sa.String(500), nullable=False),
        sa.Column("nationality", sa.String(100), nullable=True),
        sa.Column("birth_year", sa.Integer(), nullable=True),
        sa.Column("death_year", sa.Integer(), nullable=True),
        sa.Column("movement", sa.String(200), nullable=True),
        sa.Column("medium", sa.String(200), nullable=True),
        sa.Column("popularity_score", sa.Float(), server_default="50.0"),
        sa.Column("avg_auction_price", sa.Float(), nullable=True),
        sa.Column("median_auction_price", sa.Float(), nullable=True),
        sa.Column("price_volatility", sa.Float(), server_default="0.3"),
        sa.Column("liquidity_score", sa.Float(), server_default="50.0"),
        sa.Column("trend", sa.String(10), server_default="stable"),
        sa.Column("total_lots_sold", sa.Integer(), server_default="0"),
        sa.Column("sell_through_rate", sa.Float(), server_default="0.7"),
        sa.Column("last_enriched_at", sa.DateTime(), nullable=True),
        sa.Column("data_confidence", sa.Float(), server_default="0.5"),
        sa.Column("external_ids", postgresql.JSON(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_index("ix_artists_name_normalized", "artists", ["name_normalized"])

    # lots
    op.create_table(
        "lots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("external_id", sa.String(500), nullable=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("lot_number", sa.String(50), nullable=True),
        sa.Column("category", sa.String(200), nullable=True),
        sa.Column("medium", sa.String(300), nullable=True),
        sa.Column("dimensions", sa.String(300), nullable=True),
        sa.Column("period", sa.String(200), nullable=True),
        sa.Column("provenance", sa.Text(), nullable=True),
        sa.Column("condition", sa.String(200), nullable=True),
        sa.Column("artist_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("artists.id"), nullable=True),
        sa.Column("artist_name_raw", sa.String(500), nullable=True),
        sa.Column("estimate_low", sa.Float(), nullable=True),
        sa.Column("estimate_high", sa.Float(), nullable=True),
        sa.Column("current_price", sa.Float(), nullable=True),
        sa.Column("hammer_price", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(10), server_default="EUR"),
        sa.Column("auction_date", sa.DateTime(), nullable=True),
        sa.Column("auction_house_name", sa.String(300), nullable=True),
        sa.Column("auction_sale_title", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), server_default="upcoming"),
        sa.Column("deal_score", sa.Float(), nullable=True),
        sa.Column("pct_below_low_estimate", sa.Float(), nullable=True),
        sa.Column("pct_below_market_avg", sa.Float(), nullable=True),
        sa.Column("score_breakdown", postgresql.JSON(), nullable=True),
        sa.Column("is_deal", sa.Boolean(), server_default="false"),
        sa.Column("enriched_at", sa.DateTime(), nullable=True),
        sa.Column("scored_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("raw_data", postgresql.JSON(), nullable=True),
    )
    op.create_index("ix_lots_deal_score", "lots", ["deal_score"])
    op.create_index("ix_lots_auction_date", "lots", ["auction_date"])
    op.create_index("ix_lots_is_deal", "lots", ["is_deal"])
    op.create_index("ix_lots_artist_id", "lots", ["artist_id"])
    op.create_index("ix_lots_source_external", "lots", ["source", "external_id"])

    # preferences
    op.create_table(
        "preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True),
        sa.Column("favorite_artists", postgresql.ARRAY(sa.String()), server_default="{}"),
        sa.Column("categories", postgresql.ARRAY(sa.String()), server_default="{}"),
        sa.Column("budget_max", sa.Float(), nullable=True),
        sa.Column("min_deal_score", sa.Integer(), server_default="75"),
        sa.Column("alert_channel", sa.String(20), server_default="email"),
        sa.Column("telegram_chat_id", sa.String(100), nullable=True),
        sa.Column("alert_email", sa.String(255), nullable=True),
        sa.Column("auction_houses", postgresql.ARRAY(sa.String()), server_default="{}"),
        sa.Column("is_alerts_enabled", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # alerts
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("lot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("lots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("recipient", sa.String(500), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("deal_score_at_send", sa.Float(), nullable=True),
        sa.Column("sent_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.Column("is_delivered", sa.Boolean(), server_default="false"),
        sa.Column("delivery_error", sa.Text(), nullable=True),
    )
    op.create_index("ix_alerts_user_sent", "alerts", ["user_id", "sent_at"])

    # scoring_models
    op.create_table(
        "scoring_models",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("weights", postgresql.JSON(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="false"),
        sa.Column("mae", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )

    # Seed the default scoring model
    op.execute("""
        INSERT INTO scoring_models (version, weights, description, is_active)
        VALUES (
            'v1.0-rule-based',
            '{"below_estimate": 0.30, "below_market": 0.30, "artist_liquidity": 0.20, "house_reputation": 0.10, "confidence": 0.10}',
            'Initial rule-based weighted scoring model',
            true
        )
    """)


def downgrade() -> None:
    op.drop_table("scoring_models")
    op.drop_table("alerts")
    op.drop_table("preferences")
    op.drop_table("lots")
    op.drop_table("artists")
    op.drop_table("users")
