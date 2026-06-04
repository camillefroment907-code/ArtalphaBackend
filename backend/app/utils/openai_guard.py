"""
OpenAI quota guard — prevents 429 errors from killing the app.

Two isolated guards:
  bg_guard   — background jobs (rationale, market_sentiment, artist analysis)
  user_guard — user-facing features (Larry, Copilot)

Isolation guarantee: exhausting bg_guard never blocks user-facing features.

429 handling: block for 1 hour instead of permanently pinning to the daily limit.
A 429 is usually a transient RPM spike, not a true daily quota exhaustion.
"""
from datetime import date, datetime, timedelta


class _RateGuard:
    """Per-consumer OpenAI rate guard with daily limit + temporary 429 block."""

    def __init__(self, daily_limit: int, name: str = ""):
        self.daily_limit = daily_limit
        self.name = name
        self._count = 0
        self._last_reset = date.today()
        self._blocked_until: datetime | None = None

    def can_make_request(self) -> bool:
        today = date.today()
        if today != self._last_reset:
            self._count = 0
            self._last_reset = today
            self._blocked_until = None
        if self._blocked_until:
            if datetime.now() < self._blocked_until:
                return False
            self._blocked_until = None   # block expired — auto-clear
        return self._count < self.daily_limit

    def record_request(self) -> None:
        self._count += 1

    def mark_quota_exceeded(self) -> None:
        """Block for 1 hour. Does NOT pin permanently — 429s are often transient RPM limits."""
        self._blocked_until = datetime.now() + timedelta(hours=1)

    def get_usage(self) -> dict:
        return {
            "name":             self.name,
            "daily_count":      self._count,
            "daily_limit":      self.daily_limit,
            "remaining":        max(0, self.daily_limit - self._count),
            "can_make_request": self.can_make_request(),
            "blocked_until":    self._blocked_until.isoformat() if self._blocked_until else None,
        }


# ── Two isolated guards ────────────────────────────────────────────────────────

# Background jobs: rationale generation, market_sentiment, artist analysis.
# Exhausting this guard does NOT affect user-facing features.
bg_guard = _RateGuard(daily_limit=5_000, name="background")

# User-facing: Larry (chat), Copilot advisor.
# Protected from background job quota exhaustion.
user_guard = _RateGuard(daily_limit=3_000, name="user")


# ── Legacy module-level API — maps to bg_guard (backward compat) ──────────────
# Used by: rationale.py, market_sentiment.py, artists.py (unchanged callers)

def can_make_request() -> bool:
    return bg_guard.can_make_request()

def record_request() -> None:
    bg_guard.record_request()

def mark_quota_exceeded() -> None:
    bg_guard.mark_quota_exceeded()

def get_usage() -> dict:
    return bg_guard.get_usage()
