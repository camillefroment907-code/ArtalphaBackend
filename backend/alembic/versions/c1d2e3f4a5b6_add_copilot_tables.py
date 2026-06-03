"""add_copilot_tables

Revision ID: c1d2e3f4a5b6
Revises: b0c1d2e3f4a5
Create Date: 2026-06-03 00:00:00.000000

Two new tables for the Copilot advisor:
  copilot_memories       — episodic user memory (key/value, survives sessions)
  copilot_conversations  — full interaction log (Phase 2: chip clicks; Phase 3+: chat)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'c1d2e3f4a5b6'
down_revision = 'b0c1d2e3f4a5'
branch_labels = None
depends_on = None


def upgrade():
    # ── copilot_memories ──────────────────────────────────────────────────────
    op.create_table(
        'copilot_memories',
        sa.Column('id',              UUID(as_uuid=True),  primary_key=True),
        sa.Column('user_id',         UUID(as_uuid=True),  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('memory_key',      sa.String(200),      nullable=False),
        sa.Column('memory_value',    JSONB,               nullable=False),
        sa.Column('confidence',      sa.Float,            nullable=True, server_default='1.0'),
        sa.Column('source',          sa.String(50),       nullable=True),
        sa.Column('created_at',      sa.DateTime,         nullable=False, server_default=sa.text('NOW()')),
        sa.Column('last_reinforced', sa.DateTime,         nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('user_id', 'memory_key', name='uq_copilot_memory_user_key'),
    )
    op.create_index('ix_copilot_memory_user_id', 'copilot_memories', ['user_id'])
    op.create_index('ix_copilot_memory_key',     'copilot_memories', ['memory_key'])

    # ── copilot_conversations ─────────────────────────────────────────────────
    op.create_table(
        'copilot_conversations',
        sa.Column('id',               UUID(as_uuid=True),  primary_key=True),
        sa.Column('user_id',          UUID(as_uuid=True),  sa.ForeignKey('users.id', ondelete='CASCADE'),    nullable=False),
        sa.Column('session_id',       UUID(as_uuid=True),  nullable=False),
        sa.Column('role',             sa.String(20),       nullable=False),
        sa.Column('content',          sa.Text,             nullable=False),
        sa.Column('intent',           sa.String(50),       nullable=True),
        sa.Column('source_page',      sa.String(50),       nullable=True),
        sa.Column('context_snapshot', JSONB,               nullable=True),
        sa.Column('lot_id',           UUID(as_uuid=True),  sa.ForeignKey('lots.id', ondelete='SET NULL'),    nullable=True),
        sa.Column('artist_id',        UUID(as_uuid=True),  sa.ForeignKey('artists.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at',       sa.DateTime,         nullable=False, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_copilot_conv_user_id',   'copilot_conversations', ['user_id'])
    op.create_index('ix_copilot_conv_session_id','copilot_conversations', ['session_id'])
    op.create_index('ix_copilot_conv_intent',    'copilot_conversations', ['intent'])
    op.create_index('ix_copilot_conv_created_at','copilot_conversations', ['created_at'])


def downgrade():
    op.drop_index('ix_copilot_conv_created_at', table_name='copilot_conversations')
    op.drop_index('ix_copilot_conv_intent',     table_name='copilot_conversations')
    op.drop_index('ix_copilot_conv_session_id', table_name='copilot_conversations')
    op.drop_index('ix_copilot_conv_user_id',    table_name='copilot_conversations')
    op.drop_table('copilot_conversations')

    op.drop_index('ix_copilot_memory_key',    table_name='copilot_memories')
    op.drop_index('ix_copilot_memory_user_id',table_name='copilot_memories')
    op.drop_table('copilot_memories')
