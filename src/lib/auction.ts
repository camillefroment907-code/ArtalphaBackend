/**
 * Shared auction utilities — single source of truth for time display.
 *
 * Rule: Python isoformat() returns naive UTC without 'Z'.
 * JS parses that as LOCAL time → wrong in non-UTC timezones.
 * All date parsing must go through parseUTC().
 */

// ── UTC parsing ───────────────────────────────────────────────────────────────

export function parseUTC(iso: string): number {
  if (!iso.endsWith('Z') && !/[+\-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso + 'Z').getTime();
  }
  return new Date(iso).getTime();
}

// ── Auction state ─────────────────────────────────────────────────────────────

export function isLiveLot(status: string | null | undefined): boolean {
  return status === 'live';
}

// ── Time label — state-dependent ──────────────────────────────────────────────
// live=true  → "Se termine dans X" (bidding is ongoing)
// live=false → "Ouverture dans X"  (auction hasn't started yet)

export interface TimeLabel {
  label:  string;
  urgent: boolean;
  color:  string;
}

export function timeLabel(iso: string, live: boolean): TimeLabel {
  const ms  = parseUTC(iso) - Date.now();
  const h   = Math.floor(ms / 3600000);
  const min = Math.floor(ms / 60000);

  if (live) {
    if (ms <= 0)  return { label: 'Terminée',                   urgent: false, color: 'var(--text-3)' };
    if (min < 60) return { label: `Se termine dans ${min} min`, urgent: true,  color: '#ef4444'       };
    if (h < 6)    return { label: `Se termine dans ${h}h`,      urgent: true,  color: '#f97316'       };
    if (h < 24)   return { label: "Se termine aujourd'hui",     urgent: true,  color: 'var(--gold)'   };
                  return { label: 'Se termine demain',          urgent: false, color: 'var(--text-3)' };
  } else {
    if (ms <= 0)  return { label: 'Ouverte maintenant',         urgent: true,  color: '#22c55e'       };
    if (min < 60) return { label: `Ouverture dans ${min} min`,  urgent: true,  color: '#f97316'       };
    if (h < 6)    return { label: `Ouverture dans ${h}h`,       urgent: false, color: 'var(--gold)'   };
    if (h < 24)   return { label: "Ouverture aujourd'hui",      urgent: false, color: 'var(--text-3)' };
                  return { label: 'Ouverture demain',           urgent: false, color: 'var(--text-3)' };
  }
}

// ── Convenience: is this lot still active (not ended)? ───────────────────────

export function isActiveAuction(auctionDate: string | null): boolean {
  if (!auctionDate) return true; // no date = unknown, show it
  return parseUTC(auctionDate) > Date.now();
}
