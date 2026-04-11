import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getPlanLimits } from '../../lib/auth';
import { AIAnalyst } from '../components/AIAnalyst';

// ── UTILS ─────────────────────────────────────────────────────────────────────

function fmt(v?: number | null): string {
  if (!v) return '—';
  return v >= 1_000_000
    ? `€${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
    ? `€${(v / 1_000).toFixed(0)}K`
    : `€${v.toLocaleString('fr-FR')}`;
}

// ── SCORE BAR ─────────────────────────────────────────────────────────────────

function ScoreBar({ score, isUpcoming = false }: { score: number; isUpcoming?: boolean }) {
  const tier = isUpcoming && score >= 65
    ? 'WATCH'
    : score >= 80 ? 'EXCEPTIONAL'
    : score >= 65 ? 'STRONG'
    : score >= 45 ? 'INTERESTING'
    : 'LOW';
  const tierColor = isUpcoming && score >= 65
    ? 'var(--text-2)'
    : score >= 80 ? 'var(--gold)'
    : score >= 65 ? 'var(--electric)'
    : 'var(--text-3)';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.16em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Deal Score</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', fontWeight: 700, color: tierColor, textTransform: 'uppercase' }}>
          {tier}
        </span>
      </div>
      <div style={{ height: '3px', background: 'var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${score}%`,
          background: 'linear-gradient(to right, var(--navy), var(--gold))',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{score}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', alignSelf: 'flex-end' }}>/100</span>
      </div>
    </div>
  );
}

// ── LOCKED BLOCK ──────────────────────────────────────────────────────────────

function LockedBlock({ title, teaser, ctaText, ctaPrice, planId, preview }: {
  title: string; teaser: string; ctaText: string; ctaPrice: string;
  planId: string; preview?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div style={{ position: 'relative', border: '2px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ filter: 'blur(4px)', pointerEvents: 'none', opacity: 0.45, padding: '24px', userSelect: 'none' }}>
        {preview || (
          <div style={{ display: 'flex', gap: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, height: '72px', background: 'var(--bg-subtle)' }} />
            ))}
          </div>
        )}
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(250,250,248,0.1) 0%, rgba(250,250,248,0.94) 35%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px', textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>{title}</div>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px', maxWidth: '360px', lineHeight: 1.65 }}>{teaser}</p>
        <button
          onClick={() => navigate(`/app/pricing?plan=${planId}`)}
          style={{ padding: '11px 28px', background: 'var(--navy)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {ctaText}
        </button>
        <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>{ctaPrice} · 7-day free trial</div>
      </div>
    </div>
  );
}

// ── METRIC TILE ───────────────────────────────────────────────────────────────

function MetricTile({ label, value, sub, highlight = false }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '20px',
      background: highlight ? 'var(--navy)' : 'var(--bg-card)',
      border: `2px solid ${highlight ? 'var(--navy)' : 'var(--border)'}`,
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: highlight ? 'rgba(255,255,255,0.5)' : 'var(--text-3)', marginBottom: '10px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: highlight ? 'white' : 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', marginTop: '6px', color: highlight ? 'rgba(255,255,255,0.4)' : 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}

// ── SIGNAL ROW ────────────────────────────────────────────────────────────────

function SignalRow({ label, level }: { label: string; level: 1 | 2 | 3 }) {
  // 3 = positive (navy dots), 2 = neutral (text-2), 1 = warning (gold-dim)
  const dotColor = level === 3 ? 'var(--navy)' : level === 2 ? 'var(--text-2)' : 'var(--gold-dim)';
  const labelText = level === 3
    ? label === 'Demand' ? 'HIGH' : label === 'Liquidity' ? 'LIQUID' : 'RISING'
    : level === 2
    ? label === 'Demand' ? 'MODERATE' : label === 'Liquidity' ? 'AVERAGE' : 'STABLE'
    : label === 'Demand' ? 'LOW' : label === 'Liquidity' ? 'ILLIQUID' : 'DECLINING';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '3px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ width: '8px', height: '8px', background: i <= level ? dotColor : 'var(--border)' }} />
          ))}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: dotColor }}>{labelText}</span>
      </div>
    </div>
  );
}

// ── PROJECTION ROW ────────────────────────────────────────────────────────────

function ProjectionRow({ year, value, base }: { year: string; value: number; base: number }) {
  const pct = base > 0 ? ((value - base) / base) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--text-3)', width: '36px', flexShrink: 0 }}>{year}</span>
      <div style={{ flex: 1, height: '2px', background: 'var(--border)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min((value / (base * 5)) * 100, 100)}%`, background: 'linear-gradient(to right, var(--navy), var(--gold))' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--navy)', width: '80px', textAlign: 'right', flexShrink: 0 }}>{fmt(value)}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: pct > 0 ? 'var(--gold)' : 'var(--text-3)', width: '52px', textAlign: 'right', flexShrink: 0 }}>
        {pct > 0 ? `+${pct.toFixed(0)}%` : '—'}
      </span>
    </div>
  );
}

// ── SECTION HEADER ────────────────────────────────────────────────────────────

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', paddingBottom: '12px', borderBottom: '2px solid var(--border)' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.01em', margin: 0 }}>{title}</h2>
      {badge && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: 'var(--navy)', border: '1px solid var(--navy)', padding: '3px 8px', textTransform: 'uppercase' }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lot, setLot]             = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);

  const limits      = getPlanLimits();
  const canSeeAnalysis = limits.hasProjections || limits.hasArtistCotation;
  const canSeeAI       = limits.hasAIVerdict;
  const visibleYears   = limits.projectionYears || [];

  useEffect(() => {
    if (!id) return;
    fetch(`/api/lots/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setLot(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '32px' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: '4px', background: 'var(--navy)',
            animation: `barPulse 1s ease ${i * 0.12}s infinite`,
          }} />
        ))}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.24em', color: 'var(--text-3)' }}>LOADING</span>
      <style>{`@keyframes barPulse{0%,100%{height:8px;opacity:0.3}50%{height:28px;opacity:1}}`}</style>
    </div>
  );

  // ── NOT FOUND ─────────────────────────────────────────────────────────────────
  if (!lot) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', marginBottom: '6px' }}>Artwork not found</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', marginBottom: '24px', letterSpacing: '0.08em' }}>The requested lot does not exist or has been removed.</div>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: '11px 24px', background: 'var(--navy)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          ← Back
        </button>
      </div>
    </div>
  );

  // ── DATA ──────────────────────────────────────────────────────────────────────
  const price    = Number(lot.current_price || lot.estimate_low || 0);
  const estLow   = Number(lot.estimate_low || 0);
  const estHigh  = Number(lot.estimate_high || lot.estimate_low || 0);
  const fairVal  = estHigh || price * 1.2;
  const upside   = Number(lot.pct_below_low_estimate || 0);
  const upsidePct = upside > 0 ? upside : (fairVal > price ? ((fairVal - price) / price) * 100 : 0);
  const proj = (years: number) => Math.round(price * Math.pow(1.07, years));

  const isUpcoming = lot.status === 'upcoming' || lot.status === 'preview' ||
    (lot.auction_date && new Date(lot.auction_date) > new Date() && !lot.status);

  const source = String(lot.source || '').toLowerCase();
  const flags: Record<string, string> = {
    drouot: '🇫🇷', interencheres: '🇫🇷', invaluable: '🇺🇸',
    sothebys: '🇬🇧', christies: '🇬🇧', bonhams: '🇬🇧',
    liveauctioneers: '🇺🇸', ebay: '🌐', artsy: '🌐',
  };
  const sourceNames: Record<string, string> = {
    drouot: 'Drouot', interencheres: 'Interenchères', invaluable: 'Invaluable',
    sothebys: "Sotheby's", christies: "Christie's", bonhams: 'Bonhams',
    liveauctioneers: 'LiveAuctioneers', ebay: 'eBay', artsy: 'Artsy',
  };
  const planNames: Record<string, string> = {
    free: 'FREE', starter: 'COLLECTOR', investor: 'INVESTOR', pro: 'FAMILY OFFICE', elite: 'INSTITUTIONAL',
  };
  const tierBadge = planNames[limits.name?.toLowerCase?.() ?? ''] ?? limits.name?.toUpperCase() ?? '';

  const artistEnc = encodeURIComponent((lot.artist_name_raw || '').slice(0, 40));
  const sourceSearch: Record<string, string> = {
    drouot: `https://www.drouot.com/search?q=${artistEnc}`,
    interencheres: `https://www.google.com/search?q=site%3Ainterencheres.com+${artistEnc}`,
    invaluable: `https://www.invaluable.com/search/?q=${artistEnc}&upcoming=true`,
    sothebys: `https://www.sothebys.com/en/results?query=${artistEnc}`,
    christies: `https://www.christies.com/search?entry=${artistEnc}`,
    bonhams: `https://www.bonhams.com/search/?q=${artistEnc}`,
    liveauctioneers: `https://www.liveauctioneers.com/search/#q=${artistEnc}`,
  };
  const rawUrl = lot.url || lot.source_url || '';
  const NON_ART = ['vehicule', 'voiture', 'moto', 'electromenager', 'cuisine', 'ixina'];
  const isValidUrl = rawUrl && rawUrl.startsWith('http') && !NON_ART.some((w: string) => rawUrl.toLowerCase().includes(w));
  const externalUrl = isValidUrl ? rawUrl : (sourceSearch[source] || `https://www.google.com/search?q=${artistEnc}+${source}`);

  const auctionDateFmt = lot.auction_date
    ? new Date(lot.auction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // Signal levels
  const demandLevel: 1 | 2 | 3 = (lot.deal_score || 0) >= 75 ? 3 : (lot.deal_score || 0) >= 55 ? 2 : 1;
  const liquidityLevel: 1 | 2 | 3 = ['christies', 'sothebys', 'bonhams', 'drouot'].includes(source) ? 3 : 2;
  const trendLevel: 1 | 2 | 3 = upsidePct > 20 ? 3 : upsidePct > 0 ? 2 : 1;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`
        @keyframes barPulse{0%,100%{height:8px;opacity:0.3}50%{height:28px;opacity:1}}
        @keyframes imgShimmer{0%,100%{opacity:0.5}50%{opacity:0.85}}
      `}</style>

      {/* ── 1. STICKY NAV ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(250,250,248,0.97)', backdropFilter: 'blur(8px)',
        borderBottom: '2px solid var(--border)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', gap: '0', height: '48px',
      }}>
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', padding: '0 16px 0 0', height: '100%', borderRight: '1px solid var(--border)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--navy)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
        >
          ←&nbsp;BACK
        </button>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.06em', flex: 1 }}>
          {flags[source] && <span>{flags[source]}</span>}
          <span style={{ color: 'var(--text-2)' }}>{sourceNames[source] || source}</span>
          {auctionDateFmt && <><span>·</span><span>{auctionDateFmt}</span></>}
          {tierBadge && (
            <span style={{ marginLeft: '4px', padding: '2px 7px', border: '1px solid var(--navy)', color: 'var(--navy)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em' }}>
              {tierBadge}
            </span>
          )}
        </div>

        {/* CTA */}
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: 'var(--navy)', color: 'white', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-bright)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--navy)')}
        >
          View on {sourceNames[source] || 'source'}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 1h6v6M9 1L1 9"/>
          </svg>
        </a>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '40px 32px 80px' }}>

        {/* ── 2. HERO ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '56px', marginBottom: '56px', alignItems: 'start' }}>

          {/* Left: sticky image */}
          <div style={{ position: 'sticky', top: '68px' }}>
            <div style={{ border: '2px solid var(--border)', aspectRatio: '3/4', position: 'relative', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
              {!imgLoaded && lot.image_url && (
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, var(--bg-subtle) 25%, var(--bg-hover) 50%, var(--bg-subtle) 75%)', backgroundSize: '200% 100%', animation: 'imgShimmer 1.6s ease-in-out infinite' }} />
              )}
              {lot.image_url ? (
                <img
                  src={lot.image_url}
                  alt={lot.title || 'Artwork'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s' }}
                  onLoad={() => setImgLoaded(true)}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '56px', color: 'var(--border)' }}>◇</span>
                </div>
              )}
            </div>
            {/* Secondary link below image */}
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em', color: 'var(--text-3)', textDecoration: 'none', textAlign: 'center', textTransform: 'uppercase' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--navy)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
            >
              View original listing ↗
            </a>
          </div>

          {/* Right: hero info */}
          <div style={{ paddingTop: '4px' }}>

            {/* Artist name */}
            {lot.artist_name_raw && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '10px' }}>
                <span
                  onClick={() => navigate(`/app/artists/${encodeURIComponent(lot.artist_name_raw)}`)}
                  style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--electric)', color: 'var(--electric)' }}
                >
                  {lot.artist_name_raw}
                </span>
              </div>
            )}

            {/* Title */}
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 2.8vw, 34px)', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2, marginBottom: '20px' }}>
              {lot.title || 'Untitled'}
            </h1>

            {/* Gold rule */}
            <div style={{ width: '40px', height: '2px', background: 'var(--gold)', marginBottom: '28px' }} />

            {/* Price block */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
                {isUpcoming ? 'Starting Bid' : 'Current Price'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '40px', fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: '6px' }}>{fmt(price)}</div>
              {isUpcoming && (
                <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  Starting bid · Auction not yet started
                </div>
              )}
              {(estLow > 0 || estHigh > 0) && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
                  est. {estLow && estHigh && estLow !== estHigh ? `${fmt(estLow)} – ${fmt(estHigh)}` : fmt(estHigh || estLow)}
                </div>
              )}
              {lot.pct_below_low_estimate && lot.pct_below_low_estimate > 5 && (
                <div style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  background: isUpcoming ? 'var(--navy)' : 'var(--electric)',
                  marginTop: '12px',
                  fontSize: '13px', fontWeight: 700,
                  color: 'white', fontFamily: 'var(--font-mono)',
                }}>
                  {isUpcoming
                    ? `Starting bid — est. €${(estLow / 1000).toFixed(0)}K–€${(estHigh / 1000).toFixed(0)}K`
                    : `-${Math.round(lot.pct_below_low_estimate)}% below estimate`
                  }
                </div>
              )}
            </div>

            {/* Score bar */}
            {lot.deal_score > 0 && (
              <div style={{ marginBottom: lot.score_rationale ? '16px' : '28px', paddingBottom: lot.score_rationale ? '16px' : '28px', borderBottom: lot.score_rationale ? 'none' : '1px solid var(--border)' }}>
                <ScoreBar score={lot.deal_score} isUpcoming={!!isUpcoming} />
              </div>
            )}

            {/* AI Rationale */}
            {lot.score_rationale && (
              <div style={{ background: 'var(--navy)', borderRadius: '6px', padding: '12px 16px', marginBottom: '28px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>AI Analysis</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.55, fontStyle: 'italic' }}>{lot.score_rationale}</div>
              </div>
            )}

            {/* Metadata grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
              {[
                { label: 'Auction House', value: lot.auction_house_name },
                { label: 'Category', value: lot.category },
                { label: 'Medium', value: lot.medium },
                { label: 'Dimensions', value: lot.dimensions },
                { label: 'Source', value: `${flags[source] || ''} ${sourceNames[source] || source}`.trim() },
                { label: 'Date', value: auctionDateFmt },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-2)' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 3. INVESTMENT ANALYSIS ────────────────────────────────────────────── */}
        <div style={{ marginBottom: '48px' }}>
          <SectionHeader title="Investment Analysis" badge={!canSeeAnalysis ? 'COLLECTOR+' : undefined} />

          {canSeeAnalysis ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>

              {/* 3 metric tiles */}
              <div style={{ display: 'flex', gap: '2px', marginBottom: '24px' }}>
                <MetricTile label="Current Price" value={fmt(price)} sub="What you pay today" />
                <MetricTile label="Fair Value" value={fmt(fairVal)} sub="Market estimate" highlight />
                <MetricTile
                  label="Upside Potential"
                  value={upsidePct > 0 ? `+${upsidePct.toFixed(0)}%` : 'At market'}
                  sub="vs current estimate"
                />
              </div>

              {/* Signal rows */}
              <div style={{ border: '2px solid var(--border)', padding: '20px', marginBottom: '24px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '4px' }}>Market Signals</div>
                <SignalRow label="Demand"    level={demandLevel} />
                <SignalRow label="Liquidity" level={liquidityLevel} />
                <SignalRow label="Trend"     level={trendLevel} />
              </div>

              {/* Why / Risks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', marginBottom: '24px' }}>
                <div style={{ padding: '20px', border: '2px solid var(--border)', background: 'var(--bg-card)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--navy)', marginBottom: '14px' }}>Investment Case</div>
                  {[
                    upsidePct > 20 ? `${upsidePct.toFixed(0)}% below market estimate — significant undervaluation` : 'Priced at or near market rate',
                    lot.deal_score >= 70 ? `Strong deal score (${lot.deal_score}/100)` : `Moderate investment signal (${lot.deal_score || 0}/100)`,
                    lot.auction_house_name ? `Listed at ${lot.auction_house_name.split('—')[0].trim()}` : 'Sourced from verified auction platform',
                  ].map((text, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--navy)', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>→</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6 }}>{text}</span>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '20px', border: '2px solid var(--border)', background: 'var(--bg-card)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: '14px' }}>Key Risks</div>
                  {[
                    { text: 'Limited resale liquidity for niche or unknown artists', sev: 'MED' },
                    { text: 'Auction estimate may be optimistic', sev: 'MED' },
                    { text: 'Market illiquidity in niche categories', sev: 'HIGH' },
                  ].map((risk, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', color: risk.sev === 'HIGH' ? 'var(--red)' : 'var(--gold-dim)', border: `1px solid ${risk.sev === 'HIGH' ? 'var(--red)' : 'var(--gold-dim)'}`, padding: '1px 5px', flexShrink: 0, marginTop: '1px' }}>
                        {risk.sev}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6 }}>{risk.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Projections */}
              {visibleYears.length > 0 && (
                <div style={{ border: '2px solid var(--border)', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Future Value Projections · 7% base CAGR</div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', fontStyle: 'italic' }}>Indicative only</span>
                  </div>
                  {visibleYears.map((y: number) => (
                    <ProjectionRow key={y} year={`${y}Y`} value={proj(y)} base={price} />
                  ))}
                  {!limits.hasFullArtistProfile && (
                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--navy-subtle)', border: '1px solid var(--navy-glow)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-2)' }}>
                        20yr + 50yr projections &amp; AI-calibrated CAGR on Family Office
                      </span>
                      <button
                        onClick={() => navigate('/app/pricing?plan=pro')}
                        style={{ padding: '5px 14px', background: 'var(--navy)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em' }}
                      >
                        UPGRADE
                      </button>
                    </div>
                  )}
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', marginTop: '12px', lineHeight: 1.6 }}>
                    Projections are purely indicative. Art investment carries significant risk. Past performance does not guarantee future results. Not financial advice.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <LockedBlock
              title="Is this artwork truly worth buying?"
              teaser="Unlock fair value analysis, upside potential, market signals, and 5-year price projections before you decide."
              ctaText="Unlock Investment Analysis"
              ctaPrice="From €9/month"
              planId="starter"
              preview={
                <div style={{ display: 'flex', gap: '2px' }}>
                  {['Current Price', 'Fair Value', 'Upside %'].map(l => (
                    <div key={l} style={{ flex: 1, padding: '20px', background: 'var(--bg-subtle)', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>{l}</div>
                      <div style={{ height: '22px', background: 'var(--border)' }} />
                    </div>
                  ))}
                </div>
              }
            />
          )}
        </div>

        {/* ── 4. AI INVESTMENT ADVISOR ──────────────────────────────────────────── */}
        <div>
          <SectionHeader title="AI Investment Advisor" badge={!canSeeAI ? 'INVESTOR+' : undefined} />

          {canSeeAI ? (
            <AIAnalyst rawLot={lot} />
          ) : canSeeAnalysis ? (
            <LockedBlock
              title="AI has a strong opinion on this deal"
              teaser="Get STRONG BUY / BUY / WATCH / PASS verdict, confidence score, bull &amp; bear cases, advanced risk analysis, and 50-year projection."
              ctaText="Unlock AI Investment Advisor"
              ctaPrice="From €49/month"
              planId="investor"
              preview={
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ flex: 1, height: '44px', background: 'var(--navy-subtle)', border: '1px solid var(--navy-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 800, color: 'var(--navy)', letterSpacing: '0.12em' }}>STRONG BUY</span>
                    </div>
                    <div style={{ padding: '8px 16px', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-2)' }}>Confidence: HIGH</span>
                    </div>
                  </div>
                  <div style={{ height: '12px', background: 'var(--border)', marginBottom: '8px', width: '80%' }} />
                  <div style={{ height: '12px', background: 'var(--border)', width: '60%' }} />
                </div>
              }
            />
          ) : (
            <LockedBlock
              title="Know exactly what to do before you buy"
              teaser="Our AI analyzes every signal — artist cotation, comparable sales, market timing — and gives you a clear verdict: STRONG BUY, BUY, WATCH, or PASS."
              ctaText="Unlock AI Investment Advisor"
              ctaPrice="From €49/month"
              planId="investor"
              preview={
                <div style={{ display: 'flex', gap: '2px' }}>
                  {['Verdict', 'Confidence', 'Risk'].map(l => (
                    <div key={l} style={{ flex: 1, padding: '16px', background: 'var(--bg-subtle)', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>{l}</div>
                      <div style={{ height: '18px', background: 'var(--border)' }} />
                    </div>
                  ))}
                </div>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
