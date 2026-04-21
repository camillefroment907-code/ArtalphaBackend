/**
 * NPSSurvey — Premium slide-up NPS survey for Nautilus.
 * Bloomberg/Sotheby's-level interaction design.
 * Shows once per session, max once every 60 days.
 */
import { useState, useEffect, useRef } from 'react';
import { getUser, getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
const LS_LAST_SHOWN  = 'nautilus_nps_last_shown';
const LS_DISMISSED   = 'nautilus_nps_dismissed';
const COOLDOWN_DAYS  = 60;
const DISMISS_DAYS   = 7;
const TRIGGER_MS     = 3 * 60 * 1000; // 3 minutes

type NPSState = 'hidden' | 'visible' | 'score_selected' | 'submitted' | 'closing';

function getPlaceholder(score: number): string {
  if (score <= 4) return 'What went wrong? We read every message.';
  if (score <= 6) return 'What would make Nautilus a 9 or 10 for you?';
  if (score <= 8) return "What's one thing we could do better?";
  return 'What do you love most about Nautilus?';
}

function getHoverTint(score: number): string {
  if (score <= 4) return 'rgba(224,75,69,0.15)';
  if (score <= 6) return 'rgba(198,168,90,0.1)';
  return 'rgba(15,110,86,0.2)';
}

// Animated checkmark SVG
function AnimatedCheck() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{ display: 'block', margin: '0 auto 16px' }}>
      <circle
        cx="26" cy="26" r="23"
        stroke="#C6A85A" strokeWidth="2" fill="none"
        style={{ opacity: 0.3 }}
      />
      <circle
        cx="26" cy="26" r="23"
        stroke="#C6A85A" strokeWidth="2" fill="none"
        strokeDasharray="145" strokeDashoffset="145"
        style={{ animation: 'npsDrawCircle 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s forwards' }}
      />
      <polyline
        points="16,27 23,34 36,19"
        stroke="#C6A85A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        fill="none"
        strokeDasharray="30" strokeDashoffset="30"
        style={{ animation: 'npsDrawCheck 0.4s cubic-bezier(0.16,1,0.3,1) 0.5s forwards' }}
      />
    </svg>
  );
}

export function NPSSurvey() {
  const user = getUser();
  const [state, setState]           = useState<NPSState>('hidden');
  const [selectedScore, setScore]   = useState<number | null>(null);
  const [comment, setComment]       = useState('');
  const [hoveredScore, setHovered]  = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showInput, setShowInput]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstName = user?.name?.split(' ')[0] || 'there';

  // Eligibility check + trigger
  useEffect(() => {
    if (!user) return;

    const now = Date.now();
    const lastShown  = Number(localStorage.getItem(LS_LAST_SHOWN)  || 0);
    const dismissed  = Number(localStorage.getItem(LS_DISMISSED)   || 0);

    if (lastShown  && now - lastShown  < COOLDOWN_DAYS * 86400000) return;
    if (dismissed  && now - dismissed  < DISMISS_DAYS  * 86400000) return;

    timerRef.current = setTimeout(() => setState('visible'), TRIGGER_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Auto-close after submitted
  useEffect(() => {
    if (state === 'submitted') {
      closeRef.current = setTimeout(() => setState('closing'), 3000);
    }
    return () => { if (closeRef.current) clearTimeout(closeRef.current); };
  }, [state]);

  const handleScoreClick = (score: number) => {
    setScore(score);
    setState('score_selected');
    setTimeout(() => setShowInput(true), 20); // trigger CSS transition
  };

  const handleDismiss = () => {
    localStorage.setItem(LS_DISMISSED, String(Date.now()));
    setState('closing');
  };

  const handleSubmit = async () => {
    if (selectedScore === null || submitting) return;
    setSubmitting(true);
    try {
      const token = getToken();
      await fetch(`${BACKEND}/api/feedback/nps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ score: selectedScore, comment: comment.trim() || undefined }),
      });
    } catch {
      // Fire-and-forget — never block the thank-you state on network failure
    }
    localStorage.setItem(LS_LAST_SHOWN, String(Date.now()));
    localStorage.removeItem(LS_DISMISSED);
    setSubmitting(false);
    setState('submitted');
  };

  if (state === 'hidden' || !user) return null;

  const isClosing = state === 'closing';

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 24,
    left: 24,
    width: 'min(380px, calc(100vw - 48px))',
    background: '#1A2A44',
    border: '1px solid rgba(198,168,90,0.3)',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(198,168,90,0.1)',
    padding: 28,
    zIndex: 9998,
    animation: isClosing
      ? 'npsSlideDown 300ms ease-in forwards'
      : 'npsSlideUp 400ms cubic-bezier(0.16,1,0.3,1) forwards',
    boxSizing: 'border-box' as const,
  };

  // ── Thank-you state ──────────────────────────────────────────────────────
  if (state === 'submitted') {
    return (
      <>
        <style>{`@media(max-width:480px){.nps-container{left:16px!important;right:16px!important;width:auto!important;bottom:80px!important;}}`}</style>
        <div className="nps-container" style={containerStyle}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <AnimatedCheck />
            <div style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 20, fontWeight: 500, color: '#fff', marginBottom: 8,
            }}>
              Thank you, {firstName}.
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Your feedback shapes the future of Nautilus.
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Main survey state ────────────────────────────────────────────────────
  return (
    <>
      <style>{`@media(max-width:480px){.nps-container{left:16px!important;right:16px!important;width:auto!important;bottom:80px!important;}}`}</style>
      <div className="nps-container" style={containerStyle}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Nautilus shell icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C7.5 2 4 5 4 10C4 15 7.5 18 10 18C12.5 18 16 15 16 10" stroke="#C6A85A" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M10 5C8.5 5 6.5 7 6.5 10C6.5 13 8.5 15 10 15" stroke="#C6A85A" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M10 8C9.3 8 8.5 8.8 8.5 10" stroke="#C6A85A" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="10" cy="10" r="1.2" fill="#C6A85A"/>
          </svg>
          <span style={{
            fontFamily: "-apple-system, 'Inter', 'Helvetica Neue', Arial, sans-serif",
            fontSize: 13, color: '#C6A85A', fontWeight: 700, letterSpacing: '-0.02em',
          }}>
            Nautilus
          </span>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            width: 24, height: 24, border: 'none', background: 'none',
            cursor: 'pointer', color: 'rgba(198,168,90,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, transition: 'color 200ms ease', borderRadius: 4,
            fontSize: 16, lineHeight: 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#C6A85A')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(198,168,90,0.5)')}
          aria-label="Dismiss survey"
        >
          ✕
        </button>
      </div>

      {/* Question */}
      <div style={{
        marginTop: 20,
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 18, fontWeight: 500, color: '#fff', lineHeight: 1.4,
      }}>
        How likely are you to recommend Nautilus to a fellow collector?
      </div>

      {/* Scale labels */}
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Not at all</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Absolutely</span>
      </div>

      {/* Score buttons */}
      <div style={{ marginTop: 16, display: 'flex', gap: 4 }}>
        {Array.from({ length: 11 }, (_, i) => {
          const isSelected = selectedScore === i;
          const isHovered  = hoveredScore === i && !isSelected;
          return (
            <button
              key={i}
              onClick={() => handleScoreClick(i)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                flex: 1,
                height: 36,
                border: `1px solid ${isSelected ? '#C6A85A' : isHovered ? 'rgba(198,168,90,0.5)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8,
                background: isSelected
                  ? '#C6A85A'
                  : isHovered
                    ? getHoverTint(i)
                    : 'rgba(255,255,255,0.06)',
                color: isSelected ? '#1A2A44' : isHovered ? '#C6A85A' : 'rgba(255,255,255,0.6)',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 150ms ease',
                transform: isSelected ? 'translateY(-3px)' : isHovered ? 'translateY(-2px)' : 'none',
                boxShadow: isSelected ? '0 4px 12px rgba(198,168,90,0.4)' : 'none',
                padding: 0,
              }}
            >
              {i}
            </button>
          );
        })}
      </div>

      {/* Follow-up textarea */}
      <div style={{
        overflow: 'hidden',
        maxHeight: showInput && selectedScore !== null ? 200 : 0,
        transition: 'max-height 300ms ease',
      }}>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={selectedScore !== null ? getPlaceholder(selectedScore) : ''}
          rows={3}
          style={{
            marginTop: 16,
            width: '100%',
            height: 72,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            color: '#fff',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            padding: '10px 12px',
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 200ms ease',
            display: 'block',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(198,168,90,0.5)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
        />

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            marginTop: 12,
            width: '100%',
            height: 42,
            background: submitting ? 'rgba(198,168,90,0.5)' : '#C6A85A',
            border: 'none',
            borderRadius: 10,
            color: '#1A2A44',
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.05em',
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'all 150ms ease',
            display: 'block',
          }}
          onMouseEnter={e => { if (!submitting) { e.currentTarget.style.background = '#d4b870'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
          onMouseLeave={e => { e.currentTarget.style.background = submitting ? 'rgba(198,168,90,0.5)' : '#C6A85A'; e.currentTarget.style.transform = 'none'; }}
          onMouseDown={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {submitting ? 'Sending…' : 'Send feedback'}
        </button>
      </div>

    </div>
    </>
  );
}
