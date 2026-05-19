import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getToken, getPlanLimits } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

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
  verdict: 'STRONG_BUY' | 'BUY' | 'WATCH' | 'PASS';
  conviction_score: number;
  reasoning: string;
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

const CATEGORIES = [
  { en: 'Paintings',         fr: 'Peintures' },
  { en: 'Sculptures',        fr: 'Sculptures' },
  { en: 'Prints & Multiples',fr: 'Estampes' },
  { en: 'Photography',       fr: 'Photographie' },
  { en: 'Drawings',          fr: 'Dessins' },
  { en: 'Contemporary',      fr: 'Art contemporain' },
  { en: 'Modern',            fr: 'Art moderne' },
];

// ── Locked page ───────────────────────────────────────────────────────────────

function LockedPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');

  const steps = isFr ? [
    { icon: '◆', title: 'Définissez votre stratégie une fois', body: "Définissez vos préférences d'artistes, budget, horizon et appétit au risque. Votre agent apprend votre profil et ne l'oublie jamais." },
    { icon: '⚡', title: 'Soyez alerté en premier', body: "Dès qu'un lot correspondant apparaît — Drouot, Phillips, Christie's — vous recevez un signal de précision avec un score de conviction et une recommandation claire." },
    { icon: '◎', title: 'Sachez exactement quoi faire', body: "Chaque recommandation inclut un prix cible, une estimation de potentiel et une justification détaillée. Pas une suggestion — une décision." },
  ] : [
    { icon: '◆', title: 'Set your strategy once', body: 'Define your artist preferences, budget, time horizon and risk appetite. Your agent learns your profile and never forgets it.' },
    { icon: '⚡', title: 'Get alerted first', body: "The moment a matching lot appears — Drouot, Phillips, or Christie's — you receive a precision signal with a conviction score and clear recommendation." },
    { icon: '◎', title: 'Know exactly what to do', body: 'Every recommendation includes a price target, upside estimate, and detailed rationale. Not a suggestion — a decision.' },
  ];

  const features = isFr ? [
    { title: "Flux d'alertes personnalisé", live: true },
    { title: "Score de conviction par lot", live: true },
    { title: "Notifications email & in-app", live: true },
    { title: "Matrice de corrélation portfolio", live: false },
  ] : [
    { title: 'Personalized alert feed', live: true },
    { title: 'Conviction score per lot', live: true },
    { title: 'Email & in-app notifications', live: true },
    { title: 'Portfolio Correlation Matrix', live: false },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ flex: '0 0 40vh', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div style={{ position: 'relative', maxWidth: '680px', width: '100%' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '14px' }}>
            {isFr ? "Intelligence d'investissement · Investor+" : "Investment Intelligence · Investor+"}
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'white', margin: '0 0 14px', lineHeight: 1.2 }}>
            {isFr ? <>Votre analyste privé en art.<br />Toujours actif.</> : <>Your private art investment analyst.<br />Always on.</>}
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', margin: '0 0 28px', lineHeight: 1.7, maxWidth: '520px' }}>
            {isFr ? "Pendant que vous dormez, votre analyste IA scanne des milliers d'œuvres dans 10+ maisons de ventes mondiales — ne faisant remonter que ce qui correspond à votre stratégie, au bon prix, au bon moment." : "While you sleep, your AI analyst scans thousands of artworks across 10+ global auction houses — surfacing only what matches your strategy, at the right price, at the right moment."}
          </p>
          <button
            onClick={() => navigate('/app/pricing')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', padding: '12px 28px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.01em' }}
          >
            {isFr ? "Activer mon analyste IA →" : "Activate my AI analyst →"}
          </button>
          <div style={{ marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
            {isFr ? "Disponible dès le plan Investor · 19€/mois · Résiliable à tout moment" : "Available from Investor plan · €19/month · Cancel anytime"}
          </div>
        </div>
      </div>

      <div style={{ flex: '1', background: '#FAFAFA', padding: '40px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '4px' }}>
              {isFr ? "Comment ça marche" : "How it works"}
            </div>
            {steps.map(({ icon, title, body }) => (
              <div key={title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '14px', color: 'var(--gold)', flexShrink: 0, marginTop: '2px' }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>{title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.65 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '12px' }}>
              {isFr ? "Exemple de signal" : "Sample signal"}
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
                  {(isFr ? [{ label: 'Estimation', value: '€45–60k' }, { label: 'Prix cible', value: '€38k' }, { label: 'Potentiel', value: '+31%' }, { label: 'Ferme dans', value: '14h' }] : [{ label: 'Estimate', value: '€45–60k' }, { label: 'Target price', value: '€38k' }, { label: 'Upside', value: '+31%' }, { label: 'Closes in', value: '14h' }]).map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--bg-subtle)', borderRadius: '6px', padding: '8px 10px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  {isFr ? "31% en dessous de la moyenne aux enchères sur 3 ans. Composition rare de la première période. L'estimation Drouot paraît conservatrice au regard des ventes comparables." : "31% below 3-year auction average. Rare early-period composition. Drouot estimate appears conservative relative to comparable sales."}
                </div>
              </div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
              {isFr ? "Illustratif · vrais signaux livrés aux membres Investor" : "Illustrative · real signals delivered to Investor members"}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '4px' }}>
              {isFr ? "Ce qui est inclus" : "What's included"}
            </div>
            {features.map(({ title, live }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>{title}</span>
                {live
                  ? <span style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', fontFamily: 'var(--font-mono)', background: 'rgba(22,163,74,0.08)', padding: '2px 7px', borderRadius: '4px' }}>LIVE</span>
                  : <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', background: 'var(--bg-subtle)', padding: '2px 7px', borderRadius: '4px' }}>{isFr ? "BIENTÔT" : "SOON"}</span>
                }
              </div>
            ))}
            <div style={{ marginTop: '8px', padding: '16px', background: '#0A1628', borderRadius: '8px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'white', fontStyle: 'italic', marginBottom: '8px', lineHeight: 1.65 }}>
                "The first time it flagged a Zao Wou-Ki 31% below market average, I thought it was a mistake. It wasn't."
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>— Nautilus Investor member</div>
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
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');
  const token = getToken();
  const headers = { Authorization: `Bearer ${token}` };

  // ── Data state ────────────────────────────────────────────────
  const [limits, setLimits]   = useState<Limits | null>(null);
  const [alerts, setAlerts]   = useState<AgentAlert[]>([]);
  const [recs, setRecs]       = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  // ── UI state ──────────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [hoveredAlertId, setHoveredAlertId] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  // ── Form fields ───────────────────────────────────────────────
  const [fname, setFname]             = useState('');
  const [fartist, setFartist]         = useState('');
  const [fcategories, setFcategories] = useState<string[]>([]);
  const [fkeywords, setFkeywords]     = useState('');
  const [fbudgetMin, setFbudgetMin]   = useState('');
  const [fbudgetMax, setFbudgetMax]   = useState('');
  const [fhorizon, setFhorizon]       = useState('medium');
  const [fconviction, setFconviction] = useState(70);
  const [frisk, setFrisk]             = useState('medium');
  const [fnameError, setFnameError]   = useState('');

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

  // Debounced match count when form is open
  useEffect(() => {
    if (!showCreateForm) return;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `${BACKEND}/api/lots?status=upcoming&min_score=${fconviction}&page_size=1`,
          { headers },
        );
        if (r.ok) {
          const d = await r.json();
          setMatchCount(d.total ?? d.count ?? null);
        }
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [fconviction, showCreateForm]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setFname(''); setFartist(''); setFcategories([]); setFkeywords('');
    setFbudgetMin(''); setFbudgetMax('');
    setFhorizon('medium'); setFconviction(70); setFrisk('medium');
    setFnameError(''); setFormError(''); setMatchCount(null);
  }

  function openCreateForm() { resetForm(); setShowCreateForm(true); }
  function closeForm()       { setShowCreateForm(false); resetForm(); }

  function buildPayload() {
    return {
      name: fname,
      artist_name: fartist || null,
      category: fcategories.length > 0 ? fcategories.join(', ') : null,
      subcategory: null,
      keywords: fkeywords ? fkeywords.split(',').map(k => k.trim()).filter(Boolean) : [],
      budget_min_eur: fbudgetMin ? parseFloat(fbudgetMin) : null,
      budget_max_eur: fbudgetMax ? parseFloat(fbudgetMax) : null,
      investment_horizon: fhorizon,
      risk_tolerance: frisk,
      min_conviction_score: fconviction,
      notify_email: true,
    };
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!fname.trim()) { setFnameError(isFr ? 'Requis' : 'Required'); return; }
    setSaving(true); setFormError('');
    try {
      const res = await fetch(`${BACKEND}/api/agent/alerts`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const err = await res.json();
        const detail: string = err.detail ?? '';
        const isLimitError = detail.includes('alerte') || detail.toLowerCase().includes('limit') || detail.toLowerCase().includes('max');
        throw new Error(isLimitError
          ? (isFr
            ? `Limite atteinte — votre plan permet ${limits?.max ?? 1} stratégie${(limits?.max ?? 1) > 1 ? 's' : ''}. Passez à un plan supérieur pour en créer davantage.`
            : `Limit reached — your plan allows ${limits?.max ?? 1} strateg${(limits?.max ?? 1) > 1 ? 'ies' : 'y'}. Upgrade to create more.`)
          : (detail || 'Error'));
      }
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

  // ── Derived ───────────────────────────────────────────────────

  const activeAlerts  = alerts.filter(a => a.is_active).length;
  const avgConviction = recs.length > 0
    ? Math.round(recs.reduce((s, r) => s + r.conviction_score, 0) / recs.length) : 0;
  const maxStrategies = limits?.max === 9999 ? '∞' : String(limits?.max ?? '—');
  const seen = new Set<string>();
  const signalFeed = recs
    .filter(r => r.lot && (r.lot.deal_score ?? 0) >= 80)
    .sort((a, b) => (b.lot?.deal_score ?? 0) - (a.lot?.deal_score ?? 0))
    .filter(r => {
      const key = `${r.lot?.title?.trim().toLowerCase()}|${r.lot?.auction_house_name?.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // ── Shared styles ─────────────────────────────────────────────

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '13px',
    border: '1px solid #E8E4DC', borderRadius: '6px',
    background: 'white', color: '#1A2A44',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '9px', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.14em', textTransform: 'uppercase',
    color: 'var(--text-3)', marginBottom: '7px',
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

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── HEADER DARK ─────────────────────────────────────── */}
      <div className="agent-desktop-layout" style={{ background: '#0A1628', padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
           <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(198,168,90,0.65)', textTransform: 'uppercase', marginBottom: 4 }}>
  {isFr ? 'Alertes · Temps réel' : 'Alerts · Real-time'}
</div>
<h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400, color: 'white', margin: 0, lineHeight: 1.2 }}>
  {isFr ? 'Mon analyste IA' : 'My AI Analyst'}
</h1>
            
          </div>
          {limits?.can_create && (
            <button
              onClick={openCreateForm}
              onMouseEnter={e => (e.currentTarget.style.background = '#1d4ed8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#2563EB', color: 'white',
                border: 'none', borderRadius: 4,
                padding: '9px 18px', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: '11px',
                letterSpacing: '0.08em', fontWeight: 600,
                transition: 'background 0.15s',
              }}
            >
              {isFr ? '+ NOUVELLE STRATÉGIE' : '+ NEW STRATEGY'}
            </button>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          {[
            {
              label: isFr ? 'Stratégies actives' : 'Active strategies',
              value: String(activeAlerts),
              hint: null,
            },
            {
              label: isFr ? 'Signaux détectés' : 'Signals detected',
              value: String(recs.length),
              hint: recs.length === 0 && activeAlerts > 0
                ? (isFr ? 'Élargir les critères' : 'Try broadening criteria')
                : null,
            },
            {
              label: isFr ? 'Conviction moy.' : 'Avg conviction',
              value: avgConviction > 0 ? `${avgConviction}/100` : '—',
              hint: null,
            },
          ].map(({ label, value, hint }, i) => (
            <div
              key={label}
              style={{
                paddingRight: 28,
                marginRight: 28,
                borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 500, color: value === '—' ? 'rgba(255,255,255,0.2)' : 'white' }}>
                {value}
              </div>
              {hint && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginTop: 2, letterSpacing: '0.04em' }}>
                  {hint}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 3-COLUMN BODY ───────────────────────────────────── */}
      <div className="agent-desktop-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr 220px', minHeight: 'calc(100vh - 140px)' }}>

        {/* ── COL LEFT : MES STRATÉGIES ───────────────────────── */}
        <div style={{ borderRight: '1px solid var(--border)', background: 'white', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            {isFr ? 'Mes stratégies' : 'My strategies'}
          </div>

          {alerts.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 12px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.6 }}>
                {isFr
                  ? 'Aucune stratégie. Créez-en une pour être alerté dès qu\'un lot correspond à vos critères.'
                  : 'No strategies yet. Create one to get alerted the moment a matching lot appears.'}
              </div>
              {limits?.can_create && (
                <button
                  onClick={openCreateForm}
                  style={{
                    background: '#2563EB', color: 'white', border: 'none', borderRadius: 4,
                    padding: '8px 16px', fontSize: '11px', fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em', cursor: 'pointer',
                  }}
                >
                  {isFr ? 'Créer une stratégie' : 'Create a strategy'}
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {alerts.map(alert => {
                  const isHovered = hoveredAlertId === alert.id;
                  const horizonLabel: Record<string, string> = isFr
                    ? { short: 'Court terme', medium: 'Moyen terme', long: 'Long terme' }
                    : { short: 'Short term', medium: 'Medium term', long: 'Long term' };

                  return (
                    <div
                      key={alert.id}
                      onMouseEnter={() => setHoveredAlertId(alert.id)}
                      onMouseLeave={() => setHoveredAlertId(null)}
                      style={{
                        background: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '14px',
                        opacity: alert.is_active ? 1 : 0.55,
                        transition: 'box-shadow 0.15s ease',
                        boxShadow: isHovered ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      {/* Name + actions */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2A44', flex: 1, lineHeight: 1.3 }}>
                          {alert.name}
                        </span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
                          <button
                            onClick={() => handleToggle(alert.id, !alert.is_active)}
                            style={{
                              fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)',
                              background: 'none', border: '1px solid var(--border)', borderRadius: 2,
                              padding: '3px 7px', cursor: 'pointer', letterSpacing: '0.04em',
                            }}
                          >
                            {alert.is_active ? (isFr ? 'Pause' : 'Pause') : (isFr ? 'Reprendre' : 'Resume')}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(alert.id)}
                            style={{ fontSize: 16, color: '#C0392B', background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px', lineHeight: 1 }}
                          >×</button>
                        </div>
                      </div>

                      {/* Tags */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                        {alert.category && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 2, background: 'rgba(26,42,68,0.06)', color: '#1A2A44', border: '1px solid rgba(26,42,68,0.12)' }}>
                            {alert.category}
                          </span>
                        )}
                        {alert.artist_name && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 2, background: 'var(--bg-subtle)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                            {alert.artist_name}
                          </span>
                        )}
                        {(alert.budget_min_eur || alert.budget_max_eur) && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 2, background: 'rgba(198,168,90,0.07)', color: '#9A7A2A', border: '1px solid rgba(198,168,90,0.18)' }}>
                            {alert.budget_min_eur && alert.budget_max_eur
                              ? `${fmt(alert.budget_min_eur)} – ${fmt(alert.budget_max_eur)}`
                              : alert.budget_max_eur ? `≤ ${fmt(alert.budget_max_eur)}` : `≥ ${fmt(alert.budget_min_eur)}`}
                          </span>
                        )}
                        {alert.min_conviction_score != null && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 2, background: 'var(--electric-subtle)', color: 'var(--electric)', border: '1px solid var(--electric-border)' }}>
                            ≥ {alert.min_conviction_score}
                          </span>
                        )}
                        {alert.investment_horizon && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 2, background: 'var(--bg-subtle)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                            {horizonLabel[alert.investment_horizon] ?? alert.investment_horizon}
                          </span>
                        )}
                      </div>

                      {/* Status */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{
                            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                            background: alert.is_active ? '#16A34A' : '#D1D5DB',
                            boxShadow: alert.is_active ? '0 0 0 2px rgba(22,163,74,0.2)' : 'none',
                          }} />
                          <span style={{ fontSize: '10px', color: alert.is_active ? '#16A34A' : 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                            {alert.is_active ? (isFr ? 'Scanning…' : 'Scanning…') : (isFr ? 'En pause' : 'Paused')}
                          </span>
                        </div>
                        <span style={{ fontSize: '9px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                          {alert.recommendation_count > 0
                            ? `${alert.recommendation_count} signal${alert.recommendation_count > 1 ? 's' : ''}`
                            : (isFr ? 'Aucun signal' : 'No signals')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Limits bar */}
              {limits && limits.max < 9999 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ height: '2px', background: 'var(--border)', borderRadius: 1, marginBottom: 5, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 1,
                      width: `${Math.min(100, (limits.used / limits.max) * 100)}%`,
                      background: limits.used >= limits.max ? 'var(--gold)' : '#2563EB',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)', margin: 0 }}>
                      {limits.used}/{limits.max} {isFr ? 'stratégies' : 'strategies'}
                    </p>
                    {limits.used >= limits.max && (
                      <button
                        onClick={() => navigate('/app/pricing')}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {isFr ? 'Upgrade →' : 'Upgrade →'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* New strategy button */}
              {limits?.can_create && (
                <button
                  onClick={openCreateForm}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#2563EB')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  style={{
                    marginTop: 10, width: '100%', padding: '9px',
                    fontSize: '10px', fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em', color: '#2563EB',
                    background: 'transparent',
                    border: '1px dashed var(--border)',
                    borderRadius: 4, cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {isFr ? '+ NOUVELLE STRATÉGIE' : '+ NEW STRATEGY'}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── COL CENTRE : SIGNAL FEED ────────────────────────── */}
        <div style={{ padding: '20px 24px', background: 'var(--bg)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            {isFr ? 'Signal feed · Score 80+' : 'Signal feed · Score 80+'}
          </div>

          {signalFeed.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {isFr ? 'Aucune opportunité détectée pour le moment.' : 'No opportunities detected right now.'}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {signalFeed.map(rec => { const lot = rec.lot!; return (
                  <a
                    key={rec.id}
                    href={`/app/opportunities/${lot.id}`}
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    <div
                      style={{
                        display: 'flex', alignItems: 'stretch',
                        background: 'white',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${lot.deal_score >= 85 ? '#C0392B' : '#B8922A'}`,
                        borderRadius: '0 6px 6px 0',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.09)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                    >
                      {lot.image_url && (
                        <img src={lot.image_url} alt="" style={{ width: 88, height: 88, objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, padding: '12px 16px', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: 3 }}>
                            {lot.artist_name_raw?.toUpperCase()}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2A44', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 340, marginBottom: 5 }}>
                            {lot.title}
                          </div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{lot.auction_house_name}</span>
                            {lot.estimate_low && (
                              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Est. €{lot.estimate_low.toLocaleString()}</span>
                            )}
                            {lot.pct_below_low_estimate && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A' }}>
                                +{Math.round(lot.pct_below_low_estimate)}% {isFr ? 'potentiel' : 'upside'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700,
                            color: lot.deal_score >= 85 ? '#C0392B' : '#B8922A',
                            lineHeight: 1,
                          }}>
                            {Math.round(lot.deal_score)}
                            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)' }}>/100</span>
                          </div>
                          <div style={{
                            display: 'inline-block', fontSize: '9px', fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.07em', padding: '2px 7px', borderRadius: 2, marginTop: 4,
                            background: lot.deal_score >= 85 ? 'rgba(192,57,43,0.09)' : 'rgba(184,146,42,0.09)',
                            color: lot.deal_score >= 85 ? '#C0392B' : '#B8922A',
                          }}>
                            {lot.deal_score >= 85
                              ? (isFr ? 'EXCEPTIONNEL' : 'EXCEPTIONAL')
                              : (isFr ? 'FORT POTENTIEL' : 'STRONG UPSIDE')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                ); })}
              </div>

              {/* CTA inline — bleu, bien intégré */}
              <div style={{
                marginTop: 16,
                background: '#2563EB',
                borderRadius: 6,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 3 }}>
                    {isFr ? 'Ces opportunités vous intéressent ?' : 'Interested in these opportunities?'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                    {isFr
                      ? 'Créez une stratégie — votre analyste vous alertera en temps réel.'
                      : 'Create a strategy and get alerted the moment a match appears.'}
                  </div>
                </div>
                <button
                  onClick={openCreateForm}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: 4,
                    padding: '9px 18px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  {isFr ? 'Créer une stratégie →' : 'Create a strategy →'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── COL DROITE : MARKET PULSE ───────────────────────── */}
        <div style={{ borderLeft: '1px solid var(--border)', background: 'white', padding: '20px 16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            Market Pulse
          </div>

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 3px rgba(22,163,74,0.15)', flexShrink: 0 }} />
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#16A34A', letterSpacing: '0.06em' }}>
              {isFr ? 'Données live' : 'Live data'}
            </span>
          </div>

          {/* Stats */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
              {isFr ? 'Marché' : 'Market'}
            </div>
            {[
              { label: isFr ? 'Lots upcoming' : 'Upcoming lots', value: '31 558' },
              { label: isFr ? 'Score 80+' : 'Score 80+',         value: String(signalFeed.length) },
              { label: isFr ? 'Vendus (30j)' : 'Sold (30d)',     value: '5 261' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#1A2A44' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* My stats */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
              {isFr ? 'Mon analyste' : 'My analyst'}
            </div>
            {[
              { label: isFr ? 'Stratégies actives' : 'Active strategies', value: String(activeAlerts) },
              { label: isFr ? 'Signaux reçus'       : 'Signals received',  value: String(recs.length) },
              { label: isFr ? 'Conviction moy.'     : 'Avg conviction',    value: avgConviction > 0 ? `${avgConviction}/100` : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: value === '—' ? 'var(--text-3)' : '#1A2A44' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Upgrade nudge if at limit */}
          {limits && limits.max < 9999 && limits.used >= limits.max && (
            <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 4, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600, marginBottom: 4 }}>
                {isFr ? 'Limite atteinte' : 'Plan limit reached'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5 }}>
                {isFr ? `${limits.used}/${limits.max} stratégies utilisées.` : `${limits.used}/${limits.max} strategies used.`}
              </div>
              <button
                onClick={() => navigate('/app/pricing')}
                style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.04em' }}
              >
                {isFr ? 'Mettre à niveau →' : 'Upgrade →'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE LAYOUT ───────────────────────────────────── */}
      <div className="agent-mobile-layout">

        {/* a) Header */}
        <div style={{ background: '#0A1628', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.18em', color: 'rgba(198,168,90,0.65)', textTransform: 'uppercase', marginBottom: 3 }}>
              {isFr ? 'Alertes · Temps réel' : 'Alerts · Real-time'}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 400, color: 'white', lineHeight: 1.2 }}>
              {isFr ? 'Mon analyste IA' : 'My AI Analyst'}
            </div>
          </div>
          {limits?.can_create && (
            <button
              onClick={openCreateForm}
              style={{ background: '#2563EB', color: 'white', border: 'none', borderRadius: 4, padding: '8px 14px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {isFr ? '+ STRATÉGIE' : '+ STRATEGY'}
            </button>
          )}
        </div>

        {/* b) 3 metrics strip */}
        <div style={{ display: 'flex', background: '#0A1628', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 16px 14px' }}>
          {[
            { label: isFr ? 'Stratégies actives' : 'Active strategies', value: String(activeAlerts) },
            { label: isFr ? 'Signaux détectés' : 'Signals detected', value: String(recs.length) },
            { label: isFr ? 'Conviction moy.' : 'Avg conviction', value: avgConviction > 0 ? `${avgConviction}/100` : '—' },
          ].map(({ label, value }, i) => (
            <div key={label} style={{ flex: 1, paddingLeft: i > 0 ? 12 : 0, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', marginLeft: i > 0 ? 12 : 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 500, color: value === '—' ? 'rgba(255,255,255,0.2)' : 'white' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px' }}>

          {/* c) Signal Feed */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            {isFr ? 'Signaux détectés' : 'Detected signals'}
          </div>

          {signalFeed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0 24px', fontSize: 12, color: 'var(--text-3)' }}>
              {isFr ? 'Aucune opportunité détectée pour le moment.' : 'No opportunities detected right now.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {signalFeed.map(rec => {
                const lot = rec.lot!;
                return (
                  <a key={rec.id} href={`/app/opportunities/${lot.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      background: 'white', border: '1px solid var(--border)',
                      borderLeft: `3px solid ${(lot.deal_score ?? 0) >= 85 ? '#C0392B' : '#B8922A'}`,
                      borderRadius: '0 6px 6px 0', overflow: 'hidden',
                    }}>
                      {lot.image_url ? (
                        <img src={lot.image_url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 80, height: 80, background: 'var(--bg-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 18, color: 'var(--border)' }}>◇</span>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0, padding: '10px 12px 10px 10px' }}>
                        {lot.artist_name_raw && (
                          <div style={{ fontSize: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 2, letterSpacing: '0.08em' }}>
                            {lot.artist_name_raw.toUpperCase()}
                          </div>
                        )}
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2A44', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
                          {lot.title}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: (lot.deal_score ?? 0) >= 85 ? '#C0392B' : '#B8922A' }}>
                            {Math.round(lot.deal_score ?? 0)}/100
                          </span>
                          {lot.pct_below_low_estimate && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A' }}>
                              +{Math.round(lot.pct_below_low_estimate)}% {isFr ? 'potentiel' : 'upside'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {/* d) Strategies accordion */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            {isFr ? 'Mes stratégies' : 'My strategies'}
          </div>

          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-3)' }}>
              {isFr ? "Aucune stratégie. Créez-en une pour recevoir des alertes." : "No strategies yet. Create one to get alerted."}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {alerts.map(alert => {
                const isOpen = expandedAlerts.has(alert.id);
                const horizonLabel: Record<string, string> = isFr
                  ? { short: 'Court terme', medium: 'Moyen terme', long: 'Long terme' }
                  : { short: 'Short term', medium: 'Medium term', long: 'Long term' };
                return (
                  <div key={alert.id} style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: 'white' }}>
                    <button
                      onClick={() => setExpandedAlerts(prev => {
                        const next = new Set(prev);
                        if (next.has(alert.id)) next.delete(alert.id); else next.add(alert.id);
                        return next;
                      })}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: alert.is_active ? '#16A34A' : '#D1D5DB' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2A44' }}>{alert.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                          {alert.recommendation_count > 0 ? `${alert.recommendation_count} sig.` : '—'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'inline-block', transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 4, borderTop: '1px solid var(--border)' }}>
                        {alert.category && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 2, background: 'rgba(26,42,68,0.06)', color: '#1A2A44', border: '1px solid rgba(26,42,68,0.12)' }}>{alert.category}</span>
                        )}
                        {(alert.budget_min_eur || alert.budget_max_eur) && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 2, background: 'rgba(198,168,90,0.07)', color: '#9A7A2A', border: '1px solid rgba(198,168,90,0.18)' }}>
                            {alert.budget_min_eur && alert.budget_max_eur
                              ? `${fmt(alert.budget_min_eur)} – ${fmt(alert.budget_max_eur)}`
                              : alert.budget_max_eur ? `≤ ${fmt(alert.budget_max_eur)}` : `≥ ${fmt(alert.budget_min_eur)}`}
                          </span>
                        )}
                        {alert.investment_horizon && (
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 2, background: 'var(--bg-subtle)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                            {horizonLabel[alert.investment_horizon] ?? alert.investment_horizon}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {limits?.can_create && (
            <button
              onClick={openCreateForm}
              style={{ marginTop: 12, width: '100%', padding: '10px', fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: '#2563EB', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 4, cursor: 'pointer' }}
            >
              {isFr ? '+ NOUVELLE STRATÉGIE' : '+ NEW STRATEGY'}
            </button>
          )}

        </div>
      </div>

      {/* ── MODAL: CREATION FORM ────────────────────────── */}
      {showCreateForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={closeForm}
        >
          <div
            style={{ background: 'white', borderRadius: '8px', padding: '40px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            {/* × close */}
            <button
              onClick={closeForm}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '20px', color: 'var(--text-3)', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
            >×</button>

            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: '#1A2A44', margin: '0 0 6px' }}>
                {isFr ? 'Nouvelle stratégie' : 'New Strategy'}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: 0, lineHeight: 1.65 }}>
                {isFr
                  ? 'Nautilus analyse chaque nouveau lot et vous alerte instantanément par email.'
                  : 'Nautilus scans every new lot and alerts you instantly by email.'}
              </p>
            </div>

            {formError && (
              <div style={{ fontSize: '12px', color: '#C0392B', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', padding: '10px 14px', borderRadius: '6px', marginBottom: '20px' }}>
                {formError}
              </div>
            )}

            <form id="strategy-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* 1. Strategy name */}
              <div>
                <input
                  style={{
                    width: '100%', padding: '8px 0', fontSize: '16px',
                    border: 'none', borderBottom: `2px solid ${fnameError ? '#C0392B' : '#E8E4DC'}`,
                    background: 'transparent', color: '#1A2A44',
                    fontFamily: 'var(--font-serif)', outline: 'none', boxSizing: 'border-box',
                  }}
                  value={fname}
                  onChange={e => { setFname(e.target.value); if (e.target.value.trim()) setFnameError(''); }}
                  placeholder={isFr ? 'ex. Estampes japonaises sous €5K' : 'e.g. Japanese prints under €5K'}
                />
                {fnameError && <div style={{ fontSize: '11px', color: '#C0392B', marginTop: '4px' }}>{fnameError}</div>}
              </div>

              {/* 2. Artists */}
              <div>
                <label style={lbl}>{isFr ? 'ARTISTE(S)' : 'ARTIST(S)'}</label>
                <input style={inp} value={fartist} onChange={e => setFartist(e.target.value)} placeholder="Chagall, Basquiat, Wou-Ki..." />
                <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                  {isFr ? 'Laissez vide pour tous les artistes' : 'Leave empty for all artists'}
                </div>
              </div>

              {/* 3. Category — multi-select pills */}
              <div>
                <label style={lbl}>{isFr ? 'CATÉGORIE' : 'CATEGORY'}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {CATEGORIES.map(cat => {
                    const sel = fcategories.includes(cat.en);
                    return (
                      <button
                        key={cat.en}
                        type="button"
                        onClick={() => setFcategories(prev =>
                          prev.includes(cat.en) ? prev.filter(c => c !== cat.en) : [...prev, cat.en]
                        )}
                        style={{
                          padding: '5px 12px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer',
                          border: `1px solid ${sel ? '#1A2A44' : '#E8E4DC'}`,
                          background: sel ? '#1A2A44' : 'white',
                          color: sel ? 'white' : '#1A2A44',
                          fontWeight: sel ? 600 : 400,
                          transition: 'all 0.12s',
                        }}
                      >
                        {isFr ? cat.fr : cat.en}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Keywords */}
              <div>
                <label style={lbl}>{isFr ? 'MOTS-CLÉS LIBRES' : 'FREE KEYWORDS'}</label>
                <input
                  style={inp}
                  value={fkeywords}
                  onChange={e => setFkeywords(e.target.value)}
                  placeholder={isFr ? 'Drouot, lithographie, impressionniste...' : "Christie's, lithograph, impressionist..."}
                />
                <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', lineHeight: 1.5 }}>
                  {isFr ? 'Maison de vente, médium, période, nationalité...' : 'Auction house, medium, period, nationality...'}
                </div>
              </div>

              {/* 5. Budget */}
              <div>
                <label style={lbl}>{isFr ? 'BUDGET' : 'BUDGET'}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input style={inp} type="number" min={0} value={fbudgetMin} onChange={e => setFbudgetMin(e.target.value)} placeholder="Min (€)" />
                  <input style={inp} type="number" min={0} value={fbudgetMax} onChange={e => setFbudgetMax(e.target.value)} placeholder={isFr ? 'Max (€) — sans limite' : 'Max (€) — no limit'} />
                </div>
              </div>

              {/* 6. Conviction score */}
              <div>
                <label style={lbl}>{isFr ? 'SCORE MINIMUM' : 'MINIMUM SCORE'} — {fconviction}/100</label>
                <input
                  type="range" min={60} max={95} step={5}
                  value={fconviction}
                  onChange={e => setFconviction(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: '#1A2A44', marginBottom: '6px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)' }}>
                  <span>{isFr ? '60 — plus de signaux' : '60 — more signals'}</span>
                  <span>{isFr ? '95 — signaux premium uniquement' : '95 — premium signals only'}</span>
                </div>
              </div>

              {/* 7. Investment horizon */}
              <div>
                <label style={lbl}>{isFr ? 'HORIZON' : 'HORIZON'}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(isFr
                    ? [
                        { value: 'short',  label: 'Court terme (<6 mois)' },
                        { value: 'medium', label: 'Moyen terme (6–24 mois)' },
                        { value: 'long',   label: 'Long terme (2 ans+)' },
                      ]
                    : [
                        { value: 'short',  label: 'Short (<6mo)' },
                        { value: 'medium', label: 'Medium (6–24mo)' },
                        { value: 'long',   label: 'Long (2yr+)' },
                      ]
                  ).map(({ value, label }) => {
                    const sel = fhorizon === value;
                    return (
                      <button key={value} type="button" onClick={() => setFhorizon(value)}
                        style={{
                          flex: 1, padding: '8px 4px', fontSize: '10px', cursor: 'pointer',
                          border: `1px solid ${sel ? '#1A2A44' : '#E8E4DC'}`,
                          borderRadius: '4px',
                          background: sel ? '#1A2A44' : 'white',
                          color: sel ? 'white' : 'var(--text-2)',
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
                          transition: 'all 0.12s', textAlign: 'center', lineHeight: 1.4,
                        }}
                      >{label}</button>
                    );
                  })}
                </div>
              </div>

              {/* 8. Risk tolerance */}
              <div>
                <label style={lbl}>{isFr ? 'TOLÉRANCE AU RISQUE' : 'RISK TOLERANCE'}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(isFr
                    ? [{ value: 'low', label: 'Faible' }, { value: 'medium', label: 'Moyen' }, { value: 'high', label: 'Élevé' }]
                    : [{ value: 'low', label: 'Low' },    { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]
                  ).map(({ value, label }) => {
                    const sel = frisk === value;
                    return (
                      <button key={value} type="button" onClick={() => setFrisk(value)}
                        style={{
                          flex: 1, padding: '8px 4px', fontSize: '11px', cursor: 'pointer',
                          border: `1px solid ${sel ? '#1A2A44' : '#E8E4DC'}`,
                          borderRadius: '4px',
                          background: sel ? '#1A2A44' : 'white',
                          color: sel ? 'white' : 'var(--text-2)',
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                          transition: 'all 0.12s',
                        }}
                      >{label}</button>
                    );
                  })}
                </div>
              </div>

            </form>

            {/* matchCount — above submit */}
            {matchCount !== null && (
              <div style={{ textAlign: 'center', fontSize: '13px', color: '#B8922A', marginTop: '20px', marginBottom: '12px' }}>
                {isFr
                  ? `~${Math.round(matchCount / 4).toLocaleString()} signaux estimés cette semaine`
                  : `~${Math.round(matchCount / 4).toLocaleString()} estimated signals this week`}
              </div>
            )}

            {/* Submit */}
            <div style={{ marginTop: matchCount !== null ? 0 : '24px' }}>
              <button
                type="submit"
                form="strategy-form"
                disabled={saving}
                onClick={() => { if (!fname.trim()) setFnameError(isFr ? 'Requis' : 'Required'); }}
                style={{
                  width: '100%', padding: '14px', fontSize: '11px',
                  background: '#1A2A44', color: 'white',
                  border: 'none', borderRadius: '2px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-mono)', fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                  opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s',
                }}
              >
                {saving ? (isFr ? 'LANCEMENT…' : 'LAUNCHING…') : (isFr ? 'ACTIVER LA STRATÉGIE →' : 'ACTIVATE STRATEGY →')}
              </button>
              <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-3)', marginTop: '8px' }}>
                {isFr ? 'Votre analyste commence à scanner immédiatement' : 'Your analyst starts scanning immediately'}
              </div>
            </div>

            {/* Signal preview */}
            <div style={{ marginTop: '24px', background: '#1A2A44', padding: '16px 18px', borderLeft: '3px solid #C6A85A', borderRadius: '4px' }}>
              <div style={{ color: 'rgba(198,168,90,0.6)', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
                {isFr ? 'APERÇU DU SIGNAL' : 'SIGNAL PREVIEW'}
              </div>
              <div style={{ display: 'inline-block', background: '#C6A85A', color: '#1A2A44', fontSize: '10px', fontWeight: 700, padding: '3px 10px', marginBottom: '10px', letterSpacing: '0.06em' }}>
                84/100 · EXCEPTIONAL
              </div>
              <div style={{ color: '#999', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px', fontFamily: 'var(--font-mono)' }}>MARC CHAGALL</div>
              <div style={{ color: 'white', fontFamily: 'Georgia, serif', fontSize: '14px', marginBottom: '5px' }}>Lithographie originale, 1972</div>
              <div style={{ color: '#aaa', fontSize: '11px', marginBottom: '10px' }}>Capitolium Art · Est. €1,000–2,000</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span style={{ color: 'white', fontWeight: 600, fontSize: '12px' }}>
                  {isFr ? 'Valeur estimée : €3,500–5,000' : 'Fair value: €3,500–5,000'}
                </span>
                <span style={{ background: '#EAF4EE', color: '#1F6B3A', fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '3px' }}>
                  {isFr ? '+120% potentiel' : '+120% upside'}
                </span>
              </div>
              <div style={{ borderTop: '1px solid rgba(198,168,90,0.2)', paddingTop: '10px', color: 'rgba(198,168,90,0.6)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                {isFr ? 'Voici à quoi ressemble un signal dans votre boîte mail.' : 'This is what a match looks like in your inbox.'}
              </div>
            </div>

          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, backdropFilter: 'blur(2px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 8, padding: '28px 32px',
              width: 360, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-3)', marginBottom: 12 }}>
              SUPPRIMER LA STRATÉGIE
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1A2A44', marginBottom: 8 }}>
              {isFr ? 'Confirmer la suppression' : 'Confirm deletion'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24, lineHeight: 1.6 }}>
              {isFr
                ? 'Cette stratégie et toutes ses recommandations seront supprimées définitivement.'
                : 'This strategy and all its recommendations will be permanently deleted.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: '9px 18px', fontSize: 13, borderRadius: 4,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-2)', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                }}
              >
                {isFr ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={() => { handleDelete(confirmDelete); setConfirmDelete(null); }}
                style={{
                  padding: '9px 18px', fontSize: 13, borderRadius: 4,
                  background: '#C0392B', border: 'none',
                  color: 'white', cursor: 'pointer', fontWeight: 600,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                }}
              >
                {isFr ? 'Supprimer' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
