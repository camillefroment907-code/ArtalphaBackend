"""add_signature_edition_columns_to_hammer_prices

Revision ID: x5y6z7a8b9c0
Revises: w4x5y6z7a8b9
Create Date: 2026-06-01 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "x5y6z7a8b9c0"
down_revision: Union[str, None] = "w4x5y6z7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "hammer_prices"
_COLUMNS = [
    ("signed",         sa.Boolean(), None),
    ("edition_number", sa.Integer(), None),
    ("edition_size",   sa.Integer(), None),
    ("is_ea",          sa.Boolean(), None),
]


def _existing_columns() -> set[str]:
    bind = op.get_bind()
    return {c["name"] for c in inspect(bind).get_columns(_TABLE)}


def upgrade() -> None:
    existing = _existing_columns()
    for col_name, col_type, server_default in _COLUMNS:
        if col_name not in existing:
            op.add_column(
                _TABLE,
                sa.Column(col_name, col_type, nullable=True, server_default=server_default),
            )


def downgrade() -> None:
    existing = _existing_columns()
    for col_name, _, _ in _COLUMNS:
        if col_name in existing:
            op.drop_column(_TABLE, col_name)
