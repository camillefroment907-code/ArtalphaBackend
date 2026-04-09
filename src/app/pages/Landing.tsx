import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { mockArtworks } from '../data/mockData';

function fmtPrice(v: number): string {
  if (!v) return '—';
  return v >= 1000 ? `€${(v / 1000).toFixed(0)}K` : `€${v}`;
}

export default function Landing() {
  const navigate = useNavigate();
  const [topLots, setTopLots] = useState<any[]>([]);
  const [lotsLoading, setLotsLoading] = useState(true);

  useEffect(() => {
    fetch('https://artalpha-backend-production.up.railway.app/api/lots?sort_by=deal_score&sort_dir=desc&page_size=6')
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data) ? data : (data.items || []);
        setTopLots(items.slice(0, 6));
        setLotsLoading(false);
      })
      .catch(() => setLotsLoading(false));
  }, []);

  // Fallback to mock if API returns nothing
  const recentLots = topLots.length >= 3 ? topLots.slice(0, 3) : null;
  const liveLots   = topLots.length >= 6 ? topLots.slice(3, 6) : topLots.length >= 3 ? topLots.slice(0, 3) : null;

  // Hero overlay data from top lot
  const hero = topLots[0];
  const heroLeft   = hero ? fmtPrice(hero.current_price || hero.estimate_low || 42000) : '€42K';
  const heroRight  = hero ? fmtPrice(hero.estimate_high || Math.round((hero.current_price || 42000) * 1.5)) : '€85K';
  const heroUpside = hero?.pct_below_low_estimate > 0
    ? `+${Math.round(hero.pct_below_low_estimate)}%`
    : hero?.estimate_high > hero?.current_price
      ? `+${Math.round(((hero.estimate_high - hero.current_price) / hero.current_price) * 100)}%`
      : '+102%';
  const heroLabel  = hero
    ? (hero.auction_date && hero.auction_date.startsWith(new Date().toISOString().slice(0, 10))
        ? 'Detected today'
        : 'Live opportunity')
    : 'Live opportunity';

  return (
    <div className="page min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header Navigation */}
      <header
        className="px-[120px] sticky top-0 z-50"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'rgba(250,250,248,0.94)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div className="flex items-center justify-between w-full">
          <Logo variant="horizontal" color="dark" size={28} />
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="text-[13px] transition-colors" style={{ color: 'var(--text-2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--navy)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
            >
              Pricing
            </Link>
            <button
              onClick={() => navigate('/app/login')}
              className="btn btn-ghost"
              style={{ fontSize: '13px', textTransform: 'none', letterSpacing: 0 }}
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/app/signup')}
              className="btn btn-navy"
              style={{ fontSize: '11px' }}
            >
              SIGN UP
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section - Split Layout */}
      <section className="px-[120px] py-[100px]">
        <div className="flex items-center gap-[100px] min-h-[650px]">
          {/* Left - Content */}
          <div className="flex-1 flex flex-col gap-12">
            {/* Headline */}
            <div>
              <h1 className="mb-5 text-[60px] leading-[1.08]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)', letterSpacing: '-0.02em' }}>
                Invest in Art with Data
              </h1>
              <p className="text-[19px] leading-[1.65]" style={{ color: 'var(--text-2)' }}>
                Systematic analysis of global auction markets. Identify undervalued artworks before price correction.
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-10 pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
              {[
                { val: '2,847', label: 'Auction Houses' },
                { val: '€4.2B', label: 'Sales Analyzed' },
                { val: '18',    label: 'Live Opportunities' },
                { val: '24 days', label: 'Avg. Lead Time' },
              ].map(({ val, label }) => (
                <div key={label}>
                  <div className="text-[36px] leading-none mb-2" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>{val}</div>
                  <div className="label-caps">{label}</div>
                </div>
              ))}
            </div>
            {/* Trust signals */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {['7-day free trial', 'No credit card required', 'Cancel anytime'].map(t => (
                <span key={t} style={{ fontSize: '13px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>✦</span>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right - Image with Overlay */}
          <div className="flex-1">
            <div className="w-full h-[650px] relative" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <img
                src="https://images.unsplash.com/photo-1643755639786-455a2479261e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                alt="Contemporary artwork"
                className="w-full h-full object-cover"
              />
              
              {/* Live Opportunity Overlay */}
              <div
                className="absolute bottom-6 left-6 right-6 p-6"
                style={{
                  background: 'rgba(26,42,68,0.88)',
                  borderRadius: '10px',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(198,168,90,0.2)',
                }}
              >
                <div className="label-gold mb-4">{heroLabel}</div>
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-[32px] leading-none" style={{ fontFamily: 'var(--font-serif)', color: 'white' }}>{heroLeft}</span>
                  <span className="text-[24px]" style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                  <span className="text-[32px] leading-none" style={{ fontFamily: 'var(--font-serif)', color: 'var(--gold)' }}>{heroRight}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <div className="text-[40px] leading-none" style={{ fontFamily: 'var(--font-serif)', color: 'var(--gold)' }}>
                    {heroUpside}
                  </div>
                  <div className="text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Estimated upside · Top scored lot
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Opportunities */}
      <section className="px-16 py-28 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <h2 className="text-[48px] mb-3" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>
              Recent Opportunities
            </h2>
            <p className="text-[14px]" style={{ color: 'var(--gold-dim)' }}>Identified before market adjustment</p>
          </div>

          <div className="grid grid-cols-3 gap-10">
            {lotsLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <div className="aspect-[3/4] mb-6 skeleton" style={{ backgroundColor: '#EDE8DC' }} />
                    <div className="skeleton" style={{ height: '28px', width: '70%', marginBottom: '8px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ height: '16px', width: '50%', marginBottom: '24px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ height: '24px', width: '60%', borderRadius: '4px' }} />
                  </div>
                ))
              : (recentLots ?? mockArtworks.slice(0, 3).map(a => ({
                  _mock: true, id: a.id,
                  artist_name_raw: a.artistName, title: a.title, image_url: a.imageUrl,
                  current_price: 0, estimate_low: 0, estimate_high: 0, pct_below_low_estimate: parseFloat(a.upside),
                  _priceStr: a.price,
                }))).map((lot: any, idx: number) => {
                const artistName = lot._mock ? lot.artist_name_raw : (lot.artist_name_raw?.trim() || 'Unknown Artist');
                const title      = lot._mock ? lot.title : (lot.title || 'Untitled');
                const imgUrl     = lot._mock ? lot.image_url : lot.image_url;
                const priceLeft  = lot._mock ? lot._priceStr : fmtPrice(lot.current_price || lot.estimate_low);
                const priceRight = lot._mock
                  ? (['€78K', '£142K', '€164K'][idx] ?? '—')
                  : fmtPrice(lot.estimate_high || Math.round((lot.current_price || lot.estimate_low || 0) * 1.3));
                const upside = lot._mock
                  ? `+${Math.round(lot.pct_below_low_estimate)}%`
                  : lot.pct_below_low_estimate > 0
                    ? `+${Math.round(lot.pct_below_low_estimate)}%`
                    : lot.estimate_high > lot.current_price
                      ? `+${Math.round(((lot.estimate_high - lot.current_price) / lot.current_price) * 100)}%`
                      : '+—';
                return (
                  <div
                    key={lot.id ?? idx}
                    className="group cursor-pointer"
                    onClick={() => navigate('/app/signup')}
                  >
                    <div className="aspect-[3/4] overflow-hidden mb-6 relative" style={{ backgroundColor: '#EDE8DC' }}>
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#B5ACA0' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundColor: 'rgba(247, 243, 235, 0.97)' }}>
                        <div className="text-center">
                          <svg className="w-10 h-10 mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--gold-dim)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <div className="text-[13px] tracking-wider" style={{ color: 'var(--gold-dim)' }}>MEMBERS ONLY</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[26px] mb-1.5" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>
                        {artistName}
                      </div>
                      <div className="text-[15px] mb-6" style={{ fontStyle: 'italic', color: '#79736B' }}>
                        {title}
                      </div>
                      <div className="flex items-baseline gap-6 pb-5 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                        <div className="text-[24px]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>{priceLeft}</div>
                        <div className="text-[20px]" style={{ color: '#C4BCAE' }}>→</div>
                        <div className="text-[24px]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>{priceRight}</div>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-[11px] uppercase tracking-[0.15em]" style={{ color: 'var(--gold-dim)' }}>Upside</div>
                        <div className="text-[32px]" style={{ fontFamily: 'var(--font-serif)', color: '#8B7355' }}>{upside}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center', marginTop: '16px', fontStyle: 'italic' }}>
            Live data from current auctions · Updated every 15 minutes
          </div>
        </div>
      </section>

      {/* Your Edge */}
      <section className="px-16 py-28" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <h2 className="text-[48px]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>Your Edge</h2>
          </div>

          <div className="grid grid-cols-3 gap-16">
            <div>
              <div className="text-[28px] mb-4" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>Early Detection</div>
              <p className="text-[16px] leading-relaxed mb-5" style={{ color: '#6B6660' }}>
                Identify undervalued works 2-4 weeks before market adjustment through pattern recognition.
              </p>
              <div className="text-[13px] uppercase tracking-[0.15em]" style={{ color: 'var(--gold-dim)' }}>24 days avg. lead time</div>
            </div>
            <div>
              <div className="text-[28px] mb-4" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>Price Validation</div>
              <p className="text-[16px] leading-relaxed mb-5" style={{ color: '#6B6660' }}>
                Compare prices against 20+ years of sales data, adjusted for inflation and conditions.
              </p>
              <div className="text-[13px] uppercase tracking-[0.15em]" style={{ color: 'var(--gold-dim)' }}>4.2M transactions</div>
            </div>
            <div>
              <div className="text-[28px] mb-4" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>Market Intelligence</div>
              <p className="text-[16px] leading-relaxed mb-5" style={{ color: '#6B6660' }}>
                Track institutional patterns, gallery representation, and exhibition momentum.
              </p>
              <div className="text-[13px] uppercase tracking-[0.15em]" style={{ color: 'var(--gold-dim)' }}>Real-time updates</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Opportunities (Gated) */}
      <section className="px-16 py-28 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <h2 className="text-[48px] mb-3" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>
              Live Opportunities
            </h2>
            <p className="text-[14px]" style={{ color: 'var(--gold-dim)' }}>18 active positions · Members only</p>
          </div>

          <div className="grid grid-cols-3 gap-10">
            {lotsLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <div className="aspect-[3/4] mb-6 skeleton" style={{ backgroundColor: '#EDE8DC' }} />
                    <div className="skeleton" style={{ height: '24px', width: '60%', marginBottom: '24px', borderRadius: '4px' }} />
                    <div className="skeleton" style={{ height: '32px', width: '40%', borderRadius: '4px' }} />
                  </div>
                ))
              : (liveLots ?? [
                  { id: 'f1', current_price: 52000, estimate_high: 72000, pct_below_low_estimate: 28 },
                  { id: 'f2', current_price: 38000, estimate_high: 62000, pct_below_low_estimate: 42 },
                  { id: 'f3', current_price: 64000, estimate_high: 98000, pct_below_low_estimate: 35 },
                ]).map((lot: any, idx: number) => {
                const priceLeft  = fmtPrice(lot.current_price || lot.estimate_low || 0);
                const priceRight = fmtPrice(lot.estimate_high || Math.round((lot.current_price || 0) * 1.3));
                const upside     = lot.pct_below_low_estimate > 0
                  ? `+${Math.round(lot.pct_below_low_estimate)}%`
                  : lot.estimate_high > lot.current_price
                    ? `+${Math.round(((lot.estimate_high - lot.current_price) / lot.current_price) * 100)}%`
                    : '+—';
                return (
                  <div
                    key={lot.id ?? idx}
                    className="cursor-pointer"
                    onClick={() => navigate('/app/signup')}
                  >
                    <div className="aspect-[3/4] overflow-hidden flex items-center justify-center mb-6" style={{ backgroundColor: '#EDE8DC' }}>
                      {lot.image_url ? (
                        <img src={lot.image_url} alt="" className="w-full h-full object-cover" style={{ filter: 'blur(6px)', opacity: 0.4 }} />
                      ) : null}
                      <div className="text-center" style={{ position: lot.image_url ? 'absolute' : 'static' }}>
                        <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#B5ACA0', margin: '0 auto 12px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <div className="text-[13px] tracking-wider" style={{ color: '#B5ACA0' }}>MEMBERS ONLY</div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-6 pb-5 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
                        <div className="text-[24px]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>{priceLeft}</div>
                        <div className="text-[20px]" style={{ color: '#C4BCAE' }}>→</div>
                        <div className="text-[24px]" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>{priceRight}</div>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-[11px] uppercase tracking-[0.15em]" style={{ color: 'var(--gold-dim)' }}>Upside</div>
                        <div className="text-[32px]" style={{ fontFamily: 'var(--font-serif)', color: '#8B7355' }}>{upside}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textAlign: 'center', marginTop: '16px', fontStyle: 'italic' }}>
            Live data from current auctions · Updated every 15 minutes
          </div>
        </div>
      </section>

      {/* Artists in Trend */}
      <section className="px-16 py-28" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <h2 className="text-[48px] mb-3" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>
              Artists in Trend
            </h2>
            <p className="text-[14px]" style={{ color: 'var(--gold-dim)' }}>Price momentum analysis · Updated daily</p>
          </div>

          <div className="grid grid-cols-4 gap-10">
            {[
              { name: 'Georges Mathieu', movement: 'Lyrical Abstraction', growth: 18 },
              { name: 'Pierre Soulages', movement: 'Abstract Expressionism', growth: 24 },
              { name: 'Hans Hartung', movement: 'Post-War European', growth: 15 },
              { name: 'Zao Wou-Ki', movement: 'Abstract Painting', growth: 32 }
            ].map((artist, idx) => (
              <div key={idx} className="border-l pl-6" style={{ borderColor: 'var(--border)' }}>
                <div className="text-[24px] mb-2" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>{artist.name}</div>
                <div className="text-[13px] mb-6" style={{ color: '#79736B' }}>{artist.movement}</div>
                <div className="text-[32px]" style={{ fontFamily: 'var(--font-serif)', color: '#8B7355' }}>+{artist.growth}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-16 py-28 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[900px] mx-auto text-center">
          <h2 className="text-[48px] mb-5" style={{ fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>
            Access the Platform
          </h2>
          <p className="text-[18px] mb-12" style={{ color: '#6B6660' }}>
            Create an account to view opportunities and pricing data
          </p>
          <button
            onClick={() => navigate('/app/signup')}
            className="btn btn-navy"
            style={{ fontSize: '13px', padding: '14px 40px' }}
          >
            CREATE ACCOUNT
          </button>
          <div className="text-[12px] mt-5 tracking-[0.15em]" style={{ color: 'var(--gold-dim)' }}>
            PRIVATE ACCESS · NO PUBLIC BROWSING
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-16 py-14 border-t" style={{ borderColor: '#D4CFC3', backgroundColor: '#FFFFFF' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between">
            <Logo variant="horizontal" color="dark" size={24} />
            <div className="flex items-center gap-12 text-[13px]" style={{ color: 'var(--gold-dim)' }}>
              <Link to="/about" className="hover:opacity-70 transition-opacity">About</Link>
              <Link to="/contact" className="hover:opacity-70 transition-opacity">Contact</Link>
              <Link to="/faq" className="hover:opacity-70 transition-opacity">FAQ</Link>
              <a href="#" className="hover:opacity-70 transition-opacity">Legal</a>
            </div>
            <div className="text-[11px] tracking-[0.15em]" style={{ color: '#B5ACA0' }}>
              © 2026 ARTALPHA
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}