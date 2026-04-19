import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Logo } from '../components/Logo';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function FeedbackPage() {
  const [params] = useSearchParams();
  const type = params.get('type') || 'general';
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSuggestions = type === 'suggestions';
  const isHelp = type === 'help';

  const heading = isSuggestions
    ? 'What features would make Nautilus better for you?'
    : isHelp
    ? "We're sorry Nautilus didn't meet your expectations. What went wrong?"
    : 'Share your feedback';

  const placeholder = isSuggestions
    ? 'e.g. "I wish I could filter by artist nationality..." or "The mobile experience could be improved by..."'
    : 'Tell us what happened. We read every response.';

  const handleSubmit = async () => {
    if (!message.trim() || loading) return;
    setLoading(true);
    try {
      await fetch(`${BACKEND}/api/feedback/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true); // show success even on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <a href="/" style={{ marginBottom: '40px', textDecoration: 'none' }}>
        <Logo variant="full" color="navy" size={32} />
      </a>

      <div style={{ width: '100%', maxWidth: '520px', background: 'white', borderRadius: '16px', padding: '48px 40px', boxShadow: '0 8px 32px rgba(10,22,40,0.08)' }}>
        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(198,168,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '22px' }}>
              ✓
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: '#1A2A44', margin: '0 0 12px' }}>
              Thank you.
            </h2>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.7, margin: '0 0 28px' }}>
              We read every message. Your feedback helps us build a better Nautilus.
            </p>
            <a href="/" style={{ color: '#C6A85A', fontSize: '13px', textDecoration: 'none' }}>← Back to Nautilus</a>
          </div>
        ) : (
          <>
            <div style={{ width: '28px', height: '2px', background: '#C6A85A', marginBottom: '24px' }} />
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: '#1A2A44', margin: '0 0 24px', lineHeight: 1.4 }}>
              {heading}
            </h2>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={placeholder}
              rows={6}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '14px 16px', borderRadius: '8px',
                border: '1px solid #DDD', fontSize: '14px',
                fontFamily: 'inherit', lineHeight: 1.6,
                color: '#333', resize: 'vertical',
                outline: 'none', marginBottom: '20px',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#1A2A44')}
              onBlur={e => (e.currentTarget.style.borderColor = '#DDD')}
            />
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || loading}
              style={{
                width: '100%', padding: '14px',
                background: message.trim() && !loading ? '#1A2A44' : '#ccc',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', cursor: message.trim() && !loading ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Sending…' : 'Submit'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <a href="/" style={{ fontSize: '12px', color: '#aaa', textDecoration: 'none' }}>Skip</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
