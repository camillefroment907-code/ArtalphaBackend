import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getToken, getPlanLimits } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
import { Logo } from '../components/Logo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentAlert {
  id: string;
  name: string;
  is_active: boolean;
  artist_name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  keywords?: string[];
  budget_min_eur?: number | null;
  budget_max_eur?: number | null;
  investment_horizon?: string | null;
  risk_tolerance?: string;
  min_conviction_score?: number;
  notify_email?: boolean;
  created_at: string;
  recommendation_count: number;
}

interface LotPreview {
  id: string;
  title: string;
  artist_name_raw?: string | null;
  current_price?: number | null;
  estimate_low?: number | null;
  estimate_high?: number | null;
  deal_score?: number | null;
  image_url?: string | null;
  url?: string | null;
  auction_date?: string | null;
  auction_house_name?: string | null;
  pct_below_low_estimate?: number | null;
}

interface Recommendation {
  id: string;
  alert_id: string;
  alert_name?: string | null;
  lot_id?: string | null;
  verdict: 'STRONG_BUY' | 'BUY' | 'WATCH' | 'PASS';
  conviction_score: number;
  reasoning: string;
  bull_case?: string | null;
  bear_case?: string | null;
  suggested_max_price_eur?: number | null;
  estimated_return_pct?: number | null;
  hold_period_months?: number | null;
  is_read: boolean;
  is_acted_on: boolean;
  created_at: string;
  lot?: LotPreview | null;
}

interface Limits {
  plan: string;
  used: number;
  max: number;
  can_create: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v?: number | null): string {
  if (!v) return '—';
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}K`;
  return `€${v.toLocaleString('fr-FR')}`;
}

const HORIZON_LABELS: Record<string, string> = {
  short: 'Court terme',
  medium: 'Moyen terme',
  long: 'Long terme',
};

// ── Locked page ───────────────────────────────────────────────────────────────

function LockedPage() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* Top — 40% navy */}
      <div style={{ flex: '0 0 40vh', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 64px', position: 'relative', overflow: 'hidden' }}>
        {/* Subtle grid */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div style={{ position: 'relative', maxWidth: '680px', width: '100%' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '14px' }}>
            Investment Intelligence · Investor+
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'white', margin: '0 0 14px', lineHeight: 1.2 }}>
            Your private art investment analyst.<br />Always on.
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', margin: '0 0 28px', lineHeight: 1.7, maxWidth: '520px' }}>
            While you sleep, your AI analyst scans thousands of artworks across 10+ global auction houses — surfacing only what matches your strategy, at the right price, at the right moment.
          </p>
          <button
            onClick={() => navigate('/app/pricing')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', padding: '12px 28px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.01em' }}
          >
            Activate my AI analyst →
          </button>
          <div style={{ marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
            Available from Investor plan · €29/month · Cancel anytime
          </div>
        </div>
      </div>

      {/* Bottom — 60% white, 3 columns */}
      <div style={{ flex: '1', background: '#FAFAFA', padding: '40px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', maxWidth: '960px', margin: '0 auto' }}>

          {/* Column 1 — Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '4px' }}>
              How it works
            </div>
            {[
              { icon: '◆', title: 'Set your strategy once', body: 'Define your artist preferences, budget, time horizon and risk appetite. Your agent learns your profile and never forgets it.' },
              { icon: '⚡', title: 'Get alerted first', body: "The moment a matching lot appears — Drouot, Phillips, or Christie's — you receive a precision signal with a conviction score and clear recommendation." },
              { icon: '◎', title: 'Know exactly what to do', body: 'Every recommendation includes a price target, upside estimate, and detailed rationale. Not a suggestion — a decision.' },
            ].map(({ icon, title, body }) => (
              <div key={title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '14px', color: 'var(--gold)', flexShrink: 0, marginTop: '2px' }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>{title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.65 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Column 2 — Sample alert card */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Sample signal
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ background: '#0A1628', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>◆ STRONG BUY</span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>Score: 91/100</span>
              </div>
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>Zao Wou-Ki</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '14px' }}>Composition abstraite, 1972 · Oil on canvas</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {[
                    { label: 'Estimate', value: '€45–60k' },
                    { label: 'Target price', value: '€38k' },
                    { label: 'Upside', value: '+31%' },
                    { label: 'Closes in', value: '14h' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--bg-subtle)', borderRadius: '6px', padding: '8px 10px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  31% below 3-year auction average. Rare early-period composition. Drouot estimate appears conservative relative to comparable sales.
                </div>
              </div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
              Illustrative · real signals delivered to Investor members
            </div>
          </div>

          {/* Column 3 — Coming soon */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '4px' }}>
              What's included
            </div>
            {[
              { title: 'Personalized alert feed', live: true },
              { title: 'Conviction score per lot', live: true },
              { title: 'Email & in-app notifications', live: true },
              { title: 'Portfolio Correlation Matrix', live: false },
            ].map(({ title, live }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>{title}</span>
                {live ? (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', fontFamily: 'var(--font-mono)', background: 'rgba(22,163,74,0.08)', padding: '2px 7px', borderRadius: '4px' }}>LIVE</span>
                ) : (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', background: 'var(--bg-subtle)', padding: '2px 7px', borderRadius: '4px' }}>SOON</span>
                )}
              </div>
            ))}
            {/* Social proof */}
            <div style={{ marginTop: '8px', padding: '16px', background: '#0A1628', borderRadius: '8px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'white', fontStyle: 'italic', marginBottom: '8px', lineHeight: 1.65 }}>
                "The first time it flagged a Zao Wou-Ki 31% below market average, I thought it was a mistake. It wasn't."
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
                — Nautilus Investor member
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function Agent() {
  const limits = getPlanLimits();
  if (!limits.hasAIVerdict) return <LockedPage />;
  return <AgentPage />;
}

// ── AgentPage ─────────────────────────────────────────────────────────────────

function AgentPage() {
  const navigate = useNavigate();
  const token = getToken();

  // ── Data state ────────────────────────────────────────────────
  const [limits, setLimits]   = useState<Limits | null>(null);
  const [alerts, setAlerts]   = useState<AgentAlert[]>([]);
  const [recs, setRecs]       = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Form state ────────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAlert, setEditingAlert]     = useState<AgentAlert | null>(null);
  const [saving, setSaving]   = useState(false);
  const [formError, setFormError] = useState('');
  const [formStep, setFormStep]   = useState(1);

  // Form fields
  const [fname, setFname]           = useState('');
  const [fartist, setFartist]       = useState('');
  const [fcategory, setFcategory]   = useState('');
  const [fbudgetMin, setFbudgetMin] = useState('');
  const [fbudgetMax, setFbudgetMax] = useState('');
  const [fbudgetRange, setFbudgetRange] = useState('');
  const [fhorizon, setFhorizon]     = useState('medium');
  const [fconviction, setFconviction] = useState(70);
  const [fnameError, setFnameError]   = useState('');

  const recsRef = useRef<HTMLDivElement>(null);
  const [filterAlertId, setFilterAlertId] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  // ── API ───────────────────────────────────────────────────────

  async function loadAll() {
    const [lim, als, rs] = await Promise.all([
      fetch(`${BACKEND}/api/agent/limits`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${BACKEND}/api/agent/alerts`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${BACKEND}/api/agent/recommendations?limit=50`, { headers }).then(r => r.ok ? r.json() : []),
    ]);
    setLimits(lim);
    setAlerts(als);
    setRecs(rs);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setFname(''); setFartist(''); setFcategory('');
    setFbudgetMin(''); setFbudgetMax(''); setFbudgetRange('');
    setFhorizon('medium'); setFconviction(70);
    setFnameError(''); setFormStep(1); setFormError('');
  }

  function openCreateForm() {
    resetForm();
    setEditingAlert(null);
    setShowCreateForm(true);
  }

  function closeForm() {
    setShowCreateForm(false);
    setEditingAlert(null);
    resetForm();
  }

  function buildPayload() {
    return {
      name: fname,
      artist_name: fartist || null,
      category: fcategory || null,
      subcategory: null,
      keywords: [],
      budget_min_eur: fbudgetMin ? parseFloat(fbudgetMin) : null,
      budget_max_eur: fbudgetMax ? parseFloat(fbudgetMax) : null,
      investment_horizon: fhorizon,
      risk_tolerance: 'medium',
      min_conviction_score: fconviction,
      notify_email: true,
    };
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!fname.trim()) { setFnameError('Required'); return; }
    setSaving(true); setFormError('');
    try {
      const res = await fetch(`${BACKEND}/api/agent/alerts`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail ?? 'Error'); }
      closeForm();
      await loadAll();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error');
    }
    setSaving(false);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAlert) return;
    setSaving(true); setFormError('');
    try {
      const res = await fetch(`${BACKEND}/api/agent/alerts/${editingAlert.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail ?? 'Error'); }
      closeForm();
      await loadAll();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error');
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`${BACKEND}/api/agent/alerts/${id}`, { method: 'DELETE', headers });
    await loadAll();
  }

  async function handleToggle(id: string, val: boolean) {
    await fetch(`${BACKEND}/api/agent/alerts/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: val }),
    });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: val } : a));
  }

  function handleScrollToRecs(alertId: string) {
    setFilterAlertId(alertId);
    recsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleRead(id: string) {
    setRecs(prev => prev.map(r => r.id === id ? { ...r, is_read: true } : r));
  }

  function handleActed(id: string) {
    setRecs(prev => prev.map(r => r.id === id ? { ...r, is_acted_on: true } : r));
  }

  async function markRead(recId: string) {
    await fetch(`${BACKEND}/api/agent/recommendations/${recId}/read`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    });
    handleRead(recId);
  }

  async function markActed(recId: string) {
    await fetch(`${BACKEND}/api/agent/recommendations/${recId}/acted`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    });
    handleActed(recId);
  }

  // ── Derived ───────────────────────────────────────────────────

  const filteredRecs   = filterAlertId ? recs.filter(r => r.alert_id === filterAlertId) : recs;
  const unreadCount    = recs.filter(r => !r.is_read).length;
  const activeAlerts   = alerts.filter(a => a.is_active).length;
  const avgConviction  = recs.length > 0
    ? Math.round(recs.reduce((s, r) => s + r.conviction_score, 0) / recs.length) : 0;
  const maxStrategies  = limits?.max === 9999 ? '∞' : String(limits?.max ?? '—');

  function verdictColor(v: string) {
    if (v === 'STRONG_BUY') return 'var(--gold)';
    if (v === 'BUY') return 'var(--electric)';
    return 'var(--text-3)';
  }
  function verdictLabel(v: string) {
    if (v === 'STRONG_BUY') return 'STRONG BUY';
    if (v === 'BUY') return 'BUY';
    if (v === 'WATCH') return 'WATCH';
    return 'PASS';
  }

  // shared styles
  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: '13px',
    border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--bg-subtle)', color: 'var(--navy)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--text-3)', marginBottom: '5px',
  };
  const ghostBtn: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '9px 16px',
    background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
    cursor: 'pointer', color: 'var(--text-2)', letterSpacing: '0.04em',
  };

  // ── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)', letterSpacing: '0.1em' }}>LOADING…</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  // Suppress unused warning for handleUpdate and editingAlert in case edit UI is wired later
  void handleUpdate; void editingAlert;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── 1. STATUS BAR ────────────────────────────────────── */}
      <div style={{
        background: 'var(--navy)', height: '44px', padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--gold)', animation: 'pulseDot 2s infinite', flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase',
          }}>
            AI Analyst Active · Scanning new lots every 15 min
          </span>
        </div>
        {limits && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>
            {alerts.length}/{maxStrategies} strategies
          </span>
        )}
      </div>

      {/* ── 2. PAGE HEADER ───────────────────────────────────── */}
      <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid var(--border)', background: 'white' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 400,
              color: 'var(--navy)', margin: '0 0 4px',
            }}>
              Intelligence
            </h1>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: 'var(--text-3)', letterSpacing: '0.06em', margin: 0,
            }}>
              Your AI analyst monitors the market 24/7 and surfaces matching opportunities
            </p>
          </div>
          {limits?.can_create && (
            <button
              className="btn-electric"
              style={{ fontSize: '12px', padding: '9px 18px', letterSpacing: '0.04em', flexShrink: 0 }}
              onClick={showCreateForm ? closeForm : openCreateForm}
            >
              {showCreateForm ? '× Close' : '+ New Strategy'}
            </button>
          )}
        </div>

        {/* 4-tile KPI grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          border: '1px solid var(--border)', borderRadius: '8px',
          overflow: 'hidden', gap: '1px', background: 'var(--border)',
        }}>
          {[
            { label: 'Strategies',       value: String(alerts.length),                           sub: `of ${maxStrategies} max`   },
            { label: 'Recommendations',  value: String(recs.length),                             sub: 'this cycle'                },
            { label: 'Last Scan',        value: '< 15 min',                                      sub: 'ago'                       },
            { label: 'Conviction Avg',   value: avgConviction > 0 ? `${avgConviction}/100` : '—', sub: 'across signals'            },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ background: 'white', padding: '16px 20px' }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px',
              }}>{label}</div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700,
                color: 'var(--navy)', marginBottom: '3px',
              }}>{value}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. MAIN GRID ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', padding: '24px 40px', alignItems: 'start' }}>

        {/* LEFT — RECOMMENDATIONS */}
        <div ref={recsRef}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--navy)', margin: 0 }}>
                AI Recommendations
              </h2>
              {unreadCount > 0 && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                  color: 'var(--electric)', background: 'var(--electric-subtle)',
                  border: '1px solid var(--electric-border)', padding: '2px 7px', borderRadius: '3px',
                }}>
                  {unreadCount} NEW
                </span>
              )}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--electric)', letterSpacing: '0.08em' }}>
              RANKED BY CONVICTION SCORE
            </span>
          </div>

          {/* Filter chip */}
          {filterAlertId && (
            <div style={{ marginBottom: '12px' }}>
              <button
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}
                onClick={() => setFilterAlertId(null)}
              >
                × All strategies
              </button>
            </div>
          )}

          {/* Empty state */}
          {recs.length === 0 ? (
            <div style={{ background: 'var(--navy)', borderRadius: '8px', padding: '48px 40px', textAlign: 'center' }}>
              <Logo variant="symbol" color="white" size={32} />
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400, color: 'white', margin: '20px 0 8px' }}>
                Your analyst is working
              </h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '32px', lineHeight: 1.65, maxWidth: '320px', margin: '0 auto 32px' }}>
                Once you create a strategy, the agent scans every new auction lot and returns AI-graded signals here.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '240px', margin: '0 auto', textAlign: 'left' }}>
                {['Scans every 15 min', 'Nautilus AI analysis', 'Conviction scoring'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--gold)', fontSize: '8px', flexShrink: 0 }}>◆</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em' }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredRecs.map(rec => {
                const vColor = verdictColor(rec.verdict);
                const vLabel = verdictLabel(rec.verdict);
                return (
                  <div
                    key={rec.id}
                    onClick={() => {
                      if (!rec.is_read) markRead(rec.id);
                      if (rec.lot_id) navigate(`/app/opportunities/${rec.lot_id}`);
                    }}
                    style={{
                      background: 'white', border: '1px solid var(--border)',
                      borderLeft: `3px solid ${vColor}`, borderRadius: '6px',
                      padding: '18px 20px', cursor: rec.lot_id ? 'pointer' : 'default',
                      transition: 'box-shadow 0.15s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                  >
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {rec.alert_name && (
                          <div style={{
                            display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '9px',
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            color: 'var(--gold-dim)', background: 'var(--gold-subtle)',
                            border: '1px solid var(--gold-border)', padding: '2px 7px',
                            borderRadius: '3px', marginBottom: '8px',
                          }}>
                            {rec.alert_name}
                          </div>
                        )}
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: vColor, marginBottom: '4px' }}>
                          {vLabel}
                        </div>
                        {rec.lot?.artist_name_raw && (
                          <div style={{
                            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                            color: 'var(--navy)', letterSpacing: '0.06em', textTransform: 'uppercase',
                            marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {rec.lot.artist_name_raw}
                          </div>
                        )}
                        {rec.lot?.title && (
                          <div style={{
                            fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {rec.lot.title}
                          </div>
                        )}
                      </div>
                      {/* Conviction block */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: vColor, lineHeight: 1 }}>
                          {rec.conviction_score}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-3)', letterSpacing: '0.1em', marginTop: '2px' }}>
                          CONVICTION
                        </div>
                      </div>
                    </div>

                    {/* Conviction bar */}
                    <div style={{ height: '2px', background: 'var(--border)', borderRadius: '1px', marginBottom: '12px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '1px',
                        width: `${rec.conviction_score}%`,
                        background: rec.conviction_score >= 80 ? 'var(--gold)' : 'var(--electric)',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>

                    {/* Reasoning */}
                    {rec.reasoning && (
                      <div style={{
                        fontSize: '12px', color: 'var(--text-2)', fontStyle: 'italic',
                        lineHeight: 1.65, padding: '10px 12px',
                        background: 'var(--bg-subtle)', borderRadius: '4px', marginBottom: '12px',
                      }}>
                        {rec.reasoning}
                      </div>
                    )}

                    {/* Bottom row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--navy)' }}>
                          {fmt(rec.lot?.current_price ?? rec.lot?.estimate_low)}
                        </span>
                        {rec.estimated_return_pct != null && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                            {rec.estimated_return_pct > 0 ? '+' : ''}{rec.estimated_return_pct.toFixed(0)}% est. return
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {!rec.is_read && (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
                            color: 'var(--navy)', background: 'var(--navy-subtle)',
                            border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '3px',
                          }}>NEW</span>
                        )}
                        {rec.lot_id && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--electric)', letterSpacing: '0.04em' }}>
                            View lot →
                          </span>
                        )}
                        {!rec.is_acted_on && rec.verdict !== 'PASS' && (
                          <button
                            onClick={e => { e.stopPropagation(); markActed(rec.id); }}
                            style={{
                              fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)',
                              background: 'none', border: '1px solid var(--border)', borderRadius: '3px',
                              padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.04em',
                            }}
                          >
                            Mark acted
                          </button>
                        )}
                        {rec.is_acted_on && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.04em' }}>
                            ✓ Acted
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT — STRATEGIES */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--navy)', margin: 0 }}>
              Strategies
            </h2>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.06em' }}>
              {activeAlerts} active
            </span>
          </div>

          {alerts.length === 0 ? (
            <div style={{
              background: 'var(--bg-subtle)', border: '1px dashed var(--border)',
              borderRadius: '6px', padding: '40px 24px', textAlign: 'center',
            }}>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--text-2)', marginBottom: '8px' }}>
                No strategies yet
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6, marginBottom: '20px' }}>
                Create your first strategy to start receiving AI-graded opportunities.
              </p>
              {limits?.can_create && (
                <button
                  className="btn-electric"
                  style={{ fontSize: '12px', padding: '8px 18px' }}
                  onClick={openCreateForm}
                >
                  + New Strategy
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {alerts.map(alert => {
                const chips: { label: string; bg: string; color: string }[] = [];
                if (alert.artist_name)
                  chips.push({ label: alert.artist_name, bg: 'var(--navy-subtle)', color: 'var(--navy)' });
                if (alert.category)
                  chips.push({ label: alert.category, bg: 'var(--bg-subtle)', color: 'var(--text-2)' });
                if (alert.budget_min_eur || alert.budget_max_eur) {
                  const s = alert.budget_min_eur && alert.budget_max_eur
                    ? `${fmt(alert.budget_min_eur)}–${fmt(alert.budget_max_eur)}`
                    : alert.budget_max_eur ? `≤ ${fmt(alert.budget_max_eur)}` : `≥ ${fmt(alert.budget_min_eur)}`;
                  chips.push({ label: s, bg: 'var(--gold-subtle)', color: 'var(--gold-dim)' });
                }
                if (alert.investment_horizon)
                  chips.push({ label: HORIZON_LABELS[alert.investment_horizon] ?? alert.investment_horizon, bg: 'var(--bg-subtle)', color: 'var(--text-3)' });

                return (
                  <div
                    key={alert.id}
                    style={{
                      background: 'white', border: '1px solid var(--border)', borderRadius: '6px',
                      padding: '16px', opacity: alert.is_active ? 1 : 0.6, transition: 'opacity 0.2s',
                    }}
                  >
                    {/* Name row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: chips.length > 0 ? '10px' : '8px' }}>
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                        background: alert.is_active ? 'var(--electric)' : 'var(--border)',
                        animation: alert.is_active ? 'pulseDot 2s infinite' : 'none',
                      }} />
                      <span style={{
                        fontSize: '13px', fontWeight: 600, color: 'var(--navy)',
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {alert.name}
                      </span>
                      <button
                        onClick={() => handleToggle(alert.id, !alert.is_active)}
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)',
                          background: 'none', border: '1px solid var(--border)', borderRadius: '3px',
                          padding: '3px 7px', cursor: 'pointer', letterSpacing: '0.04em', flexShrink: 0,
                        }}
                      >
                        {alert.is_active ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Delete "${alert.name}"?`)) handleDelete(alert.id); }}
                        style={{
                          fontSize: '15px', color: '#C0392B', background: 'none', border: 'none',
                          cursor: 'pointer', padding: '2px 5px', lineHeight: 1, flexShrink: 0,
                        }}
                      >×</button>
                    </div>

                    {/* Criteria chips */}
                    {chips.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                        {chips.map(chip => (
                          <span
                            key={chip.label}
                            style={{
                              fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                              padding: '3px 8px', borderRadius: '3px',
                              background: chip.bg, color: chip.color, border: '1px solid var(--border)',
                            }}
                          >
                            {chip.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Activity line */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '4px', height: '4px', borderRadius: '50%', flexShrink: 0,
                        background: alert.is_active ? 'var(--electric)' : 'var(--border)',
                      }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.04em' }}>
                        {alert.is_active ? 'Scanning · Updated every 15 min' : 'Paused'}
                      </span>
                      {alert.recommendation_count > 0 && (
                        <button
                          onClick={() => handleScrollToRecs(alert.id)}
                          style={{
                            marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10px',
                            color: 'var(--gold-dim)', background: 'none', border: 'none',
                            cursor: 'pointer', padding: 0, letterSpacing: '0.04em',
                          }}
                        >
                          {alert.recommendation_count} signals →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Limits bar */}
              {limits && limits.max < 9999 && (
                <div style={{ padding: '4px 0 8px' }}>
                  <div style={{ height: '2px', background: 'var(--border)', borderRadius: '1px', marginBottom: '6px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '1px',
                      width: `${Math.min(100, (limits.used / limits.max) * 100)}%`,
                      background: limits.used >= limits.max ? 'var(--gold)' : 'var(--navy)',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', margin: 0 }}>
                    {limits.used}/{limits.max} strategies used
                    {limits.used >= limits.max && (
                      <button
                        onClick={() => navigate('/app/pricing')}
                        style={{ marginLeft: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Upgrade →
                      </button>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. CREATE FORM ───────────────────────────────────── */}
      {showCreateForm && (
        <div style={{ margin: '0 40px 40px' }}>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '28px 32px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 400, color: 'var(--navy)', margin: '0 0 4px' }}>
                  New Investment Strategy
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-3)', margin: 0, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                  Your AI analyst scans every 15 min and alerts you instantly
                </p>
              </div>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-3)', padding: '4px 8px', lineHeight: 1 }}>×</button>
            </div>

            {formError && (
              <div style={{ fontSize: '12px', color: '#C0392B', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', padding: '10px 14px', borderRadius: '6px', marginBottom: '20px' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px', alignItems: 'start' }}>

              {/* LEFT — form */}
              <form id="strategy-form" onSubmit={handleCreate}>

                {/* 1. Category chips */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={lbl}>Category</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                    {['Paintings', 'Sculptures', 'Prints & Multiples', 'Photography', 'Drawings', 'Contemporary', 'Modern'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFcategory(fcategory === cat ? '' : cat)}
                        style={{
                          padding: '5px 12px', fontSize: '12px', borderRadius: '4px', cursor: 'pointer',
                          border: '1px solid var(--border)',
                          background: fcategory === cat ? '#1A2A44' : '#F5F4F0',
                          color: fcategory === cat ? '#C6A85A' : '#888',
                          fontWeight: fcategory === cat ? 600 : 400,
                          transition: 'all 0.12s',
                        }}
                      >{cat}</button>
                    ))}
                  </div>
                </div>

                {/* 2. Artists */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={lbl}>Artists (optional)</label>
                  <input style={inp} value={fartist} onChange={e => setFartist(e.target.value)} placeholder="Chagall, Wou-Ki, Basquiat..." />
                </div>

                {/* 3. Budget */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={lbl}>Budget range</label>
                  <select
                    style={{ ...inp, cursor: 'pointer' }}
                    value={fbudgetRange}
                    onChange={e => {
                      const v = e.target.value;
                      setFbudgetRange(v);
                      if (!v) { setFbudgetMin(''); setFbudgetMax(''); }
                      else if (v === '-5000') { setFbudgetMin(''); setFbudgetMax('5000'); }
                      else if (v === '500000-') { setFbudgetMin('500000'); setFbudgetMax(''); }
                      else { const [mn, mx] = v.split('-'); setFbudgetMin(mn); setFbudgetMax(mx); }
                    }}
                  >
                    <option value="">Any budget</option>
                    <option value="-5000">&lt; €5K</option>
                    <option value="5000-20000">€5K – €20K</option>
                    <option value="20000-100000">€20K – €100K</option>
                    <option value="100000-500000">€100K – €500K</option>
                    <option value="500000-">€500K+</option>
                  </select>
                </div>

                {/* 4. Conviction slider */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={lbl}>Alert me when score ≥ {fconviction}/100</label>
                  <input
                    type="range" min={60} max={95} step={5}
                    value={fconviction}
                    onChange={e => setFconviction(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: '#1A2A44', marginBottom: '4px' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                    Higher = fewer but stronger signals
                  </div>
                </div>

                {/* 5. Time horizon */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={lbl}>Investment horizon</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { value: 'short', label: 'Quick flip', sub: '<6mo' },
                      { value: 'medium', label: 'Medium', sub: '6–24mo' },
                      { value: 'long', label: 'Long term', sub: '2y+' },
                    ].map(({ value, label, sub }) => (
                      <label key={value} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '9px 6px', border: `1px solid ${fhorizon === value ? '#1A2A44' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', background: fhorizon === value ? 'rgba(26,42,68,0.04)' : 'transparent', transition: 'all 0.12s' }}>
                        <input type="radio" name="horizon" value={value} checked={fhorizon === value} onChange={() => setFhorizon(value)} style={{ display: 'none' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: fhorizon === value ? '#1A2A44' : 'var(--text-2)' }}>{label}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>{sub}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 6. Strategy name */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={lbl}>Strategy name *</label>
                  <input
                    style={{ ...inp, borderColor: fnameError ? '#C0392B' : 'var(--border)' }}
                    value={fname}
                    onChange={e => { setFname(e.target.value); if (e.target.value.trim()) setFnameError(''); }}
                    placeholder={fcategory ? `My ${fcategory} strategy` : 'e.g. Impressionist paintings under €10K'}
                  />
                  {fnameError && <div style={{ fontSize: '11px', color: '#C0392B', marginTop: '4px' }}>{fnameError}</div>}
                </div>

              </form>

              {/* RIGHT — preview + CTA */}
              <div>
                <div style={{ background: '#1A2A44', padding: 20, borderLeft: '3px solid #C6A85A', borderRadius: '4px' }}>
                  <div style={{ color: 'rgba(198,168,90,0.6)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>SIGNAL PREVIEW</div>
                  <div style={{ display: 'inline-block', background: '#C6A85A', color: '#1A2A44', fontSize: 10, fontWeight: 700, padding: '3px 10px', marginBottom: 10, letterSpacing: '0.06em' }}>84/100 · EXCEPTIONAL</div>
                  <div style={{ color: '#999', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>MARC CHAGALL</div>
                  <div style={{ color: 'white', fontFamily: 'Georgia,serif', fontSize: 15, marginBottom: 6 }}>Lithographie originale, 1972</div>
                  <div style={{ color: '#aaa', fontSize: 11, marginBottom: 12 }}>Capitolium Art · Est. €1,000–2,000</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: 12 }}>Fair value: €3,500–5,000</span>
                    <span style={{ background: '#EAF4EE', color: '#1F6B3A', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: '3px' }}>+120% upside</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(198,168,90,0.2)', paddingTop: 10, color: 'rgba(198,168,90,0.6)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                    This is what a match looks like in your inbox.
                  </div>
                </div>
                <div style={{ marginTop: 10, color: '#888', fontSize: 11, lineHeight: 1.6 }}>
                  Scan frequency: Every 15 min · Email alerts: Immediate · Max 5 alerts/week
                </div>

                <div style={{ marginTop: '18px' }}>
                  <button
                    type="submit"
                    form="strategy-form"
                    className="btn-electric"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '13px' }}
                    disabled={saving}
                    onClick={() => { if (!fname.trim()) setFnameError('Required'); }}
                  >
                    {saving ? 'Launching…' : 'Activate this strategy →'}
                  </button>
                  <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-3)', marginTop: '7px' }}>
                    Your analyst starts scanning immediately
                  </div>
                </div>

                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={closeForm} style={ghostBtn}>Cancel</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
