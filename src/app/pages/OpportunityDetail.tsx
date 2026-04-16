import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getPlanLimits, getToken } from '../../lib/auth';
import { AIAnalyst } from '../components/AIAnalyst';
import { StickyLotBar } from '../components/StickyLotBar';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

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

// ── PROJECTION ROW ────────────────────────────────────────────────────────────

function ProjectionRow({ year, value, base }: { year: string; value: number; base: number }) {
  const pct = base > 0 ? ((value - base) / base) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #21262D' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: '#8B949E', width: '36px', flexShrink: 0 }}>{year}</span>
      <div style={{ flex: 1, height: '2px', background: '#30363D', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min((value / (base * 5)) * 100, 100)}%`, background: 'linear-gradient(to right, #2563EB, #C6A85A)' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#E6EDF3', width: '80px', textAlign: 'right', flexShrink: 0 }}>{fmt(value)}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: pct > 0 ? '#C6A85A' : '#8B949E', width: '52px', textAlign: 'right', flexShrink: 0 }}>
        {pct > 0 ? `+${pct.toFixed(0)}%` : '—'}
      </span>
    </div>
  );
}

// ── SCORE COLOR ───────────────────────────────────────────────────────────────

const SCORE_COLOR = (s: number): string =>
  s >= 80 ? '#C6A85A' : s >= 65 ? '#2563EB' : s >= 50 ? '#F59E0B' : '#EF4444';

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lot, setLot]                 = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [imgLoaded, setImgLoaded]     = useState(false);
  const [memoLoading, setMemoLoading] = useState(false);
  const [memo, setMemo]               = useState<any>(null);
  const [showMemo, setShowMemo]       = useState(false);
  const [comparables, setComparables] = useState<any>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const limits         = getPlanLimits();
  const canSeeAnalysis = limits.hasProjections || limits.hasArtistCotation;
  const canSeeAI       = limits.hasAIVerdict;
  const visibleYears   = limits.projectionYears || [];

  const generateMemo = async () => {
    if (!lot?.id) return;
    setMemoLoading(true);
    try {
      const resp = await fetch(
        `https://artalpha-backend-production.up.railway.app/api/memo/${lot.id}`,
        { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (resp.status === 403) { alert('Investment memos are available from the Investor plan (€29/month).'); return; }
      if (!resp.ok) throw new Error('Failed');
      const data = await resp.json();
      setMemo(data);
      setShowMemo(true);
    } catch {
      alert('Memo generation failed. Please try again.');
    } finally {
      setMemoLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetch(`${BACKEND}/api/lots/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setLot(data); setLoading(false); })
      .catch(() => setLoading(false));
    fetch(`${BACKEND}/api/lots/${id}/comparables`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    }).then(r => r.json()).then(setComparables).catch(() => {});
  }, [id]);

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const { bottom } = heroRef.current.getBoundingClientRect();
        setStickyVisible(bottom < 0);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0D1117', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '32px' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ width: '4px', background: '#2563EB', animation: `barPulse 1s ease ${i * 0.12}s infinite` }} />
        ))}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.24em', color: '#8B949E' }}>LOADING</span>
      <style>{`@keyframes barPulse{0%,100%{height:8px;opacity:0.3}50%{height:28px;opacity:1}}`}</style>
    </div>
  );

  if (!lot) return (
    <div style={{ minHeight: '100vh', background: '#0D1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: '22px', color: '#E6EDF3', marginBottom: '6px' }}>Artwork not found</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#8B949E', marginBottom: '24px', letterSpacing: '0.08em' }}>The requested lot does not exist or has been removed.</div>
        <button onClick={() => navigate(-1)} style={{ padding: '11px 24px', background: '#2563EB', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
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

  const formatSource = (src: string, house?: string) => {
    if (!src || src === 'other' || src === 'unknown') return house || '—';
    return src;
  };

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

  // ── DECISION ENGINE ───────────────────────────────────────────────────────────
  const realCost     = lot.real_cost         || null;
  const cycleStage   = lot.cycle_stage       || null;
  const estBias      = lot.estimation_bias   || null;
  const consignAlert = lot.consignment_alert || null;
  const provRisk     = lot.provenance_risk   || null;

  const hasProvHighRisk = provRisk?.level === 'HIGH RISK';
  const hasConsignHigh  = consignAlert?.level === 'HIGH VOLUME';
  const hasCycleRisk    = cycleStage?.stage === 'PEAK';

  const verdict = (() => {
    if (hasProvHighRisk)
      return { label: 'HIGH RISK', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: '⚠', sub: 'Provenance issue detected' };
    if ((lot.deal_score || 0) >= 80 && upsidePct >= 20 && !hasCycleRisk)
      return { label: 'BUY', color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: '↑', sub: 'Strong conviction signal' };
    if ((lot.deal_score || 0) >= 65 && upsidePct >= 10)
      return { label: 'WATCH', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: '◎', sub: 'Monitor closely' };
    if ((lot.deal_score || 0) < 50 || upsidePct < 0)
      return { label: 'PASS', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: '↓', sub: 'Below conviction threshold' };
    return { label: 'WATCH', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: '◎', sub: 'Insufficient signal' };
  })();

  const riskFlagCount = ([
    hasProvHighRisk,
    hasConsignHigh,
    !!(estBias && Math.abs(estBias.pct_above_low_estimate || 0) > 50),
  ] as boolean[]).filter(Boolean).length;

  const riskLevel = riskFlagCount >= 2
    ? { label: 'HIGH RISK', color: '#EF4444' }
    : riskFlagCount === 1
    ? { label: 'MODERATE', color: '#F59E0B' }
    : { label: 'LOW RISK', color: '#10B981' };

  const hasMarketSignals = !!(cycleStage || estBias || consignAlert);

  const stickyTier: 'EXCEPTIONAL' | 'STRONG' | 'INTERESTING' =
    (lot.deal_score || 0) >= 80 ? 'EXCEPTIONAL' :
    (lot.deal_score || 0) >= 65 ? 'STRONG' : 'INTERESTING';

  const scoreColor    = SCORE_COLOR(lot.deal_score || 0);
  const totalCost     = realCost ? realCost.cost_basis : price;
  const breakEvenGain = realCost ? realCost.needed_gain_pct : 26;
  const netGain       = upsidePct - breakEvenGain;

  return (
    <div style={{ minHeight: 'calc(100vh - 57px)', background: '#0D1117', color: 'white' }}>
      <style>{`
        @keyframes barPulse{0%,100%{height:8px;opacity:0.3}50%{height:28px;opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes imgShimmer{0%,100%{opacity:0.5}50%{opacity:0.85}}
      `}</style>

      {/* ═══ ZONE A — COMMAND BAR ═══ */}
      <div style={{ background: '#161B22', borderBottom: '1px solid #30363D', padding: '0 32px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 40, height: '48px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', padding: '0 16px 0 0', height: '100%', borderRight: '1px solid #30363D' }}>
          ← BACK
        </button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#8B949E', letterSpacing: '0.06em' }}>
          {(lot.auction_house_name || 'AUCTION').toUpperCase()}
        </span>
        {lot.lot_number && (
          <>
            <div style={{ width: '1px', height: '16px', background: '#30363D' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#8B949E' }}>LOT {lot.lot_number}</span>
          </>
        )}
        {lot.auction_date && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(() => {
              const diff = new Date(lot.auction_date).getTime() - Date.now();
              if (diff <= 0) return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#EF4444' }}>CLOSED</span>;
              const h = Math.floor(diff / 3600000);
              const m = Math.floor((diff % 3600000) / 60000);
              const urgent = diff < 86400000;
              return (
                <>
                  {urgent && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s infinite' }} />}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: urgent ? '#EF4444' : '#8B949E', fontWeight: urgent ? 700 : 400 }}>
                    CLOSES {h > 24 ? `${Math.floor(h / 24)}D ${h % 24}H` : `${h}H ${m}M`}
                  </span>
                </>
              );
            })()}
          </div>
        )}
        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
          style={{ marginLeft: lot.auction_date ? '0' : 'auto', padding: '8px 18px', background: '#238636', border: '1px solid #2EA043', color: 'white', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
          View on {sourceNames[source] || 'auction'} →
        </a>
      </div>

      <StickyLotBar
        artist={lot.artist_name_raw || ''}
        title={lot.title || 'Untitled'}
        score={lot.deal_score || 0}
        tier={stickyTier}
        signal={verdict.label}
        visible={stickyVisible}
      />

      {/* ═══ ZONE B — ABOVE THE FOLD ═══ */}
      <div ref={heroRef} style={{ display: 'grid', gridTemplateColumns: '380px 1fr', minHeight: '420px', borderBottom: '1px solid #30363D' }}>

        {/* B1 — Image */}
        <div style={{ background: '#0D1117', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', borderRight: '1px solid #30363D', position: 'relative' }}>
          {lot.image_url ? (
            <img src={lot.image_url} alt={lot.title}
              onLoad={() => setImgLoaded(true)}
              style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '4px', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s' }} />
          ) : (
            <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #30363D', borderRadius: '8px' }}>
              <span style={{ fontSize: '48px', opacity: 0.1 }}>◎</span>
            </div>
          )}
          {(lot.deal_score || 0) >= 80 && (
            <div style={{ position: 'absolute', top: '16px', left: '16px', padding: '3px 10px', background: 'rgba(198,168,90,0.15)', border: '1px solid rgba(198,168,90,0.4)', borderRadius: '3px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>EXCEPTIONAL</span>
            </div>
          )}
          <button
            onClick={() => {
              const params = new URLSearchParams({ lot: lot.id, img: lot.image_url || '', title: lot.title || '', artist: lot.artist_name_raw || '', w: String(lot.width_cm || 80), h: String(lot.height_cm || 60) });
              navigate(`/app/visualizer?${params.toString()}`);
            }}
            style={{ position: 'absolute', bottom: '16px', right: '16px', padding: '6px 12px', background: 'rgba(22,27,34,0.9)', border: '1px solid #30363D', borderRadius: '4px', color: '#8B949E', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          >
            🖼 Visualize
          </button>
        </div>

        {/* B2 — Decision panel */}
        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Artist + Title */}
          <div>
            <div
              onClick={() => navigate(`/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}`)}
              style={{ fontSize: '10px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '4px', cursor: 'pointer' }}>
              {lot.artist_name_raw || 'Unknown artist'}
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(20px,2.5vw,30px)', color: '#E6EDF3', fontWeight: 600, margin: '0 0 6px', lineHeight: 1.3 }}>
              {lot.title || 'Untitled'}
            </h1>
            <div style={{ fontSize: '12px', color: '#8B949E' }}>
              {[lot.medium, lot.dimensions].filter(Boolean).join(' · ')}
            </div>
          </div>

          {/* VERDICT ROW */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', flexWrap: 'wrap' }}>

            <div style={{ padding: '14px 18px', background: verdict.bg, border: `1px solid ${verdict.color}33`, borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '88px' }}>
              <div style={{ fontSize: '20px', color: verdict.color, lineHeight: 1, marginBottom: '4px' }}>{verdict.icon}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: verdict.color, letterSpacing: '0.1em' }}>{verdict.label}</div>
              <div style={{ fontSize: '9px', color: verdict.color, opacity: 0.7, fontFamily: 'var(--font-mono)', marginTop: '2px', textAlign: 'center', lineHeight: 1.3 }}>{verdict.sub}</div>
            </div>

            <div style={{ padding: '14px 18px', background: '#161B22', border: '1px solid #30363D', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '100px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '4px' }}>SCORE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{(lot.deal_score || 0).toFixed(0)}</span>
                <span style={{ fontSize: '12px', color: '#8B949E', fontFamily: 'var(--font-mono)' }}>/100</span>
              </div>
              <div style={{ marginTop: '6px', height: '3px', background: '#30363D', borderRadius: '2px' }}>
                <div style={{ height: '100%', borderRadius: '2px', width: `${lot.deal_score || 0}%`, background: scoreColor }} />
              </div>
            </div>

            <div style={{ padding: '14px 18px', background: '#161B22', border: '1px solid #30363D', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '4px' }}>
                {isUpcoming ? 'STARTING BID' : 'PRICE / ALL-IN'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: '#E6EDF3' }}>{fmt(price)}</div>
              {totalCost > price && (
                <div style={{ fontSize: '11px', color: '#F59E0B', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>all-in {fmt(totalCost)}</div>
              )}
              {(estLow > 0 || estHigh > 0) && (
                <div style={{ fontSize: '10px', color: '#8B949E', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>est. {fmt(estLow)}–{fmt(estHigh)}</div>
              )}
            </div>

            <div style={{ padding: '14px 18px', background: upsidePct > breakEvenGain ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${upsidePct > breakEvenGain ? '#10B98133' : '#EF444433'}`, borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '4px' }}>UPSIDE / BREAK-EVEN</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: upsidePct > 0 ? '#10B981' : '#EF4444' }}>
                {upsidePct > 0 ? '+' : ''}{upsidePct.toFixed(0)}%
              </div>
              <div style={{ fontSize: '10px', color: '#8B949E', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>needs +{breakEvenGain.toFixed(0)}% to break even</div>
              {netGain > 0 && (
                <div style={{ fontSize: '10px', color: '#10B981', fontFamily: 'var(--font-mono)', marginTop: '2px', fontWeight: 700 }}>net +{netGain.toFixed(0)}% after costs</div>
              )}
            </div>

            <div style={{ padding: '14px 18px', background: '#161B22', border: `1px solid ${riskLevel.color}33`, borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '4px' }}>RISK</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: riskLevel.color }}>{riskLevel.label}</div>
            </div>
          </div>

          {/* SIGNAL STRIP */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {cycleStage && (
              <div style={{ padding: '5px 11px', background: '#161B22', border: '1px solid #30363D', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cycleStage.color }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: '#C6A85A', letterSpacing: '0.08em' }}>CYCLE</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#E6EDF3' }}>{cycleStage.stage}</span>
              </div>
            )}
            {estBias && Math.abs(estBias.pct_above_low_estimate || 0) > 10 && (
              <div style={{ padding: '5px 11px', background: estBias.signal === 'bullish' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${estBias.signal === 'bullish' ? '#10B98133' : '#EF444433'}`, borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: estBias.signal === 'bullish' ? '#10B981' : '#EF4444', letterSpacing: '0.08em' }}>BIAS</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#E6EDF3' }}>
                  {estBias.signal === 'bullish' ? 'Underestimates' : 'Overestimates'} {Math.abs(estBias.pct_above_low_estimate || 0).toFixed(0)}%
                </span>
              </div>
            )}
            {hasConsignHigh && (
              <div style={{ padding: '5px 11px', background: 'rgba(239,68,68,0.08)', border: '1px solid #EF444433', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px' }}>⚠</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: '#EF4444', letterSpacing: '0.08em' }}>SUPPLY ALERT</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#E6EDF3' }}>{consignAlert!.count} lots in 90 days</span>
              </div>
            )}
            {hasProvHighRisk && (
              <div style={{ padding: '5px 11px', background: 'rgba(239,68,68,0.08)', border: '1px solid #EF444433', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px' }}>🔴</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: '#EF4444', letterSpacing: '0.08em' }}>PROVENANCE RISK</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#E6EDF3' }}>{provRisk!.flags?.[0]?.label || 'Review required'}</span>
              </div>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
            <button
              onClick={() => {
                const params = new URLSearchParams({ lot: lot.id, img: lot.image_url || '', title: lot.title || '', artist: lot.artist_name_raw || '', w: String(lot.width_cm || 80), h: String(lot.height_cm || 60) });
                navigate(`/app/visualizer?${params.toString()}`);
              }}
              style={{ padding: '11px 16px', background: '#161B22', border: '1px solid #30363D', borderRadius: '6px', color: '#8B949E', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
            >
              🖼 Visualize in room
            </button>
          </div>
        </div>
      </div>

      {/* ═══ ZONE C — INTELLIGENCE GRID ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: (realCost && hasMarketSignals) ? '1fr 1fr 1fr' : (realCost || hasMarketSignals) ? '1fr 1fr' : '1fr', gap: '1px', background: '#30363D' }}>

        {/* C1 — Real Cost Breakdown */}
        {realCost && (
          <div style={{ background: '#0D1117', padding: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '16px' }}>REAL COST BREAKDOWN</div>
            {([
              { label: 'Hammer price', value: price },
              { label: `Buyer's premium (${realCost.buyers_premium_pct}%)`, value: Math.round(realCost.cost_basis - price) },
              { label: 'Holding cost (3yr)', value: realCost.holding_cost_3y },
            ] as { label: string; value: number }[]).filter(item => item.value > 0).map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #21262D' }}>
                <span style={{ fontSize: '12px', color: '#8B949E' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#E6EDF3', fontWeight: 500 }}>{fmt(value)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', color: '#E6EDF3', fontWeight: 700 }}>All-in cost</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: '#F59E0B', fontWeight: 700 }}>{fmt(totalCost)}</span>
            </div>
            <div style={{ marginTop: '10px', padding: '8px 12px', background: '#161B22', borderRadius: '4px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#8B949E' }}>
                Needs +{breakEvenGain.toFixed(1)}% to break even
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#F59E0B', marginTop: '3px' }}>
                Break-even hammer: {fmt(realCost.breakeven_hammer)}
              </div>
            </div>
          </div>
        )}

        {/* C2 — Market Signals */}
        {hasMarketSignals && (
        <div style={{ background: '#0D1117', padding: '24px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '16px' }}>MARKET SIGNALS</div>

          {cycleStage && (
            <div style={{ marginBottom: '12px', padding: '12px', background: '#161B22', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>MARKET CYCLE</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: cycleStage.color, fontFamily: 'var(--font-mono)' }}>{cycleStage.icon} {cycleStage.stage}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#8B949E', margin: '0 0 4px', lineHeight: 1.5 }}>{cycleStage.description}</p>
              {cycleStage.momentum_pct !== null && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: cycleStage.color }}>
                  12m: {cycleStage.momentum_pct > 0 ? '+' : ''}{cycleStage.momentum_pct}% · {cycleStage.total_sales} sales · {cycleStage.first_year}–{cycleStage.last_year}
                </div>
              )}
            </div>
          )}

          {estBias && (
            <div style={{ marginBottom: '12px', padding: '12px', background: '#161B22', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>ESTIMATION BIAS</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: estBias.signal === 'bullish' ? '#10B981' : '#EF4444', fontFamily: 'var(--font-mono)' }}>
                  {estBias.pct_above_low_estimate > 0 ? '+' : ''}{estBias.pct_above_low_estimate}%
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#8B949E', margin: 0, lineHeight: 1.5 }}>{estBias.label} · {(estBias.sample_size || 0).toLocaleString()} sales</p>
            </div>
          )}

          {consignAlert && (
            <div style={{ padding: '12px', background: consignAlert.level === 'HIGH VOLUME' ? 'rgba(239,68,68,0.06)' : '#161B22', borderRadius: '6px', border: consignAlert.level === 'HIGH VOLUME' ? '1px solid #EF444433' : '1px solid #30363D' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>SUPPLY PRESSURE</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: consignAlert.level === 'HIGH VOLUME' ? '#EF4444' : '#10B981', fontFamily: 'var(--font-mono)' }}>
                  {consignAlert.level}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#8B949E', margin: 0, lineHeight: 1.5 }}>{consignAlert.interpretation}</p>
            </div>
          )}

        </div>
        )}

        {/* C3 — Lot Details + Due Diligence */}
        <div style={{ background: '#0D1117', padding: '24px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '16px' }}>LOT DETAILS</div>
          {([
            { label: 'Artist',     value: lot.artist_name_raw, nav: `/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}` },
            { label: 'Medium',     value: lot.medium },
            { label: 'Dimensions', value: lot.dimensions },
            { label: 'Category',   value: lot.category },
            { label: 'Estimate',   value: (estLow || estHigh) ? `${fmt(estLow)}–${fmt(estHigh)}` : null },
            { label: 'House',      value: lot.auction_house_name },
            { label: 'Sale date',  value: auctionDateFmt },
            { label: 'Lot #',      value: lot.lot_number },
            { label: 'Source',     value: (() => { const s = formatSource(source, lot.auction_house_name); const mapped = sourceNames[s.toLowerCase()] || s; return `${flags[s.toLowerCase()] || ''} ${mapped}`.trim(); })() },
          ] as { label: string; value: string | null | undefined; nav?: string }[]).filter(({ value }) => value).map(({ label, value, nav }) => (
            <div key={label} style={{ display: 'flex', gap: '12px', padding: '6px 0', borderBottom: '1px solid #21262D' }}>
              <div style={{ width: '78px', fontSize: '11px', color: '#8B949E', flexShrink: 0 }}>{label}</div>
              {nav ? (
                <div onClick={() => navigate(nav)} style={{ fontSize: '12px', color: '#60A5FA', cursor: 'pointer', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
              ) : (
                <div style={{ fontSize: '12px', color: '#E6EDF3', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
              )}
            </div>
          ))}

          {provRisk && (
            <div style={{ marginTop: '16px', padding: '10px 12px', background: provRisk.level === 'HIGH RISK' ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)', borderRadius: '4px', border: `1px solid ${provRisk.level === 'HIGH RISK' ? '#EF444433' : '#10B98133'}` }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: provRisk.color, fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
                DUE DILIGENCE · {provRisk.level}
              </div>
              {(provRisk.flags as { code: string; severity: string; label: string; detail: string }[]).map(f => (
                <div key={f.code} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: f.severity === 'HIGH' ? '#f87171' : f.severity === 'MEDIUM' ? '#f59e0b' : '#94a3b8', flexShrink: 0, marginTop: '4px' }} />
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: f.severity === 'HIGH' ? '#f87171' : f.severity === 'MEDIUM' ? '#f59e0b' : '#94a3b8' }}>{f.label}</div>
                    <div style={{ fontSize: '10px', color: '#8B949E', marginTop: '2px', lineHeight: 1.5 }}>{f.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ ZONE D — AI INTELLIGENCE ═══ */}
      <div style={{ padding: '24px 32px', borderTop: '1px solid #30363D', background: '#0D1117' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '16px' }}>AI INTELLIGENCE</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
          <button
            onClick={memo ? () => setShowMemo(true) : generateMemo}
            disabled={memoLoading}
            style={{ padding: '10px 20px', background: memoLoading ? '#21262D' : 'rgba(37,99,235,0.15)', border: `1px solid ${memoLoading ? '#30363D' : '#2563EB44'}`, borderRadius: '6px', color: memoLoading ? '#8B949E' : '#60A5FA', fontSize: '12px', fontWeight: 700, cursor: memoLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
          >
            {memoLoading ? '… Generating' : memo ? '◆ View Memo' : '◆ Generate Investment Memo'}
          </button>
          {memo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ padding: '4px 12px', background: memo.recommendation === 'BUY' ? 'rgba(16,185,129,0.12)' : memo.recommendation === 'WATCH' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)', border: `1px solid ${memo.recommendation === 'BUY' ? '#10B98133' : memo.recommendation === 'WATCH' ? '#F59E0B33' : '#64748B33'}`, fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: memo.recommendation === 'BUY' ? '#10B981' : memo.recommendation === 'WATCH' ? '#F59E0B' : '#94a3b8', borderRadius: '4px' }}>{memo.recommendation}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#8B949E' }}>Conviction {memo.conviction}/100</span>
            </div>
          )}
        </div>
        {canSeeAI ? (
          <AIAnalyst rawLot={lot} />
        ) : canSeeAnalysis ? (
          <LockedBlock
            title="AI has a strong opinion on this deal"
            teaser="Get STRONG BUY / BUY / WATCH / PASS verdict, confidence score, bull & bear cases, and advanced risk analysis."
            ctaText="Unlock Investment Dossier"
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
            ctaText="Unlock Investment Dossier"
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

      {/* ═══ ZONE E — AI RATIONALE ═══ */}
      {lot.score_rationale && (
        <div style={{ padding: '24px 32px', borderTop: '1px solid #30363D', background: '#0D1117' }}>
          <div style={{ maxWidth: '800px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', marginBottom: '12px' }}>◆ NAUTILUS ANALYSIS</div>
            <p style={{ fontSize: '14px', color: '#8B949E', lineHeight: 1.9, margin: 0, fontStyle: 'italic' }}>{lot.score_rationale}</p>
          </div>
        </div>
      )}

      {/* ═══ ZONE F — INVESTMENT ANALYSIS (gated) ═══ */}
      {canSeeAnalysis && (
        <div style={{ padding: '24px 32px', borderTop: '1px solid #30363D', background: '#0D1117' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '16px' }}>INVESTMENT ANALYSIS</div>
          <div style={{ display: 'flex', gap: '2px', marginBottom: '16px' }}>
            <MetricTile label="Current Price" value={fmt(price)} sub="What you pay" />
            <MetricTile label="Fair Value" value={fmt(fairVal)} sub="Market estimate" highlight />
            <MetricTile label="Upside" value={upsidePct > 0 ? `+${upsidePct.toFixed(0)}%` : 'At market'} sub="vs estimate" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <div style={{ padding: '16px', background: '#161B22', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '10px' }}>INVESTMENT CASE</div>
              {[
                upsidePct > 20 ? `${upsidePct.toFixed(0)}% below market estimate` : 'Priced at or near market rate',
                lot.deal_score >= 70 ? `Strong deal score (${lot.deal_score}/100)` : `Moderate signal (${lot.deal_score || 0}/100)`,
                lot.auction_house_name ? `Listed at ${lot.auction_house_name.split('—')[0].trim()}` : 'Verified auction platform',
              ].map((text, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ color: '#2563EB', fontSize: '12px', flexShrink: 0 }}>→</span>
                  <span style={{ fontSize: '12px', color: '#8B949E', lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '16px', background: '#161B22', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '10px' }}>KEY RISKS</div>
              {[
                { text: 'Limited resale liquidity for niche artists', sev: 'MED' },
                { text: 'Auction estimate may be optimistic', sev: 'MED' },
                { text: 'Market illiquidity in niche categories', sev: 'HIGH' },
              ].map((risk, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: risk.sev === 'HIGH' ? '#EF4444' : '#F59E0B', border: `1px solid ${risk.sev === 'HIGH' ? '#EF444466' : '#F59E0B66'}`, padding: '1px 5px', flexShrink: 0, marginTop: '1px', fontFamily: 'var(--font-mono)', borderRadius: '2px' }}>{risk.sev}</span>
                  <span style={{ fontSize: '12px', color: '#8B949E', lineHeight: 1.5 }}>{risk.text}</span>
                </div>
              ))}
            </div>
          </div>
          {visibleYears.length > 0 && (
            <div style={{ padding: '16px', background: '#161B22', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '12px' }}>FUTURE VALUE PROJECTIONS · 7% CAGR</div>
              {visibleYears.map((y: number) => (
                <ProjectionRow key={y} year={`${y}Y`} value={proj(y)} base={price} />
              ))}
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#484F58', marginTop: '12px', lineHeight: 1.6 }}>
                Projections are indicative only. Art investment carries significant risk. Not financial advice.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Locked investment analysis for lower tiers */}
      {!canSeeAnalysis && (
        <div style={{ padding: '24px 32px', borderTop: '1px solid #30363D', background: '#0D1117' }}>
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
        </div>
      )}

      {/* ═══ ZONE G — COMPARABLE SALES ═══ */}
      {comparables && comparables.comparables?.length > 0 && (() => {
        const allComps: any[] = comparables.comparables || [];
        const sameArtistComps = allComps.filter((c: any) =>
          c.artist_name_raw?.toLowerCase().trim() === (lot.artist_name_raw || '').toLowerCase().trim()
        );
        const filteredComps = sameArtistComps.length >= 2 ? sameArtistComps.slice(0, 3) : allComps.slice(0, 3);
        const compsLabel = sameArtistComps.length >= 2 ? 'COMPARABLE SALES' : 'SIMILAR WORKS';
        return (
        <div style={{ padding: '24px 32px', borderTop: '1px solid #30363D', background: '#0D1117' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#8B949E', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em' }}>{compsLabel}</div>
            {comparables.market_analysis && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#8B949E' }}>
                  Comps avg: <strong style={{ color: '#E6EDF3' }}>€{comparables.market_analysis.market_avg_price?.toLocaleString()}</strong>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: comparables.market_analysis.price_gap_pct > 0 ? '#10B981' : '#EF4444' }}>
                  {comparables.market_analysis.price_gap_pct > 0 ? '+' : ''}{comparables.market_analysis.price_gap_pct}% vs this lot
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {filteredComps.map((comp: any) => {
              const compPrice = comp.current_price || comp.estimate_low || 0;
              return (
                <div key={comp.id}
                  onClick={() => navigate(`/app/opportunities/${comp.id}`)}
                  style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#8B949E'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#30363D'}
                >
                  {comp.image_url && (
                    <div style={{ height: '120px', overflow: 'hidden' }}>
                      <img src={comp.image_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: '9px', color: '#8B949E', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {comp.artist_name_raw || 'Unknown'}
                    </div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#E6EDF3', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {comp.title || 'Untitled'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: '#E6EDF3' }}>€{compPrice.toLocaleString()}</span>
                      {comp.deal_score && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: SCORE_COLOR(comp.deal_score) }}>
                          {comp.deal_score.toFixed(0)}/100
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {/* ═══ ZONE H — DISCLAIMER ═══ */}
      <div style={{ padding: '16px 32px', borderTop: '1px solid #30363D', background: '#010409' }}>
        <p style={{ fontSize: '10px', color: '#484F58', fontFamily: 'var(--font-mono)', textAlign: 'center', margin: 0, letterSpacing: '0.06em' }}>
          NOT FINANCIAL ADVICE · FOR INFORMATIONAL PURPOSES ONLY · NAUTILUS DATA AGGREGATED FROM PUBLIC AUCTION SOURCES
        </p>
      </div>

      {/* ── INVESTMENT MEMO MODAL ─────────────────────────────────────────────── */}
      {showMemo && memo && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(10,22,40,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowMemo(false); }}
        >
          <div style={{
            background: 'white', borderRadius: '8px',
            width: '100%', maxWidth: '680px',
            maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
          }}>
            <div style={{ background: 'var(--navy)', padding: '24px 32px', borderRadius: '8px 8px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
                    NAUTILUS · INVESTMENT MEMO
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'white', marginBottom: '4px' }}>{memo.title}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{memo.artist}</div>
                </div>
                <button onClick={() => setShowMemo(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '20px', cursor: 'pointer', padding: '0', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '20px' }}>
                {[
                  { label: 'CURRENT PRICE', value: memo.current_price >= 1000 ? `€${(memo.current_price / 1000).toFixed(0)}K` : `€${memo.current_price}` },
                  { label: 'TARGET LOW',    value: memo.target_price?.low  ? `€${(memo.target_price.low  / 1000).toFixed(0)}K` : 'N/A' },
                  { label: 'TARGET HIGH',   value: memo.target_price?.high ? `€${(memo.target_price.high / 1000).toFixed(0)}K` : 'N/A' },
                  { label: 'CONVICTION',    value: `${memo.conviction}/100` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'white' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '28px 32px' }}>
              <div style={{
                display: 'flex', gap: '12px', alignItems: 'center',
                marginBottom: '24px', padding: '14px 16px',
                background: memo.recommendation === 'BUY' ? 'var(--electric-subtle)' : memo.recommendation === 'WATCH' ? 'var(--gold-subtle)' : 'var(--bg-subtle)',
                borderRadius: '6px',
                border: `1px solid ${memo.recommendation === 'BUY' ? 'var(--electric-border)' : memo.recommendation === 'WATCH' ? 'var(--gold-border)' : 'var(--border)'}`,
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: memo.recommendation === 'BUY' ? 'var(--electric)' : memo.recommendation === 'WATCH' ? 'var(--gold)' : 'var(--text-3)' }}>
                  {memo.recommendation}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                  {memo.time_horizon}{memo.target_price?.rationale ? ` · ${memo.target_price.rationale}` : ''}
                </div>
              </div>
              {[
                { title: 'Investment Thesis', content: memo.thesis },
                { title: 'Artist Context',    content: memo.artist_context },
                { title: 'Pricing Analysis',  content: memo.pricing_analysis },
              ].filter(s => s.content).map(({ title, content }) => (
                <div key={title} style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{title}</div>
                  <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>{content}</p>
                </div>
              ))}
              {memo.risks && memo.risks.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>Key Risks</div>
                  {memo.risks.map((risk: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ color: '#C0392B', fontSize: '12px', marginTop: '2px', flexShrink: 0 }}>▲</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>{risk}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  Nautilus Intelligence · {new Date(memo.generated_at).toLocaleDateString('en-GB')}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  NOT FINANCIAL ADVICE · FOR INFORMATIONAL PURPOSES ONLY
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
