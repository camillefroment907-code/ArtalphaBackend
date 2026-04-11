import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';

interface Budget {
  min: number;
  max: number | null;
  label: string;
}

const BUDGETS: Budget[] = [
  { min: 0,      max: 5000,   label: '< €5 000' },
  { min: 5000,   max: 20000,  label: '€5 000 – €20 000' },
  { min: 20000,  max: 100000, label: '€20 000 – €100 000' },
  { min: 100000, max: null,   label: '> €100 000' },
];

const PROFILES = [
  { value: 'first_time', icon: '🎨', label: 'Première acquisition',    sub: "Je découvre l'investissement art" },
  { value: 'collector',  icon: '◆', label: 'Collectionneur actif',    sub: "J'achète régulièrement en ventes aux enchères" },
  { value: 'investor',   icon: '◈', label: 'Investisseur pur',        sub: "Je cherche des rendements et des actifs tangibles" },
];

const HORIZONS = [
  { value: 'short',  icon: '⚡', label: 'Court terme — < 2 ans',  sub: 'Rotation rapide, liquidité prioritaire' },
  { value: 'medium', icon: '◎', label: 'Moyen terme — 2 à 5 ans', sub: 'Équilibre rendement / sécurité' },
  { value: 'long',   icon: '◇', label: 'Long terme — 5 ans +',    sub: 'Patrimoine, transmission, valorisation lente' },
];

const TOTAL_STEPS = 4; // 0..3 (steps 1-3 are questions, step 0 = welcome, step 3 = done but we show progress 0-3)

// CSS vars assumed: --navy, --gold, --gold-dim, --border, --font-serif, --font-sans, --text-2, --text-3

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const progressPct = step === 0 ? 0 : Math.round((step / 3) * 100);

  const goNext = () => setStep(s => Math.min(s + 1, 4));
  const goSkip = () => setStep(s => Math.min(s + 1, 4));

  const tileStyle = (selected: boolean): React.CSSProperties => ({
    background: selected ? 'rgba(26,42,68,0.04)' : '#FFFFFF',
    border: selected ? '2px solid var(--navy)' : '1px solid var(--border)',
    borderRadius: '2px',
    padding: '24px 20px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    textAlign: 'left' as const,
    width: '100%',
    boxSizing: 'border-box' as const,
  });

  const handleFinish = async () => {
    setSaving(true);
    try {
      localStorage.setItem('artalpha-budget', JSON.stringify({ min: budget?.min ?? 0, max: budget?.max ?? null }));
      if (horizon) localStorage.setItem('artalpha-horizon', horizon);

      const token = getToken();
      await fetch('/api/profile/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          min_lot_budget_eur: budget?.min ?? null,
          max_lot_budget_eur: budget?.max ?? null,
          collector_type: profile,
          investment_horizon: horizon,
        }),
      });
    } catch (e) {
      console.error('Onboarding save failed:', e);
    } finally {
      setSaving(false);
      navigate('/app/opportunities');
    }
  };

  const autoAdvance = (fn: () => void) => {
    setTimeout(fn, 300);
  };

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
      {step > 0 && step < 4 && (
        <div style={{ width: '100%', height: '3px', background: '#E8E6E0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: 'var(--gold, #C6A85A)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '560px', padding: '60px 24px 80px', flex: 1 }}>

        {/* ── Step 0: Welcome ─────────────────────────────── */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold, #C6A85A)', marginBottom: '24px' }}>
              Nautilus
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '36px', fontWeight: 600, color: '#1A2A44', margin: '0 0 16px', lineHeight: 1.2 }}>
              Bienvenue sur Nautilus
            </h1>
            <div style={{ width: '40px', height: '2px', background: 'var(--gold, #C6A85A)', margin: '0 auto 24px' }} />
            <p style={{ fontSize: '15px', color: '#666', lineHeight: 1.7, margin: '0 0 48px' }}>
              Quelques questions pour personnaliser votre expérience d'investissement. 2 minutes.
            </p>
            <button
              onClick={goNext}
              style={{
                padding: '14px 40px',
                background: '#1A2A44',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0f1e33')}
              onMouseLeave={e => (e.currentTarget.style.background = '#1A2A44')}
            >
              Commencer →
            </button>
          </div>
        )}

        {/* ── Step 1: Budget ──────────────────────────────── */}
        {step === 1 && (
          <div>
            <StepHeader step={1} total={3} question="Quel est votre budget d'investissement par lot ?" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
              {BUDGETS.map(b => (
                <button
                  key={b.label}
                  style={tileStyle(budget?.label === b.label)}
                  onClick={() => {
                    setBudget(b);
                    autoAdvance(goNext);
                  }}
                  onMouseEnter={e => { if (budget?.label !== b.label) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy, #1A2A44)'; }}
                  onMouseLeave={e => { if (budget?.label !== b.label) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border, #E8E6E0)'; }}
                >
                  <span style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '18px', fontWeight: 600, color: '#1A2A44', display: 'block' }}>
                    {b.label}
                  </span>
                </button>
              ))}
            </div>
            <StepFooter onNext={budget ? goNext : undefined} onSkip={goSkip} canNext={!!budget} />
          </div>
        )}

        {/* ── Step 2: Profile ─────────────────────────────── */}
        {step === 2 && (
          <div>
            <StepHeader step={2} total={3} question="Quel profil vous correspond ?" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
              {PROFILES.map(p => (
                <button
                  key={p.value}
                  style={tileStyle(profile === p.value)}
                  onClick={() => {
                    setProfile(p.value);
                    autoAdvance(goNext);
                  }}
                  onMouseEnter={e => { if (profile !== p.value) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy, #1A2A44)'; }}
                  onMouseLeave={e => { if (profile !== p.value) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border, #E8E6E0)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <span style={{ fontSize: '22px', lineHeight: 1, marginTop: '2px' }}>{p.icon}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '16px', fontWeight: 600, color: '#1A2A44', marginBottom: '4px' }}>
                        {p.label}
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.5 }}>{p.sub}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <StepFooter onNext={profile ? goNext : undefined} onSkip={goSkip} canNext={!!profile} />
          </div>
        )}

        {/* ── Step 3: Horizon ─────────────────────────────── */}
        {step === 3 && (
          <div>
            <StepHeader step={3} total={3} question="Sur quel horizon souhaitez-vous investir ?" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
              {HORIZONS.map(h => (
                <button
                  key={h.value}
                  style={tileStyle(horizon === h.value)}
                  onClick={() => {
                    setHorizon(h.value);
                    autoAdvance(goNext);
                  }}
                  onMouseEnter={e => { if (horizon !== h.value) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy, #1A2A44)'; }}
                  onMouseLeave={e => { if (horizon !== h.value) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border, #E8E6E0)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <span style={{ fontSize: '22px', lineHeight: 1, marginTop: '2px' }}>{h.icon}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '16px', fontWeight: 600, color: '#1A2A44', marginBottom: '4px' }}>
                        {h.label}
                      </div>
                      <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.5 }}>{h.sub}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <StepFooter onNext={horizon ? goNext : undefined} onSkip={goSkip} canNext={!!horizon} />
          </div>
        )}

        {/* ── Step 4: Confirmation ────────────────────────── */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '20px' }}>◈</div>
            <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '30px', fontWeight: 600, color: '#1A2A44', margin: '0 0 12px', lineHeight: 1.2 }}>
              Votre profil est configuré
            </h1>
            <div style={{ width: '40px', height: '2px', background: 'var(--gold, #C6A85A)', margin: '0 auto 32px' }} />

            {/* Summary strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '1px',
              background: '#E8E6E0',
              border: '1px solid #E8E6E0',
              marginBottom: '40px',
            }}>
              {[
                { label: 'Budget', value: budget?.label ?? '—' },
                { label: 'Profil',  value: PROFILES.find(p => p.value === profile)?.label ?? 'Non renseigné' },
                { label: 'Horizon', value: HORIZONS.find(h => h.value === horizon)?.label.split('—')[0].trim() ?? 'Non renseigné' },
              ].map(item => (
                <div key={item.label} style={{ background: '#FFFFFF', padding: '20px 16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold, #C6A85A)', marginBottom: '8px' }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '13px', fontWeight: 600, color: '#1A2A44', lineHeight: 1.3 }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleFinish}
              disabled={saving}
              style={{
                padding: '14px 40px',
                background: '#1A2A44',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                marginBottom: '20px',
              }}
              onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#0f1e33'; }}
              onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#1A2A44'; }}
            >
              {saving ? 'Enregistrement…' : 'Voir mes opportunités →'}
            </button>

            <div>
              <button
                onClick={() => navigate('/app/portfolio')}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: '#999', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Modifier plus tard dans Portfolio
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function StepHeader({ step, total, question }: { step: number; total: number; question: string }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold, #C6A85A)', marginBottom: '16px' }}>
        Étape {step} / {total}
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '24px', fontWeight: 600, color: '#1A2A44', margin: 0, lineHeight: 1.3 }}>
        {question}
      </h2>
    </div>
  );
}

function StepFooter({ onNext, onSkip, canNext }: { onNext?: () => void; onSkip: () => void; canNext: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <button
        onClick={onSkip}
        style={{ background: 'none', border: 'none', fontSize: '12px', color: '#999', cursor: 'pointer' }}
      >
        Passer
      </button>
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
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0f1e33')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1A2A44')}
        >
          Suivant →
        </button>
      )}
    </div>
  );
}
