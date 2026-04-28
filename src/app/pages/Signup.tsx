import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { registerApi } from '../../lib/api';
import { setUser } from '../../lib/auth';
import { useSEO } from '../../lib/useSEO';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

function RightPanel() {
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [featured, setFeatured] = useState<{ artist: string; title: string; score: number; upside: number | null } | null>(null);
  const [lotCount, setLotCount] = useState('—');

  useEffect(() => {
    fetch(`${API}/api/lots/public?limit=5&sort=deal_score`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const items: any[] = Array.isArray(data) ? data : (data.items || data.lots || []);
        if (!items.length) return;
        const withImg = items.filter((l: any) => !!l.image_url);
        const bgLot = withImg[1] || withImg[0];
        if (bgLot) setBgImage(bgLot.image_url);
        const featLot = withImg[0] || items[0];
        if (featLot) setFeatured({
          artist: featLot.artist?.name || featLot.artist_name_raw || 'Unknown',
          title: featLot.title || '',
          score: Math.round(featLot.deal_score || 0),
          upside: featLot.pct_below_low_estimate ?? null,
        });
      })
      .catch(() => {});

    fetch(`${API}/api/lots/count`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const n = data?.total ?? data?.count ?? null;
        if (n && n > 0) setLotCount(n >= 1000 ? `${Math.floor(n / 100) / 10}K+` : `${n}`);
      })
      .catch(() => {});
  }, []);

  const panelBg = bgImage
    ? `linear-gradient(rgba(10,22,40,0.6), rgba(10,22,40,0.6)), url(${bgImage})`
    : 'linear-gradient(135deg, #0A1628 0%, #0f2040 100%)';

  const FEATURES = [
    { icon: '◆', color: '#C6A85A', label: `${lotCount} lots analyzed`, sub: 'Daily, across 14 auction houses' },
    { icon: '⚡', color: '#60a5fa', label: 'AI deal score on every lot', sub: 'Trained on 10 years of sales data' },
    { icon: '●', color: '#22c55e', label: 'Real-time alerts at score ≥ 80', sub: 'Never miss an exceptional opportunity' },
  ];

  return (
    <div style={{ flex: '0 0 50%', background: '#0A1628', backgroundImage: panelBg, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 52px' }}>
      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Logo + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <Logo variant="symbol" color="white" size={36} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 20, padding: '4px 10px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 9, color: 'rgba(34,197,94,0.9)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>MARKET LIVE</span>
          </div>
        </div>

        {/* Headline */}
        <h2 style={{ color: '#fff', fontFamily: 'Georgia,serif', fontSize: 30, fontWeight: 'normal', lineHeight: 1.2, margin: '0 0 8px', textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>
          Art Intelligence.<br />Finally.
        </h2>
        <p style={{ color: 'rgba(198,168,90,0.85)', fontSize: 13, margin: '0 0 28px', textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>
          See the opportunities the market misses.
        </p>

        {/* Feature rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'rgba(0,0,0,0.38)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderLeft: `3px solid ${f.color}`,
              borderRadius: '0 8px 8px 0',
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 14, color: f.color, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{f.icon}</div>
              <div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{f.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Live opportunity spotlight */}
        {featured && (
          <div style={{ background: 'rgba(198,168,90,0.07)', border: '1px solid rgba(198,168,90,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: 'rgba(198,168,90,0.55)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 7 }}>◆ Live opportunity detected</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{featured.artist}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170, marginTop: 2 }}>{featured.title}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                {featured.upside !== null && featured.upside > 0
                  ? <div style={{ fontSize: 15, color: '#C6A85A', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>+{Math.round(featured.upside)}%</div>
                  : null}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>Score {featured.score}/100</div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#C6A85A', animation: 'pulseDot 2s infinite' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            Scanning live · 14 auction houses
          </span>
        </div>

      </div>
    </div>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  useSEO({ title: 'Get Access · Nautilus', noindex: true });

  async function handleRegister() {
    setError('');
    setNameError('');
    setEmailError('');

    let valid = true;
    if (!name.trim()) {
      setNameError('Full name is required');
      valid = false;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      valid = false;
    }
    if (!valid) return;

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const res = await registerApi(email.trim(), password, name.trim(), newsletterConsent);
      setUser({
        id: res.user_id,
        email: res.email,
        name: res.name ?? name,
        plan: (res.plan ?? 'free') as any,
        token: res.access_token,
      });
      localStorage.setItem('nautilus_show_tour', '1');
      navigate('/app/onboarding');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div style={{ display: 'flex', height: '100vh', maxHeight: '100vh', overflow: 'hidden', background: '#FAFAFA' }}>
      {/* Left — form */}
      <div style={{ flex: '0 0 50%', background: 'white', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 72px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.2 }}>
            Get access to the platform
          </h1>

          <div style={{ width: '32px', height: '2px', background: 'var(--gold)', marginBottom: '14px' }} />

          {error && (
            <div style={{ padding: '12px 16px', background: 'var(--red-subtle)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '6px', fontSize: '13px', color: 'var(--red)', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <div style={{ width: '100%', maxWidth: '400px' }}>
            {/* Google — PRIMARY */}
            <GoogleSignInButton onError={(err) => setError(err)} />

            {/* OR divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '10px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                OR CONTINUE WITH EMAIL
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            {/* Full name */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                Full name
              </label>
              <input type="text" className="input" value={name} onChange={e => { setName(e.target.value); if (nameError) setNameError(''); }} placeholder="John Smith" autoComplete="name" style={nameError ? { borderColor: 'var(--red)' } : {}} />
              {nameError && <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--red)' }}>{nameError}</div>}
            </div>

            {/* Email */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                Email
              </label>
              <input type="email" className="input" value={email} onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(''); }} placeholder="your@email.com" autoComplete="email" style={emailError ? { borderColor: 'var(--red)' } : {}} />
              {emailError && <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--red)' }}>{emailError}</div>}
            </div>

            {/* Password */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8+ characters"
                  autoComplete="new-password"
                  style={{ paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '12px' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                Confirm password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                onKeyDown={e => { if (e.key === 'Enter' && tosAccepted) handleRegister(); }}
                style={passwordMismatch ? { borderColor: 'var(--red)' } : {}}
              />
              {passwordMismatch && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--red)' }}>Passwords don't match</div>
              )}
            </div>

            {/* Legal — 2 checkboxes only */}
            <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={e => setTosAccepted(e.target.checked)}
                  required
                  style={{ marginTop: '3px', flexShrink: 0, accentColor: '#2563EB', width: '14px', height: '14px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--red)', marginRight: '3px' }}>*</span>
                  I accept the{' '}
                  <a href="/legal#tos" target="_blank" rel="noreferrer" style={{ color: 'var(--electric)' }}>Terms of Service</a>
                  {' '}and{' '}
                  <a href="/legal#privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--electric)' }}>Privacy Policy</a>
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newsletterConsent}
                  onChange={e => setNewsletterConsent(e.target.checked)}
                  style={{ marginTop: '3px', flexShrink: 0, accentColor: '#2563EB', width: '14px', height: '14px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 }}>
                  I'd like to receive market intelligence newsletters from Nautilus
                </span>
              </label>
            </div>

            {/* Submit */}
            <button
              onClick={handleRegister}
              disabled={loading || passwordMismatch || !tosAccepted}
              className="btn-electric"
              style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '13px', opacity: (loading || !tosAccepted) ? 0.7 : 1, textTransform: 'none' as const, letterSpacing: '0.02em' }}
            >
              {loading ? 'Creating account…' : 'Create my account'}
            </button>

            {/* Already have account */}
            <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', marginTop: '12px' }}>
              Already have an account?{' '}
              <Link to="/app/login" style={{ color: 'var(--electric)', fontWeight: 600, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right — live signal panel */}
      <RightPanel />
    </div>
  );
}
