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
    : `€${v.toLocaleString('en-GB')}`;
}

const isFrench = (s: string) =>
  /par rapport|d'acquisition|sous-évalué|artiste|liquidité|achat|vente|décote/i.test(s);

// ── SCORE COLOR ───────────────────────────────────────────────────────────────

const SCORE_COLOR = (s: number): string =>
  s >= 80 ? 'var(--gold)' : s >= 65 ? 'var(--blue-link)' : s >= 50 ? 'var(--amber)' : 'var(--red)';

// ── LOCKED BLOCK ──────────────────────────────────────────────────────────────

function LockedBlock({ title, teaser, ctaText, ctaPrice, planId, preview }: {
  title: string; teaser: string; ctaText: string; ctaPrice: string;
  planId: string; preview?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div style={{ position: 'relative', border: '0.5px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ filter: 'blur(3px)', pointerEvents: 'none', opacity: 0.35, padding: '24px', userSelect: 'none' }}>
        {preview || (
          <div style={{ display: 'flex', gap: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, height: '72px', background: 'var(--bg-inset)', borderRadius: '6px' }} />
            ))}
          </div>
        )}
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, transparent 0%, var(--bg-card) 40%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px', textAlign: 'center',
      }}>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '17px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '8px' }}>{title}</div>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px', maxWidth: '340px', lineHeight: 1.65 }}>{teaser}</p>
        <button
          onClick={() => navigate(`/app/pricing?plan=${planId}`)}
          style={{ padding: '11px 28px', background: '#162040', border: '0.5px solid #2A4480', color: 'var(--blue-link)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: '6px', fontFamily: 'var(--font-mono)' }}
        >
          {ctaText}
        </button>
        <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>{ctaPrice} · 7-day free trial</div>
      </div>
    </div>
  );
}

// ── PROJECTION ROW ────────────────────────────────────────────────────────────

function ProjectionRow({ year, value, base, maxVal }: { year: string; value: number; base: number; maxVal: number }) {
  const pct = base > 0 ? ((value - base) / base) * 100 : 0;
  const w = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', minWidth: '28px', flexShrink: 0 }}>{year}</span>
      <div style={{ flex: 1, height: '3px', background: 'rgba(96,165,250,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '2px', width: `${w}%`, background: 'linear-gradient(90deg, var(--gold), #D4B96A)' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-1)', minWidth: '52px', textAlign: 'right', flexShrink: 0 }}>{fmt(value)}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)', minWidth: '50px', textAlign: 'right', flexShrink: 0 }}>
        {pct > 0 ? `+${pct.toFixed(0)}%` : '—'}
      </span>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lot, setLot]                     = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [imgLoaded, setImgLoaded]         = useState(false);
  const [memoLoading, setMemoLoading]     = useState(false);
  const [memo, setMemo]                   = useState<any>(null);
  const [showMemo, setShowMemo]           = useState(false);
  const [comparables, setComparables]     = useState<any>(null);
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
    const onScroll = () => {
      if (heroRef.current) {
        setStickyVisible(heroRef.current.getBoundingClientRect().bottom < 60);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '32px' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ width: '4px', background: 'var(--blue-link)', animation: `barPulse 1s ease ${i * 0.12}s infinite` }} />
        ))}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.24em', color: 'var(--text-3)' }}>LOADING</span>
      <style>{`@keyframes barPulse{0%,100%{height:8px;opacity:0.3}50%{height:28px;opacity:1}}`}</style>
    </div>
  );

  if (!lot) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', color: 'var(--text-1)', marginBottom: '6px' }}>Artwork not found</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', marginBottom: '24px', letterSpacing: '0.08em' }}>The requested lot does not exist or has been removed.</div>
        <button onClick={() => navigate(-1)} style={{ padding: '11px 24px', background: '#162040', border: '0.5px solid #2A4480', color: 'var(--blue-link)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', borderRadius: '6px' }}>
          ← Back
        </button>
      </div>
    </div>
  );

  // ── DATA ──────────────────────────────────────────────────────────────────────
  const price     = Number(lot.current_price || lot.estimate_low || 0);
  const estLow    = Number(lot.estimate_low || 0);
  const estHigh   = Number(lot.estimate_high || lot.estimate_low || 0);
  const fairVal   = estHigh || price * 1.2;
  const upside    = Number(lot.pct_below_low_estimate || 0);
  const upsidePct = upside > 0 ? upside : (fairVal > price ? ((fairVal - price) / price) * 100 : 0);
  const proj      = (years: number) => Math.round(price * Math.pow(1.07, years));

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
  const rawUrl   = lot.url || lot.source_url || '';
  const NON_ART  = ['vehicule', 'voiture', 'moto', 'electromenager', 'cuisine', 'ixina'];
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
      return { label: 'HIGH RISK', color: 'var(--red)',   bg: 'rgba(248,113,113,0.07)', icon: '⚠', sub: 'Provenance issue detected' };
    if ((lot.deal_score || 0) >= 80 && upsidePct >= 20 && !hasCycleRisk)
      return { label: 'BUY',       color: 'var(--green)', bg: 'rgba(82,201,127,0.07)', icon: '↑', sub: 'Strong conviction signal' };
    if ((lot.deal_score || 0) >= 65 && upsidePct >= 10)
      return { label: 'WATCH',     color: 'var(--amber)', bg: 'rgba(251,191,36,0.07)',  icon: '◎', sub: 'Monitor closely' };
    if ((lot.deal_score || 0) < 50 || upsidePct < 0)
      return { label: 'PASS',      color: 'var(--red)',   bg: 'rgba(248,113,113,0.07)', icon: '↓', sub: 'Below conviction threshold' };
    return   { label: 'WATCH',     color: 'var(--amber)', bg: 'rgba(251,191,36,0.07)',  icon: '◎', sub: 'Insufficient signal' };
  })();

  const riskFlagCount = ([
    hasProvHighRisk,
    hasConsignHigh,
    !!(estBias && Math.abs(estBias.pct_above_low_estimate || 0) > 50),
  ] as boolean[]).filter(Boolean).length;

  const riskLevel = riskFlagCount >= 2
    ? { label: 'HIGH RISK', color: 'var(--red)' }
    : riskFlagCount === 1
    ? { label: 'MODERATE',  color: 'var(--amber)' }
    : { label: 'LOW RISK',  color: 'var(--green)' };

  const hasMarketSignals = !!(cycleStage || estBias || consignAlert);

  const stickyTier: 'EXCEPTIONAL' | 'STRONG' | 'INTERESTING' =
    (lot.deal_score || 0) >= 80 ? 'EXCEPTIONAL' :
    (lot.deal_score || 0) >= 65 ? 'STRONG' : 'INTERESTING';

  const totalCost     = realCost ? realCost.cost_basis : price;
  const breakEvenGain = realCost ? realCost.needed_gain_pct : 26;
  const netGain       = upsidePct - breakEvenGain;

  // Nautilus analysis text — English only
  const rawAnalysis = lot.score_rationale || lot.nautilus_analysis || '';
  const analysisText = rawAnalysis && !isFrench(rawAnalysis)
    ? rawAnalysis
    : upside > 0
    ? `${Math.round(upside)}% below market estimate — undervalued acquisition with strong artist liquidity signal.`
    : null;

  // Comparable sales
  const allComps: any[] = comparables?.comparables || [];
  const sameArtistComps = allComps.filter((c: any) =>
    c.artist_name_raw?.toLowerCase().trim() === (lot.artist_name_raw || '').toLowerCase().trim()
  );
  const displayComps = sameArtistComps.length >= 2 ? sameArtistComps.slice(0, 3) : allComps.slice(0, 3);
  const compsLabel   = sameArtistComps.length >= 2 ? 'COMPARABLE SALES' : 'SIMILAR WORKS';

  // Projection max value for bar scaling
  const maxProjYear = visibleYears.length > 0 ? Math.max(...visibleYears) : 20;
  const maxProjVal  = proj(maxProjYear);

  // Source display
  const resolvedSource = formatSource(source, lot.auction_house_name);
  const sourceDisplay  = `${flags[resolvedSource.toLowerCase()] || ''} ${sourceNames[resolvedSource.toLowerCase()] || resolvedSource}`.trim();

  // Shared section label style
  const sLabel: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em',
    textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '16px',
  };

  // Shared card style
  const card: React.CSSProperties = {
    background: 'var(--bg-card)', border: '0.5px solid var(--border)',
    borderRadius: '10px', padding: '20px',
  };

  // Row separator style
  const rowSep: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 0', borderBottom: '0.5px solid var(--border-dim)',
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 57px)', background: 'var(--bg-deep)', color: 'var(--text-1)' }}>
      <style>{`
        @keyframes barPulse{0%,100%{height:8px;opacity:0.3}50%{height:28px;opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .comp-card:hover { border-color: #3D4F6B !important; transform: scale(1.01); }
      `}</style>

      {/* ── COMMAND BAR ─────────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-base)', borderBottom: '0.5px solid var(--border)', padding: '0 32px', display: 'flex', alignItems: 'center', gap: '16px', height: '48px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', padding: '0 16px 0 0', height: '100%', borderRight: '0.5px solid var(--border)' }}>
          ← BACK
        </button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.08em' }}>
          {(lot.auction_house_name || 'AUCTION').toUpperCase()}
        </span>
        {lot.lot_number && (
          <>
            <div style={{ width: '1px', height: '14px', background: 'var(--border)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>LOT {lot.lot_number}</span>
          </>
        )}
        {lot.auction_date && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {(() => {
              const diff = new Date(lot.auction_date).getTime() - Date.now();
              if (diff <= 0) return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)' }}>CLOSED</span>;
              const h = Math.floor(diff / 3600000);
              const m = Math.floor((diff % 3600000) / 60000);
              const urgent = diff < 86400000;
              return (
                <>
                  {urgent && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1s infinite' }} />}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: urgent ? 'var(--red)' : 'var(--text-3)', fontWeight: urgent ? 700 : 400 }}>
                    CLOSES {h > 24 ? `${Math.floor(h / 24)}D ${h % 24}H` : `${h}H ${m}M`}
                  </span>
                </>
              );
            })()}
          </div>
        )}
        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
          style={{ marginLeft: lot.auction_date ? '0' : 'auto', padding: '7px 16px', background: '#162040', border: '0.5px solid #2A4480', color: 'var(--blue-link)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap', borderRadius: '6px' }}>
          View on {sourceNames[source] || 'auction'} →
        </a>
      </div>

      {/* ═══ ZONE A — STICKY CONTEXT BAR ═══ */}
      <StickyLotBar
        artist={lot.artist_name_raw || ''}
        title={lot.title || 'Untitled'}
        score={lot.deal_score || 0}
        tier={stickyTier}
        signal={verdict.label}
        visible={stickyVisible}
      />

      {/* ═══ ZONE B — LOT HERO ═══ */}
      <div ref={heroRef} style={{ display: 'grid', gridTemplateColumns: '360px 1fr', background: 'var(--bg-deep)', borderBottom: '0.5px solid var(--border)' }}>

        {/* B-LEFT — Image panel */}
        <div style={{ background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', borderRight: '0.5px solid var(--border)', gap: '16px', position: 'relative', minHeight: '400px' }}>
          {lot.image_url ? (
            <img src={lot.image_url} alt={lot.title}
              onLoad={() => setImgLoaded(true)}
              style={{ maxWidth: '300px', maxHeight: '340px', objectFit: 'contain', borderRadius: '4px', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s' }} />
          ) : (
            <div style={{ width: '180px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-inset)' }}>
              <span style={{ fontSize: '40px', opacity: 0.1 }}>◎</span>
            </div>
          )}
          {(lot.deal_score || 0) >= 80 && (
            <div style={{ position: 'absolute', top: '16px', left: '16px', padding: '3px 9px', background: 'rgba(198,168,90,0.1)', border: '0.5px solid rgba(198,168,90,0.35)', borderRadius: '4px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>EXCEPTIONAL</span>
            </div>
          )}
          <button
            onClick={() => {
              const params = new URLSearchParams({ lot: lot.id, img: lot.image_url || '', title: lot.title || '', artist: lot.artist_name_raw || '', w: String(lot.width_cm || 80), h: String(lot.height_cm || 60) });
              navigate(`/app/visualizer?${params.toString()}`);
            }}
            style={{ padding: '7px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: '6px', color: 'var(--text-3)', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}
          >
            🖼 Visualize in room
          </button>
        </div>

        {/* B-RIGHT — Info panel */}
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Artist + Title + Medium */}
          <div>
            <div
              onClick={() => navigate(`/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}`)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', cursor: 'pointer' }}>
              {lot.artist_name_raw || 'Unknown artist'}
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px,2.5vw,28px)', color: 'var(--text-1)', fontWeight: 600, margin: '0 0 6px', lineHeight: 1.15 }}>
              {lot.title || 'Untitled'}
            </h1>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', marginBottom: '4px' }}>
              {[lot.medium, lot.dimensions].filter(Boolean).join(' · ')}
            </div>
          </div>

          {/* 5 KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>

            {/* Signal */}
            <div style={{ background: 'var(--bg-inset)', border: `0.5px solid ${verdict.color}44`, borderRadius: '8px', padding: '14px 12px' }}>
              <div style={{ ...sLabel, marginBottom: '8px' }}>SIGNAL</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: verdict.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{verdict.icon} {verdict.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '5px', lineHeight: 1.4 }}>{verdict.sub}</div>
            </div>

            {/* Score */}
            <div style={{ background: 'var(--bg-inset)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '14px 12px' }}>
              <div style={{ ...sLabel, marginBottom: '8px' }}>SCORE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', fontWeight: 700, color: SCORE_COLOR(lot.deal_score || 0), lineHeight: 1 }}>{(lot.deal_score || 0).toFixed(0)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>/100</span>
              </div>
              <div style={{ marginTop: '7px', height: '2px', background: 'var(--border-dim)', borderRadius: '1px' }}>
                <div style={{ height: '100%', borderRadius: '1px', width: `${lot.deal_score || 0}%`, background: SCORE_COLOR(lot.deal_score || 0) }} />
              </div>
            </div>

            {/* Price */}
            <div style={{ background: 'var(--bg-inset)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '14px 12px' }}>
              <div style={{ ...sLabel, marginBottom: '8px' }}>{isUpcoming ? 'STARTING BID' : 'PRICE / ALL-IN'}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{fmt(price)}</div>
              {totalCost > price && (
                <div style={{ fontSize: '11px', color: 'var(--gold)', fontFamily: 'var(--font-mono)', marginTop: '4px', fontWeight: 700 }}>all-in {fmt(totalCost)}</div>
              )}
              {(estLow > 0 || estHigh > 0) && (
                <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>est. {fmt(estLow)}–{fmt(estHigh)}</div>
              )}
            </div>

            {/* Upside */}
            <div style={{ background: 'var(--bg-inset)', border: `0.5px solid ${upsidePct > breakEvenGain ? 'rgba(82,201,127,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: '8px', padding: '14px 12px' }}>
              <div style={{ ...sLabel, marginBottom: '8px' }}>UPSIDE / BREAK-EVEN</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: upsidePct > 0 ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>
                {upsidePct > 0 ? '+' : ''}{upsidePct.toFixed(0)}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: '4px', lineHeight: 1.4 }}>needs +{breakEvenGain.toFixed(0)}% break even</div>
              {netGain > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--green)', fontFamily: 'var(--font-mono)', marginTop: '2px', fontWeight: 700 }}>net +{netGain.toFixed(0)}% after costs</div>
              )}
            </div>

            {/* Risk */}
            <div style={{ background: 'var(--bg-inset)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '14px 12px' }}>
              <div style={{ ...sLabel, marginBottom: '8px' }}>RISK</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: riskLevel.color }}>{riskLevel.label}</div>
              {riskFlagCount > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '5px' }}>{riskFlagCount} flag{riskFlagCount > 1 ? 's' : ''} detected</div>
              )}
            </div>

          </div>

          {/* Signal strip */}
          {(cycleStage || (estBias && Math.abs(estBias.pct_above_low_estimate || 0) > 10) || hasConsignHigh || hasProvHighRisk) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {cycleStage && (
                <div style={{ padding: '4px 10px', background: 'var(--bg-inset)', border: '0.5px solid var(--border)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: cycleStage.color }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.06em' }}>CYCLE</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)' }}>{cycleStage.stage}</span>
                </div>
              )}
              {estBias && Math.abs(estBias.pct_above_low_estimate || 0) > 10 && (
                <div style={{ padding: '4px 10px', background: estBias.signal === 'bullish' ? 'rgba(82,201,127,0.07)' : 'rgba(248,113,113,0.07)', border: `0.5px solid ${estBias.signal === 'bullish' ? 'rgba(82,201,127,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: estBias.signal === 'bullish' ? 'var(--green)' : 'var(--red)', letterSpacing: '0.06em' }}>BIAS</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)' }}>
                    {estBias.signal === 'bullish' ? 'Underestimates' : 'Overestimates'} {Math.abs(estBias.pct_above_low_estimate || 0).toFixed(0)}%
                  </span>
                </div>
              )}
              {hasConsignHigh && (
                <div style={{ padding: '4px 10px', background: 'rgba(248,113,113,0.07)', border: '0.5px solid rgba(248,113,113,0.3)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--red)', letterSpacing: '0.06em' }}>⚠ SUPPLY ALERT</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)' }}>{consignAlert!.count} lots in 90 days</span>
                </div>
              )}
              {hasProvHighRisk && (
                <div style={{ padding: '4px 10px', background: 'rgba(248,113,113,0.07)', border: '0.5px solid rgba(248,113,113,0.3)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--red)', letterSpacing: '0.06em' }}>🔴 PROVENANCE RISK</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)' }}>{provRisk!.flags?.[0]?.label || 'Review required'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ ZONE C — DATA GRID ═══ */}
      <div style={{ padding: '24px 32px', background: 'var(--bg-deep)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: (realCost && hasMarketSignals) ? '1fr 1fr 1fr' : (realCost || hasMarketSignals) ? '1fr 1fr' : '1fr', gap: '16px' }}>

          {/* C1 — Real Cost Breakdown */}
          {realCost && (
            <div style={card}>
              <div style={sLabel}>REAL COST BREAKDOWN</div>
              {([
                { label: 'Hammer price',                                    value: price },
                { label: `Buyer's premium (${realCost.buyers_premium_pct}%)`, value: Math.round(realCost.cost_basis - price) },
                { label: 'Holding cost (3yr)',                              value: realCost.holding_cost_3y },
              ] as { label: string; value: number }[]).filter(item => item.value > 0).map(({ label, value }) => (
                <div key={label} style={rowSep}>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-1)', fontWeight: 500 }}>{fmt(value)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: '4px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 700 }}>All-in cost</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--gold)', fontWeight: 700 }}>{fmt(totalCost)}</span>
              </div>
              <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--bg-inset)', borderRadius: '6px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                  Needs +{breakEvenGain.toFixed(1)}% to break even
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--gold)', marginTop: '3px' }}>
                  Break-even hammer: {fmt(realCost.breakeven_hammer)}
                </div>
              </div>
            </div>
          )}

          {/* C2 — Market Signals */}
          {hasMarketSignals && (
            <div style={card}>
              <div style={sLabel}>MARKET SIGNALS</div>

              {cycleStage && (
                <div style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-inset)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>MARKET CYCLE</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: cycleStage.color, fontFamily: 'var(--font-mono)' }}>{cycleStage.icon} {cycleStage.stage}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: '0 0 4px', lineHeight: 1.5 }}>{cycleStage.description}</p>
                  {cycleStage.momentum_pct !== null && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: cycleStage.color }}>
                      12m: {cycleStage.momentum_pct > 0 ? '+' : ''}{cycleStage.momentum_pct}% · {cycleStage.total_sales} sales · {cycleStage.first_year}–{cycleStage.last_year}
                    </div>
                  )}
                </div>
              )}

              {estBias && (
                <div style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-inset)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>ESTIMATION BIAS</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: estBias.signal === 'bullish' ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                      {estBias.pct_above_low_estimate > 0 ? '+' : ''}{estBias.pct_above_low_estimate}%
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>{estBias.label} · {(estBias.sample_size || 0).toLocaleString()} sales</p>
                </div>
              )}

              {consignAlert && (
                <div style={{ padding: '12px', background: consignAlert.level === 'HIGH VOLUME' ? 'rgba(248,113,113,0.06)' : 'var(--bg-inset)', borderRadius: '6px', border: consignAlert.level === 'HIGH VOLUME' ? '0.5px solid rgba(248,113,113,0.25)' : '0.5px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>SUPPLY PRESSURE</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: consignAlert.level === 'HIGH VOLUME' ? 'var(--red)' : 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                      {consignAlert.level}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>{consignAlert.interpretation}</p>
                </div>
              )}
            </div>
          )}

          {/* C3 — Lot Details */}
          <div style={card}>
            <div style={sLabel}>LOT DETAILS</div>
            {([
              { label: 'Artist',     value: lot.artist_name_raw, nav: `/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}` },
              { label: 'Medium',     value: lot.medium },
              { label: 'Dimensions', value: lot.dimensions },
              { label: 'Category',   value: lot.category },
              { label: 'Estimate',   value: (estLow || estHigh) ? `${fmt(estLow)}–${fmt(estHigh)}` : null },
              { label: 'House',      value: lot.auction_house_name },
              { label: 'Sale date',  value: auctionDateFmt },
              { label: 'Lot #',      value: lot.lot_number },
              { label: 'Source',     value: sourceDisplay },
            ] as { label: string; value: string | null | undefined; nav?: string }[]).filter(({ value }) => value).map(({ label, value, nav }) => (
              <div key={label} style={rowSep}>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', minWidth: '72px', flexShrink: 0 }}>{label}</div>
                {nav ? (
                  <div onClick={() => navigate(nav)} style={{ fontSize: '12px', color: 'var(--blue-link)', cursor: 'pointer', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{value}</div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{value}</div>
                )}
              </div>
            ))}

            {/* Provenance alert */}
            {provRisk && (
              <div style={{ marginTop: '16px', padding: '10px 14px', background: provRisk.level === 'HIGH RISK' ? 'rgba(248,113,113,0.06)' : 'rgba(234,179,8,0.06)', borderRadius: '8px', border: `0.5px solid ${provRisk.level === 'HIGH RISK' ? 'rgba(248,113,113,0.25)' : 'rgba(234,179,8,0.25)'}` }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: provRisk.level === 'HIGH RISK' ? 'var(--red)' : 'var(--amber)', marginBottom: '8px' }}>
                  DUE DILIGENCE · {provRisk.level}
                </div>
                {(provRisk.flags as { code: string; severity: string; label: string; detail: string }[]).map(f => (
                  <div key={f.code} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: f.severity === 'HIGH' ? 'var(--red)' : f.severity === 'MEDIUM' ? 'var(--amber)' : 'var(--text-3)', flexShrink: 0, marginTop: '4px' }} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: f.severity === 'HIGH' ? 'var(--red)' : f.severity === 'MEDIUM' ? 'var(--amber)' : 'var(--text-3)' }}>{f.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', lineHeight: 1.5 }}>{f.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ ZONE D — AI INTELLIGENCE ═══ */}
      <div style={{ padding: '24px 32px', background: 'var(--bg-deep)', borderTop: '0.5px solid var(--border)' }}>
        <div style={sLabel}>AI INTELLIGENCE</div>

        {/* Generate Memo button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={memo ? () => setShowMemo(true) : generateMemo}
            disabled={memoLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: '#162040', border: '0.5px solid #2A4480', borderRadius: '8px', color: memoLoading ? 'var(--text-3)' : '#7EB0F0', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', cursor: memoLoading ? 'not-allowed' : 'pointer', textTransform: 'uppercase' }}
          >
            <span>◆</span>
            {memoLoading ? 'GENERATING…' : memo ? 'VIEW INVESTMENT MEMO' : 'GENERATE INVESTMENT MEMO'}
          </button>
          {memo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ padding: '4px 12px', background: memo.recommendation === 'BUY' ? 'rgba(82,201,127,0.1)' : memo.recommendation === 'WATCH' ? 'rgba(251,191,36,0.1)' : 'rgba(107,114,128,0.1)', border: `0.5px solid ${memo.recommendation === 'BUY' ? 'rgba(82,201,127,0.3)' : memo.recommendation === 'WATCH' ? 'rgba(251,191,36,0.3)' : 'rgba(107,114,128,0.3)'}`, fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: memo.recommendation === 'BUY' ? 'var(--green)' : memo.recommendation === 'WATCH' ? 'var(--amber)' : 'var(--text-3)', borderRadius: '4px' }}>{memo.recommendation}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>Conviction {memo.conviction}/100</span>
            </div>
          )}
        </div>

        {/* Investment Dossier card */}
        {!canSeeAI && (
          <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-inset)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '16px' }}>◎</span>
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', color: 'var(--text-1)', marginBottom: '4px' }}>Investment Dossier</div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', background: '#1A1A2E', border: '0.5px solid #3D3D6B', color: '#A0A0CF', padding: '2px 8px', borderRadius: '4px' }}>FAMILY OFFICE+</span>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', flex: 1, maxWidth: '260px', lineHeight: 1.5 }}>
              Full analysis — 5/10/20yr projections · artist valuation · AI verdict
            </div>
            <button
              onClick={() => navigate('/app/pricing?plan=investor')}
              style={{ padding: '10px 18px', background: '#1E3A5F', border: '0.5px solid #2A4480', color: 'var(--text-1)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', borderRadius: '6px', whiteSpace: 'nowrap', textTransform: 'uppercase' }}
            >
              + ANALYZE
            </button>
          </div>
        )}

        {/* AI Analyst */}
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
                  <div style={{ flex: 1, height: '44px', background: 'var(--bg-inset)', border: '0.5px solid var(--border)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 800, color: 'var(--text-3)', letterSpacing: '0.12em' }}>STRONG BUY</span>
                  </div>
                  <div style={{ padding: '8px 16px', background: 'var(--bg-inset)', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>Confidence: HIGH</span>
                  </div>
                </div>
                <div style={{ height: '10px', background: 'var(--bg-inset)', marginBottom: '8px', width: '80%', borderRadius: '4px' }} />
                <div style={{ height: '10px', background: 'var(--bg-inset)', width: '60%', borderRadius: '4px' }} />
              </div>
            }
          />
        ) : (
          <LockedBlock
            title="Know exactly what to do before you buy"
            teaser="Our AI analyzes every signal — artist valuation, comparable sales, market timing — and gives you a clear verdict: STRONG BUY, BUY, WATCH, or PASS."
            ctaText="Unlock Investment Dossier"
            ctaPrice="From €49/month"
            planId="investor"
            preview={
              <div style={{ display: 'flex', gap: '8px' }}>
                {['Verdict', 'Confidence', 'Risk'].map(l => (
                  <div key={l} style={{ flex: 1, padding: '16px', background: 'var(--bg-inset)', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>{l}</div>
                    <div style={{ height: '16px', background: 'var(--border-dim)', borderRadius: '3px' }} />
                  </div>
                ))}
              </div>
            }
          />
        )}
      </div>

      {/* ═══ ZONE E — NAUTILUS ANALYSIS ═══ */}
      {analysisText && (
        <div style={{ padding: '20px 32px', background: 'var(--bg-deep)', borderTop: '0.5px solid var(--border)' }}>
          <div style={{ maxWidth: '800px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '12px' }}>◆ NAUTILUS ANALYSIS</div>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>{analysisText}</p>
          </div>
        </div>
      )}

      {/* ═══ ZONE F — INVESTMENT ANALYSIS ═══ */}
      {canSeeAnalysis ? (
        <div style={{ padding: '24px 32px', background: 'var(--bg-deep)', borderTop: '0.5px solid var(--border)' }}>
          <div style={sLabel}>INVESTMENT ANALYSIS</div>

          {/* 3 metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
            {[
              { label: 'CURRENT PRICE', value: fmt(price),  sub: 'What you pay',     inset: false },
              { label: 'FAIR VALUE',    value: fmt(fairVal), sub: 'Market estimate',  inset: true  },
              { label: 'UPSIDE',        value: upsidePct > 0 ? `+${upsidePct.toFixed(0)}%` : 'At market', sub: 'vs estimate', inset: false },
            ].map(({ label, value, sub, inset }) => (
              <div key={label} style={{ background: inset ? 'var(--bg-inset)' : 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '12px' }}>{label}</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '28px', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '8px' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Investment Case + Key Risks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'var(--bg-inset)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>INVESTMENT CASE</div>
              {[
                upsidePct > 20 ? `${upsidePct.toFixed(0)}% below market estimate` : 'Priced at or near market rate',
                lot.deal_score >= 70 ? `Strong deal score (${lot.deal_score}/100)` : `Moderate signal (${lot.deal_score || 0}/100)`,
                lot.auction_house_name ? `Listed at ${lot.auction_house_name.split('—')[0].trim()}` : 'Verified auction platform',
              ].map((text, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--blue-link)', fontSize: '12px', flexShrink: 0 }}>→</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--bg-inset)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>KEY RISKS</div>
              {[
                { text: 'Limited resale liquidity for niche artists', sev: 'MED' },
                { text: 'Auction estimate may be optimistic', sev: 'MED' },
                { text: 'Market illiquidity in niche categories', sev: 'HIGH' },
              ].map((risk, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: risk.sev === 'HIGH' ? 'var(--red)' : 'var(--amber)', background: risk.sev === 'HIGH' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)', border: `0.5px solid ${risk.sev === 'HIGH' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)'}`, padding: '2px 6px', flexShrink: 0, marginTop: '1px', fontFamily: 'var(--font-mono)', borderRadius: '3px' }}>{risk.sev}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5 }}>{risk.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '24px 32px', background: 'var(--bg-deep)', borderTop: '0.5px solid var(--border)' }}>
          <LockedBlock
            title="Is this artwork truly worth buying?"
            teaser="Unlock fair value analysis, upside potential, market signals, and 5-year price projections before you decide."
            ctaText="Unlock Investment Analysis"
            ctaPrice="From €9/month"
            planId="starter"
            preview={
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                {['Current Price', 'Fair Value', 'Upside %'].map(l => (
                  <div key={l} style={{ padding: '20px', background: 'var(--bg-inset)', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>{l}</div>
                    <div style={{ height: '20px', background: 'var(--border-dim)', borderRadius: '3px' }} />
                  </div>
                ))}
              </div>
            }
          />
        </div>
      )}

      {/* ═══ ZONE G — FUTURE VALUE PROJECTIONS ═══ */}
      {canSeeAnalysis && visibleYears.length > 0 && (
        <div style={{ padding: '24px 32px', background: 'var(--bg-deep)', borderTop: '0.5px solid var(--border)' }}>
          <div style={{ ...card }}>
            <div style={sLabel}>FUTURE VALUE PROJECTIONS · 7% CAGR</div>
            {visibleYears.map((y: number) => (
              <ProjectionRow key={y} year={`${y}Y`} value={proj(y)} base={price} maxVal={maxProjVal} />
            ))}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', marginTop: '8px', lineHeight: 1.6, fontStyle: 'italic' }}>
              Projections are indicative only. Art investment carries significant risk. Not financial advice.
            </p>
          </div>
        </div>
      )}

      {/* ═══ ZONE H — COMPARABLE SALES ═══ */}
      {displayComps.length > 0 && (
        <div style={{ padding: '24px 32px 32px', background: 'var(--bg-deep)', borderTop: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={sLabel}>{compsLabel}</div>
            {comparables?.market_analysis && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-2)' }}>
                  Comps avg: <strong style={{ color: 'var(--text-1)' }}>€{comparables.market_analysis.market_avg_price?.toLocaleString('en-GB')}</strong>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: comparables.market_analysis.price_gap_pct > 0 ? 'var(--green)' : 'var(--red)' }}>
                  {comparables.market_analysis.price_gap_pct > 0 ? '+' : ''}{comparables.market_analysis.price_gap_pct}% vs this lot
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(displayComps.length, 3)}, 1fr)`, gap: '12px' }}>
            {displayComps.map((comp: any) => {
              const compPrice = comp.current_price || comp.estimate_low || 0;
              return (
                <div key={comp.id}
                  className="comp-card"
                  onClick={() => navigate(`/app/opportunities/${comp.id}`)}
                  style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s' }}
                >
                  {comp.image_url ? (
                    <div style={{ height: '120px', overflow: 'hidden', background: 'var(--bg-inset)' }}>
                      <img src={comp.image_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ height: '120px', background: 'var(--bg-inset)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '28px', opacity: 0.1 }}>◎</span>
                    </div>
                  )}
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {comp.artist_name_raw || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-1)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                      {comp.title || 'Untitled'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--gold)' }}>€{compPrice.toLocaleString('en-GB')}</span>
                      {comp.deal_score && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
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
      )}

      {/* ═══ ZONE I — FOOTER DISCLAIMER ═══ */}
      <div style={{ padding: '16px 32px', background: 'var(--bg-base)', borderTop: '0.5px solid var(--border)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textAlign: 'center', margin: 0, letterSpacing: '0.1em' }}>
          NOT FINANCIAL ADVICE · FOR INFORMATIONAL PURPOSES ONLY · NAUTILUS DATA AGGREGATED FROM PUBLIC AUCTION SOURCES
        </p>
      </div>

      {/* ── INVESTMENT MEMO MODAL ─────────────────────────────────────────────── */}
      {showMemo && memo && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(12,22,34,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowMemo(false); }}
        >
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ background: 'var(--bg-inset)', padding: '24px 32px', borderRadius: '12px 12px 0 0', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    NAUTILUS · INVESTMENT MEMO
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', color: 'var(--text-1)', marginBottom: '4px' }}>{memo.title}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{memo.artist}</div>
                </div>
                <button onClick={() => setShowMemo(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '20px', cursor: 'pointer', padding: '0', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '20px' }}>
                {[
                  { label: 'CURRENT PRICE', value: memo.current_price >= 1000 ? `€${(memo.current_price / 1000).toFixed(0)}K` : `€${memo.current_price}` },
                  { label: 'TARGET LOW',    value: memo.target_price?.low  ? `€${(memo.target_price.low  / 1000).toFixed(0)}K` : 'N/A' },
                  { label: 'TARGET HIGH',   value: memo.target_price?.high ? `€${(memo.target_price.high / 1000).toFixed(0)}K` : 'N/A' },
                  { label: 'CONVICTION',    value: `${memo.conviction}/100` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-3)', letterSpacing: '0.12em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-1)' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '28px 32px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', padding: '14px 16px', background: memo.recommendation === 'BUY' ? 'rgba(82,201,127,0.08)' : memo.recommendation === 'WATCH' ? 'rgba(251,191,36,0.08)' : 'var(--bg-inset)', borderRadius: '8px', border: `0.5px solid ${memo.recommendation === 'BUY' ? 'rgba(82,201,127,0.25)' : memo.recommendation === 'WATCH' ? 'rgba(251,191,36,0.25)' : 'var(--border)'}` }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: memo.recommendation === 'BUY' ? 'var(--green)' : memo.recommendation === 'WATCH' ? 'var(--amber)' : 'var(--text-3)' }}>
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
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>{title}</div>
                  <p style={{ fontSize: '14px', color: 'var(--text-1)', lineHeight: 1.8, margin: 0 }}>{content}</p>
                </div>
              ))}
              {memo.risks && memo.risks.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>Key Risks</div>
                  {memo.risks.map((risk: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--red)', fontSize: '12px', marginTop: '2px', flexShrink: 0 }}>▲</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>{risk}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                  Nautilus Intelligence · {new Date(memo.generated_at).toLocaleDateString('en-GB')}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
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
