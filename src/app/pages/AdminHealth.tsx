/**
 * /admin/health — System health dashboard.
 * Requires admin JWT (camillefroment907@gmail.com).
 */
import { useState, useEffect } from 'react';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px 20px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--navy)' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

export default function AdminHealth() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setError('Not authenticated'); setLoading(false); return; }
    fetch(`${BACKEND}/api/admin/health`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 40px' }}>
      <div style={{ marginBottom: '8px', fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em' }}>ADMIN</div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--text)', marginBottom: '32px' }}>System Health</h1>

      {loading && <div style={{ color: 'var(--text-3)' }}>Loading…</div>}
      {error && <div style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>Error: {error}</div>}

      {data && (
        <>
          {/* Status banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', padding: '12px 16px', background: data.status === 'healthy' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${data.status === 'healthy' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: data.status === 'healthy' ? '#22c55e' : '#ef4444' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: data.status === 'healthy' ? '#15803d' : '#dc2626' }}>{data.status?.toUpperCase()}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-3)', marginLeft: '8px' }}>DB: {data.database}</span>
          </div>

          {/* Pipeline */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '12px' }}>PIPELINE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <Metric label="TOTAL LOTS" value={data.pipeline.total_lots.toLocaleString()} />
              <Metric label="LAST 24H" value={data.pipeline.lots_last_24h.toLocaleString()} />
              <Metric label="LAST 1H" value={data.pipeline.lots_last_1h.toLocaleString()} />
              <Metric label="MINS SINCE LAST" value={data.pipeline.minutes_since_last ?? '—'} sub="target: < 60" />
            </div>
          </div>

          {/* Scoring */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '12px' }}>SCORING</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <Metric label="SCORED %" value={`${data.pipeline.scored_pct}%`} sub="target: > 90%" />
              <Metric label="AVG SCORE" value={data.scoring.avg_score} />
              <Metric label="TOP SCORE" value={data.scoring.top_score} />
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            Generated: {new Date(data.generated_at).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}
