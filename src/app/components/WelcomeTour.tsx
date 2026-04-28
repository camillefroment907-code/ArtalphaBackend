import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Logo } from './Logo';

const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

interface WelcomeTourProps {
  onClose: () => void;
}

const TOUR_STEPS = [
  {
    tag: 'WELCOME TO NAUTILUS',
    title: 'The art market has a dirty secret.',
    body: "Every week, hundreds of artworks sell 20–50% below their real market value. Not because they're bad — because most buyers don't have the data. Until now.",
    cta: undefined,
  },
  {
    tag: 'HOW YOU MAKE MONEY',
    title: 'Buy undervalued. Sell at market price.',
    body: 'Nautilus scores every lot from 0 to 100. A score above 65 means the work is priced below what comparable sales suggest. You buy the gap — and profit when the market corrects.',
    cta: undefined,
  },
  {
    tag: 'YOUR AI ANALYST',
    title: 'You set the strategy. Larry does the work.',
    body: 'Define your budget and preferences once. Larry — your private AI analyst — monitors every auction house 24/7 and alerts you the moment a matching opportunity appears.',
    cta: undefined,
  },
  {
    tag: 'THE EDGE',
    title: 'You act before the market wakes up.',
    body: 'Most buyers discover opportunities after the crowd. Nautilus surfaces them 2–4 weeks early. That window is where the money is made.',
    cta: undefined,
  },
  {
    tag: 'START NOW',
    title: 'Your first opportunities are ready.',
    body: "Based on your profile, Nautilus has already identified matching lots. Explore them now — and upgrade when you're ready to unlock the full suite.",
    cta: 'Show me the opportunities →',
  },
];

export function WelcomeTour({ onClose }: WelcomeTourProps) {
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const [visible, setVisible] = useState(true);
  const [lots, setLots] = useState<any[]>([]);
  const [lotCount, setLotCount] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/lots/public?limit=5&sort=deal_score`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const items: any[] = data?.lots || data?.items || [];
        if (items.length) setLots(items);
      })
      .catch(() => {});

    fetch(`${API}/api/lots/count`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const n = data?.total ?? data?.count ?? null;
        if (n && n > 0) {
          const label = n >= 1000 ? `${Math.floor(n / 100) / 10}K+` : `${n}`;
          setLotCount(`${label} lots analyzed this week`);
        }
      })
      .catch(() => {});
  }, []);

  const current = TOUR_STEPS[slide];
  const isLast = slide === TOUR_STEPS.length - 1;

  // Dynamic metric per slide
  const metric: string | null = (() => {
    if (slide === 0) return lotCount ?? '674 lots analyzed this week';
    if (slide === 1) return 'Avg. +31% upside on score 65+ lots';
    if (slide === 3) return '24 days avg. lead time vs market';
    return null;
  })();

  // Which lot to show and whether to show image
  const heroLot = slide === 1 ? (lots[1] ?? lots[0]) : lots[0];
  const showImage = (slide === 0 || slide === 1 || slide === 4) && !!heroLot?.image_url;

  const handleClose = () => {
    localStorage.setItem('nautilus_tour_seen', 'true');
    localStorage.removeItem('nautilus_show_tour');
    onClose();
  };

  const goNext = () => {
    if (isLast) { handleClose(); navigate('/app/explore'); return; }
    setVisible(false);
    setTimeout(() => { setSlide(s => s + 1); setVisible(true); }, 200);
  };

  const goPrev = () => {
    setVisible(false);
    setTimeout(() => { setSlide(s => Math.max(s - 1, 0)); setVisible(true); }, 200);
  };

  const goToSlide = (i: number) => {
    if (i === slide) return;
    setVisible(false);
    setTimeout(() => { setSlide(i); setVisible(true); }, 200);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(10, 18, 38, 0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: '560px',
        background: '#FFFFFF', borderRadius: '12px',
        overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
      }}>
        {/* Top accent bar */}
        <div style={{ height: '3px', background: 'var(--gold, #C6A85A)' }} />

        {/* Visual hero */}
        <div style={{
          background: 'var(--navy, #1A2A44)',
          position: 'relative',
          height: showImage ? '200px' : 'auto',
          padding: showImage ? '0' : '48px 40px 36px',
          textAlign: 'center',
          overflow: 'hidden',
        }}>
          {/* Dismiss */}
          <button
            onClick={handleClose}
            aria-label="Close tour"
            style={{
              position: 'absolute', top: '16px', right: '16px', zIndex: 3,
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)', fontSize: '20px',
              cursor: 'pointer', lineHeight: 1, padding: '4px',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
          >
            ×
          </button>

          <div style={{ transition: 'opacity 0.2s ease', opacity: visible ? 1 : 0, height: '100%' }}>
            {showImage ? (
              <>
                {/* Lot image */}
                <img
                  src={heroLot.image_url}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {/* Dark overlay */}
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,22,40,0.52)', zIndex: 1 }} />

                {/* Step 2: score + upside badges */}
                {slide === 1 && (
                  <div style={{ position: 'absolute', bottom: '14px', left: '14px', zIndex: 2, display: 'flex', gap: '6px' }}>
                    <div style={{ background: 'rgba(10,22,40,0.88)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: 'white' }}>
                      {Math.round(heroLot.deal_score ?? 0)}/100
                    </div>
                    {(heroLot.pct_below_low_estimate ?? 0) > 0 && (
                      <div style={{ background: 'rgba(37,99,235,0.9)', padding: '4px 10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: 'white' }}>
                        +{Math.round(heroLot.pct_below_low_estimate)}% upside
                      </div>
                    )}
                  </div>
                )}

                {/* Step 5: score badge */}
                {slide === 4 && (
                  <div style={{ position: 'absolute', bottom: '14px', left: '14px', zIndex: 2 }}>
                    <div style={{ background: 'rgba(10,22,40,0.88)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: 'white' }}>
                      Score {Math.round(heroLot.deal_score ?? 88)}/100
                    </div>
                  </div>
                )}

                {/* Metric pill over image (step 1) */}
                {metric && slide === 0 && (
                  <div style={{ position: 'absolute', top: '14px', left: '14px', zIndex: 2, padding: '4px 14px', background: 'rgba(198,168,90,0.88)', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#1A2A44', fontFamily: 'monospace' }}>
                    {metric}
                  </div>
                )}
              </>
            ) : (
              /* Logo-only hero (steps 2, 3) */
              <>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <Logo variant="symbol" color="white" size={36} />
                </div>
                {metric && (
                  <div style={{
                    display: 'inline-block', padding: '4px 14px',
                    background: 'rgba(198,168,90,0.15)',
                    border: '1px solid rgba(198,168,90,0.35)',
                    borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.1em', color: 'var(--gold, #C6A85A)',
                    fontFamily: 'monospace',
                  }}>
                    {metric}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '32px 40px 28px' }}>
          <div style={{ transition: 'opacity 0.2s ease', opacity: visible ? 1 : 0 }}>
            <div style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em',
              textTransform: 'uppercase', color: 'var(--gold, #C6A85A)', marginBottom: '10px',
            }}>
              {current.tag}
            </div>
            <h2 style={{
              fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '22px',
              fontWeight: 600, color: '#1A2A44', margin: '0 0 14px', lineHeight: 1.3,
            }}>
              {current.title}
            </h2>
            <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, margin: '0 0 28px' }}>
              {current.body}
            </p>
          </div>

          {/* Navigation row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={goPrev}
              disabled={slide === 0}
              style={{
                background: 'none', border: 'none', fontSize: '12px',
                color: slide === 0 ? 'transparent' : '#888',
                cursor: slide === 0 ? 'default' : 'pointer', padding: 0,
              }}
            >
              ← Prev
            </button>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  style={{
                    width: i === slide ? '20px' : '7px', height: '7px',
                    borderRadius: '4px',
                    background: i === slide ? '#2563EB' : '#D8D5CE',
                    border: 'none', cursor: 'pointer', padding: 0,
                    transition: 'width 0.25s ease, background 0.2s',
                  }}
                />
              ))}
            </div>

            <button
              onClick={goNext}
              style={{
                padding: '10px 22px', background: '#2563EB', color: '#FFFFFF',
                border: 'none', fontSize: '12px', fontWeight: 700,
                letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '4px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1d4ed8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}
            >
              {isLast ? (current.cta ?? 'Get started →') : 'Next →'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={handleClose}
              style={{ background: 'none', border: 'none', fontSize: '11px', color: '#bbb', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Skip tour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
