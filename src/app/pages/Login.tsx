import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { loginApi } from '../../lib/api';
import { setUser } from '../../lib/auth';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

const SIGNAL_CARDS = [
  { badge: '◆ STRONG BUY', badgeColor: '#C6A85A', artist: 'Pierre Soulages', detail: '−28% vs estimate', detailColor: '#2563EB' },
  { badge: '⚡ NEW SIGNAL', badgeColor: 'rgba(255,255,255,0.7)', artist: 'Zao Wou-Ki', detail: 'Deal score: 87/100', detailColor: 'rgba(255,255,255,0.5)' },
  { badge: '◎ LIVE AUCTION', badgeColor: 'rgba(255,255,255,0.7)', artist: 'Drouot · Closes in 14h', detail: '+€32K upside', detailColor: '#2563EB' },
];

function RightPanel() {
  return (
    <div style={{ flex: '0 0 50%', background: '#0A1628', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 56px' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div style={{ marginBottom: '32px', position: 'relative' }}>
        <Logo variant="symbol" color="white" size={56} />
      </div>

      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'white', margin: '0 0 12px', lineHeight: 1.3, position: 'relative' }}>
        Uncover hidden value.
      </h2>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 40px', lineHeight: 1.6, position: 'relative' }}>
        AI-powered market intelligence for art investment.
      </p>

      <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '32px', position: 'relative' }} />

      <div style={{ position: 'relative' }}>
        {SIGNAL_CARDS.map((card, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px 16px', marginBottom: i < 2 ? '10px' : 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: card.badgeColor, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>{card.badge}</div>
              <div style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>{card.artist}</div>
            </div>
            <div style={{ fontSize: '12px', color: card.detailColor, fontFamily: 'var(--font-mono)', fontWeight: 600, textAlign: 'right' }}>{card.detail}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: '28px', left: '56px', right: '56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#C6A85A', animation: 'pulseDot 2s infinite' }} />
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            Updated 3 min ago · Live market scanning
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const res = await loginApi(email, password);
      setUser({
        id: res.user_id,
        email: res.email,
        name: res.name,
        plan: (res.plan ?? 'free') as any,
        token: res.access_token,
      });
      navigate('/app/opportunities');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FAFAFA' }}>
      {/* Left — form */}
      <div style={{ flex: '0 0 50%', background: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 72px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: '8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--electric)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            Nautilus Terminal
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.2 }}>
            Access your intelligence
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: '0 0 32px', lineHeight: 1.6 }}>
            Market signals and investment opportunities await.
          </p>

          <div style={{ width: '32px', height: '2px', background: 'var(--gold)', marginBottom: '32px' }} />

          {error && (
            <div style={{ padding: '12px 16px', background: 'var(--red-subtle)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '6px', fontSize: '13px', color: 'var(--red)', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <div style={{ width: '100%', maxWidth: '400px' }}>

            {/* Google — PRIMARY */}
            <GoogleSignInButton onError={(err) => setError(err)} />

            {/* OR divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                OR CONTINUE WITH EMAIL
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            {/* Email input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                Email
              </label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" />
            </div>

            {/* Password input */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '12px' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div style={{ textAlign: 'right', marginBottom: '16px' }}>
              <a href="/forgot-password" style={{ fontSize: '12px', color: 'var(--text-3)', textDecoration: 'none' }}>
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn-electric"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '13px', opacity: loading ? 0.7 : 1, textTransform: 'none' as const, letterSpacing: '0.02em' }}
            >
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>

            {/* Sign up link */}
            <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', marginTop: '20px' }}>
              Don't have an account?{' '}
              <Link to="/app/signup" style={{ color: 'var(--electric)', fontWeight: 600, textDecoration: 'none' }}>
                Get access
              </Link>
            </p>

          </div>
        </div>
      </div>

      {/* Right — visual */}
      <RightPanel />
    </div>
  );
}
