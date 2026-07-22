"""
Static EUR exchange rates for indicative display on the public landing page.

Source  : ECB via Frankfurter API (api.frankfurter.dev)
Snapshot: approx. July 2025
Review  : update at the start of each quarter.

These intentionally diverge from lib/fx.py (which fetches live rates for
internal engine calculations). A stable snapshot ensures consistent display
for all visitors between rate-refresh cycles, with no network dependency.
"""
from decimal import Decimal

EUR_EXCHANGE_RATES: dict[str, Decimal] = {
    "EUR": Decimal("1"),
    "SEK": Decimal("0.087"),  # Swedish krona  — Bukowskis, Auctionet
    "DKK": Decimal("0.134"),  # Danish krone   — Bruun Rasmussen
    "GBP": Decimal("1.17"),   # British pound  — Bonhams, Phillips, Christie's UK
    "USD": Decimal("0.86"),   # US dollar      — Heritage, Christie's NY
}
