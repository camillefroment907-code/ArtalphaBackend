import { useState } from 'react';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';

const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit() {
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Something went wrong. Please try again.');
      } else {
        setSent(true);
      }
    } catch {
      setError('Unable to connect. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#FAFAF8' }}>
      {/* Left panel */}
      <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px 40px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <Link to="/" style={{ display: 'inline-block', marginBottom: 40 }}>
            <Logo variant="wordmark" size={28} />
          </Link>

          {sent ? (
            <>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 12px' }}>
                Check your inbox
              </h1>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, margin: '0 0 32px' }}>
                If <strong>{email}</strong> is registered, we've sent a password reset link. It expires in 1 hour.
              </p>
              <p style={{ fontSize: 13, color: '#999' }}>
                Didn't receive it?{' '}
                <button
                  onClick={() => setSent(false)}
                  style={{ background: 'none', border: 'none', color: '#1A2A44', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}
                >
                  Try again
                </button>
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 8px' }}>
                Forgot your password?
              </h1>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 32px', lineHeight: 1.5 }}>
                Enter your email and we'll send you a reset link.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1A2A44', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                  placeholder="you@example.com"
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1CCC0', borderRadius: 6, fontSize: 14, background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 14px' }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: '100%', padding: '13px', background: loading ? '#93a3b4' : '#1A2A44', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.03em' }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </>
          )}

          <p style={{ fontSize: 13, color: '#999', marginTop: 32 }}>
            <Link to="/app/login" style={{ color: '#1A2A44', textDecoration: 'none', fontWeight: 600 }}>
              ← Back to login
            </Link>
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: '0 0 42%', background: '#0A1628', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 56px' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
        <Logo variant="symbol" color="white" size={40} />
        <h2 style={{ color: '#fff', fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', lineHeight: 1.3, margin: '28px 0 12px' }}>
          Your account,<br />secured.
        </h2>
        <p style={{ color: 'rgba(198,168,90,0.8)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Reset links expire after 1 hour and can only be used once.
        </p>
      </div>
    </div>
  );
}
