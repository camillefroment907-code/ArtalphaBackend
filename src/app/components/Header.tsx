import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';
import { getUser, logout, getUserPlan, getToken } from '../../lib/auth';

function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

const NAV_ITEMS = [
  { tKey: 'nav.signalFeed',   label: 'Signal Feed', to: '/app/dashboard', dropdown: null },
  { tKey: 'nav.explorer',     label: '',            to: '/app/explore',   dropdown: 'explorer' },
  { tKey: 'nav.artists',      label: 'Artists',     to: '/app/artists',   dropdown: null },
  { tKey: 'nav.calendar',     label: 'Calendar',    to: '/app/calendar',  dropdown: null },
  { tKey: 'nav.intelligence', label: '',            to: '/app/agent',     dropdown: null },
  { tKey: 'nav.portfolio',    label: '',            to: '/app/portfolio',  dropdown: null },
];

const EXPLORER_ITEMS = [
  { icon: '◆', labelKey: 'explorer.bestLots',    subKey: 'explorer.bestLotsSub',    to: '/app/explore?tab=best' },
  { icon: '◉', labelKey: 'explorer.allAuctions', subKey: 'explorer.allAuctionsSub', to: '/app/explore?tab=auctions' },
  { icon: '◐', labelKey: 'explorer.primary',     subKey: 'explorer.primarySub',     to: '/app/explore?tab=primary' },
  { icon: '★', labelKey: 'explorer.convictions', subKey: 'explorer.convictionsSub', to: '/app/explore?tab=convictions' },
];

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', starter: 'Collector', investor: 'Investor',
  pro: 'Family Office', elite: 'Institutional', institutional: 'Institutional',
};

const ADMIN_EMAIL = 'camillefroment907@gmail.com';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();

  const currentLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const toggleLang = () => {
    const newLang = currentLang === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
    localStorage.setItem('i18nextLng', newLang);
  };

  const [explorerOpen, setExplorerOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [agentUnread, setAgentUnread] = useState(0);
  const [scanState, setScanState] = useState<'idle' | 'loading' | 'done'>('idle');

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      navigate(`/app/explore?tab=best&search=${encodeURIComponent(searchValue.trim())}`);
      setSearchValue('');
    }
  };

  const avatarRef = useRef<HTMLDivElement>(null);

  const plan = user?.email === ADMIN_EMAIL ? 'elite' : getUserPlan();
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    fetch(`${BACKEND}/api/agent/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setAgentUnread(d.count ?? 0))
      .catch(() => {});
  }, [user?.email]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.to === '/app/explore') {
      return ['/app/explore', '/app/opportunities', '/app/primary', '/app/convictions']
        .some(p => location.pathname.startsWith(p));
    }
    if (item.to === '/app/agent') {
      return location.pathname.startsWith('/app/agent') || location.pathname.startsWith('/app/intelligence');
    }
    return location.pathname.startsWith(item.to);
  };

  async function handleScan() {
    if (scanState === 'loading') return;
    setScanState('loading');
    try {
      await fetch(`${BACKEND}/api/n8n/trigger-scraping`, {
        method: 'POST',
        headers: { 'x-api-key': 'eee50ac99b4fca0ff5c5c205fe3ed79a' },
      });
    } catch { /* ignore */ }
    setScanState('done');
    setTimeout(() => setScanState('idle'), 2000);
  }

  const initials = user
    ? (user.name ? user.name.slice(0, 2) : user.email.slice(0, 2)).toUpperCase()
    : '?';

  return (
    <>
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(250,250,250,0.94)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      height: '56px',
      display: 'flex', alignItems: 'center',
      padding: '0 20px',
      gap: '16px',
    }}>

      {/* Logo */}
      <Link to={getToken() ? '/app/explore' : '/'} style={{ textDecoration: 'none', flexShrink: 0 }}>
        <Logo variant="horizontal" color="dark" size={28} />
      </Link>

      {/* ── Mobile hamburger ── */}
      {isMobile && user && (
        <>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Open navigation"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px', display: 'flex', flexDirection: 'column',
              gap: '5px', alignItems: 'center', justifyContent: 'center',
              minWidth: '44px', minHeight: '44px',
            }}
          >
            <span style={{
              display: 'block', width: '20px', height: '1.5px',
              background: mobileMenuOpen ? 'transparent' : 'var(--text)',
              transition: 'all 0.2s',
              transform: mobileMenuOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none',
            }} />
            <span style={{
              display: 'block', width: '20px', height: '1.5px',
              background: 'var(--text)',
              transition: 'all 0.2s',
              opacity: mobileMenuOpen ? 0 : 1,
            }} />
            <span style={{
              display: 'block', width: '20px', height: '1.5px',
              background: 'var(--text)',
              transition: 'all 0.2s',
              transform: mobileMenuOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none',
            }} />
          </button>
        </>
      )}

      {/* ── Logged-in layout (desktop) ── */}
      {user && !isMobile ? (
        <>
          {/* Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              const isExplorer = item.dropdown === 'explorer';
              const isIntelligence = item.to === '/app/agent';

              if (isExplorer) {
                return (
                  <div
                    key={item.to}
                    style={{ position: 'relative' }}
                    onMouseEnter={() => setExplorerOpen(true)}
                    onMouseLeave={() => setExplorerOpen(false)}
                  >
                    <Link
                      to={item.to}
                      style={{
                        padding: '6px 14px',
                        fontSize: '13px',
                        fontWeight: active ? 600 : 400,
                        color: active ? 'var(--navy)' : 'var(--text-2)',
                        textDecoration: 'none',
                        borderBottom: active ? '2px solid var(--electric)' : '2px solid transparent',
                        transition: 'all 0.15s var(--ease)',
                        letterSpacing: '0.01em',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        lineHeight: '42px',
                      }}
                    >
                      {item.label || t(item.tKey)}
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{
                        transition: 'transform 0.15s',
                        transform: explorerOpen ? 'rotate(180deg)' : 'none',
                        opacity: 0.5,
                      }}>
                        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </Link>

                    <div style={{
                      position: 'absolute', top: '100%', left: '0',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '0 8px 8px 8px',
                      boxShadow: 'var(--shadow-lg)',
                      minWidth: '240px',
                      padding: '6px',
                      pointerEvents: explorerOpen ? 'auto' : 'none',
                      opacity: explorerOpen ? 1 : 0,
                      transform: explorerOpen ? 'translateY(0)' : 'translateY(-6px)',
                      transition: 'opacity 0.15s var(--ease), transform 0.15s var(--ease)',
                    }}>
                      {EXPLORER_ITEMS.map(sub => (
                        <Link
                          key={sub.to}
                          to={sub.to}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '10px 16px', borderRadius: '6px',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ fontSize: '14px', flexShrink: 0, width: '20px', textAlign: 'center', color: 'var(--navy)' }}>
                            {sub.icon}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>
                              {t(sub.labelKey)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.3 }}>
                              {t(sub.subKey)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--navy)' : 'var(--text-2)',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    borderBottom: active ? '2px solid var(--electric)' : '2px solid transparent',
                    transition: 'all 0.15s var(--ease)',
                    letterSpacing: '0.01em',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--navy)';
                      (e.currentTarget as HTMLAnchorElement).style.background = 'var(--navy-subtle)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)';
                      (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                    }
                  }}
                >
                  {item.label || t(item.tKey)}
                  {isIntelligence && agentUnread > 0 && (
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: 'var(--gold)', display: 'inline-block', flexShrink: 0,
                    }} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Live */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#10B981', display: 'inline-block',
              boxShadow: '0 0 0 2px rgba(16,185,129,0.25)',
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.06em' }}>
              {t('nav.live').toUpperCase()}
            </span>
          </div>

          {/* Language toggle */}
          <button
            onClick={toggleLang}
            style={{
              padding: '3px 8px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--electric)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--electric)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; }}
          >
            {currentLang === 'fr' ? 'EN' : 'FR'}
          </button>

          {/* Search */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <input
              type="text"
              placeholder={t('nav.search')}
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                width: searchFocused ? '220px' : '160px',
                padding: '6px 12px 6px 32px',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                background: 'var(--bg-subtle)',
                border: searchFocused ? '1px solid var(--electric)' : '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                outline: 'none',
                boxShadow: searchFocused ? '0 0 0 3px var(--electric-subtle)' : 'none',
                transition: 'width 0.2s var(--ease), border-color 0.15s, box-shadow 0.15s',
              }}
            />
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.4 }}
            >
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Bell */}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}
            onClick={() => navigate('/app/alerts')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {agentUnread > 0 && (
              <span style={{
                position: 'absolute', top: '2px', right: '2px',
                width: '7px', height: '7px', borderRadius: '50%',
                background: 'var(--gold)', border: '1.5px solid var(--bg)',
              }} />
            )}
          </button>

          {/* Avatar */}
          <div ref={avatarRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setAvatarOpen(o => !o)}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--electric-subtle)',
                border: '1.5px solid var(--electric-border)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                color: 'var(--electric)', letterSpacing: '0.04em',
              }}
            >
              {initials}
            </button>

            {avatarOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '220px',
                padding: '8px',
                zIndex: 200,
              }}>
                {/* User info */}
                <div style={{ padding: '8px 12px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px',
                      background: 'var(--electric-subtle)',
                      border: '1px solid var(--electric-border)',
                      fontSize: '10px', fontWeight: 700,
                      color: 'var(--electric)', letterSpacing: '0.08em',
                      fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const,
                    }}>
                      {planLabel}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </div>
                </div>

                {/* Menu items */}
                <div style={{ padding: '4px 0' }}>
                  <button
                    onClick={() => { navigate('/app/portfolio'); setAvatarOpen(false); }}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: '13px', color: 'var(--text)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ opacity: 0.5 }}>◇</span> {t('nav.myAccount')}
                  </button>
                  <button
                    onClick={() => { navigate('/app/pricing'); setAvatarOpen(false); }}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: '13px', color: 'var(--text)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ opacity: 0.5 }}>◈</span> Subscription
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => { handleScan(); setAvatarOpen(false); }}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: '13px', color: 'var(--navy)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <span>⚡</span> {scanState === 'loading' ? 'Scanning…' : scanState === 'done' ? 'Done ✓' : 'Scan Market'}
                    </button>
                  )}

                  <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                  <button
                    onClick={() => { logout(); navigate('/'); }}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', fontSize: '13px', color: 'var(--red)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--red-subtle)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ opacity: 0.6 }}>→</span> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : !user ? (
        /* ── Not logged in ── */
        <>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => navigate('/app/login')}
            style={{ fontSize: '14px', color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', minHeight: '44px' }}
          >
            Sign in
          </button>
          <button
            className="btn btn-electric"
            onClick={() => navigate('/app/signup')}
            style={{ minHeight: '44px' }}
          >
            Get access
          </button>
        </>
      ) : null /* mobile logged-in: hamburger already rendered above */}
    </header>

    {/* ── Mobile menu drawer ── */}
    {isMobile && user && (
      <div style={{
        position: 'fixed', top: '56px', left: 0, right: 0, bottom: 0,
        background: 'var(--bg)',
        zIndex: 99,
        overflowY: 'auto',
        transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ padding: '16px 0 32px' }}>
          {/* User pill */}
          <div style={{
            padding: '12px 20px 16px',
            borderBottom: '1px solid var(--border)',
            marginBottom: '8px',
          }}>
            <span style={{
              display: 'inline-block',
              padding: '3px 10px', borderRadius: '20px',
              background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)',
              fontSize: '10px', fontWeight: 700,
              color: 'var(--electric)', letterSpacing: '0.08em',
              fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
            }}>
              {planLabel}
            </span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' }}>
              {user.email}
            </div>
          </div>

          {/* Nav items */}
          {NAV_ITEMS.map(item => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '14px 20px',
                fontSize: '15px', fontWeight: isActive(item) ? 600 : 400,
                color: isActive(item) ? 'var(--navy)' : 'var(--text)',
                textDecoration: 'none',
                borderLeft: isActive(item) ? '3px solid var(--gold)' : '3px solid transparent',
                background: isActive(item) ? 'var(--navy-subtle)' : 'transparent',
                minHeight: '44px',
              }}
            >
              {item.label || t(item.tKey)}
            </Link>
          ))}

          <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />

          <button
            onClick={() => { navigate('/app/alerts'); setMobileMenuOpen(false); }}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 20px', fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Alerts
          </button>

          <button
            onClick={() => { navigate('/app/portfolio'); setMobileMenuOpen(false); }}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 20px', fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px' }}
          >
            <span style={{ opacity: 0.5 }}>◇</span> My Account
          </button>

          <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />

          <button
            onClick={() => { logout(); navigate('/'); }}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 20px', fontSize: '15px', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px' }}
          >
            <span style={{ opacity: 0.6 }}>→</span> Sign out
          </button>
        </div>
      </div>
    )}
    </>
  );
}
