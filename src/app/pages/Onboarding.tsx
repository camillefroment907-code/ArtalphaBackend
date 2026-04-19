import { useState, useEffect } from 'react';
import { Logo } from '../components/Logo';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// ── Data ──────────────────────────────────────────────────────────────────────

const PROFILES = [
  { value: 'first_time',    icon: '🌱', label: 'First acquisition',          sub: 'Starting your collection' },
  { value: 'collector',     icon: '🖼️', label: 'Active collector',            sub: 'Buying regularly, you know the market' },
  { value: 'investor',      icon: '📈', label: 'Financial investor',          sub: 'Returns and portfolio diversification' },
  { value: 'family_office', icon: '🏛️', label: 'Family office / Institution', sub: 'Structured allocation, large ticket' },
];

const BUDGETS = [
  { key: 'under_1k',   label: '< €1 000',           sub: 'Prints, emerging artists',        icon: '◇' },
  { key: '1k_5k',      label: '€1 000 – €5 000',    sub: 'Emerging & mid-market',            icon: '◈' },
  { key: '5k_20k',     label: '€5 000 – €20 000',   sub: 'Established emerging artists',     icon: '◆' },
  { key: '20k_100k',   label: '€20 000 – €100 000', sub: 'Blue-chip & post-war masters',     icon: '◆◆' },
  { key: 'above_100k', label: '> €100 000',          sub: 'Institutional grade',              icon: '◆◆◆' },
];

const HORIZONS = [
  { value: 'short',  icon: '⚡', label: 'Short term',  detail: '< 2 years',  sub: 'Rotation and quick arbitrage' },
  { value: 'medium', icon: '◎', label: 'Medium term', detail: '2–5 years',  sub: 'Appreciation with managed risk' },
  { value: 'long',   icon: '◉', label: 'Long term',   detail: '5+ years',   sub: 'Wealth, estate, heritage' },
];

const CATEGORIES = [
  { label: 'Paintings',          icon: '🖌️' },
  { label: 'Prints & Editions',  icon: '🖨️' },
  { label: 'Sculpture',          icon: '🗿' },
  { label: 'Photography',        icon: '📷' },
  { label: 'Works on Paper',     icon: '📄' },
  { label: 'Street Art',         icon: '🎭' },
  { label: 'NFT & Digital',      icon: '💾' },
  { label: 'Design & Furniture', icon: '🪑' },
];

const MOTIVATIONS = [
  { value: 'return',     icon: '📊', label: 'Financial return',      sub: 'Buy undervalued, sell above market' },
  { value: 'passion',    icon: '❤️', label: 'Passion first',          sub: 'Love for art, living with the pieces' },
  { value: 'both',       icon: '⚖️', label: 'Both in balance',        sub: 'Investment AND aesthetic pleasure' },
  { value: 'patrimony',  icon: '🏛️', label: 'Patrimony & estate',     sub: 'Long-term wealth, heritage transmission' },
];

const CHALLENGES = [
  { value: 'finding_deals',    icon: '🔍', label: 'Finding undervalued lots',   sub: 'Too much noise, too little signal' },
  { value: 'pricing_info',     icon: '📉', label: 'Knowing if the price is fair', sub: 'No reference point, hard to benchmark' },
  { value: 'timing',           icon: '⏱️', label: 'Acting at the right moment',  sub: 'Good lots sell fast, I miss them' },
  { value: 'advisory',         icon: '🤝', label: 'Lack of trusted advice',      sub: 'Hard to find unbiased expertise' },
];

// 6 profile steps + 2 post-profile screens (preview + Larry) + confirmation
const TOTAL_STEPS = 6;

// ── Component ─────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep]               = useState(0);
  const [collectorType, setType]      = useState<string | null>(null);
  const [budget, setBudget]           = useState<string | null>(null);
  const [horizon, setHorizon]         = useState<string | null>(null);
  const [categories, setCategories]   = useState<string[]>([]);
  const [motivation, setMotivation]   = useState<string | null>(null);
  const [challenge, setChallenge]     = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [previewLots, setPreviewLots] = useState<any[]>([]);

  const progressPct = step === 0 ? 0 : step > TOTAL_STEPS ? 100 : Math.round((step / TOTAL_STEPS) * 100);

  // Fetch personalized lots for post-profile preview (step 7), deduplicated by artist
  useEffect(() => {
    if (step !== 7 || previewLots.length > 0) return;
    const token = getToken();
    const params = new URLSearchParams({ sort_by: 'deal_score', sort_dir: 'desc', page_size: '10' });
    if (categories.length > 0) params.set('categories', categories.join(','));
    fetch(`${BACKEND}/api/lots?${params.toString()}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => {
        const raw: any[] = Array.isArray(d) ? d : (d.items || d.lots || []);
        // Deduplicate: keep first occurrence of each artist name
        const seen = new Set<string>();
        const deduped = raw.filter(lot => {
          const key = (lot.artist_name_raw || lot.title || `lot-${lot.id}`).toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 3);
        setPreviewLots(deduped);
      })
      .catch(() => {});
  }, [step]);

  const goNext = () => setStep(s => s + 1);
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const toggleCategory = (cat: string) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const handleComplete = async () => {
    setSaving(true);
    const token = getToken();
    try {
      await fetch(`${BACKEND}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          collector_type:       collectorType,
          investment_budget:    budget,
          investment_horizon:   horizon,
          preferred_categories: categories.length > 0 ? categories : undefined,
          primary_motivation:   motivation,
          main_challenge:       challenge,
        }),
      });
    } catch { /* silent */ }
    localStorage.setItem('nautilus_show_tour', '1');
    localStorage.removeItem('nautilus_tour_seen');
    navigate('/app/explore');
  };

  const handleSkip = () => {
    localStorage.setItem('nautilus_show_tour', '1');
    localStorage.removeItem('nautilus_tour_seen');
    navigate('/app/explore');
  };

  // ── Tile styles ─────────────────────────────────────────────────────────────
  const tile = (selected: boolean): React.CSSProperties => ({
    background: selected ? '#0A1628' : '#FFFFFF',
    border: selected ? '2px solid #0A1628' : '1px solid #E4E2DC',
    borderRadius: '10px',
    padding: '18px 16px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
    color: selected ? '#FFFFFF' : 'inherit',
  });

  const tileHover = (selected: boolean, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!selected) {
      (e.currentTarget as HTMLButtonElement).style.borderColor = '#0A1628';
      (e.currentTarget as HTMLButtonElement).style.background = '#F5F4F0';
    }
  };
  const tileLeave = (selected: boolean, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!selected) {
      (e.currentTarget as HTMLButtonElement).style.borderColor = '#E4E2DC';
      (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'var(--font-sans, Arial, sans-serif)' }}>

      {/* Progress bar */}
      {step > 0 && step <= TOTAL_STEPS && (
        <div style={{ width: '100%', height: '3px', background: '#ECEAE4', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--gold, #C6A85A)', transition: 'width 0.4s ease' }} />
        </div>
      )}

      <div style={{ width: '100%', maxWidth: '580px', padding: '56px 24px 80px', flex: 1 }}>

        {/* ── Step 0: Welcome ─────────────────────────────────────────────── */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', boxShadow: '0 8px 32px rgba(10,22,40,0.2)' }}>
              <Logo variant="symbol" color="white" size={40} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '36px', fontWeight: 600, color: '#0A1628', margin: '0 0 12px', lineHeight: 1.2 }}>
              Welcome to Nautilus
            </h1>
            <div style={{ width: '40px', height: '2px', background: '#C6A85A', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '15px', color: '#666', lineHeight: 1.7, margin: '0 0 12px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              6 quick questions to build your collector profile.
            </p>
            <p style={{ fontSize: '13px', color: '#aaa', lineHeight: 1.6, margin: '0 0 44px', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto', fontFamily: 'var(--font-mono, monospace)' }}>
              Takes under 2 minutes · Used to personalise your deal flow
            </p>
            <button onClick={goNext} style={{ padding: '15px 48px', background: '#0A1628', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#162240')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0A1628')}>
              Get started →
            </button>
            <div style={{ marginTop: '16px' }}>
              <button onClick={handleSkip} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#bbb', cursor: 'pointer' }}>Skip for now</button>
            </div>
          </div>
        )}

        {/* ── Step 1: Collector type ──────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <StepHeader step={1} total={TOTAL_STEPS} question="Who are you as a collector?" hint="This shapes everything — deal flow, alerts, recommendations." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
              {PROFILES.map(p => (
                <button key={p.value} style={tile(collectorType === p.value)}
                  onClick={() => { setType(p.value); setTimeout(goNext, 260); }}
                  onMouseEnter={e => tileHover(collectorType === p.value, e)}
                  onMouseLeave={e => tileLeave(collectorType === p.value, e)}>
                  <div style={{ fontSize: '26px', marginBottom: '10px', lineHeight: 1 }}>{p.icon}</div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '14px', fontWeight: 700, marginBottom: '5px', color: 'inherit' }}>{p.label}</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, lineHeight: 1.4 }}>{p.sub}</div>
                </button>
              ))}
            </div>
            <StepFooter step={1} total={TOTAL_STEPS} onBack={null} onNext={collectorType ? goNext : undefined} onSkip={goNext} canNext={!!collectorType} />
          </div>
        )}

        {/* ── Step 2: Budget ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <StepHeader step={2} total={TOTAL_STEPS} question="What is your typical budget per acquisition?" hint="This calibrates the price range of deals we surface for you." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '40px' }}>
              {BUDGETS.map(b => (
                <button key={b.key} style={{ ...tile(budget === b.key), display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}
                  onClick={() => { setBudget(b.key); setTimeout(goNext, 260); }}
                  onMouseEnter={e => tileHover(budget === b.key, e)}
                  onMouseLeave={e => tileLeave(budget === b.key, e)}>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', opacity: 0.4, letterSpacing: '0.06em', flexShrink: 0, width: '24px', textAlign: 'center' }}>{b.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '16px', fontWeight: 700, marginBottom: '2px', color: 'inherit' }}>{b.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.55, lineHeight: 1.3 }}>{b.sub}</div>
                  </div>
                  {budget === b.key && <div style={{ fontSize: '16px', flexShrink: 0, color: '#C6A85A' }}>✓</div>}
                </button>
              ))}
            </div>
            <StepFooter step={2} total={TOTAL_STEPS} onBack={goBack} onNext={budget ? goNext : undefined} onSkip={goNext} canNext={!!budget} />
          </div>
        )}

        {/* ── Step 3: Investment horizon ──────────────────────────────────── */}
        {step === 3 && (
          <div>
            <StepHeader step={3} total={TOTAL_STEPS} question="What is your investment time horizon?" hint="Shapes how we weight liquidity versus appreciation in scoring." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
              {HORIZONS.map(h => (
                <button key={h.value} style={{ ...tile(horizon === h.value), display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 24px' }}
                  onClick={() => { setHorizon(h.value); setTimeout(goNext, 260); }}
                  onMouseEnter={e => tileHover(horizon === h.value, e)}
                  onMouseLeave={e => tileLeave(horizon === h.value, e)}>
                  <div style={{ fontSize: '22px', flexShrink: 0 }}>{h.icon}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '16px', fontWeight: 700, marginBottom: '3px', color: 'inherit' }}>{h.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.6, lineHeight: 1.4 }}>{h.sub}</div>
                  </div>
                  <div style={{ flexShrink: 0, padding: '4px 12px', background: horizon === h.value ? 'rgba(198,168,90,0.25)' : 'rgba(0,0,0,0.06)', color: horizon === h.value ? '#C6A85A' : 'inherit', borderRadius: '20px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', opacity: horizon === h.value ? 1 : 0.5, transition: 'all 0.15s' }}>
                    {h.detail}
                  </div>
                </button>
              ))}
            </div>
            <StepFooter step={3} total={TOTAL_STEPS} onBack={goBack} onNext={horizon ? goNext : undefined} onSkip={goNext} canNext={!!horizon} />
          </div>
        )}

        {/* ── Step 4: Categories ──────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <StepHeader step={4} total={TOTAL_STEPS} question="Which categories interest you?" hint="Select all that apply — we'll weight your deal flow accordingly." />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '40px' }}>
              {CATEGORIES.map(({ label, icon }) => {
                const selected = categories.includes(label);
                return (
                  <button key={label} onClick={() => toggleCategory(label)} style={{ padding: '10px 18px', borderRadius: '24px', border: selected ? '2px solid #0A1628' : '1px solid #E4E2DC', background: selected ? '#0A1628' : '#FFFFFF', color: selected ? '#FFFFFF' : '#444', fontSize: '13px', fontWeight: selected ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onMouseEnter={e => { if (!selected) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#0A1628'; (e.currentTarget as HTMLButtonElement).style.background = '#F5F4F0'; } }}
                    onMouseLeave={e => { if (!selected) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E4E2DC'; (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; } }}>
                    <span>{icon}</span> {label}
                  </button>
                );
              })}
            </div>
            <StepFooter step={4} total={TOTAL_STEPS} onBack={goBack} onNext={goNext} onSkip={goNext} canNext={true} />
          </div>
        )}

        {/* ── Step 5: Primary motivation ──────────────────────────────────── */}
        {step === 5 && (
          <div>
            <StepHeader step={5} total={TOTAL_STEPS} question="Why do you collect art?" hint="Your motivation determines how we score and rank opportunities for you." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
              {MOTIVATIONS.map(m => (
                <button key={m.value} style={tile(motivation === m.value)}
                  onClick={() => { setMotivation(m.value); setTimeout(goNext, 260); }}
                  onMouseEnter={e => tileHover(motivation === m.value, e)}
                  onMouseLeave={e => tileLeave(motivation === m.value, e)}>
                  <div style={{ fontSize: '26px', marginBottom: '10px', lineHeight: 1 }}>{m.icon}</div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '14px', fontWeight: 700, marginBottom: '5px', color: 'inherit' }}>{m.label}</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, lineHeight: 1.4 }}>{m.sub}</div>
                </button>
              ))}
            </div>
            <StepFooter step={5} total={TOTAL_STEPS} onBack={goBack} onNext={motivation ? goNext : undefined} onSkip={goNext} canNext={!!motivation} />
          </div>
        )}

        {/* ── Step 6: Main challenge ──────────────────────────────────────── */}
        {step === 6 && (
          <div>
            <StepHeader step={6} total={TOTAL_STEPS} question="What's your biggest challenge today?" hint="Nautilus is built around this exact problem. Let's make sure we solve it." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
              {CHALLENGES.map(c => (
                <button key={c.value} style={tile(challenge === c.value)}
                  onClick={() => { setChallenge(c.value); setTimeout(goNext, 260); }}
                  onMouseEnter={e => tileHover(challenge === c.value, e)}
                  onMouseLeave={e => tileLeave(challenge === c.value, e)}>
                  <div style={{ fontSize: '26px', marginBottom: '10px', lineHeight: 1 }}>{c.icon}</div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '14px', fontWeight: 700, marginBottom: '5px', color: 'inherit' }}>{c.label}</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, lineHeight: 1.4 }}>{c.sub}</div>
                </button>
              ))}
            </div>
            <StepFooter step={6} total={TOTAL_STEPS} onBack={goBack} onNext={challenge ? goNext : undefined} onSkip={goNext} canNext={!!challenge} />
          </div>
        )}

        {/* ── Step 7: Personalized lots preview (post-profile, no progress) ── */}
        {step === 7 && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C6A85A', marginBottom: '12px', fontFamily: 'var(--font-mono, monospace)' }}>
                BASED ON YOUR PROFILE
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '26px', fontWeight: 600, color: '#0A1628', margin: '0 0 8px', lineHeight: 1.3 }}>
                Here's a taste of your deal flow.
              </h2>
              <p style={{ fontSize: '13px', color: '#888', margin: 0, lineHeight: 1.6 }}>
                Live lots scored by Nautilus, filtered to your profile. Each artist appears once.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '36px' }}>
              {previewLots.length > 0 ? previewLots.map((lot: any, i: number) => (
                <div key={lot.id || i} style={{ border: '1px solid #E4E2DC', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFFFF', transition: 'box-shadow 0.15s' }}>
                  {lot.image_url ? (
                    <img src={lot.image_url} alt="" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, background: '#F0EEE8' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: '56px', height: '56px', borderRadius: '6px', background: '#F0EEE8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🖼️</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0A1628', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lot.artist_name_raw || 'Unknown artist'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lot.title || lot.category || ''}</div>
                    {lot.auction_house_name && (
                      <div style={{ fontSize: '10px', color: '#bbb', marginTop: '2px', fontFamily: 'var(--font-mono, monospace)' }}>{lot.auction_house_name}</div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {lot.deal_score !== undefined && (
                      <>
                        <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '22px', fontWeight: 700, color: lot.deal_score >= 75 ? '#0A1628' : '#C6A85A', lineHeight: 1 }}>
                          {typeof lot.deal_score === 'number' ? lot.deal_score.toFixed(0) : lot.deal_score}
                        </div>
                        <div style={{ fontSize: '9px', color: '#bbb', marginTop: '2px', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.06em' }}>SCORE</div>
                      </>
                    )}
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: '13px', fontFamily: 'var(--font-mono, monospace)' }}>
                  Loading your personalized lots…
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={goBack} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#888', cursor: 'pointer', padding: 0 }}>← Back</button>
              <button onClick={goNext} style={{ padding: '13px 32px', background: '#0A1628', color: '#FFFFFF', border: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '8px' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#162240')}
                onMouseLeave={e => (e.currentTarget.style.background = '#0A1628')}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 8: Meet Larry ──────────────────────────────────────────── */}
        {step === 8 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'linear-gradient(135deg, #0A1628 0%, #1e3a5f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(10,22,40,0.22)' }}>
              <span style={{ fontSize: '36px' }}>◆</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '28px', fontWeight: 600, color: '#0A1628', margin: '0 0 8px', lineHeight: 1.2 }}>Meet Larry.</h2>
            <div style={{ width: '40px', height: '2px', background: '#C6A85A', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: '0 0 28px', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
              Larry is your private AI art market advisor — trained on 500,000+ auction results. Ask him anything about a lot, an artist, or the market direction.
            </p>
            <div style={{ background: '#F5F4F0', border: '1px solid #E4E2DC', borderRadius: '12px', padding: '20px 24px', marginBottom: '36px', textAlign: 'left', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white', flexShrink: 0, fontWeight: 700 }}>◆</div>
                <div>
                  <div style={{ fontSize: '13px', color: '#333', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '8px' }}>
                    "I've analysed 500,000+ auction results. Tell me your budget and target artists — I'll surface the best undervalued lots, then brief you in 30 seconds."
                  </div>
                  <div style={{ fontSize: '10px', color: '#bbb', fontFamily: 'var(--font-mono, monospace)' }}>Larry · Nautilus AI Advisor</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '380px', margin: '0 auto' }}>
              <button onClick={goBack} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#888', cursor: 'pointer', padding: 0 }}>← Back</button>
              <button onClick={goNext} style={{ padding: '13px 32px', background: '#0A1628', color: '#FFFFFF', border: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '8px' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#162240')}
                onMouseLeave={e => (e.currentTarget.style.background = '#0A1628')}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 9: Confirmation ────────────────────────────────────────── */}
        {step === 9 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#0A1628', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', boxShadow: '0 8px 32px rgba(10,22,40,0.2)' }}>
              <Logo variant="symbol" color="white" size={40} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '30px', fontWeight: 600, color: '#0A1628', margin: '0 0 12px', lineHeight: 1.2 }}>Your profile is ready.</h1>
            <div style={{ width: '40px', height: '2px', background: '#C6A85A', margin: '0 auto 32px' }} />

            {/* Summary grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: '#E4E2DC', border: '1px solid #E4E2DC', borderRadius: '10px', overflow: 'hidden', marginBottom: '40px' }}>
              {[
                { label: 'Profile',    value: PROFILES.find(p => p.value === collectorType)?.label ?? '—' },
                { label: 'Budget',     value: BUDGETS.find(b => b.key === budget)?.label ?? '—' },
                { label: 'Horizon',    value: HORIZONS.find(h => h.value === horizon)?.label ?? '—' },
                { label: 'Focus',      value: categories.length > 0 ? `${categories.length} categories` : 'All' },
                { label: 'Motivation', value: MOTIVATIONS.find(m => m.value === motivation)?.label ?? '—' },
                { label: 'Challenge',  value: CHALLENGES.find(c => c.value === challenge)?.label ?? '—' },
              ].map(item => (
                <div key={item.label} style={{ background: '#FFFFFF', padding: '16px 14px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C6A85A', marginBottom: '5px', fontFamily: 'var(--font-mono, monospace)' }}>{item.label}</div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '12px', fontWeight: 600, color: '#0A1628', lineHeight: 1.3 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <button onClick={handleComplete} disabled={saving} style={{ padding: '15px 48px', background: '#0A1628', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, borderRadius: '8px', marginBottom: '16px' }}
              onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#162240'; }}
              onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#0A1628'; }}>
              {saving ? 'Saving…' : 'See my opportunities →'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepHeader({ step, total, question, hint }: { step: number; total: number; question: string; hint?: string }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C6A85A', marginBottom: '12px', fontFamily: 'var(--font-mono, monospace)' }}>
        STEP {step} OF {total}
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '24px', fontWeight: 600, color: '#0A1628', margin: '0 0 8px', lineHeight: 1.3 }}>
        {question}
      </h2>
      {hint && <p style={{ fontSize: '13px', color: '#999', margin: 0, lineHeight: 1.5 }}>{hint}</p>}
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
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#888', cursor: 'pointer', padding: 0 }}>← Back</button>
        )}
        <button onClick={onSkip} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#ccc', cursor: 'pointer', padding: 0 }}>Skip</button>
      </div>
      {canNext && onNext && (
        <button onClick={onNext} style={{ padding: '12px 28px', background: '#0A1628', color: '#FFFFFF', border: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '8px' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#162240')}
          onMouseLeave={e => (e.currentTarget.style.background = '#0A1628')}>
          Continue →
        </button>
      )}
    </div>
  );
}
