/**
 * /admin/launch — Launch readiness dashboard.
 */
import { useState, useEffect } from 'react';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

function Metric({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? 'var(--navy)' : 'white', border: `1px solid ${highlight ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '8px', padding: '16px 20px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: highlight ? 'rgba(255,255,255,0.5)' : 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: highlight ? 'var(--gold)' : 'var(--navy)' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: highlight ? 'rgba(255,255,255,0.4)' : 'var(--text-3)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

export default function AdminLaunch() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setError('Not authenticated'); setLoading(false); return; }
    fetch(`${BACKEND}/api/admin/launch`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 40px' }}>
      <div style={{ marginBottom: '8px', fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em' }}>ADMIN</div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--text)', marginBottom: '32px' }}>Launch Dashboard</h1>

      {loading && <div style={{ color: 'var(--text-3)' }}>Loading…</div>}
      {error && <div style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>Error: {error}</div>}

      {data && (
        <>
          {/* Launch countdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
            <Metric label="DAYS TO LAUNCH" value={data.launch.days_remaining} sub="May 13, 2026" highlight />
            <Metric label="TARGET PAYING USERS" value={data.launch.target_paying.toLocaleString()} />
            <Metric label="USERS REGISTERED" value={data.users.total.toLocaleString()} sub={`+${data.users.last_7_days} this week`} />
          </div>

          {/* Waitlist */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '12px' }}>WAITLIST</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <Metric label="TOTAL" value={data.waitlist.total.toLocaleString()} />
              <Metric label="LAST 7 DAYS" value={data.waitlist.last_7_days.toLocaleString()} />
              <Metric label="REFERRAL RATE" value={`${data.waitlist.referral_rate_pct}%`} sub="of signups via referral" />
            </div>
          </div>

          {/* Subscriptions */}
          {Object.keys(data.subscriptions || {}).length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '12px' }}>ACTIVE SUBSCRIPTIONS</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(data.subscriptions).map(([plan, count]) => (
                  <div key={plan} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 16px', minWidth: '120px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '6px' }}>{plan.toUpperCase()}</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--navy)' }}>{String(count)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            Generated: {new Date(data.generated_at).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}
