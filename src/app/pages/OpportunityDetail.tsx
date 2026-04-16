import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getPlanLimits, getToken } from '../../lib/auth';
import { AIAnalyst } from '../components/AIAnalyst';

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

function LockedBlock({ title, teaser, ctaText, ctaPrice, planId, preview }: {
  title: string; teaser: string; ctaText: string; ctaPrice: string;
  planId: string; preview?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div style={{ position: 'relative', border: `1px solid ${LTB}`, borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ filter: 'blur(3px)', pointerEvents: 'none', opacity: 0.35, padding: '24px', userSelect: 'none' }}>
        {preview || (
          <div style={{ display: 'flex', gap: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, height: '72px', background: LT, borderRadius: '8px' }} />
            ))}
          </div>
        )}
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(to bottom, transparent 0%, ${LTC} 45%)`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px', textAlign: 'center',
      }}>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '17px', fontWeight: 600, color: LTT1, marginBottom: '8px' }}>{title}</div>
        <p style={{ fontSize: '13px', color: LTT2, marginBottom: '20px', maxWidth: '340px', lineHeight: 1.65 }}>{teaser}</p>
        <button
          onClick={() => navigate(`/app/pricing?plan=${planId}`)}
          style={{ padding: '11px 28px', background: DK, border: 'none', color: '#F0EDE6', cursor: 'pointer', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: '8px', fontFamily: 'var(--font-mono)' }}
        >
          {ctaText}
        </button>
        <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>{ctaPrice} · 7-day free trial</div>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowLightbox(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: DK, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '32px' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ width: '4px', background: BLD, borderRadius: '2px', animation: `bpulse 1s ease ${i * 0.12}s infinite` }} />
        ))}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.24em', color: '#6B7280' }}>LOADING</span>
      <style>{`@keyframes bpulse{0%,100%{height:8px;opacity:0.3}50%{height:28px;opacity:1}}`}</style>
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
  const proj      = (years: number) => Math.round(price * Math.pow(1.07, years));

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
  const allComps: any[] = comparables?.comparables || [];
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

  return (
    <div style={{ minHeight: '100vh', background: LT }}>
      <style>{`
        @keyframes bpulse{0%,100%{height:8px;opacity:0.3}50%{height:28px;opacity:1}}
        @keyframes dot{0%,100%{opacity:1}50%{opacity:0.3}}
        .comp-card-light { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .comp-card-light:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
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
      <div ref={heroRef} style={{ background: DK, display: 'grid', gridTemplateColumns: '55% 45%' }}>

        {/* LEFT — image panel */}
        <div style={{ background: DK4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', padding: '24px', gap: '16px', borderRight: `0.5px solid ${DKB}`, position: 'relative' }}>
          {/* Back button (top-left) */}
          <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: '16px', left: '16px', background: 'none', border: `0.5px solid ${DKB}`, color: '#6B7280', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', padding: '5px 10px', borderRadius: '4px' }}>
            ← BACK
          </button>
          {lot.image_url ? (
            <img src={lot.image_url} alt={lot.title}
              onLoad={() => setImgLoaded(true)}
              onClick={() => setShowLightbox(true)}
              style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', padding: '8px', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s', cursor: 'pointer' }} />
          ) : (
            <div style={{ width: '200px', height: '260px', background: DK2, border: `0.5px solid ${DKB}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '40px', opacity: 0.08 }}>◎</span>
            </div>
          )}
        </div>

        {/* RIGHT — info panel */}
        <div style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

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

          {/* External link */}
          <div>
            <a href={externalUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: BLD, textDecoration: 'none', letterSpacing: '0.06em' }}>
              View on {sourceNames[source] || resolvedSource} ↗
            </a>
          </div>
        </div>
      </div>

      {/* ═══ LIGHT ZONE ═══ */}
      <div style={{ background: LT }}>

        {/* ── DATA GRID ─────────────────────────────────────────────────────────── */}
        <div style={{ padding: '32px 40px', display: 'grid', gridTemplateColumns: realCost ? '1fr 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>

          {/* Card 1 — REAL COST BREAKDOWN */}
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

          {/* Card 2 — LOT DETAILS */}
          <div style={wCard}>
            <div style={sl}>LOT DETAILS</div>
            {([
              { label: 'Artist',     value: lot.artist_name_raw, nav: `/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}`, link: true },
              { label: 'Medium',     value: lot.medium },
              { label: 'Category',   value: lot.category },
              { label: 'Estimate',   value: (estLow || estHigh) ? `${fmt(estLow)} – ${fmt(estHigh)}` : null },
              { label: 'House',      value: lot.auction_house_name },
              { label: 'Closes',     value: auctionDateFmt },
              { label: 'Lot #',      value: lot.lot_number },
              { label: 'Source',     value: sourceLabel, href: externalUrl },
            ] as { label: string; value?: string | null; nav?: string; link?: boolean; href?: string }[]).filter(r => r.value).map(r => (
              <div key={r.label} style={dRow}>
                <span style={{ fontSize: '13px', color: LTT2, minWidth: '80px', flexShrink: 0 }}>{r.label}</span>
                {r.nav ? (
                  <span onClick={() => navigate(r.nav!)} style={{ fontSize: '13px', color: BL, cursor: 'pointer', textDecoration: 'underline', textAlign: 'right', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
                ) : r.href ? (
                  <a href={r.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: BL, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {r.value} ↗
                  </a>
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

        {/* ── INVESTMENT ANALYSIS ───────────────────────────────────────────────── */}
        {canSeeAnalysis ? (
          <div style={{ padding: '0 40px 32px' }}>
            <div style={sl}>INVESTMENT ANALYSIS</div>

            {/* 3 metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
              {/* Current Price */}
              <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: LTT3, marginBottom: '12px' }}>CURRENT PRICE</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '32px', fontWeight: 600, color: LTT1, lineHeight: 1 }}>{fmt(price)}</div>
                <div style={{ fontSize: '12px', color: LTT3, marginTop: '8px' }}>What you pay</div>
              </div>
              {/* Fair Value — dark */}
              <div style={{ background: DK, border: `1px solid ${DKB}`, borderRadius: '12px', padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '12px' }}>FAIR VALUE</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '32px', fontWeight: 600, color: '#F0EDE6', lineHeight: 1 }}>{fmt(fairVal)}</div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>Market estimate</div>
              </div>
              {/* Upside */}
              <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: LTT3, marginBottom: '12px' }}>UPSIDE</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '32px', fontWeight: 600, color: GL, lineHeight: 1 }}>
                  {upsidePct > 0 ? `+${upsidePct.toFixed(0)}%` : 'At market'}
                </div>
                <div style={{ fontSize: '12px', color: LTT3, marginTop: '8px' }}>vs estimate</div>
              </div>
            </div>

          </div>
        ) : (
          <div style={{ padding: '0 40px 32px' }}>
            <div style={sl}>INVESTMENT ANALYSIS</div>
            <LockedBlock
              title="Is this artwork truly worth buying?"
              teaser="Unlock fair value analysis, upside potential, and 5-year price projections before you decide."
              ctaText="Unlock Investment Analysis"
              ctaPrice="From €9/month"
              planId="starter"
              preview={
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                  {['Current Price', 'Fair Value', 'Upside %'].map(l => (
                    <div key={l} style={{ padding: '20px', background: LT, borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: LTT3, marginBottom: '10px' }}>{l}</div>
                      <div style={{ height: '20px', background: LTB, borderRadius: '3px' }} />
                    </div>
                  ))}
                </div>
              }
            />
          </div>
        )}

        {/* ── KEY RISKS + FUTURE VALUE PROJECTIONS — side by side ─────────────── */}
        {canSeeAnalysis && (
          <div style={{ padding: '0 40px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'stretch' }}>

            {/* KEY RISKS */}
            <div style={wCard}>
              <div style={{ ...sl, marginBottom: '12px' }}>KEY RISKS</div>
              {[
                { text: 'Limited resale liquidity for niche artists', sev: 'MED' },
                { text: 'Auction estimate may be optimistic', sev: 'MED' },
                { text: 'Market illiquidity in niche categories', sev: 'HIGH' },
              ].map((risk, i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${LT}` : 'none' }}>
                  <span style={{
                    fontSize: '8px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: risk.sev === 'HIGH' ? RED : AMB,
                    background: risk.sev === 'HIGH' ? '#FEE2E2' : '#FEF3C7',
                    border: `1px solid ${risk.sev === 'HIGH' ? '#FECACA' : '#FDE68A'}`,
                    padding: '2px 6px', borderRadius: '3px', flexShrink: 0,
                  }}>{risk.sev}</span>
                  <span style={{ fontSize: '13px', color: LTT1 }}>{risk.text}</span>
                </div>
              ))}
            </div>

            {/* FUTURE VALUE PROJECTIONS */}
            {visibleYears.length > 0 ? (
              <div style={wCard}>
                <div style={{ ...sl, marginBottom: '20px' }}>FUTURE VALUE PROJECTIONS · 7% CAGR</div>
                {visibleYears.map((y: number) => {
                  const val = proj(y);
                  const pct = price > 0 ? ((val - price) / price) * 100 : 0;
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
                <p style={{ fontSize: '11px', fontStyle: 'italic', color: LTT3, marginTop: '10px', lineHeight: 1.6 }}>
                  Projections are indicative only. Art investment carries significant risk. Not financial advice.
                </p>
              </div>
            ) : <div />}

          </div>
        )}

        {/* ── AI INTELLIGENCE ───────────────────────────────────────────────────── */}
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
                onClick={memo ? () => setShowMemo(true) : generateMemo}
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

          {/* AI content for paying users */}
          {canSeeAI && (
            <div style={{ marginTop: '16px', background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '20px 24px' }}>
              <AIAnalyst rawLot={lot} />
            </div>
          )}

        </div>

        {/* ── COMPARABLE SALES ──────────────────────────────────────────────────── */}
        {displayComps.length > 0 && (
          <div style={{ padding: '0 40px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <div style={sl}>{compsLabel}</div>
              {comparables?.market_analysis && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: LTT2 }}>
                  Comps avg: {fmt(comparables.market_analysis.market_avg_price)} ·{' '}
                  <span style={{ color: comparables.market_analysis.price_gap_pct > 0 ? GL : RED, fontWeight: 700 }}>
                    {comparables.market_analysis.price_gap_pct > 0 ? '+' : ''}{comparables.market_analysis.price_gap_pct}% vs this lot
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: displayComps.length === 2 ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {displayComps.map((comp: any) => {
                const compPrice = comp.current_price || comp.estimate_low || 0;
                return (
                  <div key={comp.id}
                    className="comp-card-light"
                    onClick={() => navigate(`/app/opportunities/${comp.id}`)}
                    style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '10px', overflow: 'hidden', cursor: 'pointer' }}
                  >
                    {comp.image_url ? (
                      <div style={{ height: '130px', overflow: 'hidden' }}>
                        <img src={comp.image_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ height: '130px', background: LT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '28px', opacity: 0.12 }}>◎</span>
                      </div>
                    )}
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {comp.artist_name_raw || 'Unknown'}
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '13px', color: LTT1, marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {comp.title || 'Untitled'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: GOLD }}>€{compPrice.toLocaleString('en-GB')}</span>
                        {comp.deal_score && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>
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
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{ background: '#E8E4DD', borderTop: `1px solid #D6D1C7`, padding: '16px 40px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
          NOT FINANCIAL ADVICE · FOR INFORMATIONAL PURPOSES ONLY · NAUTILUS DATA AGGREGATED FROM PUBLIC AUCTION SOURCES
        </p>
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

