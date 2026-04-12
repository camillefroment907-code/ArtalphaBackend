import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getToken, getPlanLimits } from '../../lib/auth';
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
    <div style={{ maxWidth: 620, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.15em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '16px' }}>
        Investor+
      </p>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '34px', fontWeight: 400, color: 'var(--navy)', lineHeight: 1.2, marginBottom: '12px' }}>
        Agent IA Personnel
      </h1>
      <div style={{ width: '48px', height: '1px', background: 'var(--gold)', margin: '24px auto' }} />
      <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '40px' }}>
        Créez des alertes ciblées et laissez GPT-4o surveiller le marché pour vous.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', marginBottom: '44px' }}>
        {[
          { title: 'Alertes ciblées', desc: "Définissez vos critères : artiste, catégorie, budget, horizon. L'agent scrute chaque lot entrant." },
          { title: 'Analyse GPT-4o', desc: 'Chaque lot est analysé selon votre alerte. Verdict FORT ACHAT / ACHAT / SURVEILLER avec raisonnement.' },
          { title: 'Recommandations personnalisées', desc: "Notification dès qu'un lot correspond. Score de conviction, cas haussier/baissier, prix max suggéré." },
        ].map(({ title, desc }) => (
          <div key={title} style={{ display: 'flex', gap: '14px', padding: '18px 20px', background: 'var(--navy-subtle)', borderRadius: '2px', border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--gold)', fontSize: '9px', marginTop: '4px', flexShrink: 0 }}>◆</span>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)', marginBottom: '3px' }}>{title}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6 }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        className="btn btn-navy"
        style={{ padding: '13px 32px', fontSize: '13px', letterSpacing: '0.04em' }}
        onClick={() => navigate('/app/pricing')}
      >
        Voir les plans →
      </button>
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
  const [fhorizon, setFhorizon]     = useState('medium');
  const [fconviction, setFconviction] = useState(65);
  const [fnameError, setFnameError]   = useState('');

  const recsRef = useRef<HTMLDivElement>(null);
  const [filterAlertId, setFilterAlertId] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  // ── API ───────────────────────────────────────────────────────

  async function loadAll() {
    const [lim, als, rs] = await Promise.all([
      fetch('/api/agent/limits', { headers }).then(r => r.ok ? r.json() : null),
      fetch('/api/agent/alerts', { headers }).then(r => r.ok ? r.json() : []),
      fetch('/api/agent/recommendations?limit=50', { headers }).then(r => r.ok ? r.json() : []),
    ]);
    setLimits(lim);
    setAlerts(als);
    setRecs(rs);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setFname(''); setFartist(''); setFcategory('');
    setFbudgetMin(''); setFbudgetMax('');
    setFhorizon('medium'); setFconviction(65);
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
      const res = await fetch('/api/agent/alerts', {
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
      const res = await fetch(`/api/agent/alerts/${editingAlert.id}`, {
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
    await fetch(`/api/agent/alerts/${id}`, { method: 'DELETE', headers });
    await loadAll();
  }

  async function handleToggle(id: string, val: boolean) {
    await fetch(`/api/agent/alerts/${id}`, {
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
    await fetch(`/api/agent/recommendations/${recId}/read`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    });
    handleRead(recId);
  }

  async function markActed(recId: string) {
    await fetch(`/api/agent/recommendations/${recId}/acted`, {
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
                {['Scans every 15 min', 'GPT-4o analysis', 'Conviction scoring'].map(item => (
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
        <div style={{ margin: '0 40px 40px', background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '28px 32px' }}>

          {/* Form header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 400, color: 'var(--navy)', margin: '0 0 4px' }}>
                {formStep === 1 ? 'Define your investment criteria' : 'Set your parameters'}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Step {formStep} of 2</span>
            </div>

            {/* Step indicator circles */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {([1, 2] as const).map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    onClick={() => { if (step < formStep) setFormStep(step); }}
                    style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                      background: formStep >= step ? 'var(--electric)' : 'var(--bg-subtle)',
                      color: formStep >= step ? 'white' : 'var(--text-3)',
                      cursor: step < formStep ? 'pointer' : 'default',
                      transition: 'background 0.2s',
                    }}
                  >{step}</div>
                  {i < 1 && (
                    <div style={{ width: '32px', height: '1px', background: formStep > 1 ? 'var(--electric)' : 'var(--border)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step labels */}
          <div style={{ display: 'flex', gap: '80px', marginBottom: '24px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', color: formStep === 1 ? 'var(--electric)' : 'var(--text-3)' }}>What to watch</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', color: formStep === 2 ? 'var(--electric)' : 'var(--text-3)' }}>How to filter</span>
          </div>

          {formError && (
            <div style={{ fontSize: '12px', color: '#C0392B', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', padding: '10px 14px', borderRadius: '6px', marginBottom: '20px' }}>
              {formError}
            </div>
          )}

          {/* Step 1 */}
          {formStep === 1 && (
            <form onSubmit={e => { e.preventDefault(); if (!fname.trim()) { setFnameError('Required'); return; } setFnameError(''); setFormStep(2); }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={lbl}>Strategy name</label>
                <input
                  style={{ ...inp, borderColor: fnameError ? '#C0392B' : 'var(--border)' }}
                  value={fname}
                  onChange={e => { setFname(e.target.value); if (e.target.value.trim()) setFnameError(''); }}
                  placeholder="e.g. Impressionist paintings under €10K"
                  autoFocus
                />
                {fnameError && <div style={{ fontSize: '11px', color: '#C0392B', marginTop: '4px' }}>{fnameError}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                <div>
                  <label style={lbl}>Artist (optional)</label>
                  <input style={inp} value={fartist} onChange={e => setFartist(e.target.value)} placeholder="e.g. Picasso, Matisse..." />
                </div>
                <div>
                  <label style={lbl}>Category</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={fcategory} onChange={e => setFcategory(e.target.value)}>
                    <option value="">All categories</option>
                    {['Paintings', 'Drawings', 'Sculpture', 'Photography', 'Prints', 'Mixed Media'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={closeForm} style={ghostBtn}>Cancel</button>
                <button
                  type="submit"
                  className="btn-electric"
                  style={{ fontSize: '12px', padding: '9px 20px', letterSpacing: '0.04em', opacity: !fname.trim() ? 0.5 : 1 }}
                  disabled={!fname.trim()}
                >
                  Next →
                </button>
              </div>
            </form>
          )}

          {/* Step 2 */}
          {formStep === 2 && (
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={lbl}>Min budget (€)</label>
                  <input type="number" style={inp} value={fbudgetMin} onChange={e => setFbudgetMin(e.target.value)} placeholder="500" />
                </div>
                <div>
                  <label style={lbl}>Max budget (€)</label>
                  <input type="number" style={inp} value={fbudgetMax} onChange={e => setFbudgetMax(e.target.value)} placeholder="50 000" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '28px' }}>
                <div>
                  <label style={lbl}>Investment horizon</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={fhorizon} onChange={e => setFhorizon(e.target.value)}>
                    <option value="short">Short — &lt; 2 years</option>
                    <option value="medium">Medium — 2–5 years</option>
                    <option value="long">Long — 5+ years</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Min conviction</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={String(fconviction)} onChange={e => setFconviction(parseInt(e.target.value, 10))}>
                    <option value="50">50+ — Any signal</option>
                    <option value="65">65+ — Strong</option>
                    <option value="80">80+ — High conviction only</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setFormStep(1)} style={ghostBtn}>← Back</button>
                <button type="button" onClick={closeForm} style={ghostBtn}>Cancel</button>
                <button
                  type="submit"
                  className="btn-electric"
                  style={{ fontSize: '12px', padding: '9px 22px', letterSpacing: '0.04em' }}
                  disabled={saving}
                >
                  {saving ? 'Launching…' : 'Launch strategy ◆'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

    </div>
  );
}
