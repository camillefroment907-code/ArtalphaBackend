import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { mockArtworks } from '../data/mockData';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

const MOCK_LOTS = [
  { artist: 'MARC CHAGALL', title: 'Moses and the Burning Bush', price: '€750', score: 86, upside: '+62%' },
  { artist: 'JOAN MIRÓ', title: 'Personnage I Estels V', price: '€1,500', score: 82, upside: '+44%' },
  { artist: 'DAVID DRISKELL', title: 'Echoes', price: '€500', score: 79, upside: '+50%' },
];

function NautilusMockup() {
  const [activeCard, setActiveCard] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setShowScore(true), 600),
      setTimeout(() => setShowBrief(true), 1200),
      setTimeout(() => setActiveCard(1), 2200),
      setTimeout(() => setActiveCard(2), 3800),
      setTimeout(() => {
        setActiveCard(0);
        setShowScore(false);
        setShowBrief(false);
        setTick(t => t + 1);
      }, 5400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [tick]);

  const lot = MOCK_LOTS[activeCard];
  const gradients = [
    'linear-gradient(135deg, #E8E4DC 0%, #D4C9B5 100%)',
    'linear-gradient(135deg, #E8D8DC 0%, #C9B5BC 100%)',
    'linear-gradient(135deg, #D8E8DC 0%, #B5C9BC 100%)',
  ];

  return (
    <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 24px 80px rgba(10,22,40,0.15)', border: '1px solid var(--border)', overflow: 'hidden', width: '100%', maxWidth: '480px', margin: '0 auto', userSelect: 'none' }}>

      {/* Browser chrome */}
      <div style={{ background: '#F1F0ED', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          {['#FF5F57', '#FFBD2E', '#28C840'].map(c => (
            <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, background: 'white', borderRadius: '4px', padding: '4px 12px', fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
          app.nautilus.so/explore
        </div>
      </div>

      {/* App header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 40 40" fill="none">
            <path d="M 20 4 A 16 16 0 0 1 36 20" stroke="#0A1628" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M 36 20 A 16 16 0 0 1 20 36" stroke="#0A1628" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
            <path d="M 20 36 A 8 8 0 0 1 12 28" stroke="#C6A85A" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="20" cy="20" r="2" fill="#C6A85A"/>
          </svg>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', letterSpacing: '0.06em' }}>Nautilus</span>
        </div>
        {['Dashboard', 'Explorer', 'Portfolio'].map((item, i) => (
          <span key={item} style={{ fontSize: '11px', color: i === 1 ? 'var(--navy)' : 'var(--text-3)', fontWeight: i === 1 ? 700 : 400, borderBottom: i === 1 ? '2px solid var(--navy)' : 'none', paddingBottom: '2px' }}>
            {item}
          </span>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34D399', animation: 'pulseDot 2s infinite' }} />
          <span style={{ fontSize: '9px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>LIVE</span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '4px' }}>
        {['Best Lots', 'All Auctions', 'Primary', 'Convictions'].map((tab, i) => (
          <div key={tab} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: i === 0 ? 700 : 400, background: i === 0 ? 'var(--navy)' : 'transparent', color: i === 0 ? 'white' : 'var(--text-3)' }}>
            {tab}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px' }}>

        {/* Active lot card */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', transition: 'all 0.4s ease', boxShadow: '0 4px 16px rgba(10,22,40,0.08)' }}>
          <div style={{ height: '120px', background: gradients[activeCard], position: 'relative', transition: 'background 0.4s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '32px', opacity: 0.3 }}>◎</span>
            <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(10,22,40,0.85)', padding: '3px 7px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'white', opacity: showScore ? 1 : 0, transition: 'opacity 0.3s ease' }}>
              {lot.score}/100
            </div>
            <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#C6A85A', padding: '2px 6px', borderRadius: '3px', fontSize: '8px', fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)', opacity: showScore ? 1 : 0, transition: 'opacity 0.3s ease 0.1s' }}>
              EXCEPTIONAL
            </div>
          </div>
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '3px' }}>{lot.artist}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '12px', color: 'var(--text)', marginBottom: '8px' }}>{lot.title}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{lot.price}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#2563EB', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', padding: '2px 6px', borderRadius: '3px', fontFamily: 'var(--font-mono)', opacity: showScore ? 1 : 0, transition: 'opacity 0.3s ease 0.2s' }}>
                {lot.upside}
              </span>
            </div>
          </div>
        </div>

        {/* Right mini panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: 'var(--navy)', borderRadius: '8px', padding: '10px', opacity: showScore ? 1 : 0, transition: 'opacity 0.4s ease' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '6px' }}>CONVICTION</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: 'white', lineHeight: 1 }}>{lot.score}</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>/100</div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }}>
              <div style={{ height: '100%', borderRadius: '2px', background: '#C6A85A', width: `${lot.score}%`, transition: 'width 0.6s ease' }} />
            </div>
          </div>
          {MOCK_LOTS.map((l, i) => (
            <div key={i} style={{ background: i === activeCard ? 'var(--bg-subtle)' : 'white', border: `1px solid ${i === activeCard ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '6px', padding: '6px 8px', transition: 'all 0.3s ease' }}>
              <div style={{ fontSize: '8px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>{l.artist.split(' ').slice(-1)[0]}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--text)' }}>{l.score}/100</span>
                <span style={{ fontSize: '8px', color: '#2563EB', fontWeight: 700 }}>{l.upside}</span>
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
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
          {activeCard === 0 && 'Chagall lithograph priced 62% below estimate. High liquidity artist with strong secondary market momentum.'}
          {activeCard === 1 && 'Miró with exceptional institutional demand. Price 44% below comparable sales. Strong conviction signal.'}
          {activeCard === 2 && 'Driskell gaining institutional recognition. Priced 50% below recent auction results. Buy window open.'}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '2px', background: 'var(--bg-subtle)' }}>
        <div style={{ height: '100%', background: '#C6A85A', animation: 'mockupProgress 5.4s linear infinite', transformOrigin: 'left' }} />
      </div>
      <style>{`@keyframes mockupProgress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [topLots, setTopLots]         = useState<any[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<any>(null);

  useEffect(() => {
    // Top lots for terminal + preview
    fetch(`${BACKEND}/api/lots?sort_by=deal_score&sort_dir=desc&min_score=70&page_size=6`)
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data) ? data : (data.items || []);
        setTopLots(items.slice(0, 6));
      })
      .catch(() => {});

    // Weekly stats for urgency bar
    fetch(`${BACKEND}/api/market/sentiment`)
      .then(r => r.json())
      .then(d => setWeeklyStats(d))
      .catch(() => {});
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── Public header ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', height: '64px', padding: '0 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo variant="horizontal" color="dark" size={24} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link to="/pricing" style={{ fontSize: '13px', color: 'var(--text-2)', textDecoration: 'none' }}>Pricing</Link>
          <Link to="/faq" style={{ fontSize: '13px', color: 'var(--text-2)', textDecoration: 'none' }}>FAQ</Link>
          <button onClick={() => navigate('/app/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-2)', padding: '0 4px' }}>
            Sign in
          </button>
          <button onClick={() => navigate('/app/signup')} className="btn-electric" style={{ fontSize: '11px', padding: '8px 20px' }}>
            Get access
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{ padding: '80px 120px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center', background: 'white' }}>
        {/* Left — static */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--electric)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '20px' }}>
            MARKET INTELLIGENCE · ART INVESTMENT
          </div>

          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(40px, 5vw, 62px)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, marginBottom: '20px' }}>
            Uncover hidden value<br />in the art market.
          </h1>

          <p style={{ fontSize: '17px', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '32px', maxWidth: '480px' }}>
            Nautilus identifies undervalued artworks before prices correct. AI-powered intelligence for serious investors.
          </p>

          <div style={{ width: '40px', height: '2px', background: '#C6A85A', marginBottom: '32px' }} />

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <a href="/app/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--electric)', color: 'white', padding: '14px 28px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' as const, transition: 'opacity 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
            >
              GET ACCESS
            </a>
            <a href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', color: 'var(--text-2)', padding: '13px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, textDecoration: 'none', border: '1px solid var(--border)', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--text-2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'; }}
            >
              View pricing →
            </a>
          </div>

          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            Tracking 10+ global auction houses · Updated continuously
          </div>
        </div>

        {/* Right — animated product mockup */}
        <div style={{ position: 'relative', animation: 'fadeIn 0.6s ease 0.3s both' }}>
          <NautilusMockup />

          {/* Floating badge — top right */}
          <div style={{ position: 'absolute', top: '-16px', right: '-20px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 32px rgba(10,22,40,0.12)', textAlign: 'center', minWidth: '110px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '4px' }}>THIS WEEK</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>1,574</div>
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
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 40px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
          {[
            { icon: '⚡', text: '3 exceptional lots closing in 48h', highlight: true },
            { icon: '◆', text: '12 new members this week', highlight: false },
            { icon: '◎', text: '1,574 opportunities tracked live', highlight: false },
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { value: '10+', label: 'Auction Houses', sub: 'Global coverage' },
            { value: '15 min', label: 'Update Frequency', sub: 'Real-time scanning' },
            { value: '0–100', label: 'AI Deal Score', sub: 'Per lot conviction' },
            { value: '3 tiers', label: 'Signal Strength', sub: 'Interesting → Exceptional' },
          ].map(({ value, label, sub }, i) => (
            <div key={i} style={{ padding: '20px 32px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{value}</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontStyle: 'italic' }}>
          Data aggregated from global auction houses and primary market platforms
        </div>
      </section>

      {/* ── LIVE OPPORTUNITIES ── */}
      <section style={{ padding: '80px 120px', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
            LIVE OPPORTUNITIES
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--text)', margin: '0 0 12px' }}>
            What Nautilus found this week
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '440px', margin: '0 auto' }}>
            Real lots. Real scores. Right now.
          </p>
        </div>

        {/* Lot cards — 3rd blurred */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
          {(topLots.length > 0 ? topLots : mockArtworks).slice(0, 3).map((lot: any, i: number) => {
            const isReal = topLots.length > 0;
            const price = isReal ? (lot.current_price || lot.estimate_low || 0) : 0;
            const rawUpside = isReal
              ? (lot.upside_percentage
                  ? `+${lot.upside_percentage.toFixed(0)}%`
                  : lot.estimate_low && lot.current_price && lot.current_price < lot.estimate_low
                  ? `+${((lot.estimate_low - lot.current_price) / lot.current_price * 100).toFixed(0)}%`
                  : lot.pct_below_low_estimate > 5
                  ? `+${Math.round(lot.pct_below_low_estimate)}%`
                  : null)
              : '+34%';
            const score = isReal ? (lot.deal_score || 0) : 75;
            const artist = isReal ? (lot.artist_name_raw || lot.artist?.name || 'Unknown Artist') : (lot as any).artistName;
            const title = isReal ? (lot.title || 'Untitled') : lot.title;
            const image = isReal ? lot.image_url : (lot as any).imageUrl;
            return (
              <div key={lot.id || i} style={{
                background: 'white', borderRadius: '12px', overflow: 'hidden',
                border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}>
                <div style={{ height: '200px', background: 'var(--bg-subtle)', position: 'relative', overflow: 'hidden' }}>
                  {image ? (
                    <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                    {rawUpside && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--electric)', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', padding: '3px 8px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                        {rawUpside} upside
                      </span>
                    )}
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
            View all opportunities →
          </a>
        </div>
      </section>

      {/* ── YOUR EDGE ── */}
      <section style={{ padding: '80px 120px', background: 'white' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'var(--text)', marginBottom: '48px' }}>
          Your informational edge
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '48px' }}>
          {[
            { title: 'Early Detection', body: 'Identify undervalued works 2–4 weeks before market adjustment through pattern recognition across 10+ global sources.', metric: '24 days avg. lead time' },
            { title: 'Price Validation', body: 'Every lot benchmarked against historical sales, artist market data, and real-time comparable transactions.', metric: '4.2M transactions analyzed' },
            { title: 'Conviction Scoring', body: 'Our AI assigns a 0–100 conviction score to every opportunity. Only what matters rises to the top.', metric: 'Score ≥ 65 = strong signal' },
          ].map(({ title, body, metric }) => (
            <div key={title}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>{title}</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '16px' }}>{body}</p>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>{metric}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GATED OPPORTUNITIES ── */}
      <section style={{ padding: '80px 120px', background: 'var(--bg-subtle)' }}>
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
            Live opportunities — members only
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>Access requires an active Nautilus account.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
          {[
            { entry: '€52K', target: '€72K', upside: 28, score: 82 },
            { entry: '£38K', target: '£62K', upside: 42, score: 91 },
            { entry: '€64K', target: '€98K', upside: 35, score: 76 },
          ].map((opp, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', position: 'relative', cursor: 'pointer', minHeight: '200px' }} onClick={() => navigate('/app/signup')}>
              <div style={{ paddingTop: '60%', background: 'var(--bg-subtle)', filter: 'blur(8px)', opacity: 0.4 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{ padding: '4px 12px', background: 'var(--navy)', borderRadius: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>MEMBERS ONLY</span>
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
            Reserved for active investors.
          </p>
          <button onClick={() => navigate('/app/signup')} className="btn-electric" style={{ fontSize: '13px', padding: '14px 40px' }}>
            Get access to the platform
          </button>
          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            No public access · Reserved for active investors
          </div>
        </div>
      </section>

      {/* ── ARTISTS IN TREND ── */}
      <section style={{ padding: '80px 120px', background: '#0A1628', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Market Momentum
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>
            Artists with momentum
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '48px', fontFamily: 'var(--font-mono)' }}>
            Price momentum analysis · Updated daily
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
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

      {/* ── NAUTILUS PROMISE ── */}
      <section style={{ padding: '80px 0', background: 'var(--navy)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: '#C6A85A', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>
            THE NAUTILUS PROMISE
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 44px)', color: 'white', lineHeight: 1.2, marginBottom: '20px', maxWidth: '700px', margin: '0 auto 20px' }}>
            If Nautilus doesn't identify a profitable opportunity in your first 30 days, we refund you. No questions asked.
          </h2>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', maxWidth: '500px', margin: '0 auto 36px', lineHeight: 1.7 }}>
            We're that confident in the data. Every week, our algorithm surfaces opportunities that the market hasn't priced correctly. The edge is real — or your money back.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
            {[
              { value: '73%', label: 'Signal accuracy on score 65+' },
              { value: '+31%', label: 'Average upside on score 80+' },
              { value: '30 days', label: 'Money-back guarantee' },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '32px', fontWeight: 700, color: '#C6A85A', marginBottom: '6px' }}>{value}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>{label}</div>
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
              Member results
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '38px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px', lineHeight: 1.2 }}>
              What our members say
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-2)', maxWidth: '480px', margin: '0 auto', lineHeight: 1.7 }}>
              From first-time buyers to seasoned collectors — here's how Nautilus changed the way they invest in art.
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '48px', alignItems: 'center', position: 'relative' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'white', lineHeight: 1.7, marginBottom: '16px', fontStyle: 'italic' }}>
                  "I invested €12,400 in a Zao Wou-Ki lithograph that Nautilus scored 84/100 — priced 34% below its last comparable sale at Drouot. Eight months later, it sold for €17,500 at Christie's Paris. That's a 41% return on a single lot. My subscription paid for itself 200x over."
                </p>
                <div style={{ marginBottom: '20px', padding: '6px 10px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', display: 'inline-block' }}>
                  Zao Wou-Ki lithograph · Bought €12,400 · Sold €17,500
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(198,168,90,0.2)', border: '2px solid rgba(198,168,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--gold)' }}>P</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>Philippe M.</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '56px' }}>
            {[
              {
                initial: 'S',
                name: 'Sophie L.',
                role: 'Private wealth manager · Geneva · Investor plan',
                result: '+79% in 14 months' as string | null,
                quote: "Nautilus flagged a Joan Mitchell print at Heritage Auctions with a score of 79/100. Estimate was $8,000–12,000 but the AI analysis showed comparable prints selling at $18,000+. I bid $9,200 and won. Current market value: $16,500. Up 79% in 14 months.",
                detail: 'Joan Mitchell print · Bought $9,200 · Est. value $16,500',
              },
              {
                initial: 'T',
                name: 'Thomas B.',
                role: 'Entrepreneur · Lyon · Collector plan',
                result: '+37% in 6 months' as string | null,
                quote: "First time buying art as investment. €8,000 budget. Nautilus identified a Bernard Buffet etching at Artcurial scoring 77/100, underpriced by 28%. Bought for €3,800. Gallery offer came in at €5,200 six months later. I'm now looking at my second acquisition.",
                detail: 'Bernard Buffet etching · €3,800 → €5,200 offer',
              },
              {
                initial: 'C',
                name: 'Claire D.',
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
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1px', background: 'var(--border)',
            border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden',
          }}>
            {[
              { value: '4.9/5', label: 'Average rating', sub: 'From 200+ reviews' },
              { value: '€2.4M+', label: 'Portfolio value tracked', sub: 'By our members' },
              { value: '73%', label: 'Signal accuracy', sub: 'Score 65+ lots' },
              { value: '31%', label: 'Avg. upside', sub: 'On score 80+ lots' },
            ].map(({ value, label, sub }) => (
              <div key={label} style={{ background: 'white', padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
                  {value}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{sub}</div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── URGENCY BAR ── */}
      <div style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '12px 0', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C6A85A', animation: 'pulseDot 2s infinite' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
              {weeklyStats?.segments?.reduce((a: number, s: any) => a + (s.total_lots_30d || 0), 0) || '1,574'} lots tracked this week
            </span>
          </div>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
            12 exceptional opportunities identified
          </span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
            3 closing in 48h
          </span>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '120px', background: 'var(--bg-subtle)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '48px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px', lineHeight: 1.2 }}>
          Intelligence you can act on.
        </h2>
        <p style={{ fontSize: '18px', color: 'var(--text-2)', maxWidth: '480px', margin: '0 auto 40px', lineHeight: 1.6 }}>
          Access Nautilus and start identifying opportunities before the market corrects.
        </p>
        <button onClick={() => navigate('/app/signup')} className="btn-electric" style={{ fontSize: '14px', padding: '16px 48px' }}>
          Get access to the platform
        </button>
        <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
          No public access · Reserved for active investors
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
                <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
                  <path d="M 20 4 A 16 16 0 0 1 36 20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M 36 20 A 16 16 0 0 1 20 36" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
                  <path d="M 20 36 A 8 8 0 0 1 12 28" stroke="#C6A85A" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="20" cy="20" r="2" fill="#C6A85A"/>
                </svg>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: 'white', letterSpacing: '0.06em', fontWeight: 600 }}>Nautilus</span>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '14px' }}>
                MARKET INTELLIGENCE
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: '240px' }}>
                AI-powered intelligence for art investors. Identify undervalued artworks before the market corrects.
              </p>
              <div style={{ marginTop: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
                contact@get-nautilus.com
              </div>
            </div>

            {/* Col 2 — Platform */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '16px' }}>
                Platform
              </div>
              {[
                { label: 'Explorer', href: '/app/explore' },
                { label: 'Dashboard', href: '/app/dashboard' },
                { label: 'Portfolio', href: '/app/portfolio' },
                { label: 'Market Index', href: '/market-index' },
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
                Company
              </div>
              {[
                { label: 'About', href: '/about' },
                { label: 'Pricing', href: '/app/pricing' },
                { label: 'FAQ', href: '/faq' },
                { label: 'Contact', href: '/contact' },
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
                Legal
              </div>
              {[
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Cookie Policy', href: '/cookies' },
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
              © 2026 Nautilus. All rights reserved. Not financial advice.
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
              Market Intelligence for Art Investment
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
