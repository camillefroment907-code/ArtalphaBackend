import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Logo } from './Logo';
import { getUser, logout, getPlanLimits, getToken } from '../../lib/auth';

const NAV_LINKS = [
  { to: '/app/opportunities', label: 'Opportunities', agentOnly: false },
  { to: '/app/artists',       label: 'Artists',       agentOnly: false },
  { to: '/app/market',        label: 'Market',        agentOnly: false },
  { to: '/app/alerts',        label: 'Alerts',        agentOnly: false },
  { to: '/app/portfolio',     label: 'Portfolio',     agentOnly: false },
  { to: '/app/agent',         label: 'Agent IA',      agentOnly: true  },
];

const PLAN_LABELS: Record<string, string> = {
  free:     'Free',
  starter:  'Collector',
  investor: 'Investor',
  pro:      'Family Office',
  elite:    'Institutional',
};

const ADMIN_EMAIL = 'camillefroment907@gmail.com';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  const [scanState, setScanState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [agentUnread, setAgentUnread] = useState(0);

  const hasAgentAccess = user ? getPlanLimits().hasFullArtistProfile : false;

  useEffect(() => {
    if (!hasAgentAccess) return;
    const token = getToken();
    fetch('/api/agent/unread-count', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setAgentUnread(d.count ?? 0))
      .catch(() => {});
  }, [hasAgentAccess]);

  const isActive = (to: string) => location.pathname.startsWith(to);

  const plan = user?.email === ADMIN_EMAIL ? 'elite' : (user?.plan ?? 'free');
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const isAdmin = user?.email === ADMIN_EMAIL;
  const isFreePlan = plan === 'free' || plan === 'starter';

  const truncateEmail = (email: string) =>
    email.length > 20 ? email.slice(0, 20) + '…' : email;

  async function handleScan() {
    if (scanState === 'loading') return;
    setScanState('loading');
    try {
      await fetch('/api/n8n/trigger-scraping', {
        method: 'POST',
        headers: { 'x-api-key': 'eee50ac99b4fca0ff5c5c205fe3ed79a' },
      });
    } catch {
      // ignore errors
    }
    setScanState('done');
    setTimeout(() => setScanState('idle'), 2000);
  }

  function handleSignOut() {
    logout();
    navigate('/');
  }

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,250,248,0.94)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        height: '60px',
        display: 'flex', alignItems: 'center',
        padding: '0 40px',
        gap: '32px',
      }}
    >
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <Logo variant="horizontal" color="dark" size={26} />
      </Link>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
        {NAV_LINKS.filter(({ agentOnly }) => !agentOnly || user).map(({ to, label, agentOnly }) => {
          const active = isActive(to);
          const isAgent = agentOnly;
          return (
            <Link
              key={to}
              to={to}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--navy)' : 'var(--text-2)',
                textDecoration: 'none',
                borderRadius: '6px',
                borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
                transition: 'all 0.15s var(--ease)',
                letterSpacing: '0.01em',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--navy)';
                  (e.currentTarget as HTMLAnchorElement).style.background = 'var(--navy-subtle)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)';
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                }
              }}
            >
              {label}
              {isAgent && agentUnread > 0 && (
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--gold)',
                  display: 'inline-block', flexShrink: 0,
                  animation: 'pulse 2s infinite',
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {!user ? (
          <>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '12px' }}
              onClick={() => navigate('/app/login')}
            >
              Log In
            </button>
            <button
              className="btn btn-gold"
              style={{ fontSize: '11px', padding: '8px 18px' }}
              onClick={() => navigate('/app/signup')}
            >
              Get Started
            </button>
          </>
        ) : (
          <>
            {/* Plan badge */}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--gold-dim)', background: 'var(--gold-subtle)',
              border: '1px solid var(--gold-border)',
              padding: '3px 9px', borderRadius: '4px',
            }}>
              {planLabel}
            </span>

            {/* Email */}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)',
            }}>
              {truncateEmail(user.email)}
            </span>

            {/* Admin scan button */}
            {isAdmin && (
              <button
                className="btn btn-navy"
                style={{ fontSize: '11px', padding: '8px 18px' }}
                onClick={handleScan}
                disabled={scanState === 'loading'}
              >
                {scanState === 'loading' ? 'Scanning…' : scanState === 'done' ? 'Done ✓' : 'RUN SCAN'}
              </button>
            )}

            {/* Upgrade for free/starter */}
            {isFreePlan && (
              <button
                className="btn btn-gold"
                style={{ fontSize: '11px', padding: '8px 16px' }}
                onClick={() => navigate('/app/pricing')}
              >
                Upgrade
              </button>
            )}

            {/* Sign out */}
            <button
              className="btn btn-ghost"
              style={{ fontSize: '12px' }}
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
