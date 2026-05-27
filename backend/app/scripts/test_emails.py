"""
Nautilus Email Test Script
Sends all 49 emails to camillefroment907@gmail.com with mock data.
Run: python -m app.scripts.test_emails
"""
import asyncio
import sys

ADMIN = "camillefroment907@gmail.com"
MOCK_USER = "Camille Froment"

# Mock data
MOCK_LOT = dict(
    artist="Zao Wou-Ki",
    title="Lithographie originale, 1972",
    house="Artcurial",
    date="2026-05-15",
    estimate="€8,000–12,000",
    score=84,
    upside=31,
)
MOCK_LOTS = [
    MOCK_LOT,
    dict(
        artist="Joan Miró",
        title="Composition, 1965",
        house="Christie's Paris",
        date="2026-05-20",
        estimate="€15,000–20,000",
        score=77,
        upside=22,
    ),
]
MOCK_ARTISTS = [
    dict(name="Zao Wou-Ki", momentum_pct=18, direction="up"),
    dict(name="Joan Miró", momentum_pct=12, direction="up"),
]
MOCK_PORTFOLIO_ARTISTS = [
    dict(name="Zao Wou-Ki", value="€45,000", change_pct=8.2),
    dict(name="Joan Miró", value="€32,000", change_pct=-2.1),
]


async def run_all():
    results = {}

    # ── CATEGORY 1: AUTH ──────────────────────────────────────────────────────
    from app.services.email_auth import (
        send_verification_email,
        send_welcome_email,
        send_password_reset_email,
        send_email_changed_email,
    )
    results["1_verify"] = await send_verification_email(
        ADMIN, "https://www.get-nautilus.com/verify?token=test123"
    )
    results["2_welcome"] = await send_welcome_email(ADMIN, MOCK_USER, "investor")
    results["3_password_reset"] = await send_password_reset_email(
        ADMIN, "https://www.get-nautilus.com/reset?token=test123"
    )
    results["4_email_changed"] = await send_email_changed_email(
        ADMIN, "new@example.com", "https://www.get-nautilus.com/reset?token=test123"
    )

    # ── CATEGORY 2: TRIAL ─────────────────────────────────────────────────────
    from app.services.email_trial import (
        send_trial_started_email,
        send_trial_ending_email,
        send_trial_expired_email,
    )
    results["5_trial_started"] = await send_trial_started_email(ADMIN, MOCK_USER, "May 1, 2026")
    results["6_trial_ending"] = await send_trial_ending_email(ADMIN, MOCK_USER, "May 1, 2026")
    results["7_trial_expired"] = await send_trial_expired_email(ADMIN, MOCK_USER, 1, 5)

    # ── CATEGORY 3: BILLING ───────────────────────────────────────────────────
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
    PORTAL = "https://billing.stripe.com/p/login/test"
    results["11_payment_success"] = await send_payment_success_email(
        ADMIN, MOCK_USER, "Investor", "€29", "June 1, 2026"
    )
    results["12_payment_failed"] = await send_payment_failed_email(
        ADMIN, MOCK_USER, "€29", "Investor", "April 23, 2026", PORTAL
    )
    results["13_payment_retry"] = await send_payment_retry_email(ADMIN, MOCK_USER, "Investor", PORTAL)
    results["14_subscription_cancelled"] = await send_subscription_cancelled_email(
        ADMIN, MOCK_USER, "Investor", "May 15, 2026"
    )
    results["15_annual_expiring"] = await send_annual_expiring_email(
        ADMIN, MOCK_USER, "Investor", "May 1, 2026", "€290", PORTAL
    )
    results["16_upgrade_confirmed"] = await send_upgrade_confirmed_email(
        ADMIN, MOCK_USER, "Collector", "Investor"
    )
    results["17_downgrade_confirmed"] = await send_downgrade_confirmed_email(
        ADMIN, MOCK_USER, "Investor", "Collector", "May 1, 2026"
    )
    results["18_renewal_confirmed"] = await send_renewal_confirmed_email(
        ADMIN, MOCK_USER, "Investor", "€290", "April 2027"
    )

    # ── CATEGORY 4: ALERTS ────────────────────────────────────────────────────
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
    LOT_URL = "https://get-nautilus.com/opportunities/test-id"
    ARTIST_URL = "https://www.get-nautilus.com/app/artists/zao-wou-ki"
    results["19_alert_exceptional"] = await send_alert_exceptional_email(
        ADMIN, "Zao Wou-Ki", 87, "Christie's Paris", "Lithographie originale, 1972",
        "May 15, 2026", "Paris", "€8,000–12,000", 34, LOT_URL, 3,
    )
    results["20_price_gap"] = await send_price_gap_alert_email(
        ADMIN, "Joan Miró", 28, 79, "€15,000", "€21,000", LOT_URL, "May 20, 2026"
    )
    results["21_watchlist_closing"] = await send_watchlist_closing_email(
        ADMIN, "Composition, 1965", "Joan Miró", "Christie's",
        "€15,000–20,000", 77, "Tomorrow at 2pm", LOT_URL,
    )
    results["22_artist_record"] = await send_artist_record_email(
        ADMIN, "Zao Wou-Ki", "€2.3M", "Christie's Hong Kong", 34, "€1.7M", ARTIST_URL
    )
    results["23_weekly_momentum"] = await send_weekly_momentum_email(
        ADMIN, MOCK_ARTISTS, MOCK_LOTS
    )
    results["24_wishlist_match"] = await send_wishlist_match_email(
        ADMIN, MOCK_USER, "Post-war prints under €20,000", "Zao Wou-Ki",
        "Lithographie, 1970", "Artcurial", "€12,000–15,000", 82, LOT_URL,
    )
    results["25_record_proximity"] = await send_record_proximity_email(
        ADMIN, "Zao Wou-Ki", "€1.4M", 18, "€1.7M", "Christie's Paris", LOT_URL
    )
    results["26_buy_dip"] = await send_buy_dip_email(
        ADMIN, "Joan Miró", 22, "2024 Q2", 8, ARTIST_URL
    )
    results["27_geo_opportunity"] = await send_geo_opportunity_email(
        ADMIN, "Drouot", 31, "Zao Wou-Ki", "€18,000",
        "Zao Wou-Ki", "€12,400", "€5,600", LOT_URL,
    )
    results["28_gallery_upgrade"] = await send_artist_gallery_upgrade_email(
        ADMIN, "Megan Rooney", "Hauser & Wirth", 47, ARTIST_URL
    )
    results["29_portfolio_artist_sale"] = await send_portfolio_artist_sale_email(
        ADMIN, "Zao Wou-Ki", "Artcurial", "Zao Wou-Ki",
        "Lithographie, 1968", "Artcurial · May 2026", "€10,000–14,000", 80, LOT_URL,
    )
    results["30_collection_completion"] = await send_collection_completion_email(
        ADMIN, "Post-War Prints", "Joan Miró", "Composition, 1965",
        "Christie's Paris · Est. €15,000–20,000", "€15,000–20,000", 77, LOT_URL,
    )

    # ── CATEGORY 5: NEWSLETTERS ───────────────────────────────────────────────
    from app.services.email_newsletters import (
        send_weekly_brief_email,
        send_monthly_report_email,
        send_sale_analysis_email,
        send_artist_spotlight_email,
        send_lot_of_week_email,
        send_quarterly_outlook_email,
        send_annual_review_email,
    )
    results["31_weekly_brief"] = await send_weekly_brief_email(
        ADMIN,
        "April 20, 2026",
        MOCK_LOTS,
        MOCK_ARTISTS,
        "Post-war prints are outperforming the broader contemporary market by 12% this quarter, driven by strong demand from Asian collectors at European auctions.",
        MOCK_LOTS[:1],
    )
    results["32_monthly_report"] = await send_monthly_report_email(
        ADMIN, "April", "2026", 12, 74, 4328,
        [
            dict(name="Post-War Prints", pct_change=12),
            dict(name="Contemporary Photography", pct_change=8),
        ],
        [dict(artist="Zao Wou-Ki", title="Lithographie, 1972", hammer="€18,400", house="Artcurial", note="Sold 54% above estimate")],
        ["Megan Rooney", "Cecily Brown"],
    )
    results["33_sale_analysis"] = await send_sale_analysis_email(
        ADMIN,
        "Christie's Paris Evening Sale",
        42, 87, 63,
        "€2.3M (Zao Wou-Ki)",
        [dict(artist="Zao Wou-Ki", title="Lithographie, 1972", hammer="€2.3M", estimate="€1.5–2M")],
        "A strong evening sale with sell-through above seasonal average. Post-war works significantly outperformed estimates, signaling continued collector demand.",
        "https://www.get-nautilus.com/blog/christies-paris-analysis",
    )
    results["34_artist_spotlight"] = await send_artist_spotlight_email(
        ADMIN,
        "Zao Wou-Ki",
        "Post-War Abstraction",
        "Chinese-French",
        "1935–2013",
        "Prices have risen 34% over the past 3 years, with accelerating demand from Hong Kong and Paris.",
        [
            "Retrospective at Centre Pompidou drew record attendance",
            "Three works exceeded €1M at Christie's Hong Kong in October",
            "Institutional acquisitions by Musée d'Art Moderne Paris",
        ],
        MOCK_LOTS,
        ARTIST_URL,
    )
    results["35_lot_of_week"] = await send_lot_of_week_email(
        ADMIN, 84,
        "Zao Wou-Ki",
        "Lithographie originale, 1972",
        "Artcurial",
        "€8,000–12,000",
        "May 15, 2026",
        "This lithograph represents a pivotal period in Zao Wou-Ki's career — his transition from calligraphic abstraction to more gestural, atmospheric compositions. The estimate is conservative relative to comparable works, which have traded between €14,000–18,000 over the past 24 months. Provenance is clean, and the seller appears motivated.",
        "Three comparable works sold at Artcurial in 2024–2025: €14,200 (2024), €16,800 (2025), €18,400 (2025). Median: €16,800.",
        LOT_URL,
    )
    results["36_quarterly_outlook"] = await send_quarterly_outlook_email(
        ADMIN, "Q2", "2026",
        [
            "Post-war prints continue to outperform",
            "Asian collector demand at European auctions is rising",
            "Photography segment seeing consolidation",
            "Institutional acquisitions slowing in Ultra-Contemporary",
        ],
        [
            dict(name="Post-War Prints", rationale="Strong sell-through and rising estimates suggest sustained demand"),
            dict(name="Works on Paper", rationale="Price correction creating entry opportunities"),
        ],
        ["Christie's Paris, May 15", "Sotheby's London, May 22", "Artcurial, June 3"],
    )
    results["37_annual_review"] = await send_annual_review_email(
        ADMIN, MOCK_USER, "2025",
        48392, 234,
        ["Zao Wou-Ki", "Joan Miró"],
        ["Post-War Prints", "Photography"],
        [
            dict(artist="Zao Wou-Ki", title="Composition, 1960", hammer="€2.3M", house="Christie's HK"),
            dict(artist="Joan Miró", title="Lithographie, 1968", hammer="€1.1M", house="Sotheby's"),
        ],
        187, 43, 12.4, 23, "2026",
    )

    # ── CATEGORY 6: PORTFOLIO ─────────────────────────────────────────────────
    from app.services.email_portfolio import (
        send_portfolio_valuation_email,
        send_performance_vs_market_email,
        send_artwork_anniversary_email,
        send_tax_reminder_email,
        send_portfolio_diversification_email,
    )
    results["38_portfolio_valuation"] = await send_portfolio_valuation_email(
        ADMIN, MOCK_USER, "April 2026", "€77,000", 4.2, 18.7, MOCK_PORTFOLIO_ARTISTS
    )
    results["39_performance_vs_market"] = await send_performance_vs_market_email(
        ADMIN, MOCK_USER, 18.7, 11.2, "12 months"
    )
    results["40_artwork_anniversary"] = await send_artwork_anniversary_email(
        ADMIN, "Lithographie originale, 1972", "Zao Wou-Ki",
        "€12,400", "€18,200", 46.8, 12,
    )
    results["41_tax_reminder"] = await send_tax_reminder_email(ADMIN, MOCK_USER)
    results["42_portfolio_diversification"] = await send_portfolio_diversification_email(
        ADMIN, MOCK_USER, "Post-War Prints", 72,
        [
            dict(artist="Gerhard Richter", title="Photo Painting, 1988", details="Sotheby's London · May 2026", estimate="€25,000–35,000", score=76),
            dict(artist="Cindy Sherman", title="Untitled Film Still #21, 1978", details="Phillips New York · June 2026", estimate="€18,000–24,000", score=71),
        ],
    )

    # ── CATEGORY 7: RETENTION ─────────────────────────────────────────────────
    from app.services.email_retention import (
        send_nps_email,
        send_reengagement_14_email,
        send_reengagement_30_email,
        send_winback_email,
        send_anniversary_email,
    )
    results["43_nps"] = await send_nps_email(ADMIN, MOCK_USER, "test-user-id-123")
    results["44_reengagement_14"] = await send_reengagement_14_email(
        ADMIN, MOCK_USER,
        7,
        "Zao Wou-Ki prices up 12% after Christie's Hong Kong record",
        "Post-war prints outperforming broader market by 8%",
        MOCK_LOTS,
    )
    results["45_reengagement_30"] = await send_reengagement_30_email(ADMIN, MOCK_USER)
    results["46_winback"] = await send_winback_email(ADMIN, MOCK_USER)
    results["47_anniversary"] = await send_anniversary_email(ADMIN, MOCK_USER, 187, 43, 12.4, 23)

    # ── CATEGORY 8: INSTITUTIONAL ─────────────────────────────────────────────
    from app.services.email_institutional import (
        send_institutional_contact_email,
        send_family_office_report_email,
    )
    results["48_institutional_contact"] = await send_institutional_contact_email(
        ADMIN, MOCK_USER,
        "Family Office Capital",
        "We're interested in the institutional plan for our 3 family offices.",
        "+33 6 12 34 56 78",
    )
    results["49_family_office_report"] = await send_family_office_report_email(
        ADMIN, MOCK_USER, "April", "2026",
        "The global art market showed resilience in Q1 2026, with auction turnover up 8% year-over-year. Post-war and contemporary segments led growth, while the ultra-contemporary segment continued its 2025 correction. Asian collector participation at European auctions reached a 5-year high.",
        [
            dict(name="Post-War Prints", pct_change=12.4, volume="€42M"),
            dict(name="Contemporary Photography", pct_change=8.1, volume="€18M"),
            dict(name="Works on Paper", pct_change=5.2, volume="€31M"),
            dict(name="Ultra-Contemporary", pct_change=-8.7, volume="€24M"),
        ],
        [
            dict(artist="Zao Wou-Ki", title="Composition, 1960", hammer="€2.3M", house="Christie's Hong Kong", note="New personal record, 54% above estimate"),
            dict(artist="Joan Miró", title="Lithographie, 1968", hammer="€1.1M", house="Sotheby's Paris", note="Sold to institutional buyer"),
        ],
        [
            dict(name="Megan Rooney", signal="Signed to Hauser & Wirth — institutional demand expected to increase"),
            dict(name="Cecily Brown", signal="Museum retrospective confirmed for 2027 — secondary market likely to respond"),
        ],
        [MOCK_LOT, MOCK_LOT],
        "Your tracked portfolio of €77,000 gained an estimated 4.2% this month, outperforming the Nautilus Art Index by 2.1 percentage points.",
        ["Christie's Paris, May 15", "Sotheby's London, May 22", "Phillips New York, June 3", "Artcurial, June 10"],
    )

    # ── RESULTS ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("NAUTILUS EMAIL TEST RESULTS")
    print("=" * 60)
    passed = sum(1 for v in results.values() if v)
    failed = sum(1 for v in results.values() if not v)
    for key, val in results.items():
        status = "✓ SENT" if val else "✗ FAILED"
        print(f"  {status}  {key}")
    print("=" * 60)
    print(f"  {passed}/49 sent · {failed} failed")
    print(f"  Check {ADMIN} for all emails.")
    print("=" * 60 + "\n")
    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_all())
    sys.exit(0 if success else 1)
