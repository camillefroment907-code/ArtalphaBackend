"""
Nautilus Email Service — Unified API
All 49 email functions are accessible from this module.
Split across category modules for organization; re-exported here for backward compatibility.
"""

# ── Base utilities ─────────────────────────────────────────────────────────────
from app.services.email_base import (
    html_email,
    send_email,
    send_admin_notification,
    TRANSAC_FROM,
    ALERT_FROM,
    ADMIN_EMAIL,
)

# ── Category 1: Auth (emails 1–4) ─────────────────────────────────────────────
from app.services.email_auth import (
    send_verification_email,
    send_welcome_email,
    send_password_reset_email,
    send_email_changed_email,
)

# ── Category 2: Trial & Onboarding (emails 5–10) ──────────────────────────────
from app.services.email_trial import (
    send_trial_started_email,
    send_trial_j2_email,
    send_trial_j4_email,
    send_trial_j5_email,
    send_trial_ending_email,
    send_trial_expired_email,
)

# ── Category 3: Billing (emails 11–18) ────────────────────────────────────────
from app.services.email_billing import (
    send_payment_success_email,
    send_payment_failed_email,
    send_payment_retry_email,
    send_subscription_cancelled_email,
    send_annual_expiring_email,
    send_upgrade_confirmed_email,
    send_downgrade_confirmed_email,
    send_renewal_confirmed_email,
)

# Backward-compat alias used by billing.py webhook handler
send_subscription_canceled_email = send_subscription_cancelled_email

# ── Category 4: Alerts & Recommendations (emails 19–30) ───────────────────────
from app.services.email_alerts import (
    send_alert_exceptional_email,
    send_price_gap_alert_email,
    send_watchlist_closing_email,
    send_artist_record_email,
    send_weekly_momentum_email,
    send_wishlist_match_email,
    send_record_proximity_email,
    send_buy_dip_email,
    send_geo_opportunity_email,
    send_artist_gallery_upgrade_email,
    send_portfolio_artist_sale_email,
    send_collection_completion_email,
)

# Backward-compat alias used by tasks.py alert broadcasting
send_deal_alert_email = send_alert_exceptional_email

# ── Category 5: Newsletter & Content (emails 31–37) ───────────────────────────
from app.services.email_newsletters import (
    send_weekly_brief_email,
    send_monthly_report_email,
    send_sale_analysis_email,
    send_artist_spotlight_email,
    send_lot_of_week_email,
    send_quarterly_outlook_email,
    send_annual_review_email,
)

# ── Category 6: Portfolio & Performance (emails 38–42) ────────────────────────
from app.services.email_portfolio import (
    send_portfolio_valuation_email,
    send_performance_vs_market_email,
    send_artwork_anniversary_email,
    send_tax_reminder_email,
    send_portfolio_diversification_email,
)

# ── Category 7: Engagement & Retention (emails 43–47) ────────────────────────
from app.services.email_retention import (
    send_nps_email,
    send_reengagement_14_email,
    send_reengagement_30_email,
    send_winback_email,
    send_anniversary_email,
)

# Backward-compat alias
send_nps_survey_email = send_nps_email

# ── Category 8: Institutional & B2B (emails 48–49) ────────────────────────────
from app.services.email_institutional import (
    send_institutional_contact_email,
    send_family_office_report_email,
)

__all__ = [
    # base
    "html_email", "send_email", "send_admin_notification",
    "TRANSAC_FROM", "ALERT_FROM", "ADMIN_EMAIL",
    # auth
    "send_verification_email", "send_welcome_email",
    "send_password_reset_email", "send_email_changed_email",
    # trial
    "send_trial_started_email", "send_trial_j2_email", "send_trial_j4_email",
    "send_trial_j5_email", "send_trial_ending_email", "send_trial_expired_email",
    # billing
    "send_payment_success_email", "send_payment_failed_email", "send_payment_retry_email",
    "send_subscription_cancelled_email", "send_subscription_canceled_email",
    "send_annual_expiring_email", "send_upgrade_confirmed_email",
    "send_downgrade_confirmed_email", "send_renewal_confirmed_email",
    # alerts
    "send_alert_exceptional_email", "send_deal_alert_email",
    "send_price_gap_alert_email", "send_watchlist_closing_email",
    "send_artist_record_email", "send_weekly_momentum_email",
    "send_wishlist_match_email", "send_record_proximity_email",
    "send_buy_dip_email", "send_geo_opportunity_email",
    "send_artist_gallery_upgrade_email", "send_portfolio_artist_sale_email",
    "send_collection_completion_email",
    # newsletters
    "send_weekly_brief_email", "send_monthly_report_email", "send_sale_analysis_email",
    "send_artist_spotlight_email", "send_lot_of_week_email",
    "send_quarterly_outlook_email", "send_annual_review_email",
    # portfolio
    "send_portfolio_valuation_email", "send_performance_vs_market_email",
    "send_artwork_anniversary_email", "send_tax_reminder_email",
    "send_portfolio_diversification_email",
    # retention
    "send_nps_email", "send_nps_survey_email",
    "send_reengagement_14_email", "send_reengagement_30_email",
    "send_winback_email", "send_anniversary_email",
    # institutional
    "send_institutional_contact_email", "send_family_office_report_email",
]
