import { useState } from 'react';
import { Logo } from '../components/Logo';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

const PROFILES = [
  { value: 'first_time',    icon: '🎨', label: 'First acquisition',          sub: 'Discovering art investment' },
  { value: 'collector',     icon: '◆',  label: 'Active collector',            sub: 'Buying regularly at auction' },
  { value: 'investor',      icon: '◈',  label: 'Pure investor',               sub: 'Returns and tangible assets' },
  { value: 'family_office', icon: '◇',  label: 'Family office / Institution', sub: 'Structured allocation strategy' },
];

const BUDGETS = [
  { key: 'under_1k',   label: '< €1 000',           sub: 'Prints, emerging artists' },
  { key: '1k_5k',      label: '€1 000 – €5 000',    sub: 'Emerging & mid-market' },
  { key: '5k_20k',     label: '€5 000 – €20 000',   sub: 'Established emerging' },
  { key: '20k_100k',   label: '€20 000 – €100 000', sub: 'Blue-chip & established' },
  { key: 'above_100k', label: '> €100 000',          sub: 'Institutional grade' },
];

const HORIZONS = [
  { value: 'short',  label: 'Short term',  detail: '< 2 years',  sub: 'Fast rotation, liquidity first' },
  { value: 'medium', label: 'Medium term', detail: '2–5 years',  sub: 'Balance of return and security' },
  { value: 'long',   label: 'Long term',   detail: '5+ years',   sub: 'Wealth, estate, slow appreciation' },
];

const CATEGORIES = [
  'Paintings', 'Prints & Editions', 'Sculpture', 'Photography',
  'Works on Paper', 'Street Art', 'NFT & Digital', 'Design & Furniture',
];

const TOTAL_STEPS = 4;

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep]                   = useState(0);
  const [collectorType, setCollectorType] = useState<string | null>(null);
  const [budget, setBudget]               = useState<string | null>(null);
  const [horizon, setHorizon]             = useState<string | null>(null);
  const [categories, setCategories]       = useState<string[]>([]);
  const [saving, setSaving]               = useState(false);

  const progressPct = step === 0 ? 0 : step > TOTAL_STEPS ? 100 : Math.round((step / TOTAL_STEPS) * 100);

  const goNext = () => setStep(s => s + 1);
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const toggleCategory = (cat: string) => {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleComplete = async () => {
    setSaving(true);
    const token = getToken();
    try {
      await fetch(`${BACKEND}/api/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          collector_type:       collectorType,
          investment_budget:    budget,
          investment_horizon:   horizon,
          preferred_categories: categories.length > 0 ? categories : undefined,
        }),
      });
    } catch (e) {
      // Silent
    }
    localStorage.setItem('nautilus_show_tour', '1');
    localStorage.removeItem('nautilus_tour_seen');
    navigate('/app/explore');
  };

  const handleSkip = () => {
    localStorage.setItem('nautilus_show_tour', '1');
    localStorage.removeItem('nautilus_tour_seen');
    navigate('/app/explore');
  };

  const tileStyle = (selected: boolean): React.CSSProperties => ({
    background: selected ? 'var(--navy-subtle, rgba(26,42,68,0.05))' : '#FFFFFF',
    border: selected ? '2px solid var(--navy, #1A2A44)' : '1px solid var(--border, #E8E6E0)',
    borderRadius: '8px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    textAlign: 'left' as const,
    width: '100%',
    boxSizing: 'border-box' as const,
  });

  const horizonStyle = (selected: boolean): React.CSSProperties => ({
    ...tileStyle(selected),
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAFAF8',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: 'var(--font-sans, Arial, sans-serif)',
    }}>

      {/* Progress bar */}
      {step > 0 && step <= TOTAL_STEPS && (
        <div style={{ width: '100%', height: '2px', background: '#E8E6E0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: 'var(--gold, #C6A85A)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '560px', padding: '60px 24px 80px', flex: 1 }}>

        {/* ── Step 0: Welcome ─────────────────────────────────────── */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'var(--navy, #1A2A44)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 28px',
            }}>
              <Logo variant="symbol" color="white" size={36} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '34px', fontWeight: 600, color: '#1A2A44', margin: '0 0 16px', lineHeight: 1.2 }}>
              Welcome to Nautilus
            </h1>
            <div style={{ width: '40px', height: '2px', background: 'var(--gold, #C6A85A)', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '15px', color: '#666', lineHeight: 1.7, margin: '0 0 48px', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
              4 quick questions to personalise your deal flow. Takes under 2 minutes.
            </p>
            <button
              onClick={goNext}
              style={{
                padding: '14px 44px',
                background: '#1A2A44',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0f1e33')}
              onMouseLeave={e => (e.currentTarget.style.background = '#1A2A44')}
            >
              Get started →
            </button>
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={handleSkip}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: '#aaa', cursor: 'pointer' }}
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Profile ──────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <StepHeader step={1} total={TOTAL_STEPS} question="Which profile fits you best?" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
              {PROFILES.map(p => (
                <button
                  key={p.value}
                  style={tileStyle(collectorType === p.value)}
                  onClick={() => { setCollectorType(p.value); setTimeout(goNext, 280); }}
                  onMouseEnter={e => { if (collectorType !== p.value) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy, #1A2A44)'; }}
                  onMouseLeave={e => { if (collectorType !== p.value) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border, #E8E6E0)'; }}
                >
                  <div style={{ fontSize: '22px', marginBottom: '10px', lineHeight: 1 }}>{p.icon}</div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '14px', fontWeight: 600, color: '#1A2A44', marginBottom: '4px' }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.4 }}>{p.sub}</div>
                </button>
              ))}
            </div>
            <StepFooter step={1} total={TOTAL_STEPS} onBack={null} onNext={collectorType ? goNext : undefined} onSkip={goNext} canNext={!!collectorType} />
          </div>
        )}

        {/* ── Step 2: Budget ───────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <StepHeader step={2} total={TOTAL_STEPS} question="What is your typical budget per lot?" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
              {BUDGETS.map(b => (
                <button
                  key={b.key}
                  style={tileStyle(budget === b.key)}
                  onClick={() => { setBudget(b.key); setTimeout(goNext, 280); }}
                  onMouseEnter={e => { if (budget !== b.key) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy, #1A2A44)'; }}
                  onMouseLeave={e => { if (budget !== b.key) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border, #E8E6E0)'; }}
                >
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '15px', fontWeight: 600, color: '#1A2A44', marginBottom: '4px' }}>
                    {b.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.4 }}>{b.sub}</div>
                </button>
              ))}
            </div>
            <StepFooter step={2} total={TOTAL_STEPS} onBack={goBack} onNext={budget ? goNext : undefined} onSkip={goNext} canNext={!!budget} />
          </div>
        )}

        {/* ── Step 3: Horizon ──────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <StepHeader step={3} total={TOTAL_STEPS} question="What is your investment time horizon?" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
              {HORIZONS.map(h => (
                <button
                  key={h.value}
                  style={horizonStyle(horizon === h.value)}
                  onClick={() => { setHorizon(h.value); setTimeout(goNext, 280); }}
                  onMouseEnter={e => { if (horizon !== h.value) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy, #1A2A44)'; }}
                  onMouseLeave={e => { if (horizon !== h.value) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border, #E8E6E0)'; }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '15px', fontWeight: 600, color: '#1A2A44', marginBottom: '3px' }}>
                      {h.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', lineHeight: 1.4 }}>{h.sub}</div>
                  </div>
                  <div style={{
                    flexShrink: 0,
                    padding: '4px 10px',
                    background: horizon === h.value ? 'var(--navy, #1A2A44)' : '#F0EEE8',
                    color: horizon === h.value ? '#fff' : '#888',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono, monospace)',
                    transition: 'background 0.15s, color 0.15s',
                  }}>
                    {h.detail}
                  </div>
                </button>
              ))}
            </div>
            <StepFooter step={3} total={TOTAL_STEPS} onBack={goBack} onNext={horizon ? goNext : undefined} onSkip={goNext} canNext={!!horizon} />
          </div>
        )}

        {/* ── Step 4: Categories ───────────────────────────────────── */}
        {step === 4 && (
          <div>
            <StepHeader step={4} total={TOTAL_STEPS} question="Which categories interest you?" />
            <p style={{ fontSize: '13px', color: '#888', margin: '-16px 0 24px', lineHeight: 1.5 }}>
              Select all that apply — we'll filter your deal flow accordingly.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '40px' }}>
              {CATEGORIES.map(cat => {
                const selected = categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '24px',
                      border: selected ? '2px solid var(--navy, #1A2A44)' : '1px solid var(--border, #E8E6E0)',
                      background: selected ? 'var(--navy, #1A2A44)' : '#FFFFFF',
                      color: selected ? '#FFFFFF' : '#444',
                      fontSize: '13px',
                      fontWeight: selected ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy, #1A2A44)'; }}
                    onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border, #E8E6E0)'; }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <StepFooter step={4} total={TOTAL_STEPS} onBack={goBack} onNext={goNext} onSkip={goNext} canNext={true} />
          </div>
        )}

        {/* ── Step 5: Confirmation ─────────────────────────────────── */}
        {step === 5 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'var(--navy, #1A2A44)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 28px',
            }}>
              <Logo variant="symbol" color="white" size={36} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '30px', fontWeight: 600, color: '#1A2A44', margin: '0 0 12px', lineHeight: 1.2 }}>
              Your profile is ready.
            </h1>
            <div style={{ width: '40px', height: '2px', background: 'var(--gold, #C6A85A)', margin: '0 auto 32px' }} />

            {/* Summary strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1px',
              background: '#E8E6E0',
              border: '1px solid #E8E6E0',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '40px',
            }}>
              {[
                { label: 'Profile',  value: PROFILES.find(p => p.value === collectorType)?.label ?? 'Not set' },
                { label: 'Budget',   value: BUDGETS.find(b => b.key === budget)?.label ?? 'Not set' },
                { label: 'Horizon',  value: HORIZONS.find(h => h.value === horizon)?.label ?? 'Not set' },
                { label: 'Focus',    value: categories.length > 0 ? `${categories.length} categories` : 'All categories' },
              ].map(item => (
                <div key={item.label} style={{ background: '#FFFFFF', padding: '18px 16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold, #C6A85A)', marginBottom: '6px' }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '13px', fontWeight: 600, color: '#1A2A44', lineHeight: 1.3 }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleComplete}
              disabled={saving}
              style={{
                padding: '14px 44px',
                background: '#1A2A44',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                borderRadius: '4px',
                marginBottom: '16px',
              }}
              onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#0f1e33'; }}
              onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#1A2A44'; }}
            >
              {saving ? 'Saving…' : 'See my opportunities →'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepHeader({ step, total, question }: { step: number; total: number; question: string }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold, #C6A85A)', marginBottom: '14px' }}>
        Step {step} of {total}
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '24px', fontWeight: 600, color: '#1A2A44', margin: 0, lineHeight: 1.3 }}>
        {question}
      </h2>
    </div>
  );
}

interface StepFooterProps {
  step: number;
  total: number;
  onBack: (() => void) | null;
  onNext?: () => void;
  onSkip: () => void;
  canNext: boolean;
}

function StepFooter({ onBack, onNext, onSkip, canNext }: StepFooterProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', fontSize: '12px', color: '#888', cursor: 'pointer', padding: 0 }}
          >
            ← Back
          </button>
        )}
        <button
          onClick={onSkip}
          style={{ background: 'none', border: 'none', fontSize: '12px', color: '#bbb', cursor: 'pointer', padding: 0 }}
        >
          Skip
        </button>
      </div>
      {canNext && onNext && (
        <button
          onClick={onNext}
          style={{
            padding: '12px 28px',
            background: '#1A2A44',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0f1e33')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1A2A44')}
        >
          Continue →
        </button>
      )}
    </div>
  );
}
