import { useState, useEffect } from 'react';
import { Logo } from '../components/Logo';
import { LarryFace } from '../components/Larry';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';
import { useTranslation } from 'react-i18next';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// ── Data ──────────────────────────────────────────────────────────────────────

const PROFILES = [
  { value: 'beginner',         icon: '🌱', label: "I'm discovering the market",      labelFr: 'Je découvre le marché',              sub: 'First steps, guided approach',         subFr: 'Premiers pas, approche guidée' },
  { value: 'casual_collector', icon: '🖼️', label: 'I buy occasionally',              labelFr: "J'achète déjà occasionnellement",    sub: 'Building my collection step by step',  subFr: 'Je construis ma collection progressivement' },
  { value: 'performance',      icon: '📈', label: "I'm looking for returns",         labelFr: 'Je cherche du rendement',            sub: 'Art as a financial asset',             subFr: "L'art comme actif financier" },
  { value: 'wealth',           icon: '🏛️', label: "I'm building an art patrimony",   labelFr: 'Je construis un patrimoine artistique', sub: 'Long-term, selective, ambitious',   subFr: 'Long terme, sélectif, ambitieux' },
];

const BUDGETS = [
  { key: 'under_500',  label: '< €500',              labelFr: '< €500',              sub: 'Entry level',         subFr: 'Premier achat',         icon: '◇' },
  { key: '500_2k',     label: '€500 – €2 000',       labelFr: '€500 – €2 000',       sub: 'Emerging artists',    subFr: 'Artistes émergents',     icon: '◈' },
  { key: '2k_10k',     label: '€2 000 – €10 000',    labelFr: '€2 000 – €10 000',    sub: 'Established market',  subFr: 'Marché confirmé',        icon: '◆' },
  { key: '10k_50k',    label: '€10 000 – €50 000',   labelFr: '€10 000 – €50 000',   sub: 'Blue chip access',    subFr: 'Accès blue chip',        icon: '◆◆' },
  { key: 'above_50k',  label: '> €50 000',            labelFr: '> €50 000',           sub: 'Institutional grade', subFr: 'Niveau institutionnel',  icon: '◆◆◆' },
];

const HORIZONS = [
  { value: 'short',  icon: '⚡', label: 'Short term',  labelFr: 'Court terme',  detail: '< 2 years',  detailFr: '< 2 ans',  sub: 'Rotation and quick arbitrage',          subFr: 'Rotation et arbitrage rapide' },
  { value: 'medium', icon: '◎', label: 'Medium term', labelFr: 'Moyen terme', detail: '2–5 years',  detailFr: '2–5 ans',  sub: 'Appreciation with managed risk',        subFr: 'Appréciation avec risque maîtrisé' },
  { value: 'long',   icon: '◉', label: 'Long term',   labelFr: 'Long terme',  detail: '5+ years',   detailFr: '5+ ans',   sub: 'Wealth, estate, heritage',              subFr: 'Patrimoine, succession, héritage' },
];

const CATEGORIES = [
  { label: 'Peinture',            labelFr: 'Peinture',            icon: '🎨' },
  { label: 'Estampes & Éditions', labelFr: 'Estampes & Éditions', icon: '🖨️' },
  { label: 'Sculpture',           labelFr: 'Sculpture',           icon: '🗿' },
  { label: 'Photographie',        labelFr: 'Photographie',        icon: '📷' },
  { label: 'Dessin & Papier',     labelFr: 'Dessin & Papier',     icon: '✏️' },
  { label: 'Art urbain',          labelFr: 'Art urbain',          icon: '🏙️' },
];

const MOTIVATIONS = [
  { value: 'return',    icon: '📊', label: 'Financial return',   labelFr: 'Rendement financier',    sub: 'Buy undervalued, sell above market',          subFr: 'Acheter sous-évalué, revendre au prix de marché' },
  { value: 'passion',   icon: '❤️', label: 'Passion first',       labelFr: 'Passion avant tout',     sub: 'Love for art, living with the pieces',        subFr: "Amour de l'art, vivre avec les œuvres" },
  { value: 'both',      icon: '⚖️', label: 'Both in balance',     labelFr: 'Les deux en équilibre',  sub: 'Investment AND aesthetic pleasure',           subFr: 'Investissement ET plaisir esthétique' },
  { value: 'patrimony', icon: '🏛️', label: 'Patrimony & estate',  labelFr: 'Patrimoine & succession', sub: 'Long-term wealth, heritage transmission',    subFr: 'Patrimoine à long terme, transmission' },
];

const CHALLENGES = [
  { value: 'finding_deals',  icon: '🔍', label: 'Finding undervalued lots',     labelFr: 'Trouver des lots sous-évalués',     sub: 'Too much noise, too little signal',           subFr: 'Trop de bruit, trop peu de signaux' },
  { value: 'pricing_info',   icon: '📉', label: 'Knowing if the price is fair', labelFr: 'Savoir si le prix est juste',       sub: 'No reference point, hard to benchmark',      subFr: 'Pas de référence, difficile de benchmarker' },
  { value: 'timing',         icon: '⏱️', label: 'Acting at the right moment',   labelFr: 'Agir au bon moment',               sub: 'Good lots sell fast, I miss them',            subFr: 'Les bons lots se vendent vite, je les rate' },
  { value: 'advisory',       icon: '🤝', label: 'Lack of trusted advice',       labelFr: 'Manque de conseils de confiance',  sub: 'Hard to find unbiased expertise',            subFr: 'Difficile de trouver une expertise impartiale' },
];

// 6 profile steps + 2 post-profile screens (preview + Larry) + confirmation
const TOTAL_STEPS = 6;

// ── Component ─────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');
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
    const BUDGET_MAX: Record<string, number> = {
      under_500: 500,
      '500_2k': 2000,
      '2k_10k': 10000,
      '10k_50k': 50000,
      above_50k: 999999,
    };
    const budgetMax = BUDGET_MAX[budget ?? ''] ?? 999999;
    const params = new URLSearchParams({ sort_by: 'deal_score', sort_dir: 'desc', page_size: '10' });
    if (categories.length > 0) params.set('categories', categories.join(','));
    params.set('estimate_max', String(budgetMax));
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
    navigate('/app/today');
  };

  const handleSkip = () => {
    localStorage.setItem('nautilus_show_tour', '1');
    localStorage.removeItem('nautilus_tour_seen');
    navigate('/app/today');
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
              {isFr ? 'Bienvenue sur Nautilus' : 'Welcome to Nautilus'}
            </h1>
            <div style={{ width: '40px', height: '2px', background: '#C6A85A', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '15px', color: '#666', lineHeight: 1.7, margin: '0 0 12px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              {isFr ? '6 questions rapides pour construire votre profil de collectionneur.' : '6 quick questions to build your collector profile.'}
            </p>
            <p style={{ fontSize: '13px', color: '#aaa', lineHeight: 1.6, margin: '0 0 44px', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto', fontFamily: 'var(--font-mono, monospace)' }}>
              {isFr ? 'Moins de 2 minutes · Pour personnaliser votre flux de deals' : 'Takes under 2 minutes · Used to personalise your deal flow'}
            </p>
            <button onClick={goNext} style={{ padding: '15px 48px', background: '#2563EB', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}>
              {isFr ? 'Commencer →' : 'Get started →'}
            </button>
            <div style={{ marginTop: '16px' }}>
              <button onClick={handleSkip} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#bbb', cursor: 'pointer' }}>
                {isFr ? "Passer pour l'instant" : 'Skip for now'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Collector type ──────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <StepHeader isFr={isFr} step={1} total={TOTAL_STEPS}
              question={isFr ? 'Quel type de collectionneur êtes-vous ?' : 'Who are you as a collector?'}
              hint={isFr ? 'Cela définit tout — flux de deals, alertes, recommandations.' : 'This shapes everything — deal flow, alerts, recommendations.'} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
              {PROFILES.map(p => (
                <button key={p.value} style={tile(collectorType === p.value)}
                  onClick={() => { setType(p.value); setTimeout(goNext, 260); }}
                  onMouseEnter={e => tileHover(collectorType === p.value, e)}
                  onMouseLeave={e => tileLeave(collectorType === p.value, e)}>
                  <div style={{ fontSize: '26px', marginBottom: '10px', lineHeight: 1 }}>{p.icon}</div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '14px', fontWeight: 700, marginBottom: '5px', color: 'inherit' }}>{isFr ? p.labelFr : p.label}</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, lineHeight: 1.4 }}>{isFr ? p.subFr : p.sub}</div>
                </button>
              ))}
            </div>
            <StepFooter isFr={isFr} step={1} total={TOTAL_STEPS} onBack={null} onNext={collectorType ? goNext : undefined} onSkip={goNext} canNext={!!collectorType} />
          </div>
        )}

        {/* ── Step 2: Budget ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <StepHeader isFr={isFr} step={2} total={TOTAL_STEPS}
              question={isFr ? 'Quel est votre budget typique par acquisition ?' : 'What is your typical budget per acquisition?'}
              hint={isFr ? 'Cela calibre la fourchette de prix des deals que nous vous proposons.' : 'This calibrates the price range of deals we surface for you.'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '40px' }}>
              {BUDGETS.map(b => (
                <button key={b.key} style={{ ...tile(budget === b.key), display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}
                  onClick={() => { setBudget(b.key); setTimeout(goNext, 260); }}
                  onMouseEnter={e => tileHover(budget === b.key, e)}
                  onMouseLeave={e => tileLeave(budget === b.key, e)}>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px', opacity: 0.4, letterSpacing: '0.06em', flexShrink: 0, width: '24px', textAlign: 'center' }}>{b.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '16px', fontWeight: 700, marginBottom: '2px', color: 'inherit' }}>{b.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.55, lineHeight: 1.3 }}>{isFr ? b.subFr : b.sub}</div>
                  </div>
                  {budget === b.key && <div style={{ fontSize: '16px', flexShrink: 0, color: '#C6A85A' }}>✓</div>}
                </button>
              ))}
            </div>
            <StepFooter isFr={isFr} step={2} total={TOTAL_STEPS} onBack={goBack} onNext={budget ? goNext : undefined} onSkip={goNext} canNext={!!budget} />
          </div>
        )}

        {/* ── Step 3: Investment horizon ──────────────────────────────────── */}
        {step === 3 && (
          <div>
            <StepHeader isFr={isFr} step={3} total={TOTAL_STEPS}
              question={isFr ? "Quel est votre horizon d'investissement ?" : 'What is your investment time horizon?'}
              hint={isFr ? 'Détermine comment nous pondérons liquidité et appréciation dans le scoring.' : 'Shapes how we weight liquidity versus appreciation in scoring.'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
              {HORIZONS.map(h => (
                <button key={h.value} style={{ ...tile(horizon === h.value), display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 24px' }}
                  onClick={() => { setHorizon(h.value); setTimeout(goNext, 260); }}
                  onMouseEnter={e => tileHover(horizon === h.value, e)}
                  onMouseLeave={e => tileLeave(horizon === h.value, e)}>
                  <div style={{ fontSize: '22px', flexShrink: 0 }}>{h.icon}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '16px', fontWeight: 700, marginBottom: '3px', color: 'inherit' }}>{isFr ? h.labelFr : h.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.6, lineHeight: 1.4 }}>{isFr ? h.subFr : h.sub}</div>
                  </div>
                  <div style={{ flexShrink: 0, padding: '4px 12px', background: horizon === h.value ? 'rgba(198,168,90,0.25)' : 'rgba(0,0,0,0.06)', color: horizon === h.value ? '#C6A85A' : 'inherit', borderRadius: '20px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', opacity: horizon === h.value ? 1 : 0.5, transition: 'all 0.15s' }}>
                    {isFr ? h.detailFr : h.detail}
                  </div>
                </button>
              ))}
            </div>
            <StepFooter isFr={isFr} step={3} total={TOTAL_STEPS} onBack={goBack} onNext={horizon ? goNext : undefined} onSkip={goNext} canNext={!!horizon} />
          </div>
        )}

        {/* ── Step 4: Categories ──────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <StepHeader isFr={isFr} step={4} total={TOTAL_STEPS}
              question={isFr ? 'Quelles catégories vous intéressent ?' : 'Which categories interest you?'}
              hint={isFr ? "Sélectionnez tout ce qui s'applique — nous pondérerons votre flux en conséquence." : "Select all that apply — we'll weight your deal flow accordingly."} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '40px' }}>
              {CATEGORIES.map(({ label, labelFr, icon }) => {
                const selected = categories.includes(label);
                return (
                  <button key={label} onClick={() => toggleCategory(label)} style={{ padding: '10px 18px', borderRadius: '24px', border: selected ? '2px solid #0A1628' : '1px solid #E4E2DC', background: selected ? '#0A1628' : '#FFFFFF', color: selected ? '#FFFFFF' : '#444', fontSize: '13px', fontWeight: selected ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onMouseEnter={e => { if (!selected) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#0A1628'; (e.currentTarget as HTMLButtonElement).style.background = '#F5F4F0'; } }}
                    onMouseLeave={e => { if (!selected) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E4E2DC'; (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; } }}>
                    <span>{icon}</span> {isFr ? labelFr : label}
                  </button>
                );
              })}
            </div>
            <StepFooter isFr={isFr} step={4} total={TOTAL_STEPS} onBack={goBack} onNext={goNext} onSkip={goNext} canNext={true} />
          </div>
        )}

        {/* ── Step 5: Primary motivation ──────────────────────────────────── */}
        {step === 5 && (
          <div>
            <StepHeader isFr={isFr} step={5} total={TOTAL_STEPS}
              question={isFr ? "Pourquoi collectionnez-vous de l'art ?" : 'Why do you collect art?'}
              hint={isFr ? 'Votre motivation détermine comment nous scorons et classons les opportunités.' : 'Your motivation determines how we score and rank opportunities for you.'} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
              {MOTIVATIONS.map(m => (
                <button key={m.value} style={tile(motivation === m.value)}
                  onClick={() => { setMotivation(m.value); setTimeout(goNext, 260); }}
                  onMouseEnter={e => tileHover(motivation === m.value, e)}
                  onMouseLeave={e => tileLeave(motivation === m.value, e)}>
                  <div style={{ fontSize: '26px', marginBottom: '10px', lineHeight: 1 }}>{m.icon}</div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '14px', fontWeight: 700, marginBottom: '5px', color: 'inherit' }}>{isFr ? m.labelFr : m.label}</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, lineHeight: 1.4 }}>{isFr ? m.subFr : m.sub}</div>
                </button>
              ))}
            </div>
            <StepFooter isFr={isFr} step={5} total={TOTAL_STEPS} onBack={goBack} onNext={motivation ? goNext : undefined} onSkip={goNext} canNext={!!motivation} />
          </div>
        )}

        {/* ── Step 6: Main challenge ──────────────────────────────────────── */}
        {step === 6 && (
          <div>
            <StepHeader isFr={isFr} step={6} total={TOTAL_STEPS}
              question={isFr ? "Quel est votre plus grand défi aujourd'hui ?" : "What's your biggest challenge today?"}
              hint={isFr ? 'Nautilus est construit autour de ce problème. Assurons-nous de le résoudre.' : "Nautilus is built around this exact problem. Let's make sure we solve it."} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px' }}>
              {CHALLENGES.map(c => (
                <button key={c.value} style={tile(challenge === c.value)}
                  onClick={() => { setChallenge(c.value); setTimeout(goNext, 260); }}
                  onMouseEnter={e => tileHover(challenge === c.value, e)}
                  onMouseLeave={e => tileLeave(challenge === c.value, e)}>
                  <div style={{ fontSize: '26px', marginBottom: '10px', lineHeight: 1 }}>{c.icon}</div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '14px', fontWeight: 700, marginBottom: '5px', color: 'inherit' }}>{isFr ? c.labelFr : c.label}</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, lineHeight: 1.4 }}>{isFr ? c.subFr : c.sub}</div>
                </button>
              ))}
            </div>
            <StepFooter isFr={isFr} step={6} total={TOTAL_STEPS} onBack={goBack} onNext={challenge ? goNext : undefined} onSkip={goNext} canNext={!!challenge} />
          </div>
        )}

        {/* ── Step 7: Personalized lots preview (post-profile, no progress) ── */}
        {step === 7 && (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C6A85A', marginBottom: '12px', fontFamily: 'var(--font-mono, monospace)' }}>
                {isFr ? 'BASÉ SUR VOTRE PROFIL' : 'BASED ON YOUR PROFILE'}
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '26px', fontWeight: 600, color: '#0A1628', margin: '0 0 8px', lineHeight: 1.3 }}>
                {isFr ? 'Un aperçu de votre flux de deals.' : "Here's a taste of your deal flow."}
              </h2>
              <p style={{ fontSize: '13px', color: '#888', margin: 0, lineHeight: 1.6 }}>
                {isFr ? 'Lots filtrés selon votre profil. Nautilus calcule le prix maximum à ne pas dépasser.' : 'Lots filtered to your profile. Nautilus shows the maximum price you should pay.'}
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
                    {(() => {
                      const avoidApprox = lot.estimate_low ? Math.round(lot.estimate_low * 0.85) : null;
                      if (!avoidApprox) return null;
                      const fmt = (n: number) => n >= 1000 ? `€${Math.round(n / 1000)}K` : `€${n}`;
                      return (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F0EEE8' }}>
                          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', fontWeight: 700, color: '#C6A85A' }}>
                            {fmt(avoidApprox)}
                          </div>
                          <div style={{ fontSize: '9px', color: '#bbb', marginTop: '1px', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em' }}>
                            {isFr ? 'NE PAS DÉPASSER' : 'DO NOT EXCEED'}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: '13px', fontFamily: 'var(--font-mono, monospace)' }}>
                  {isFr ? 'Chargement de vos lots personnalisés…' : 'Loading your personalized lots…'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={goBack} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#888', cursor: 'pointer', padding: 0 }}>
                {isFr ? '← Retour' : '← Back'}
              </button>
              <button onClick={goNext} style={{ padding: '13px 32px', background: '#2563EB', color: '#FFFFFF', border: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '8px' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
                onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}>
                {isFr ? 'Continuer →' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 8: Meet Larry ──────────────────────────────────────────── */}
        {step === 8 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 24px', filter: 'drop-shadow(0 8px 32px rgba(10,22,40,0.3))' }}>
              <LarryFace size={100} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '28px', fontWeight: 600, color: '#0A1628', margin: '0 0 8px', lineHeight: 1.2 }}>
              {isFr ? 'Rencontrez Larry.' : 'Meet Larry.'}
            </h2>
            <div style={{ width: '40px', height: '2px', background: '#C6A85A', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: '0 0 28px', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
              {isFr
                ? "Larry est votre analyste privé du marché de l'art. Il connaît chaque lot, chaque trajectoire d'artiste, chaque signal de marché — et il travaille exclusivement pour vous."
                : "Larry is your private art market analyst. He knows every lot, every artist trajectory, every market signal — and he works exclusively for you."}
            </p>
            <div style={{ background: '#F5F4F0', border: '1px solid #E4E2DC', borderRadius: '12px', padding: '20px 24px', marginBottom: '36px', textAlign: 'left', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0 }}>
                  <LarryFace size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#333', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '8px' }}>
                    {isFr
                      ? "\"J'ai passé des années à analyser les résultats d'enchères chez Christie's, Sotheby's, Drouot et 27 autres marchés. Dites-moi ce que vous collectionnez — je trouverai ce que les autres ratent.\""
                      : "\"I've spent years analyzing auction results across Christie's, Sotheby's, Drouot, and 27 other markets. Tell me what you collect — I'll find what others miss.\""}
                  </div>
                  <div style={{ fontSize: '10px', color: '#bbb', fontFamily: 'var(--font-mono, monospace)' }}>Larry · Nautilus AI Advisor</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '380px', margin: '0 auto' }}>
              <button onClick={goBack} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#888', cursor: 'pointer', padding: 0 }}>
                {isFr ? '← Retour' : '← Back'}
              </button>
              <button onClick={goNext} style={{ padding: '13px 32px', background: '#2563EB', color: '#FFFFFF', border: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '8px' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
                onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}>
                {isFr ? 'Continuer →' : 'Continue →'}
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
            <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '30px', fontWeight: 600, color: '#0A1628', margin: '0 0 12px', lineHeight: 1.2 }}>
              {isFr ? 'Votre profil est prêt.' : 'Your profile is ready.'}
            </h1>
            <div style={{ width: '40px', height: '2px', background: '#C6A85A', margin: '0 auto 32px' }} />

            {/* Summary grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: '#E4E2DC', border: '1px solid #E4E2DC', borderRadius: '10px', overflow: 'hidden', marginBottom: '40px' }}>
              {[
                { label: isFr ? 'Profil' : 'Profile',        value: PROFILES.find(p => p.value === collectorType)?.[isFr ? 'labelFr' : 'label'] ?? '—' },
                { label: isFr ? 'Budget' : 'Budget',         value: BUDGETS.find(b => b.key === budget)?.label ?? '—' },
                { label: isFr ? 'Horizon' : 'Horizon',       value: HORIZONS.find(h => h.value === horizon)?.[isFr ? 'labelFr' : 'label'] ?? '—' },
                { label: isFr ? 'Focus' : 'Focus',           value: categories.length > 0 ? `${categories.length} ${isFr ? 'catégories' : 'categories'}` : (isFr ? 'Tout' : 'All') },
                { label: isFr ? 'Motivation' : 'Motivation', value: MOTIVATIONS.find(m => m.value === motivation)?.[isFr ? 'labelFr' : 'label'] ?? '—' },
                { label: isFr ? 'Défi' : 'Challenge',        value: CHALLENGES.find(c => c.value === challenge)?.[isFr ? 'labelFr' : 'label'] ?? '—' },
              ].map(item => (
                <div key={item.label} style={{ background: '#FFFFFF', padding: '16px 14px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C6A85A', marginBottom: '5px', fontFamily: 'var(--font-mono, monospace)' }}>{item.label}</div>
                  <div style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '12px', fontWeight: 600, color: '#0A1628', lineHeight: 1.3 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <button onClick={handleComplete} disabled={saving} style={{ padding: '15px 48px', background: '#2563EB', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, borderRadius: '8px', marginBottom: '16px' }}
              onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#1D4ED8'; }}
              onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#2563EB'; }}>
              {saving ? (isFr ? 'Enregistrement…' : 'Saving…') : (isFr ? 'Voir mes opportunités →' : 'See my opportunities →')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepHeader({ isFr, step, total, question, hint }: { isFr: boolean; step: number; total: number; question: string; hint?: string }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C6A85A', marginBottom: '12px', fontFamily: 'var(--font-mono, monospace)' }}>
        {isFr ? `ÉTAPE ${step} SUR ${total}` : `STEP ${step} OF ${total}`}
      </div>
      <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '24px', fontWeight: 600, color: '#0A1628', margin: '0 0 8px', lineHeight: 1.3 }}>
        {question}
      </h2>
      {hint && <p style={{ fontSize: '13px', color: '#999', margin: 0, lineHeight: 1.5 }}>{hint}</p>}
    </div>
  );
}

interface StepFooterProps {
  isFr: boolean;
  step: number;
  total: number;
  onBack: (() => void) | null;
  onNext?: () => void;
  onSkip: () => void;
  canNext: boolean;
}

function StepFooter({ isFr, onBack, onNext, onSkip, canNext }: StepFooterProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#888', cursor: 'pointer', padding: 0 }}>
            {isFr ? '← Retour' : '← Back'}
          </button>
        )}
        <button onClick={onSkip} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#ccc', cursor: 'pointer', padding: 0 }}>
          {isFr ? 'Passer' : 'Skip'}
        </button>
      </div>
      {canNext && onNext && (
        <button onClick={onNext} style={{ padding: '12px 28px', background: '#2563EB', color: '#FFFFFF', border: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '8px' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
          onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}>
          {isFr ? 'Continuer →' : 'Continue →'}
        </button>
      )}
    </div>
  );
}
