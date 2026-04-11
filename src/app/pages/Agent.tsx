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

const CATEGORIES = [
  'Peinture', 'Dessin', 'Sculpture', 'Photographie',
  'Joaillerie', 'Art contemporain', 'Art moderne', 'Autre',
];

const HORIZON_LABELS: Record<string, string> = {
  short: 'Court terme',
  medium: 'Moyen terme',
  long: 'Long terme',
};

const RISK_LABELS: Record<string, string> = {
  low: 'Faible',
  medium: 'Modéré',
  high: 'Élevé',
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
          { title: 'Alertes ciblées', desc: 'Définissez vos critères : artiste, catégorie, budget, horizon. L\'agent scrute chaque lot entrant.' },
          { title: 'Analyse GPT-4o', desc: 'Chaque lot est analysé selon votre alerte. Verdict FORT ACHAT / ACHAT / SURVEILLER avec raisonnement.' },
          { title: 'Recommandations personnalisées', desc: 'Notification dès qu\'un lot correspond. Score de conviction, cas haussier/baissier, prix max suggéré.' },
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

// ── Alert form ────────────────────────────────────────────────────────────────

interface AlertFormProps {
  initial?: Partial<AgentAlert>;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function AlertForm({ initial, onSave, onCancel, saving }: AlertFormProps) {
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [name, setName] = useState(initial?.name ?? '');
  const [artistName, setArtistName] = useState(initial?.artist_name ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? '');
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join(', '));
  const [budgetMin, setBudgetMin] = useState(initial?.budget_min_eur?.toString() ?? '');
  const [budgetMax, setBudgetMax] = useState(initial?.budget_max_eur?.toString() ?? '');
  const [horizon, setHorizon] = useState(initial?.investment_horizon ?? 'medium');
  const [risk, setRisk] = useState(initial?.risk_tolerance ?? 'medium');
  const [conviction, setConviction] = useState(initial?.min_conviction_score ?? 65);
  const [notifyEmail, setNotifyEmail] = useState(initial?.notify_email ?? true);
  const [nameError, setNameError] = useState('');

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 11px', fontSize: '13px',
    border: '1px solid var(--border)', borderRadius: '2px',
    background: 'white', color: 'var(--navy)', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  };
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--text-3)', marginBottom: '5px',
  };
  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Required');
      return;
    }
    setNameError('');
    await onSave({
      name,
      artist_name: artistName || null,
      category: category || null,
      subcategory: subcategory || null,
      keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
      budget_min_eur: budgetMin ? parseFloat(budgetMin) : null,
      budget_max_eur: budgetMax ? parseFloat(budgetMax) : null,
      investment_horizon: horizon,
      risk_tolerance: risk,
      min_conviction_score: conviction,
      notify_email: notifyEmail,
    });
  }

  function handleStep1Next() {
    if (!name.trim()) { setNameError('Required'); return; }
    setNameError('');
    setFormStep(2);
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        {([1, 2] as const).map((step) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, background: formStep >= step ? 'var(--navy)' : 'var(--bg-subtle)', color: formStep >= step ? 'white' : 'var(--text-3)', cursor: step < formStep ? 'pointer' : 'default' }} onClick={() => { if (step < formStep) setFormStep(step); }}>{step}</div>
            {step < 2 && <div style={{ width: '28px', height: '1px', background: formStep > step ? 'var(--navy)' : 'var(--border)' }} />}
          </div>
        ))}
        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginLeft: '4px' }}>
          {formStep === 1 ? 'Target' : 'Parameters'}
        </span>
      </div>

      {formStep === 1 && (
        <>
          {/* Step 1: Name + Artist + Category + Subcategory */}
          <div style={{ marginBottom: '14px' }}>
            <label style={lbl}>Strategy name</label>
            <input
              style={{ ...inp, borderColor: nameError ? 'var(--red)' : 'var(--border)' }}
              value={name}
              onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError(''); }}
              placeholder="ex: Picasso < €50K"
              autoFocus
            />
            {nameError && <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '4px' }}>{nameError}</div>}
          </div>

          <div style={row2}>
            <div>
              <label style={lbl}>Artist</label>
              <input style={inp} value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="ex: Picasso, Warhol…" />
            </div>
            <div>
              <label style={lbl}>Category</label>
              <select style={sel} value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={lbl}>Subcategory</label>
            <input style={inp} value={subcategory} onChange={e => setSubcategory(e.target.value)} placeholder="ex: Oil on canvas, Signed…" />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-navy" style={{ fontSize: '12px', padding: '9px 22px' }} onClick={handleStep1Next}>
              Next →
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '12px', padding: '9px 16px' }} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      )}

      {formStep === 2 && (
        <>
          {/* Step 2: Budget + Horizon + Risk + Conviction + Email */}
          <div style={row2}>
            <div>
              <label style={lbl}>Budget min (€)</label>
              <input type="number" style={inp} value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="500" />
            </div>
            <div>
              <label style={lbl}>Budget max (€)</label>
              <input type="number" style={inp} value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="50 000" />
            </div>
          </div>

          <div style={row2}>
            <div>
              <label style={lbl}>Horizon</label>
              <select style={sel} value={horizon} onChange={e => setHorizon(e.target.value)}>
                <option value="short">Short term (&lt; 2 years)</option>
                <option value="medium">Medium term (2–5 years)</option>
                <option value="long">Long term (5+ years)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Risk</label>
              <select style={sel} value={risk} onChange={e => setRisk(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Moderate</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', marginBottom: '20px', alignItems: 'end' }}>
            <div>
              <label style={{ ...lbl, marginBottom: '8px' }}>
                Minimum conviction score — <span style={{ color: 'var(--navy)', fontWeight: 700 }}>{conviction}</span>
              </label>
              <input
                type="range" min={50} max={90} value={conviction}
                onChange={e => setConviction(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: 'var(--navy)' }}
              />
            </div>
            <div style={{ paddingBottom: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-2)', userSelect: 'none' }}>
                <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} style={{ accentColor: 'var(--navy)' }} />
                Email alerts
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn btn-navy" style={{ fontSize: '12px', padding: '9px 22px' }} disabled={saving}>
              {saving ? 'Saving…' : (initial?.id ? 'Update strategy' : 'Create strategy')}
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '12px', padding: '9px 16px' }} onClick={() => setFormStep(1)}>
              Back
            </button>
          </div>
        </>
      )}
    </form>
  );
}

// ── Criteria chips ────────────────────────────────────────────────────────────

function CriteriaChips({ alert }: { alert: AgentAlert }) {
  const chips: string[] = [];
  if (alert.artist_name) chips.push(`🎨 ${alert.artist_name}`);
  if (alert.category) chips.push(`📂 ${alert.category}`);
  if (alert.subcategory) chips.push(`· ${alert.subcategory}`);
  if (alert.budget_min_eur && alert.budget_max_eur) {
    chips.push(`💰 ${fmt(alert.budget_min_eur)}–${fmt(alert.budget_max_eur)}`);
  } else if (alert.budget_max_eur) {
    chips.push(`💰 jusqu'à ${fmt(alert.budget_max_eur)}`);
  } else if (alert.budget_min_eur) {
    chips.push(`💰 à partir de ${fmt(alert.budget_min_eur)}`);
  }
  if (alert.investment_horizon) chips.push(`⏱ ${HORIZON_LABELS[alert.investment_horizon] ?? alert.investment_horizon}`);
  if (alert.keywords?.length) chips.push(`🔍 ${alert.keywords.slice(0, 3).join(', ')}`);

  if (!chips.length) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
      {chips.map(c => (
        <span key={c} style={{
          fontSize: '11px', color: 'var(--navy)', background: 'var(--navy-subtle)',
          border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '2px',
          fontFamily: 'var(--font-mono)',
        }}>
          {c}
        </span>
      ))}
    </div>
  );
}

// ── Alert card ────────────────────────────────────────────────────────────────

interface AlertCardProps {
  alert: AgentAlert;
  onEdit: (alert: AgentAlert) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, val: boolean) => void;
  onScrollToRecs: (alertId: string) => void;
}

function AlertCard({ alert, onEdit, onDelete, onToggle, onScrollToRecs }: AlertCardProps) {
  return (
    <div style={{
      background: 'white', border: '1px solid var(--border)', borderRadius: '2px',
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--navy)', margin: 0 }}>
              {alert.name}
            </p>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
              background: alert.is_active ? 'var(--navy)' : 'var(--border)',
            }} />
          </div>
          <CriteriaChips alert={alert} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={() => onToggle(alert.id, !alert.is_active)}
            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', borderRadius: '2px', padding: '4px 8px', cursor: 'pointer' }}
          >
            {alert.is_active ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={() => onEdit(alert)}
            style={{ fontSize: '13px', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', lineHeight: 1 }}
            title="Modifier"
          >
            ✎
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete strategy "${alert.name}" and all its recommendations?`)) {
                onDelete(alert.id);
              }
            }}
            style={{ fontSize: '14px', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', lineHeight: 1 }}
            title="Supprimer"
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: alert.is_active ? 'var(--electric)' : 'var(--border)', flexShrink: 0, animation: alert.is_active ? 'pulseDot 2s infinite' : 'none' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.04em' }}>
          {alert.is_active ? 'Scanning · Updated every 15 min' : 'Monitoring paused'}
        </span>
      </div>

      {alert.recommendation_count > 0 && (
        <button
          onClick={() => onScrollToRecs(alert.id)}
          style={{
            marginTop: '12px', fontSize: '11px', fontFamily: 'var(--font-mono)',
            color: 'var(--gold-dim)', background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, letterSpacing: '0.04em',
          }}
        >
          {alert.recommendation_count} recommandation{alert.recommendation_count > 1 ? 's' : ''} →
        </button>
      )}
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────

function RecCard({ rec, onRead, onActed }: { rec: Recommendation; onRead: (id: string) => void; onActed: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const verdictLabel = rec.verdict === 'STRONG_BUY' ? 'FORT ACHAT'
    : rec.verdict === 'BUY' ? 'ACHAT'
    : rec.verdict === 'WATCH' ? 'SURVEILLER' : 'PASSER';

  const verdictColor = rec.verdict === 'STRONG_BUY' ? 'var(--electric)'
    : rec.verdict === 'BUY' ? 'var(--navy)' : 'var(--text-3)';

  const stripColor = rec.verdict === 'STRONG_BUY' ? 'var(--electric)'
    : rec.verdict === 'BUY' ? 'var(--navy)' : 'var(--border)';

  async function handleRead() {
    if (rec.is_read) return;
    await fetch(`/api/agent/recommendations/${rec.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    onRead(rec.id);
  }

  async function handleActed() {
    await fetch(`/api/agent/recommendations/${rec.id}/acted`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    onActed(rec.id);
  }

  const date = new Date(rec.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div
      onClick={handleRead}
      style={{
        display: 'flex', border: '1px solid var(--border)', borderRadius: '2px',
        overflow: 'hidden',
        background: rec.is_read ? 'white' : 'var(--navy-subtle)',
        borderLeft: rec.is_read ? `3px solid var(--border)` : `3px solid var(--navy)`,
        transition: 'box-shadow 0.15s var(--ease)',
        cursor: 'default',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Verdict strip */}
      <div style={{ width: '4px', flexShrink: 0, background: stripColor }} />

      <div style={{ flex: 1, padding: '18px 20px' }}>
        {/* Alert name chip */}
        {rec.alert_name && (
          <p style={{
            fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--gold-dim)',
            background: 'var(--gold-subtle)', border: '1px solid var(--gold-border)',
            display: 'inline-block', padding: '2px 8px', borderRadius: '2px',
            marginBottom: '10px',
          }}>
            {rec.alert_name}
          </p>
        )}

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '12px' }}>
          {rec.lot?.image_url && (
            <img
              src={rec.lot.image_url} alt=""
              style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0, border: '1px solid var(--border)' }}
            />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: verdictColor, textTransform: 'uppercase' }}>
                {verdictLabel}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', background: 'var(--border)', padding: '2px 6px', borderRadius: '2px' }}>
                {rec.conviction_score}/100
              </span>
              {rec.is_acted_on && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>✓ ACHETÉ</span>
              )}
            </div>

            {rec.lot ? (
              <>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--navy)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {rec.lot.artist_name_raw || 'Artiste inconnu'}
                </p>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--text-1)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {rec.lot.title}
                </p>
                <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                  <span>{fmt(rec.lot.current_price || rec.lot.estimate_low)}</span>
                  {rec.lot.auction_house_name && <span>{rec.lot.auction_house_name}</span>}
                  {rec.lot.deal_score != null && (
                    <span style={{ color: 'var(--gold-dim)' }}>Score {rec.lot.deal_score.toFixed(0)}</span>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>Lot non disponible</p>
            )}
          </div>

          {/* Right metrics */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {rec.suggested_max_price_eur != null && (
              <div style={{ marginBottom: '6px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Max suggéré</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy)' }}>{fmt(rec.suggested_max_price_eur)}</p>
              </div>
            )}
            {rec.estimated_return_pct != null && (
              <div style={{ marginBottom: '6px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Retour estimé</p>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>
                  {rec.estimated_return_pct > 0 ? '+' : ''}{rec.estimated_return_pct.toFixed(0)}%
                </p>
              </div>
            )}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>{date}</p>
          </div>
        </div>

        {/* Reasoning */}
        <p style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.65, marginBottom: '10px' }}>
          {rec.reasoning}
        </p>

        {/* Expandable */}
        {(rec.bull_case || rec.bear_case) && (
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
              style={{ fontSize: '11px', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
            >
              {expanded ? '▲ Masquer' : '▼ Voir analyse'}
            </button>
            {expanded && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                {rec.bull_case && (
                  <div style={{ padding: '10px 14px', background: 'var(--navy-subtle)', borderRadius: '2px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--navy)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>Cas haussier</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-1)', lineHeight: 1.6 }}>{rec.bull_case}</p>
                  </div>
                )}
                {rec.bear_case && (
                  <div style={{ padding: '10px 14px', background: 'var(--navy-subtle)', borderRadius: '2px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>Risque principal</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-1)', lineHeight: 1.6 }}>{rec.bear_case}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {rec.lot?.url && (
            <a
              href={rec.lot.url} target="_blank" rel="noopener noreferrer"
              className="btn btn-navy"
              style={{ fontSize: '11px', padding: '7px 16px', textDecoration: 'none', letterSpacing: '0.04em' }}
              onClick={e => e.stopPropagation()}
            >
              VOIR LE LOT →
            </a>
          )}
          {!rec.is_acted_on && rec.verdict !== 'PASS' && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: '11px', padding: '7px 14px', letterSpacing: '0.04em' }}
              onClick={e => { e.stopPropagation(); handleActed(); }}
            >
              MARQUER ACHETÉ
            </button>
          )}
          {rec.hold_period_months != null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
              Horizon : {rec.hold_period_months} mois
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Agent() {
  const limits = getPlanLimits();
  if (!limits.hasAIVerdict) return <LockedPage />;
  return <AgentPage />;
}

function AgentPage() {
  const navigate = useNavigate();
  const token = getToken();

  const [limits, setLimits] = useState<Limits | null>(null);
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AgentAlert | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const recsRef = useRef<HTMLDivElement>(null);
  const [filterAlertId, setFilterAlertId] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

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

  useEffect(() => { loadAll(); }, []);

  async function handleCreate(data: Record<string, unknown>) {
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/agent/alerts', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? 'Erreur lors de la création');
      }
      setShowCreateForm(false);
      await loadAll();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur');
    }
    setSaving(false);
  }

  async function handleUpdate(data: Record<string, unknown>) {
    if (!editingAlert) return;
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch(`/api/agent/alerts/${editingAlert.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? 'Erreur lors de la mise à jour');
      }
      setEditingAlert(null);
      await loadAll();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur');
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

  const filteredRecs = filterAlertId ? recs.filter(r => r.alert_id === filterAlertId) : recs;
  const unreadCount = recs.filter(r => !r.is_read).length;

  const sectionTitle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '14px',
  };

  if (loading) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>Chargement…</p>
      </div>
    );
  }

  const showEmptyState = recs.length === 0 && alerts.length === 0;

  return (
    <div>
      {/* Status banner */}
      <div style={{ background: 'var(--navy)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', animation: 'pulseDot 2s infinite', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em' }}>
          AI ANALYST ACTIVE · Scanning new lots every 15 min
        </span>
        {limits && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            {limits.used}/{limits.max === 9999 ? '∞' : limits.max} strategies
          </span>
        )}
      </div>

    <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 400, color: 'var(--navy)', margin: 0 }}>
            AI Agent
          </h1>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0 }}>
          Your personalized investment strategies
        </p>
      </div>

      {/* Empty state with Logo */}
      {showEmptyState && (
        <div style={{ textAlign: 'center', padding: '80px 24px', border: '1px dashed var(--border)', borderRadius: '8px', marginBottom: '32px' }}>
          <Logo variant="symbol" color="dark" size={40} />
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--navy)', margin: '20px 0 8px' }}>
            Your agent is ready
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
            Create a strategy below. The agent will scan new lots and surface matching opportunities with AI verdicts.
          </p>
        </div>
      )}

      {/* Recommendations — hero section */}
      {recs.length > 0 && (
        <div ref={recsRef} style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p style={{ ...sectionTitle, marginBottom: 0 }}>
                Recommendations ({filteredRecs.length})
              </p>
              {unreadCount > 0 && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                  color: 'var(--electric)', background: 'var(--electric-subtle)',
                  border: '1px solid var(--electric-border)', padding: '2px 7px', borderRadius: '2px',
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {filterAlertId && (
              <button
                style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', borderRadius: '2px', padding: '4px 10px', cursor: 'pointer' }}
                onClick={() => setFilterAlertId(null)}
              >
                × All strategies
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredRecs.map(rec => (
              <RecCard key={rec.id} rec={rec} onRead={handleRead} onActed={handleActed} />
            ))}
          </div>
        </div>
      )}

      {/* Limits bar */}
      {limits && limits.max < 9999 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '8px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              width: `${Math.min(100, (limits.used / limits.max) * 100)}%`,
              background: limits.used >= limits.max ? 'var(--gold)' : 'var(--navy)',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
              {limits.used} active strateg{limits.used !== 1 ? 'ies' : 'y'} of {limits.max}
            </p>
            {limits.used >= limits.max && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold-dim)' }}>
                  Limit reached · Upgrade for more strategies
                </span>
                <button
                  className="btn btn-gold"
                  style={{ fontSize: '11px', padding: '6px 14px' }}
                  onClick={() => navigate('/app/pricing')}
                >
                  Upgrade
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create strategy */}
      {limits?.can_create && !showCreateForm && !editingAlert && (
        <div style={{ marginBottom: '24px' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '12px', padding: '9px 18px', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}
            onClick={() => setShowCreateForm(true)}
          >
            + CREATE STRATEGY
          </button>
        </div>
      )}

      {showCreateForm && (
        <div style={{ background: 'var(--navy-subtle)', border: '1px solid var(--border)', borderRadius: '2px', padding: '24px', marginBottom: '24px' }}>
          <p style={{ ...sectionTitle, marginBottom: '20px' }}>New strategy</p>
          {formError && (
            <p style={{ fontSize: '12px', color: 'var(--text-2)', background: 'var(--border)', padding: '8px 12px', borderRadius: '2px', marginBottom: '16px' }}>
              {formError}
            </p>
          )}
          <AlertForm onSave={handleCreate} onCancel={() => { setShowCreateForm(false); setFormError(''); }} saving={saving} />
        </div>
      )}

      {/* Strategies list */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <p style={sectionTitle}>Strategies ({alerts.length})</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alerts.map(alert => (
              editingAlert?.id === alert.id ? (
                <div key={alert.id} style={{ background: 'var(--navy-subtle)', border: '1px solid var(--border)', borderRadius: '2px', padding: '24px' }}>
                  <p style={{ ...sectionTitle, marginBottom: '20px' }}>Edit « {alert.name} »</p>
                  {formError && (
                    <p style={{ fontSize: '12px', color: 'var(--text-2)', background: 'var(--border)', padding: '8px 12px', borderRadius: '2px', marginBottom: '16px' }}>
                      {formError}
                    </p>
                  )}
                  <AlertForm
                    initial={alert}
                    onSave={handleUpdate}
                    onCancel={() => { setEditingAlert(null); setFormError(''); }}
                    saving={saving}
                  />
                </div>
              ) : (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onEdit={a => { setEditingAlert(a); setShowCreateForm(false); }}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  onScrollToRecs={handleScrollToRecs}
                />
              )
            ))}
          </div>
        </div>
      )}

      {/* Recs empty state (has strategies but no recs yet) */}
      {alerts.length > 0 && recs.length === 0 && (
        <div ref={recsRef} style={{ textAlign: 'center', padding: '52px 24px', border: '1px dashed var(--border)', borderRadius: '2px' }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--navy)', marginBottom: '6px' }}>
            Agent scanning the market
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 }}>
            New opportunities will appear here after the next scan
          </p>
        </div>
      )}

    </div>
    </div>
  );
}
