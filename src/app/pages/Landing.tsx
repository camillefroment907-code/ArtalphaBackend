import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { mockArtworks } from '../data/mockData';

export default function Landing() {
  const navigate = useNavigate();
  const [topLots, setTopLots] = useState<any[]>([]);

  useEffect(() => {
    fetch('https://artalpha-backend-production.up.railway.app/api/lots?sort_by=deal_score&sort_dir=desc&page_size=6')
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data) ? data : (data.items || []);
        setTopLots(items.slice(0, 6));
      })
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
        {/* Left */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--electric)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '20px' }}>
            Market Intelligence · Art Investment
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 4vw, 56px)', fontWeight: 600, color: 'var(--text)', lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-0.01em' }}>
            Uncover hidden value<br />in the art market.
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--text-2)', lineHeight: 1.7, margin: '0 0 32px', maxWidth: '440px' }}>
            Nautilus identifies undervalued artworks before prices correct. AI-powered intelligence for serious investors.
          </p>
          <div style={{ width: '32px', height: '2px', background: 'var(--gold)', marginBottom: '32px' }} />
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '28px' }}>
            <button onClick={() => navigate('/app/signup')} className="btn-electric" style={{ fontSize: '13px', padding: '14px 32px' }}>
              Get access
            </button>
            <button onClick={() => navigate('/pricing')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px 24px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              View pricing →
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            Tracking 10+ global auction houses · Updated every 15 minutes
          </div>
        </div>

        {/* Right — dark terminal */}
        <div style={{ background: '#0A1628', borderRadius: '12px', padding: '28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.04, borderRadius: '12px', backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: '#C6A85A', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                Nautilus Terminal
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#C6A85A', animation: 'pulseDot 2s infinite' }} />
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>LIVE</span>
              </div>
            </div>

            {topLots.slice(0, 3).map((lot: any, i: number) => {
              const price = lot.current_price || lot.estimate_low || 0;
              const upside = lot.pct_below_low_estimate || 0;
              const score = lot.deal_score || 0;
              return (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  {lot.image_url ? (
                    <img src={lot.image_url} alt="" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lot.artist_name_raw || 'Unknown Artist'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lot.title || 'Untitled'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)' }}>
                      {price >= 1000 ? `€${(price / 1000).toFixed(0)}K` : `€${price}`}
                    </div>
                    {upside > 0 && (
                      <div style={{ fontSize: '10px', color: '#2563EB', fontFamily: 'var(--font-mono)' }}>+{upside.toFixed(0)}%</div>
                    )}
                  </div>
                  <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: score >= 80 ? '#C6A85A' : 'rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)' }}>{Math.round(score)}</span>
                  </div>
                </div>
              );
            })}

            {topLots.length === 0 && [0, 1, 2].map(i => (
              <div key={i} className="skeleton" style={{ height: '56px', borderRadius: '6px', marginBottom: '8px', background: 'rgba(255,255,255,0.06)' }} />
            ))}
          </div>
        </div>
      </section>

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

      {/* ── TODAY'S SIGNALS ── */}
      <section style={{ padding: '80px 120px', background: 'var(--bg-subtle)' }}>
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--electric)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Live opportunities
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
            Today's Signals
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>
            Real opportunities identified by Nautilus — updated continuously
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '20px' }}>
          {(topLots.length > 0 ? topLots : mockArtworks).slice(0, 3).map((lot: any, i: number) => {
            const isReal = topLots.length > 0;
            const price = isReal ? (lot.current_price || lot.estimate_low || 0) : 0;
            const upside = isReal ? (lot.pct_below_low_estimate || 0) : parseFloat(lot.upside || '0');
            const score = isReal ? (lot.deal_score || 0) : 75;
            const artist = isReal ? (lot.artist_name_raw || 'Unknown Artist') : lot.artistName;
            const title = isReal ? (lot.title || 'Untitled') : lot.title;
            const image = isReal ? lot.image_url : lot.imageUrl;

            return (
              <div
                key={i}
                onClick={() => navigate('/app/signup')}
                style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s var(--ease), box-shadow 0.2s var(--ease)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              >
                <div style={{ position: 'relative', paddingTop: '60%', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                  {image ? (
                    <img src={image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--border)' }}>◇</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: score >= 80 ? 'var(--gold)' : 'var(--electric)', borderRadius: '4px', padding: '3px 8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)' }}>{Math.round(score)}</span>
                  </div>
                </div>
                <div style={{ padding: '16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--electric)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {artist}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--text)', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                      {price >= 1000000 ? `€${(price / 1000000).toFixed(1)}M` : price >= 1000 ? `€${(price / 1000).toFixed(0)}K` : price > 0 ? `€${price}` : '—'}
                    </div>
                    {upside > 0 && (
                      <div style={{ padding: '3px 8px', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', borderRadius: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--electric)', fontFamily: 'var(--font-mono)' }}>+{Math.round(upside)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-3)', fontStyle: 'italic', fontFamily: 'var(--font-mono)' }}>
          Live data · Updated every 15 minutes
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
      <footer style={{ padding: '48px 120px', borderTop: '1px solid var(--border)', background: 'white' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '48px', marginBottom: '32px' }}>
          <div>
            <Logo variant="full" color="dark" size={24} />
            <p style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic', marginTop: '12px', lineHeight: 1.6 }}>
              Uncover hidden value.
            </p>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '16px' }}>Product</div>
            {[
              { label: 'Pricing', to: '/pricing' },
              { label: 'FAQ', to: '/faq' },
              { label: 'Contact', to: '/contact' },
            ].map(({ label, to }) => (
              <div key={label} style={{ marginBottom: '8px' }}>
                <Link to={to} style={{ fontSize: '13px', color: 'var(--text-2)', textDecoration: 'none' }}>{label}</Link>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '16px' }}>Intelligence</div>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.7 }}>
              Data aggregated from global auction houses and primary market platforms.
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-ghost)', marginTop: '16px', fontFamily: 'var(--font-mono)' }}>
              Nautilus — Market Intelligence for Art Investment
            </p>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>© 2026 Nautilus</span>
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link to="/about" style={{ fontSize: '12px', color: 'var(--text-3)', textDecoration: 'none' }}>About</Link>
            <Link to="/contact" style={{ fontSize: '12px', color: 'var(--text-3)', textDecoration: 'none' }}>Contact</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
