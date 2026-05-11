"""add_collection_sale_event_models

Revision ID: k1l2m3n4o5p6
Revises: j5k6l7m8n9o0
Create Date: 2026-05-11 00:01:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'k1l2m3n4o5p6'
down_revision: Union[str, None] = 'j5k6l7m8n9o0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── ALTER portfolio_items ──────────────────────────────────────────────────
    op.add_column('portfolio_items', sa.Column('artist_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('artists.id', ondelete='SET NULL'), nullable=True))
    op.add_column('portfolio_items', sa.Column('matched_lot_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lots.id', ondelete='SET NULL'), nullable=True))
    op.add_column('portfolio_items', sa.Column('matched_confidence', sa.Float(), nullable=True))
    op.add_column('portfolio_items', sa.Column('edition', sa.String(200), nullable=True))
    op.add_column('portfolio_items', sa.Column('condition', sa.String(100), nullable=True))
    op.add_column('portfolio_items', sa.Column('provenance', sa.Text(), nullable=True))
    op.add_column('portfolio_items', sa.Column('purchase_auction_house', sa.String(300), nullable=True))
    op.add_column('portfolio_items', sa.Column('purchase_location', sa.String(300), nullable=True))
    op.add_column('portfolio_items', sa.Column('certificate_of_authenticity', sa.Boolean(), nullable=True, server_default=sa.false()))
    op.add_column('portfolio_items', sa.Column('authenticated_by', sa.String(300), nullable=True))
    op.add_column('portfolio_items', sa.Column('authentication_date', sa.DateTime(), nullable=True))
    op.add_column('portfolio_items', sa.Column('authentication_document_url', sa.String(500), nullable=True))
    op.add_column('portfolio_items', sa.Column('catalogue_raisonne_reference', sa.String(300), nullable=True))
    op.add_column('portfolio_items', sa.Column('image_urls', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('portfolio_items', sa.Column('document_urls', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('portfolio_items', sa.Column('current_estimated_value_eur', sa.Float(), nullable=True))
    op.add_column('portfolio_items', sa.Column('last_estimated_at', sa.DateTime(), nullable=True))
    op.add_column('portfolio_items', sa.Column('estimation_confidence', sa.Float(), nullable=True))
    op.add_column('portfolio_items', sa.Column('sale_status', sa.String(50), nullable=True))
    op.add_column('portfolio_items', sa.Column('recommended_auction_house', sa.String(200), nullable=True))
    op.add_column('portfolio_items', sa.Column('recommended_reserve_price', sa.Float(), nullable=True))
    op.add_column('portfolio_items', sa.Column('recommended_sale_timing', sa.String(100), nullable=True))
    op.add_column('portfolio_items', sa.Column('timing_reasoning', sa.Text(), nullable=True))
    op.add_column('portfolio_items', sa.Column('insured_value_eur', sa.Float(), nullable=True))
    op.add_column('portfolio_items', sa.Column('insurance_provider', sa.String(200), nullable=True))
    op.add_column('portfolio_items', sa.Column('insurance_expiry_date', sa.DateTime(), nullable=True))
    op.add_column('portfolio_items', sa.Column('storage_location', sa.String(300), nullable=True))
    op.add_column('portfolio_items', sa.Column('last_condition_report_date', sa.DateTime(), nullable=True))
    op.add_column('portfolio_items', sa.Column('beneficiary_name', sa.String(200), nullable=True))
    op.add_column('portfolio_items', sa.Column('beneficiary_contact', sa.String(200), nullable=True))
    op.add_column('portfolio_items', sa.Column('inheritance_notes', sa.Text(), nullable=True))
    op.add_column('portfolio_items', sa.Column('previous_owners', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('portfolio_items', sa.Column('exhibition_history', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('portfolio_items', sa.Column('literature_references', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('portfolio_items', sa.Column('auction_history', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('portfolio_items', sa.Column('country_of_origin', sa.String(100), nullable=True))
    op.add_column('portfolio_items', sa.Column('acquisition_tax_paid_eur', sa.Float(), nullable=True))
    op.add_column('portfolio_items', sa.Column('import_duties_eur', sa.Float(), nullable=True))

    # ── ALTER collector_dna ────────────────────────────────────────────────────
    op.add_column('collector_dna', sa.Column('nationality', sa.String(100), nullable=True))
    op.add_column('collector_dna', sa.Column('country_of_residence', sa.String(100), nullable=True))
    op.add_column('collector_dna', sa.Column('profession', sa.String(200), nullable=True))
    op.add_column('collector_dna', sa.Column('annual_art_budget_eur', sa.Float(), nullable=True))
    op.add_column('collector_dna', sa.Column('total_collection_value_eur', sa.Float(), nullable=True))
    op.add_column('collector_dna', sa.Column('years_collecting', sa.Integer(), nullable=True))
    op.add_column('collector_dna', sa.Column('favorite_periods', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('collector_dna', sa.Column('favorite_movements', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('collector_dna', sa.Column('geographic_focus', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('collector_dna', sa.Column('liquidity_preference', sa.String(50), nullable=True))
    op.add_column('collector_dna', sa.Column('target_return_pct', sa.Float(), nullable=True))
    op.add_column('collector_dna', sa.Column('tax_jurisdiction', sa.String(100), nullable=True))
    op.add_column('collector_dna', sa.Column('preferred_auction_houses', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('collector_dna', sa.Column('preferred_galleries', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")))
    op.add_column('collector_dna', sa.Column('profile_completeness_pct', sa.Float(), nullable=True))
    op.add_column('collector_dna', sa.Column('onboarding_completed_at', sa.DateTime(), nullable=True))
    op.add_column('collector_dna', sa.Column('last_active_at', sa.DateTime(), nullable=True))
    op.add_column('collector_dna', sa.Column('total_lots_viewed_all', sa.Integer(), nullable=True, server_default=sa.text("'0'")))
    op.add_column('collector_dna', sa.Column('avg_session_duration_s', sa.Float(), nullable=True))

    # ── CREATE new tables ──────────────────────────────────────────────────────
    op.create_table(
        'collection_valuations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('collection_item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('portfolio_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('estimated_value_eur', sa.Float(), nullable=False),
        sa.Column('estimation_date', sa.DateTime(), nullable=False),
        sa.Column('method', sa.String(100), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('comparables_used', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")),
        sa.Column('comparable_lots_ids', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")),
        sa.Column('market_trend_3m', sa.Float(), nullable=True),
        sa.Column('market_trend_12m', sa.Float(), nullable=True),
        sa.Column('liquidity_score', sa.Float(), nullable=True),
        sa.Column('best_time_to_sell', sa.String(50), nullable=True),
        sa.Column('market_context', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_collection_valuations_item_id', 'collection_valuations', ['collection_item_id'])
    op.create_index('ix_collection_valuations_user_id', 'collection_valuations', ['user_id'])
    op.create_index('ix_collection_valuations_date',    'collection_valuations', ['estimation_date'])

    op.create_table(
        'collection_loans',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('collection_item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('portfolio_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('institution_name', sa.String(300), nullable=False),
        sa.Column('exhibition_name', sa.String(300), nullable=True),
        sa.Column('loan_start_date', sa.DateTime(), nullable=True),
        sa.Column('loan_end_date', sa.DateTime(), nullable=True),
        sa.Column('loan_status', sa.String(50), nullable=True, server_default=sa.text("'active'")),
        sa.Column('contact_name', sa.String(200), nullable=True),
        sa.Column('contact_email', sa.String(200), nullable=True),
        sa.Column('insurance_value_eur', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('document_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_collection_loans_item_id', 'collection_loans', ['collection_item_id'])
    op.create_index('ix_collection_loans_user_id', 'collection_loans', ['user_id'])
    op.create_index('ix_collection_loans_status',  'collection_loans', ['loan_status'])

    op.create_table(
        'collection_interventions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('collection_item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('portfolio_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('intervention_type', sa.String(100), nullable=False),
        sa.Column('intervention_date', sa.DateTime(), nullable=True),
        sa.Column('provider', sa.String(300), nullable=True),
        sa.Column('cost_eur', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('document_url', sa.String(500), nullable=True),
        sa.Column('before_image_url', sa.String(500), nullable=True),
        sa.Column('after_image_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_collection_interventions_item_id', 'collection_interventions', ['collection_item_id'])
    op.create_index('ix_collection_interventions_user_id', 'collection_interventions', ['user_id'])

    op.create_table(
        'sale_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('collection_item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('portfolio_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(50), nullable=True, server_default=sa.text("'draft'")),
        sa.Column('preferred_auction_house', sa.String(200), nullable=True),
        sa.Column('reserve_price_eur', sa.Float(), nullable=True),
        sa.Column('nautilus_recommended_house', sa.String(200), nullable=True),
        sa.Column('nautilus_recommended_price', sa.Float(), nullable=True),
        sa.Column('nautilus_recommended_timing', sa.String(100), nullable=True),
        sa.Column('comparable_lots', sa.JSON(), nullable=True, server_default=sa.text("'[]'::json")),
        sa.Column('market_analysis', sa.Text(), nullable=True),
        sa.Column('catalogue_notice_fr', sa.Text(), nullable=True),
        sa.Column('catalogue_notice_en', sa.Text(), nullable=True),
        sa.Column('comparables_report_url', sa.String(500), nullable=True),
        sa.Column('valuation_certificate_url', sa.String(500), nullable=True),
        sa.Column('estimated_capital_gain_eur', sa.Float(), nullable=True),
        sa.Column('tax_rate_applicable', sa.Float(), nullable=True),
        sa.Column('net_proceeds_after_tax_eur', sa.Float(), nullable=True),
        sa.Column('buyer_user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('transaction_status', sa.String(50), nullable=True),
        sa.Column('escrow_status', sa.String(50), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('matched_at', sa.DateTime(), nullable=True),
        sa.Column('sold_at', sa.DateTime(), nullable=True),
        sa.Column('sold_price_eur', sa.Float(), nullable=True),
        sa.Column('commission_rate', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_sale_requests_item_id', 'sale_requests', ['collection_item_id'])
    op.create_index('ix_sale_requests_user_id', 'sale_requests', ['user_id'])
    op.create_index('ix_sale_requests_status',  'sale_requests', ['status'])

    op.create_table(
        'sale_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('sale_request_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('sale_requests.id', ondelete='CASCADE'), nullable=True),
        sa.Column('collection_item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('portfolio_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_type', sa.String(100), nullable=False),
        sa.Column('content_html', sa.Text(), nullable=True),
        sa.Column('content_pdf_url', sa.String(500), nullable=True),
        sa.Column('generated_at', sa.DateTime(), nullable=False),
        sa.Column('generated_by', sa.String(100), nullable=True),
        sa.Column('language', sa.String(10), nullable=True, server_default=sa.text("'fr'")),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_sale_documents_sale_request_id',    'sale_documents', ['sale_request_id'])
    op.create_index('ix_sale_documents_collection_item_id', 'sale_documents', ['collection_item_id'])
    op.create_index('ix_sale_documents_user_id',            'sale_documents', ['user_id'])

    op.create_table(
        'portfolio_alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('collection_item_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('portfolio_items.id', ondelete='CASCADE'), nullable=True),
        sa.Column('alert_type', sa.String(100), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column('last_triggered_at', sa.DateTime(), nullable=True),
        sa.Column('similar_lot_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('lots.id', ondelete='SET NULL'), nullable=True),
        sa.Column('trigger_metadata', sa.JSON(), nullable=True, server_default=sa.text("'{}'::json")),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_portfolio_alerts_user_id', 'portfolio_alerts', ['user_id'])
    op.create_index('ix_portfolio_alerts_item_id', 'portfolio_alerts', ['collection_item_id'])
    op.create_index('ix_portfolio_alerts_type',    'portfolio_alerts', ['alert_type'])

    op.create_table(
        'user_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('session_id', sa.String(100), nullable=True),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', sa.String(100), nullable=True),
        sa.Column('properties', sa.JSON(), nullable=True, server_default=sa.text("'{}'::json")),
        sa.Column('page', sa.String(200), nullable=True),
        sa.Column('referrer', sa.String(500), nullable=True),
        sa.Column('device', sa.String(100), nullable=True),
        sa.Column('country', sa.String(10), nullable=True),
        sa.Column('ip_hash', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_user_events_user_event_date', 'user_events', ['user_id', 'event_type', 'created_at'])
    op.create_index('ix_user_events_session_id',      'user_events', ['session_id'])
    op.create_index('ix_user_events_entity',          'user_events', ['entity_type', 'entity_id'])

    op.create_table(
        'platform_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('snapshot_date', sa.DateTime(), nullable=False, unique=True),
        sa.Column('total_users', sa.Integer(), nullable=True, server_default=sa.text("'0'")),
        sa.Column('total_paying_users', sa.Integer(), nullable=True, server_default=sa.text("'0'")),
        sa.Column('total_collection_items', sa.Integer(), nullable=True, server_default=sa.text("'0'")),
        sa.Column('total_aum_eur', sa.Float(), nullable=True, server_default=sa.text("'0'")),
        sa.Column('total_sale_requests', sa.Integer(), nullable=True, server_default=sa.text("'0'")),
        sa.Column('total_valuations_generated', sa.Integer(), nullable=True, server_default=sa.text("'0'")),
        sa.Column('avg_collection_value_eur', sa.Float(), nullable=True),
        sa.Column('top_artists_held', sa.JSON(), nullable=True, server_default=sa.text("'{}'::json")),
        sa.Column('geographic_distribution', sa.JSON(), nullable=True, server_default=sa.text("'{}'::json")),
        sa.Column('total_agent_alerts', sa.Integer(), nullable=True, server_default=sa.text("'0'")),
        sa.Column('total_agent_emails_sent', sa.Integer(), nullable=True, server_default=sa.text("'0'")),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_platform_metrics_snapshot_date', 'platform_metrics', ['snapshot_date'])


def downgrade() -> None:
    # ── Drop indexes (reverse order) ───────────────────────────────────────────
    op.drop_index('ix_platform_metrics_snapshot_date', table_name='platform_metrics')
    op.drop_index('ix_user_events_entity',          table_name='user_events')
    op.drop_index('ix_user_events_session_id',      table_name='user_events')
    op.drop_index('ix_user_events_user_event_date', table_name='user_events')
    op.drop_index('ix_portfolio_alerts_type',    table_name='portfolio_alerts')
    op.drop_index('ix_portfolio_alerts_item_id', table_name='portfolio_alerts')
    op.drop_index('ix_portfolio_alerts_user_id', table_name='portfolio_alerts')
    op.drop_index('ix_sale_documents_user_id',            table_name='sale_documents')
    op.drop_index('ix_sale_documents_collection_item_id', table_name='sale_documents')
    op.drop_index('ix_sale_documents_sale_request_id',    table_name='sale_documents')
    op.drop_index('ix_sale_requests_status',  table_name='sale_requests')
    op.drop_index('ix_sale_requests_user_id', table_name='sale_requests')
    op.drop_index('ix_sale_requests_item_id', table_name='sale_requests')
    op.drop_index('ix_collection_interventions_user_id', table_name='collection_interventions')
    op.drop_index('ix_collection_interventions_item_id', table_name='collection_interventions')
    op.drop_index('ix_collection_loans_status',  table_name='collection_loans')
    op.drop_index('ix_collection_loans_user_id', table_name='collection_loans')
    op.drop_index('ix_collection_loans_item_id', table_name='collection_loans')
    op.drop_index('ix_collection_valuations_date',    table_name='collection_valuations')
    op.drop_index('ix_collection_valuations_user_id', table_name='collection_valuations')
    op.drop_index('ix_collection_valuations_item_id', table_name='collection_valuations')

    # ── Drop new tables (reverse order) ───────────────────────────────────────
    op.drop_table('platform_metrics')
    op.drop_table('user_events')
    op.drop_table('portfolio_alerts')
    op.drop_table('sale_documents')
    op.drop_table('sale_requests')
    op.drop_table('collection_interventions')
    op.drop_table('collection_loans')
    op.drop_table('collection_valuations')

    # ── Drop columns from collector_dna (reverse order) ───────────────────────
    op.drop_column('collector_dna', 'avg_session_duration_s')
    op.drop_column('collector_dna', 'total_lots_viewed_all')
    op.drop_column('collector_dna', 'last_active_at')
    op.drop_column('collector_dna', 'onboarding_completed_at')
    op.drop_column('collector_dna', 'profile_completeness_pct')
    op.drop_column('collector_dna', 'preferred_galleries')
    op.drop_column('collector_dna', 'preferred_auction_houses')
    op.drop_column('collector_dna', 'tax_jurisdiction')
    op.drop_column('collector_dna', 'target_return_pct')
    op.drop_column('collector_dna', 'liquidity_preference')
    op.drop_column('collector_dna', 'geographic_focus')
    op.drop_column('collector_dna', 'favorite_movements')
    op.drop_column('collector_dna', 'favorite_periods')
    op.drop_column('collector_dna', 'years_collecting')
    op.drop_column('collector_dna', 'total_collection_value_eur')
    op.drop_column('collector_dna', 'annual_art_budget_eur')
    op.drop_column('collector_dna', 'profession')
    op.drop_column('collector_dna', 'country_of_residence')
    op.drop_column('collector_dna', 'nationality')

    # ── Drop columns from portfolio_items (reverse order) ─────────────────────
    op.drop_column('portfolio_items', 'import_duties_eur')
    op.drop_column('portfolio_items', 'acquisition_tax_paid_eur')
    op.drop_column('portfolio_items', 'country_of_origin')
    op.drop_column('portfolio_items', 'auction_history')
    op.drop_column('portfolio_items', 'literature_references')
    op.drop_column('portfolio_items', 'exhibition_history')
    op.drop_column('portfolio_items', 'previous_owners')
    op.drop_column('portfolio_items', 'inheritance_notes')
    op.drop_column('portfolio_items', 'beneficiary_contact')
    op.drop_column('portfolio_items', 'beneficiary_name')
    op.drop_column('portfolio_items', 'last_condition_report_date')
    op.drop_column('portfolio_items', 'storage_location')
    op.drop_column('portfolio_items', 'insurance_expiry_date')
    op.drop_column('portfolio_items', 'insurance_provider')
    op.drop_column('portfolio_items', 'insured_value_eur')
    op.drop_column('portfolio_items', 'timing_reasoning')
    op.drop_column('portfolio_items', 'recommended_sale_timing')
    op.drop_column('portfolio_items', 'recommended_reserve_price')
    op.drop_column('portfolio_items', 'recommended_auction_house')
    op.drop_column('portfolio_items', 'sale_status')
    op.drop_column('portfolio_items', 'estimation_confidence')
    op.drop_column('portfolio_items', 'last_estimated_at')
    op.drop_column('portfolio_items', 'current_estimated_value_eur')
    op.drop_column('portfolio_items', 'document_urls')
    op.drop_column('portfolio_items', 'image_urls')
    op.drop_column('portfolio_items', 'catalogue_raisonne_reference')
    op.drop_column('portfolio_items', 'authentication_document_url')
    op.drop_column('portfolio_items', 'authentication_date')
    op.drop_column('portfolio_items', 'authenticated_by')
    op.drop_column('portfolio_items', 'certificate_of_authenticity')
    op.drop_column('portfolio_items', 'purchase_location')
    op.drop_column('portfolio_items', 'purchase_auction_house')
    op.drop_column('portfolio_items', 'provenance')
    op.drop_column('portfolio_items', 'condition')
    op.drop_column('portfolio_items', 'edition')
    op.drop_column('portfolio_items', 'matched_confidence')
    op.drop_column('portfolio_items', 'matched_lot_id')
    op.drop_column('portfolio_items', 'artist_id')
