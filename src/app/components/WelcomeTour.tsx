import { useState } from 'react';

interface WelcomeTourProps {
  onClose: () => void;
}

const TOUR_STEPS = [
  {
    tag: 'AI Deal Scoring',
    title: 'Every lot, scored in real time',
    body: 'Our algorithm tracks 50+ auction houses and scores each lot against the artist\'s market — flagging below-market entries before anyone else sees them.',
    metric: 'Score 0–100',
    cta: 'Explore deals',
    visual: '◈',
  },
  {
    tag: 'Market Intelligence',
    title: 'Know what every artist is really worth',
    body: 'Nautilus aggregates auction results, primary sales, and gallery data to build a live price map for thousands of artists — updated after every sale.',
    metric: '15 000+ artists',
    cta: 'Browse artists',
    visual: '◎',
  },
  {
    tag: 'Auction Alerts',
    title: 'Never miss a deal again',
    body: 'Set your criteria once — budget, category, score threshold. Get alerts 48 hours before auction close, with enough time to place a bid.',
    metric: '48h advance',
    cta: 'Set my alerts',
    visual: '◇',
  },
  {
    tag: 'Portfolio Tracking',
    title: 'Track your collection\'s performance',
    body: 'Add past acquisitions and see your portfolio\'s estimated value, gain/loss, and market position — updated in real time as comparable works sell.',
    metric: 'Live P&L',
    cta: 'My portfolio',
    visual: '◆',
  },
  {
    tag: 'Larry, your AI analyst',
    title: 'Ask anything about the art market',
    body: 'Larry answers market questions, explains deal scores, and surfaces overlooked opportunities — in plain language, on demand.',
    metric: 'GPT-4o',
    cta: 'Start exploring',
    visual: '▲',
  },
];

export function WelcomeTour({ onClose }: WelcomeTourProps) {
  const [slide, setSlide] = useState(0);

  const current = TOUR_STEPS[slide];
  const isLast = slide === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      setSlide(s => s + 1);
    }
  };

  const handlePrev = () => setSlide(s => Math.max(s - 1, 0));

  const handleClose = () => {
    localStorage.setItem('nautilus_tour_seen', '1');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(10, 18, 38, 0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#FFFFFF',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: '3px', background: 'var(--gold, #C6A85A)' }} />

        {/* Visual hero */}
        <div style={{
          background: 'var(--navy, #1A2A44)',
          padding: '48px 40px 36px',
          textAlign: 'center',
          position: 'relative',
        }}>
          {/* Dismiss */}
          <button
            onClick={handleClose}
            aria-label="Close tour"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            ×
          </button>

          <div style={{
            fontSize: '52px',
            color: 'var(--gold, #C6A85A)',
            fontFamily: 'var(--font-serif, Georgia, serif)',
            marginBottom: '16px',
            opacity: 0.9,
          }}>
            {current.visual}
          </div>

          {/* Metric pill */}
          <div style={{
            display: 'inline-block',
            padding: '4px 14px',
            background: 'rgba(198,168,90,0.15)',
            border: '1px solid rgba(198,168,90,0.35)',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--gold, #C6A85A)',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {current.metric}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '32px 40px 28px' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--gold, #C6A85A)',
            marginBottom: '10px',
          }}>
            {current.tag}
          </div>
          <h2 style={{
            fontFamily: 'var(--font-serif, Georgia, serif)',
            fontSize: '22px',
            fontWeight: 600,
            color: '#1A2A44',
            margin: '0 0 14px',
            lineHeight: 1.3,
          }}>
            {current.title}
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#555',
            lineHeight: 1.7,
            margin: '0 0 28px',
          }}>
            {current.body}
          </p>

          {/* Navigation row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Prev */}
            <button
              onClick={handlePrev}
              disabled={slide === 0}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                color: slide === 0 ? 'transparent' : '#888',
                cursor: slide === 0 ? 'default' : 'pointer',
                padding: 0,
              }}
            >
              ← Prev
            </button>

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  style={{
                    width: i === slide ? '20px' : '7px',
                    height: '7px',
                    borderRadius: '4px',
                    background: i === slide ? 'var(--navy, #1A2A44)' : '#D8D5CE',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'width 0.25s ease, background 0.2s',
                  }}
                />
              ))}
            </div>

            {/* Next / CTA */}
            <button
              onClick={handleNext}
              style={{
                padding: '10px 22px',
                background: '#1A2A44',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0f1e33')}
              onMouseLeave={e => (e.currentTarget.style.background = '#1A2A44')}
            >
              {isLast ? current.cta + ' →' : 'Next →'}
            </button>
          </div>

          {/* Skip link */}
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
