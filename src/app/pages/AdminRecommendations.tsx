/**
 * /admin/recommendations — Recommendation engine performance dashboard.
 */
import { useState, useEffect } from 'react';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function AdminRecommendations() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setError('Not authenticated'); setLoading(false); return; }
    fetch(`${BACKEND}/api/admin/recommendations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 40px' }}>
      <div style={{ marginBottom: '8px', fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em' }}>ADMIN</div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--text)', marginBottom: '32px' }}>Recommendation Engine</h1>

      {loading && <div style={{ color: 'var(--text-3)' }}>Loading…</div>}
      {error && <div style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>Error: {error}</div>}

      {data && (
        <>
          {/* Top-line metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
            {[
              { label: 'TOTAL IMPRESSIONS', value: data.events.total.toLocaleString() },
              { label: 'LAST 7 DAYS', value: data.events.last_7_days.toLocaleString() },
              { label: 'CLICK-THROUGH RATE', value: `${data.rates.ctr_pct}%` },
              { label: 'DISMISS RATE', value: `${data.rates.dismiss_rate_pct}%` },
            ].map(m => (
              <div key={m.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px 20px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '8px' }}>{m.label}</div>
                <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--navy)' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Events breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
            {[
              { label: 'READS', value: data.events.reads },
              { label: 'DISMISSALS', value: data.events.dismissals },
              { label: 'ACTIONS', value: data.events.actions },
            ].map(m => (
              <div key={m.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 18px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '6px' }}>{m.label}</div>
                <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--navy)' }}>{m.value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* By rec type */}
          {Object.keys(data.by_type || {}).length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '12px' }}>BY REC TYPE</div>
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                {Object.entries(data.by_type)
                  .sort(([, a], [, b]) => Number(b) - Number(a))
                  .map(([type, count], i) => {
                    const pct = data.events.total ? Math.round(Number(count) / data.events.total * 100) : 0;
                    return (
                      <div key={type} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', alignItems: 'center', padding: '10px 16px', borderBottom: i < Object.keys(data.by_type).length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{type}</div>
                        <div style={{ width: '80px', height: '4px', background: 'var(--bg-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--navy)', borderRadius: '2px' }} />
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--font-mono)', minWidth: '40px', textAlign: 'right' }}>{Number(count).toLocaleString()}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            Generated: {new Date(data.generated_at).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}
