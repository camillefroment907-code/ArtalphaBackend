import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getPlanLimits, getToken, getUserPlan } from '../../lib/auth';
import { useSEO } from '../../lib/useSEO';
import { AIAnalyst } from '../components/AIAnalyst';
import { UpgradeModal } from '../components/UpgradeModal';
import {
  XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, LineChart, Line,
} from 'recharts';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

const trackEvent = async (eventType: string, entityType: string, entityId: string, properties: Record<string, any> = {}) => {
  try {
    const token = getToken ? getToken() : localStorage.getItem('token');
    if (!token) return;
    await fetch(`${BACKEND}/api/agent/track-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event_type: eventType, entity_type: entityType, entity_id: entityId, properties })
    });
  } catch {}
};

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

const fmtExact = (v?: number | null): string => {
  if (!v) return '—';
  return '€' + Math.round(v).toLocaleString('fr-FR');
};

const isFrench = (s: string) =>
  /par rapport|d'acquisition|sous-évalué|artiste|liquidité|achat|vente|décote/i.test(s);

// ── LOCKED BLOCK (light theme) ────────────────────────────────────────────────

function LockedBlock({ preview, ctaText }: {
  title: string; teaser: string; ctaText?: string; ctaPrice: string;
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
          {ctaText || 'INVESTOR+ · UNLOCK →'}
        </span>
      </div>
    </div>
  );
}


// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function OpportunityDetail() {
  const { t, i18n } = useTranslation();
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
  const [marketAnalysis, setMarketAnalysis] = useState<any>(null);
  const [stickyVisible, setStickyVisible] = useState(false);

  const [subscribed, setSubscribed]       = useState(false);
  const [subId, setSubId]                 = useState<string | null>(null);
  const [subLoading, setSubLoading]       = useState(false);
  const [upgradeModal, setUpgradeModal]   = useState<'wishlist' | 'source' | 'provenance' | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const isFr = i18n.language?.startsWith('fr');

  useSEO({
    title: lot ? `${lot.artist_name_raw || 'Lot'} — ${lot.title?.slice(0, 50) || 'Analyse'} — Nautilus` : 'Analyse de lot — Nautilus',
    description: lot ? `${lot.artist_name_raw || ''} · ${lot.auction_house_name || ''} · Analyse Nautilus Intelligence` : "Analyse d'investissement Nautilus",
  });

  const translateDueDiligence = (text: string) => {
    if (!isFr) return text;
    const map: Record<string, string> = {
      'No provenance listed': 'Aucune provenance renseignée',
      'Ownership history not documented — verify chain of title before bidding': "Historique de propriété non documenté — vérifiez la chaîne de titre avant d'enchérir",
      'Limited documentation': 'Documentation limitée',
      'No medium or dimensions listed — physical characteristics unverified': 'Aucun médium ni dimensions renseignés — caractéristiques physiques non vérifiées',
      'Provenance flags detected — verify title and ownership history before bidding': "Signaux de provenance détectés — vérifiez le titre et l'historique avant d'enchérir",
      'Rapid resale detected': 'Revente rapide détectée',
      'Same work sold at Contemporary Day Auction in 2026 — back at auction within 2 years': 'Même œuvre vendue à la Contemporary Day Auction en 2026 — retour aux enchères en moins de 2 ans',
      'High consignment volume at this house — oversupply may compress resale prices': 'Volume de consignation élevé — la suroffre peut comprimer les prix de revente',
      'Estimate far below market median': 'Estimation bien en dessous de la médiane du marché',
      "Estimate is 7% of artist's median hammer (€22K) — verify attribution": "Estimation à 7% de la médiane de l'artiste (€22K) — vérifiez l'attribution",
      'Standard art market illiquidity — minimum 3–5 year hold recommended': 'Illiquidité standard — durée de détention minimale recommandée : 3 à 5 ans',
      "Buyer's premium and storage fees increase total acquisition cost": "Les frais acheteur et de stockage augmentent le coût total d'acquisition",
    };
    return map[text] || text;
  };

  const limits         = getPlanLimits();
  const plan           = getUserPlan();
  const paidPlans      = ["investor", "pro", "institutional", "elite"];
  const isPaid         = paidPlans.includes(plan);
  const hasAccess      = isPaid;
  const isInvestor     = ['investor', 'pro', 'institutional', 'elite'].includes(plan);
  const isPro          = ['pro', 'institutional', 'elite'].includes(plan);
  const canSeeAnalysis = isPaid && (limits.hasProjections || limits.hasArtistCotation);
  const canSeeAI       = isPaid && limits.hasAIVerdict;
  const visibleYears   = isPaid ? (limits.projectionYears || []) : [];

  const generateMemo = async () => {
    if (!lot?.id) return;
    setMemoLoading(true);
    try {
      const resp = await fetch(
        `${BACKEND}/api/memo/${lot.id}`,
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
    fetch(`${BACKEND}/api/lots/${id}`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setLot(data); setLoading(false); })
      .catch(() => setLoading(false));
    fetch(`${BACKEND}/api/lots/${id}/comparables`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    }).then(r => r.json()).then(data => {
      setComparables(data.comparables || []);
      setMarketAnalysis(data.market_analysis || null);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id || !getToken()) return;
    fetch(`${BACKEND}/api/wishlist/ids`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then((ids: string[]) => {
        if (ids.includes(id)) { setSubscribed(true); setSubId(id); }
      })
      .catch(() => {});
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
          {t('lot.back')}
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
  const chartData = [
    { year: isFr ? "Aujourd'hui" : 'Now', optimistic: price, value: price, conservative: price },
    ...[1, 3, 5, 10].map(y => ({
      year: `${y}${isFr ? 'an' : 'yr'}`,
      optimistic:   _projMap[y]?.optimistic_eur   ?? Math.round(price * (1 + (projCagr * 1.5) / 100) ** y),
      value:        _projMap[y]?.projected_value_eur ?? Math.round(price * (1 + projCagr / 100) ** y),
      conservative: _projMap[y]?.conservative_eur ?? Math.round(price * (1 + (projCagr * 0.3) / 100) ** y),
    })),
  ];

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
  const priceHistory = (lot.price_history)    || null;

  const verdict = (() => {
    if ((lot.deal_score || 0) >= 80 && upsidePct >= 20)
      return { label: isFr ? 'ACHETER' : 'BUY',  dk: GD,        gl: GL,   icon: '↑', sub: isFr ? 'Signal fort de conviction' : 'Strong conviction signal' };
    if ((lot.deal_score || 0) >= 65 && upsidePct >= 10)
      return { label: isFr ? 'SURVEILLER' : 'WATCH',     dk: '#FBBF24',  gl: AMB,  icon: '◎', sub: isFr ? 'À surveiller de près' : 'Monitor closely' };
    if ((lot.deal_score || 0) < 50 || upsidePct < 0)
      return { label: isFr ? 'PASSER' : 'PASS', dk: '#EF4444',  gl: RED,  icon: '↓', sub: isFr ? 'Sous le seuil de conviction' : 'Below conviction threshold' };
    return   { label: isFr ? 'SURVEILLER' : 'WATCH',     dk: '#FBBF24',  gl: AMB,  icon: '◎', sub: isFr ? 'Signal insuffisant' : 'Insufficient signal' };
  })();

  const dealScore     = lot.deal_score || 0;
  const stickyTier    = dealScore >= 80 ? (isFr ? 'EXCEPTIONNEL' : 'EXCEPTIONAL') : dealScore >= 65 ? (isFr ? 'FORT' : 'STRONG') : (isFr ? 'INTÉRESSANT' : 'INTERESTING');
  const totalCost     = realCost ? realCost.cost_basis : price;
  const breakEvenGain = realCost ? realCost.needed_gain_pct : 26;
  const netGain       = upsidePct - breakEvenGain;

  const getBuyerPremium = (houseName: string): number => {
    const h = (houseName || '').toLowerCase();
    if (h.includes('christie')) return 1.26;
    if (h.includes('sotheby')) return 1.25;
    if (h.includes('phillips')) return 1.25;
    if (h.includes('bonhams')) return 1.25;
    if (h.includes('drouot') || h.includes('artcurial')) return 1.28;
    if (h.includes('ebay')) return 1.13;
    if (h.includes('liveauctioneer')) return 1.25;
    return 1.26;
  };
  const premiumMultiplier = getBuyerPremium(lot.auction_house_name || '');
  const buyerPremiumPct = Math.round((premiumMultiplier - 1) * 100);
  const bidBase = lot.estimate_high || lot.estimate_low || lot.current_price || null;
  const maxBid = bidBase ? Math.round(bidBase * premiumMultiplier) : null;
  const avoidAbove = lot.real_cost?.breakeven_hammer
    ? Math.round(lot.real_cost.breakeven_hammer * 0.85)
    : null;
  const daysUntilClose = lot.auction_date
    ? Math.max(0, Math.round((new Date(lot.auction_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const timingSignal = lot.oracle?.signal === 'BUY_NOW'
    ? (isFr ? 'Signal fort — meilleur moment pour acheter' : 'Strong signal — optimal entry')
    : lot.oracle?.signal === 'AVOID'
    ? (isFr ? 'Signal négatif — éviter pour le moment' : 'Negative signal — avoid for now')
    : null;
  const bullets: string[] = [
    lot.score_rationale ? String(lot.score_rationale) : null,
  ].filter(Boolean) as string[];

  // Analysis text
  const analysisText = typeof lot.score_rationale === 'string' && lot.score_rationale.trim()
    ? lot.score_rationale.trim()
    : null;

  // Comparables
  const allComps: any[] = comparables;
  const sameArtistComps = allComps.filter((c: any) =>
    c.artist_name_raw?.toLowerCase().trim() === (lot.artist_name_raw || '').toLowerCase().trim()
  );
  const displayComps = sameArtistComps.length >= 2 ? sameArtistComps.slice(0, 3) : allComps.slice(0, 3);
  const compsLabel   = sameArtistComps.length >= 2 ? (isFr ? 'VENTES COMPARABLES' : 'COMPARABLE SALES') : (isFr ? 'ŒUVRES SIMILAIRES' : 'SIMILAR WORKS');
  const maxCompPrice = comparables.length > 0 ? Math.max(...comparables.map((c: any) => c.current_price || 0), price) : price;

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
    padding: '6px 0', borderBottom: `1px solid #F0EDE6`,
  };


  // Score pillars — real score_breakdown keys
  const sb = (lot as any).score_breakdown || {};
  const scorePillars = [
    { label: isFr ? 'VALORISATION' : 'PRICING',    value: Math.round(sb.below_estimate_score ?? 0) },
    { label: isFr ? 'LIQUIDITÉ' : 'LIQUIDITY',      value: Math.round(sb.liquidity_score ?? lot.artist?.liquidity_score ?? 0) },
    { label: 'MOMENTUM',                             value: lot.artist?.trend === 'up' ? 75 : lot.artist?.trend === 'stable' ? 50 : lot.artist?.trend === 'down' ? 25 : 0 },
    { label: isFr ? 'TAUX DE VENTE' : 'SELL-THR',  value: Math.round(lot.artist?.sell_through_rate ?? 0) },
  ].filter(p => p.value > 0);

  return (
    <div className="lot-detail-page" style={{ minHeight: '100vh', background: LT }}>
      {upgradeModal && (
        <UpgradeModal
          type={upgradeModal}
          isFr={isFr}
          onClose={() => setUpgradeModal(null)}
        />
      )}
      <style>{`
        @keyframes bpulse{0%,100%{height:8px;opacity:0.3}50%{height:28px;opacity:1}}
        @keyframes dot{0%,100%{opacity:1}50%{opacity:0.3}}
        .comp-card-light { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .comp-card-light:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
      `}</style>

      {/* ═══ STICKY BAR — fixed, fades in ═══ */}
      <div className="lot-sticky-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: DK, borderBottom: `0.5px solid ${DKB}`,
        height: '46px', padding: '0 32px',
        display: 'flex', alignItems: 'center', gap: '12px',
        opacity: stickyVisible ? 1 : 0,
        pointerEvents: stickyVisible ? 'auto' : 'none',
        transition: 'opacity 0.18s ease',
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', padding: '0 12px 0 0', borderRight: `0.5px solid ${DKB}`, height: '46px', display: 'flex', alignItems: 'center' }}>
          {t('lot.back')}
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>{lot.artist_name_raw || ''}</div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '13px', color: '#F0EDE6', lineHeight: 1.3, marginTop: '2px' }}>{lot.title || 'Untitled'}</div>
        </div>
        <div className="lot-badges" style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ background: '#162040', border: '0.5px solid #2A4480', color: '#7EB0F0', fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '3px 9px', borderRadius: '4px', fontWeight: 700 }}>{verdict.label}</span>
          <span style={{ background: '#1C2E1C', border: '0.5px solid #3D6B3D', color: '#6FCF6F', fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '3px 9px', borderRadius: '4px', fontWeight: 700 }}>{dealScore.toFixed(1)} / 100 · {stickyTier}</span>
        </div>
      </div>

      {/* ═══ HERO — terminal 3-col ═══ */}
      <div ref={heroRef} className="lot-hero-grid" style={{ background: DK, display: 'grid', gridTemplateColumns: '300px 1fr 280px', minHeight: '380px' }}>

        {/* COL 1 — Image */}
        <div className="lot-hero-image" style={{ background: DK4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', borderRight: `0.5px solid ${DKB}`, position: 'relative', paddingLeft: '16px' }}>
          <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: '16px', left: '16px', background: 'none', border: `0.5px solid ${DKB}`, color: '#6B7280', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', padding: '5px 10px', borderRadius: '4px' }}>
            {t('lot.back')}
          </button>
          {lot.image_url ? (
            <img src={lot.image_url} alt={lot.title}
              onLoad={() => setImgLoaded(true)}
              onClick={() => setShowLightbox(true)}
              style={{ width: '100%', height: 'auto', maxHeight: '380px', objectFit: 'cover', borderRadius: '8px', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s', cursor: 'pointer' }} />
          ) : (
            <div style={{ width: '140px', height: '180px', background: DK2, border: `0.5px solid ${DKB}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '36px', opacity: 0.08 }}>◎</span>
            </div>
          )}
        </div>

        {/* COL 2 — Context */}
        <div className="lot-hero-info" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '14px', borderRight: `0.5px solid ${DKB}` }}>

          {/* EXCEPTIONAL badge */}
          {dealScore >= 80 && (
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start' }}>
              <span style={{ background: 'rgba(198,168,90,0.1)', border: '0.5px solid rgba(198,168,90,0.4)', color: GOLD, fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', padding: '3px 10px', borderRadius: '4px', textTransform: 'uppercase' }}>
                {t('lot.exceptional')}
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
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2vw, 26px)', color: '#F0EDE6', fontWeight: 600, margin: '0 0 8px', lineHeight: 1.15 }}>
              {lot.title || 'Untitled'}
            </h1>
            <div style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic' }}>
              {[lot.medium, lot.auction_house_name?.split('—')[0].trim()].filter(Boolean).join(' · ')}
            </div>
          </div>

          {/* Urgency */}
          {daysUntilClose !== null && daysUntilClose <= 7 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: daysUntilClose <= 2 ? '#EF4444' : '#FBBF24', letterSpacing: '0.08em' }}>
              ⚡ {isFr ? `Se clôture dans ${daysUntilClose} jour${daysUntilClose > 1 ? 's' : ''}` : `Closes in ${daysUntilClose} day${daysUntilClose !== 1 ? 's' : ''}`}
            </div>
          )}

          {/* Market context stats */}
          {(priceHistory?.statistics?.trend_pct != null || lot.fair_value_confidence != null) && (
            <div style={{ display: 'flex', gap: '20px', marginTop: '14px', flexWrap: 'wrap' as const }}>
              {priceHistory?.statistics?.trend_pct != null && (
                <div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '3px', textTransform: 'uppercase' as const }}>{isFr ? 'MARCHÉ ARTISTE' : 'ARTIST MARKET'}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: priceHistory.statistics.trend_pct > 0 ? '#34D399' : '#F87171' }}>{priceHistory.statistics.trend_pct > 0 ? '↑ +' : '↓ '}{priceHistory.statistics.trend_pct}% YoY</div>
                </div>
              )}
              {priceHistory?.statistics?.sell_above_estimate_pct != null && (
                <div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '3px', textTransform: 'uppercase' as const }}>{isFr ? 'TAUX DE VENTE' : 'SELL-THROUGH'}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{priceHistory.statistics.sell_above_estimate_pct}%</div>
                </div>
              )}
              {lot.fair_value_confidence != null && (
                <div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: '3px', textTransform: 'uppercase' as const }}>COMPARABLES 24M</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{lot.fair_value_confidence} {isFr ? 'ventes' : 'sales'}</div>
                </div>
              )}
            </div>
          )}

          {/* WHY block */}
          {(() => {
            const reasons: { icon: string; color: string; bg: string; main: string; sub: string; badge?: string | null; badgeColor?: string; badgeBg?: string }[] = [];

            if ((lot.pct_below_low_estimate || 0) > 10)
              reasons.push({
                icon: '↓', color: GD, bg: 'rgba(82,201,127,0.12)',
                main: isFr ? `${Math.round(lot.pct_below_low_estimate)}% sous estimation basse` : `${Math.round(lot.pct_below_low_estimate)}% below low estimate`,
                sub: isFr ? `Entrée à ${fmt(price)} · estimation ${fmt(lot.estimate_low)}–${fmt(lot.estimate_high || lot.estimate_low)}` : `Entry at ${fmt(price)} · estimate ${fmt(lot.estimate_low)}–${fmt(lot.estimate_high || lot.estimate_low)}`,
                badge: `-${Math.round(lot.pct_below_low_estimate)}%`, badgeColor: GD, badgeBg: 'rgba(82,201,127,0.12)',
              });

            if (lot.auction_date) {
              const daysLeft = Math.ceil((new Date(lot.auction_date).getTime() - Date.now()) / 86400000);
              if (daysLeft > 0 && daysLeft <= 14)
                reasons.push({
                  icon: '◷', color: GOLD, bg: 'rgba(198,168,90,0.12)',
                  main: isFr ? `Se clôture dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}` : `Closes in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
                  sub: `${lot.auction_house_name || ''} · ${new Date(lot.auction_date).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
                  badge: daysLeft <= 3 ? (isFr ? 'Urgent' : 'Urgent') : null, badgeColor: GOLD, badgeBg: 'rgba(198,168,90,0.12)',
                });
            }

            if (lot.artist?.trend === 'up')
              reasons.push({
                icon: '↑', color: GD, bg: 'rgba(82,201,127,0.15)',
                main: isFr ? 'Artiste en hausse' : 'Rising artist',
                sub: `${lot.artist_name_raw || ''} · ${isFr ? 'Liquidité' : 'Liquidity'} ${Math.round(lot.artist?.liquidity_score || 0)}/100 · ${isFr ? 'Taux de vente' : 'Sell-through'} ${lot.artist?.sell_through_rate ? Math.round(lot.artist.sell_through_rate * 100) + '%' : '—'}`,
                badge: null,
              });
            else if ((lot.deal_score || 0) >= 80)
              reasons.push({
                icon: '◎', color: BLD, bg: 'rgba(96,165,250,0.12)',
                main: isFr ? `Top des opportunités · ${Math.round(lot.deal_score)}/100` : `Top opportunity · ${Math.round(lot.deal_score)}/100`,
                sub: isFr ? 'Parmi les scores les plus élevés cette semaine' : 'Among the highest scores this week',
                badge: null,
              });
            else if ((lot.deal_score || 0) >= 65)
              reasons.push({
                icon: '◎', color: BLD, bg: 'rgba(96,165,250,0.12)',
                main: isFr ? `Signal positif de conviction · ${Math.round(lot.deal_score)}/100` : `Positive conviction signal · ${Math.round(lot.deal_score)}/100`,
                sub: isFr ? 'Au-dessus du seuil de conviction' : 'Above conviction threshold',
                badge: null,
              });

            if (reasons.length < 3 && (lot.artist?.liquidity_score || 0) >= 70 && lot.artist?.trend !== 'up')
              reasons.push({
                icon: '~', color: '#2DD4BF', bg: 'rgba(45,212,191,0.10)',
                main: isFr ? `Liquidité artiste élevée (${Math.round(lot.artist.liquidity_score)}/100)` : `High artist liquidity (${Math.round(lot.artist.liquidity_score)}/100)`,
                sub: isFr ? `${lot.artist_name_raw || ''} · Taux de vente ${lot.artist?.sell_through_rate ? Math.round(lot.artist.sell_through_rate * 100) + '%' : 'élevé'}` : `${lot.artist_name_raw || ''} · ${lot.artist?.sell_through_rate ? Math.round(lot.artist.sell_through_rate * 100) + '% sell-through' : 'High sell-through'}`,
                badge: null,
              });

            const topReasons = reasons.slice(0, 3);

            const isBuy = (lot.deal_score || 0) >= 65;
            const whyLabel = isBuy ? (isFr ? 'POURQUOI ACHETER' : 'WHY BUY') : (isFr ? 'POURQUOI PASSER' : 'WHY PASS');
            const whyColor = isBuy ? GOLD : '#F87171';

            if (topReasons.length === 0) {
              if ((lot.deal_score || 0) < 45) return (
                <div style={{ background: 'rgba(248,113,113,0.06)', border: '0.5px solid rgba(248,113,113,0.15)', borderRadius: 10, padding: '11px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: '#F87171', textTransform: 'uppercase' as const, marginBottom: 8 }}>
                    {isFr ? 'POURQUOI PASSER' : 'WHY PASS'}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                    {isFr ? `Score insuffisant (${Math.round(lot.deal_score || 0)}/100) — de meilleures opportunités sont disponibles cette semaine.` : `Insufficient score (${Math.round(lot.deal_score || 0)}/100) — better opportunities available this week.`}
                  </div>
                </div>
              );
              return null;
            }

            return (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: whyColor, textTransform: 'uppercase' as const }}>
                    {whyLabel}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                    {topReasons.length} signal{topReasons.length > 1 ? 's' : ''}
                  </div>
                </div>
                {topReasons.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 16px', borderBottom: i < topReasons.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: r.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, fontSize: 14, color: r.color }}>
                      {r.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', fontWeight: 500, lineHeight: 1.4 }}>{r.main}</div>
                      {r.sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2, fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}>{r.sub}</div>}
                    </div>
                    {r.badge && (
                      <div style={{ marginLeft: 'auto', flexShrink: 0, background: r.badgeBg, color: r.badgeColor, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' as const }}>
                        {r.badge}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Market narrative */}
          {(() => {
            const buildNarrative = () => {
              const house = lot.auction_house_name || '';
              const bigHouses = ['christie', 'sotheby', 'phillips', 'bonhams', 'artcurial', 'drouot'];
              const isSmallHouse = !bigHouses.some(h => house.toLowerCase().includes(h));
              const daysLeft = lot.auction_date
                ? Math.ceil((new Date(lot.auction_date).getTime() - Date.now()) / 86400000)
                : null;

              if (isSmallHouse && (lot.pct_below_low_estimate || 0) > 20) {
                const daysStr = daysLeft && daysLeft > 0 && daysLeft <= 14
                  ? (isFr ? ` Dans ${daysLeft} jours.` : ` ${daysLeft} days left.`)
                  : '';
                const houseName = house.split(':')[0].trim();
                return isFr
                  ? `${lot.artist_name_raw} chez ${houseName} — maison peu visible. ${Math.round(lot.pct_below_low_estimate)}% sous estimation.${daysStr}`
                  : `${lot.artist_name_raw} at ${houseName} — less visible house. ${Math.round(lot.pct_below_low_estimate)}% below estimate.${daysStr}`;
              }
              if (lot.artist?.trend === 'up' && (lot.pct_below_low_estimate || 0) > 15) {
                const daysStr = daysLeft && daysLeft > 0 && daysLeft <= 14
                  ? (isFr ? ` Dans ${daysLeft} jours.` : ` ${daysLeft} days left.`)
                  : '';
                return isFr
                  ? `Momentum positif sur 6 mois. Prix actuel ${Math.round(lot.pct_below_low_estimate)}% sous l'estimation basse.${daysStr}`
                  : `Positive momentum over 6 months. Current price ${Math.round(lot.pct_below_low_estimate)}% below low estimate.${daysStr}`;
              }
              if ((lot.deal_score || 0) >= 80 && realCost) {
                return isFr
                  ? `Score de conviction fort. Coût réel avec frais : ${fmt(realCost.cost_basis)}. Seuil de rentabilité : +${Math.round(realCost.needed_gain_pct)}%.`
                  : `Strong conviction score. Real cost with fees: ${fmt(realCost.cost_basis)}. Break-even: +${Math.round(realCost.needed_gain_pct)}%.`;
              }
              return null;
            };
            const narrative = buildNarrative();
            return narrative ? (
              <p style={{ fontSize: 13, fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', margin: '8px 0 0', lineHeight: 1.65 }}>
                {narrative}
              </p>
            ) : null;
          })()}

          {/* External link */}
          <div>
            {!hasAccess ? (
              <span onClick={() => { window.location.href = '/app/pricing'; }} style={{ cursor: 'pointer', color: '#2563EB', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>🔒 {isFr ? 'Accès Investor →' : 'Investor access →'}</span>
            ) : (
              <a href={trackUrl} target="_blank" rel="noopener noreferrer"
                onClick={() => trackEvent('lot_external_click', 'lot', lot.id, {
                  lot_title: lot.title,
                  artist: lot.artist_name_raw,
                  source: lot.source,
                  auction_house: lot.auction_house_name,
                  deal_score: lot.deal_score,
                  url: rawUrl,
                })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: BLD, textDecoration: 'none', letterSpacing: '0.06em' }}>
                {isFr ? 'Voir sur' : 'View on'} {sourceNames[source] || resolvedSource} ↗
              </a>
            )}
          </div>
        </div>

        {/* COL 3 — Conviction stack */}
        <div style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: DK4 }}>

          {/* Block 1 — SCORE */}
          <div style={{ padding: '14px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>SCORE</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '42px', fontWeight: 700, color: 'white', lineHeight: 1 }}>{Math.round(dealScore)}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>/100</span>
            </div>
            <div style={{ marginTop: '6px', height: '3px', background: DKB, borderRadius: '1px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '1px', width: `${dealScore}%`, background: GOLD }} />
            </div>
            {lot.fair_value_nautilus && price && (
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                -{Math.round((1 - price / (lot.fair_value_nautilus as number)) * 100)}% vs comparables
              </div>
            )}
          </div>

          {/* Block 2 — SIGNAL */}
          <div style={{ padding: '14px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>SIGNAL</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: verdict.dk, lineHeight: 1 }}>{verdict.icon} {verdict.label}</div>
          </div>

          {/* Block 2b — SIGNAUX MARCHÉ VIVANT (mobile only) */}
          {(() => {
            const signals: string[] = [];
            const wcount = (lot as any).wishlist_count || (lot as any).watchlist_count;
            if (wcount) signals.push(isFr ? `👁 ${wcount} suivis` : `👁 ${wcount} watching`);
            const artistTrend = lot.artist?.trend;
            if (artistTrend) {
              const isUp = artistTrend === 'up' || artistTrend === 'rising';
              const isDown = artistTrend === 'down' || artistTrend === 'falling';
              signals.push(isUp
                ? (isFr ? '↑ Artiste en hausse' : '↑ Rising artist')
                : isDown
                ? (isFr ? '↓ Artiste en baisse' : '↓ Falling artist')
                : (isFr ? '→ Artiste stable' : '→ Stable artist'));
            }
            if (signals.length === 0) return null;
            return (
              <div className="lot-mobile-only" style={{ padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', gap: '14px', flexWrap: 'wrap' as const }}>
                {signals.map((s, i) => (
                  <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>{s}</span>
                ))}
              </div>
            );
          })()}

          {/* Block 3 — VS COMPARABLES */}
          {lot.fair_value_nautilus && price > 0 && (() => {
            const heroGapPct = Math.round((1 - price / (lot.fair_value_nautilus as number)) * 100);
            return (
              <div style={{ padding: '14px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>{isFr ? 'VS COMPARABLES' : 'VS COMPARABLES'}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: '#34D399', lineHeight: 1 }}>{heroGapPct > 0 ? '-' : '+'}{Math.abs(heroGapPct)}%</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{isFr ? `Médiane : ${fmt(lot.fair_value_nautilus)}` : `Median: ${fmt(lot.fair_value_nautilus)}`}</div>
              </div>
            );
          })()}

          {/* Block 4 — MAX BID */}
          {(avoidAbove ?? maxBid) && (
            <div style={{ padding: '14px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>{isFr ? 'MAX BID RENTABLE' : 'MAX PROFITABLE BID'}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: '#C6A85A', lineHeight: 1 }}>{fmtExact(avoidAbove ?? maxBid)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{isFr ? 'Au-delà : perte garantie' : 'Beyond this: guaranteed loss'}</div>
            </div>
          )}

          {/* Follow */}
          <button
            onClick={async () => {
              if (!getToken()) { window.location.href = '/app/login'; return; }
              setSubLoading(true);
              try {
                if (subscribed && subId) {
                  await fetch(`${BACKEND}/api/wishlist/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${getToken()}` },
                  });
                  setSubscribed(false);
                  setSubId(null);
                } else {
                  const r = await fetch(`${BACKEND}/api/wishlist/${id}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${getToken()}` },
                  });
                  if (r.status === 403) {
                    setUpgradeModal('wishlist');
                  } else if (r.ok) {
                    setSubscribed(true);
                    setSubId(id);
                    trackEvent('lot_watchlist_add', 'lot', lot.id, {
                      lot_title: lot.title,
                      artist: lot.artist_name_raw,
                      deal_score: lot.deal_score,
                    });
                  }
                }
              } finally {
                setSubLoading(false);
              }
            }}
            disabled={subLoading}
            style={{
              marginTop: 'auto',
              background: subscribed ? 'rgba(82,201,127,0.1)' : 'none',
              border: `0.5px solid ${subscribed ? GD : DKB}`,
              color: subscribed ? GD : '#9CA3AF',
              cursor: subLoading ? 'default' : 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.08em',
              padding: '8px 14px',
              borderRadius: '4px',
              width: '100%',
            }}
          >
            {subLoading ? '...' : subscribed ? (isFr ? '✓ Suivi' : '✓ Following') : (isFr ? '🔔 Suivre ce lot' : '🔔 Follow this lot')}
          </button>

        </div>
      </div>

      {/* ═══ LIGHT ZONE ═══ */}
      <div className="lot-light-zone" style={{ background: LT }}>

        {/* ── SCORE PILLARS STRIP ──────────────────────────────────────────── */}
        {scorePillars.length > 0 && (
          <div style={{ display: 'flex', gap: '32px', padding: '12px 40px', background: 'rgba(10,15,30,0.04)', borderBottom: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px', flexWrap: 'wrap' as const }}>
            {scorePillars.map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '9px', color: LTT3, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>{label.toUpperCase()}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: LTT1, fontFamily: 'var(--font-mono)' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── DÉCISION ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '24px 40px 24px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
            {isFr ? '◆ DÉCISION' : '◆ DECISION'}
          </div>
          <div className="lot-decision-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>

            {/* Card 1 — VOUS PAYEZ */}
            <div style={{ background: LTC, border: `1px solid ${LTB}`, borderTop: `3px solid ${GD}`, borderRadius: '10px', padding: '18px 20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', color: LTT3, textTransform: 'uppercase', marginBottom: '10px' }}>
                {isFr ? 'VOUS PAYEZ' : 'YOU PAY'}
              </div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '24px', fontWeight: 600, color: LTT1, lineHeight: 1 }}>
                {fmtExact(price)}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: GD, marginTop: '6px', fontWeight: 600 }}>
                {isFr ? 'Bonne entrée' : 'Good entry'}
              </div>
              <div style={{ fontSize: '11px', color: LTT3, marginTop: '3px' }}>
                {isFr ? 'Sous les comparables récents' : 'Below recent comparables'}
              </div>
            </div>

            {/* Card 2 — NE PAS DÉPASSER */}
            {(avoidAbove ?? maxBid) ? (
              <div style={{ background: DK, border: `1px solid ${DKB}`, borderTop: `3px solid ${GOLD}`, borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', color: '#6B7280', textTransform: 'uppercase', marginBottom: '10px' }}>
                  {isFr ? 'NE PAS DÉPASSER' : 'MAX BID'}
                </div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '24px', fontWeight: 600, color: GOLD, lineHeight: 1 }}>
                  {fmtExact(avoidAbove ?? maxBid ?? estHigh)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#6B7280', marginTop: '6px' }}>
                  {isFr ? 'Seuil de rentabilité max' : 'Max breakeven threshold'}
                </div>
              </div>
            ) : (
              <div style={{ background: LTC, border: `1px solid ${LTB}`, borderTop: `3px solid ${GOLD}`, borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', color: LTT3, textTransform: 'uppercase', marginBottom: '10px' }}>
                  {isFr ? 'NE PAS DÉPASSER' : 'MAX BID'}
                </div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '24px', fontWeight: 600, color: GOLD, lineHeight: 1 }}>—</div>
              </div>
            )}

            {/* Card 3 — RÉFÉRENCE MARCHÉ */}
            {lot.fair_value_nautilus ? (
              <div style={{ background: LT, border: `1px solid ${LTB}`, borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', color: LTT3, textTransform: 'uppercase', marginBottom: '10px' }}>
                  {isFr ? 'RÉFÉRENCE MARCHÉ' : 'MARKET REFERENCE'}
                </div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '24px', fontWeight: 600, color: LTT1, lineHeight: 1 }}>
                  {fmtExact(lot.fair_value_nautilus as number)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3, marginTop: '6px' }}>
                  {isFr ? 'Valeur médiane Nautilus' : 'Nautilus median value'}
                </div>
              </div>
            ) : (
              <div style={{ background: LT, border: `1px solid ${LTB}`, borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', color: LTT3, textTransform: 'uppercase', marginBottom: '10px' }}>
                  SIGNAL NAUTILUS
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 800, color: verdict.gl, letterSpacing: '0.04em', lineHeight: 1 }}>
                  {verdict.icon} {verdict.label}
                </div>
                <div style={{ fontSize: '11px', color: LTT2, marginTop: '6px', lineHeight: 1.4 }}>
                  {verdict.sub}
                </div>
              </div>
            )}


          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '24px', padding: '12px 16px', background: 'rgba(10,15,30,0.04)', borderRadius: '6px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div><div style={{ fontSize: '9px', color: LTT3, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '3px' }}>{isFr ? 'ENTRÉE CIBLE' : 'TARGET ENTRY'}</div><div style={{ fontSize: '13px', fontWeight: 600, color: LTT1 }}>{fmtExact(price)}</div></div>
            <div><div style={{ fontSize: '9px', color: LTT3, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '3px' }}>{isFr ? 'BID MAX' : 'MAX BID'}</div><div style={{ fontSize: '13px', fontWeight: 600, color: GOLD }}>{fmtExact(avoidAbove ?? maxBid)}</div></div>
            <div><div style={{ fontSize: '9px', color: LTT3, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '3px' }}>TIMING</div><div style={{ fontSize: '13px', fontWeight: 600, color: LTT1 }}>{isFr ? 'Fin de session' : 'End of session'}</div></div>
          </div>
        </div>

        {/* ── MOBILE FREE: POURQUOI NAUTILUS SURVEILLE + COÛT RÉEL ─────────── */}
        {!hasAccess && (() => {
          const compsAvgMob = comparables.length > 0
            ? Math.round(comparables.reduce((s: number, c: any) => s + (c.current_price || 0), 0) / comparables.length)
            : null;

          const whyBullets: string[] = [];
          if (upsidePct >= 5) whyBullets.push(isFr ? `Prix ${Math.round(upsidePct)}% inférieur aux ventes comparables récentes` : `Price ${Math.round(upsidePct)}% below recent comparable sales`);
          if ((lot.artist?.sell_through_rate || 0) >= 0.6) whyBullets.push(isFr ? 'Marché actif pour cet artiste' : 'Active market for this artist');
          if ((lot.deal_score || 0) >= 65 && upsidePct < 5) whyBullets.push(isFr ? 'Bonne entrée pour cette catégorie' : 'Good entry point for this category');
          const ratStr = typeof lot.score_rationale === 'string' ? lot.score_rationale : (typeof (lot as any).rationale === 'string' ? (lot as any).rationale : '');
          const firstSent = ratStr ? (ratStr.match(/^[^.!?]+[.!?]/)?.[0] ?? null) : null;
          if (firstSent && whyBullets.length < 3) whyBullets.push(firstSent);
          if (compsAvgMob && compsAvgMob > price * 1.05 && whyBullets.length < 3) whyBullets.push(isFr ? 'Entrée favorable par rapport aux œuvres similaires récentes' : 'Favorable entry vs. similar works sold recently');

          if (whyBullets.length === 0 && price === 0) return null;
          return (
            <div className="lot-mobile-only" style={{ padding: '0 16px' }}>

              {/* Pourquoi Nautilus surveille */}
              {whyBullets.length > 0 && (
                <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '16px 18px', marginBottom: '12px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
                    ◆ {isFr ? 'POURQUOI NAUTILUS SURVEILLE CE LOT' : 'WHY NAUTILUS IS WATCHING'}
                  </div>
                  {whyBullets.slice(0, 3).map((b, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: i < whyBullets.slice(0, 3).length - 1 ? '8px' : 0 }}>
                      <span style={{ color: GOLD, fontSize: '11px', flexShrink: 0, marginTop: '2px' }}>◆</span>
                      <span style={{ fontSize: '13px', color: LTT2, lineHeight: 1.55 }}>{b}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Coût réel */}
              {price > 0 && (
                <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '16px 18px', marginBottom: '12px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
                    ◆ {isFr ? 'COÛT RÉEL' : 'REAL COST'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                    <div style={dRow}>
                      <span style={{ fontSize: '13px', color: LTT2 }}>{isFr ? 'Coût estimé après frais' : 'Estimated cost after fees'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: LTT1 }}>{fmtExact(Math.round(price * premiumMultiplier))}</span>
                    </div>
                    {compsAvgMob && compsAvgMob > 0 && (
                      <div style={dRow}>
                        <span style={{ fontSize: '13px', color: LTT2 }}>{isFr ? 'Revente moyenne historique' : 'Historical resale avg.'}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: LTT1 }}>{fmtExact(compsAvgMob)}</span>
                      </div>
                    )}
                    <div style={{ ...dRow, borderBottom: 'none' }}>
                      <span style={{ fontSize: '13px', color: LTT2 }}>{isFr ? 'Seuil de rentabilité' : 'Break-even price'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: AMB }}>
                        {fmtExact(realCost?.breakeven_hammer ? Math.round(realCost.breakeven_hammer) : Math.round(price * premiumMultiplier * (1 + breakEvenGain / 100)))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* ── INTELLIGENCE NAUTILUS ─────────────────────────────────────────── */}
        {!hasAccess ? (
          (() => {
            const aiText = typeof lot.score_rationale === 'string' && lot.score_rationale.trim() ? lot.score_rationale.trim() : null;
            if (!aiText) return null;
            const sentences = aiText.match(/[^.!?]+[.!?]+/g) || [];
            const excerpt = sentences.slice(0, 3).join(' ').trim() || aiText.slice(0, 300);
            if (!excerpt) return null;
            return (
              <div className="lot-desktop-only" style={{ padding: '0 40px 24px' }}>
                <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '16px 22px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
                    ◆ {isFr ? 'LECTURE NAUTILUS' : 'NAUTILUS READ'}
                  </div>
                  <p style={{ fontSize: '13px', color: LTT2, lineHeight: 1.7, margin: 0 }}>{excerpt}</p>
                </div>
              </div>
            );
          })()
        ) : canSeeAnalysis && (() => {
          const nautVal = lot.fair_value_nautilus as number | null;
          const gapPct = nautVal && price > 0 ? Math.round((1 - price / nautVal) * 100) : null;
          const aiRationale = null;
          return (
            <div style={{ padding: '20px 40px 24px' }}>
              <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '16px 24px 12px', borderBottom: `1px solid ${LTB}` }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const }}>
                    ◆ {isFr ? 'INTELLIGENCE NAUTILUS' : 'NAUTILUS INTELLIGENCE'}
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>

                  {/* ROW A — Gap percentage + Price bar */}
                  {nautVal && gapPct !== null && (
                    <div className="lot-reference-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>
                          {isFr ? 'DÉCOTE ENTRÉE' : 'ENTRY DISCOUNT'}
                        </div>
                        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '32px', fontWeight: 600, color: gapPct > 0 ? GD : RED, lineHeight: 1 }}>
                          {gapPct > 0 ? '+' : ''}{gapPct}%
                        </div>
                        <div style={{ fontSize: '11px', color: LTT3, marginTop: '4px' }}>
                          {isFr ? `vs valeur reconstituée ${fmt(nautVal)}` : `vs reconstructed value ${fmt(nautVal)}`}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        {(() => {
                          const maxScale = (lot.fair_value_nautilus as number) * 1.1;
                          const entryPct = Math.min((price / maxScale) * 100, 98);
                          const maxBidPct = Math.min(((avoidAbove ?? maxBid ?? price) / maxScale) * 100, 98);
                          return (
                            <>
                              <div style={{ position: 'relative', height: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', marginBottom: '12px' }}>
                                <div style={{ position: 'absolute', left: 0, width: entryPct + '%', height: '100%', background: '#34D399', borderRadius: '3px', opacity: 0.7 }} />
                                <div style={{ position: 'absolute', left: entryPct + '%', transform: 'translateX(-50%)', top: '-5px', width: '2px', height: '16px', background: '#34D399', borderRadius: '1px' }} />
                                <div style={{ position: 'absolute', left: maxBidPct + '%', transform: 'translateX(-50%)', top: '-5px', width: '2px', height: '16px', background: '#C6A85A', borderRadius: '1px' }} />
                                <div style={{ position: 'absolute', left: '99%', transform: 'translateX(-50%)', top: '-5px', width: '2px', height: '16px', background: '#9CA3AF', borderRadius: '1px' }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                                <div><div style={{ fontWeight: 700, color: '#34D399' }}>{fmtExact(price)}</div><div style={{ color: LTT3 }}>{isFr ? 'Entrée' : 'Entry'}</div></div>
                                <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700, color: '#C6A85A' }}>{fmtExact(avoidAbove ?? maxBid)}</div><div style={{ color: LTT3 }}>Max bid</div></div>
                                <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700, color: LTT2 }}>{fmtExact(lot.fair_value_nautilus)}</div><div style={{ color: LTT3 }}>{isFr ? 'Médiane' : 'Median'}</div></div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* ROW B — 3 ◆ bullets POURQUOI CETTE INEFFICIENCE */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
                      ◆ {isFr ? 'POURQUOI CETTE INEFFICIENCE PEUT EXISTER' : 'WHY THIS INEFFICIENCY MAY EXIST'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '7px' }}>
                      {([
                        isFr ? 'Artiste hors des circuits institutionnels majeurs — moins de visibilité acheteurs.' : 'Artist outside major institutional circuits — lower buyer visibility.',
                        isFr ? 'Vente dans une maison régionale ou spécialisée — audience plus restreinte.' : 'Sale at regional or specialist house — narrower audience.',
                        isFr ? 'Opportunité de timing : la reconnaissance suit souvent avec délai les performances réelles.' : 'Timing opportunity: recognition often lags actual performance.',
                      ] as string[]).map((b, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <span style={{ color: GOLD, fontSize: '10px', marginTop: '2px', flexShrink: 0 }}>◆</span>
                          <span style={{ fontSize: '12px', color: LTT2, lineHeight: 1.55 }}>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          );
        })()}

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
                        }}>{isFr ? (lot.artist_profile.investment_tier === 'emerging' ? 'émergent' : lot.artist_profile.investment_tier === 'mid_career' ? 'mi-carrière' : lot.artist_profile.investment_tier.replace('_', ' ')) : lot.artist_profile.investment_tier.replace('_', ' ')}</span>
                      )}
                      {lot.artist?.trend && (
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: '3px',
                          color: lot.artist.trend === 'up' ? GL : lot.artist.trend === 'down' ? RED : LTT3,
                          background: lot.artist.trend === 'up' ? '#F0FDF4' : lot.artist.trend === 'down' ? '#FEF2F2' : LT,
                        }}>{lot.artist.trend === 'up' ? (isFr ? '↑ EN HAUSSE' : '↑ RISING') : lot.artist.trend === 'down' ? (isFr ? '↓ EN BAISSE' : '↓ FALLING') : (isFr ? '→ STABLE' : '→ STABLE')}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const }}>
                      {lot.artist?.liquidity_score != null && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>
                          {isFr ? 'Liquidité' : 'Liquidity'} <strong style={{ color: LTT2 }}>{Math.round(lot.artist.liquidity_score)}/100</strong>
                        </span>
                      )}
                      {lot.artist?.sell_through_rate != null && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>
                          {isFr ? 'Taux de vente' : 'Sell-thru'} <strong style={{ color: LTT2 }}>{Math.round(lot.artist.sell_through_rate * 100)}%</strong>
                        </span>
                      )}
                      {lot.artist?.total_lots_sold != null && lot.artist.total_lots_sold > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>
                          <strong style={{ color: LTT2 }}>{lot.artist.total_lots_sold.toLocaleString()}</strong> {isFr ? 'lots suivis' : 'lots tracked'}
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
                    {t('lot.fullAnalysis')}
                  </div>
                </div>
              </div>
            )}

            {/* ── DATA GRID 50/50 ─────────────────────────────────────────────── */}
            <div style={{ padding: '16px 40px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '16px' }}>◆ {isFr ? 'ANALYSE' : 'ANALYSIS'}</div>
              <div className="lot-analysis-grid" style={{ border: `0.5px solid ${LTB}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>

              {/* LEFT COLUMN — Real Cost Breakdown + Investment Analysis */}
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '20px', borderRight: `0.5px solid ${LTB}` }}>

                {hasAccess && realCost && (
                  <div>
                    <div style={sl}>{t('lot.realCostBreakdown')}</div>
                    {([
                      { k: isFr ? 'Prix adjugé' : 'Hammer price',                                         v: price,                            bold: false },
                      { k: isFr ? `Frais acheteur (${realCost.buyers_premium_pct}%)` : `Buyer's premium (${realCost.buyers_premium_pct}%)`,    v: Math.round(realCost.cost_basis - price), bold: false },
                      { k: isFr ? 'Coût de détention (3 ans)' : 'Holding cost (3yr)',                                   v: realCost.holding_cost_3y,         bold: false },
                    ] as { k: string; v: number; bold: boolean }[]).filter(r => r.v > 0).map(r => (
                      <div key={r.k} style={dRow}>
                        <span style={{ fontSize: '13px', color: LTT2 }}>{r.k}</span>
                        <span style={{ fontSize: '13px', color: LTT1, fontWeight: 500 }}>{fmt(r.v)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                      <span style={{ fontSize: '13px', color: LTT1, fontWeight: 700 }}>{isFr ? 'Coût total' : 'All-in cost'}</span>
                      <span style={{ fontSize: '16px', color: GOLD, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmt(totalCost)}</span>
                    </div>
                    <div style={{ background: '#FAFAF7', border: `1px solid ${LTB}`, borderRadius: '8px', padding: '6px 10px', marginTop: '14px' }}>
                      <div style={{ fontSize: '12px', color: LTT2 }}>{isFr ? `Nécessite +${breakEvenGain.toFixed(1)}% pour atteindre le seuil de rentabilité` : `Needs +${breakEvenGain.toFixed(1)}% to break even`}</div>
                      <div style={{ fontSize: '12px', color: GOLD, fontWeight: 600, marginTop: '3px' }}>{isFr ? 'Prix adjugé seuil :' : 'Break-even hammer:'} {fmt(realCost.breakeven_hammer)}</div>
                    </div>
                  </div>
                )}

                {/* Investment Analysis */}
                <div>
                  <div style={sl}>{t('lot.investmentAnalysis')}</div>
                  {canSeeAnalysis ? (
                    <div className="lot-investment-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '20px 14px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: LTT3, marginBottom: '10px' }}>{t('lot.currentPrice')}</div>
                        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 600, color: LTT1, lineHeight: 1 }}>{fmt(price)}</div>
                        <div style={{ fontSize: '11px', color: LTT3, marginTop: '6px' }}>{t('lot.whatYouPay')}</div>
                      </div>
                      <div style={{ background: DK, border: `1px solid ${DKB}`, borderRadius: '12px', padding: '20px 14px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '10px' }}>{t('lot.fairValue')}</div>
                        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 600, color: '#F0EDE6', lineHeight: 1 }}>{fmt(fairVal)}</div>
                        <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '6px' }}>{t('lot.marketEstimate')}</div>
                      </div>
                      <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '20px 14px', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', color: LTT3, marginBottom: '10px' }}>{t('lot.upside')}</div>
                        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 600, color: GL, lineHeight: 1 }}>
                          {upsidePct > 0 ? `+${upsidePct.toFixed(0)}%` : 'At market'}
                        </div>
                        <div style={{ fontSize: '11px', color: LTT3, marginTop: '6px' }}>{t('lot.vsEstimate')}</div>
                      </div>
                    </div>
                  ) : !hasAccess ? null : (
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
              <div style={{ padding: '16px 18px' }}>
                <div style={sl}>{t('lot.lotDetails')}</div>
                {([
                  { label: t('common.artist'),    value: lot.artist_name_raw, nav: `/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}`, link: true },
                  { label: t('lot.medium'),        value: lot.medium },
                  { label: t('common.category'),   value: lot.category },
                  { label: t('lot.estimate'),      value: (estLow || estHigh) ? `${fmt(estLow)} – ${fmt(estHigh)}` : null },
                  { label: t('lot.house'),         value: lot.auction_house_name },
                  { label: t('common.closes'),     value: auctionDateFmt },
                  { label: 'Lot #',                value: lot.lot_number },
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
                {!hasAccess && (
                  <div style={dRow}>
                    <span style={{ fontSize: '13px', color: LTT2, minWidth: '80px', flexShrink: 0 }}>{t('common.source')}</span>
                    <span
                      onClick={() => setUpgradeModal('source')}
                      style={{ fontSize: '13px', color: '#C6A85A', cursor: 'pointer', fontStyle: 'italic', opacity: 0.8 }}
                    >
                      {isFr ? '🔒 Source masquée' : '🔒 Source hidden'}
                    </span>
                  </div>
                )}

                {/* Due diligence / provenance alert */}
                {provRisk && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '12px 16px', marginTop: '14px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.13em', color: AMB, textTransform: 'uppercase', marginBottom: '8px' }}>
                      {isFr ? "Points à vérifier avant d'enchérir" : 'Check these before bidding'}
                    </div>
                    {(provRisk.flags as { code: string; severity: string; label: string; detail: string }[]).map((f, i) => (
                      <div key={f.code}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: f.severity === 'HIGH' ? AMB : f.severity === 'MEDIUM' ? AMB : LTT2, marginBottom: '3px' }}>
                          ● {translateDueDiligence(f.label)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#92400E', lineHeight: 1.5, marginBottom: i < provRisk.flags.length - 1 ? '8px' : 0 }}>{translateDueDiligence(f.detail)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* COL 3 — Stratégie de sortie */}
              <div style={{ padding: '16px 18px', background: LT }}>
                <div style={{ fontSize: '10px', color: LTT3, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: '14px' }}>
                  {isFr ? 'STRATÉGIE DE SORTIE' : 'EXIT STRATEGY'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: LTT1, marginBottom: '4px' }}>
                  {isFr ? 'Horizon optimal : 3–5 ans' : 'Optimal horizon: 3–5 years'}
                </div>
                {lot.cagr && (
                  <div style={{ fontSize: '11px', color: LTT3, marginBottom: '14px' }}>CAGR : {lot.cagr}%</div>
                )}
                <div style={{ fontSize: '10px', color: LTT3, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>
                  {isFr ? 'CATALYSEURS' : 'CATALYSTS'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '7px' }}>
                  {priceHistory?.statistics?.trend_pct != null && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: GOLD, fontSize: '9px', marginTop: '3px' }}>◆</span>
                      <span style={{ fontSize: '12px', color: LTT2 }}>
                        {isFr ? `Momentum artiste ↑ ${priceHistory.statistics.trend_pct}% YoY` : `Artist momentum ↑ ${priceHistory.statistics.trend_pct}% YoY`}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: GOLD, fontSize: '9px', marginTop: '3px' }}>◆</span>
                    <span style={{ fontSize: '12px', color: LTT2 }}>
                      {isFr ? "Faible prix d'entrée — asymétrie favorable" : 'Low entry price — favorable asymmetry'}
                    </span>
                  </div>
                  {priceHistory?.statistics?.sell_above_estimate_pct != null && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: GOLD, fontSize: '9px', marginTop: '3px' }}>◆</span>
                      <span style={{ fontSize: '12px', color: LTT2 }}>
                        {isFr ? `Liquidité catégorie — ${priceHistory.statistics.sell_above_estimate_pct}% sell-through` : `Category liquidity — ${priceHistory.statistics.sell_above_estimate_pct}% sell-through`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              </div>
            </div>

            {canSeeAnalysis && (() => {
              const content = (
                <div style={{ padding: '24px' }}>
                  {/* ── Price Position Bar ── */}
                  {lot.fair_value_nautilus != null && price > 0 && (() => {
                    const nautVal = lot.fair_value_nautilus as number;
                    const bidRef = avoidAbove ?? maxBid;
                    const maxScale = nautVal * 1.1;
                    const pctOf = (v: number) => `${Math.min(100, (v / maxScale) * 100).toFixed(1)}%`;
                    return (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ position: 'relative', height: '6px', background: LTB, borderRadius: '3px', marginBottom: '26px' }}>
                          <div style={{ position: 'absolute', left: pctOf(price), top: '-4px', width: '2px', height: '14px', background: '#34D399', borderRadius: '1px' }} />
                          {bidRef && <div style={{ position: 'absolute', left: pctOf(bidRef), top: '-4px', width: '2px', height: '14px', background: GOLD, borderRadius: '1px' }} />}
                          <div style={{ position: 'absolute', left: pctOf(nautVal), top: '-4px', width: '2px', height: '14px', background: LTT3, borderRadius: '1px' }} />
                          <div style={{ position: 'absolute', left: pctOf(price), top: '18px', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#34D399', letterSpacing: '0.08em', whiteSpace: 'nowrap' as const }}>
                            {isFr ? 'ENTRÉE CIBLE' : 'ENTRY'}
                          </div>
                          {bidRef && (
                            <div style={{ position: 'absolute', left: pctOf(bidRef), top: '18px', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.08em', whiteSpace: 'nowrap' as const }}>
                              MAX
                            </div>
                          )}
                          <div style={{ position: 'absolute', left: pctOf(nautVal), top: '18px', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.08em', whiteSpace: 'nowrap' as const }}>
                            {isFr ? 'VALEUR' : 'VALUE'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── POURQUOI LE MARCHÉ SE TROMPE ── */}
                  {lot.fair_value_nautilus != null && (() => {
                    const nautVal = lot.fair_value_nautilus as number;
                    const gapPct = price > 0 ? Math.round((1 - price / nautVal) * 100) : 0;
                    const marketBullets = [
                      isFr
                        ? 'Le marché secondaire sous-pondère souvent les artistes hors grandes maisons.'
                        : 'Secondary market often underweights artists outside major houses.',
                      timingSignal
                        ? isFr ? `Signal Nautilus : ${timingSignal}` : `Nautilus signal: ${timingSignal}`
                        : null,
                    ].filter(Boolean) as string[];
                    if (marketBullets.length === 0) return null;
                    return (
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
                          ◆ {isFr ? 'POURQUOI LE MARCHÉ SE TROMPE' : 'WHY THE MARKET IS WRONG'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '7px' }}>
                          {marketBullets.map((b, i) => (
                            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <span style={{ color: GOLD, fontSize: '10px', marginTop: '2px', flexShrink: 0 }}>◆</span>
                              <span style={{ fontSize: '12px', color: LTT2, lineHeight: 1.55 }}>{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── LECTURE NAUTILUS ── */}
                  {(() => {
                    const rationaleText = typeof lot.score_rationale === 'string' && lot.score_rationale.trim() ? lot.score_rationale.trim() : null;
                    if (!rationaleText) return null;
                    return (
                      <div style={{ borderLeft: '2px solid rgba(198,168,90,0.4)', paddingLeft: '14px', marginBottom: '18px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>
                          {isFr ? 'LECTURE NAUTILUS' : 'NAUTILUS READ'}
                        </div>
                        <p style={{ fontSize: '12px', color: LTT2, lineHeight: 1.65, margin: 0 }}>{rationaleText}</p>
                      </div>
                    );
                  })()}
                  {comparables.length > 0 && (
                    <div style={{ marginBottom: '16px', borderTop: `1px solid ${LTB}`, paddingTop: '14px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, letterSpacing: '0.12em', marginBottom: '8px' }}>{isFr ? 'COMPARABLES RÉCENTS' : 'RECENT COMPARABLES'}</div>
                      {comparables.slice(0, 2).map((c: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i === 0 && comparables.length > 1 ? `1px solid ${LTB}` : 'none' }}>
                          <div style={{ fontSize: '11px', color: LTT2 }}>
                            {c.auction_house_name || 'Unknown'}{c.auction_date ? ` · ${new Date(c.auction_date).getFullYear()}` : ''}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: LTT1, fontFamily: 'var(--font-mono)' }}>
                            {c.currency === 'USD' ? '$' : c.currency === 'GBP' ? '£' : '€'}{Math.round(c.current_price || 0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                <div style={{ padding: '0 40px 24px' }}>
                  <div style={{ position: 'relative', background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', overflow: 'hidden' }}>
                    {canSeeAnalysis ? content : !hasAccess ? null : (
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

            {/* ── SCÉNARIOS DE VALORISATION ───────────────────────────────────── */}
            {!hasAccess ? null : !hasAccess ? (
              <div style={{ padding: '0 40px 24px' }}>
                <LockedBlock
                  title="Scénarios de valorisation"
                  teaser=""
                  ctaText={isFr ? 'Passer Investor pour débloquer →' : 'INVESTOR+ · UNLOCK →'}
                  ctaPrice="Investor"
                  planId="investor"
                  preview={<div style={{ height:'220px', background:LT, borderRadius:'8px' }}/>}
                />
              </div>
            ) : canSeeAnalysis && visibleYears.length > 0 && (
              <div style={{ padding: '0 40px 24px' }}>
                <div style={wCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '16px' }}>◆ {isFr ? 'SCÉNARIOS DE VALORISATION' : 'VALUATION SCENARIOS'} · {projCagr.toFixed(1)}% CAGR</div>
                    {lot.projection?.artist_tier && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>{lot.projection.artist_tier.replace('_', ' ')}</span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v: number) => `€${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={48} />
                      <Tooltip formatter={(val: number, name: string) => [`€${Number(val).toLocaleString()}`, name === 'optimistic' ? (isFr ? '🟢 Marché fort' : '🟢 Bull market') : name === 'value' ? (isFr ? '🟡 Marché stable' : '🟡 Stable market') : (isFr ? '🔴 Marché faible' : '🔴 Bear market')]} contentStyle={{ background: '#1A2A44', border: 'none', borderRadius: 8, fontSize: 12, color: 'white' }} />
                      <ReferenceLine y={price} stroke="#E8E4DC" strokeDasharray="4 2" />
                      <Line type="monotone" dataKey="optimistic" stroke="#16A34A" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="value" stroke="#B8922A" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="conservative" stroke="#DC2626" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#16A34A' }}>● {isFr ? 'Marché fort' : 'Bull market'}</span>
                    <span style={{ fontSize: 11, color: '#B8922A' }}>● {isFr ? 'Marché stable' : 'Stable market'}</span>
                    <span style={{ fontSize: 11, color: '#DC2626' }}>● {isFr ? 'Marché faible' : 'Bear market'}</span>
                  </div>
                  {lot.projection?.sell_recommendation && (
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '8px 12px', marginTop: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GL, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>{isFr ? 'SORTIE OPTIMALE' : 'OPTIMAL EXIT'} · </span>
                      <span style={{ fontSize: '12px', color: LTT2 }}>{lot.projection.sell_recommendation}</span>
                    </div>
                  )}
                  <p style={{ fontSize: '11px', fontStyle: 'italic', color: LTT3, marginTop: '10px', lineHeight: 1.6 }}>
                    {isFr ? "Projections basées sur les données historiques des enchères et la modélisation statistique. Les performances passées ne garantissent pas les résultats futurs. Nautilus n'est pas un conseiller financier." : "Projections based on historical auction data and statistical modeling, capped at 15% to reflect long-term market realism. Past performance does not guarantee future returns. Nautilus is not a financial advisor — this is not financial advice."}
                  </p>
                </div>
              </div>
            )}

            {/* ── COMPARABLE SALES CARDS ────────────────────────────────────────── */}
            {!hasAccess ? (
              comparables.length > 0 && (
                <div className="lot-mobile-only" style={{ padding: '0 16px 8px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
                    ◆ {isFr ? 'PREUVES MARCHÉ' : 'MARKET PROOF'}
                  </div>
                  {comparables.slice(0, 3).map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < Math.min(2, comparables.length - 1) ? `1px solid ${LTB}` : 'none' }}>
                      <span style={{ fontSize: '13px', color: LTT2 }}>
                        {c.auction_house_name || (isFr ? 'Maison inconnue' : 'Unknown')}{c.auction_date ? ` — ${new Date(c.auction_date).getFullYear()}` : ''}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: LTT1 }}>
                        €{Math.round(c.current_price || 0).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  ))}
                  {comparables.length > 3 && (
                    <div
                      onClick={() => navigate('/app/pricing')}
                      style={{ marginTop: '12px', fontSize: '12px', color: GOLD, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
                    >
                      + {comparables.length - 3} {isFr ? 'ventes comparables supplémentaires avec Investor →' : 'more comparable sales with Investor →'}
                    </div>
                  )}
                </div>
              )
            ) : displayComps.length > 0 && (
              <div style={{ padding: '0 40px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '16px' }}>◆ {isFr ? 'LOTS SIMILAIRES' : 'SIMILAR LOTS'}</div>
                  {(comparables as any)?.market_analysis && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: LTT2 }}>
                      Comps avg: {fmt((comparables as any).market_analysis.market_avg_price)} ·{' '}
                      <span style={{ color: (comparables as any).market_analysis.price_gap_pct > 0 ? GL : RED, fontWeight: 700 }}>
                        {(comparables as any).market_analysis.price_gap_pct > 0 ? '+' : ''}{(comparables as any).market_analysis.price_gap_pct}% vs this lot
                      </span>
                    </div>
                  )}
                </div>
                <div className="lot-comparables-grid" style={{ display: 'grid', gridTemplateColumns: displayComps.length === 1 ? '1fr' : displayComps.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
                  {displayComps.map((comp: any) => {
                    const compPrice = comp.current_price || comp.estimate_low || 0;
                    const daysAgo = comp.days_since_sale;
                    const daysLabel = daysAgo != null
                      ? daysAgo < 30 ? (isFr ? `il y a ${daysAgo}j` : `${daysAgo}d ago`)
                      : daysAgo < 365 ? (isFr ? `il y a ${Math.round(daysAgo / 30)} mois` : `${Math.round(daysAgo / 30)}mo ago`)
                      : (isFr ? `il y a ${Math.round(daysAgo / 365)} an${Math.round(daysAgo / 365) > 1 ? 's' : ''}` : `${Math.round(daysAgo / 365)}yr ago`)
                      : null;
                    const premRatio = comp.premium_ratio;
                    return (
                      <div key={comp.id}
                        className="comp-card-light"
                        onClick={() => comp.is_historical ? null : navigate(`/app/opportunities/${comp.id}`)}
                        style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '10px', overflow: 'hidden', cursor: comp.is_historical ? 'default' : 'pointer' }}
                      >
                        {comp.image_url ? (
                          <div style={{ height: '100px', overflow: 'hidden', position: 'relative' }}>
                            <img src={comp.image_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {daysLabel && (
                              <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '3px' }}>
                                {daysLabel}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ height: '100px', background: LT, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <span style={{ fontSize: '28px', opacity: 0.12 }}>◎</span>
                            {daysLabel && (
                              <span style={{ position: 'absolute', top: '8px', right: '8px', background: LTB, color: LTT3, fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '3px' }}>
                                {daysLabel}
                              </span>
                            )}
                          </div>
                        )}
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: LTT3, textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {comp.auction_house_name || comp.artist_name_raw || 'Unknown'}
                          </div>
                          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '12px', color: LTT1, marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {comp.title || 'Untitled'}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: GOLD }}>€{compPrice.toLocaleString('en-GB')}</span>
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

            {/* ── DESKTOP FREE: PAYWALL ── */}
            {!hasAccess && (
              <div className="lot-upgrade-block" style={{ margin: '0 40px 32px', borderRadius: '12px', overflow: 'hidden', background: '#0F1824', border: '1px solid rgba(198,168,90,0.18)' }}>
                <div style={{ padding: '28px 32px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: '14px' }}>
                    ◆ NAUTILUS INVESTOR
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '20px', color: '#F0EDE6', fontWeight: 600, marginBottom: '20px', lineHeight: 1.3 }}>
                    {isFr ? 'Débloquez la conviction complète' : 'Unlock full conviction'}
                  </div>
                  {comparables.length > 0 && (
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6B7280' }}>
                        {comparables.length} {isFr ? 'ventes comparables · Prix moyen' : 'comparable sales · Avg price'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#4B5563', userSelect: 'none' as const }}>████</span>
                    </div>
                  )}
                  <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column' as const, gap: '7px' }}>
                    {(isFr ? [
                      "Jusqu'où enchérir sans surpayer",
                      'Le vrai coût après frais',
                      'Les comparables complets',
                      'Pourquoi ce lot est sous-évalué',
                      "Les risques réels avant d'acheter",
                    ] : [
                      'How high to bid without overpaying',
                      'The true cost after all fees',
                      'Full comparable sales data',
                      'Why this lot is undervalued',
                      'The real risks before you bid',
                    ]).map(f => (
                      <div key={f} style={{ fontSize: '13px', color: '#9CA3AF', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: GOLD, fontSize: '10px' }}>✓</span> {f}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic', lineHeight: 1.55, marginBottom: '22px' }}>
                    {isFr
                      ? 'Les membres Investor identifient en moyenne +34% de potentiel sur les lots score 80+.'
                      : 'Investor members identify on average +34% more potential on lots with score 80+.'}
                  </div>
                  <button
                    onClick={() => { navigate('/app/pricing'); window.scrollTo(0, 0); }}
                    style={{ background: '#C6A85A', color: '#0F1824', border: 'none', padding: '12px 28px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, cursor: 'pointer', display: 'block', maxWidth: '280px', margin: '0 auto' }}
                  >
                    {isFr ? 'Passer Investor →' : 'Upgrade to Investor →'}
                  </button>
                </div>
                <div style={{ padding: '14px 32px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div
                    onClick={() => navigate('/app/pricing?plan=pro')}
                    style={{ fontSize: '11px', color: '#4B5563', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textAlign: 'center' as const }}
                  >
                    {isFr
                      ? 'Analyse institutionnelle complète disponible avec Pro →'
                      : 'Full institutional analysis available with Pro →'}
                  </div>
                </div>
              </div>
            )}

            {/* ── MOBILE FREE: LECTURE NAUTILUS + PAYWALL ── */}
            {!hasAccess && (() => {
              const aiText = typeof lot.score_rationale === 'string' && lot.score_rationale.trim() ? lot.score_rationale.trim() : null;
              const sentences = aiText ? (aiText.match(/[^.!?]+[.!?]+/g) || []) : [];
              const excerpt = sentences.slice(0, 3).join(' ').trim() || (aiText ? aiText.slice(0, 300) : null);
              return (
                <div className="lot-mobile-only" style={{ padding: '0 16px 8px' }}>
                  {excerpt && (
                    <div style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '16px 18px', marginBottom: '12px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
                        ◆ {isFr ? 'LECTURE NAUTILUS' : 'NAUTILUS READ'}
                      </div>
                      <p style={{ fontSize: '13px', color: LTT2, lineHeight: 1.7, margin: 0 }}>{excerpt}</p>
                    </div>
                  )}
                  <div style={{ borderRadius: '12px', background: '#0F1824', border: '1px solid rgba(198,168,90,0.18)', marginBottom: '24px' }}>
                    <div style={{ padding: '24px 24px 20px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
                        ◆ NAUTILUS INVESTOR
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginBottom: '16px', lineHeight: 1.3 }}>
                        {isFr ? 'Débloquez la conviction complète' : 'Unlock full conviction'}
                      </div>
                      {comparables.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '14px' }}>
                          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{isFr ? 'Ventes comparables' : 'Comparable sales'}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(255,255,255,0.15)', letterSpacing: '0.04em' }}>{'████ ████'}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', marginBottom: '20px' }}>
                        {[
                          isFr ? '✓ Toutes les ventes comparables' : '✓ All comparable sales',
                          isFr ? '✓ Valeur de référence Nautilus' : '✓ Nautilus reference value',
                          isFr ? '✓ Scénarios de valorisation' : '✓ Valuation scenarios',
                          isFr ? '✓ Intelligence Nautilus complète' : '✓ Full Nautilus intelligence',
                          isFr ? '✓ Alertes et suivi de portefeuille' : '✓ Alerts & portfolio tracking',
                        ].map((b, i) => (
                          <div key={i} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{b}</div>
                        ))}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '16px', fontStyle: 'italic' }}>
                        {isFr ? '🔒 Rejoint par 1 200+ collectionneurs' : '🔒 Joined by 1,200+ collectors'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          onClick={() => { navigate('/app/pricing'); window.scrollTo(0, 0); }}
                          style={{ maxWidth: '280px', width: '100%', padding: '14px 0', background: GOLD, color: '#0C1622', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          {isFr ? 'Passer Investor →' : 'Go Investor →'}
                        </button>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px' }}>
                      <button
                        onClick={() => navigate('/app/pricing')}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
                      >
                        {isFr ? 'Analyse institutionnelle disponible avec Pro →' : 'Institutional analysis available with Pro →'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ──────────────── COMPARABLE SALES ──────────────── */}
        <div style={{ padding: '16px 40px 24px' }}>
            {!hasAccess ? null : !hasAccess ? (
              <LockedBlock
                title="Ventes comparables"
                teaser=""
                ctaText={isFr ? 'Passer Investor pour débloquer →' : 'INVESTOR+ · UNLOCK →'}
                ctaPrice="Investor"
                planId="investor"
                preview={<div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>{[1,2,3].map(i=><div key={i} style={{ height:'44px', background:LT, borderRadius:'6px' }}/>)}</div>}
              />
            ) : comparables.length === 0 ? (
              <div style={{ ...wCard, textAlign: 'center', padding: '60px 24px' }}>
                <div style={{ fontSize: '32px', opacity: 0.15, marginBottom: '16px' }}>◎</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, letterSpacing: '0.1em' }}>No comparable sales found for this lot.</div>
              </div>
            ) : (
              <>
                {/* Full comparables table */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '12px' }}>◆ {isFr ? 'VENTES COMPARABLES' : 'COMPARABLE SALES'}</div>
                <div style={wCard}>
                  <table className="lot-comp-table" style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead>
                      <tr>
                        {(isFr ? ['Artiste', 'Titre', 'Prix', 'Score', 'Date'] : ['Artist', 'Title', 'Price', 'Score', 'Date']).flatMap((col, ci) => {
                          const thStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase', color: LTT3, textAlign: 'left', padding: '10px 12px 10px 0', borderBottom: `1px solid ${LTB}` };
                          return ci === 2 ? [
                            <th key="bar-h" style={{ width: '120px', padding: '10px 8px 10px 0', borderBottom: `1px solid ${LTB}` }}></th>,
                            <th key={col} style={thStyle}>{col}</th>,
                          ] : [<th key={col} style={thStyle}>{col}</th>];
                        })}
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
                            <td style={{ width: '120px', padding: '0 8px', borderBottom: `1px solid #F0EDE6` }}>
                              <div style={{ height: '3px', background: LTB, borderRadius: '2px' }}>
                                <div style={{ height: '100%', width: ((compPrice / maxCompPrice) * 100) + '%', background: GOLD, borderRadius: '2px' }} />
                              </div>
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
                      <tr style={{ background: 'rgba(52,211,153,0.04)' }}>
                        <td style={{ padding: '11px 12px 11px 0', borderTop: `1px solid ${LTB}`, fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>{isFr ? 'Votre lot' : 'This lot'}</td>
                        <td style={{ padding: '11px 12px 11px 0', borderTop: `1px solid ${LTB}`, fontSize: '13px', color: LTT1 }}>{lot.auction_house_name || '—'}</td>
                        <td style={{ width: '120px', padding: '0 8px', borderTop: `1px solid ${LTB}` }}>
                          <div style={{ height: '3px', background: 'rgba(52,211,153,0.2)', borderRadius: '2px' }}>
                            <div style={{ height: '100%', width: (price / maxCompPrice * 100) + '%', background: '#34D399', borderRadius: '2px' }} />
                          </div>
                        </td>
                        <td style={{ padding: '11px 12px 11px 0', borderTop: `1px solid ${LTB}`, fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: '#34D399', whiteSpace: 'nowrap' as const }}>{fmt(price)}</td>
                        <td style={{ padding: '11px 12px 11px 0', borderTop: `1px solid ${LTB}`, fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, whiteSpace: 'nowrap' as const }}>—</td>
                        <td style={{ padding: '11px 0 11px 0', borderTop: `1px solid ${LTB}`, fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, whiteSpace: 'nowrap' as const }}>—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

        {/* ──────────────── ANALYSIS ──────────────── */}
        <div style={{ padding: '16px 40px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* AI Intelligence cards */}
            {!hasAccess ? null : (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '16px' }}>◆ {isFr ? 'INTELLIGENCE IA' : 'AI INTELLIGENCE'}</div>
              {!hasAccess ? (
                <LockedBlock
                  title="AI Intelligence"
                  teaser=""
                  ctaText={isFr ? 'Passer Investor pour débloquer →' : 'INVESTOR+ · UNLOCK →'}
                  ctaPrice="Investor"
                  planId="investor"
                  preview={<div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>{[1,2].map(i=><div key={i} style={{ height:'140px', background:LT, borderRadius:'12px' }}/>)}</div>}
                />
              ) : (
              <div className="lot-ai-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Investment Memo card */}
                <div style={{ background: 'var(--bg-subtle)', border: `1px solid ${LTB}`, borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: GOLD, fontSize: '13px', lineHeight: 1 }}>◆</span>
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', color: LTT1, fontWeight: 500 }}>{isFr ? "Mémo d'investissement" : 'Investment Memo'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: LTT3, marginBottom: '16px', lineHeight: 1.5 }}>
                    {isFr ? "Analyse générée par IA du potentiel d'investissement de ce lot." : "AI-generated analysis of this lot's investment potential."}
                    <span style={{ color: LTT3, marginLeft: '4px' }}>· PDF · ~5 min</span>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: BL, padding: '3px 8px', borderRadius: '3px' }}>INVESTOR+</span>
                  </div>
                  {isInvestor ? (
                    <>
                      <div
                        onClick={memo ? () => setShowMemo(true) : generateMemo}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: memoLoading ? 'rgba(198,168,90,0.4)' : GOLD, cursor: memoLoading ? 'not-allowed' : 'pointer', letterSpacing: '0.08em', borderBottom: '1px solid rgba(198,168,90,0.3)', paddingBottom: '1px', marginTop: '12px' }}
                      >
                        {memoLoading ? (isFr ? '◆ GÉNÉRATION…' : '◆ GENERATING…') : memo ? (isFr ? '◆ VOIR LE MÉMO →' : '◆ VIEW MEMO →') : (isFr ? '◆ GÉNÉRER LE MÉMO →' : '◆ GENERATE MEMO →')}
                      </div>
                      {memo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                          <span style={{ padding: '3px 10px', background: memo.recommendation === 'BUY' ? 'rgba(26,127,75,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${memo.recommendation === 'BUY' ? 'rgba(26,127,75,0.25)' : 'rgba(217,119,6,0.25)'}`, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: memo.recommendation === 'BUY' ? GL : AMB, borderRadius: '4px' }}>{memo.recommendation}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>Conviction {memo.conviction}/100</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ marginTop: '4px' }}>
                      <LockedBlock
                        title={isFr ? "Mémo d'investissement" : 'Investment Memo'}
                        teaser=""
                        ctaText={isFr ? 'Passer Investor pour débloquer →' : 'INVESTOR+ · UNLOCK →'}
                        ctaPrice="Investor"
                        planId="investor"
                        preview={<div style={{ height: '40px', background: LT, borderRadius: '6px' }} />}
                      />
                    </div>
                  )}
                </div>

                {/* Dossier d'investissement card — coming soon */}
                <div style={{ background: 'var(--bg-subtle)', border: `1px solid ${LTB}`, borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="7" stroke="#9CA3AF" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="4" stroke="#9CA3AF" strokeWidth="1.2"/>
                      <circle cx="8" cy="8" r="1.5" fill="#9CA3AF"/>
                    </svg>
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', color: LTT1, fontWeight: 500 }}>{isFr ? "Dossier d'investissement" : 'Investment Dossier'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: LTT3, marginBottom: '16px', lineHeight: 1.5 }}>
                    {isFr ? "Analyse complète — projections 5/10/20 ans, valorisation artiste & verdict IA." : "Full analysis — 5/10/20yr projections, artist valuation & AI verdict."}
                    <span style={{ color: LTT3, marginLeft: '4px' }}>· PDF · Analyse complète</span>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', background: '#F0F0FF', border: '1px solid #C7C7F0', color: '#5B5BD6', padding: '3px 8px', borderRadius: '3px' }}>PRO+</span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: GOLD, opacity: 0.4, letterSpacing: '0.08em', borderBottom: '1px solid rgba(198,168,90,0.3)', paddingBottom: '1px', marginTop: '12px', cursor: 'default' }}>
                    ◆ BIENTÔT DISPONIBLE
                  </div>
                </div>

              </div>
              )}
            </div>
            )}
          </div>

        {/* ──────────────── DOCUMENTS ──────────────── */}
        <div style={{ padding: '16px 40px 24px' }}>
            {!hasAccess ? null : !hasAccess ? (
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
              <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '12px' }}>◆ {isFr ? 'SOURCES' : 'SOURCES'}</div>
              <div style={{ ...wCard, padding: '12px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0' }}>

                  {/* Lot source */}
                  {trackUrl && (
                    <div style={{ ...dRow, paddingTop: '8px', paddingBottom: '8px' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '2px' }}>{isFr ? 'SOURCE DU LOT' : 'LOT SOURCE'}</div>
                        <div style={{ fontSize: '12px', color: LTT2 }}>{lot.auction_house_name || resolvedSource || 'Auction'}</div>
                      </div>
                      <a
                        href={trackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: BL, textDecoration: 'none', fontWeight: 600 }}
                      >
                        {isFr ? 'Voir le lot ↗' : 'View lot ↗'}
                      </a>
                    </div>
                  )}

                  {/* Artist search */}
                  {lot.artist_name_raw && (
                    <div style={{ ...dRow, paddingTop: '8px', paddingBottom: '8px' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '2px' }}>{isFr ? 'RECHERCHE ARTISTE' : 'ARTIST SEARCH'}</div>
                        <div style={{ fontSize: '12px', color: LTT2 }}>{lot.artist_name_raw}</div>
                      </div>
                      <a
                        href={sourceSearch[source] || `https://www.google.com/search?q=${artistEnc}+auction+results`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: BL, textDecoration: 'none', fontWeight: 600 }}
                      >
                        {isFr ? 'Rechercher l\'artiste ↗' : 'Search artist ↗'}
                      </a>
                    </div>
                  )}

                  {/* Auction house */}
                  {lot.auction_house_name && (
                    <div style={{ ...dRow, paddingTop: '8px', paddingBottom: '8px', borderBottom: 'none' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '2px' }}>{isFr ? 'MAISON DE VENTE' : 'AUCTION HOUSE'}</div>
                        <div style={{ fontSize: '12px', color: LTT2 }}>{lot.auction_house_name}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>
                        {sourceLabel}
                      </span>
                    </div>
                  )}

                </div>

                <p style={{ fontSize: '11px', color: LTT3, margin: '10px 0 0', lineHeight: 1.5 }}>
                  {isFr
                    ? `Les liens sources peuvent rediriger via le tracking Nautilus avant d'accéder à la plateforme de vente.${lot.auction_house_name ? ` Ce lot est proposé par ${lot.auction_house_name.split('—')[0].trim()}.` : ''}`
                    : `Source links may redirect via Nautilus tracking before landing on the auction platform.${lot.auction_house_name ? ` This lot is listed by ${lot.auction_house_name.split('—')[0].trim()}.` : ''}`
                  }
                </p>
              </div>
              </>
            )}
          </div>

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
              <div className="lot-memo-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '20px' }}>
                {[
                  { label: 'CURRENT PRICE', value: memo.current_price >= 1000 ? `€${(memo.current_price / 1000).toFixed(0)}K` : `€${memo.current_price}` },
                  { label: 'TARGET LOW',    value: memo.target_price?.low  ? `€${(memo.target_price.low  / 1000).toFixed(0)}K` : 'N/A' },
                  { label: 'TARGET HIGH',   value: memo.target_price?.high ? `€${(memo.target_price.high / 1000).toFixed(0)}K` : 'N/A' },
                  { label: 'CONVICTION',    value: memo.conviction >= 75 ? 'Conviction forte' : memo.conviction >= 55 ? 'Conviction modérée' : 'Conviction faible' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#6B7280', letterSpacing: '0.12em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: '#F0EDE6' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '28px 32px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', padding: '14px 16px', background: memo.recommendation === 'ACHETER' ? 'rgba(26,127,75,0.06)' : memo.recommendation === 'INTÉRESSANT' ? 'rgba(217,119,6,0.06)' : LT, borderRadius: '8px', border: `1px solid ${memo.recommendation === 'ACHETER' ? 'rgba(26,127,75,0.2)' : memo.recommendation === 'INTÉRESSANT' ? 'rgba(217,119,6,0.2)' : LTB}` }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: memo.recommendation === 'ACHETER' ? GL : memo.recommendation === 'INTÉRESSANT' ? AMB : LTT3 }}>
                  {memo.recommendation}
                </div>
              </div>

              {memo.hook && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>◆ POURQUOI CE LOT</div>
                  <p style={{ fontSize: '14px', color: LTT1, lineHeight: 1.8, margin: 0, fontStyle: 'italic' }}>{memo.hook}</p>
                </div>
              )}

              {memo.prix_justifie && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: LTT3, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>① LE PRIX EST-IL JUSTIFIÉ ?</div>
                  <p style={{ fontSize: '14px', color: LTT1, lineHeight: 1.8, margin: 0 }}>{memo.prix_justifie}</p>
                </div>
              )}

              {memo.liquidite && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: LTT3, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>② POURREZ-VOUS REVENDRE ?</div>
                  <p style={{ fontSize: '14px', color: LTT1, lineHeight: 1.8, margin: 0 }}>{memo.liquidite}</p>
                </div>
              )}

              {memo.timing && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: LTT3, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>③ EST-CE LE BON MOMENT ?</div>
                  <p style={{ fontSize: '14px', color: LTT1, lineHeight: 1.8, margin: 0 }}>{memo.timing}</p>
                </div>
              )}

              {memo.prudence && memo.prudence.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: LTT3, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>◆ CE QUI NOUS REND PRUDENTS</div>
                  {memo.prudence.map((item: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span style={{ color: RED, fontSize: '12px', marginTop: '2px', flexShrink: 0 }}>▲</span>
                      <span style={{ fontSize: '13px', color: LTT2, lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {memo.advisor_verdict && (
                <div style={{ marginBottom: '20px', padding: '16px', background: LT, borderRadius: '8px', border: `1px solid ${LTB}` }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '12px' }}>◆ CE QU'UN ADVISOR FERAIT</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: LTT1, marginBottom: '6px' }}>{memo.advisor_verdict.action}</div>
                  {memo.advisor_verdict.horizon && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3, marginBottom: '8px' }}>Horizon · {memo.advisor_verdict.horizon}</div>
                  )}
                  {memo.advisor_verdict.rationale && (
                    <p style={{ fontSize: '13px', color: LTT2, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{memo.advisor_verdict.rationale}</p>
                  )}
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
