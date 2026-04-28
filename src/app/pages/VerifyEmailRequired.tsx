import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { getUser, logout } from '../../lib/auth';

const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function VerifyEmailRequired() {
  const navigate  = useNavigate();
  const user      = getUser();
  const email     = user?.email ?? '';

  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleResend() {
    if (!user?.token) { navigate('/app/login'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Failed to send. Please try again.');
      } else {
        setSent(true);
      }
    } catch {
      setError('Unable to connect. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/app/login');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#FAFAF8' }}>

      {/* ── Left panel ─────────────────────────────────────── */}
      <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px 40px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'inline-block', marginBottom: 44 }}>
            <Logo variant="wordmark" size={28} />
          </Link>

          {/* Envelope icon */}
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1A2A44" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>

          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 10px', lineHeight: 1.25 }}>
            Verify your email<br />to continue
          </h1>

          <p style={{ fontSize: 14, color: '#6B6560', lineHeight: 1.65, margin: '0 0 28px' }}>
            We sent a verification link to{' '}
            <span style={{ fontWeight: 600, color: '#1A2A44' }}>{email}</span>.
            Click it to activate your account and access the platform.
          </p>

          {/* Sent confirmation */}
          {sent && (
            <div style={{ padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, color: '#166534', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>✓</span>
              Email sent — check your inbox and spam folder.
            </div>
          )}

          {error && (
            <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 16px' }}>{error}</p>
          )}

          {/* Resend CTA */}
          <button
            onClick={handleResend}
            disabled={loading || sent}
            style={{
              width: '100%', padding: '13px',
              background: sent ? '#E8E4DC' : loading ? '#93a3b4' : '#2563EB',
              color: sent ? '#999' : '#fff',
              border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
              cursor: loading || sent ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em', marginBottom: 12,
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Sending…' : sent ? 'Email sent ✓' : 'Resend verification email'}
          </button>

          {/* Back to login */}
          <button
            onClick={handleLogout}
            style={{ width: '100%', padding: '13px', background: 'transparent', color: '#1A2A44', border: '1px solid rgba(26,42,68,0.2)', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.02em' }}
          >
            Back to login
          </button>

          {/* Fine print */}
          <p style={{ fontSize: 12, color: '#B0A99E', marginTop: 28, lineHeight: 1.6 }}>
            Wrong email?{' '}
            <Link to="/app/signup" onClick={logout} style={{ color: '#1A2A44', fontWeight: 600, textDecoration: 'none' }}>
              Create a new account
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────── */}
      <div style={{ flex: '0 0 44%', background: '#0A1628', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 56px' }}>
        {/* Grid texture */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <Logo variant="symbol" color="white" size={40} />

          <h2 style={{ color: '#FFFFFF', fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', lineHeight: 1.3, margin: '28px 0 14px' }}>
            One step away<br />from the market.
          </h2>

          <p style={{ color: 'rgba(198,168,90,0.85)', fontSize: 13, lineHeight: 1.7, margin: '0 0 40px' }}>
            Verifying your email keeps your account secure and unlocks the full Nautilus intelligence platform.
          </p>

          {/* Steps */}
          {[
            { n: '1', label: 'Open the email from Nautilus' },
            { n: '2', label: 'Click "Verify my email"' },
            { n: '3', label: 'Access your deal feed' },
          ].map(({ n, label }) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(198,168,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)' }}>{n}</span>
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{label}</span>
            </div>
          ))}

          {/* Live dot */}
          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C6A85A', animation: 'pulseDot 2s infinite' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Live market scanning active
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
