import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { registerApi } from '../../lib/api';
import { setUser } from '../../lib/auth';
import { useSEO } from '../../lib/useSEO';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

const FALLBACK_LOTS = [
  { badge: '◆ STRONG BUY',  badgeColor: '#C6A85A',               artist: 'Pierre Soulages', detail: '−28% vs estimate', detailColor: '#2563EB' },
  { badge: '⚡ NEW SIGNAL',  badgeColor: 'rgba(255,255,255,0.7)', artist: 'Zao Wou-Ki',      detail: 'Score: 87/100',    detailColor: 'rgba(255,255,255,0.5)' },
  { badge: '◎ LIVE AUCTION', badgeColor: 'rgba(255,255,255,0.7)', artist: 'Drouot · Closes in 14h', detail: '+€32K upside', detailColor: '#C6A85A' },
];

const BADGE_META = [
  { badge: '◆ STRONG BUY',  badgeColor: '#C6A85A',               detailColor: '#2563EB' },
  { badge: '⚡ NEW SIGNAL',  badgeColor: 'rgba(255,255,255,0.7)', detailColor: 'rgba(255,255,255,0.5)' },
  { badge: '◎ LIVE AUCTION', badgeColor: 'rgba(255,255,255,0.7)', detailColor: '#C6A85A' },
];

function RightPanel() {
  const [cards, setCards] = useState(FALLBACK_LOTS);
  const [bgImage, setBgImage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/lots/public?limit=2&sort=deal_score&min_price=500`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const items: any[] = Array.isArray(data) ? data : (data.items || data.lots || []);
        if (items.length < 1) return;
        // Use second lot's image as background (first used for signal cards hero)
        const secondUrl = items[1]?.image_url || items[0]?.image_url;
        if (secondUrl) setBgImage(secondUrl);
        setCards(items.slice(0, 3).map((lot: any, i: number) => ({
          badge:       BADGE_META[i]?.badge       ?? '◆',
          badgeColor:  BADGE_META[i]?.badgeColor  ?? '#C6A85A',
          artist:      lot.artist_name_raw || lot.title || 'Unknown',
          detail:      lot.deal_score
            ? `Score: ${Math.round(lot.deal_score)}/100`
            : lot.pct_below_low_estimate
              ? `−${Math.abs(lot.pct_below_low_estimate).toFixed(0)}% vs estimate`
              : '—',
          detailColor: BADGE_META[i]?.detailColor ?? '#C6A85A',
        })));
      })
      .catch(() => {});
  }, []);

  const panelBg = bgImage
    ? `linear-gradient(rgba(10,22,40,0.65), rgba(10,22,40,0.65)), url(${bgImage})`
    : undefined;

  return (
    <div style={{ flex: '0 0 50%', background: '#0A1628', backgroundImage: panelBg, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 56px' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div style={{ marginBottom: '20px', position: 'relative' }}>
        <Logo variant="symbol" color="white" size={40} />
      </div>

      {/* Hero text */}
      <div style={{ marginBottom: '24px', position: 'relative' }}>
        <h2 style={{ color: '#FFFFFF', fontFamily: 'Georgia,serif', fontSize: 28, fontWeight: 'normal', lineHeight: 1.2, margin: '0 0 8px' }}>
          The market has a gap.<br />You're about to see it.
        </h2>
        <p style={{ color: 'rgba(198,168,90,0.7)', fontSize: 13, margin: 0, fontFamily: 'Arial,sans-serif' }}>
          Real opportunities. Right now.
        </p>
      </div>

      <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '20px', position: 'relative' }} />

      <div style={{ position: 'relative' }}>
        {cards.map((card, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px 16px', marginBottom: i < 2 ? '10px' : 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: card.badgeColor, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>{card.badge}</div>
              <div style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>{card.artist}</div>
            </div>
            <div style={{ fontSize: '12px', color: card.detailColor, fontFamily: 'var(--font-mono)', fontWeight: 600, textAlign: 'right' }}>{card.detail}</div>
          </div>
        ))}
      </div>

      {/* Stats strip */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 16, flexWrap: 'wrap', position: 'relative' }}>
        {['3,500+ lots scored', 'Avg +31% upside on 80+', '6 exceptional lots today'].map(s => (
          <span key={s} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Arial,sans-serif' }}>{s}</span>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: '20px', left: '56px', right: '56px' }}>
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
