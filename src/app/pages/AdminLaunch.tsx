/**
 * /admin/launch — Launch readiness dashboard.
 */
import { useState, useEffect, useCallback } from 'react';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

const ADMIN_HEADERS = (): Record<string, string> => {
  const h: Record<string, string> = { 'X-Admin-Key': 'hono-admin-2024', 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

function Metric({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? 'var(--navy)' : 'white', border: `1px solid ${highlight ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '8px', padding: '16px 20px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: highlight ? 'rgba(255,255,255,0.5)' : 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: highlight ? 'var(--gold)' : 'var(--navy)' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: highlight ? 'rgba(255,255,255,0.4)' : 'var(--text-3)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

type IngestJob = 'idle' | 'running' | 'done' | 'error';

function IngestPanel() {
  const [regularJob, setRegularJob] = useState<IngestJob>('idle');
  const [histJob, setHistJob]       = useState<IngestJob>('idle');
  const [health, setHealth]         = useState<any>(null);
  const [polling, setPolling]       = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/admin/health`, { headers: ADMIN_HEADERS() });
      if (r.ok) setHealth(await r.json());
    } catch {}
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  // Poll every 15s while a job is running
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(fetchHealth, 15_000);
    return () => clearInterval(id);
  }, [polling, fetchHealth]);

  const triggerRegular = async () => {
    setRegularJob('running');
    setPolling(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/bulk-ingest`, {
        method: 'POST', headers: ADMIN_HEADERS(),
        body: JSON.stringify({ limit_per_source: 5000 }),
      });
      setRegularJob(r.ok ? 'done' : 'error');
    } catch { setRegularJob('error'); }
  };

  const triggerHistorical = async () => {
    setHistJob('running');
    setPolling(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/historical-ingest`, {
        method: 'POST', headers: ADMIN_HEADERS(),
        body: JSON.stringify({ limit_per_source: 5000, months_back: 24 }),
      });
      setHistJob(r.ok ? 'done' : 'error');
    } catch { setHistJob('error'); }
  };

  const btnStyle = (job: IngestJob, color: string): React.CSSProperties => ({
    padding: '10px 20px',
    background: job === 'running' ? '#888' : job === 'error' ? '#c0392b' : color,
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    cursor: job === 'running' ? 'not-allowed' : 'pointer',
    opacity: job === 'running' ? 0.7 : 1,
    transition: 'background 0.15s',
  });

  const statusBadge = (job: IngestJob) => {
    if (job === 'idle') return null;
    const map = { running: ['#f39c12', '⏳ Running in background…'], done: ['#27ae60', '✓ Started'], error: ['#c0392b', '✗ Error'] };
    const [color, text] = map[job];
    return <span style={{ marginLeft: '10px', fontSize: '11px', color, fontFamily: 'var(--font-mono)' }}>{text}</span>;
  };

  const p = health?.pipeline;

  return (
    <div style={{ marginTop: '40px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '16px' }}>
        PIPELINE
      </div>

      {/* Live stats */}
      {p && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
          <Metric label="TOTAL LOTS" value={p.total_lots.toLocaleString()} highlight />
          <Metric label="ADDED LAST 1H" value={p.lots_last_1h} />
          <Metric label="ADDED LAST 24H" value={p.lots_last_24h} />
          <Metric label="SCORED" value={`${p.scored_pct}%`} sub={p.minutes_since_last != null ? `Last ingest ${p.minutes_since_last}min ago` : 'No timestamp yet'} />
        </div>
      )}

      {/* Trigger buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button style={btnStyle(regularJob, 'var(--navy)')} onClick={triggerRegular} disabled={regularJob === 'running'}>
            Run regular scrape now
          </button>
          {statusBadge(regularJob)}
          <span style={{ marginLeft: '12px', fontSize: '11px', color: 'var(--text-3)' }}>
            Upcoming lots — ArtMarket API, Phillips, Artsy, Bonhams… (auto: 6h + 18h UTC)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button style={btnStyle(histJob, '#8B4513')} onClick={triggerHistorical} disabled={histJob === 'running'}>
            Run historical ingest (24 months)
          </button>
          {statusBadge(histJob)}
          <span style={{ marginLeft: '12px', fontSize: '11px', color: 'var(--text-3)' }}>
            Past sold lots — ArtMarket API date-range + Invaluable. Takes 30–60 min. Run weekly.
          </span>
        </div>

        <button
          onClick={fetchHealth}
          style={{ alignSelf: 'flex-start', padding: '6px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', cursor: 'pointer', color: 'var(--text-3)' }}
        >
          Refresh stats
        </button>
      </div>

      {polling && (
        <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Auto-refreshing stats every 15s…
        </div>
      )}
    </div>
  );
}

export default function AdminLaunch() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/api/admin/launch`, { headers: ADMIN_HEADERS() })
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
          {/* Users overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
            <Metric label="USERS REGISTERED" value={data.users.total.toLocaleString()} sub={`+${data.users.last_7_days} this week`} highlight />
            <Metric label="TARGET PAYING USERS" value={data.launch.target_paying.toLocaleString()} />
            <Metric label="DAYS LIVE" value={Math.max(0, (data.launch.days_remaining !== undefined ? -data.launch.days_remaining : 0))} sub="Since launch" />
          </div>

          {/* Pre-registration signups */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '12px' }}>PRE-REGISTRATION SIGNUPS</div>
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

      {/* Pipeline controls — always visible */}
      <IngestPanel />
    </div>
  );
}
