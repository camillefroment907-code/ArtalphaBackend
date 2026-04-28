import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Logo } from '../components/Logo';
import { getUser, setUser } from '../../lib/auth';

const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus]   = useState<'loading' | 'success' | 'error'>('loading');
  const [resent, setResent]   = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    fetch(`${API}/api/auth/verify-email?token=${encodeURIComponent(token)}`, { redirect: 'manual' })
      .then(res => {
        if (res.status === 200 || res.status === 302 || res.type === 'opaqueredirect') {
          const user = JSON.parse(localStorage.getItem('artalpha_auth') || '{}');
          user.is_verified = true;
          localStorage.setItem('artalpha_auth', JSON.stringify(user));
          setStatus('success');
          setTimeout(() => navigate('/app/explore'), 2000);
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [token]);

  async function handleResend() {
    const user = getUser();
    if (!user?.token) { navigate('/app/login'); return; }
    setResending(true);
    setResendError('');
    try {
      const res = await fetch(`${API}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResendError(data.detail || 'Failed to send. Please try again.');
      } else {
        setResent(true);
      }
    } catch {
      setResendError('Unable to connect. Check your internet connection.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#FAFAF8' }}>

      {/* ── Left panel ── */}
      <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px 40px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          <Link to="/" style={{ display: 'inline-block', marginBottom: 44 }}>
            <Logo variant="wordmark" size={28} />
          </Link>

          {status === 'loading' && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1A2A44" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 10px' }}>
                Verifying your email…
              </h1>
              <p style={{ fontSize: 14, color: '#6B6560', lineHeight: 1.65, margin: 0 }}>
                Just a moment.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 10px' }}>
                Email verified!
              </h1>
              <p style={{ fontSize: 14, color: '#6B6560', lineHeight: 1.65, margin: '0 0 24px' }}>
                Your account is now active. Redirecting you to the platform…
              </p>
              <div style={{ padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>✓</span>
                Taking you to your deal feed now.
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 10px' }}>
                Link expired or invalid
              </h1>
              <p style={{ fontSize: 14, color: '#6B6560', lineHeight: 1.65, margin: '0 0 28px' }}>
                This verification link has expired or has already been used. Request a new one below.
              </p>

              {resent ? (
                <div style={{ padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, color: '#166534', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>✓</span>
                  Email sent — check your inbox and spam folder.
                </div>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  style={{ width: '100%', padding: '13px', background: resending ? '#93a3b4' : '#1A2A44', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: resending ? 'not-allowed' : 'pointer', letterSpacing: '0.02em', marginBottom: 12, transition: 'background 0.2s' }}
                >
                  {resending ? 'Sending…' : 'Resend verification email'}
                </button>
              )}

              {resendError && (
                <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{resendError}</p>
              )}

              <Link to="/app/login" style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '13px', background: 'transparent', color: '#1A2A44', border: '1px solid rgba(26,42,68,0.2)', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.02em', textAlign: 'center', textDecoration: 'none' }}>
                Back to login
              </Link>
            </>
          )}

        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: '0 0 44%', background: '#0A1628', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 56px' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <Logo variant="symbol" color="white" size={40} />

          <h2 style={{ color: '#FFFFFF', fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', lineHeight: 1.3, margin: '28px 0 14px' }}>
            One click away<br />from the market.
          </h2>

          <p style={{ color: 'rgba(198,168,90,0.85)', fontSize: 13, lineHeight: 1.7, margin: '0 0 40px' }}>
            Verifying your email activates your account and unlocks the full Nautilus intelligence platform.
          </p>

          {[
            { n: '1', label: 'Open the email from Nautilus' },
            { n: '2', label: 'Click "Verify my email"' },
            { n: '3', label: 'Access your deal feed instantly' },
          ].map(({ n, label }) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(198,168,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)' }}>{n}</span>
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{label}</span>
            </div>
          ))}

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
