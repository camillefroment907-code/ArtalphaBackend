import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { loginApi } from '../../lib/api';
import { setUser } from '../../lib/auth';
import { useSEO } from '../../lib/useSEO';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useTranslation } from 'react-i18next';

const API = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

type SignalCard = { badge: string; badgeColor: string; artist: string; detail: string; detailColor: string };

function getFallbackCards(isFr: boolean): SignalCard[] {
  return [
    { badge: isFr ? '◆ ACHAT FORT' : '◆ STRONG BUY', badgeColor: '#C6A85A', artist: 'Pierre Soulages', detail: isFr ? '−28% vs estimation' : '−28% vs estimate', detailColor: '#2563EB' },
    { badge: isFr ? '⚡ NOUVEAU SIGNAL' : '⚡ NEW SIGNAL', badgeColor: 'rgba(255,255,255,0.7)', artist: 'Zao Wou-Ki', detail: isFr ? 'Score : 87/100' : 'Deal score: 87/100', detailColor: 'rgba(255,255,255,0.5)' },
    { badge: isFr ? '◎ ENCHÈRE EN DIRECT' : '◎ LIVE AUCTION', badgeColor: 'rgba(255,255,255,0.7)', artist: isFr ? 'Drouot · Clôture dans 14h' : 'Drouot · Closes in 14h', detail: isFr ? '+€32K potentiel' : '+€32K upside', detailColor: '#2563EB' },
  ];
}

function mapLotToCard(lot: any, isFr: boolean): SignalCard {
  const artist = lot.artist_name_raw || 'Unknown Artist';
  const score = Math.round(lot.deal_score || 0);
  const upside = lot.pct_below_low_estimate;

  let badge = isFr ? '◎ ENCHÈRE EN DIRECT' : '◎ LIVE AUCTION';
  let badgeColor = 'rgba(255,255,255,0.7)';
  let detail = isFr ? `Score : ${score}/100` : `Deal score: ${score}/100`;
  let detailColor = 'rgba(255,255,255,0.5)';

  if (score >= 80) {
    badge = isFr ? '◆ ACHAT FORT' : '◆ STRONG BUY';
    badgeColor = '#C6A85A';
    detailColor = '#2563EB';
  } else if (score >= 70) {
    badge = isFr ? '⚡ NOUVEAU SIGNAL' : '⚡ NEW SIGNAL';
  }

  if (upside && upside > 0) {
    detail = isFr ? `−${Math.round(upside)}% vs estimation` : `−${Math.round(upside)}% vs estimate`;
    detailColor = '#2563EB';
  }

  return { badge, badgeColor, artist, detail, detailColor };
}

type FeaturedLot = { artist: string; title: string; upside: number | null; score: number };

function RightPanel() {
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');
  const [cards, setCards] = useState<SignalCard[]>(() => getFallbackCards(isFr));
  const [lotCountLabel, setLotCountLabel] = useState('—');
  const [avgUpside, setAvgUpside] = useState('—');
  const [signalsToday, setSignalsToday] = useState('—');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [featured, setFeatured] = useState<FeaturedLot | null>(null);

  useEffect(() => {
    fetch(`${API}/api/lots/public?limit=5&sort=deal_score`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const items: any[] = Array.isArray(data) ? data : (data?.items || []);
        if (!items.length) return;
        const withImg = items.find((l: any) => !!l.image_url);
        if (withImg) {
          setBgImage(withImg.image_url);
          setFeatured({
            artist: withImg.artist_name_raw || 'Unknown Artist',
            title: withImg.title || '',
            upside: withImg.pct_below_low_estimate ?? null,
            score: Math.round(withImg.deal_score || 0),
          });
        }
        setCards(items.slice(0, 3).map(lot => mapLotToCard(lot, isFr)));
      })
      .catch(() => {});

    fetch(`${API}/api/lots/count`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const n = data?.total ?? data?.count ?? null;
        if (n && n > 0) setLotCountLabel(n >= 1000 ? `${Math.floor(n / 100) / 10}K+` : `${n}`);
      })
      .catch(() => {});

    fetch(`${API}/api/lots/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.avg_deal_score) setAvgUpside(`+${Math.round(data.avg_deal_score)}%`);
        if (data.deals_detected_today != null) setSignalsToday(String(data.deals_detected_today));
      })
      .catch(() => {});
  }, []);

  const panelBg = bgImage
    ? `linear-gradient(rgba(10,22,40,0.58), rgba(10,22,40,0.58)), url(${bgImage})`
    : 'linear-gradient(135deg, #0A1628 0%, #0f2040 100%)';

  return (
    <div className="login-right-panel" style={{ flex: '0 0 50%', background: '#0A1628', backgroundImage: panelBg, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 52px' }}>
      {/* Vignette edges */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Live badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Live · Market Intelligence</span>
        </div>

        {/* Headline */}
        <h2 style={{ color: '#fff', fontFamily: 'Georgia,serif', fontSize: 30, fontWeight: 'normal', lineHeight: 1.2, margin: '0 0 6px', textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>
          {isFr ? <>Bon retour.<br />Le marché n'a pas attendu.</> : <>Welcome back.<br />The market didn't wait.</>}
        </h2>
        <p style={{ color: 'rgba(198,168,90,0.85)', fontSize: 13, margin: '0 0 24px', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
          {isFr ? 'De nouveaux signaux détectés depuis votre dernière visite.' : 'New signals detected since your last visit.'}
        </p>

        {/* Stats row */}
        <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 20, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)' }}>
          {[
            { value: lotCountLabel, label: isFr ? 'lots analysés' : 'lots analyzed', color: '#fff' },
            { value: avgUpside, label: isFr ? 'Score moyen' : 'Avg score', color: '#C6A85A' },
            { value: signalsToday, label: isFr ? "signaux aujourd'hui" : 'signals today', color: '#60a5fa' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '12px 8px', textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Signal cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: featured ? 12 : 20 }}>
          {cards.map((card, i) => (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderLeft: `3px solid ${card.badgeColor}`,
              borderRadius: '0 8px 8px 0',
              padding: '11px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: card.badgeColor, letterSpacing: '0.14em', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>{card.badge}</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{card.artist}</div>
              </div>
              <div style={{ fontSize: 11, color: card.detailColor, fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'rgba(255,255,255,0.06)', padding: '3px 9px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                {card.detail}
              </div>
            </div>
          ))}
        </div>

        {/* Featured lot spotlight */}
        {featured && (
          <div style={{ background: 'rgba(198,168,90,0.07)', border: '1px solid rgba(198,168,90,0.22)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: 'rgba(198,168,90,0.55)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 7 }}>
              ◆ {isFr ? 'Meilleure opportunité maintenant' : 'Top opportunity now'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{featured.artist}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', marginTop: 2 }}>{featured.title}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                {featured.upside !== null && featured.upside > 0 && (
                  <div style={{ fontSize: 14, color: '#C6A85A', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>+{Math.round(featured.upside)}%</div>
                )}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>Score {featured.score}/100</div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#C6A85A', animation: 'pulseDot 2s infinite' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            {isFr ? 'Mis à jour il y a 3 min · 14 maisons suivies' : 'Updated 3 min ago · 14 auction houses monitored'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useSEO({ title: 'Sign In · Nautilus', noindex: true });

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
        is_verified: res.is_verified ?? true,
        trial_end: res.trial_end ?? null,
        trial_active: res.trial_active ?? false,
      });
      if (res.is_verified === false) {
        navigate('/app/verify-email-required');
      } else {
        navigate('/app/explore');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container" style={{ display: 'flex', height: '100vh', maxHeight: '100vh', overflow: 'hidden', background: '#FAFAFA' }}>
      {/* Left — form */}
      <div className="login-left-panel" style={{ flex: '0 0 50%', background: 'white', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 72px', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.2 }}>
            {isFr ? 'Accédez à votre intelligence marché' : 'Access your intelligence'}
          </h1>

          <div style={{ width: '32px', height: '2px', background: 'var(--gold)', marginBottom: '20px' }} />

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
                {isFr ? 'OU CONTINUER AVEC EMAIL' : 'OR CONTINUE WITH EMAIL'}
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
                {isFr ? 'MOT DE PASSE' : 'PASSWORD'}
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
                  {showPassword ? (isFr ? 'Masquer' : 'Hide') : (isFr ? 'Afficher' : 'Show')}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div style={{ textAlign: 'right', marginBottom: '16px' }}>
              <Link to="/forgot-password" style={{ fontSize: '12px', color: 'var(--text-3)', textDecoration: 'none' }}>
                {isFr ? 'Mot de passe oublié ?' : 'Forgot password?'}
              </Link>
            </div>

            {/* Submit */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn-electric"
              style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '13px', opacity: loading ? 0.7 : 1, textTransform: 'none' as const, letterSpacing: '0.02em' }}
            >
              {loading ? (isFr ? 'Connexion…' : 'Signing in...') : (isFr ? 'Se connecter →' : 'Sign in →')}
            </button>

            {/* Sign up link */}
            <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', marginTop: '12px' }}>
              {isFr ? 'Pas encore de compte ?' : "Don't have an account?"}{' '}
              <Link to="/app/signup" style={{ color: 'var(--electric)', fontWeight: 600, textDecoration: 'none' }}>
                {isFr ? 'Commencer gratuitement' : 'Get access'}
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
