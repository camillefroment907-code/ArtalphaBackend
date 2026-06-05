import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getPlanLimits, getToken, getUserPlan, isTrialActive, getTrialDaysLeft } from '../../lib/auth';
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

// ── DECISION HELPERS ──────────────────────────────────────────────────────────

function scoreHumanLabel(s: number): string {
  if (s >= 90) return 'Exceptionnel';
  if (s >= 80) return 'Très intéressant';
  if (s >= 70) return 'À regarder de près';
  if (s >= 60) return 'Potentiel modéré';
  return 'Peu prioritaire';
}
function confidenceLabel(n: number): { label: string; color: string } {
  if (n >= 50) return { label: 'Confiance élevée',   color: GD };
  if (n >= 10) return { label: 'Confiance moyenne',  color: '#FBBF24' };
  return              { label: 'Confiance limitée',  color: '#9CA3AF' };
}
function buildOptimismSignals(lot: any, isFr: boolean): string[] {
  const out: string[] = [];
  const pct = lot.pct_below_low_estimate || 0;
  if (pct > 5) out.push(isFr ? `Prix actuel ${Math.round(pct)}% sous l'estimation basse` : `Current price ${Math.round(pct)}% below low estimate`);
  if ((lot.artist?.sell_through_rate || 0) >= 0.65) out.push(isFr ? `${Math.round(lot.artist.sell_through_rate * 100)}% des œuvres de cet artiste trouvent acheteur` : `${Math.round(lot.artist.sell_through_rate * 100)}% of this artist's works find a buyer`);
  else if ((lot.artist?.liquidity_score || 0) >= 65) out.push(isFr ? 'Liquidité artiste élevée — facile à revendre' : 'High artist liquidity — easy to resell');
  const cc = lot.fair_value_confidence || 0;
  if (cc >= 10) out.push(isFr ? `Analyse basée sur ${cc} ventes comparables` : `Analysis based on ${cc} comparable sales`);
  if (lot.artist?.trend === 'up') out.push(isFr ? 'Marché artiste en progression' : 'Artist market trending up');
  return out.slice(0, 3);
}
function buildVigilanceSignals(lot: any, isFr: boolean): string[] {
  const out: string[] = [];
  if (lot.provenance_risk) out.push(isFr ? "Provenance peu documentée — vérifiez avant d'enchérir" : 'Provenance poorly documented — verify before bidding');
  if (lot.artist?.trend === 'down') out.push(isFr ? 'Marché artiste en recul récemment' : 'Artist market declining recently');
  if (lot.consignment_alert) out.push(isFr ? 'Volume de consignation élevé sur cette maison' : 'High consignment volume at this house');
  const cc = lot.fair_value_confidence || 0;
  if (cc > 0 && cc < 10) out.push(isFr ? 'Peu de ventes comparables disponibles' : 'Few comparable sales available');
  return out.slice(0, 2);
}
function buildChangeOfMind(lot: any, isFr: boolean): string[] {
  const out: string[] = [];
  if (lot.provenance_risk) out.push(isFr ? 'Provenance incomplète ou contestée' : 'Incomplete or contested provenance');
  if ((lot.artist?.sell_through_rate || 0) < 0.5) out.push(isFr ? 'Taux de vente inférieur à la moyenne du marché' : 'Sell-through rate below market average');
  out.push(isFr ? "Correction significative du marché secondaire de l'artiste" : "Significant correction in artist's secondary market");
  if ((lot.fair_value_confidence || 0) < 20) out.push(isFr ? 'Données encore limitées pour cette œuvre' : 'Still limited data for this work');
  return out.slice(0, 3);
}
function buildWhyNotHigher(lot: any, isFr: boolean): string[] {
  const out: string[] = [];
  const pct = lot.pct_below_low_estimate || 0;
  if (lot.provenance_risk) out.push(isFr ? 'Le prix semble attractif, mais la provenance reste partiellement documentée.' : 'The price looks attractive, but provenance remains partially documented.');
  else if (pct < 10) out.push(isFr ? "L'écart avec les comparables est positif, mais modeste." : 'The gap with comparables is positive, but modest.');
  if (lot.artist?.trend === 'down') out.push(isFr ? "Le marché de l'artiste montre quelques signes de ralentissement." : "The artist's market shows some signs of slowing.");
  else if ((lot.artist?.sell_through_rate || 0) < 0.7) out.push(isFr ? "Le marché reste actif, mais moins dynamique qu'en période haute." : "The market remains active, but less dynamic than at its peak.");
  if ((lot.fair_value_confidence || 0) < 30) out.push(isFr ? 'Les données sont solides, mais le nombre de transactions récentes reste limité.' : 'The data is solid, but the number of recent transactions remains limited.');
  return out.slice(0, 2);
}
function buildTimingReasons(lot: any, isFr: boolean, days: number | null): string[] {
  const out: string[] = [];
  if (days !== null && days >= 0 && days <= 14) out.push(isFr ? `La vente se termine dans ${days} jour${days > 1 ? 's' : ''} — le prix actuel reste inférieur aux comparables récents.` : `The sale closes in ${days} day${days !== 1 ? 's' : ''} — current price remains below recent comparables.`);
  const pct = lot.pct_below_low_estimate || 0;
  if (pct > 15) out.push(isFr ? `Cette œuvre est proposée ${Math.round(pct)}% sous l'estimation — une décote rarement observée pour ce segment.` : `This work is offered ${Math.round(pct)}% below estimate — a discount rarely seen in this segment.`);
  else if (pct > 5) out.push(isFr ? 'Le prix actuel reste inférieur à la médiane des ventes comparables récentes.' : 'The current price remains below the median of recent comparable sales.');
  if (lot.artist?.trend === 'up') out.push(isFr ? "Le marché de l'artiste est en progression — les prix pourraient évoluer à la hausse." : "The artist's market is trending up — prices may move higher.");
  return out.slice(0, 2);
}
function buildNarrativeReading(lot: any, isFr: boolean, cc: number): string {
  const pct = lot.pct_below_low_estimate || 0;
  const active = lot.artist?.trend !== 'down' && (lot.artist?.sell_through_rate || 0) >= 0.5;
  if (pct > 15 && cc >= 20) return isFr ? "Parmi les lots comparables actuellement disponibles, celui-ci présente l'un des rapports prix / opportunité les plus attractifs observés récemment. Le marché reste actif et les données disponibles nous permettent d'évaluer cette opportunité avec confiance." : "Among comparable lots currently available, this one presents one of the most attractive price / opportunity ratios observed recently. The market remains active and the available data allows us to evaluate this opportunity with confidence.";
  if (active && cc >= 10) return isFr ? "Cette œuvre présente plusieurs signaux favorables simultanément. Le marché de l'artiste reste soutenu et les comparables disponibles confortent notre lecture du prix." : "This work shows several favorable signals simultaneously. The artist's market remains supported and the available comparables reinforce our reading of the price.";
  return isFr ? "Cette œuvre ressort positivement dans notre analyse. Le niveau de conviction reste mesuré en raison du volume de données disponibles, mais les signaux observés justifient une attention particulière." : "This work stands out positively in our analysis. The conviction level remains measured due to the volume of available data, but the observed signals justify special attention.";
}

// ── TOOLTIP ───────────────────────────────────────────────────────────────────

function Tip({ text, width = 220, theme = 'dark', align = 'center' }: { text: string; width?: number; theme?: 'dark' | 'light'; align?: 'left' | 'center' | 'right' }) {
  const [show, setShow] = useState(false);
  const badgeColor  = theme === 'light' ? '#9CA3AF' : 'rgba(255,255,255,0.28)';
  const badgeBorder = theme === 'light' ? '1px solid #D1D5DB' : '1px solid rgba(255,255,255,0.18)';
  const popupPos = align === 'left'
    ? { left: 0,    transform: 'none' }
    : align === 'right'
    ? { right: 0,   left: 'auto' as const, transform: 'none' }
    : { left: '50%', transform: 'translateX(-50%)' };
  const arrowLeft = align === 'left' ? 14 : align === 'right' ? (width as number) - 14 : '50%';
  const arrowTransform = align === 'center' ? 'translateX(-50%)' : 'none';
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ color: badgeColor, fontSize: 9, border: badgeBorder, borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>?</span>
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', ...popupPos,
          background: '#0C1622', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
          fontSize: 13, fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 400,
          textTransform: 'none', letterSpacing: 'normal',
          padding: '12px 16px', borderRadius: 8, width, lineHeight: 1.65, zIndex: 9999,
          whiteSpace: 'pre-line', pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}>
          {text}
          <span style={{ position: 'absolute', top: '100%', left: arrowLeft, transform: arrowTransform, display: 'block', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #0C1622' }} />
        </div>
      )}
    </span>
  );
}

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
  const [comparables, setComparables]       = useState<any[]>([]);
  const [marketAnalysis, setMarketAnalysis] = useState<any>(null);
  const [maxBidFromApi, setMaxBidFromApi]   = useState<number | null>(null);
  const [maxBidSource, setMaxBidSource]     = useState<string | null>(null);
  const [fairValueFromComps, setFairValueFromComps] = useState<number | null>(null);
  const [fairValueSource, setFairValueSource]       = useState<string | null>(null);
  const [maxBidConfidence, setMaxBidConfidence]     = useState<string | null>(null);
  const [marketContext, setMarketContext]           = useState<string | null>(null);
  const [maxBidCompCount, setMaxBidCompCount]       = useState<number | null>(null);
  const [stickyVisible, setStickyVisible] = useState(false);

  const [subscribed, setSubscribed]       = useState(false);
  const [subId, setSubId]                 = useState<string | null>(null);
  const [subLoading, setSubLoading]       = useState(false);
  const [upgradeModal, setUpgradeModal]   = useState<'wishlist' | 'source' | 'provenance' | null>(null);

  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseLoading, setPurchaseLoading]   = useState(false);
  const [purchaseDone, setPurchaseDone]         = useState(false);
  const [hammerHistory, setHammerHistory] = useState<any>(null);
  const [hammerLoading, setHammerLoading] = useState(false);
  const [upsideSignal, setUpsideSignal]   = useState<any>(null);
  const [formatMatrix, setFormatMatrix]   = useState<any>(null);
  const [timingData, setTimingData]       = useState<any>(null);
  const [purchasePrice, setPurchasePrice]       = useState('');
  const [purchaseDate, setPurchaseDate]         = useState(() => new Date().toISOString().split('T')[0]);
  const [purchaseSource, setPurchaseSource]     = useState<'auction' | 'gallery' | 'private'>('auction');
  const heroRef = useRef<HTMLDivElement>(null);
  const [secsUntilClose, setSecsUntilClose] = useState<number | null>(null);
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
    const token = getToken();
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>;

    // ── Bundle fetch: 4 requests → 1 ─────────────────────────────────────────
    // On cache hit (>85% of requests): zero DB queries, single round-trip.
    // On cold path: hammer_history + upside served inline; lot + comparables
    //               may be null → individual fallback fetches below handle them.
    fetch(`${BACKEND}/api/lots/${id}/bundle?lang=fr`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(bundle => {
        if (!bundle) return;

        // Lot detail
        if (bundle.lot) {
          setLot(bundle.lot);
          setLoading(false);
        }

        // Comparables
        if (bundle.comparables) {
          const data = bundle.comparables;
          setComparables(data.comparables || []);
          setMarketAnalysis(data.market_analysis || null);
          setMaxBidFromApi(data.max_bid ?? null);
          setMaxBidSource(data.max_bid_source ?? null);
          setFairValueFromComps(data.fair_value ?? null);
          setFairValueSource(data.fair_value_source ?? null);
          setMaxBidConfidence(data.max_bid_confidence ?? null);
          setMarketContext(data.market_context ?? null);
          setMaxBidCompCount(data.max_bid_comp_count ?? null);
        }

        // Hammer history
        if (bundle.hammer_history) {
          setHammerHistory(bundle.hammer_history);
          setHammerLoading(false);
        }

        // Upside signal
        if (bundle.upside_signal) {
          const data = bundle.upside_signal;
          if (data.signal_label === 'High upside signal' || data.signal_label === 'Limited upside signal') {
            setUpsideSignal(data);
          }
        }

        // ── Fallback individual fetches for cold-path nulls ──────────────────
        if (!bundle.lot) {
          fetch(`${BACKEND}/api/lots/${id}`, { headers: authHeaders })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => { setLot(data); setLoading(false); })
            .catch(() => setLoading(false));
        }

        if (!bundle.comparables) {
          fetch(`${BACKEND}/api/lots/${id}/comparables`, { headers: authHeaders })
            .then(r => r.json())
            .then(data => {
              setComparables(data.comparables || []);
              setMarketAnalysis(data.market_analysis || null);
              setMaxBidFromApi(data.max_bid ?? null);
              setMaxBidSource(data.max_bid_source ?? null);
              setFairValueFromComps(data.fair_value ?? null);
              setFairValueSource(data.fair_value_source ?? null);
              setMaxBidConfidence(data.max_bid_confidence ?? null);
              setMarketContext(data.market_context ?? null);
              setMaxBidCompCount(data.max_bid_comp_count ?? null);
            })
            .catch(() => {});
        }

        if (!bundle.hammer_history && token) {
          setHammerLoading(true);
          fetch(`${BACKEND}/api/lots/${id}/hammer-history`, { headers: authHeaders })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => { setHammerHistory(data); setHammerLoading(false); })
            .catch(() => setHammerLoading(false));
        }

        if (!bundle.upside_signal && token) {
          fetch(`${BACKEND}/api/v1/upside/lot/${id}/signal?lang=fr`, { headers: authHeaders })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data?.signal_label === 'High upside signal' || data?.signal_label === 'Limited upside signal') {
                setUpsideSignal(data);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        // Bundle endpoint failed entirely — fall back to individual requests
        fetch(`${BACKEND}/api/lots/${id}`, { headers: authHeaders })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(data => { setLot(data); setLoading(false); })
          .catch(() => setLoading(false));
        fetch(`${BACKEND}/api/lots/${id}/comparables`, { headers: authHeaders })
          .then(r => r.json())
          .then(data => {
            setComparables(data.comparables || []);
            setMarketAnalysis(data.market_analysis || null);
            setMaxBidFromApi(data.max_bid ?? null);
            setMaxBidSource(data.max_bid_source ?? null);
            setFairValueFromComps(data.fair_value ?? null);
            setFairValueSource(data.fair_value_source ?? null);
            setMaxBidConfidence(data.max_bid_confidence ?? null);
            setMarketContext(data.market_context ?? null);
            setMaxBidCompCount(data.max_bid_comp_count ?? null);
          })
          .catch(() => {});
        if (token) {
          setHammerLoading(true);
          fetch(`${BACKEND}/api/lots/${id}/hammer-history`, { headers: authHeaders })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => { setHammerHistory(data); setHammerLoading(false); })
            .catch(() => setHammerLoading(false));
          fetch(`${BACKEND}/api/v1/upside/lot/${id}/signal?lang=fr`, { headers: authHeaders })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data?.signal_label === 'High upside signal' || data?.signal_label === 'Limited upside signal') {
                setUpsideSignal(data);
              }
            })
            .catch(() => {});
        }
      });
  }, [id]);

  useEffect(() => {
    if (!lot?.artist_name_raw || !getToken()) return;
    const token = getToken();
    const artistEnc = encodeURIComponent(lot.artist_name_raw);
    fetch(`${BACKEND}/api/artist-profiles/${artistEnc}/format-matrix`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setFormatMatrix(data))
      .catch(() => {});
    fetch(`${BACKEND}/api/artist-profiles/${artistEnc}/timing-optimizer`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setTimingData(data))
      .catch(() => {});
  }, [lot?.artist_name_raw]);

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

  useEffect(() => {
    if (!lot?.auction_date) { setSecsUntilClose(null); return; }
    const epoch = (d: string) => new Date(d.endsWith('Z') ? d : d + 'Z').getTime();
    const update = () => setSecsUntilClose(Math.round((epoch(String(lot.auction_date)) - Date.now()) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lot?.auction_date]);

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
  const estLow      = Number(lot.estimate_low || 0);
  const estHigh     = Number(lot.estimate_high || lot.estimate_low || 0);
  const estimateMid = estLow && estHigh ? Math.round((estLow + estHigh) / 2) : null;
  const price       = Number(lot.current_price || estimateMid || estLow || 0);
  const fairVal     = estHigh || price * 1.2;
  const upside    = Number(lot.pct_below_low_estimate || 0);
  const upsidePct = upside > 0 ? upside : 0;
  // Use API projections when available, fallback to CAGR calc
  // projCagr is in % (e.g. 8.5 = 8.5%/yr). Cap at 15% — guards against corrupted DB entries.
  const _projMapRaw: Record<number, any> = {};
  if (Array.isArray(lot.projection?.years)) {
    for (const p of lot.projection.years) _projMapRaw[p.years] = p;
  }
  const projCagr = Math.min(lot.projection?.cagr_pct ?? 0, 15);
  const hasProjection = !!lot.projection?.cagr_pct;
  // If API CAGR was >15%, projected_value_eur from server is also corrupted — ignore and recompute
  const cagrWasClamped = (lot.projection?.cagr_pct ?? 0) > 15;
  const _projMap: Record<number, { projected_value_eur: number; optimistic_eur?: number; conservative_eur?: number; gain_pct: number }> = {};
  for (const [y, p] of Object.entries(_projMapRaw)) {
    const yn = Number(y);
    if (cagrWasClamped) {
      // Recompute with capped CAGR
      const base = price > 0 ? Math.round(price * Math.pow(1 + projCagr / 100, yn)) : 0;
      _projMap[yn] = { projected_value_eur: base, optimistic_eur: Math.round(base * 1.3), conservative_eur: Math.round(base * 0.7), gain_pct: price > 0 ? ((base - price) / price) * 100 : 0 };
    } else {
      _projMap[yn] = p;
    }
  }
  const proj      = (years: number): number =>
    _projMap[years]?.projected_value_eur ?? Math.round(price * Math.pow(1 + projCagr / 100, years));
  const projGainPct = (years: number): number =>
    _projMap[years]?.gain_pct ?? (price > 0 ? ((proj(years) - price) / price) * 100 : 0);
  const chartData = [
    { year: isFr ? "Aujourd'hui" : 'Now', optimistic: price, value: price, conservative: price },
    ...[1, 3, 5, 10].map(y => ({
      year: `${y}${isFr ? 'an' : 'yr'}`,
      optimistic:   _projMap[y]?.optimistic_eur
                    ?? Math.round(price * Math.pow(1 + (projCagr * 1.5) / 100, y)),
      value:        _projMap[y]?.projected_value_eur
                    ?? Math.round(price * Math.pow(1 + projCagr / 100, y)),
      conservative: _projMap[y]?.conservative_eur
                    ?? Math.round(price * Math.pow(1 + (projCagr * 0.5) / 100, y)),
    })),
  ];

  const isUpcoming = lot.status === 'upcoming' || lot.status === 'preview' ||
    (lot.auction_date && new Date(lot.auction_date) > new Date() && !lot.status);

  const source = String(lot.source || '').toLowerCase();
  const isGallery = lot.is_buy_now === true
    || lot.market_type === 'primary'
    || lot.market_type === 'PRIMARY';
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
    if ((lot.deal_score || 0) >= 83 && upsidePct >= 20)
      return { label: isFr ? 'ACHETER' : 'BUY',  dk: GD,        gl: GL,   icon: '↑', sub: isFr ? 'Signal fort de conviction' : 'Strong conviction signal' };
    if ((lot.deal_score || 0) >= 70 && upsidePct >= 10)
      return { label: isFr ? 'SURVEILLER' : 'WATCH',     dk: '#FBBF24',  gl: AMB,  icon: '◎', sub: isFr ? 'À surveiller de près' : 'Monitor closely' };
    if ((lot.deal_score || 0) < 50 || upsidePct < 0)
      return { label: isFr ? 'PASSER' : 'PASS', dk: '#EF4444',  gl: RED,  icon: '↓', sub: isFr ? 'Sous le seuil de conviction' : 'Below conviction threshold' };
    return   { label: isFr ? 'SURVEILLER' : 'WATCH',     dk: '#FBBF24',  gl: AMB,  icon: '◎', sub: isFr ? 'Signal insuffisant' : 'Insufficient signal' };
  })();

  const dealScore     = lot.deal_score || 0;
  const stickyTier    = dealScore >= 83 ? (isFr ? 'EXCEPTIONNEL' : 'EXCEPTIONAL') : dealScore >= 77 ? (isFr ? 'FORT' : 'STRONG') : (isFr ? 'INTÉRESSANT' : 'INTERESTING');

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

  const totalCost     = realCost
    ? realCost.cost_basis + (realCost.holding_cost_3y || 0)
    : (price > 0 ? Math.round(price * premiumMultiplier) : null);
  const breakEvenGain = realCost?.needed_gain_pct ?? null;
  const netGain       = breakEvenGain != null ? upsidePct - breakEvenGain : null;
  const avoidAboveUsedComps = maxBidFromApi != null;
  const RELIABLE_SOURCES = [
    'comparables_proches',
    'comparables_meme_technique',
    'comparables_technique_proche',
  ];
  // avoidAbove computed after sameArtistComps below
  const daysUntilClose = lot.auction_date
    ? Math.max(0, Math.round((new Date(lot.auction_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const hoursUntilClose: number | null = lot.auction_date
    ? (new Date(String(lot.auction_date).endsWith('Z') ? String(lot.auction_date) : String(lot.auction_date) + 'Z').getTime() - Date.now()) / 3_600_000
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
  const compsMedian  = (() => {
    const prices = sameArtistComps.map((c: any) => c.current_price || 0).filter(Boolean).sort((a: number, b: number) => a - b);
    return prices.length >= 2 ? prices[Math.floor(prices.length / 2)] : null;
  })();
  // Estimation de l'œuvre : comparables API (medium-filtered) → market analysis → médiane comparables → estimation maison de vente
  // Priority 1: fair_value from comparables endpoint = _compute_weighted_max_bid().market_value (medium-filtered, most reliable)
  // Priority 2: market analysis medians (correct field names: market_median_price / market_avg_price)
  // Priority 3: same-artist comps median (only if ≥ estLow — avoids cheap-prints contamination)
  // Priority 4: estimate mid/high (auction house data — always available)
  const avoidAbove = (() => {
    if (fairValueFromComps) {
      // Sanity floor: if comps-derived value < estLow, the medium mix is off — fall back to estimate
      if (estLow && fairValueFromComps < estLow) return estimateMid ?? estHigh ?? null;
      return fairValueFromComps;
    }
    if (marketAnalysis?.market_median_price) return Math.round(marketAnalysis.market_median_price);
    if (marketAnalysis?.market_avg_price)    return Math.round(marketAnalysis.market_avg_price);
    if (compsMedian && (!estLow || compsMedian >= estLow)) return compsMedian;
    return estimateMid ?? estHigh ?? null;
  })();
  const avoidAboveIsEstimate = !fairValueFromComps && !marketAnalysis?.market_median_price && !marketAnalysis?.market_avg_price && !compsMedian;
  const maxBidIsReliable = !!fairValueFromComps || (!!maxBidFromApi && RELIABLE_SOURCES.includes(maxBidSource ?? ''));
  const maxCompPrice = comparables.length > 0 ? Math.max(...comparables.map((c: any) => c.current_price || 0), price) : price;
  const isHistorical = comparables.length > 0 && comparables[0].is_historical === true;

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
    { label: isFr ? 'TAUX DE VENTE' : 'SELL-THR',  value: Math.round((lot.artist?.sell_through_rate ?? 0) * 100) },
  ].filter(p => p.value > 0);

  // ── DECISION SIGNALS ────────────────────────────────────────────────────────
  const compCount      = lot.fair_value_confidence || comparables.length || 0;
  const confP          = confidenceLabel(compCount);
  const topPct         = dealScore >= 90 ? 5 : dealScore >= 83 ? 10 : dealScore >= 75 ? 20 : dealScore >= 65 ? 30 : null;
  const humanLabel     = scoreHumanLabel(dealScore);
  const optimismSigs   = buildOptimismSignals(lot, isFr);
  const vigilanceSigs  = buildVigilanceSignals(lot, isFr);
  const changeOfMind   = buildChangeOfMind(lot, isFr);
  const whyNotHigher   = buildWhyNotHigher(lot, isFr);
  const timingReasons  = buildTimingReasons(lot, isFr, daysUntilClose);
  const narrative      = buildNarrativeReading(lot, isFr, compCount);
  const recoText       = dealScore >= 80
    ? (isFr ? "Cette opportunité mérite d'être étudiée sérieusement." : 'This opportunity is worth a serious look.')
    : dealScore >= 65
    ? (isFr ? "Cette œuvre vaut la peine d'être suivie de près." : 'This work is worth following closely.')
    : (isFr ? "À surveiller — d'autres opportunités peuvent être plus prioritaires." : 'Worth monitoring — other opportunities may be more pressing.');
  const ctaWishlist    = dealScore >= 70 ? (isFr ? 'Ajouter à ma shortlist' : 'Add to my shortlist') : (isFr ? 'Suivre cette œuvre' : 'Follow this work');

  return (
    <div style={{ minHeight: '100vh', background: '#F0EDE6', fontFamily: "'DM Sans', sans-serif", color: '#1a1a2e' }}>
      {upgradeModal && (
        <UpgradeModal
          type={upgradeModal}
          isFr={isFr}
          onClose={() => setUpgradeModal(null)}
        />
      )}
      <style>{`
        .hov-row:hover { background: rgba(0,0,0,0.02) !important; }
        .comp-card-light { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .comp-card-light:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
      `}</style>

      {/* ═══ STICKY BAR ═══ */}
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
          {isFr ? '← RETOUR' : '← BACK'}
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#6B7280', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>{lot.artist_name_raw || ''}</div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '13px', color: '#F0EDE6', lineHeight: 1.3, marginTop: '2px' }}>{lot.title || 'Untitled'}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 3, padding: '4px 12px', fontSize: 11, color: verdict.dk, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>{verdict.icon} {verdict.label}</span>
          <span style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, padding: '4px 14px', fontSize: 11, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-mono)' }}>{Math.round(dealScore)} / 100 · {stickyTier}</span>
        </div>
      </div>

      {/* ══ HERO — dark ══ */}
      <div ref={heroRef} style={{ background: DK }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 32px' }}>

          <div style={{ marginBottom: 20 }}>
            <span onClick={() => navigate(-1)} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>← {isFr ? 'RETOUR' : 'BACK'}</span>
          </div>

          {/* 3 colonnes : image / décision / score */}
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 220px', gap: 32, alignItems: 'start' }}>

            {/* ── COL 1 : Image ── */}
            <div>
              <div
                onClick={() => lot.image_url && setShowLightbox(true)}
                style={{ background: DK4, borderRadius: 4, aspectRatio: '4/5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 14, cursor: lot.image_url ? 'pointer' : 'default' }}
              >
                {lot.image_url ? (
                  <img src={lot.image_url} alt={lot.title} onLoad={() => setImgLoaded(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s' }} />
                ) : (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
                    <div style={{ fontSize: 36, marginBottom: 6 }}>◎</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>IMAGE</div>
                  </div>
                )}
              </div>
              {/* Follow button */}
              <button
                onClick={async () => {
                  if (!getToken()) { window.location.href = '/app/login'; return; }
                  setSubLoading(true);
                  try {
                    if (subscribed && subId) {
                      await fetch(`${BACKEND}/api/wishlist/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
                      setSubscribed(false); setSubId(null);
                    } else {
                      const r = await fetch(`${BACKEND}/api/wishlist/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
                      if (r.status === 403) setUpgradeModal('wishlist');
                      else if (r.ok) { setSubscribed(true); setSubId(id); trackEvent('lot_watchlist_add', 'lot', lot.id, { lot_title: lot.title, artist: lot.artist_name_raw, deal_score: lot.deal_score }); }
                    }
                  } finally { setSubLoading(false); }
                }}
                disabled={subLoading}
                style={{
                  width: '100%', borderRadius: 4, padding: '10px 0', cursor: subLoading ? 'default' : 'pointer',
                  background: subscribed ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${subscribed ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.16)'}`,
                  color: subscribed ? '#4ade80' : '#fff', fontSize: 13, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.15s',
                }}
              >
                {subLoading ? '...' : subscribed ? (isFr ? '✓ Dans ma shortlist' : '✓ In my shortlist') : (isFr ? '+ Ajouter à ma shortlist' : '+ Add to shortlist')}
              </button>
              {/* External link */}
              <div style={{ marginTop: 10, textAlign: 'center' as const }}>
                {hasAccess ? (
                  <a href={trackUrl} target="_blank" rel="noopener noreferrer"
                    onClick={() => trackEvent('lot_external_click', 'lot', lot.id, { lot_title: lot.title, artist: lot.artist_name_raw, source: lot.source, auction_house: lot.auction_house_name, deal_score: lot.deal_score, url: rawUrl })}
                    style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
                    {isFr ? `Voir sur ${sourceNames[source] || resolvedSource} ↗` : `View on ${sourceNames[source] || resolvedSource} ↗`}
                  </a>
                ) : (
                  <span onClick={() => window.location.href = '/app/pricing'} style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>
                    🔒 {isFr ? 'Accès Investor →' : 'Investor access →'}
                  </span>
                )}
              </div>
              {/* Purchase tracking */}
              {!purchaseDone ? (
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => setShowPurchaseForm(v => !v)}
                    style={{ width: '100%', background: showPurchaseForm ? 'rgba(26,107,60,0.1)' : 'none', border: `0.5px solid ${showPurchaseForm ? '#1A6B3C' : '#2A3B4C'}`, color: showPurchaseForm ? '#52C97F' : '#6B7280', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', padding: '7px 14px', borderRadius: '4px' }}
                  >
                    {isFr ? "✓ J'ai acheté ce lot" : '✓ I bought this lot'}
                  </button>
                  {showPurchaseForm && (
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input type="number" placeholder={isFr ? 'Prix marteau payé (€)' : 'Hammer price paid (€)'} value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)}
                        style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid #2A3B4C', color: '#E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '7px 10px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' as const, outline: 'none' }} />
                      <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                        style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid #2A3B4C', color: '#E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '7px 10px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' as const, outline: 'none' }} />
                      <select value={purchaseSource} onChange={e => setPurchaseSource(e.target.value as 'auction' | 'gallery' | 'private')}
                        style={{ background: '#0D1F35', border: '0.5px solid #2A3B4C', color: '#E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '7px 10px', borderRadius: '4px', width: '100%' }}>
                        <option value="auction">{isFr ? 'Enchères' : 'Auction'}</option>
                        <option value="gallery">{isFr ? 'Galerie' : 'Gallery'}</option>
                        <option value="private">{isFr ? 'Privé' : 'Private sale'}</option>
                      </select>
                      <button
                        onClick={async () => {
                          if (!purchasePrice || !getToken()) return;
                          setPurchaseLoading(true);
                          try {
                            const r = await fetch(`${BACKEND}/api/lots/${id}/confirm-purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ purchase_price: parseFloat(purchasePrice), purchase_date: purchaseDate, purchase_source: purchaseSource }) });
                            if (r.ok) { setPurchaseDone(true); setShowPurchaseForm(false); }
                          } finally { setPurchaseLoading(false); }
                        }}
                        disabled={purchaseLoading || !purchasePrice}
                        style={{ background: !purchasePrice ? 'rgba(26,107,60,0.3)' : '#1A6B3C', border: 'none', color: '#fff', cursor: purchaseLoading || !purchasePrice ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', padding: '8px 14px', borderRadius: '4px', width: '100%' }}
                      >
                        {purchaseLoading ? '...' : (isFr ? "Enregistrer l'achat" : 'Save purchase')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: '8px', border: '0.5px solid #1A6B3C', color: '#52C97F', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', padding: '8px 14px', borderRadius: '4px', width: '100%', textAlign: 'center' as const, boxSizing: 'border-box' as const }}>
                  {isFr ? '✓ Achat enregistré dans votre archive' : '✓ Purchase saved to your archive'}
                </div>
              )}
            </div>

            {/* ── COL 2 : Décision ── */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>

              {/* Identité */}
              <div style={{ marginBottom: 22 }}>
                <div onClick={() => navigate(`/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}`)}
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: 7, cursor: 'pointer', textTransform: 'uppercase' as const }}>
                  {lot.artist_name_raw || 'Unknown artist'}
                </div>
                <h1 style={{ fontSize: 'clamp(20px, 2.5vw, 30px)', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, color: '#fff', lineHeight: 1.2, margin: '0 0 6px' }}>
                  {lot.title || 'Untitled'}
                </h1>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)' }}>
                  {[lot.medium, lot.auction_house_name?.split('—')[0].trim()].filter(Boolean).join(' · ')}
                </div>
                {(estLow || estHigh || daysUntilClose != null) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', marginTop: 9 }}>
                    {(estLow || estHigh) && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                        {isFr ? 'Est.' : 'Est.'} {estLow ? fmtExact(estLow) : '—'}{estHigh ? ` – ${fmtExact(estHigh)}` : ''}
                      </span>
                    )}
                    {daysUntilClose != null && (
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', color: daysUntilClose <= 3 ? '#F87171' : daysUntilClose <= 7 ? '#FBBF24' : 'rgba(255,255,255,0.5)' }}>
                        {daysUntilClose === 0
                          ? (isFr ? 'Vente aujourd\'hui' : 'Sale today')
                          : `J-${daysUntilClose}`}
                        {auctionDateFmt ? ` · ${auctionDateFmt}` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ── STATUS BANNER ─────────────────────────────────── */}
              {(() => {
                const h = hoursUntilClose;
                const st = lot.status;
                let bState = 'upcoming';
                if (st === 'live') bState = 'live';
                else if (st === 'sold') bState = 'sold';
                else if (st === 'withdrawn') bState = 'withdrawn';
                else if (st === 'unsold') bState = 'passed';
                else if (h !== null && h < 0) bState = 'passed';
                else if (h !== null && h < 1) bState = 'imminent';
                else if (h !== null && h < 24) bState = 'soon';

                const secs = secsUntilClose !== null ? Math.max(0, secsUntilClose) : null;
                const cH = secs !== null ? Math.floor(secs / 3600) : null;
                const cM = secs !== null ? Math.floor((secs % 3600) / 60) : null;
                const cS = secs !== null ? secs % 60 : null;
                const cntStr = secs !== null && secs > 0
                  ? (cH! > 0 ? `${cH}h ${String(cM).padStart(2, '0')}m` : `${cM}m ${String(cS).padStart(2, '0')}s`)
                  : null;

                const cfgMap: Record<string, { accent: string; bg: string; border: string; label: string; sub: string }> = {
                  live:      { accent: '#4ade80', bg: 'rgba(34,197,94,0.1)',            border: 'rgba(34,197,94,0.3)',            label: isFr ? 'Vente en cours' : 'Sale live',   sub: isFr ? 'Cette vente est actuellement live — enchérissez maintenant' : 'This sale is live — bid now'      },
                  imminent:  { accent: '#fb923c', bg: 'rgba(249,115,22,0.12)',           border: 'rgba(249,115,22,0.3)',           label: isFr ? 'Commence dans'  : 'Starts in',   sub: isFr ? 'La vente démarre très bientôt — ne tardez pas'              : 'Sale starts very soon — act now'  },
                  soon:      { accent: '#fbbf24', bg: 'rgba(251,191,36,0.1)',            border: 'rgba(251,191,36,0.25)',          label: isFr ? 'Commence dans'  : 'Starts in',   sub: isFr ? "La vente a lieu aujourd'hui"                                 : 'Sale is today'                    },
                  upcoming:  { accent: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)',  label: isFr ? 'Vente à venir' : 'Upcoming',    sub: isFr ? "Cette vente n'a pas encore commencé"                        : 'This sale has not started yet'    },
                  sold:      { accent: '#4ade80', bg: 'rgba(34,197,94,0.08)',            border: 'rgba(34,197,94,0.2)',            label: isFr ? '✓  Adjugé'      : '✓  Sold',     sub: isFr ? 'Ce lot a été vendu aux enchères'                           : 'This lot was sold at auction'     },
                  passed:    { accent: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)', label: isFr ? 'Lot passé'     : 'Sale ended',   sub: isFr ? 'Cette vente est terminée'                                  : 'This sale has ended'              },
                  withdrawn: { accent: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)', label: isFr ? 'Retiré'        : 'Withdrawn',    sub: isFr ? 'Ce lot a été retiré de la vente'                           : 'This lot was withdrawn'           },
                };
                const c = cfgMap[bState] || cfgMap.upcoming;
                const showCnt = (bState === 'imminent' || bState === 'soon') && cntStr;
                const showCta = (bState === 'live' || bState === 'imminent' || bState === 'soon') && externalUrl;
                const anim = bState === 'live'
                  ? 'lot-status-pulse-green 2s ease-in-out infinite'
                  : (bState === 'imminent' || bState === 'soon')
                  ? 'lot-status-pulse-orange 1.8s ease-in-out infinite'
                  : 'none';

                return (
                  <div style={{ margin: '0 0 16px' }}>
                    <style>{`
                      @keyframes lot-status-pulse-green  { 0%{box-shadow:0 0 0 0 rgba(74,222,128,0.55)} 70%{box-shadow:0 0 0 9px rgba(74,222,128,0)} 100%{box-shadow:0 0 0 0 rgba(74,222,128,0)} }
                      @keyframes lot-status-pulse-orange { 0%{box-shadow:0 0 0 0 rgba(251,146,60,0.55)}  70%{box-shadow:0 0 0 9px rgba(251,146,60,0)}  100%{box-shadow:0 0 0 0 rgba(251,146,60,0)} }
                    `}</style>
                    <div style={{ borderRadius: 8, background: c.bg, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.accent}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.accent, flexShrink: 0, animation: anim }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: c.accent, letterSpacing: '-0.01em', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' as const }}>
                          <span>{c.label}</span>
                          {showCnt && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800 }}>{cntStr}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3, fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
                          {c.sub}
                        </div>
                      </div>
                      {showCta && (
                        <a href={externalUrl} target="_blank" rel="noopener noreferrer"
                          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 4, background: c.accent, color: '#0C1622', fontSize: 11, fontWeight: 800, textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                          {bState === 'live' ? (isFr ? 'Enchérir →' : 'Bid now →') : (isFr ? 'Voir le lot →' : 'View lot →')}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Q1 — Verdict */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: verdict.dk, flexShrink: 0 }} />
                  <span style={{ fontSize: 15, color: verdict.dk, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.06em' }}>{verdict.label}</span>
                </div>
                {topPct != null && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, paddingLeft: 16 }}>
                    {isFr
                      ? <>Cette œuvre fait partie des <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{topPct}%</strong> d&apos;opportunités les plus attractives identifiées actuellement.</>
                      : <>This work is among the <strong style={{ color: 'rgba(255,255,255,0.75)' }}>top {topPct}%</strong> of currently identified opportunities.</>
                    }
                  </div>
                )}
              </div>

              {/* Q2 — Pourquoi optimistes */}
              {optimismSigs.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: 10 }}>
                    {isFr ? 'POURQUOI NOUS SOMMES OPTIMISTES' : 'WHY WE ARE OPTIMISTIC'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {optimismSigs.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                        <span style={{ color: '#4ade80', fontSize: 11, flexShrink: 0, lineHeight: 1.6 }}>✓</span>
                        <span style={{ fontSize: 13, color: '#fff' }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Q4 — Prix actuel + max conseillé */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginBottom: 8 }}>
                      {isFr ? 'PRIX ACTUEL' : 'CURRENT PRICE'}
                    </div>
                    <div style={{ fontSize: 34, fontFamily: "'Playfair Display', serif", color: '#fff', fontWeight: 600, lineHeight: 1, marginBottom: 6 }}>
                      {fmtExact(price)}
                    </div>
                    {upsidePct > 0 && (
                      <div style={{ fontSize: 11, color: '#4ade80', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        –{Math.round(upsidePct)}% {isFr ? 'sous estimation basse' : 'below low estimate'}
                      </div>
                    )}
                    {(() => {
                      const st = (lot.status || '').toLowerCase();
                      const isOver = ['sold', 'passed', 'ended', 'closed', 'unsold', 'withdrawn'].includes(st)
                        || (lot.auction_date != null && new Date(lot.auction_date) < new Date());
                      if (isOver) return null;
                      const priceAgeHours = lot.updated_at
                        ? Math.round((Date.now() - new Date(lot.updated_at).getTime()) / 3_600_000)
                        : null;
                      if (priceAgeHours === null || priceAgeHours <= 3) return null;
                      return (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#9CA3AF', marginTop: '4px' }}>
                          Mis à jour il y a {priceAgeHours}h · peut différer du prix live
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    {/* Label + dynamic tooltip */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
                        {isFr ? 'PRIX MAXIMUM CONSEILLÉ' : 'RECOMMENDED MAX BID'}
                      </span>
                      <Tip width={240} text={
                        maxBidConfidence === 'forte'
                          ? (isFr
                            ? `Basé sur ${maxBidCompCount ?? ''} ventes comparables filtrées par médium et catégorie de prix. Le max bid intègre les frais acheteur de la maison de vente.`
                            : `Based on ${maxBidCompCount ?? ''} comparable sales filtered by medium and price range. The max bid includes buyer's premium.`)
                          : maxBidConfidence === 'modérée'
                          ? (isFr
                            ? `Basé sur ${maxBidCompCount ?? ''} ventes comparables — données suffisantes pour une bonne référence directionnelle.`
                            : `Based on ${maxBidCompCount ?? ''} comparable sales — enough for a solid directional reference.`)
                          : maxBidConfidence === 'faible'
                          ? (isFr
                            ? 'Peu de données comparables disponibles — valeur indicative uniquement. À prendre comme ordre de grandeur.'
                            : 'Limited comparable data — indicative value only. Use as a rough order of magnitude.')
                          : marketContext === 'market_above_estimate'
                          ? (isFr
                            ? "Le marché de cet artiste s'est historiquement réalisé bien au-dessus des estimations, mais les données sont insuffisantes pour calculer une valeur précise."
                            : "This artist's market has historically realized well above estimates, but data is insufficient to compute a precise value.")
                          : (isFr
                            ? "Aucune vente comparable disponible. Valeur basée sur l'estimation haute de la maison de vente (les réalisations historiques sont proches de l'estimation haute)."
                            : "No comparable sales available. Value based on the auction house high estimate (historical realizations are close to the high estimate).")
                      } />
                    </div>

                    {/* market_above_estimate alert panel */}
                    {maxBidConfidence === 'insuffisante' && marketContext === 'market_above_estimate' && (
                      <div style={{ marginBottom: 8, padding: '7px 10px', background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 5, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>⚡</span>
                        <span style={{ fontSize: 10, color: '#FCD34D', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
                          {isFr
                            ? 'Marché historiquement supérieur à l\u2019estimation · données insuffisantes pour valoriser'
                            : 'Market historically above estimate · insufficient data to value precisely'}
                        </span>
                      </div>
                    )}

                    {avoidAbove ? (
                      <>
                        {/* Value — size, color, tilde per confidence */}
                        <div style={{
                          fontSize: maxBidConfidence === 'insuffisante' ? 28 : 34,
                          fontFamily: "'Playfair Display', serif",
                          fontWeight: 600,
                          lineHeight: 1,
                          marginBottom: 6,
                          color: avoidAbove < price
                            ? '#f87171'
                            : maxBidConfidence === 'insuffisante'
                            ? 'rgba(255,255,255,0.65)'
                            : maxBidConfidence === 'faible'
                            ? '#9B7A3C'
                            : '#C6A85A',
                        }}>
                          {maxBidConfidence === 'faible' ? '~' : ''}{fmtExact(avoidAbove)}
                          {maxBidConfidence === 'insuffisante' && (
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>
                              {isFr ? '(estimatif)' : '(estimate)'}
                            </span>
                          )}
                        </div>

                        {/* Confidence bars — forte/modérée/faible only */}
                        {maxBidConfidence && maxBidConfidence !== 'insuffisante' && avoidAbove >= price && (() => {
                          const filled = maxBidConfidence === 'forte' ? 4 : maxBidConfidence === 'modérée' ? 3 : 2;
                          const barCol = maxBidConfidence === 'forte' ? '#4ade80' : maxBidConfidence === 'modérée' ? '#FBBF24' : '#9B7A3C';
                          return (
                            <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
                              {[0,1,2,3].map(i => (
                                <div key={i} style={{ width: 18, height: 4, borderRadius: 2, background: i < filled ? barCol : 'rgba(255,255,255,0.12)' }} />
                              ))}
                            </div>
                          );
                        })()}

                        {/* Subtitle / source line */}
                        {avoidAbove < price ? (
                          <div style={{ fontSize: 10, color: '#f87171', fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.04em' }}>
                            ▲ {isFr ? 'prix actuel dépasse notre estimation' : 'current price exceeds our estimate'}
                          </div>
                        ) : maxBidConfidence === 'forte' || maxBidConfidence === 'modérée' ? (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)' }}>
                            {maxBidCompCount
                              ? `${maxBidCompCount} ${isFr ? 'ventes comparables' : 'comparable sales'}`
                              : (isFr ? 'ventes comparables filtrées' : 'filtered comparable sales')}
                          </div>
                        ) : maxBidConfidence === 'faible' ? (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)' }}>
                            {isFr ? 'peu de données · indicatif' : 'limited data · indicative'}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)' }}>
                            {isFr ? "basé sur l'estimation de la maison de vente" : 'based on auction house estimate'}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 1.4, marginTop: 4 }}>
                        {isFr ? 'Données insuffisantes' : 'Insufficient data'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>{/* end COL 2 */}

            {/* ── COL 3 : Score + Signal ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Score card */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '20px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>SCORE</span>
                  <Tip text={isFr ? `Score d'opportunité Nautilus sur 100. INTÉRESSANT ≥ 65 · FORT ≥ 77 · EXCEPTIONNEL ≥ 83` : `Nautilus opportunity score out of 100. INTERESTING ≥ 65 · STRONG ≥ 77 · EXCEPTIONAL ≥ 83`} width={230} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                  <span style={{ fontSize: 56, fontFamily: "'Playfair Display', serif", color: '#fff', fontWeight: 600, lineHeight: 1 }}>{Math.round(dealScore)}</span>
                  <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.25)' }}>/100</span>
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1, marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${dealScore}%`, background: '#b8922a', borderRadius: 1 }} />
                </div>
                <div style={{ fontSize: 13, color: '#b8922a', fontFamily: 'var(--font-mono)', fontWeight: 600, marginBottom: 2 }}>{humanLabel}</div>
              </div>

              {/* Signal badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px', background: dealScore >= 80 ? 'rgba(74,222,128,0.07)' : 'rgba(251,191,36,0.07)', border: `1px solid ${dealScore >= 80 ? 'rgba(74,222,128,0.18)' : 'rgba(251,191,36,0.18)'}`, borderRadius: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: dealScore >= 80 ? '#4ade80' : '#FBBF24', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, color: dealScore >= 80 ? '#4ade80' : '#FBBF24', fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {stickyTier}
                    <Tip width={230} text={isFr
                      ? `Le score Nautilus combine :\n• l'attractivité du prix actuel\n• les ventes comparables observées\n• la liquidité du marché de l'artiste\n• la qualité des données disponibles\n\nINTÉRESSANT ≥ 65\nFORT ≥ 77\nEXCEPTIONNEL ≥ 83`
                      : `The Nautilus score combines:\n• current price attractiveness\n• observed comparable sales\n• artist market liquidity\n• quality of available data\n\nINTERESTING ≥ 65\nSTRONG ≥ 77\nEXCEPTIONAL ≥ 83`}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                    {lot.artist?.trend === 'up' ? (isFr ? '↑ Artiste en hausse' : '↑ Rising artist') : lot.artist?.trend === 'down' ? (isFr ? '↓ Artiste en recul' : '↓ Falling artist') : (isFr ? '→ Artiste stable' : '→ Stable artist')}
                  </div>
                </div>
              </div>

              {/* Oracle signal (BUY_NOW / WATCH / HOLD / AVOID) */}
              {lot.oracle?.signal && (() => {
                const sig = lot.oracle.signal as string;
                const isGo   = sig === 'BUY_NOW';
                const isStop = sig === 'AVOID';
                const col    = isGo ? '#4ade80' : isStop ? '#f87171' : '#FBBF24';
                const bg     = isGo ? 'rgba(74,222,128,0.07)' : isStop ? 'rgba(248,113,113,0.07)' : 'rgba(251,191,36,0.07)';
                const bd     = isGo ? 'rgba(74,222,128,0.18)' : isStop ? 'rgba(248,113,113,0.18)' : 'rgba(251,191,36,0.18)';
                const label  = isGo ? (isFr ? 'ORACLE · ACHETER' : 'ORACLE · BUY NOW')
                             : isStop ? (isFr ? 'ORACLE · ÉVITER' : 'ORACLE · AVOID')
                             : `ORACLE · ${sig}`;
                return (
                  <div style={{ padding: '10px 14px', background: bg, border: `1px solid ${bd}`, borderRadius: 5 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: col, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {label}
                      <Tip width={240} text={isFr
                        ? `Signal basé sur les ventes de l'artiste sur 6 mois. ACHETER = momentum fort · SURVEILLER = signal non confirmé · ÉVITER = marché en recul. Le score 6m mesure la vigueur du marché (0–100).`
                        : `Signal based on artist sales over 6 months. BUY NOW = strong momentum · WATCH = unconfirmed signal · AVOID = declining market. The 6m score measures market strength (0–100).`}
                      />
                    </div>
                    {lot.oracle.target_upside && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{lot.oracle.target_upside}</div>
                    )}
                    {lot.oracle.score_6m != null && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Score 6m : {Number(lot.oracle.score_6m).toFixed(0)}/100</div>
                    )}
                  </div>
                );
              })()}

              {/* Upside signal — only rendered for High or Limited */}
              {upsideSignal && (() => {
                const isHigh = upsideSignal.signal_label === 'High upside signal';
                const col = isHigh ? '#4ade80' : '#FBBF24';
                const bg  = isHigh ? 'rgba(74,222,128,0.07)' : 'rgba(251,191,36,0.07)';
                const bd  = isHigh ? 'rgba(74,222,128,0.18)' : 'rgba(251,191,36,0.18)';
                const labelFr = isHigh ? 'SETUP · FAVORABLE' : 'SETUP · PRUDENCE';
                const labelEn = isHigh ? 'SETUP · FAVORABLE' : 'SETUP · CAUTION';

                // Build dynamic tooltip from context stats
                const hPct   = upsideSignal.house_sold_above_pct != null ? Math.round(upsideSignal.house_sold_above_pct * 100) : null;
                const hCount = upsideSignal.house_sales_count;
                const aPct   = upsideSignal.artist_sold_above_pct != null ? Math.round(upsideSignal.artist_sold_above_pct * 100) : null;
                const aTotal = upsideSignal.artist_total_sales;
                const prem   = upsideSignal.median_premium_pct != null ? Math.round(upsideSignal.median_premium_pct) : null;

                const useHouseData = hCount != null && hCount >= 5 && hPct != null;
                const tipFr = useHouseData
                  ? `Sur ${hCount} vente${hCount > 1 ? 's' : ''} de cet artiste dans cette maison, ${hPct}% ont dépassé l'estimation basse.${prem != null ? `\nPrime médiane observée : +${prem}% au-dessus de l'estimation.` : ''}${aTotal ? `\n\n${aTotal} ventes au total dans la base.` : ''}`
                  : aPct != null
                  ? `Sur ${aTotal ?? '?'} ventes historiques de cet artiste, ${aPct}% ont dépassé l'estimation basse.${prem != null ? `\nPrime médiane : +${prem}%.` : ''}\n\nDonnées insuffisantes pour cette maison spécifiquement.`
                  : `Signal basé sur les patterns historiques de l'artiste (médium, maison, saison). Données contextuelles limitées.`;

                const tipEn = useHouseData
                  ? `Across ${hCount} sale${hCount > 1 ? 's' : ''} of this artist at this house, ${hPct}% exceeded the low estimate.${prem != null ? `\nMedian premium observed: +${prem}% above estimate.` : ''}${aTotal ? `\n\n${aTotal} total sales in the database.` : ''}`
                  : aPct != null
                  ? `Across ${aTotal ?? '?'} historical sales of this artist, ${aPct}% exceeded the low estimate.${prem != null ? `\nMedian premium: +${prem}%.` : ''}\n\nInsufficient data for this specific house.`
                  : `Signal based on historical patterns (medium, house, season). Limited contextual data available.`;

                return (
                  <div style={{ padding: '10px 14px', background: bg, border: `1px solid ${bd}`, borderRadius: 5 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: col, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {isFr ? labelFr : labelEn}
                      <Tip width={260} text={isFr ? tipFr : tipEn} />
                    </div>
                    {useHouseData && hPct != null && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                        {hPct}% <span style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.45)' }}>{isFr ? 'au-dessus estimat.' : 'above estimate'}</span>
                      </div>
                    )}
                    {prem != null && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                        {isFr ? `Prime médiane : +${prem}%` : `Median premium: +${prem}%`}
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>{/* end COL 3 */}

          </div>{/* end 3-col grid */}
        </div>{/* end maxWidth container */}
      </div>{/* end hero dark */}
      {/* ═══ LIGHT ZONE ═══ */}
      <div className="lot-light-zone" style={{ background: '#F5F4F0' }}>

        <div style={{ background: '#fff', borderBottom: '0.5px solid #E8E4DC' }}>

          {/* Coût réel strip */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '7px 20px', background: '#F5F4F0', borderTop: '0.5px solid #E8E4DC' }}>
            {([
              { lbl: isFr ? 'COÛT RÉEL' : 'REAL COST', val: totalCost ? fmtExact(totalCost) : '—', color: LTT1, tipAlign: 'left' as const,
                tip: isFr ? `Marteau + frais acheteur + stockage/assurance sur 3 ans. Ce que vous déboursez réellement.` : `Hammer + buyer's premium + storage/insurance over 3 years. What you actually spend.` },
              { lbl: isFr ? 'FRAIS ACHETEUR' : 'BUYER FEES', val: `+${buyerPremiumPct}%`, color: LTT1, tipAlign: 'center' as const,
                tip: isFr ? `Commission de la maison de vente sur le prix marteau. Taux appliqué ici : ${buyerPremiumPct}%.` : `Auction house commission on top of the hammer price. Rate applied here: ${buyerPremiumPct}%.` },
              { lbl: isFr ? 'RENTABILITÉ DÈS' : 'BREAK-EVEN AT', val: realCost?.breakeven_hammer ? fmtExact(Math.round(realCost.breakeven_hammer)) : '—', color: AMB, tipAlign: 'center' as const,
                tip: isFr ? `Prix minimum à la revente pour couvrir l'ensemble des frais et commissions. En dessous, vous êtes en perte.` : `Minimum resale price to cover all fees and commissions. Below this, you are at a loss.` },
              { lbl: isFr ? 'PROGRESSION NÉCESSAIRE' : 'NEEDED GAIN', val: breakEvenGain != null ? `+${Math.round(breakEvenGain)}%` : '—', color: LTT1, tipAlign: 'right' as const,
                tip: isFr ? `Hausse minimale du prix pour être à l'équilibre à la revente, tous frais compris.` : `Minimum price increase to break even at resale, all costs included.` },
            ] as { lbl: string; val: string; color: string; tip: string; tipAlign: 'left' | 'center' | 'right' }[]).map((item, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '5px', paddingRight: i < arr.length - 1 ? '16px' : 0, borderRight: i < arr.length - 1 ? '0.5px solid #E0DDD8' : 'none', marginRight: i < arr.length - 1 ? '16px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#B0A898', letterSpacing: '1.5px', textTransform: 'uppercase' as const }}>
                  {item.lbl}
                  <Tip theme="light" width={220} align={item.tipAlign} text={item.tip} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: item.color }}>{item.val}</div>
              </div>
            ))}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
              <Tip theme="light" width={230} text={isFr
                ? "Analyse basée sur les données disponibles. Nautilus est un outil d'aide à la décision — pas un conseil financier réglementé."
                : "Analysis based on available data. Nautilus is a decision-support tool — not regulated financial advice."
              } />
            </span>
          </div>

        </div>

        {/* ── ANALYSE NAUTILUS (score_rationale) ──────────────────────────── */}
        {hasAccess && analysisText && (
          <div style={{ padding: '24px 40px', background: '#fff', borderBottom: '0.5px solid #E8E4DC' }}>
            <div style={{ borderLeft: '3px solid rgba(198,168,90,0.5)', paddingLeft: '16px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GOLD, letterSpacing: '2.5px', textTransform: 'uppercase' as const, marginBottom: '10px' }}>LECTURE NAUTILUS</div>
              <p style={{ fontSize: '13px', color: LTT2, lineHeight: 1.75, fontStyle: 'italic', margin: 0 }}>{analysisText}</p>
            </div>
          </div>
        )}

        {/* ── DÉTAILS + COÛT RÉEL ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#fff', borderBottom: '0.5px solid #E8E4DC' }}>
          {/* Col gauche — DÉTAILS DU LOT */}
          <div style={{ padding: '28px 24px 28px 40px', borderRight: '0.5px solid #E8E4DC' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GOLD, letterSpacing: '2.5px', textTransform: 'uppercase' as const, marginBottom: '16px' }}>DÉTAILS DU LOT</div>
            {([
              { label: 'Artiste', value: lot.artist_name_raw, nav: `/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}` },
              { label: 'Technique', value: lot.medium },
              { label: 'Dimensions', value: lot.dimensions },
              { label: 'Estimation', value: (estLow || estHigh) ? `${fmt(estLow)} – ${fmt(estHigh)}` : null },
              { label: isGallery ? 'Galerie' : 'Maison', value: lot.auction_house_name },
              { label: 'Clôture', value: auctionDateFmt, urgent: daysUntilClose != null && daysUntilClose < 14 },
            ] as { label: string; value?: string | null; nav?: string; urgent?: boolean }[]).filter(r => r.value).map(r => (
              <div key={r.label} style={dRow}>
                <span style={{ fontSize: '13px', color: LTT3, minWidth: '80px', flexShrink: 0 }}>{r.label}</span>
                {r.nav ? (
                  <span onClick={() => navigate(r.nav!)} style={{ fontSize: '13px', color: BL, cursor: 'pointer', textDecoration: 'underline', textAlign: 'right' as const, flex: 1 }}>{r.value}</span>
                ) : (
                  <span style={{ fontSize: '13px', color: r.urgent ? AMB : LTT1, fontWeight: r.urgent ? 600 : 500, textAlign: 'right' as const, flex: 1 }}>{r.value}</span>
                )}
              </div>
            ))}
            {estBias && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid #F0EDE6` }}>
                <span style={{ fontSize: '13px', color: LTT3, minWidth: '80px', flexShrink: 0 }}>{isFr ? 'Biais estim.' : 'Est. bias'}</span>
                <span style={{ fontSize: '12px', textAlign: 'right' as const, flex: 1, color: estBias.signal === 'bullish' ? GL : estBias.signal === 'bearish' ? RED : LTT2 }}>
                  {estBias.label}
                </span>
              </div>
            )}
            {priceHistory?.statistics && (priceHistory.statistics.trend_pct != null || priceHistory.statistics.sell_above_estimate_pct != null) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid #F0EDE6` }}>
                <span style={{ fontSize: '13px', color: LTT3, minWidth: '80px', flexShrink: 0 }}>{isFr ? 'Tendance' : 'Trend'}</span>
                <span style={{ fontSize: '12px', textAlign: 'right' as const, flex: 1, color: (priceHistory.statistics.trend_pct ?? 0) >= 0 ? GL : RED }}>
                  {priceHistory.statistics.trend_pct != null && `${priceHistory.statistics.trend_pct > 0 ? '+' : ''}${priceHistory.statistics.trend_pct}% (12m)`}
                  {priceHistory.statistics.sell_above_estimate_pct != null && ` · ${priceHistory.statistics.sell_above_estimate_pct}% ${isFr ? 'ventes > estim.' : 'sold > est.'}`}
                </span>
              </div>
            )}
          </div>
          {/* Col droite — COÛT RÉEL DÉTAILLÉ */}
          <div style={{ padding: '28px 40px 28px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GOLD, letterSpacing: '2.5px', textTransform: 'uppercase' as const, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              {isFr ? 'COÛT RÉEL DÉTAILLÉ' : 'REAL COST BREAKDOWN'}
              <Tip theme="light" width={240} text={isFr
                ? `Prix marteau × (1 + frais acheteur) + stockage et assurance 0,6 %/an sur 3 ans. Le seuil de rentabilité intègre la commission vendeur (15 %) à la revente.`
                : `Hammer × (1 + buyer's premium) + storage and insurance 0.6%/yr over 3 years. Break-even includes the seller's commission (15%) at resale.`}
              />
            </div>
            <div style={{ background: '#F5F4F0', borderRadius: '10px', padding: '16px 18px' }}>
              {([
                { k: isFr ? 'Prix de départ' : 'Starting price', v: realCost?.ref_price || price },
                { k: `Frais acheteur (${buyerPremiumPct}%)`, v: realCost ? realCost.cost_basis - (realCost.ref_price || price) : Math.round(price * (premiumMultiplier - 1)) },
                { k: 'Coût de détention (3 ans)', v: realCost?.holding_cost_3y || 0 },
              ] as { k: string; v: number }[]).filter(r => r.v > 0).map((r, i, arr) => (
                <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < arr.length - 1 ? '0.5px solid #E8E4DC' : 'none' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: LTT2 }}>{r.k}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: LTT1 }}>{fmt(r.v)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid #E8E4DC' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT2, fontWeight: 600 }}>COÛT TOTAL</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', color: GOLD, fontWeight: 700 }}>{totalCost ? fmt(totalCost) : '—'}</span>
              </div>
              {realCost && breakEvenGain != null && (
                <>
                  <div style={{ marginTop: '12px', borderTop: '0.5px solid #E8E4DC', paddingTop: '10px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, marginBottom: '4px' }}>Nécessite +{breakEvenGain.toFixed(1)}% pour rentabiliser</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: GOLD, fontWeight: 600 }}>Seuil : {fmt(realCost.breakeven_hammer)}</div>
                  </div>
                </>
              )}
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '0.5px solid #E8E4DC' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>
                  {isFr ? 'Calculé sur la mise à prix — le coût réel dépendra du marteau final.' : 'Calculated at starting price — actual cost depends on final hammer.'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── VENTES COMPARABLES ───────────────────────────────────────────── */}
        {hasAccess && (
        <div style={{ padding: '24px 40px', background: '#F5F4F0', borderBottom: '0.5px solid #E8E4DC' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GOLD, letterSpacing: '2.5px', textTransform: 'uppercase' as const, marginBottom: '16px' }}>{isHistorical ? '◆ VENTES RÉALISÉES AUX ENCHÈRES' : '◆ LOTS COMPARABLES ACTIFS'}</div>
          {comparables.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '48px 24px', textAlign: 'center' as const }}>
              <div style={{ fontSize: '28px', opacity: 0.12, marginBottom: '12px' }}>◎</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, letterSpacing: '0.1em' }}>Aucune vente comparable trouvée pour ce lot.</div>
            </div>
          ) : (() => {
            const compPrices = comparables.map((c: any) => c.current_price || 0).filter((v: number) => v > 0);
            const minComp = compPrices.length > 0 ? Math.min(...compPrices) : 0;
            const maxComp = compPrices.length > 0 ? Math.max(...compPrices) : 0;
            const fmtK = (v: number) => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`;
            const isHistorical = comparables.length > 0 && comparables[0].is_historical === true;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px' }}>
                {/* Story card */}
                <div style={{ background: '#0F3828', borderRadius: '12px', padding: '22px 20px', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#4ADE80', lineHeight: 1.1, marginBottom: '14px' }}>
                      {fmtK(minComp)} – {fmtK(maxComp)}
                    </div>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, margin: 0 }}>
                      Des œuvres de <strong>{lot.artist_name_raw}</strong> {isHistorical
                        ? `ont réalisé entre ${fmtK(minComp)} et ${fmtK(maxComp)} aux enchères sur ${comparables.length} ventes historiques.`
                        : `sont actuellement listées entre ${fmtK(minComp)} et ${fmtK(maxComp)} — prix demandés, pas encore réalisés.`}
                    </p>
                  </div>
                  <div style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
                    {isHistorical ? `${comparables.length} ventes réalisées` : `${comparables.length} lots actifs`}
                  </div>
                </div>
                {/* Table card */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead>
                      <tr>
                        {['Artiste', 'Titre', '', 'Prix', isHistorical ? 'Premium' : 'Score', 'Date'].map((col, ci) => (
                          <th key={ci} style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: LTT3, textAlign: 'left' as const, padding: '8px 10px 8px 0', borderBottom: '0.5px solid #E8E4DC' }}>{col}</th>
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
                          <tr key={comp.id} onClick={() => navigate(`/app/opportunities/${comp.id}`)} style={{ cursor: 'pointer' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F5F4F0'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '9px 10px 9px 0', borderBottom: '0.5px solid #E8E4DC', fontSize: '12px', color: LTT2, maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{comp.artist_name_raw || '—'}</td>
                            <td style={{ padding: '9px 10px 9px 0', borderBottom: '0.5px solid #E8E4DC', fontSize: '12px', color: LTT1, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{comp.title || 'Untitled'}</td>
                            <td style={{ width: '100px', padding: '0 8px', borderBottom: '0.5px solid #E8E4DC' }}>
                              <div style={{ height: '2px', background: '#E8E4DC', borderRadius: '1px' }}>
                                <div style={{ height: '100%', width: `${maxCompPrice > 0 ? (compPrice / maxCompPrice) * 100 : 0}%`, background: GOLD, borderRadius: '1px' }} />
                              </div>
                            </td>
                            <td style={{ padding: '9px 10px 9px 0', borderBottom: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: GOLD, whiteSpace: 'nowrap' as const }}>{fmt(compPrice)}</td>
                            <td style={{ padding: '9px 10px 9px 0', borderBottom: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, whiteSpace: 'nowrap' as const }}>{isHistorical ? (comp.premium_ratio ? `${((comp.premium_ratio - 1) * 100).toFixed(0)}%` : '—') : (comp.deal_score ? `${comp.deal_score.toFixed(0)}/100` : '—')}</td>
                            <td style={{ padding: '9px 0', borderBottom: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, whiteSpace: 'nowrap' as const }}>{compDate}</td>
                          </tr>
                        );
                      })}
                      {/* Votre lot row */}
                      <tr style={{ background: 'rgba(52,211,153,0.04)' }}>
                        <td style={{ padding: '9px 10px 9px 0', borderTop: '0.5px solid #E8E4DC', fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>Votre lot</td>
                        <td style={{ padding: '9px 10px 9px 0', borderTop: '0.5px solid #E8E4DC', fontSize: '12px', color: LTT1 }}>{lot.auction_house_name || '—'}</td>
                        <td style={{ width: '100px', padding: '0 8px', borderTop: '0.5px solid #E8E4DC' }}>
                          <div style={{ height: '2px', background: 'rgba(52,211,153,0.2)', borderRadius: '1px' }}>
                            <div style={{ height: '100%', width: `${maxCompPrice > 0 ? (price / maxCompPrice) * 100 : 0}%`, background: '#34D399', borderRadius: '1px' }} />
                          </div>
                        </td>
                        <td style={{ padding: '9px 10px 9px 0', borderTop: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: '#34D399', whiteSpace: 'nowrap' as const }}>{fmt(price)}</td>
                        <td style={{ padding: '9px 10px 9px 0', borderTop: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>—</td>
                        <td style={{ padding: '9px 0', borderTop: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>—</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ marginTop: '10px', padding: '7px 10px', background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: '5px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: AMB }}>
                    {isHistorical
                      ? "⚠ Ces ventes peuvent inclure différents médiums. Vérifiez la technique avant d'acheter."
                      : '⚠ Ces lots sont des prix demandés, pas des prix réalisés. Les ventes réelles peuvent différer.'}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        )}

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

            {hammerLoading && (
              <div style={{ padding: '0 40px 24px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.16em' }}>
                  ◆ CHARGEMENT HISTORIQUE…
                </div>
              </div>
            )}
            {isInvestor && (formatMatrix?.formats?.length > 0 || timingData?.best_house || cycleStage) && (
              <div style={{ padding: '0 40px 24px' }}>
                <div style={{ border: '0.5px solid rgba(232,228,220,0.4)', borderRadius: '10px', padding: '20px 24px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '20px' }}>
                    ◆ {isFr ? 'INTELLIGENCE MARCHÉ · ' : 'MARKET INTELLIGENCE · '}{lot.artist_name_raw?.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' as const }}>

                    {/* Medium optimal */}
                    {formatMatrix?.formats?.length > 0 && (() => {
                      const best = [...formatMatrix.formats].sort((a: any, b: any) => b.avg_price - a.avg_price)[0];
                      const current = formatMatrix.formats.find((f: any) =>
                        f.format.toLowerCase().includes((lot.medium || '').toLowerCase().split(' ')[0])
                      );
                      return (
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '6px' }}>
                            {isFr ? 'MEDIUM LE PLUS VALORISÉ' : 'TOP MEDIUM'}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', marginBottom: '2px' }}>
                            {best.format}
                          </div>
                          <div style={{ fontSize: '12px', color: LTT3 }}>
                            Moy. €{Math.round(best.avg_price).toLocaleString()} · {best.count} ventes
                          </div>
                          {current && current.format !== best.format && (
                            <div style={{ marginTop: '6px', fontSize: '11px', color: AMB }}>
                              {isFr ? `Ce lot (${current.format}) : moy. €${Math.round(current.avg_price).toLocaleString()}` : `This lot (${current.format}): avg €${Math.round(current.avg_price).toLocaleString()}`}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Maison optimale */}
                    {timingData?.best_house && (
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '6px' }}>
                          {isFr ? 'MAISON OPTIMALE' : 'BEST AUCTION HOUSE'}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', marginBottom: '2px' }}>
                          {timingData.best_house}
                        </div>
                        {timingData.best_avg_price && (
                          <div style={{ fontSize: '12px', color: LTT3 }}>
                            Moy. €{Math.round(timingData.best_avg_price).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meilleure période */}
                    {timingData?.best_month && (
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '6px' }}>
                          {isFr ? 'MEILLEURE PÉRIODE' : 'BEST TIMING'}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', marginBottom: '2px' }}>
                          {timingData.best_month}
                        </div>
                        {timingData.best_season && (
                          <div style={{ fontSize: '12px', color: LTT3 }}>
                            {timingData.best_season}
                            {timingData.best_avg_price && ` · €${Math.round(timingData.best_avg_price).toLocaleString()} moy.`}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cycle de marché */}
                    {cycleStage && (
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '6px' }}>
                          {isFr ? 'CYCLE DE MARCHÉ' : 'MARKET CYCLE'}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: cycleStage.color, marginBottom: '3px' }}>{cycleStage.icon} {cycleStage.stage}</div>
                        <div style={{ fontSize: '11px', color: LTT3, marginBottom: '2px' }}>{cycleStage.description}</div>
                        {cycleStage.momentum_pct != null && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: cycleStage.momentum_pct > 0 ? GL : RED }}>
                            {cycleStage.momentum_pct > 0 ? '+' : ''}{cycleStage.momentum_pct}% {isFr ? 'vs an passé' : 'vs last yr'}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}
            {/* ── HISTORIQUE DES VENTES RÉELLES ── */}
            {hammerHistory?.locked ? (
              <div style={{ padding: '0 40px 24px' }}>
                <div style={{ border: '0.5px solid rgba(232,228,220,0.4)', borderRadius: '10px', padding: '20px 24px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '12px' }}>
                    ◆ {isFr ? 'HISTORIQUE DES VENTES RÉELLES' : 'REALIZED PRICES HISTORY'}
                  </div>
                  <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.5 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: 'var(--navy)' }}>€ 48 500</div>
                    <div style={{ fontSize: '12px', color: LTT3, marginTop: '4px' }}>124 ventes · Médiane €32 000</div>
                  </div>
                  <div style={{ marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: BL, letterSpacing: '0.1em' }}>
                    <span style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '3px 8px', borderRadius: '3px' }}>INVESTOR+</span>
                    <span style={{ marginLeft: '10px', color: LTT3 }}>{isFr ? 'Accédez à l\'historique complet des prix réalisés' : 'Access full realized price history'}</span>
                  </div>
                </div>
              </div>
            ) : hammerHistory && hammerHistory.total_sales > 0 ? (
              <div style={{ padding: '0 40px 24px' }}>
                <div style={{ border: '0.5px solid rgba(232,228,220,0.4)', borderRadius: '10px', padding: '20px 24px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '16px' }}>
                    ◆ {isFr ? 'HISTORIQUE DES VENTES RÉELLES' : 'REALIZED PRICES HISTORY'} · {hammerHistory.total_sales} {isFr ? 'VENTES' : 'SALES'}
                  </div>
                  <div style={{ display: 'flex', gap: '32px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '4px' }}>{isFr ? 'MÉDIANE' : 'MEDIAN'}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: 'var(--navy)' }}>
                        {hammerHistory.median_eur ? `€${Math.round(hammerHistory.median_eur).toLocaleString()}` : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '4px' }}>{isFr ? 'MOYENNE' : 'AVERAGE'}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: 'var(--navy)' }}>
                        {hammerHistory.avg_eur ? `€${Math.round(hammerHistory.avg_eur).toLocaleString()}` : '—'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {hammerHistory.sales.slice(0, 5).map((s: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i === 0 ? 'none' : '0.5px solid rgba(232,228,220,0.3)' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--navy)', fontWeight: 500, marginBottom: '2px' }}>
                            {s.artwork_title || (isFr ? 'Sans titre' : 'Untitled')}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>
                            {s.auction_house} · {s.sale_date} {s.medium_category ? `· ${s.medium_category}` : ''}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: GOLD, textAlign: 'right' }}>
                          {s.hammer_price_eur ? `€${Math.round(s.hammer_price_eur).toLocaleString()}` : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                  {lot?.artist_name_raw && (
                    <div
                      onClick={() => window.location.href = `/artists/${encodeURIComponent(lot.artist_name_raw)}`}
                      style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: GOLD, cursor: 'pointer', letterSpacing: '0.08em', borderBottom: '1px solid rgba(198,168,90,0.3)', paddingBottom: '1px', display: 'inline-block' }}
                    >
                      {isFr ? '◆ VOIR L\'ANALYSE ARTISTE COMPLÈTE →' : '◆ VIEW FULL ARTIST ANALYSIS →'}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* ── SCÉNARIOS DE VALORISATION ───────────────────────────────────── */}
            {hasAccess && !canSeeAnalysis ? (
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
            ) : canSeeAnalysis && visibleYears.length > 0 && hasProjection && (
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
                        {isFr ? '🔒 Réservé aux membres Investor' : '🔒 Investor members only'}
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

        {/* ── POURQUOI POUVONS-NOUS ÊTRE CONFIANTS ── */}
        <div style={{ padding: '32px 40px 0', background: '#F5F4F0' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '12px' }}>
            {isFr ? 'POURQUOI POUVONS-NOUS ÊTRE CONFIANTS ?' : 'WHY CAN WE BE CONFIDENT?'}
          </div>
          {[
            compCount > 0 ? (isFr ? `${compCount} ventes comparables analysées` : `${compCount} comparable sales analyzed`) : null,
            hammerHistory?.total_sales > 0 ? (isFr ? `Historique de ventes réelles : ${hammerHistory.total_sales} transactions` : `Realized price history: ${hammerHistory.total_sales} transactions`) : null,
            isFr ? 'Données mises à jour quotidiennement' : 'Data updated daily',
          ].filter(Boolean).map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px', fontSize: '14px', color: LTT2, lineHeight: 1.6 }}>
              <span style={{ color: GL, flexShrink: 0, marginTop: '1px', fontSize: '12px' }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* ──────────────── ANALYSIS ──────────────── */}
        <div style={{ padding: '16px 40px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* AI Intelligence cards */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '16px' }}>◆ {isFr ? 'INTELLIGENCE IA' : 'AI INTELLIGENCE'}</div>
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
                    <div style={{ border: '0.5px solid #E8E4DC', borderRadius: '10px', overflow: 'hidden', marginTop: '4px' }}>
                      <div style={{ padding: '18px 20px', background: '#fff' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#C6A85A', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '14px' }}>
                          {isFr ? 'APERÇU MÉMO' : 'MEMO PREVIEW'}
                        </div>
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#B0A898', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>
                            {isFr ? 'POURQUOI CE LOT' : 'WHY THIS LOT'}
                          </div>
                          <div style={{ fontSize: '13px', color: '#0D1F35', lineHeight: 1.6 }}>
                            {isFr
                              ? `${lot.title || lot.artist_name_raw || 'Ce lot'} — mise à prix ${fmtExact(price)}. ${upside > 0 ? `${Math.round(upside)}% sous estimation` : 'Prix attractif'}${lot.artist?.trend === 'up' ? ', artiste en hausse' : ''}.`
                              : `${lot.title || lot.artist_name_raw || 'This lot'} — starting bid ${fmtExact(price)}. ${upside > 0 ? `${Math.round(upside)}% below estimate` : 'Attractive price'}${lot.artist?.trend === 'up' ? ', rising artist' : ''}.`
                            }
                          </div>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#B0A898', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>
                            {isFr ? 'PRIX JUSTIFIÉ ?' : 'PRICE JUSTIFIED?'}
                          </div>
                          <div style={{ fontSize: '13px', color: '#0D1F35', lineHeight: 1.6 }}>
                            {isFr
                              ? `Coût réel avec frais : ${fmtExact(realCost?.cost_basis || Math.round(price * premiumMultiplier))}. Seuil de rentabilité : ${fmtExact(realCost?.breakeven_hammer || Math.round(price * premiumMultiplier * 1.5))}.`
                              : `Real cost with fees: ${fmtExact(realCost?.cost_basis || Math.round(price * premiumMultiplier))}. Break-even: ${fmtExact(realCost?.breakeven_hammer || Math.round(price * premiumMultiplier * 1.5))}.`
                            }
                          </div>
                        </div>
                        {comparables.length > 0 && (() => {
                          const comp = comparables[0];
                          const compPrice = comp.current_price || comp.hammer_price || comp.estimate_low;
                          const compDate = comp.auction_date
                            ? new Date(comp.auction_date).toLocaleDateString(isFr ? 'fr-FR' : 'en-GB', { month: 'short', year: 'numeric' })
                            : null;
                          const hiddenCount = (marketAnalysis?.comparable_count ?? 0) - 1;
                          return (
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0D1F35', marginBottom: '4px' }}>
                                {isFr ? 'Pourquoi ce score ?' : 'Why this score?'}
                              </div>
                              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#B0A898', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '10px' }}>
                                {isFr ? 'VENTE COMPARABLE RÉCENTE' : 'RECENT COMPARABLE SALE'}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '16px', fontWeight: 600, color: '#0D1F35', fontFamily: 'var(--font-mono)' }}>
                                  {compPrice ? fmtExact(compPrice) : '—'}
                                </span>
                                {(comp.auction_house_name || compDate) && (
                                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                                    {[comp.auction_house_name, compDate].filter(Boolean).join(' · ')}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '10px', lineHeight: 1.5 }}>
                                {hiddenCount > 0
                                  ? (isFr
                                    ? `+ ${hiddenCount} vente${hiddenCount > 1 ? 's' : ''} utilisée${hiddenCount > 1 ? 's' : ''} pour calculer ce score`
                                    : `+ ${hiddenCount} sale${hiddenCount > 1 ? 's' : ''} used to calculate this score`)
                                  : (isFr ? 'Basé sur une vente comparable récente' : 'Based on one recent comparable sale')
                                }
                              </div>
                              <button
                                onClick={() => setUpgradeModal('investor')}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#C6A85A', fontWeight: 700, letterSpacing: '0.04em' }}
                              >
                                {isFr ? 'Voir notre prix maximum →' : 'See our maximum price →'}
                              </button>
                            </div>
                          );
                        })()}
                        <div style={{ position: 'relative' }}>
                          <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' as const, opacity: 0.6 }}>
                            <div style={{ marginBottom: '14px' }}>
                              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#B0A898', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>
                                {isFr ? 'LIQUIDITÉ' : 'LIQUIDITY'}
                              </div>
                              <div style={{ fontSize: '13px', color: '#0D1F35', lineHeight: 1.6 }}>
                                {isFr ? 'Analyse de la liquidité et probabilité de revente dans 3–5 ans...' : 'Liquidity analysis and resale probability over 3–5 years...'}
                              </div>
                            </div>
                            <div style={{ marginBottom: '14px' }}>
                              <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#B0A898', letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>
                                {isFr ? 'VERDICT ADVISOR' : 'ADVISOR VERDICT'}
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0D1F35' }}>
                                {isFr
                                  ? `ACHETER si ≤ ${fmtExact(avoidAbove ?? Math.round(price * 1.3))} — analyse complète`
                                  : `BUY if ≤ ${fmtExact(avoidAbove ?? Math.round(price * 1.3))} — full analysis`
                                }
                              </div>
                            </div>
                          </div>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.97) 65%)' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#0D1F35', fontWeight: 600, textAlign: 'center' as const, marginTop: '40px' }}>
                              {isFr ? 'Verdict advisor · Conviction · Recommandation complète' : 'Advisor verdict · Conviction · Full recommendation'}
                            </div>
                            <button
                              onClick={() => setUpgradeModal('investor')}
                              style={{ background: '#C6A85A', color: '#0C1622', border: 'none', borderRadius: '5px', padding: '10px 24px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '1px', cursor: 'pointer' }}
                            >
                              {isFr ? 'GÉNÉRER LE MÉMO COMPLET →' : 'GENERATE FULL MEMO →'}
                            </button>
                            <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                              {isFr
                                ? `Investor · 10€/mois${isTrialActive() ? ` · ${getTrialDaysLeft()} jours restants` : ' · 7 jours gratuits'}`
                                : `Investor · €10/mo${isTrialActive() ? ` · ${getTrialDaysLeft()} days left` : ' · 7 days free'}`
                              }
                            </div>
                          </div>
                        </div>
                      </div>
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
            </div>
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
