/**
 * dnaSignal.ts — CollectorDNA behavioral signal client
 *
 * Fire-and-forget: all functions return void and never throw.
 * Call these anywhere in the app to incrementally build the user's profile.
 */

const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('artalpha_auth');
    return raw ? JSON.parse(raw)?.token ?? null : null;
  } catch {
    return null;
  }
}

async function _send(body: Record<string, unknown>): Promise<void> {
  const token = getToken();
  if (!token) return; // not logged in — skip silently
  try {
    await fetch(`${API}/api/collector/signal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // fire-and-forget — swallow all errors
  }
}

/** User viewed a lot detail page */
export function signalView(lotId: string, durationSeconds?: number): void {
  _send({ signal_type: 'view', lot_id: lotId, duration_seconds: durationSeconds });
}

/** User saved/wishlisted a lot */
export function signalSave(lotId: string): void {
  _send({ signal_type: 'save', lot_id: lotId });
}

/** User dismissed a recommendation or lot card */
export function signalDismiss(lotId: string): void {
  _send({ signal_type: 'dismiss', lot_id: lotId });
}

/** User searched — pass artist name and/or category extracted from the query */
export function signalSearch(params: { artistName?: string; category?: string }): void {
  _send({
    signal_type: 'search',
    artist_name: params.artistName,
    category: params.category,
  });
}

/** User generated an investment memo for a lot */
export function signalMemo(lotId: string): void {
  _send({ signal_type: 'memo', lot_id: lotId });
}

/** User added a lot to their portfolio */
export function signalPortfolioAdd(lotId: string): void {
  _send({ signal_type: 'portfolio_add', lot_id: lotId });
}
