import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Logo } from '../components/Logo';

const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function ResetPassword() {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const token                   = searchParams.get('token') || '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  async function handleSubmit() {
    if (!token) { setError('Invalid or missing reset token. Please request a new link.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || 'Something went wrong. Please request a new reset link.');
      } else {
        setDone(true);
        setTimeout(() => navigate('/app/login'), 3000);
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

          {!token ? (
            <>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 12px' }}>
                Invalid link
              </h1>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px' }}>
                This reset link is missing or malformed. Please request a new one.
              </p>
              <Link to="/forgot-password" style={{ display: 'inline-block', padding: '12px 24px', background: '#1A2A44', color: '#fff', borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                Request new link
              </Link>
            </>
          ) : done ? (
            <>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 12px' }}>
                Password updated
              </h1>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px', lineHeight: 1.6 }}>
                Your password has been changed. Redirecting you to login…
              </p>
              <Link to="/app/login" style={{ fontSize: 13, color: '#1A2A44', fontWeight: 600 }}>
                Go to login →
              </Link>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', color: '#1A2A44', margin: '0 0 8px' }}>
                Choose a new password
              </h1>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 32px' }}>
                Must be at least 8 characters.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1A2A44', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  New password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    style={{ width: '100%', padding: '12px 44px 12px 14px', border: '1px solid #D1CCC0', borderRadius: 6, fontSize: 14, background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                  />
                  <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 12 }}>
                    {showPwd ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1A2A44', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Confirm password
                </label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                  placeholder="Repeat password"
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
                {loading ? 'Updating…' : 'Set new password'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: '0 0 42%', background: '#0A1628', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 56px' }}>
        <Logo variant="symbol" color="white" size={40} />
        <h2 style={{ color: '#fff', fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 'normal', lineHeight: 1.3, margin: '28px 0 12px' }}>
          Your account,<br />secured.
        </h2>
        <p style={{ color: 'rgba(198,168,90,0.8)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Choose a strong password you don't use elsewhere.
        </p>
      </div>
    </div>
  );
}
