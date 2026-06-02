"""add_upside_tables

Revision ID: z7a8b9c0d1e2
Revises: y6z7a8b9c0d1
Create Date: 2026-06-02 00:00:00.000000

Additive-only migration — creates:
  - upside_model_versions  (ML model artifact registry)
  - lot_upside_predictions (per-lot predictions from active model)

Rollback:
  DROP TABLE lot_upside_predictions;
  DROP TABLE upside_model_versions;
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "z7a8b9c0d1e2"
down_revision: Union[str, None] = "y6z7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── upside_model_versions ────────────────────────────────────────────────
    op.create_table(
        "upside_model_versions",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"), nullable=False,
        ),
        sa.Column("version", sa.Text, nullable=False),          # e.g. "v1.0.0-2026-06-02"
        sa.Column(
            "created_at", sa.DateTime, nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("artifact_path", sa.Text, nullable=False),    # "models/upside/v1.0.0-2026-06-02.joblib"
        sa.Column("feature_list", JSONB, nullable=False),        # ordered list of feature names
        sa.Column("metrics", JSONB, nullable=False),             # roc_auc, precision_at_10, etc.
        sa.Column("baseline_metrics", JSONB, nullable=True),     # baseline comparison
        sa.Column("train_size", sa.Integer, nullable=True),
        sa.Column("val_size", sa.Integer, nullable=True),
        sa.Column("test_size", sa.Integer, nullable=True),
        sa.Column("train_cutoff", sa.Date, nullable=True),
        sa.Column("val_cutoff", sa.Date, nullable=True),
        sa.Column("test_cutoff", sa.Date, nullable=True),
        sa.Column("promoted", sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("notes", sa.Text, nullable=True),
    )

    # Unique constraint: version string is unique
    op.create_unique_constraint(
        "uq_upside_model_versions_version",
        "upside_model_versions",
        ["version"],
    )

    op.create_index("ix_upside_model_versions_is_active", "upside_model_versions", ["is_active"])
    op.create_index("ix_upside_model_versions_created_at", "upside_model_versions", ["created_at"])

    # ── lot_upside_predictions ───────────────────────────────────────────────
    op.create_table(
        "lot_upside_predictions",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"), nullable=False,
        ),
        sa.Column(
            "lot_id", UUID(as_uuid=True),
            sa.ForeignKey("lots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "model_version_id", UUID(as_uuid=True),
            sa.ForeignKey("upside_model_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "predicted_at", sa.DateTime, nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("upside_prob", sa.Float, nullable=False),     # 0.0 to 1.0
        sa.Column("confidence_score", sa.Float, nullable=True), # calibration confidence
        sa.Column("signal_label", sa.Text, nullable=True),      # "high" / "moderate" / "limited"
        sa.Column("feature_snapshot", JSONB, nullable=True),    # features used
    )

    # Unique constraint: one prediction per (lot, model_version)
    op.create_unique_constraint(
        "uq_lot_upside_pred_lot_model",
        "lot_upside_predictions",
        ["lot_id", "model_version_id"],
    )

    op.create_index("ix_lot_upside_predictions_lot_id", "lot_upside_predictions", ["lot_id"])
    op.create_index(
        "ix_lot_upside_predictions_model_version_id",
        "lot_upside_predictions",
        ["model_version_id"],
    )
    op.create_index(
        "ix_lot_upside_predictions_upside_prob",
        "lot_upside_predictions",
        ["upside_prob"],
        postgresql_using="btree",
    )


def downgrade() -> None:
    # Drop predictions first (FK → model_versions)
    op.drop_index("ix_lot_upside_predictions_upside_prob", table_name="lot_upside_predictions")
    op.drop_index("ix_lot_upside_predictions_model_version_id", table_name="lot_upside_predictions")
    op.drop_index("ix_lot_upside_predictions_lot_id", table_name="lot_upside_predictions")
    op.drop_constraint("uq_lot_upside_pred_lot_model", "lot_upside_predictions", type_="unique")
    op.drop_table("lot_upside_predictions")

    op.drop_index("ix_upside_model_versions_created_at", table_name="upside_model_versions")
    op.drop_index("ix_upside_model_versions_is_active", table_name="upside_model_versions")
    op.drop_constraint("uq_upside_model_versions_version", "upside_model_versions", type_="unique")
    op.drop_table("upside_model_versions")
