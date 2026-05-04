import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getPlanLimits, getToken, getUserPlan } from '../../lib/auth';
import { AIAnalyst } from '../components/AIAnalyst';
import {
  ComposedChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// ── TOKENS ────────────────────────────────────────────────────────────────────
const DK  = '#0C1622';
const DK2 = '#111827';
const DK4 = '#0F1923';
const DKB = '#2D3748';
const LT  = '#F5F3EE';
const LTC = '#FFFFFF';
const LTB = '#E8E4DD';
const LTT1 = '#111827';
const LTT2 = '#4B5563';
const LTT3 = '#9CA3AF';
const GOLD = '#C6A85A';
const GD   = '#52C97F';   // green on dark
const GL   = '#1A7F4B';   // green on light
const BL   = '#1D6EBF';   // blue link on light
const BLD  = '#60A5FA';   // blue on dark
const AMB  = '#D97706';
const RED  = '#DC2626';

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

// ── LOCKED BLOCK (light theme) ────────────────────────────────────────────────

function LockedBlock({ preview }: {
  title: string; teaser: string; ctaText: string; ctaPrice: string;
  planId: string; preview?: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative', border: `1px solid ${LTB}`, borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ filter: 'blur(4px)', pointerEvents: 'none', padding: '24px', userSelect: 'none' }}>
        {preview || (
          <div style={{ display: 'flex', gap: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, height: '72px', background: LT, borderRadius: '8px' }} />
            ))}
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <span onClick={() => window.location.href = '/app/pricing'} style={{ cursor: 'pointer', background: '#1A2A44', color: '#C6A85A', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', padding: '8px 18px', borderRadius: 3 }}>
          INVESTOR+ · UNLOCK →
        </span>
      </div>
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
  const [showLightbox, setShowLightbox]   = useState(false);
  const [memoLoading, setMemoLoading]     = useState(false);
  const [memo, setMemo]                   = useState<any>(null);
  const [showMemo, setShowMemo]           = useState(false);
  const [comparables, setComparables]     = useState<any[]>([]);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [isDailyDeal, setIsDailyDeal]     = useState(false);
  const [activeTab, setActiveTab]         = useState('overview');
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/lots/daily-unlock`)
      .then(r => r.json())
      .then(data => { if (data?.id && data.id === id) setIsDailyDeal(true); })
      .catch(() => {});
  }, [id]);

  const limits         = getPlanLimits();
  const plan           = isDailyDeal ? 'investor' : getUserPlan();
  const hasAccess      = isDailyDeal || ["investor", "pro", "elite", "institutional"].includes(plan);
  const canSeeAnalysis = isDailyDeal || limits.hasProjections || limits.hasArtistCotation;
  const canSeeAI       = isDailyDeal || limits.hasAIVerdict;
  const visibleYears   = isDailyDeal ? [5, 10, 20] : (limits.projectionYears || []);

  const generateMemo = async () => {
    if (!lot?.id) return;
    setMemoLoading(true);
    try {
      const resp = await fetch(
        `https://artalpha-backend-production.up.railway.app/api/memo/${lot.id}`,
        { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } }
      );
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
    }).then(r => r.json()).then(data => setComparables(data.comparables || [])).catch(() => {});
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowLightbox(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return (
    <div style={{position:'fixed',inset:0,background:'#FAFAF8',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
      <span style={{fontFamily:'Georgia,serif',fontSize:13,letterSpacing:'0.3em',color:'#1A2A44',opacity:0.5,textTransform:'uppercase',animation:'fade 1.4s ease-in-out infinite'}}>
        Scanning...
      </span>
      <style>{'@keyframes fade{0%,100%{opacity:0.3}50%{opacity:0.8}}'}</style>
    </div>
  );

  if (!lot) return (
    <div style={{ minHeight: '100vh', background: DK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', color: '#F0EDE6', marginBottom: '6px' }}>Artwork not found</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6B7280', marginBottom: '24px', letterSpacing: '0.08em' }}>The requested lot does not exist or has been removed.</div>
        <button onClick={() => navigate(-1)} style={{ padding: '11px 24px', background: DK2, border: `0.5px solid ${DKB}`, color: '#F0EDE6', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', borderRadius: '6px' }}>
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
  // Use API projections when available, fallback to CAGR calc
  const _projMap: Record<number, { projected_value_eur: number; gain_pct: number }> = {};
  if (Array.isArray(lot.projection?.years)) {
    for (const p of lot.projection.years) _projMap[p.years] = p;
  }
  const projCagr = lot.projection?.cagr_pct || 7;
  const proj      = (years: number): number =>
    _projMap[years]?.projected_value_eur ?? Math.round(price * Math.pow(1 + projCagr / 100, years));
  const projGainPct = (years: number): number =>
    _projMap[years]?.gain_pct ?? (price > 0 ? ((proj(years) - price) / price) * 100 : 0);

  const isUpcoming = lot.status === 'upcoming' || lot.status === 'preview' ||
    (lot.auction_date && new Date(lot.auction_date) > new Date() && !lot.status);

  const source = String(lot.source || '').toLowerCase();
  const sourceNames: Record<string, string> = {
    drouot: 'Drouot', interencheres: 'Interenchères', invaluable: 'Invaluable',
    sothebys: "Sotheby's", christies: "Christie's", bonhams: 'Bonhams',
    liveauctioneers: 'LiveAuctioneers', ebay: 'eBay', artsy: 'Artsy',
  };
  const flags: Record<string, string> = {
    drouot: '🇫🇷', interencheres: '🇫🇷', invaluable: '🇺🇸',
    sothebys: '🇬🇧', christies: '🇬🇧', bonhams: '🇬🇧',
    liveauctioneers: '🇺🇸', ebay: '🌐', artsy: '🌐',
  };

  const formatSource = (src: string, house?: string) => {
    if (!src || src === 'other' || src === 'unknown') return house || '—';
    return src;
  };
  const resolvedSource = formatSource(source, lot.auction_house_name);
  const sourceLabel = `${flags[resolvedSource.toLowerCase()] || ''} ${sourceNames[resolvedSource.toLowerCase()] || resolvedSource}`.trim();

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
  const rawUrl     = lot.url || lot.source_url || '';
  const NON_ART    = ['vehicule', 'voiture', 'moto', 'electromenager', 'cuisine', 'ixina'];
  const isValidUrl = rawUrl && rawUrl.startsWith('http') && !NON_ART.some((w: string) => rawUrl.toLowerCase().includes(w));
  const externalUrl = isValidUrl ? rawUrl : (sourceSearch[source] || `https://www.google.com/search?q=${artistEnc}+${source}`);
  const trackUrl   = lot.id ? `${BACKEND}/api/track/${lot.id}` : externalUrl;

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
      return { label: 'HIGH RISK', dk: '#EF4444', gl: RED,  icon: '⚠', sub: 'Provenance issue detected' };
    if ((lot.deal_score || 0) >= 80 && upsidePct >= 20 && !hasCycleRisk)
      return { label: 'BUY',       dk: GD,        gl: GL,   icon: '↑', sub: 'Strong conviction signal' };
    if ((lot.deal_score || 0) >= 65 && upsidePct >= 10)
      return { label: 'WATCH',     dk: '#FBBF24',  gl: AMB,  icon: '◎', sub: 'Monitor closely' };
    if ((lot.deal_score || 0) < 50 || upsidePct < 0)
      return { label: 'PASS',      dk: '#EF4444',  gl: RED,  icon: '↓', sub: 'Below conviction threshold' };
    return   { label: 'WATCH',     dk: '#FBBF24',  gl: AMB,  icon: '◎', sub: 'Insufficient signal' };
  })();

  const riskFlagCount = ([hasProvHighRisk, hasConsignHigh, !!(estBias && Math.abs(estBias.pct_above_low_estimate || 0) > 50)] as boolean[]).filter(Boolean).length;
  const riskColor = riskFlagCount >= 2 ? GD : riskFlagCount === 1 ? '#FBBF24' : GD;
  const riskLabel = riskFlagCount >= 2 ? 'HIGH RISK' : riskFlagCount === 1 ? 'MODERATE' : 'LOW RISK';

  const dealScore     = lot.deal_score || 0;
  const stickyTier    = dealScore >= 80 ? 'EXCEPTIONAL' : dealScore >= 65 ? 'STRONG' : 'INTERESTING';
  const totalCost     = realCost ? realCost.cost_basis : price;
  const breakEvenGain = realCost ? realCost.needed_gain_pct : 26;
  const netGain       = upsidePct - breakEvenGain;

  // Analysis text
  const rawAnalysis = lot.score_rationale || lot.nautilus_analysis || '';
  const analysisText = rawAnalysis && !isFrench(rawAnalysis)
    ? rawAnalysis
    : upside > 0
    ? `${Math.round(upside)}% below market estimate — undervalued acquisition with strong artist liquidity signal. ${lot.auction_house_name ? lot.auction_house_name.split('—')[0].trim() + ' auction history suggests consistent sell-through for this category.' : ''}`
    : null;

  // Comparables
  const allComps: any[] = comparables;
  const sameArtistComps = allComps.filter((c: any) =>
    c.artist_name_raw?.toLowerCase().trim() === (lot.artist_name_raw || '').toLowerCase().trim()
  );
  const displayComps = sameArtistComps.length >= 2 ? sameArtistComps.slice(0, 3) : allComps.slice(0, 3);
  const compsLabel   = sameArtistComps.length >= 2 ? 'COMPARABLE SALES' : 'SIMILAR WORKS';

  // Projection bar width: proportional to max value
  const maxProjVal = visibleYears.length > 0 ? proj(Math.max(...visibleYears)) : proj(20);

  // Shared section label
  const sl: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em',
    textTransform: 'uppercase', color: LTT3, marginBottom: '16px',
  };

  // White card style
  const wCard: React.CSSProperties = {
    background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '22px 24px',
  };

  // Light data row
  const dRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '9px 0', borderBottom: `1px solid #F0EDE6`,
  };

  // ── TABS ─────────────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'overview',     label: 'Overview' },
    { key: 'comparables',  label: 'Comparables' },
    { key: 'analysis',     label: 'Analysis' },
    { key: 'documents',    label: 'Documents' },
  ];

  // ── COMPARABLES CHART DATA ────────────────────────────────────────────────────
  const compChartData: any[] = comparables
    .map((c: any) => ({
      x: c.auction_date ? new Date(c.auction_date).getFullYear() + (new Date(c.auction_date).getMonth() / 12) : null,
      y: c.current_price || c.estimate_low,
      id: c.id,
      title: c.title,
    }))
    .filter((c: any) => c.x && c.y);

  const currentLotChartDot: any[] = [{
    x: lot.auction_date
      ? new Date(lot.auction_date).getFullYear() + (new Date(lot.auction_date).getMonth() / 12)
      : new Date().getFullYear(),
    y: price,
    isCurrent: true,
  }];

  // Custom dot renderer for current lot
  const CurrentDot = (props: any) => {
    const { cx, cy } = props;
    return <circle cx={cx} cy={cy} r={8} fill={GOLD} stroke="#FFFFFF" strokeWidth={2} />;
  };

  // Comps stats
  const compsAvgPrice = comparables.length > 0
    ? Math.round(comparables.reduce((s: number, c: any) => s + (c.current_price || 0), 0) / comparables.length)
    : 0;

  // Score pillars — real data from artist + lot
  const scorePillars = [
    { label: 'Pricing',    value: Math.min(100, Math.max(0, Math.round((lot.pct_below_low_estimate || 0) * 1.2))) },
    { label: 'Liquidity',  value: Math.min(100, Math.round(lot.artist?.liquidity_score ?? 50)) },
    { label: 'Momentum',   value: lot.artist?.trend === 'up' ? 80 : lot.artist?.trend === 'down' ? 20 : Math.round(lot.deal_score || 50) },
    { label: 'Sell-thru',  value: lot.artist?.sell_through_rate != null ? Math.min(100, Math.round(lot.artist.sell_through_rate * 100)) : 50 },
  ];

  return (
    <div style={{ minHeight: '100vh', background: LT }}>
      <style>{`
        @keyframes bpulse{0%,100%{height:8px;opacity:0.3}50%{height:28px;opacity:1}}
        @keyframes dot{0%,100%{opacity:1}50%{opacity:0.3}}
        .comp-card-light { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .comp-card-light:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        .tab-nav-btn { background: none; border: none; cursor: pointer; padding: 0 4px 12px; position: relative; }
        .tab-nav-btn:focus { outline: none; }
      `}</style>

      {/* ═══ STICKY BAR — fixed, fades in ═══ */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: DK, borderBottom: `0.5px solid ${DKB}`,
        height: '46px', padding: '0 32px',
        display: 'flex', alignItems: 'center', gap: '12px',
        opacity: stickyVisible ? 1 : 0,
        pointerEvents: stickyVisible ? 'auto' : 'none',
        transition: 'opacity 0.18s ease',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', padding: '0 12px 0 0', borderRight: `0.5px solid ${DKB}`, height: '46px', display: 'flex', alignItems: 'center' }}>
          ← BACK
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>{lot.artist_name_raw || ''}</div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '13px', color: '#F0EDE6', lineHeight: 1.3, marginTop: '2px' }}>{lot.title || 'Untitled'}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ background: '#162040', border: '0.5px solid #2A4480', color: '#7EB0F0', fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '3px 9px', borderRadius: '4px', fontWeight: 700 }}>{verdict.label}</span>
          <span style={{ background: '#1C2E1C', border: '0.5px solid #3D6B3D', color: '#6FCF6F', fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '3px 9px', borderRadius: '4px', fontWeight: 700 }}>{dealScore.toFixed(1)} / 100 · {stickyTier}</span>
        </div>
      </div>

      {/* ═══ HERO — dark ═══ */}
      <div ref={heroRef} style={{ background: DK, display: 'grid', gridTemplateColumns: '35% 65%' }}>

        {/* LEFT — image panel */}
        <div style={{ background: DK4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: '8px', gap: '16px', borderRight: `0.5px solid ${DKB}`, position: 'relative' }}>
          {/* Back button (top-left) */}
          <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: '16px', left: '16px', background: 'none', border: `0.5px solid ${DKB}`, color: '#6B7280', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', padding: '5px 10px', borderRadius: '4px' }}>
            ← BACK
          </button>
          {lot.image_url ? (
            <img src={lot.image_url} alt={lot.title}
              onLoad={() => setImgLoaded(true)}
              onClick={() => setShowLightbox(true)}
              style={{ width: '100%', height: 'auto', maxHeight: '420px', objectFit: 'contain', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s', cursor: 'pointer' }} />
          ) : (
            <div style={{ width: '200px', height: '260px', background: DK2, border: `0.5px solid ${DKB}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '40px', opacity: 0.08 }}>◎</span>
            </div>
          )}
        </div>

        {/* RIGHT — info panel */}
        <div style={{ padding: '36px 32px 36px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* EXCEPTIONAL badge */}
          {dealScore >= 80 && (
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start' }}>
              <span style={{ background: 'rgba(198,168,90,0.1)', border: '0.5px solid rgba(198,168,90,0.4)', color: GOLD, fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', padding: '3px 10px', borderRadius: '4px', textTransform: 'uppercase' }}>
                EXCEPTIONAL
              </span>
            </div>
          )}

          {/* Artist / Title / Medium */}
          <div>
            <div
              onClick={() => navigate(`/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}`)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px', cursor: 'pointer' }}>
              {lot.artist_name_raw || 'Unknown artist'}
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(24px, 2.5vw, 30px)', color: '#F0EDE6', fontWeight: 600, margin: '0 0 8px', lineHeight: 1.15 }}>
              {lot.title || 'Untitled'}
            </h1>
            <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic' }}>
              {[lot.medium, lot.auction_house_name?.split('—')[0].trim()].filter(Boolean).join(' · ')}
            </div>
          </div>

          {/* 5 KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>

            {/* SIGNAL */}
            <div style={{ background: DK2, border: `0.5px solid ${DKB}`, borderRadius: '8px', padding: '13px 12px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>SIGNAL</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: verdict.dk, lineHeight: 1 }}>{verdict.icon} {verdict.label}</div>
              <div style={{ fontSize: '9px', color: '#6B7280', marginTop: '5px', lineHeight: 1.4 }}>{verdict.sub}</div>
              {lot.oracle?.signal && (
                <div style={{ marginTop: '7px', fontFamily: 'var(--font-mono)', fontSize: '8px', color: lot.oracle.signal === 'BUY_NOW' ? '#4ADE80' : lot.oracle.signal === 'AVOID' ? '#F87171' : '#FCD34D', fontWeight: 700, letterSpacing: '0.08em' }}>
                  ◆ ORACLE: {lot.oracle.signal === 'BUY_NOW' ? 'BUY NOW' : lot.oracle.signal}
                </div>
              )}
            </div>

            {/* SCORE */}
            <div style={{ background: DK2, border: `0.5px solid ${DKB}`, borderRadius: '8px', padding: '13px 12px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>SCORE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', fontWeight: 700, color: GOLD, lineHeight: 1 }}>{dealScore.toFixed(0)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6B7280' }}>/100</span>
              </div>
              <div style={{ marginTop: '7px', height: '2px', background: DKB, borderRadius: '1px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '1px', width: `${dealScore}%`, background: GOLD }} />
              </div>
            </div>

            {/* STARTING BID / PRICE */}
            <div style={{ background: DK2, border: `0.5px solid ${DKB}`, borderRadius: '8px', padding: '13px 12px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>{isUpcoming ? 'STARTING BID' : 'PRICE'}</div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', fontWeight: 700, color: '#F0EDE6', lineHeight: 1 }}>{fmt(price)}</div>
              {totalCost > price && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: GOLD, marginTop: '4px' }}>all-in {fmt(totalCost)}</div>
              )}
              {(estLow > 0 || estHigh > 0) && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>est. {fmt(estLow)}–{fmt(estHigh)}</div>
              )}
            </div>

            {/* UPSIDE */}
            <div style={{ background: DK2, border: `0.5px solid ${DKB}`, borderRadius: '8px', padding: '13px 12px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>UPSIDE</div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', fontWeight: 700, color: upsidePct > 0 ? GD : '#EF4444', lineHeight: 1 }}>
                {upsidePct > 0 ? '+' : ''}{upsidePct.toFixed(0)}%
              </div>
              {netGain > 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: GD, marginTop: '4px' }}>net +{netGain.toFixed(0)}% after costs</div>
              )}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>needs +{breakEvenGain.toFixed(0)}% breakeven</div>
            </div>

            {/* RISK */}
            <div style={{ background: DK2, border: `0.5px solid ${DKB}`, borderRadius: '8px', padding: '13px 12px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>RISK</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: riskColor, lineHeight: 1 }}>{riskLabel}</div>
              {riskFlagCount > 0 && (
                <div style={{ fontSize: '9px', color: '#6B7280', marginTop: '5px' }}>{riskFlagCount} flag{riskFlagCount > 1 ? 's' : ''}</div>
              )}
            </div>

          </div>

          {/* WHY block */}
          {(() => {
            const reasons: string[] = [];
            if ((lot.pct_below_low_estimate || 0) > 30)
              reasons.push(`${Math.round(lot.pct_below_low_estimate)}% below estimate — entry at €${lot.current_price} vs market estimate €${lot.estimate_high}`);
            if ((lot.pct_below_low_estimate || 0) < -5)
              reasons.push("Priced above market estimate — limited upside");
            if ((lot.deal_score || 0) >= 80)
              reasons.push("Top 5% conviction score this month");
            if ((lot.deal_score || 0) < 45)
              reasons.push("Low conviction — fees may exceed upside");
            if ((provRisk?.flags?.length || 0) > 0)
              reasons.push("Due diligence flags detected — verify before bidding");
            if (lot.oracle?.signal === 'BUY_NOW')
              reasons.push(`Oracle signal: BUY NOW — ${lot.oracle.narrative || 'strong conviction'}`);
            if (lot.oracle?.signal === 'AVOID')
              reasons.push(`Oracle signal: AVOID — ${lot.oracle.narrative || 'below conviction threshold'}`);
            if ((lot.real_cost?.breakeven_pct || 0) > 60)
              reasons.push(`Break-even at €${lot.real_cost?.breakeven_hammer} — needs only ${Math.round(lot.real_cost?.breakeven_pct)}% appreciation`);
            const currencySymbol = (lot.currency === 'USD') ? '$' : (lot.currency === 'GBP') ? '£' : '€';
            const compsAvg = comparables.length > 0
              ? Math.round(comparables.reduce((s: number, c: any) => s + (c.current_price || 0), 0) / comparables.length)
              : null;
            if (compsAvg && compsAvg > lot.current_price)
              reasons.push(`Comparable works average ${currencySymbol}${compsAvg.toLocaleString()} — ${Math.round((compsAvg / lot.current_price - 1) * 100)}% above this entry price`);
            const isBuy = (lot.deal_score || 0) >= 65;
            const whyLabel = isBuy ? "WHY BUY" : "WHY PASS";
            const whyColor = isBuy ? "#C6A85A" : "#F87171";
            if (reasons.length === 0) return null;
            return (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 16px', marginTop: 14 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', color: whyColor, marginBottom: 8, textTransform: 'uppercase' as const }}>
                  {whyLabel}
                </div>
                {reasons.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>
                    → {r}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Market narrative */}
          <p style={{ fontSize: 13, fontStyle: 'italic', color: '#6B7280', marginTop: 8 }}>
            {(lot.deal_score || 0) >= 80
              ? `Strong buy signal at ${lot.auction_house_name || 'this auction house'} — top conviction tier.`
              : (lot.deal_score || 0) >= 65
              ? `Solid opportunity at ${lot.auction_house_name || 'this auction house'} — above average for this category.`
              : (lot.deal_score || 0) >= 45
              ? `Moderate signal — monitor as auction date approaches.`
              : `Below threshold — better opportunities currently available.`}
          </p>

          {/* External link */}
          <div>
            {!hasAccess ? (
              <span onClick={() => { window.location.href = '/app/pricing'; }} style={{ cursor: 'pointer', color: '#2563EB', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>🔒 Unlock source — Investor plan →</span>
            ) : (
              <a href={trackUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: BLD, textDecoration: 'none', letterSpacing: '0.06em' }}>
                View on {sourceNames[source] || resolvedSource} ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ═══ TAB NAVIGATION BAR ═══ */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: `1px solid ${LTB}`,
        padding: '0 40px',
        display: 'flex',
        gap: '32px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className="tab-nav-btn"
            onClick={() => setActiveTab(tab.key)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.06em',
              color: activeTab === tab.key ? LTT1 : LTT3,
              fontWeight: activeTab === tab.key ? 700 : 400,
              paddingTop: '14px',
              borderBottom: activeTab === tab.key ? `2px solid ${GOLD}` : '2px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ LIGHT ZONE (tab content) ═══ */}
      <div style={{ background: LT }}>

        {/* ──────────────── OVERVIEW TAB ──────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* ── MINI ARTIST CARD ────────────────────────────────────────────── */}
            {lot.artist_name_raw && (
              <div style={{ padding: '20px 40px 0' }}>
                <div
                  onClick={() => navigate(`/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}`)}
                  className="comp-card-light"
                  style={{
                    background: LTC, border: `1px solid ${LTB}`, borderRadius: '10px',
                    padding: '14px 20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '16px',
                  }}
                >
                  {/* Left: avatar placeholder */}
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: DK, border: `0.5px solid ${DKB}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '16px', opacity: 0.4, color: '#F0EDE6' }}>◎</span>
                  </div>
                  {/* Center: name + metrics */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' as const }}>
                      <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', fontWeight: 600, color: LTT1 }}>{lot.artist_name_raw}</span>
                      {lot.artist_profile?.investment_tier && (
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, padding: '2px 7px', borderRadius: '3px',
                          color: lot.artist_profile.investment_tier === 'blue_chip' ? BL : lot.artist_profile.investment_tier === 'emerging' ? GL : AMB,
                          background: lot.artist_profile.investment_tier === 'blue_chip' ? '#EFF6FF' : lot.artist_profile.investment_tier === 'emerging' ? '#F0FDF4' : '#FFFBEB',
                        }}>{lot.artist_profile.investment_tier.replace('_', ' ')}</span>
                      )}
                      {lot.artist?.trend && (
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: '3px',
                          color: lot.artist.trend === 'up' ? GL : lot.artist.trend === 'down' ? RED : LTT3,
                          background: lot.artist.trend === 'up' ? '#F0FDF4' : lot.artist.trend === 'down' ? '#FEF2F2' : LT,
                        }}>{lot.artist.trend === 'up' ? '↑ RISING' : lot.artist.trend === 'down' ? '↓ FALLING' : '→ STABLE'}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const }}>
                      {lot.artist?.liquidity_score != null && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>
                          Liquidity <strong style={{ color: LTT2 }}>{Math.round(lot.artist.liquidity_score)}/100</strong>
                        </span>
                      )}
                      {lot.artist?.sell_through_rate != null && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>
                          Sell-thru <strong style={{ color: LTT2 }}>{Math.round(lot.artist.sell_through_rate * 100)}%</strong>
                        </span>
                      )}
                      {lot.artist?.total_lots_sold != null && lot.artist.total_lots_sold > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>
                          <strong style={{ color: LTT2 }}>{lot.artist.total_lots_sold.toLocaleString()}</strong> lots tracked
                        </span>
                      )}
                      {lot.artist?.avg_auction_price != null && lot.artist.avg_auction_price > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>
                          Avg <strong style={{ color: LTT2 }}>{lot.artist.avg_auction_price >= 1000 ? `€${(lot.artist.avg_auction_price / 1000).toFixed(0)}K` : `€${Math.round(lot.artist.avg_auction_price)}`}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Right: CTA */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: GOLD, fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    FULL ANALYSIS →
                  </div>
                </div>
              </div>
            )}

            {/* ── DATA GRID 50/50 ─────────────────────────────────────────────── */}
            <div style={{ padding: '32px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'stretch' }}>

              {/* LEFT COLUMN — Real Cost Breakdown + Investment Analysis */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {realCost && (
                  <div style={wCard}>
                    <div style={sl}>REAL COST BREAKDOWN</div>
                    {([
                      { k: 'Hammer price',                                         v: price,                            bold: false },
                      { k: `Buyer's premium (${realCost.buyers_premium_pct}%)`,    v: Math.round(realCost.cost_basis - price), bold: false },
                      { k: 'Holding cost (3yr)',                                   v: realCost.holding_cost_3y,         bold: false },
                    ] as { k: string; v: number; bold: boolean }[]).filter(r => r.v > 0).map(r => (
                      <div key={r.k} style={dRow}>
                        <span style={{ fontSize: '13px', color: LTT2 }}>{r.k}</span>
                        <span style={{ fontSize: '13px', color: LTT1, fontWeight: 500 }}>{fmt(r.v)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' }}>
                      <span style={{ fontSize: '13px', color: LTT1, fontWeight: 700 }}>All-in cost</span>
                      <span style={{ fontSize: '16px', color: GOLD, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmt(totalCost)}</span>
                    </div>
                    <div style={{ background: '#FAFAF7', border: `1px solid ${LTB}`, borderRadius: '8px', padding: '10px 14px', marginTop: '14px' }}>
                      <div style={{ fontSize: '12px', color: LTT2 }}>Needs +{breakEvenGain.toFixed(1)}% to break even</div>
                      <div style={{ fontSize: '12px', color: GOLD, fontWeight: 600, marginTop: '3px' }}>Break-even hammer: {fmt(realCost.breakeven_hammer)}</div>
                    </div>
                  </div>
                )}

                {/* Investment Analysis */}
                <div>
                  <div style={sl}>INVESTMENT ANALYSIS</div>
                  {canSeeAnalysis ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '20px 14px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: LTT3, marginBottom: '10px' }}>CURRENT PRICE</div>
                        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 600, color: LTT1, lineHeight: 1 }}>{fmt(price)}</div>
                        <div style={{ fontSize: '11px', color: LTT3, marginTop: '6px' }}>What you pay</div>
                      </div>
                      <div style={{ background: DK, border: `1px solid ${DKB}`, borderRadius: '12px', padding: '20px 14px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '10px' }}>FAIR VALUE</div>
                        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 600, color: '#F0EDE6', lineHeight: 1 }}>{fmt(fairVal)}</div>
                        <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '6px' }}>Market estimate</div>
                      </div>
                      <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '20px 14px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: LTT3, marginBottom: '10px' }}>UPSIDE</div>
                        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 600, color: GL, lineHeight: 1 }}>
                          {upsidePct > 0 ? `+${upsidePct.toFixed(0)}%` : 'At market'}
                        </div>
                        <div style={{ fontSize: '11px', color: LTT3, marginTop: '6px' }}>vs estimate</div>
                      </div>
                    </div>
                  ) : (
                    <LockedBlock
                      title="Is this artwork truly worth buying?"
                      teaser="Unlock fair value analysis, upside potential, and 5-year price projections before you decide."
                      ctaText="Unlock Investment Analysis"
                      ctaPrice="Founding price — €19/mo"
                      planId="starter"
                      preview={
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                          {['Current Price', 'Fair Value', 'Upside %'].map(l => (
                            <div key={l} style={{ padding: '16px', background: LT, borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: LTT3, marginBottom: '8px' }}>{l}</div>
                              <div style={{ height: '18px', background: LTB, borderRadius: '3px' }} />
                            </div>
                          ))}
                        </div>
                      }
                    />
                  )}
                </div>

              </div>

              {/* RIGHT COLUMN — Lot Details */}
              <div style={{ ...wCard, height: '100%', boxSizing: 'border-box' }}>
                <div style={sl}>LOT DETAILS</div>
                {([
                  { label: 'Artist',     value: lot.artist_name_raw, nav: `/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}`, link: true },
                  { label: 'Medium',     value: lot.medium },
                  { label: 'Category',   value: lot.category },
                  { label: 'Estimate',   value: (estLow || estHigh) ? `${fmt(estLow)} – ${fmt(estHigh)}` : null },
                  { label: 'House',      value: lot.auction_house_name },
                  { label: 'Closes',     value: auctionDateFmt },
                  { label: 'Lot #',      value: lot.lot_number },
                  { label: 'Source',     value: !hasAccess ? 'Source locked' : sourceLabel, href: !hasAccess ? undefined : trackUrl },
                ] as { label: string; value?: string | null; nav?: string; link?: boolean; href?: string }[]).filter(r => r.value).map(r => (
                  <div key={r.label} style={dRow}>
                    <span style={{ fontSize: '13px', color: LTT2, minWidth: '80px', flexShrink: 0 }}>{r.label}</span>
                    {r.nav ? (
                      <span onClick={() => navigate(r.nav!)} style={{ fontSize: '13px', color: BL, cursor: 'pointer', textDecoration: 'underline', textAlign: 'right', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
                    ) : r.href ? (
                      <a href={r.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: BL, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {r.value} ↗
                      </a>
                    ) : r.label === 'Source' && !hasAccess ? (
                      <span onClick={() => { window.location.href = '/app/pricing'; }} style={{ cursor: 'pointer', color: '#2563EB', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>🔒 Unlock source — Investor plan →</span>
                    ) : (
                      <span style={{ fontSize: '13px', color: LTT1, fontWeight: 500, textAlign: 'right', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
                    )}
                  </div>
                ))}

                {/* Due diligence / provenance alert */}
                {provRisk && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '12px 16px', marginTop: '14px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.13em', color: AMB, textTransform: 'uppercase', marginBottom: '8px' }}>
                      DUE DILIGENCE · {provRisk.level}
                    </div>
                    {(provRisk.flags as { code: string; severity: string; label: string; detail: string }[]).map((f, i) => (
                      <div key={f.code}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: f.severity === 'HIGH' ? AMB : f.severity === 'MEDIUM' ? AMB : LTT2, marginBottom: '3px' }}>
                          ● {f.label}
                        </div>
                        <div style={{ fontSize: '11px', color: '#92400E', lineHeight: 1.5, marginBottom: i < provRisk.flags.length - 1 ? '8px' : 0 }}>{f.detail}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* ── PRE-BID INTELLIGENCE ─────────────────────────────────────────── */}
            {(() => {
              const currency = lot.currency || 'EUR';
              const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
              const maxBid = lot.estimate_high ? Math.round(lot.estimate_high * 1.28) : null;
              const score = lot.deal_score || 0;
              const timingSignal = score >= 80 ? 'Strong — bid now' : score >= 65 ? 'Good entry' : 'Wait for lower';
              const timingColor = score >= 80 ? GD : score >= 65 ? GOLD : RED;
              const bullets = [
                upsidePct > 0 && `Fair value ${sym}${Math.round(fairVal).toLocaleString()} — current price is ${upsidePct.toFixed(0)}% below market estimate.`,
                maxBid && `Recommended max bid: ${sym}${maxBid.toLocaleString()} to preserve upside margin.`,
                (provRisk?.flags?.length || 0) > 0
                  ? `${provRisk!.flags.length} due diligence flag${provRisk!.flags.length > 1 ? 's' : ''} detected — review before bidding.`
                  : 'No provenance or compliance flags detected on this lot.',
                lot.oracle?.signal === 'BUY_NOW' ? `Oracle signal: BUY NOW · ${lot.oracle.target_upside ? `+${lot.oracle.target_upside}% target upside` : 'strong conviction'}` : null,
              ].filter(Boolean) as string[];
              const content = (
                <div style={{ padding: '20px 24px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '16px' }}>PRE-BID INTELLIGENCE</div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' as const }}>
                    <div style={{ background: DK, borderRadius: '6px', padding: '10px 14px', flex: 1, minWidth: '120px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#6B7280', letterSpacing: '0.12em', marginBottom: '6px' }}>TIMING</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: timingColor }}>{timingSignal}</div>
                    </div>
                    {maxBid && (
                      <div style={{ background: LT, border: `1px solid ${LTB}`, borderRadius: '6px', padding: '10px 14px', flex: 1, minWidth: '120px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.12em', marginBottom: '6px' }}>MAX BID</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: LTT1 }}>{sym}{maxBid.toLocaleString()}</div>
                      </div>
                    )}
                    <div style={{ background: LT, border: `1px solid ${LTB}`, borderRadius: '6px', padding: '10px 14px', flex: 1, minWidth: '120px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.12em', marginBottom: '6px' }}>FAIR VALUE</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: GL }}>{fmt(fairVal)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                    {bullets.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ color: GOLD, fontSize: '10px', marginTop: '2px', flexShrink: 0 }}>◆</span>
                        <span style={{ fontSize: '12px', color: LTT2, lineHeight: 1.5 }}>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
              return (
                <div style={{ padding: '0 40px 32px' }}>
                  <div style={{ position: 'relative', background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', overflow: 'hidden' }}>
                    {canSeeAnalysis ? content : (
                      <>
                        <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' as const }}>{content}</div>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                          <span onClick={() => window.location.href = '/app/pricing'} style={{ cursor: 'pointer', background: '#1A2A44', color: '#C6A85A', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', padding: '8px 18px', borderRadius: 3 }}>
                            INVESTOR+ · UNLOCK →
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── HOW TO BID ───────────────────────────────────────────────────── */}
            {(() => {
              const targetEntry = lot.current_price;
              const avoidAbove = lot.real_cost?.breakeven_hammer
                ? Math.round(lot.real_cost.breakeven_hammer * 0.85)
                : null;
              const currency = lot.currency || 'EUR';
              const currencySymbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
              const content = (
                <>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '14px' }}>HOW TO BID</div>
                  <div style={{ fontSize: '13px', color: LTT2, marginBottom: '6px' }}>→ Target entry: {currencySymbol}{targetEntry?.toLocaleString()}</div>
                  {avoidAbove && (
                    <div style={{ fontSize: '13px', color: LTT2, marginBottom: '6px' }}>
                      → Avoid above: {currencySymbol}{avoidAbove.toLocaleString()}<span style={{ color: RED }}> (erases upside)</span>
                    </div>
                  )}
                  <div style={{ fontSize: '13px', color: LTT2, marginBottom: '6px' }}>→ Bid timing: final minutes — avoid early bidding</div>
                  <div style={{ fontSize: '13px', color: LTT2 }}>→ Max conviction: bid up to {currencySymbol}{lot.estimate_low?.toLocaleString() || 'estimate low'}</div>
                </>
              );
              return (
                <div style={{ padding: '0 40px 32px' }}>
                  <div style={{ position: 'relative', background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '20px 24px', overflow: 'hidden' }}>
                    {canSeeAI ? content : (
                      <>
                        <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' as const }}>{content}</div>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                          <span onClick={() => window.location.href = '/app/pricing'} style={{ cursor: 'pointer', background: '#1A2A44', color: '#C6A85A', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', padding: '8px 18px', borderRadius: 3 }}>
                            INVESTOR+ · UNLOCK →
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── INTELLIGENCE SIGNALS — Oracle + Artist Profile + Due Diligence ── */}
            {canSeeAnalysis && (lot.oracle || lot.artist_profile || cycleStage || estBias || consignAlert) && (
              <div style={{ padding: '0 40px 32px' }}>
                <div style={sl}>INTELLIGENCE SIGNALS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>

                  {/* Oracle signal card */}
                  {lot.oracle && (() => {
                    const sig = lot.oracle.signal as string;
                    const oColor = sig === 'BUY_NOW' ? GL : sig === 'AVOID' ? RED : sig === 'WATCH' ? AMB : BL;
                    const oBg   = sig === 'BUY_NOW' ? '#F0FDF4' : sig === 'AVOID' ? '#FEF2F2' : sig === 'WATCH' ? '#FFFBEB' : '#EFF6FF';
                    const oBorder = sig === 'BUY_NOW' ? '#BBF7D0' : sig === 'AVOID' ? '#FECACA' : sig === 'WATCH' ? '#FDE68A' : '#BFDBFE';
                    const oLabel = sig === 'BUY_NOW' ? 'BUY NOW' : sig;
                    return (
                      <div style={{ background: oBg, border: `1px solid ${oBorder}`, borderRadius: '12px', padding: '18px 20px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '10px' }}>ORACLE VERDICT</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 800, color: oColor, letterSpacing: '0.04em', marginBottom: '8px' }}>{oLabel}</div>
                        {lot.oracle.narrative && (
                          <div style={{ fontSize: '12px', color: LTT2, lineHeight: 1.5, marginBottom: '10px' }}>{lot.oracle.narrative}</div>
                        )}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
                          {lot.oracle.score_6m != null && (
                            <div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.1em', marginBottom: '2px' }}>6M SCORE</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: LTT1 }}>{lot.oracle.score_6m.toFixed(0)}</div>
                            </div>
                          )}
                          {lot.oracle.score_18m != null && (
                            <div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.1em', marginBottom: '2px' }}>18M SCORE</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: LTT1 }}>{lot.oracle.score_18m.toFixed(0)}</div>
                            </div>
                          )}
                          {lot.oracle.target_upside != null && (
                            <div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.1em', marginBottom: '2px' }}>TARGET</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: GL }}>+{lot.oracle.target_upside}%</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Artist profile card */}
                  {lot.artist_profile && (
                    <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '18px 20px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '10px' }}>ARTIST PROFILE</div>
                      {lot.artist_profile.investment_tier && (
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                            color: lot.artist_profile.investment_tier === 'blue_chip' ? BL : lot.artist_profile.investment_tier === 'emerging' ? GL : AMB,
                            background: lot.artist_profile.investment_tier === 'blue_chip' ? '#EFF6FF' : lot.artist_profile.investment_tier === 'emerging' ? '#F0FDF4' : '#FFFBEB',
                            padding: '3px 8px', borderRadius: '3px',
                          }}>{lot.artist_profile.investment_tier.replace('_', ' ')}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' as const, marginBottom: '8px' }}>
                        {lot.artist_profile.institutional_score != null && (
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.1em', marginBottom: '2px' }}>INSTITUTIONAL</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: LTT1 }}>{lot.artist_profile.institutional_score.toFixed(0)}/100</div>
                          </div>
                        )}
                        {lot.artist_profile.shows_last_12m != null && (
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.1em', marginBottom: '2px' }}>SHOWS 12M</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: LTT1 }}>{lot.artist_profile.shows_last_12m}</div>
                          </div>
                        )}
                        {lot.artist_profile.gallery_count != null && lot.artist_profile.gallery_count > 0 && (
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.1em', marginBottom: '2px' }}>GALLERIES</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: LTT1 }}>{lot.artist_profile.gallery_count}</div>
                          </div>
                        )}
                      </div>
                      {lot.artist_profile.top_gallery_name && (
                        <div style={{ fontSize: '11px', color: LTT3, fontStyle: 'italic' }}>Rep. by {lot.artist_profile.top_gallery_name}</div>
                      )}
                      {lot.artist_profile.is_pre_auction && (
                        <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: AMB, fontWeight: 700 }}>↑ PRE-AUCTION MOMENTUM</div>
                      )}
                    </div>
                  )}

                  {/* Due diligence signals */}
                  {(cycleStage || estBias || consignAlert) && (
                    <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '18px 20px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '12px' }}>MARKET SIGNALS</div>
                      {cycleStage && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.1em', marginBottom: '3px' }}>MARKET CYCLE</div>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                            color: cycleStage.stage === 'PEAK' ? RED : cycleStage.stage === 'RECOVERY' ? GL : AMB,
                          }}>{cycleStage.stage}</span>
                          {cycleStage.description && <span style={{ fontSize: '11px', color: LTT3, marginLeft: '8px' }}>{cycleStage.description}</span>}
                        </div>
                      )}
                      {estBias && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.1em', marginBottom: '3px' }}>ESTIMATE BIAS</div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: (estBias.pct_above_low_estimate || 0) > 30 ? AMB : GL }}>
                            {(estBias.pct_above_low_estimate || 0) > 0 ? `+${Math.round(estBias.pct_above_low_estimate)}%` : `${Math.round(estBias.pct_above_low_estimate || 0)}%`} vs history
                          </span>
                        </div>
                      )}
                      {consignAlert && (
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.1em', marginBottom: '3px' }}>CONSIGNMENT</div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: consignAlert.level === 'HIGH VOLUME' ? RED : GL }}>{consignAlert.level}</span>
                          {consignAlert.message && <div style={{ fontSize: '11px', color: LTT3, marginTop: '2px' }}>{consignAlert.message}</div>}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ── KEY RISKS + FUTURE VALUE PROJECTIONS — side by side ─────────── */}
            {canSeeAnalysis && (
              <div style={{ padding: '0 40px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'stretch' }}>

                {/* KEY RISKS — data-driven */}
                {(() => {
                  const risks: { text: string; sev: 'HIGH' | 'MED' | 'LOW' }[] = [];
                  if (hasProvHighRisk)
                    risks.push({ text: 'Provenance flags detected — verify title and ownership history before bidding', sev: 'HIGH' });
                  if (hasCycleRisk)
                    risks.push({ text: `Market at peak cycle (${cycleStage?.stage}) — limited near-term price upside`, sev: 'HIGH' });
                  if (hasConsignHigh)
                    risks.push({ text: 'High consignment volume at this house — oversupply may compress resale prices', sev: 'HIGH' });
                  if (estBias && Math.abs(estBias.pct_above_low_estimate || 0) > 50)
                    risks.push({ text: `Estimate may be optimistic — currently +${Math.round(estBias.pct_above_low_estimate || 0)}% above historical average for this artist`, sev: 'MED' });
                  if (lot.artist?.trend === 'down')
                    risks.push({ text: 'Artist momentum declining — consider exit timing carefully', sev: 'MED' });
                  if ((lot.artist?.liquidity_score ?? 60) < 40)
                    risks.push({ text: 'Low market liquidity for this artist — resale may require 12–24 months', sev: 'MED' });
                  if (lot.oracle?.signal === 'AVOID')
                    risks.push({ text: `Oracle signal: AVOID — ${lot.oracle.narrative || 'below conviction threshold'}`, sev: 'HIGH' });
                  if (risks.length === 0) {
                    risks.push({ text: 'Standard art market illiquidity — minimum 3–5 year hold recommended', sev: 'LOW' });
                    risks.push({ text: "Buyer's premium and storage fees increase total acquisition cost", sev: 'LOW' });
                  }
                  return (
                    <div style={wCard}>
                      <div style={{ ...sl, marginBottom: '12px' }}>KEY RISKS</div>
                      {risks.map((risk, i, arr) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${LT}` : 'none' }}>
                          <span style={{
                            fontSize: '8px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                            color: risk.sev === 'HIGH' ? RED : risk.sev === 'MED' ? AMB : LTT3,
                            background: risk.sev === 'HIGH' ? '#FEE2E2' : risk.sev === 'MED' ? '#FEF3C7' : LT,
                            border: `1px solid ${risk.sev === 'HIGH' ? '#FECACA' : risk.sev === 'MED' ? '#FDE68A' : LTB}`,
                            padding: '2px 6px', borderRadius: '3px', flexShrink: 0, marginTop: '2px',
                          }}>{risk.sev}</span>
                          <span style={{ fontSize: '13px', color: LTT1, lineHeight: 1.5 }}>{risk.text}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* FUTURE VALUE PROJECTIONS */}
                {visibleYears.length > 0 ? (
                  <div style={wCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
                      <div style={sl}>FUTURE VALUE PROJECTIONS · {projCagr.toFixed(1)}% CAGR</div>
                      {lot.projection?.artist_tier && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>{lot.projection.artist_tier.replace('_', ' ')}</span>
                      )}
                    </div>
                    {visibleYears.map((y: number) => {
                      const val = proj(y);
                      const pct = projGainPct(y);
                      const w   = maxProjVal > 0 ? Math.min((val / maxProjVal) * 100, 100) : 0;
                      return (
                        <div key={y} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3, minWidth: '30px', flexShrink: 0 }}>{y}Y</span>
                          <div style={{ flex: 1, height: '3px', background: LTB, borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '2px', width: `${w}%`, background: GOLD }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT1, fontWeight: 600, minWidth: '44px', textAlign: 'right', flexShrink: 0 }}>{fmt(val)}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: GL, minWidth: '54px', textAlign: 'right', flexShrink: 0 }}>+{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                    {lot.projection?.sell_recommendation && (
                      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '8px 12px', marginTop: '6px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GL, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>OPTIMAL EXIT · </span>
                        <span style={{ fontSize: '12px', color: LTT2 }}>{lot.projection.sell_recommendation}</span>
                      </div>
                    )}
                    <p style={{ fontSize: '11px', fontStyle: 'italic', color: LTT3, marginTop: '10px', lineHeight: 1.6 }}>
                      Projections based on historical auction data and statistical modeling, capped at 15% to reflect long-term market realism.
                      Past performance does not guarantee future returns. Nautilus is not a financial advisor — this is not financial advice.
                    </p>
                  </div>
                ) : <div />}

              </div>
            )}

            {/* ── AI INTELLIGENCE ──────────────────────────────────────────────── */}
            <div style={{ padding: '0 40px 32px' }}>
              <div style={sl}>AI INTELLIGENCE</div>

              {/* 2-card grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* LEFT — Generate Investment Memo */}
                <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: GOLD, fontSize: '13px', lineHeight: 1 }}>◆</span>
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', color: LTT1, fontWeight: 500 }}>Investment Memo</span>
                  </div>
                  <div style={{ fontSize: '12px', color: LTT3, marginBottom: '16px', lineHeight: 1.5 }}>AI-generated analysis of this lot's investment potential.</div>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: BL, padding: '3px 8px', borderRadius: '3px' }}>INVESTOR+</span>
                  </div>
                  <button
                    onClick={!hasAccess ? () => { window.location.href = '/app/pricing'; } : (memo ? () => setShowMemo(true) : generateMemo)}
                    disabled={memoLoading}
                    onMouseEnter={e => { if (!memoLoading) (e.target as HTMLButtonElement).style.background = '#1A2332'; }}
                    onMouseLeave={e => { if (!memoLoading) (e.target as HTMLButtonElement).style.background = DK; }}
                    style={{ marginTop: 'auto', width: '100%', padding: '11px', background: DK, border: 'none', borderRadius: '8px', color: '#F0EDE6', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', cursor: memoLoading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: memoLoading ? 0.6 : 1 }}
                  >
                    ◆ {memoLoading ? 'GENERATING…' : memo ? 'VIEW MEMO' : 'GENERATE MEMO'}
                  </button>
                  {memo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                      <span style={{ padding: '3px 10px', background: memo.recommendation === 'BUY' ? 'rgba(26,127,75,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${memo.recommendation === 'BUY' ? 'rgba(26,127,75,0.25)' : 'rgba(217,119,6,0.25)'}`, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: memo.recommendation === 'BUY' ? GL : AMB, borderRadius: '4px' }}>{memo.recommendation}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>Conviction {memo.conviction}/100</span>
                    </div>
                  )}
                </div>

                {/* RIGHT — Investment Dossier */}
                <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="7" stroke="#9CA3AF" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="4" stroke="#9CA3AF" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="1.5" fill="#9CA3AF"/>
                    </svg>
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', color: LTT1, fontWeight: 500 }}>Investment Dossier</span>
                  </div>
                  <div style={{ fontSize: '12px', color: LTT3, marginBottom: '16px', lineHeight: 1.5 }}>Full analysis — 5/10/20yr projections, artist valuation & AI verdict.</div>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', background: '#F0F0FF', border: '1px solid #C7C7F0', color: '#5B5BD6', padding: '3px 8px', borderRadius: '3px' }}>FAMILY OFFICE+</span>
                  </div>
                  <button
                    onClick={() => navigate('/app/pricing?plan=investor')}
                    onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#1A2332'; }}
                    onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = DK; }}
                    style={{ marginTop: 'auto', width: '100%', padding: '11px', background: DK, border: 'none', borderRadius: '8px', color: '#F0EDE6', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}
                  >
                    + ANALYZE
                  </button>
                </div>

              </div>
            </div>

            {/* ── COMPARABLE SALES CARDS ────────────────────────────────────────── */}
            {displayComps.length > 0 && (
              <div style={{ padding: '0 40px 40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                  <div style={sl}>{compsLabel}</div>
                  {(comparables as any)?.market_analysis && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: LTT2 }}>
                      Comps avg: {fmt((comparables as any).market_analysis.market_avg_price)} ·{' '}
                      <span style={{ color: (comparables as any).market_analysis.price_gap_pct > 0 ? GL : RED, fontWeight: 700 }}>
                        {(comparables as any).market_analysis.price_gap_pct > 0 ? '+' : ''}{(comparables as any).market_analysis.price_gap_pct}% vs this lot
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: displayComps.length === 1 ? '1fr' : displayComps.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
                  {displayComps.map((comp: any) => {
                    const compPrice = comp.current_price || comp.estimate_low || 0;
                    const daysAgo = comp.days_since_sale;
                    const daysLabel = daysAgo != null
                      ? daysAgo < 30 ? `${daysAgo}d ago`
                      : daysAgo < 365 ? `${Math.round(daysAgo / 30)}mo ago`
                      : `${Math.round(daysAgo / 365)}yr ago`
                      : null;
                    const premRatio = comp.premium_ratio;
                    return (
                      <div key={comp.id}
                        className="comp-card-light"
                        onClick={() => comp.is_historical ? null : navigate(`/app/opportunities/${comp.id}`)}
                        style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '10px', overflow: 'hidden', cursor: comp.is_historical ? 'default' : 'pointer' }}
                      >
                        {comp.image_url ? (
                          <div style={{ height: '130px', overflow: 'hidden', position: 'relative' }}>
                            <img src={comp.image_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {daysLabel && (
                              <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '3px' }}>
                                {daysLabel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ height: '130px', background: LT, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <span style={{ fontSize: '28px', opacity: 0.12 }}>◎</span>
                            {daysLabel && (
                              <span style={{ position: 'absolute', top: '8px', right: '8px', background: LTB, color: LTT3, fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '3px' }}>
                                {daysLabel}
                              </span>
                            )}
                          </div>
                        )}
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {comp.auction_house_name || comp.artist_name_raw || 'Unknown'}
                          </div>
                          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '13px', color: LTT1, marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {comp.title || 'Untitled'}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: GOLD }}>€{compPrice.toLocaleString('en-GB')}</span>
                            {premRatio && premRatio > 1 ? (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GL, fontWeight: 600 }}>
                                {Math.round(premRatio * 100)}% of est.
                              </span>
                            ) : comp.deal_score ? (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>
                                {comp.deal_score.toFixed(0)}/100
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ──────────────── COMPARABLES TAB ──────────────── */}
        {activeTab === 'comparables' && (
          <div style={{ padding: '32px 40px 48px' }}>
            {comparables.length === 0 ? (
              <div style={{ ...wCard, textAlign: 'center', padding: '60px 24px' }}>
                <div style={{ fontSize: '32px', opacity: 0.15, marginBottom: '16px' }}>◎</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, letterSpacing: '0.1em' }}>No comparable sales found for this lot.</div>
              </div>
            ) : (
              <>
                {/* Market stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
                  <div style={wCard}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: LTT3, marginBottom: '8px' }}>AVG COMPARABLE PRICE</div>
                    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 600, color: LTT1 }}>{fmt(compsAvgPrice)}</div>
                  </div>
                  <div style={wCard}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: LTT3, marginBottom: '8px' }}>COMPARABLES COUNT</div>
                    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 600, color: LTT1 }}>{comparables.length}</div>
                  </div>
                  <div style={wCard}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: LTT3, marginBottom: '8px' }}>VS THIS LOT</div>
                    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 600, color: compsAvgPrice > price ? GL : RED }}>
                      {compsAvgPrice > price
                        ? `+${Math.round((compsAvgPrice / price - 1) * 100)}%`
                        : compsAvgPrice < price
                        ? `-${Math.round((1 - compsAvgPrice / price) * 100)}%`
                        : 'At parity'}
                    </div>
                  </div>
                </div>

                {/* Scatter chart */}
                <div style={{ ...wCard, marginBottom: '28px' }}>
                  <div style={{ ...sl, marginBottom: '20px' }}>PRICE HISTORY · SCATTER VIEW</div>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={LTB} />
                      <XAxis
                        dataKey="x"
                        type="number"
                        domain={['auto', 'auto']}
                        tickFormatter={(v: any) => String(Math.round(v))}
                        tick={{ fontFamily: 'monospace', fontSize: 10, fill: LTT3 }}
                        label={{ value: 'Year', position: 'insideBottom', offset: -8, fontFamily: 'monospace', fontSize: 10, fill: LTT3 }}
                      />
                      <YAxis
                        dataKey="y"
                        type="number"
                        tickFormatter={(v: any) => fmt(v)}
                        tick={{ fontFamily: 'monospace', fontSize: 10, fill: LTT3 }}
                        width={72}
                      />
                      <Tooltip
                        formatter={(value: any, _name: any, props: any) => [fmt(value), props?.payload?.title || 'Comparable']}
                        labelFormatter={(label: any) => `Year: ${Math.round(label)}`}
                        contentStyle={{ fontFamily: 'monospace', fontSize: 11, background: LTC, border: `1px solid ${LTB}`, borderRadius: 8 }}
                      />
                      {estLow > 0 && (
                        <ReferenceLine y={estLow} stroke={GOLD} strokeDasharray="4 4" strokeWidth={1.5}
                          label={{ value: 'Est. Low', position: 'right', fontFamily: 'monospace', fontSize: 9, fill: GOLD }} />
                      )}
                      {estHigh > 0 && (
                        <ReferenceLine y={estHigh} stroke={GOLD} strokeDasharray="4 4" strokeWidth={1.5}
                          label={{ value: 'Est. High', position: 'right', fontFamily: 'monospace', fontSize: 9, fill: GOLD }} />
                      )}
                      {/* Comparable lots — small gray dots */}
                      <Scatter
                        name="Comparables"
                        data={compChartData}
                        fill={LTT3}
                        opacity={0.7}
                      />
                      {/* Current lot — gold dot */}
                      <Scatter
                        name="This lot"
                        data={currentLotChartDot}
                        shape={<CurrentDot />}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' as const }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: LTT3 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: LTT3 }}>Comparable lots</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: GOLD, border: '2px solid #fff', boxShadow: `0 0 0 1px ${GOLD}` }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: LTT3 }}>This lot</span>
                    </div>
                    {estLow > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 16, height: 2, background: GOLD, opacity: 0.7 }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: LTT3 }}>Estimate range</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Full comparables table */}
                <div style={wCard}>
                  <div style={{ ...sl, marginBottom: '4px' }}>ALL COMPARABLES</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead>
                      <tr>
                        {['Artist', 'Title', 'Price', 'Score', 'Date'].map(col => (
                          <th key={col} style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: LTT3, textAlign: 'left' as const, padding: '10px 12px 10px 0', borderBottom: `1px solid ${LTB}` }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparables.map((comp: any) => {
                        const compPrice = comp.current_price || comp.estimate_low || 0;
                        const compDate = comp.auction_date
                          ? new Date(comp.auction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—';
                        return (
                          <tr
                            key={comp.id}
                            onClick={() => navigate(`/app/opportunities/${comp.id}`)}
                            style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = LT; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '11px 12px 11px 0', borderBottom: `1px solid #F0EDE6`, fontSize: '12px', color: LTT2, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                              {comp.artist_name_raw || '—'}
                            </td>
                            <td style={{ padding: '11px 12px 11px 0', borderBottom: `1px solid #F0EDE6`, fontSize: '13px', color: LTT1, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                              {comp.title || 'Untitled'}
                            </td>
                            <td style={{ padding: '11px 12px 11px 0', borderBottom: `1px solid #F0EDE6`, fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: GOLD, whiteSpace: 'nowrap' as const }}>
                              {fmt(compPrice)}
                            </td>
                            <td style={{ padding: '11px 12px 11px 0', borderBottom: `1px solid #F0EDE6`, fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, whiteSpace: 'nowrap' as const }}>
                              {comp.deal_score ? `${comp.deal_score.toFixed(0)}/100` : '—'}
                            </td>
                            <td style={{ padding: '11px 0 11px 0', borderBottom: `1px solid #F0EDE6`, fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, whiteSpace: 'nowrap' as const }}>
                              {compDate}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ──────────────── ANALYSIS TAB ──────────────── */}
        {activeTab === 'analysis' && (
          <div style={{ padding: '32px 40px 48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* AI Rationale */}
            {analysisText && (
              <div style={wCard}>
                <div style={{ ...sl, marginBottom: '12px' }}>AI RATIONALE</div>
                <p style={{ fontSize: '14px', color: LTT1, lineHeight: 1.8, margin: 0 }}>{analysisText}</p>
              </div>
            )}

            {/* Score pillar bars — prominent vertical bars */}
            <div style={wCard}>
              <div style={{ ...sl, marginBottom: '24px' }}>SCORE BREAKDOWN</div>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end', justifyContent: 'space-around', height: '160px' }}>
                {scorePillars.map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '8px', flex: 1 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: LTT1 }}>{value}</span>
                    <div style={{ width: '100%', maxWidth: '64px', background: LTB, borderRadius: '4px 4px 0 0', overflow: 'hidden', height: '100px', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%',
                        height: `${Math.max(4, value)}%`,
                        background: GOLD,
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.4s ease',
                      }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: LTT3 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verdict box */}
            <div style={{ ...wCard, display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '28px',
                fontWeight: 800,
                color: verdict.gl,
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}>
                {verdict.icon} {verdict.label}
              </div>
              <div style={{ borderLeft: `1px solid ${LTB}`, paddingLeft: '20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '6px' }}>VERDICT</div>
                <div style={{ fontSize: '14px', color: LTT1, lineHeight: 1.6 }}>{verdict.sub}</div>
                <div style={{ fontSize: '12px', color: LTT2, marginTop: '6px' }}>
                  Score: <strong style={{ color: LTT1 }}>{dealScore.toFixed(1)}/100</strong>
                  {upsidePct > 0 && <> · Upside: <strong style={{ color: GL }}>+{upsidePct.toFixed(0)}%</strong></>}
                </div>
              </div>
            </div>

            {/* AI Intelligence cards */}
            <div>
              <div style={{ ...sl, marginBottom: '16px' }}>AI INTELLIGENCE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: GOLD, fontSize: '13px', lineHeight: 1 }}>◆</span>
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', color: LTT1, fontWeight: 500 }}>Investment Memo</span>
                  </div>
                  <div style={{ fontSize: '12px', color: LTT3, marginBottom: '16px', lineHeight: 1.5 }}>AI-generated analysis of this lot's investment potential.</div>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: BL, padding: '3px 8px', borderRadius: '3px' }}>INVESTOR+</span>
                  </div>
                  <button
                    onClick={!hasAccess ? () => { window.location.href = '/app/pricing'; } : (memo ? () => setShowMemo(true) : generateMemo)}
                    disabled={memoLoading}
                    onMouseEnter={e => { if (!memoLoading) (e.target as HTMLButtonElement).style.background = '#1A2332'; }}
                    onMouseLeave={e => { if (!memoLoading) (e.target as HTMLButtonElement).style.background = DK; }}
                    style={{ marginTop: 'auto', width: '100%', padding: '11px', background: DK, border: 'none', borderRadius: '8px', color: '#F0EDE6', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', cursor: memoLoading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: memoLoading ? 0.6 : 1 }}
                  >
                    ◆ {memoLoading ? 'GENERATING…' : memo ? 'VIEW MEMO' : 'GENERATE MEMO'}
                  </button>
                  {memo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                      <span style={{ padding: '3px 10px', background: memo.recommendation === 'BUY' ? 'rgba(26,127,75,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${memo.recommendation === 'BUY' ? 'rgba(26,127,75,0.25)' : 'rgba(217,119,6,0.25)'}`, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: memo.recommendation === 'BUY' ? GL : AMB, borderRadius: '4px' }}>{memo.recommendation}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>Conviction {memo.conviction}/100</span>
                    </div>
                  )}
                </div>

                <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="7" stroke="#9CA3AF" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="4" stroke="#9CA3AF" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="1.5" fill="#9CA3AF"/>
                    </svg>
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', color: LTT1, fontWeight: 500 }}>Investment Dossier</span>
                  </div>
                  <div style={{ fontSize: '12px', color: LTT3, marginBottom: '16px', lineHeight: 1.5 }}>Full analysis — 5/10/20yr projections, artist valuation & AI verdict.</div>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', background: '#F0F0FF', border: '1px solid #C7C7F0', color: '#5B5BD6', padding: '3px 8px', borderRadius: '3px' }}>FAMILY OFFICE+</span>
                  </div>
                  <button
                    onClick={() => navigate('/app/pricing?plan=investor')}
                    onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#1A2332'; }}
                    onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = DK; }}
                    style={{ marginTop: 'auto', width: '100%', padding: '11px', background: DK, border: 'none', borderRadius: '8px', color: '#F0EDE6', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}
                  >
                    + ANALYZE
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ──────────────── DOCUMENTS TAB ──────────────── */}
        {activeTab === 'documents' && (
          <div style={{ padding: '32px 40px 48px' }}>
            {!hasAccess ? (
              <LockedBlock
                title="Documents & Sources"
                teaser="Unlock lot source, artist search, and auction house details with an Investor plan."
                ctaText="Unlock Documents"
                ctaPrice="Investor plan"
                planId="investor"
                preview={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ height: '44px', background: LT, borderRadius: '8px' }} />
                    ))}
                  </div>
                }
              />
            ) : (
              <div style={wCard}>
                <div style={{ ...sl, marginBottom: '20px' }}>SOURCES & LINKS</div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0' }}>

                  {/* Lot source */}
                  {trackUrl && (
                    <div style={{ ...dRow, paddingTop: '12px', paddingBottom: '12px' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '3px' }}>LOT SOURCE</div>
                        <div style={{ fontSize: '13px', color: LTT2 }}>{lot.auction_house_name || resolvedSource || 'Auction'}</div>
                      </div>
                      <a
                        href={trackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: BL, textDecoration: 'none', fontWeight: 600 }}
                      >
                        View lot ↗
                      </a>
                    </div>
                  )}

                  {/* Artist search */}
                  {lot.artist_name_raw && (
                    <div style={{ ...dRow, paddingTop: '12px', paddingBottom: '12px' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '3px' }}>ARTIST SEARCH</div>
                        <div style={{ fontSize: '13px', color: LTT2 }}>{lot.artist_name_raw}</div>
                      </div>
                      <a
                        href={sourceSearch[source] || `https://www.google.com/search?q=${artistEnc}+auction+results`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: BL, textDecoration: 'none', fontWeight: 600 }}
                      >
                        Search artist ↗
                      </a>
                    </div>
                  )}

                  {/* Auction house */}
                  {lot.auction_house_name && (
                    <div style={{ ...dRow, paddingTop: '12px', paddingBottom: '12px', borderBottom: 'none' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '3px' }}>AUCTION HOUSE</div>
                        <div style={{ fontSize: '13px', color: LTT2 }}>{lot.auction_house_name}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>
                        {sourceLabel}
                      </span>
                    </div>
                  )}

                </div>

                {/* Note */}
                <div style={{ marginTop: '20px', background: LT, borderRadius: '8px', padding: '12px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '4px' }}>NOTE</div>
                  <p style={{ fontSize: '12px', color: LTT2, lineHeight: 1.6, margin: 0 }}>
                    Source links may redirect via Nautilus tracking before landing on the auction platform.
                    {lot.auction_house_name ? ` This lot is listed by ${lot.auction_house_name.split('—')[0].trim()}.` : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── IMAGE LIGHTBOX ───────────────────────────────────────────────────── */}
      {showLightbox && lot.image_url && (
        <div
          onClick={() => setShowLightbox(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ position: 'absolute', top: 0, right: 0, padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#6B7280', pointerEvents: 'none' }}>✕ ESC</div>
          <img src={lot.image_url} alt={lot.title} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}

      {/* ── INVESTMENT MEMO MODAL ─────────────────────────────────────────────── */}
      {showMemo && memo && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(12,22,34,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowMemo(false); }}
        >
          <div style={{ background: LTC, borderRadius: '12px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
            <div style={{ background: DK, padding: '24px 32px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    NAUTILUS · INVESTMENT MEMO
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', color: '#F0EDE6', marginBottom: '4px' }}>{memo.title}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{memo.artist}</div>
                </div>
                <button onClick={() => setShowMemo(false)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '20px', cursor: 'pointer', padding: '0', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '20px' }}>
                {[
                  { label: 'CURRENT PRICE', value: memo.current_price >= 1000 ? `€${(memo.current_price / 1000).toFixed(0)}K` : `€${memo.current_price}` },
                  { label: 'TARGET LOW',    value: memo.target_price?.low  ? `€${(memo.target_price.low  / 1000).toFixed(0)}K` : 'N/A' },
                  { label: 'TARGET HIGH',   value: memo.target_price?.high ? `€${(memo.target_price.high / 1000).toFixed(0)}K` : 'N/A' },
                  { label: 'CONVICTION',    value: `${memo.conviction}/100` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#6B7280', letterSpacing: '0.12em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: '#F0EDE6' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '28px 32px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', padding: '14px 16px', background: memo.recommendation === 'BUY' ? 'rgba(26,127,75,0.06)' : memo.recommendation === 'WATCH' ? 'rgba(217,119,6,0.06)' : LT, borderRadius: '8px', border: `1px solid ${memo.recommendation === 'BUY' ? 'rgba(26,127,75,0.2)' : memo.recommendation === 'WATCH' ? 'rgba(217,119,6,0.2)' : LTB}` }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: memo.recommendation === 'BUY' ? GL : memo.recommendation === 'WATCH' ? AMB : LTT3 }}>
                  {memo.recommendation}
                </div>
                <div style={{ fontSize: '13px', color: LTT2 }}>
                  {memo.time_horizon}{memo.target_price?.rationale ? ` · ${memo.target_price.rationale}` : ''}
                </div>
              </div>
              {[
                { title: 'Investment Thesis', content: memo.thesis },
                { title: 'Artist Context',    content: memo.artist_context },
                { title: 'Pricing Analysis',  content: memo.pricing_analysis },
              ].filter(s => s.content).map(({ title, content }) => (
                <div key={title} style={{ marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: LTT3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>{title}</div>
                  <p style={{ fontSize: '14px', color: LTT1, lineHeight: 1.8, margin: 0 }}>{content}</p>
                </div>
              ))}
              {memo.risks && memo.risks.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: LTT3, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>Key Risks</div>
                  {memo.risks.map((risk: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ color: RED, fontSize: '12px', marginTop: '2px', flexShrink: 0 }}>▲</span>
                      <span style={{ fontSize: '13px', color: LTT2, lineHeight: 1.6 }}>{risk}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ borderTop: `1px solid ${LTB}`, paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>
                  Nautilus Intelligence · {new Date(memo.generated_at).toLocaleDateString('en-GB')}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>
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
