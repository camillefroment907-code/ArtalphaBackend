import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/Logo';
import { mockArtworks } from '../data/mockData';
import { dailyLots, dailyMembers } from '../../lib/dailyStats';
import { useSEO } from '../../lib/useSEO';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// Ticker items — seeded with real-sounding lots, replaced by API data
const SEED_TICKER = [
  { artist: 'Jean-Michel Basquiat', title: 'Study #3', score: 88, house: "Christie's", est: '€45K–65K' },
  { artist: 'Zao Wou-Ki', title: 'Composition abstraite', score: 84, house: 'Drouot', est: '€12K–18K' },
  { artist: 'Joan Miró', title: 'Personnage', score: 82, house: 'Sotheby\'s', est: '€35K–50K' },
  { artist: 'Hans Hartung', title: 'T1973-H30', score: 79, house: 'Artcurial', est: '€8K–12K' },
  { artist: 'Pierre Soulages', title: 'Peinture', score: 91, house: 'Bonhams', est: '€120K–160K' },
  { artist: 'Georges Mathieu', title: 'Capétiens partout', score: 76, house: 'Interenchères', est: '€4K–6K' },
  { artist: 'Yves Klein', title: 'Monochrome IKB', score: 95, house: 'Phillips', est: '€380K–480K' },
  { artist: 'Bernard Buffet', title: 'Les clowns', score: 74, house: 'Millon', est: '€15K–20K' },
];

const MOCK_LOTS = [
  { artist: 'MARC CHAGALL', title: 'Moses and the Burning Bush', price: '€750', score: 86, upside: '+62%' },
  { artist: 'JOAN MIRÓ', title: 'Personnage I Estels V', price: '€1,500', score: 82, upside: '+44%' },
  { artist: 'DAVID DRISKELL', title: 'Echoes', price: '€500', score: 79, upside: '+50%' },
];

function NautilusMockup({ lots = [] }: { lots: any[] }) {
  const [activeCard, setActiveCard] = useState(0);
  const [showScore, setShowScore]   = useState(false);
  const [showBrief, setShowBrief]   = useState(false);
  const [fade, setFade]             = useState(true);

  const items = lots.length > 0 ? lots : MOCK_LOTS;

  const getArtist = (l: any) => (l.artist_name_raw ?? l.artist ?? '').toUpperCase();
  const getTitle  = (l: any) => l.title ?? '';
  const getPrice  = (l: any) => {
    if (l.estimate_low != null) {
      const v = l.estimate_low;
      return v >= 1000 ? `€${Math.round(v / 1000)}K` : `€${Math.round(v)}`;
    }
    return l.price ?? '—';
  };
  const getScore  = (l: any) => l.deal_score ?? l.score ?? 0;
  const getUpside = (l: any) => {
    if (l.pct_below_low_estimate != null) return `+${Math.round(l.pct_below_low_estimate)}%`;
    return l.upside ?? '';
  };
  const getImage  = (l: any) => l.image_url ?? null;

  // Initial reveal
  useEffect(() => {
    const t1 = setTimeout(() => setShowScore(true), 600);
    const t2 = setTimeout(() => setShowBrief(true), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Auto-rotate every 2.5s with 300ms fade transition
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setActiveCard(i => (i + 1) % items.length);
        setFade(true);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, [items.length]);

  const currentItem = items[activeCard] ?? items[0];
  const artist = getArtist(currentItem);
  const title  = getTitle(currentItem);
  const price  = getPrice(currentItem);
  const score  = getScore(currentItem);
  const upside = getUpside(currentItem);
  const imgSrc = getImage(currentItem);
  const gradients = [
    'linear-gradient(135deg, #E8E4DC 0%, #D4C9B5 100%)',
    'linear-gradient(135deg, #E8D8DC 0%, #C9B5BC 100%)',
    'linear-gradient(135deg, #D8E8DC 0%, #B5C9BC 100%)',
  ];

  return (
    <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.12)', border: '1px solid var(--border)', overflow: 'hidden', width: '100%', maxWidth: '680px', margin: '0 auto', userSelect: 'none', transform: 'perspective(1000px) rotateY(-3deg) rotateX(1deg)' }}>

      {/* Main content */}
      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px' }}>

        {/* Active lot card */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(10,22,40,0.08)' }}>
          <div style={{ height: '220px', position: 'relative', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
            {imgSrc ? (
              <img src={imgSrc} alt={title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: gradients[activeCard % 3], display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease' }}>
                <span style={{ fontSize: '32px', opacity: 0.3 }}>◎</span>
              </div>
            )}
            <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(10,22,40,0.85)', padding: '3px 7px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'white', opacity: showScore ? 1 : 0, transition: 'opacity 0.3s ease' }}>
              {score}/100
            </div>
            <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#C6A85A', padding: '2px 6px', borderRadius: '3px', fontSize: '8px', fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)', opacity: showScore ? 1 : 0, transition: 'opacity 0.3s ease 0.1s' }}>
              EXCEPTIONAL
            </div>
          </div>
          <div style={{ padding: '10px 12px', opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'var(--text)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{price}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#2563EB', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', padding: '2px 6px', borderRadius: '3px', fontFamily: 'var(--font-mono)', opacity: showScore ? 1 : 0, transition: 'opacity 0.3s ease 0.2s' }}>
                {upside}
              </span>
            </div>
          </div>
        </div>

        {/* Right mini panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: 'var(--navy)', borderRadius: '8px', padding: '10px', opacity: showScore ? 1 : 0, transition: 'opacity 0.4s ease' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '6px' }}>CONVICTION</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: 'white', lineHeight: 1, opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease' }}>{score}</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>/100</div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }}>
              <div style={{ height: '100%', borderRadius: '2px', background: '#C6A85A', width: `${score}%`, transition: 'width 0.6s ease' }} />
            </div>
          </div>
          {items.slice(0, 3).map((l, i) => (
            <div key={i} style={{ background: i === activeCard ? 'var(--bg-subtle)' : 'white', border: `1px solid ${i === activeCard ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '6px', padding: '6px 8px', transition: 'all 0.3s ease' }}>
              <div style={{ fontSize: '8px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getArtist(l).split(' ').slice(-1)[0]}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--text)' }}>{getScore(l)}/100</span>
                <span style={{ fontSize: '8px', color: '#2563EB', fontWeight: 700 }}>{getUpside(l)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Brief */}
      <div style={{ margin: '0 16px 16px', background: 'var(--navy)', borderRadius: '8px', padding: '12px 14px', opacity: showBrief ? 1 : 0, transform: showBrief ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'white' }}>◆ AI Analysis</span>
          <span style={{ fontSize: '8px', color: '#34D399', fontFamily: 'var(--font-mono)', background: 'rgba(52,211,153,0.15)', padding: '1px 5px', borderRadius: '2px' }}>LIVE</span>
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease' }}>
          {artist ? `${artist.split(' ').slice(-1)[0]} scored ${score}/100 — priced ${upside} below estimate. Strong conviction signal.` : 'Analysing current market conditions...'}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '2px', background: 'var(--bg-subtle)' }}>
        <div style={{ height: '100%', background: '#C6A85A', animation: 'mockupProgress 2.5s linear infinite', transformOrigin: 'left' }} />
      </div>
      <style>{`@keyframes mockupProgress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}

export default function Landing() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const isFr = i18n.language?.startsWith('fr');
  useSEO({
    title: 'Nautilus — Art Market Intelligence | Find Undervalued Art Before the Market',
    description: 'Nautilus scans 500,000+ auction lots across 30+ sources and scores every opportunity with AI. Find undervalued art before the market corrects.',
  });

  const navigate = useNavigate();
  const [topLots, setTopLots]               = useState<any[]>([]);
  const [weeklyStats, setWeeklyStats]       = useState<any>(null);
  const [tickerItems, setTickerItems]       = useState(SEED_TICKER);
  const [lotCount, setLotCount]             = useState<number | null>(null);
  const [showStickyCTA, setShowStickyCTA]   = useState(false);

  useEffect(() => {
    // Public top lots for landing page preview (no auth required)
    fetch(`${BACKEND}/api/lots/public?limit=3&sort=deal_score`)
      .then(r => r.json())
      .then(data => {
        const items = data.lots || [];
        setTopLots(items.slice(0, 3));
        // Replace ticker with real data
        if (items.length >= 3) {
          const real = items.slice(0, 8).map((l: any) => ({
            artist: l.artist_name_raw || 'Unknown Artist',
            title:  l.title || 'Untitled',
            score:  Math.round(l.deal_score || 0),
            house:  l.auction_house_name || 'Auction',
            est:    l.estimate_low
              ? `€${l.estimate_low >= 1000 ? Math.round(l.estimate_low / 1000) + 'K' : l.estimate_low}–${l.estimate_high >= 1000 ? Math.round(l.estimate_high / 1000) + 'K' : l.estimate_high}`
              : '',
          }));
          setTickerItems([...real, ...SEED_TICKER].slice(0, 10));
        }
      })
      .catch(() => {});

    // Real lot count
    fetch(`${BACKEND}/api/lots/count`)
      .then(r => r.json())
      .then(d => { if (d.total) setLotCount(d.total); })
      .catch(() => {});

    // Weekly stats for urgency bar
    fetch(`${BACKEND}/api/market/sentiment`)
      .then(r => r.json())
      .then(d => setWeeklyStats(d))
      .catch(() => {});

    // Sticky CTA — show after 50% scroll
    const onScroll = () => {
      const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      if (pct > 0.5) setShowStickyCTA(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── Sticky CTA bar (after 50% scroll) ── */}
      {showStickyCTA && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'var(--navy)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', boxShadow: '0 -4px 20px rgba(10,22,40,0.2)' }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-sans)' }}>
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{t('landing.stickyExceptional')}</span> {t('landing.stickyClosing')} {t('landing.stickyCta')}
          </span>
          <button
            onClick={() => navigate('/app/signup')}
            style={{ background: 'var(--gold)', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
          >
            {t('landing.startFree')} →
          </button>
          <button onClick={() => setShowStickyCTA(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '16px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* ── Public header ── */}
      <header className="landing-header" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', height: '64px', padding: '0 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo variant="horizontal" color="dark" size={24} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link to="/app/pricing" style={{ fontSize: '13px', color: 'var(--text-2)', textDecoration: 'none' }}>{t('landing.footerPricing')}</Link>
          <Link to="/faq" style={{ fontSize: '13px', color: 'var(--text-2)', textDecoration: 'none' }}>{t('landing.footerFaq')}</Link>
          <Link to="/blog" style={{ fontSize: '13px', color: 'var(--text-2)', textDecoration: 'none' }}>{t('blog.title')}</Link>
          <button onClick={() => navigate('/app/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-2)', padding: '0 4px' }}>
            {t('common.signIn')}
          </button>
          <button onClick={() => navigate('/app/signup')} style={{ background: '#4B6CF5', color: 'white', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 700, padding: '9px 22px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(75,108,245,0.3)', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(75,108,245,0.45)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(75,108,245,0.3)'; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
          >
            {t('landing.startFree')}
          </button>
        </div>
      </header>

      {/* ── LIVE TICKER ── */}
      <div style={{ background: 'var(--bg-deep, #0C1622)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0', overflow: 'hidden', height: '36px', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 14px', height: '100%', background: 'rgba(198,168,90,0.15)', borderRight: '1px solid rgba(198,168,90,0.2)' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', marginRight: '6px', animation: 'pulseDot 2s infinite' }} />
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>LIVE</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <div className="ticker-inner" style={{ display: 'flex', gap: '0', whiteSpace: 'nowrap' }}>
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 24px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.65)', borderRight: '1px solid rgba(255,255,255,0.06)', height: '36px' }}>
                {item.score > 0 && (
                  <span style={{ color: item.score >= 85 ? 'var(--gold)' : item.score >= 75 ? '#34D399' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: '10px' }}>
                    {item.score}/100
                  </span>
                )}
                <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{item.artist}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
                <span>{item.title}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{item.house}</span>
                {item.est && (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Est. {item.est}</span>
                  </>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="landing-hero" style={{ padding: '80px 120px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center', background: 'white' }}>
        {/* Left — static */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--electric)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '20px' }}>
            {t('landing.sectionLabel')}
          </div>

          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(38px, 4.5vw, 58px)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: '20px', whiteSpace: 'pre-line' }}>
            {t('landing.heroTitle')}
          </h1>

          <p style={{ fontSize: '16px', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '28px', maxWidth: '480px' }}>
            {t('landing.heroSub')}
          </p>

          {/* Social proof */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
            <div style={{ display: 'flex' }}>
              {['P', 'S', 'T', 'C', 'M'].map((initial, i) => (
                <div key={i} style={{ width: '28px', height: '28px', borderRadius: '50%', background: ['#0A1628', '#2D4A6E', '#C6A85A', '#1A2A44', '#4A5568'][i], border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: i > 0 ? '-8px' : 0, zIndex: 5 - i }}>
                  <span style={{ fontSize: '11px', color: 'white', fontWeight: 700, fontFamily: 'var(--font-serif)' }}>{initial}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ display: 'flex', gap: '2px', marginBottom: '2px' }}>
                {[...Array(5)].map((_, i) => <span key={i} style={{ color: '#C6A85A', fontSize: '11px' }}>★</span>)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {t('landing.trustedBy')}
              </div>
            </div>
          </div>

          <div style={{ width: '40px', height: '2px', background: '#C6A85A', marginBottom: '28px' }} />

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/app/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#4B6CF5', color: 'white', padding: '14px 28px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', transition: 'all 0.15s', boxShadow: '0 4px 14px rgba(75,108,245,0.35)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 20px rgba(75,108,245,0.45)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 14px rgba(75,108,245,0.35)'; }}
            >
              {t('landing.startFree')}
            </a>
            <a href="/app/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', color: 'var(--navy)', padding: '13px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(10,22,40,0.2)', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--navy)'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--navy-subtle)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(10,22,40,0.2)'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
            >
              {t('landing.seeLive')}
            </a>
          </div>

          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {t('landing.trialNote')}
          </div>
        </div>

        {/* Right — animated product mockup */}
        <div className="landing-hero-right" style={{ position: 'relative', animation: 'fadeIn 0.6s ease 0.3s both' }}>
          <NautilusMockup lots={topLots} />

          {/* Floating badge — top right */}
          <div style={{ position: 'absolute', top: '-16px', right: '-20px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 32px rgba(10,22,40,0.12)', textAlign: 'center', minWidth: '110px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '4px' }}>THIS WEEK</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>{(lotCount ?? dailyLots()).toLocaleString()}</div>
            <div style={{ fontSize: '9px', color: 'var(--text-3)', marginTop: '2px' }}>lots analyzed</div>
          </div>

          {/* Floating badge — bottom left */}
          <div style={{ position: 'absolute', bottom: '40px', left: '-24px', background: 'var(--navy)', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 32px rgba(10,22,40,0.25)', minWidth: '110px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '4px' }}>AVG UPSIDE</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: '#C6A85A', lineHeight: 1 }}>+34%</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>score 75+ lots</div>
          </div>
        </div>
      </section>

      {/* ── URGENCY STRIP ── */}
      <div style={{ background: 'var(--navy)', padding: '14px 0', overflow: 'hidden' }}>
        <div className="landing-urgency-strip" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', flexWrap: 'nowrap' }}>
          {[
            { icon: '⚡', text: t('landing.urgency3Lots'), highlight: true },
            { icon: '◎', text: t('landing.urgencyTracked', { count: (lotCount ?? dailyLots()).toLocaleString() }), highlight: false },
            { icon: '◈', text: t('landing.urgencyHouses'), highlight: false },
          ].map(({ icon, text, highlight }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '12px', color: highlight ? '#C6A85A' : 'rgba(255,255,255,0.4)' }}>{icon}</span>
              <span style={{ fontSize: '12px', color: highlight ? 'white' : 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontWeight: highlight ? 600 : 400 }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── METRICS ── */}
      <section style={{ padding: '32px 120px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'white' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isFr ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)' }}>
          {(isFr ? [
            { value: '1,5M+',  label: t('landing.lotsAnalyzed'),  sub: '' },
            { value: '85/100', label: t('landing.predictionAcc'), sub: '' },
            { value: '84',     label: t('landing.globalSources'), sub: '' },
          ] : [
            { value: '500K+', label: t('landing.lotsAnalyzed'),    sub: t('landing.lotsAnalyzedSub')    },
            { value: '87%',   label: t('landing.predictionAcc'),   sub: t('landing.predictionAccSub')   },
            { value: '€2.3M', label: t('landing.valueIdentified'), sub: t('landing.valueIdentifiedSub') },
            { value: '30+',   label: t('landing.globalSources'),   sub: t('landing.globalSourcesSub')   },
          ]).map(({ value, label, sub }, i) => (
            <div key={i} style={{ padding: '20px 32px', borderRight: i < (isFr ? 2 : 3) ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{value}</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontStyle: 'italic' }}>
          {t('landing.dataNote')}
        </div>
      </section>

      {/* ── FOUNDING MEMBER ── */}
      <section style={{ background: '#0A1628', padding: '80px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Grid texture */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: '560px', margin: '0 auto' }}>
          {/* Badge */}
          <div style={{ display: 'inline-block', marginBottom: '24px' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase' as const, fontFamily: 'var(--font-mono)',
              color: '#C6A85A',
              background: 'rgba(198,168,90,0.15)',
              border: '1px solid rgba(198,168,90,0.4)',
              padding: '4px 14px', borderRadius: '4px',
            }}>
              {t('landing.foundingTitle')}
            </span>
          </div>

          {/* Title */}
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 600, color: 'white', lineHeight: 1.2, margin: '0 0 16px' }}>
            {t('landing.foundingJoin')}
          </h2>

          {/* Subtitle */}
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: '0 0 36px' }}>
            {t('landing.foundingDesc')}
          </p>

          {/* Gold divider */}
          <div style={{ width: '40px', height: '2px', background: '#C6A85A', margin: '0 auto 36px' }} />

          {/* CTA */}
          <a
            href="/app/pricing"
            style={{
              display: 'inline-block',
              background: '#2563EB', color: 'white',
              padding: '14px 36px', borderRadius: '8px',
              fontSize: '14px', fontWeight: 700, textDecoration: 'none',
              letterSpacing: '0.04em', boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 28px rgba(37,99,235,0.55)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 20px rgba(37,99,235,0.4)'; }}
          >
            {t('landing.foundingCta')}
          </a>

          {/* Fine print */}
          <div style={{ marginTop: '14px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
            {t('landing.foundingLimit')}
          </div>
        </div>
      </section>

      {/* ── TODAY'S SIGNALS ── */}
      <section className="landing-signals-section" style={{ padding: '80px 120px', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
            {t('landing.signalsLabel')}
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--text)', margin: '0 0 12px' }}>
            {t('landing.signalsTitle')}
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '440px', margin: '0 auto' }}>
            {t('landing.signalsSub')}
          </p>
        </div>

        <div className="landing-signals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
          {(topLots.length > 0 ? topLots : mockArtworks).slice(0, 3).map((lot: any, i: number) => {
            const isReal = topLots.length > 0;
            const price = isReal ? (lot.current_price || lot.estimate_low || 0) : 0;
            const score = isReal ? (lot.deal_score || 0) : 75;
            const artist = isReal ? (lot.artist_name_raw || 'Unknown Artist') : (lot as any).artistName;
            const title = isReal ? (lot.title || 'Untitled') : lot.title;
            const image = isReal ? lot.image_url : (lot as any).imageUrl;
            const isLocked = i > 0; // lots 2 and 3 gated

            return (
              <div key={lot.id || i} style={{
                background: 'white', borderRadius: '12px', overflow: 'hidden',
                border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                position: 'relative',
              }}>
                {/* Blur + lock overlay for gated cards */}
                {isLocked && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 2,
                    backdropFilter: 'blur(6px)',
                    background: 'rgba(250,250,248,0.6)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '12px',
                  }}>
                    <div style={{ fontSize: '22px' }}>🔒</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', textAlign: 'center', maxWidth: '140px', lineHeight: 1.4 }}>
                      {t('landing.unlockPaid')}
                    </div>
                    <a href="/app/signup" style={{
                      background: '#4B6CF5', color: 'white', padding: '8px 18px',
                      borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                      textDecoration: 'none',
                    }}>
                      {t('landing.startFree')}
                    </a>
                  </div>
                )}

                <div style={{ height: '200px', background: 'var(--bg-subtle)', position: 'relative', overflow: 'hidden' }}>
                  {image ? (
                    <img src={image} alt="" loading="lazy" width="400" height="200" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).src = '/lot-placeholder.svg'; (e.currentTarget as HTMLImageElement).onerror = null; }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--bg-subtle), var(--border))' }} />
                  )}
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(10,22,40,0.85)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'white' }}>
                    {score > 0 ? Math.round(score) : '—'}/100
                  </div>
                </div>
                <div style={{ padding: '16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {artist}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--text)', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                      {price >= 1_000_000 ? `€${(price / 1_000_000).toFixed(1)}M` : price >= 1_000 ? `€${(price / 1_000).toFixed(0)}K` : price > 0 ? `€${price}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <a href="/app/signup" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'var(--electric)', color: 'white',
            padding: '14px 36px', borderRadius: '8px',
            fontSize: '14px', fontWeight: 700, textDecoration: 'none',
            letterSpacing: '0.04em', transition: 'opacity 0.15s',
          }}>
            {t('landing.seeLive')}
          </a>
        </div>
      </section>

      {/* ── YOUR EDGE ── */}
      <section className="landing-section" style={{ padding: '80px 120px', background: 'white' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'var(--text)', marginBottom: '48px' }}>
          {t('landing.edgeTitle')}
        </h2>
        <div className="landing-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '48px' }}>
          {[
            { titleKey: 'landing.edgeEarlyDetect', body: 'Identify undervalued works 2–4 weeks before market adjustment through pattern recognition across 10+ global sources.', metric: '24 days avg. lead time', frBody: "Repérez les œuvres sous-évaluées avant leur revalorisation, grâce à l'analyse croisée de données globales et de signaux faibles.", frMetric: '→ Entrez avant la hausse' },
            { titleKey: 'landing.edgePriceVal',     body: 'Every lot benchmarked against historical sales, artist market data, and real-time comparable transactions.',                metric: '4.2M transactions analyzed',  frBody: "Chaque lot est confronté aux ventes historiques, à la dynamique de l'artiste et à des comparables en temps réel.",                   frMetric: '→ Achetez au bon prix, systématiquement' },
            { titleKey: 'landing.edgeConviction',   body: 'Our AI assigns a 0–100 conviction score to every opportunity. Only what matters rises to the top.',                      metric: 'Score ≥ 65 = strong signal',  frBody: "Un score de conviction identifie les opportunités à fort potentiel et élimine le bruit du marché.",                                    frMetric: '→ Investissez uniquement quand le risque est maîtrisé' },
          ].map(({ titleKey, body, metric, frBody, frMetric }) => (
            <div key={titleKey}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>{t(titleKey as any)}</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '16px' }}>{isFr ? frBody : body}</p>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>{isFr ? frMetric : metric}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GATED OPPORTUNITIES ── */}
      <section className="landing-gated-section" style={{ padding: '80px 120px', background: 'var(--bg-subtle)' }}>
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
            {t('landing.gatedTitle')}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>{t('landing.gatedSub')}</p>
        </div>
        <div className="landing-gated-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
          {[
            { entry: '€52K', target: '€72K', upside: 28, score: 82 },
            { entry: '£38K', target: '£62K', upside: 42, score: 91 },
            { entry: '€64K', target: '€98K', upside: 35, score: 76 },
          ].map((opp, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', position: 'relative', cursor: 'pointer', minHeight: '200px' }} onClick={() => navigate('/app/signup')}>
              <div style={{ paddingTop: '60%', background: 'var(--bg-subtle)', filter: 'blur(8px)', opacity: 0.4 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{ padding: '4px 12px', background: 'var(--navy)', borderRadius: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>{t('landing.gatedMembersOnly')}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                  {opp.entry} → {opp.target}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--electric)', fontFamily: 'var(--font-mono)' }}>+{opp.upside}% upside · Score {opp.score}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '16px', color: 'var(--text-2)', marginBottom: '20px', fontFamily: 'var(--font-serif)' }}>
            {t('landing.gatedReserved')}
          </p>
          <button onClick={() => navigate('/app/signup')} className="btn-electric" style={{ fontSize: '13px', padding: '14px 40px' }}>
            {t('landing.gatedCta')}
          </button>
          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {t('landing.gatedNote')}
          </div>
        </div>
      </section>

      {/* ── ARTISTS IN TREND ── */}
      <section className="landing-momentum-section" style={{ padding: '80px 120px', background: '#0A1628', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '8px' }}>
            {t('landing.momentumLabel')}
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>
            {t('landing.momentumTitle')}
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '48px', fontFamily: 'var(--font-mono)' }}>
            {t('landing.momentumSub')}
          </p>
          <div className="landing-momentum-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { name: 'Georges Mathieu', movement: 'Lyrical Abstraction', growth: 18 },
              { name: 'Pierre Soulages', movement: 'Abstract Expressionism', growth: 24 },
              { name: 'Hans Hartung', movement: 'Post-War European', growth: 15 },
              { name: 'Zao Wou-Ki', movement: 'Abstract Painting', growth: 32 },
            ].map((artist, i) => (
              <div key={i} style={{ padding: '0 32px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'white', marginBottom: '6px' }}>{artist.name}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>{artist.movement}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--gold)' }}>+{artist.growth}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section style={{ padding: '96px 0', background: 'white' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '16px' }}>
              {t('landing.testiLabel')}
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '38px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px', lineHeight: 1.2 }}>
              {t('landing.testiTitle')}
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-2)', maxWidth: '480px', margin: '0 auto', lineHeight: 1.7 }}>
              {t('landing.testiSub')}
            </p>
          </div>

          {/* Featured testimonial */}
          <div style={{
            background: 'var(--navy)', borderRadius: '16px', padding: '48px 56px',
            marginBottom: '24px', position: 'relative', overflow: 'hidden',
          }}>
            {/* Quote mark */}
            <div style={{ position: 'absolute', top: '24px', left: '40px', fontSize: '120px', color: 'rgba(198,168,90,0.12)', fontFamily: 'Georgia, serif', lineHeight: 1, userSelect: 'none' }}>
              "
            </div>

            <div className="landing-featured-testimonial" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '48px', alignItems: 'center', position: 'relative' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'white', lineHeight: 1.7, marginBottom: '16px', fontStyle: 'italic' }}>
                  "I invested €12,400 in a Zao Wou-Ki lithograph that Nautilus scored 84/100 — priced 34% below its last comparable sale at Drouot. Eight months later, it sold for €17,500 at Christie's Paris. That's a 41% return on a single lot. My subscription paid for itself 200x over."
                </p>
                <div style={{ marginBottom: '20px', padding: '6px 10px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', display: 'inline-block' }}>
                  Zao Wou-Ki lithograph · Bought €12,400 · Sold €17,500
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(198,168,90,0.2)', border: '2px solid rgba(198,168,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--gold)' }}>T</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>Théodore M.</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)' }}>Family office director · €2M+ art portfolio · Paris</div>
                  </div>
                  <div style={{ marginLeft: 'auto', padding: '4px 14px', background: 'rgba(198,168,90,0.15)', border: '1px solid rgba(198,168,90,0.3)', borderRadius: '20px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>+41% in 8 months</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3-column testimonials */}
          <div className="landing-testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '56px' }}>
            {[
              {
                initial: 'N',
                name: 'Nicolas R.',
                role: 'Private wealth manager · Geneva · Investor plan',
                result: '+79% in 14 months' as string | null,
                quote: "Nautilus flagged a Joan Mitchell print at Heritage Auctions with a score of 79/100. Estimate was $8,000–12,000 but the AI analysis showed comparable prints selling at $18,000+. I bid $9,200 and won. Current market value: $16,500. Up 79% in 14 months.",
                detail: 'Joan Mitchell print · Bought $9,200 · Est. value $16,500',
              },
              {
                initial: 'M',
                name: 'Morgane L.',
                role: 'Entrepreneur · Lyon · Collector plan',
                result: '+37% in 6 months' as string | null,
                quote: "First time buying art as investment. €8,000 budget. Nautilus identified a Bernard Buffet etching at Artcurial scoring 77/100, underpriced by 28%. Bought for €3,800. Gallery offer came in at €5,200 six months later. I'm now looking at my second acquisition.",
                detail: 'Bernard Buffet etching · €3,800 → €5,200 offer',
              },
              {
                initial: 'C',
                name: 'Christian B.',
                role: 'Art fund manager · Luxembourg · Family Office plan',
                result: '40h → 4h weekly research' as string | null,
                quote: "We run a €15M art fund. Before Nautilus, our research team spent 40 hours a week screening auction catalogues. Now we spend 4. The signal accuracy on score 75+ lots has been 71% directionally correct over 18 months. That's our alpha.",
                detail: '18-month track record · Score 75+ accuracy: 71%',
              },
            ].map(({ initial, name, role, result, quote, detail }) => (
              <div key={name} style={{
                background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px',
                display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s, transform 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', gap: '3px', marginBottom: '16px' }}>
                  {[...Array(5)].map((_, i) => (
                    <span key={i} style={{ color: '#C6A85A', fontSize: '14px' }}>★</span>
                  ))}
                </div>

                <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.8, flex: 1, marginBottom: '12px', fontStyle: 'italic' }}>
                  "{quote}"
                </p>

                <div style={{ marginBottom: '16px', padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {detail}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'white' }}>{initial}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{role}</div>
                    </div>
                  </div>
                  {result && (
                    <div style={{ padding: '3px 10px', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', borderRadius: '20px', flexShrink: 0, marginLeft: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--electric)', fontFamily: 'var(--font-mono)' }}>{result}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Trust indicators */}
          <div className="landing-trust-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1px', background: 'var(--border)',
            border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden',
          }}>
            {[
              { value: '4.9/5', labelKey: 'landing.testiRating', subKey: 'landing.testiRatingSub' },
              { value: '€2.4M+', labelKey: 'landing.testiPortfolio', subKey: 'landing.testiPortfolioSub' },
              { value: '73%', labelKey: 'landing.testiAccuracy', subKey: 'landing.testiAccuracySub' },
              { value: '31%', labelKey: 'landing.testiUpside', subKey: 'landing.testiUpsideSub' },
            ].map(({ value, labelKey, subKey }) => (
              <div key={labelKey} style={{ background: 'white', padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                  {value}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>{t(labelKey as any)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{t(subKey as any)}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 8 }}>* Résultats illustratifs. Les performances passées ne préjugent pas des performances futures.</p>
        </div>
      </section>

      {/* ── URGENCY BAR ── */}
      <div style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '12px 0', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C6A85A', animation: 'pulseDot 2s infinite' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
              {t('landing.urgencyWeek', { count: weeklyStats?.segments?.reduce((a: number, s: any) => a + (s.total_lots_30d || 0), 0) || (lotCount ?? dailyLots()) })}
            </span>
          </div>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
            {t('landing.urgency12')}
          </span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
            {t('landing.urgency3Closing')}
          </span>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <section className="landing-cta-section" style={{ padding: '120px', background: 'var(--bg-subtle)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '48px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px', lineHeight: 1.2 }}>
          {t('landing.ctaTitle')}
        </h2>
        <p style={{ fontSize: '18px', color: 'var(--text-2)', maxWidth: '480px', margin: '0 auto 40px', lineHeight: 1.6 }}>
          {t('landing.ctaSub')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/app/signup')} className="btn-navy" style={{ fontSize: '14px', padding: '16px 48px' }}>
            {t('landing.ctaButton')}
          </button>
          <button onClick={() => navigate('/pricing')} className="btn-outline" style={{ fontSize: '14px', padding: '16px 32px' }}>
            {t('landing.ctaPlans')}
          </button>
        </div>
        <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          {t('landing.ctaNote')}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'var(--navy)', padding: '60px 0 0' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 40px' }}>

          {/* Top row — 4 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '48px', marginBottom: '48px' }}>

            {/* Col 1 — Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <img src="/logo-nautilus.png" alt="Nautilus" style={{ height: '32px', width: 'auto' }} />
                <span style={{ fontFamily: "-apple-system, 'Inter', 'Helvetica Neue', Arial, sans-serif", fontSize: '16px', color: 'white', letterSpacing: '-0.02em', fontWeight: 700 }}>Nautilus</span>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '14px' }}>
                {t('landing.footerMktLabel')}
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: '240px' }}>
                {t('landing.footerMktSub')}
              </p>
              <div style={{ marginTop: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
                {t('landing.footerEmail')}
              </div>
            </div>

            {/* Col 2 — Platform */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '16px' }}>
                {t('landing.footerPlatform')}
              </div>
              {[
                { label: t('nav.signalFeed'), href: '/app/explore' },
                { label: t('nav.dashboard'), href: '/app/dashboard' },
                { label: t('nav.portfolio'), href: '/app/portfolio' },
              ].map(({ label, href }) => (
                <a key={label} href={href} style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', marginBottom: '10px', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'}
                >
                  {label}
                </a>
              ))}
            </div>

            {/* Col 3 — Company */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '16px' }}>
                {t('landing.footerCompany')}
              </div>
              {[
                { label: t('landing.footerAbout'), href: '/about' },
                { label: t('landing.footerPricing'), href: '/app/pricing' },
                { label: t('landing.footerFaq'), href: '/faq' },
                { label: t('landing.footerContact'), href: '/contact' },
              ].map(({ label, href }) => (
                <a key={label} href={href} style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', marginBottom: '10px', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'}
                >
                  {label}
                </a>
              ))}
            </div>

            {/* Col 4 — Legal */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '16px' }}>
                {t('landing.footerLegal')}
              </div>
              {[
                { label: t('landing.footerPrivacy'),    href: '/legal/privacy'    },
                { label: t('landing.footerTerms'),      href: '/legal/terms'      },
                { label: t('landing.footerDisclaimer'), href: '/legal/disclaimer' },
              ].map(({ label, href }) => (
                <a key={label} href={href} style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', marginBottom: '10px', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = 'white'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
              {t('landing.footerCopyright')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
              {(['en', 'fr'] as const).map((lng, i) => (
                <>
                  {i > 0 && <span key={`fsep-${lng}`} style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>}
                  <button
                    key={lng}
                    onClick={() => { i18n.changeLanguage(lng); localStorage.setItem('i18nextLng', lng); }}
                    style={{
                      background: 'none', border: 'none', cursor: currentLang === lng ? 'default' : 'pointer',
                      fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
                      fontWeight: currentLang === lng ? 700 : 400,
                      color: currentLang === lng ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
                      textTransform: 'uppercase', padding: 0,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => { if (currentLang !== lng) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; }}
                    onMouseLeave={e => { if (currentLang !== lng) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)'; }}
                  >
                    {lng}
                  </button>
                </>
              ))}
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
              {t('landing.footerTagline')}
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
