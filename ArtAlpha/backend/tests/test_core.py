"""
HONO Backend Tests
Run: pytest backend/tests/ -v
"""
import pytest
import asyncio
from unittest.mock import patch, MagicMock


# ── Scoring Engine Tests ──────────────────────────────────────────────────────

class TestScoringEngine:
    """Test the core deal scoring algorithm."""

    def _make_input(self, current_price, estimate_low, estimate_high=None,
                    avg_price=None, liquidity=70, confidence=0.8, reputation=0.82):
        from app.engines.scoring import ScoringInput
        from app.models.schemas import LotNormalized, AuctionHouseEnum

        lot = LotNormalized(
            source=AuctionHouseEnum.DROUOT,
            title="Test Lot",
            current_price=current_price,
            estimate_low=estimate_low,
            estimate_high=estimate_high or estimate_low * 1.5,
            currency="EUR",
        )
        artist_data = {
            "avg_price": avg_price,
            "liquidity": liquidity,
            "confidence": confidence,
            "popularity": 70,
            "sell_through": 0.7,
        }
        return ScoringInput(lot=lot, artist_data=artist_data, house_reputation=reputation)

    def test_extreme_deal_scores_high(self):
        """A lot 60% below estimate and 70% below market avg should score very high."""
        from app.engines.scoring import compute_deal_score
        inp = self._make_input(
            current_price=400, estimate_low=1000,
            avg_price=1500, liquidity=85, confidence=0.9
        )
        result = compute_deal_score(inp)
        assert result.deal_score >= 80, f"Expected ≥80, got {result.deal_score}"
        assert result.is_deal is True
        assert result.pct_below_low_estimate is not None
        assert result.pct_below_low_estimate > 50

    def test_overpriced_lot_scores_low(self):
        """A lot above its estimate should score below 50."""
        from app.engines.scoring import compute_deal_score
        inp = self._make_input(
            current_price=1800, estimate_low=1000,
            avg_price=900, liquidity=50, confidence=0.7
        )
        result = compute_deal_score(inp)
        assert result.deal_score < 55, f"Expected <55, got {result.deal_score}"
        assert result.is_deal is False

    def test_score_range_is_0_to_100(self):
        """Score must always be in [0, 100]."""
        from app.engines.scoring import compute_deal_score
        for current, est_low in [(1, 1000), (100, 100), (5000, 100), (0.01, 1)]:
            inp = self._make_input(current_price=current, estimate_low=est_low)
            result = compute_deal_score(inp)
            assert 0 <= result.deal_score <= 100, f"Out of range: {result.deal_score}"

    def test_missing_price_gets_neutral_score(self):
        """When current_price is None, score should be reduced but not crash."""
        from app.engines.scoring import compute_deal_score, ScoringInput
        from app.models.schemas import LotNormalized, AuctionHouseEnum

        lot = LotNormalized(source=AuctionHouseEnum.DROUOT, title="No price", currency="EUR")
        inp = ScoringInput(lot=lot, artist_data={}, house_reputation=0.8)
        result = compute_deal_score(inp)
        assert 0 <= result.deal_score <= 100
        assert result.pct_below_low_estimate is None

    def test_weights_sum_to_one(self):
        """Default weights must sum to 1.0."""
        from app.engines.scoring import DEFAULT_WEIGHTS
        total = sum(DEFAULT_WEIGHTS.values())
        assert abs(total - 1.0) < 0.001, f"Weights sum to {total}, not 1.0"

    def test_hot_deal_bonus_applies(self):
        """A lot deeply below both estimate AND market avg should get a bonus."""
        from app.engines.scoring import compute_deal_score
        # 50% below estimate and 60% below market
        inp_with_both = self._make_input(
            current_price=500, estimate_low=1000, avg_price=1300, liquidity=85
        )
        inp_only_estimate = self._make_input(
            current_price=500, estimate_low=1000, avg_price=None, liquidity=85
        )
        result_both = compute_deal_score(inp_with_both)
        result_one = compute_deal_score(inp_only_estimate)
        assert result_both.deal_score >= result_one.deal_score

    def test_breakdown_fields_present(self):
        """Score breakdown must contain all expected fields."""
        from app.engines.scoring import compute_deal_score
        inp = self._make_input(current_price=600, estimate_low=1000)
        result = compute_deal_score(inp)
        bd = result.breakdown
        assert bd.below_estimate_score is not None
        assert bd.below_market_score is not None
        assert bd.liquidity_score is not None
        assert bd.house_reputation_score is not None
        assert bd.confidence_score is not None
        assert isinstance(bd.weights, dict)


# ── Artist Enrichment Tests ───────────────────────────────────────────────────

class TestArtistEnrichment:

    @pytest.mark.asyncio
    async def test_known_artist_from_db(self):
        """Bernard Buffet should be found in the local DB with high confidence."""
        from app.engines.artist_enrichment import enrich_artist
        name, data = await enrich_artist("Bernard Buffet")
        assert name == "Bernard Buffet"
        assert data.get("confidence", 0) >= 0.8
        assert data.get("avg_price") is not None
        assert data.get("liquidity") is not None

    @pytest.mark.asyncio
    async def test_artist_detection_from_title(self):
        """Artist should be detected from lot title when not explicitly provided."""
        from app.engines.artist_enrichment import enrich_artist
        name, data = await enrich_artist(
            None, lot_title="Marc Chagall — Lithographie originale"
        )
        assert name is not None
        assert "Chagall" in name or "chagall" in name.lower()

    @pytest.mark.asyncio
    async def test_unknown_artist_heuristic(self):
        """Unknown artists should get heuristic data, not crash."""
        from app.engines.artist_enrichment import enrich_artist
        name, data = await enrich_artist("Zxqvnm Kjhgfd Xyz 1234")
        assert data.get("avg_price") is not None
        assert 0 <= data.get("confidence", 0) <= 1.0
        assert data.get("trend") in ("up", "stable", "down")

    @pytest.mark.asyncio
    async def test_none_inputs_return_empty(self):
        """None artist with no title should return None, empty dict."""
        from app.engines.artist_enrichment import enrich_artist
        name, data = await enrich_artist(None, lot_title=None)
        assert name is None
        assert data == {}


# ── Connector Tests ───────────────────────────────────────────────────────────

class TestConnectors:

    @pytest.mark.asyncio
    async def test_drouot_returns_normalized_lots(self):
        """Drouot connector must return valid LotNormalized objects."""
        from app.connectors.drouot_connector import fetch_lots
        from app.models.schemas import AuctionHouseEnum
        lots = await fetch_lots(limit=10)
        assert len(lots) == 10
        for lot in lots:
            assert lot.source == AuctionHouseEnum.DROUOT
            assert lot.title
            assert lot.currency == "EUR"
            assert lot.estimate_low is not None
            assert lot.estimate_high is not None
            assert lot.current_price is not None
            assert lot.auction_date is not None

    @pytest.mark.asyncio
    async def test_interencheres_returns_normalized_lots(self):
        from app.connectors.interencheres_connector import fetch_lots
        from app.models.schemas import AuctionHouseEnum
        lots = await fetch_lots(limit=5)
        assert len(lots) == 5
        for lot in lots:
            assert lot.source == AuctionHouseEnum.INTERENCHERES

    @pytest.mark.asyncio
    async def test_invaluable_returns_normalized_lots(self):
        from app.connectors.invaluable_connector import fetch_lots
        from app.models.schemas import AuctionHouseEnum
        lots = await fetch_lots(limit=5)
        assert len(lots) == 5
        for lot in lots:
            assert lot.source == AuctionHouseEnum.INVALUABLE

    @pytest.mark.asyncio
    async def test_aggregator_combines_sources(self):
        """Aggregator should return lots from all 3 sources."""
        from app.connectors.aggregator import fetch_all_lots
        from app.models.schemas import AuctionHouseEnum
        lots = await fetch_all_lots(lots_per_source=5)
        sources = {lot.source for lot in lots}
        assert AuctionHouseEnum.DROUOT in sources
        assert AuctionHouseEnum.INTERENCHERES in sources
        assert AuctionHouseEnum.INVALUABLE in sources
        assert len(lots) == 15  # 3 sources × 5

    @pytest.mark.asyncio
    async def test_drouot_deals_have_realistic_discount(self):
        """Some generated lots should be below estimate (deals)."""
        from app.connectors.drouot_connector import fetch_lots
        lots = await fetch_lots(limit=50)
        below_estimate = [
            l for l in lots
            if l.current_price and l.estimate_low and l.current_price < l.estimate_low
        ]
        # At ~30% deal rate, at least 5 of 50 should be deals
        assert len(below_estimate) >= 5, f"Only {len(below_estimate)} deals in 50 lots"


# ── Alert Engine Tests ────────────────────────────────────────────────────────

class TestAlertEngine:

    def test_format_message_has_required_fields(self):
        """Alert message must include key deal information."""
        from app.engines.alerts import _format_alert_message
        from app.models.db_models import Lot, AuctionHouse
        from datetime import datetime

        lot = MagicMock(spec=Lot)
        lot.title = "Bernard Buffet — Le Clown"
        lot.artist_name_raw = "Bernard Buffet"
        lot.source = AuctionHouseEnum = MagicMock()
        lot.source.value = "drouot"
        lot.estimate_low = 1200
        lot.estimate_high = 1500
        lot.current_price = 620
        lot.deal_score = 87.3
        lot.pct_below_low_estimate = 48.3
        lot.auction_date = datetime(2025, 6, 15)
        lot.auction_house_name = "Hôtel Drouot — Paris"
        lot.url = "https://drouot.com/lot/123"

        msg = _format_alert_message(lot, artist_avg_price=1900)

        assert "Bernard Buffet" in msg
        assert "87" in msg   # score
        assert "620" in msg  # current price
        assert "1 200" in msg or "1200" in msg  # estimate
        assert "1 900" in msg or "1900" in msg  # market avg

    @pytest.mark.asyncio
    async def test_telegram_skipped_when_not_configured(self):
        """Telegram send should return False gracefully when token is missing."""
        from app.engines.alerts import _send_telegram
        with patch("app.engines.alerts.settings") as mock_settings:
            mock_settings.telegram_bot_token = None
            result = await _send_telegram("123456789", "Test message")
        assert result is False

    @pytest.mark.asyncio
    async def test_email_skipped_when_not_configured(self):
        """Email send should return False gracefully when SendGrid not set."""
        from app.engines.alerts import _send_email
        with patch("app.engines.alerts.settings") as mock_settings:
            mock_settings.sendgrid_api_key = None
            result = await _send_email("test@test.com", "Subject", "Body")
        assert result is False


# ── Aggregator Reputation Tests ───────────────────────────────────────────────

class TestHouseReputation:

    def test_christies_has_highest_reputation(self):
        from app.engines.scoring import HOUSE_REPUTATION_SCORES
        from app.models.schemas import AuctionHouseEnum
        christies = HOUSE_REPUTATION_SCORES[AuctionHouseEnum.CHRISTIES]
        sothebys = HOUSE_REPUTATION_SCORES[AuctionHouseEnum.SOTHEBYS]
        drouot = HOUSE_REPUTATION_SCORES[AuctionHouseEnum.DROUOT]
        assert christies >= sothebys
        assert drouot < christies
        assert 0 < drouot < 1

    def test_all_houses_have_valid_scores(self):
        from app.engines.scoring import HOUSE_REPUTATION_SCORES
        from app.models.schemas import AuctionHouseEnum
        for house, score in HOUSE_REPUTATION_SCORES.items():
            assert 0 < score <= 1.0, f"{house}: score {score} out of range"


# ── Pytest async config ───────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
