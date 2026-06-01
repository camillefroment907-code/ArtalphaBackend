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
const GD   = '#52C97F';
const GL   = '#1A7F4B';
const GL2  = '#1A6B3C';
const BL   = '#1D6EBF';
const BLD  = '#60A5FA';
const AMB  = '#D97706';
const RED  = '#DC2626';

// Decision colors
const GREEN_BG  = 'rgba(26,107,60,0.08)';
const GREEN_BDR = 'rgba(26,107,60,0.18)';
const AMBER_BG  = 'rgba(184,146,42,0.10)';
const GRAY_BG   = 'rgba(107,114,128,0.08)';

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

// ── LOCKED BLOCK ──────────────────────────────────────────────────────────────

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

// ── EDITORIAL SECTION ─────────────────────────────────────────────────────────

const EdSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '28px' }}>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '12px' }}>
      {title}
    </div>
    {children}
  </div>
);

const EdItem = ({ icon, iconColor, children }: { icon: string; iconColor: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px', fontSize: '14px', color: LTT2, lineHeight: 1.6 }}>
    <span style={{ color: iconColor, flexShrink: 0, marginTop: '1px', fontSize: '13px' }}>{icon}</span>
    <span>{children}</span>
  </div>
);

// ── ACCORDION ─────────────────────────────────────────────────────────────────

function Accordion({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.9rem 1.25rem',
          background: LTC,
          border: `0.5px solid ${LTB}`,
          borderRadius: open ? '12px 12px 0 0' : '12px',
          borderBottom: open ? 'none' : `0.5px solid ${LTB}`,
          cursor: 'pointer', fontSize: '13px', color: LTT2,
          fontFamily: 'var(--font-sans)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = LT; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = LTC; }}
      >
        <span>{label}</span>
        <span style={{ color: LTT3, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>
      {open && (
        <div style={{
          border: `0.5px solid ${LTB}`, borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          padding: '1rem 1.25rem',
          background: LTC,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── SCORE HUMAN LABEL ─────────────────────────────────────────────────────────

function scoreHumanLabel(score: number): string {
  if (score >= 90) return 'Exceptionnel';
  if (score >= 80) return 'Très intéressant';
  if (score >= 70) return 'À regarder de près';
  if (score >= 60) return 'Potentiel modéré';
  return 'Peu prioritaire';
}

function scoreBadgeLabel(score: number): string {
  if (score >= 83) return 'Opportunité forte';
  if (score >= 70) return 'Opportunité';
  if (score >= 55) return 'À surveiller';
  return 'Peu prioritaire';
}

function scoreBadgeColor(score: number): { bg: string; color: string; dot: string } {
  if (score >= 70) return { bg: GREEN_BG, color: GL2, dot: GL2 };
  if (score >= 55) return { bg: AMBER_BG, color: AMB, dot: AMB };
  return { bg: GRAY_BG, color: LTT3, dot: LTT3 };
}

function confidenceLabel(comparableCount: number): { label: string; color: string } {
  if (comparableCount >= 50)  return { label: 'Confiance élevée',   color: GL2 };
  if (comparableCount >= 10)  return { label: 'Confiance moyenne',  color: AMB };
  return                             { label: 'Confiance limitée',  color: LTT3 };
}

function ctaLabel(score: number): string {
  if (score >= 70) return 'Ajouter à ma shortlist';
  if (score >= 55) return 'Suivre cette œuvre';
  return 'Continuer à surveiller';
}

// ── DECISION SIGNALS ──────────────────────────────────────────────────────────

function buildOptimismSignals(lot: any, isFr: boolean): string[] {
  const signals: string[] = [];
  const pctBelow = lot.pct_below_low_estimate || 0;
  if (pctBelow > 5) {
    signals.push(isFr
      ? `Prix actuel ${Math.round(pctBelow)}% sous l'estimation basse`
      : `Current price ${Math.round(pctBelow)}% below low estimate`);
  }
  if ((lot.artist?.sell_through_rate || 0) >= 0.65) {
    const pct = Math.round((lot.artist.sell_through_rate) * 100);
    signals.push(isFr
      ? `${pct}% des œuvres de cet artiste trouvent acheteur`
      : `${pct}% of this artist's works find a buyer`);
  } else if ((lot.artist?.liquidity_score || 0) >= 65) {
    signals.push(isFr
      ? `Liquidité artiste élevée — facile à revendre`
      : `High artist liquidity — easy to resell`);
  }
  const compCount = lot.fair_value_confidence || 0;
  if (compCount >= 10) {
    signals.push(isFr
      ? `Analyse basée sur ${compCount} ventes comparables`
      : `Analysis based on ${compCount} comparable sales`);
  }
  if (lot.artist?.trend === 'up') {
    signals.push(isFr ? 'Marché artiste en progression' : 'Artist market trending up');
  }
  return signals.slice(0, 3);
}

function buildVigilanceSignals(lot: any, isFr: boolean): string[] {
  const signals: string[] = [];
  const provRisk = lot.provenance_risk;
  if (provRisk) signals.push(isFr ? 'Provenance peu documentée — vérifiez avant d\'enchérir' : 'Provenance poorly documented — verify before bidding');
  if (lot.artist?.trend === 'down') signals.push(isFr ? 'Marché artiste en recul récemment' : 'Artist market declining recently');
  const consignAlert = lot.consignment_alert;
  if (consignAlert) signals.push(isFr ? 'Volume de consignation élevé sur cette maison' : 'High consignment volume at this house');
  const compCount = lot.fair_value_confidence || 0;
  if (compCount < 10 && compCount > 0) signals.push(isFr ? 'Peu de ventes comparables disponibles' : 'Few comparable sales available');
  return signals.slice(0, 2);
}

function buildChangeOfMind(lot: any, isFr: boolean): string[] {
  const items: string[] = [];
  if (lot.provenance_risk) items.push(isFr ? 'Provenance incomplète ou contestée' : 'Incomplete or contested provenance');
  if ((lot.artist?.sell_through_rate || 0) < 0.5) {
    items.push(isFr ? 'Taux de vente inférieur à la moyenne du marché' : 'Sell-through rate below market average');
  }
  items.push(isFr ? 'Correction significative du marché secondaire de l\'artiste' : 'Significant correction in artist\'s secondary market');
  const compCount = lot.fair_value_confidence || 0;
  if (compCount < 20) items.push(isFr ? 'Données encore limitées pour cette œuvre' : 'Still limited data for this work');
  return items.slice(0, 3);
}

function buildWhyNotHigher(lot: any, isFr: boolean): string[] {
  const items: string[] = [];
  const pctBelow = lot.pct_below_low_estimate || 0;
  if (lot.provenance_risk) {
    items.push(isFr
      ? 'Le prix semble attractif, mais la provenance reste partiellement documentée.'
      : 'The price looks attractive, but provenance remains partially documented.');
  } else if (pctBelow < 10) {
    items.push(isFr
      ? 'L\'écart avec les comparables est positif, mais modeste.'
      : 'The gap with comparables is positive, but modest.');
  }
  if (lot.artist?.trend === 'down') {
    items.push(isFr
      ? 'Le marché de l\'artiste montre quelques signes de ralentissement.'
      : 'The artist\'s market shows some signs of slowing.');
  } else if ((lot.artist?.sell_through_rate || 0) < 0.7) {
    items.push(isFr
      ? 'Le marché de l\'artiste reste actif, mais moins dynamique qu\'en période haute.'
      : 'The artist\'s market remains active, but less dynamic than at its peak.');
  }
  const compCount = lot.fair_value_confidence || 0;
  if (compCount < 30) {
    items.push(isFr
      ? 'Les données sont solides, mais le nombre de transactions récentes reste limité.'
      : 'The data is solid, but the number of recent transactions remains limited.');
  }
  return items.slice(0, 2);
}

function buildTimingReasons(lot: any, isFr: boolean, daysUntilClose: number | null): string[] {
  const items: string[] = [];
  if (daysUntilClose !== null && daysUntilClose >= 0 && daysUntilClose <= 14) {
    items.push(isFr
      ? `La vente se termine dans ${daysUntilClose} jour${daysUntilClose > 1 ? 's' : ''} — le prix actuel reste inférieur aux comparables récents.`
      : `The sale closes in ${daysUntilClose} day${daysUntilClose !== 1 ? 's' : ''} — current price remains below recent comparables.`);
  }
  const pctBelow = lot.pct_below_low_estimate || 0;
  if (pctBelow > 15) {
    items.push(isFr
      ? `Cette œuvre est proposée ${Math.round(pctBelow)}% sous l'estimation — une décote rarement observée pour ce segment.`
      : `This work is offered ${Math.round(pctBelow)}% below estimate — a discount rarely seen in this segment.`);
  } else if (pctBelow > 5) {
    items.push(isFr
      ? 'Le prix actuel reste inférieur à la médiane des ventes comparables récentes.'
      : 'The current price remains below the median of recent comparable sales.');
  }
  if (lot.artist?.trend === 'up') {
    items.push(isFr
      ? 'Le marché de l\'artiste est en progression — les prix pourraient évoluer à la hausse.'
      : 'The artist\'s market is trending up — prices may move higher.');
  }
  return items.slice(0, 2);
}

function buildRecoText(score: number, isFr: boolean): string {
  if (score >= 80) return isFr ? 'Cette opportunité mérite d\'être étudiée sérieusement.' : 'This opportunity is worth a serious look.';
  if (score >= 65) return isFr ? 'Cette œuvre vaut la peine d\'être suivie de près.' : 'This work is worth following closely.';
  return isFr ? 'À surveiller — d\'autres opportunités peuvent être plus prioritaires.' : 'Worth monitoring — other opportunities may be more pressing.';
}

function buildNarrativeReading(lot: any, isFr: boolean, compCount: number): string {
  const pctBelow = lot.pct_below_low_estimate || 0;
  const hasGoodData = compCount >= 20;
  const marketActive = lot.artist?.trend !== 'down' && (lot.artist?.sell_through_rate || 0) >= 0.5;
  if (pctBelow > 15 && hasGoodData) {
    return isFr
      ? `Parmi les lots comparables actuellement disponibles, celui-ci présente l'un des rapports prix / opportunité les plus attractifs observés récemment. Le marché reste actif et les données disponibles nous permettent d'évaluer cette opportunité avec confiance.`
      : `Among comparable lots currently available, this one presents one of the most attractive price / opportunity ratios observed recently. The market remains active and the available data allows us to evaluate this opportunity with confidence.`;
  }
  if (marketActive && compCount >= 10) {
    return isFr
      ? `Cette œuvre présente plusieurs signaux favorables simultanément. Le marché de l'artiste reste soutenu et les comparables disponibles confortent notre lecture du prix.`
      : `This work shows several favorable signals simultaneously. The artist's market remains supported and the available comparables reinforce our reading of the price.`;
  }
  return isFr
    ? `Cette œuvre ressort positivement dans notre analyse. Le niveau de conviction reste mesuré en raison du volume de données disponibles, mais les signaux observés justifient une attention particulière.`
    : `This work stands out positively in our analysis. The conviction level remains measured due to the volume of available data, but the observed signals justify special attention.`;
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
  const [maxBidFromApi, setMaxBidFromApi]   = useState<number | null>(null);
  const [maxBidSource, setMaxBidSource]     = useState<string | null>(null);
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
  const [formatMatrix, setFormatMatrix]   = useState<any>(null);
  const [timingData, setTimingData]       = useState<any>(null);
  const [purchasePrice, setPurchasePrice]       = useState('');
  const [purchaseDate, setPurchaseDate]         = useState(() => new Date().toISOString().split('T')[0]);
  const [purchaseSource, setPurchaseSource]     = useState<'auction' | 'gallery' | 'private'>('auction');
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
      setMaxBidFromApi(data.max_bid ?? null);
      setMaxBidSource(data.max_bid_source ?? null);
    }).catch(() => {});
    const token = getToken();
    if (token && id) {
      setHammerLoading(true);
      fetch(`${BACKEND}/api/lots/${id}/hammer-history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => { setHammerHistory(data); setHammerLoading(false); })
        .catch((e) => { console.error('hammer-history fetch failed:', e); setHammerLoading(false); });
    }
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
  const _projMap: Record<number, { projected_value_eur: number; gain_pct: number }> = {};
  if (Array.isArray(lot.projection?.years)) {
    for (const p of lot.projection.years) _projMap[p.years] = p;
  }
  const projCagr = lot.projection?.cagr_pct ?? 0;
  const hasProjection = !!lot.projection?.cagr_pct;
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

  const totalCost     = realCost ? realCost.cost_basis : (price > 0 ? Math.round(price * premiumMultiplier) : null);
  const breakEvenGain = realCost?.needed_gain_pct ?? null;
  const netGain       = breakEvenGain != null ? upsidePct - breakEvenGain : null;
  const avoidAbove = maxBidFromApi ?? null;
  const avoidAboveUsedComps = maxBidFromApi != null;
  const RELIABLE_SOURCES = ['comparables_proches', 'comparables_meme_technique', 'comparables_technique_proche'];
  const maxBidIsReliable = !!avoidAbove && RELIABLE_SOURCES.includes(maxBidSource ?? '');
  const daysUntilClose = lot.auction_date
    ? Math.max(0, Math.round((new Date(lot.auction_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const analysisText = typeof lot.score_rationale === 'string' && lot.score_rationale.trim()
    ? lot.score_rationale.trim()
    : null;

  const allComps: any[] = comparables;
  const sameArtistComps = allComps.filter((c: any) =>
    c.artist_name_raw?.toLowerCase().trim() === (lot.artist_name_raw || '').toLowerCase().trim()
  );
  const displayComps = sameArtistComps.length >= 2 ? sameArtistComps.slice(0, 3) : allComps.slice(0, 3);
  const compsLabel   = sameArtistComps.length >= 2 ? (isFr ? 'VENTES COMPARABLES' : 'COMPARABLE SALES') : (isFr ? 'ŒUVRES SIMILAIRES' : 'SIMILAR WORKS');
  const maxCompPrice = comparables.length > 0 ? Math.max(...comparables.map((c: any) => c.current_price || 0), price) : price;
  const isHistorical = comparables.length > 0 && comparables[0].is_historical === true;
  const maxProjVal = visibleYears.length > 0 ? proj(Math.max(...visibleYears)) : proj(20);

  // White card style
  const wCard: React.CSSProperties = {
    background: LTC, border: `1px solid ${LTB}`, borderRadius: '12px', padding: '22px 24px',
  };
  // Light data row
  const dRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: `1px solid #F0EDE6`,
  };
  const sb = (lot as any).score_breakdown || {};
  const scorePillars = [
    { label: isFr ? 'VALORISATION' : 'PRICING',    value: Math.round(sb.below_estimate_score ?? 0) },
    { label: isFr ? 'LIQUIDITÉ' : 'LIQUIDITY',      value: Math.round(sb.liquidity_score ?? lot.artist?.liquidity_score ?? 0) },
    { label: isFr ? 'TAUX DE VENTE' : 'SELL-THR',  value: Math.round((lot.artist?.sell_through_rate ?? 0) * 100) },
  ].filter(p => p.value > 0);

  // ── DECISION SIGNALS (derived) ────────────────────────────────────────────────
  const compCount       = lot.fair_value_confidence || comparables.length || 0;
  const badgeC          = scoreBadgeColor(dealScore);
  const confP           = confidenceLabel(compCount);
  const optimismSigs    = buildOptimismSignals(lot, isFr);
  const vigilanceSigs   = buildVigilanceSignals(lot, isFr);
  const changeOfMind    = buildChangeOfMind(lot, isFr);
  const whyNotHigher    = buildWhyNotHigher(lot, isFr);
  const timingReasons   = buildTimingReasons(lot, isFr, daysUntilClose);
  const recoText        = dealScore >= 80
    ? (isFr ? "Cette opportunité mérite d'être étudiée sérieusement." : 'This opportunity is worth a serious look.')
    : dealScore >= 65
    ? (isFr ? 'Cette œuvre vaut la peine d\'être suivie de près.' : 'This work is worth following closely.')
    : (isFr ? "À surveiller — d'autres opportunités peuvent être plus prioritaires." : 'Worth monitoring — other opportunities may be more pressing.');
  const narrativeReading = buildNarrativeReading(lot, isFr, compCount);
  const humanLabel      = scoreHumanLabel(dealScore);

  // ── TOP PCT ───────────────────────────────────────────────────────────────────
  const topPct = dealScore >= 90 ? 5 : dealScore >= 83 ? 10 : dealScore >= 75 ? 20 : dealScore >= 65 ? 30 : null;

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
        @media(max-width:768px){
          .lot-hero-grid { grid-template-columns: 1fr !important; }
          .lot-hero-image { display: none !important; }
          .lot-light-zone-grid { grid-template-columns: 1fr !important; }
          .lot-mobile-only { display: flex !important; }
          .lot-details-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ═══ STICKY BAR ═══ */}
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

      {/* ═══ HERO DARK — left: image+info / right: verdict ═══ */}
      <div ref={heroRef} className="lot-hero-grid" style={{ background: DK, display: 'grid', gridTemplateColumns: '1fr 320px', minHeight: '380px' }}>

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

        {/* COL 2 — Context (unchanged) */}
        <div className="lot-hero-info" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '14px', borderRight: `0.5px solid ${DKB}` }}>
          {dealScore >= 83 && (
            <div style={{ display: 'inline-flex', alignSelf: 'flex-start' }}>
              <span style={{ background: 'rgba(198,168,90,0.1)', border: '0.5px solid rgba(198,168,90,0.4)', color: GOLD, fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', padding: '3px 10px', borderRadius: '4px', textTransform: 'uppercase' }}>
                {t('lot.exceptional')}
              </span>
            </div>
          )}
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
          {daysUntilClose !== null && daysUntilClose <= 7 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: daysUntilClose <= 2 ? '#EF4444' : '#FBBF24', letterSpacing: '0.08em' }}>
              ⚡ {isFr ? `Se clôture dans ${daysUntilClose} jour${daysUntilClose > 1 ? 's' : ''}` : `Closes in ${daysUntilClose} day${daysUntilClose !== 1 ? 's' : ''}`}
            </div>
          )}
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
          {/* External link */}
          <div>
            {!hasAccess ? (
              <span onClick={() => { window.location.href = '/app/pricing'; }} style={{ cursor: 'pointer', color: '#2563EB', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>🔒 {isFr ? 'Accès Investor →' : 'Investor access →'}</span>
            ) : (
              <a href={trackUrl} target="_blank" rel="noopener noreferrer"
                onClick={() => trackEvent('lot_external_click', 'lot', lot.id, { lot_title: lot.title, artist: lot.artist_name_raw, source: lot.source, auction_house: lot.auction_house_name, deal_score: lot.deal_score, url: rawUrl })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: BLD, textDecoration: 'none', letterSpacing: '0.06em' }}>
                {isFr ? 'Voir sur' : 'View on'} {sourceNames[source] || resolvedSource} ↗
              </a>
            )}
          </div>
        </div>

        {/* COL 3 — Verdict décisionnel */}
        <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '0', background: DK4 }}>

          {/* Badge verdict */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBottom: '18px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: badgeC.dot, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: badgeC.color, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {scoreBadgeLabel(dealScore)}
            </span>
          </div>

          {/* Score + human label */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '52px', fontWeight: 700, color: '#F0EDE6', lineHeight: 1 }}>{Math.round(dealScore)}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>/100</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: badgeC.color, marginBottom: '12px', letterSpacing: '0.04em' }}>
            {humanLabel}
          </div>
          {topPct && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', marginBottom: '16px' }}>
              <span style={{ color: GD, fontWeight: 700 }}>TOP {topPct}%</span> {isFr ? 'DES OPPORTUNITÉS NAUTILUS' : 'OF NAUTILUS OPPORTUNITIES'}
            </div>
          )}

          <div style={{ height: '0.5px', background: DKB, marginBottom: '14px' }} />

          {/* Confiance */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: confP.color, marginBottom: '3px' }}>{confP.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>
              {isFr ? `Basée sur ${compCount > 0 ? compCount : '—'} ventes comparables` : `Based on ${compCount > 0 ? compCount : '—'} comparable sales`}
            </div>
          </div>

          <div style={{ height: '0.5px', background: DKB, marginBottom: '14px' }} />

          {/* Notre lecture */}
          <div style={{ flex: 1, marginBottom: '18px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {isFr ? 'NOTRE LECTURE' : 'OUR TAKE'}
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0 }}>
              {narrativeReading}
            </p>
          </div>

          {/* CTA shortlist */}
          <button
            onClick={async () => {
              if (!getToken()) { window.location.href = '/app/login'; return; }
              setSubLoading(true);
              try {
                const r = await fetch(`${BACKEND}/api/wishlist/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
                if (r.status === 403) setUpgradeModal('wishlist');
                else if (r.ok) { setSubscribed(true); setSubId(id); trackEvent('lot_watchlist_add', 'lot', lot.id, { lot_title: lot.title, artist: lot.artist_name_raw, deal_score: lot.deal_score, source: 'hero_cta' }); }
              } finally { setSubLoading(false); }
            }}
            disabled={subLoading}
            style={{ padding: '11px 16px', background: subscribed ? 'rgba(82,201,127,0.12)' : 'rgba(198,168,90,0.1)', border: `0.5px solid ${subscribed ? GD : GOLD}`, color: subscribed ? GD : GOLD, cursor: subLoading ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', borderRadius: '4px', textTransform: 'uppercase', marginBottom: '8px', width: '100%' }}
          >
            {subLoading ? '...' : subscribed ? (isFr ? '✓ AJOUTÉ À VOTRE SHORTLIST' : '✓ ADDED TO SHORTLIST') : ctaLabel(dealScore).toUpperCase()}
          </button>

          {/* Follow / Purchase (compact row) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
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
                  if (r.status === 403) { setUpgradeModal('wishlist'); }
                  else if (r.ok) {
                    setSubscribed(true); setSubId(id);
                    trackEvent('lot_watchlist_add', 'lot', lot.id, { lot_title: lot.title, artist: lot.artist_name_raw, deal_score: lot.deal_score });
                  }
                }
              } finally { setSubLoading(false); }
            }}
            disabled={subLoading}
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
            style={{ flex: 1, background: 'none', border: `0.5px solid ${DKB}`, color: '#6B7280', cursor: subLoading ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', padding: '7px 10px', borderRadius: '4px' }}
          >
            {subscribed ? (isFr ? '✓ Suivi' : '✓ Following') : (isFr ? '🔔 Suivre' : '🔔 Follow')}
          </button>
            <button onClick={() => setShowPurchaseForm(v => !v)} style={{ flex: 1, background: showPurchaseForm ? 'rgba(26,107,60,0.1)' : 'none', border: `0.5px solid ${showPurchaseForm ? '#1A6B3C' : '#2A3B4C'}`, color: showPurchaseForm ? '#52C97F' : '#6B7280', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', padding: '7px 10px', borderRadius: '4px' }}>
              {isFr ? '✓ Acheté' : '✓ Bought'}
            </button>
          </div>
          {!purchaseDone ? (
            <>
              <div style={{ display: 'none' }}> {/* placeholder to keep structure */}
              </div>
              {showPurchaseForm && (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input type="number" placeholder={isFr ? 'Prix marteau payé (€)' : 'Hammer price paid (€)'} value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid #2A3B4C', color: '#E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '7px 10px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' as const, outline: 'none' }} />
                  <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid #2A3B4C', color: '#E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '7px 10px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' as const, outline: 'none' }} />
                  <select value={purchaseSource} onChange={e => setPurchaseSource(e.target.value as 'auction' | 'gallery' | 'private')} style={{ background: '#0D1F35', border: '0.5px solid #2A3B4C', color: '#E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '7px 10px', borderRadius: '4px', width: '100%' }}>
                    <option value="auction">{isFr ? 'Enchères' : 'Auction'}</option>
                    <option value="gallery">{isFr ? 'Galerie' : 'Gallery'}</option>
                    <option value="private">{isFr ? 'Privé' : 'Private sale'}</option>
                  </select>
                  <button onClick={async () => { if (!purchasePrice || !getToken()) return; setPurchaseLoading(true); try { const r = await fetch(`${BACKEND}/api/lots/${id}/confirm-purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ purchase_price: parseFloat(purchasePrice), purchase_date: purchaseDate, purchase_source: purchaseSource }) }); if (r.ok) { setPurchaseDone(true); setShowPurchaseForm(false); } } finally { setPurchaseLoading(false); } }} disabled={purchaseLoading || !purchasePrice} style={{ background: !purchasePrice ? 'rgba(26,107,60,0.3)' : '#1A6B3C', border: 'none', color: '#fff', cursor: purchaseLoading || !purchasePrice ? 'default' : 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', padding: '8px 14px', borderRadius: '4px', width: '100%' }}>
                    {purchaseLoading ? '...' : (isFr ? 'Enregistrer l\'achat' : 'Save purchase')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: '8px', border: '0.5px solid #1A6B3C', color: '#52C97F', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', padding: '8px 14px', borderRadius: '4px', width: '100%', textAlign: 'center' as const, boxSizing: 'border-box' as const }}>
              {isFr ? '✓ Achat enregistré dans votre archive' : '✓ Purchase saved to your archive'}
            </div>
          )}
        </div>
      </div>

      {/* ═══ LIGHT ZONE — DECISION COPILOT ═══ */}
      <div className="lot-light-zone" style={{ background: '#F5F4F0' }}>

        {/* ── SIGNAL STRIP (existing — preserved) ── */}
        <div style={{ background: '#fff', borderBottom: '0.5px solid #E8E4DC', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 20px', background: 'rgba(26,107,60,0.04)', borderBottom: '0.5px solid rgba(26,107,60,0.1)' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1A6B3C', flexShrink: 0 }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: '#1A6B3C', letterSpacing: '1.5px' }}>
              {verdict.icon} {verdict.label}
            </div>
            <div style={{ color: '#C6E8D0', margin: '0 4px' }}>|</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#6B7280' }}>
              {isFr
                ? `${lot.current_price ? (isGallery ? 'Disponible' : 'Enchère en cours') : 'Estimation'} ${fmtExact(price)}${isGallery ? '' : ' · enchère'}${daysUntilClose != null ? ` · clôture dans ${daysUntilClose} jour${daysUntilClose > 1 ? 's' : ''}` : ''}`
                : `${lot.current_price ? 'Current bid' : 'Estimate'} ${fmtExact(price)} · auction${daysUntilClose != null ? ` · closes in ${daysUntilClose} day${daysUntilClose > 1 ? 's' : ''}` : ''}`}
            </div>
          </div>

          {/* Price metrics strip — preserved */}
          <div style={{ display: 'grid', gridTemplateColumns: isGallery ? '1fr 2fr' : '1fr 0.5px 1fr 0.5px 2fr' }}>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#B0A898', letterSpacing: '2px', textTransform: 'uppercase' as const }}>
                {lot.current_price ? (isFr ? (isGallery ? 'PRIX DEMANDÉ' : 'MISE À PRIX') : (isGallery ? 'ASKING PRICE' : 'STARTING BID')) : (isFr ? 'ESTIMATION' : 'ESTIMATE')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 800, color: '#0D1F35', lineHeight: 1 }}>{fmtExact(price)}</div>
              {(upsidePct >= 5 && dealScore >= 70) && (
                <div style={{ display: 'inline-block', fontSize: '8px', fontWeight: 700, color: '#166534', background: '#F0FDF4', border: '0.5px solid #BBF7D0', padding: '2px 6px', borderRadius: '2px', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
                  {isFr ? 'BONNE ENTRÉE' : 'GOOD ENTRY'}
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#9CA3AF' }}>
                {isFr ? (isGallery ? 'Prix fixe' : 'Point de départ') : (isGallery ? 'Fixed price' : 'Starting point')}
              </div>
            </div>
            {!isGallery && <div style={{ background: '#E8E4DC' }} />}
            {!isGallery && <div style={{ padding: '12px 14px', background: '#FFFBEB', display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
              {maxBidIsReliable ? (
                <>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#92400E', letterSpacing: '2px', textTransform: 'uppercase' as const }}>
                    {(maxBidSource === 'ventes_meme_technique_limite' || maxBidSource === 'comparables_2d_limite' || maxBidSource === 'ventes_artiste_sans_medium')
                      ? (isFr ? 'MAX BID INDICATIF' : 'INDICATIVE MAX BID')
                      : (isFr ? (isGallery ? 'VALEUR MARCHÉ ESTIMÉE' : 'À NE PAS DÉPASSER') : (isGallery ? 'ESTIMATED MARKET VALUE' : 'DO NOT EXCEED'))}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 800, color: AMB, lineHeight: 1 }}>{fmtExact(avoidAbove)}</div>
                  <div style={{ fontSize: '10px', color: '#B45309', fontWeight: 500 }}>
                    {maxBidSource === 'ventes_meme_technique_limite' ? (isFr ? 'Peu de ventes — données limitées' : 'Few sales — limited data') : maxBidSource === 'comparables_2d_limite' ? (isFr ? 'Technique 2D proche — données limitées' : 'Adjacent 2D medium — limited data') : maxBidSource === 'ventes_artiste_sans_medium' ? (isFr ? 'Technique inconnue — indicatif seulement' : 'Medium unknown — indicative only') : (isFr ? (isGallery ? 'Au-dessus de la valeur marché' : 'Perte garantie au-delà') : (isGallery ? 'Above market value' : 'Loss guaranteed above'))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#92400E', letterSpacing: '2px', textTransform: 'uppercase' as const }}>{isFr ? 'BUDGET MAX' : 'MAX BUDGET'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: '#B45309', lineHeight: 1.3, textAlign: 'center' as const }}>{isFr ? 'Données insuffisantes' : 'Insufficient data'}</div>
                  <div style={{ fontSize: '10px', color: '#B45309', textAlign: 'center' as const }}>
                    {estLow > 0 ? (isFr ? `Basez-vous sur ${fmtExact(estLow)}–${fmtExact(estHigh)}` : `Refer to ${fmtExact(estLow)}–${fmtExact(estHigh)}`) : (isFr ? 'Estimation non disponible' : 'No estimate available')}
                  </div>
                </>
              )}
            </div>}
            {!isGallery && <div style={{ background: '#E8E4DC' }} />}
            <div style={{ padding: '10px 14px 10px 16px', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', gap: '7px', minWidth: 0, overflow: 'hidden' }}>
              {[
                { lbl: isFr ? 'ARTISTE' : 'ARTIST', val: lot.artist?.trend === 'up' ? '↑ EN HAUSSE' : lot.artist?.trend === 'down' ? '↓ EN BAISSE' : '→ STABLE', color: lot.artist?.trend === 'up' ? GL : lot.artist?.trend === 'down' ? RED : LTT2, pct: Math.min(100, Math.round(lot.artist?.liquidity_score ?? 0)), barColor: '#1A6B3C', num: `${Math.round(lot.artist?.liquidity_score ?? 0)}/100` },
                { lbl: 'CONVICTION', val: `${dealScore.toFixed(0)}/100`, color: dealScore >= 83 ? AMB : dealScore >= 60 ? AMB : RED, pct: Math.min(100, dealScore), barColor: '#C6A85A', num: dealScore >= 83 ? 'top 1%' : dealScore >= 77 ? 'top 5%' : dealScore >= 60 ? (isFr ? 'bon' : 'good') : (isFr ? 'modéré' : 'moderate') },
                { lbl: isFr ? 'DÉCOTE' : 'DISCOUNT', val: upside > 0 ? `− ${Math.round(upside)}%` : '—', color: upside > 0 ? GL : LTT3, pct: Math.min(100, Math.max(0, Math.round(upside))), barColor: '#34D399', num: estLow > 0 ? `vs ${fmtExact(estLow)}` : '—' },
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#B0A898', letterSpacing: '1px', textTransform: 'uppercase' as const, width: '60px', flexShrink: 0 }}>{m.lbl}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: m.color, width: '72px', flexShrink: 0 }}>{m.val}</div>
                  <div style={{ flex: 1, minWidth: 0, height: '4px', background: '#E8E4DC', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${m.pct}%`, background: m.barColor, borderRadius: '2px' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: LTT1, flexShrink: 0, whiteSpace: 'nowrap' as const }}>{m.num}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cost strip */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '7px 20px', background: '#F5F4F0', borderTop: '0.5px solid #E8E4DC' }}>
            {[
              { lbl: isFr ? 'COÛT RÉEL' : 'REAL COST', val: totalCost ? fmtExact(totalCost) : '—', color: LTT1 },
              { lbl: isFr ? 'FRAIS ACHETEUR' : 'BUYER FEES', val: `+${buyerPremiumPct}%`, color: LTT1 },
              { lbl: isFr ? 'RENTABILITÉ DÈS' : 'BREAK-EVEN AT', val: realCost?.breakeven_hammer ? fmtExact(Math.round(realCost.breakeven_hammer)) : '—', color: AMB },
              { lbl: isFr ? 'PROGRESSION NÉCESSAIRE' : 'NEEDED GAIN', val: breakEvenGain != null ? `+${Math.round(breakEvenGain)}%` : '—', color: LTT1 },
            ].map((item, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '5px', paddingRight: i < arr.length - 1 ? '16px' : 0, borderRight: i < arr.length - 1 ? '0.5px solid #E0DDD8' : 'none', marginRight: i < arr.length - 1 ? '16px' : 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#B0A898', letterSpacing: '1.5px', textTransform: 'uppercase' as const }}>{item.lbl}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: item.color }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ ZONE ÉDITORIALE ═══ */}
        <div style={{ padding: '40px 40px 8px' }}>

          {/* Lecture Nautilus (score_rationale) */}
          {hasAccess && analysisText && (
            <div style={{ borderLeft: '3px solid rgba(198,168,90,0.4)', paddingLeft: '16px', marginBottom: '36px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GOLD, letterSpacing: '2.5px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>LECTURE NAUTILUS</div>
              <p style={{ fontSize: '13px', color: LTT2, lineHeight: 1.75, fontStyle: 'italic', margin: 0 }}>{analysisText}</p>
            </div>
          )}

          {/* ── OPTIMISME ── */}
          {optimismSigs.length > 0 && (
            <EdSection title={isFr ? 'Pourquoi nous sommes optimistes' : 'Why we are optimistic'}>
              {optimismSigs.map((s, i) => <EdItem key={i} icon="✓" iconColor={GL2}>{s}</EdItem>)}
            </EdSection>
          )}

          {/* ── VIGILANCE ── */}
          {vigilanceSigs.length > 0 && (
            <EdSection title={isFr ? 'Points de vigilance' : 'Points of caution'}>
              {vigilanceSigs.map((s, i) => <EdItem key={i} icon="▲" iconColor={AMB}>{s}</EdItem>)}
            </EdSection>
          )}

          {/* ── CE QUI POURRAIT CHANGER D'AVIS ── */}
          <EdSection title={isFr ? "Ce qui pourrait nous faire changer d'avis" : 'What could change our mind'}>
            {changeOfMind.map((s, i) => <EdItem key={i} icon="↺" iconColor={LTT3}>{s}</EdItem>)}
          </EdSection>

          {/* ── POURQUOI PAS MIEUX NOTÉ ── */}
          {whyNotHigher.length > 0 && (
            <EdSection title={isFr ? "Pourquoi cette œuvre n'est-elle pas mieux notée ?" : "Why isn't this work rated higher?"}>
              {whyNotHigher.map((s, i) => <EdItem key={i} icon="ℹ" iconColor={LTT3}>{s}</EdItem>)}
            </EdSection>
          )}

          {/* ── POURQUOI MAINTENANT ── */}
          {timingReasons.length > 0 && (
            <EdSection title={isFr ? 'Pourquoi maintenant ?' : 'Why now?'}>
              {timingReasons.map((s, i) => (
                <div key={i} style={{ fontSize: '14px', color: LTT2, lineHeight: 1.6, paddingBottom: '8px', marginBottom: i < timingReasons.length - 1 ? '8px' : 0, borderBottom: i < timingReasons.length - 1 ? `0.5px solid ${LTB}` : 'none' }}>{s}</div>
              ))}
            </EdSection>
          )}

          {/* ── RECOMMANDATION FINALE ── */}
          <div style={{ background: 'rgba(26,107,60,0.05)', border: `0.5px solid rgba(26,107,60,0.15)`, borderRadius: '12px', padding: '24px 28px', marginBottom: '36px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '10px' }}>
              ◆ {isFr ? 'NOTRE RECOMMANDATION' : 'OUR RECOMMENDATION'}
            </div>
            <div style={{ fontSize: '17px', fontWeight: 500, color: GL2, marginBottom: '6px' }}>{recoText}</div>
            <div style={{ fontSize: '13px', color: LTT2, lineHeight: 1.6, marginBottom: '16px' }}>
              {isFr ? "Les signaux disponibles sont suffisamment solides pour l'analyser avant la clôture." : 'The available signals are solid enough to analyze before the closing.'}
            </div>
            <button
              onClick={async () => {
                if (!getToken()) { window.location.href = '/app/login'; return; }
                setSubLoading(true);
                try {
                  const r = await fetch(`${BACKEND}/api/wishlist/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } });
                  if (r.status === 403) setUpgradeModal('wishlist');
                  else if (r.ok) { setSubscribed(true); setSubId(id); trackEvent('lot_watchlist_add', 'lot', lot.id, { lot_title: lot.title, artist: lot.artist_name_raw, deal_score: lot.deal_score, source: 'cta_reco' }); }
                } finally { setSubLoading(false); }
              }}
              style={{ padding: '11px 24px', background: subscribed ? 'rgba(26,107,60,0.1)' : GL2, border: 'none', color: subscribed ? GL2 : '#fff', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 600 }}
            >
              {subscribed ? (isFr ? '✓ AJOUTÉ À VOTRE SHORTLIST' : '✓ ADDED TO SHORTLIST') : ctaLabel(dealScore).toUpperCase()}
            </button>
          </div>

          {/* ── DISCLAIMER ── */}
          <div style={{ fontSize: '11px', color: LTT3, lineHeight: 1.6, marginBottom: '36px', paddingBottom: '36px', borderBottom: `0.5px solid ${LTB}` }}>
            {isFr
              ? "Cette analyse repose sur les données disponibles aujourd'hui. Le marché de l'art peut évoluer et aucune performance future ne peut être garantie. Nautilus est un outil d'aide à la décision — pas un conseil financier réglementé."
              : 'This analysis is based on data available today. The art market may evolve and no future performance can be guaranteed. Nautilus is a decision support tool — not regulated financial advice.'}
          </div>
        </div>

        {/* ─────────────────────────────────────────────
            DÉTAILS + COÛT RÉEL
            ───────────────────────────────────────────── */}
        <div className="lot-details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#fff', borderBottom: '0.5px solid #E8E4DC', borderTop: '0.5px solid #E8E4DC' }}>
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
          </div>
          <div style={{ padding: '28px 40px 28px 24px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GOLD, letterSpacing: '2.5px', textTransform: 'uppercase' as const, marginBottom: '16px' }}>
              {isFr ? 'COMBIEN ALLEZ-VOUS RÉELLEMENT PAYER ?' : 'HOW MUCH WILL YOU ACTUALLY PAY?'}
            </div>
            <div style={{ background: '#F5F4F0', borderRadius: '10px', padding: '16px 18px' }}>
              {([
                { k: isFr ? 'Prix de départ' : 'Starting price', v: realCost?.ref_price || price },
                { k: `${isFr ? 'Frais acheteur' : 'Buyer\'s premium'} (${buyerPremiumPct}%)`, v: realCost ? realCost.cost_basis - (realCost.ref_price || price) : Math.round(price * (premiumMultiplier - 1)) },
                { k: isFr ? 'Coût de détention (3 ans)' : 'Holding cost (3 years)', v: realCost?.holding_cost_3y || 0 },
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
                <div style={{ marginTop: '12px', borderTop: '0.5px solid #E8E4DC', paddingTop: '10px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, marginBottom: '4px' }}>Nécessite +{breakEvenGain.toFixed(1)}% pour rentabiliser</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: GOLD, fontWeight: 600 }}>Seuil : {fmt(realCost.breakeven_hammer)}</div>
                </div>
              )}
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '0.5px solid #E8E4DC' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>
                  {isFr ? 'Calculé sur la mise à prix — le coût réel dépendra du marteau final.' : 'Calculated at starting price — actual cost depends on final hammer.'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────
            CE QUE MONTRE LE MARCHÉ (narrative version of market intel)
            ───────────────────────────────────────────── */}
        {(formatMatrix?.formats?.length > 0 || timingData?.best_house || hammerHistory?.total_sales > 0) && (
          <div style={{ padding: '36px 40px 0' }}>
            <EdSection title={isFr ? 'Ce que montre le marché' : 'What the market shows'}>
              {/* Narrative from hammer history */}
              {hammerHistory?.total_sales > 0 && hammerHistory?.median_eur && (
                <p style={{ fontSize: '14px', color: LTT2, lineHeight: 1.7, margin: '0 0 10px' }}>
                  {isFr
                    ? `Les œuvres similaires de ${lot.artist_name_raw || 'cet artiste'} se sont vendues avec une médiane de ${fmtExact(hammerHistory.median_eur)} — sur ${hammerHistory.total_sales} ventes enregistrées.`
                    : `Similar works by ${lot.artist_name_raw || 'this artist'} have sold with a median of ${fmtExact(hammerHistory.median_eur)} — across ${hammerHistory.total_sales} recorded sales.`}
                </p>
              )}
              {/* Best medium */}
              {formatMatrix?.formats?.length > 0 && (() => {
                const best = [...formatMatrix.formats].sort((a: any, b: any) => b.avg_price - a.avg_price)[0];
                return (
                  <p style={{ fontSize: '14px', color: LTT2, lineHeight: 1.7, margin: '0 0 10px' }}>
                    {isFr
                      ? `Les ${best.format.toLowerCase()}s obtiennent les meilleurs résultats pour cet artiste — moyenne €${Math.round(best.avg_price).toLocaleString()} sur ${best.count} ventes.`
                      : `${best.format}s achieve the best results for this artist — average €${Math.round(best.avg_price).toLocaleString()} across ${best.count} sales.`}
                  </p>
                );
              })()}
              {/* Timing */}
              {timingData?.best_month && (
                <p style={{ fontSize: '14px', color: LTT2, lineHeight: 1.7, margin: 0 }}>
                  {isFr
                    ? `La meilleure période observée est ${timingData.best_month}${timingData.best_season ? ` (${timingData.best_season})` : ''}.`
                    : `The best observed timing is ${timingData.best_month}${timingData.best_season ? ` (${timingData.best_season})` : ''}.`}
                </p>
              )}
              {/* Sell-through */}
              {(lot.artist?.sell_through_rate || 0) > 0 && (
                <p style={{ fontSize: '14px', color: LTT2, lineHeight: 1.7, margin: '10px 0 0' }}>
                  {isFr
                    ? `${Math.round(lot.artist.sell_through_rate * 100)}% des œuvres de cet artiste trouvent acheteur en première présentation.`
                    : `${Math.round(lot.artist.sell_through_rate * 100)}% of this artist's works find a buyer at first auction.`}
                </p>
              )}
            </EdSection>
          </div>
        )}

        {/* ── MINI ARTIST CARD (unchanged) ── */}
        {lot.artist_name_raw && (
          <div style={{ padding: '20px 40px 0' }}>
            <div
              onClick={() => navigate(`/app/artists/${encodeURIComponent(lot.artist_name_raw || '')}`)}
              className="comp-card-light"
              style={{ background: LTC, border: `1px solid ${LTB}`, borderRadius: '10px', padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: DK, border: `0.5px solid ${DKB}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '16px', opacity: 0.4, color: '#F0EDE6' }}>◎</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' as const }}>
                  <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', fontWeight: 600, color: LTT1 }}>{lot.artist_name_raw}</span>
                  {lot.artist_profile?.investment_tier && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, padding: '2px 7px', borderRadius: '3px', color: lot.artist_profile.investment_tier === 'blue_chip' ? BL : lot.artist_profile.investment_tier === 'emerging' ? GL : AMB, background: lot.artist_profile.investment_tier === 'blue_chip' ? '#EFF6FF' : lot.artist_profile.investment_tier === 'emerging' ? '#F0FDF4' : '#FFFBEB' }}>
                      {isFr ? (lot.artist_profile.investment_tier === 'emerging' ? 'émergent' : lot.artist_profile.investment_tier === 'mid_career' ? 'mi-carrière' : lot.artist_profile.investment_tier.replace('_', ' ')) : lot.artist_profile.investment_tier.replace('_', ' ')}
                    </span>
                  )}
                  {lot.artist?.trend && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: '3px', color: lot.artist.trend === 'up' ? GL : lot.artist.trend === 'down' ? RED : LTT3, background: lot.artist.trend === 'up' ? '#F0FDF4' : lot.artist.trend === 'down' ? '#FEF2F2' : LT }}>
                      {lot.artist.trend === 'up' ? (isFr ? '↑ EN HAUSSE' : '↑ RISING') : lot.artist.trend === 'down' ? (isFr ? '↓ EN BAISSE' : '↓ FALLING') : (isFr ? '→ STABLE' : '→ STABLE')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' as const }}>
                  {lot.artist?.liquidity_score != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>{isFr ? 'Liquidité' : 'Liquidity'} <strong style={{ color: LTT2 }}>{Math.round(lot.artist.liquidity_score)}/100</strong></span>}
                  {lot.artist?.sell_through_rate != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>{isFr ? 'Taux de vente' : 'Sell-thru'} <strong style={{ color: LTT2 }}>{Math.round(lot.artist.sell_through_rate * 100)}%</strong></span>}
                  {lot.artist?.total_lots_sold != null && lot.artist.total_lots_sold > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}><strong style={{ color: LTT2 }}>{lot.artist.total_lots_sold.toLocaleString()}</strong> {isFr ? 'lots suivis' : 'lots tracked'}</span>}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: GOLD, fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0 }}>{t('lot.fullAnalysis')}</div>
            </div>
          </div>
        )}

        {/* ── VENTES COMPARABLES (unchanged) ── */}
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
              const isHistoricalComps = comparables.length > 0 && comparables[0].is_historical === true;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px' }}>
                  <div style={{ background: '#0F3828', borderRadius: '12px', padding: '22px 20px', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#4ADE80', lineHeight: 1.1, marginBottom: '14px' }}>{fmtK(minComp)} – {fmtK(maxComp)}</div>
                      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, margin: 0 }}>
                        Des œuvres de <strong>{lot.artist_name_raw}</strong> {isHistoricalComps ? `ont réalisé entre ${fmtK(minComp)} et ${fmtK(maxComp)} aux enchères sur ${comparables.length} ventes historiques.` : `sont actuellement listées entre ${fmtK(minComp)} et ${fmtK(maxComp)} — prix demandés, pas encore réalisés.`}
                      </p>
                    </div>
                    <div style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{isHistoricalComps ? `${comparables.length} ventes réalisées` : `${comparables.length} lots actifs`}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                      <thead>
                        <tr>{['Artiste', 'Titre', '', 'Prix', isHistoricalComps ? 'Premium' : 'Score', 'Date'].map((col, ci) => (
                          <th key={ci} style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: LTT3, textAlign: 'left' as const, padding: '8px 10px 8px 0', borderBottom: '0.5px solid #E8E4DC' }}>{col}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {comparables.map((comp: any) => {
                          const compPrice = comp.current_price || comp.estimate_low || 0;
                          const compDate = comp.auction_date ? new Date(comp.auction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                          return (
                            <tr key={comp.id} onClick={() => navigate(`/app/opportunities/${comp.id}`)} style={{ cursor: 'pointer' }} onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F5F4F0'; }} onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}>
                              <td style={{ padding: '9px 10px 9px 0', borderBottom: '0.5px solid #E8E4DC', fontSize: '12px', color: LTT2, maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{comp.artist_name_raw || '—'}</td>
                              <td style={{ padding: '9px 10px 9px 0', borderBottom: '0.5px solid #E8E4DC', fontSize: '12px', color: LTT1, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{comp.title || 'Untitled'}</td>
                              <td style={{ width: '100px', padding: '0 8px', borderBottom: '0.5px solid #E8E4DC' }}><div style={{ height: '2px', background: '#E8E4DC', borderRadius: '1px' }}><div style={{ height: '100%', width: `${maxCompPrice > 0 ? (compPrice / maxCompPrice) * 100 : 0}%`, background: GOLD, borderRadius: '1px' }} /></div></td>
                              <td style={{ padding: '9px 10px 9px 0', borderBottom: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: GOLD, whiteSpace: 'nowrap' as const }}>{fmt(compPrice)}</td>
                              <td style={{ padding: '9px 10px 9px 0', borderBottom: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, whiteSpace: 'nowrap' as const }}>{isHistoricalComps ? (comp.premium_ratio ? `${((comp.premium_ratio - 1) * 100).toFixed(0)}%` : '—') : (comp.deal_score ? `${comp.deal_score.toFixed(0)}/100` : '—')}</td>
                              <td style={{ padding: '9px 0', borderBottom: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, whiteSpace: 'nowrap' as const }}>{compDate}</td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: 'rgba(52,211,153,0.04)' }}>
                          <td style={{ padding: '9px 10px 9px 0', borderTop: '0.5px solid #E8E4DC', fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>Votre lot</td>
                          <td style={{ padding: '9px 10px 9px 0', borderTop: '0.5px solid #E8E4DC', fontSize: '12px', color: LTT1 }}>{lot.auction_house_name || '—'}</td>
                          <td style={{ width: '100px', padding: '0 8px', borderTop: '0.5px solid #E8E4DC' }}><div style={{ height: '2px', background: 'rgba(52,211,153,0.2)', borderRadius: '1px' }}><div style={{ height: '100%', width: `${maxCompPrice > 0 ? (price / maxCompPrice) * 100 : 0}%`, background: '#34D399', borderRadius: '1px' }} /></div></td>
                          <td style={{ padding: '9px 10px 9px 0', borderTop: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: '#34D399', whiteSpace: 'nowrap' as const }}>{fmt(price)}</td>
                          <td style={{ padding: '9px 10px 9px 0', borderTop: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>—</td>
                          <td style={{ padding: '9px 0', borderTop: '0.5px solid #E8E4DC', fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>—</td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ marginTop: '10px', padding: '7px 10px', background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: '5px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: AMB }}>
                      {isHistoricalComps ? "⚠ Ces ventes peuvent inclure différents médiums. Vérifiez la technique avant d'acheter." : '⚠ Ces lots sont des prix demandés, pas des prix réalisés. Les ventes réelles peuvent différer.'}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── POURQUOI POUVONS-NOUS ÊTRE CONFIANTS ── */}
        <div style={{ padding: '36px 40px 0' }}>
          <EdSection title={isFr ? 'Pourquoi pouvons-nous être confiants ?' : 'Why can we be confident?'}>
            {[
              compCount > 0 ? (isFr ? `${compCount} ventes comparables analysées` : `${compCount} comparable sales analyzed`) : null,
              hammerHistory?.total_sales > 0 ? (isFr ? `Historique de ventes réelles : ${hammerHistory.total_sales} transactions` : `Realized price history: ${hammerHistory.total_sales} transactions`) : null,
              isFr ? 'Données mises à jour quotidiennement' : 'Data updated daily',
            ].filter(Boolean).map((item, i) => (
              <EdItem key={i} icon="✓" iconColor={GL2}>{item}</EdItem>
            ))}
          </EdSection>
        </div>

        {/* ═══ ANALYSE AVANCÉE (accordion) ═══ */}
        <div style={{ padding: '12px 40px 0' }}>
          <Accordion label={isFr ? 'Analyse avancée' : 'Advanced analysis'}>
            {/* Hammer history */}
            {hammerLoading && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: GOLD, letterSpacing: '0.16em', marginBottom: '16px' }}>◆ CHARGEMENT HISTORIQUE…</div>}
            {isInvestor && (formatMatrix?.formats?.length > 0 || timingData?.best_house) && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '16px' }}>
                  {isFr ? 'INTELLIGENCE MARCHÉ · ' : 'MARKET INTELLIGENCE · '}{lot.artist_name_raw?.toUpperCase()}
                </div>
                <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' as const }}>
                  {formatMatrix?.formats?.length > 0 && (() => {
                    const best = [...formatMatrix.formats].sort((a: any, b: any) => b.avg_price - a.avg_price)[0];
                    const current = formatMatrix.formats.find((f: any) => f.format.toLowerCase().includes((lot.medium || '').toLowerCase().split(' ')[0]));
                    return (
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '6px' }}>{isFr ? 'MEDIUM LE PLUS VALORISÉ' : 'TOP MEDIUM'}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', marginBottom: '2px' }}>{best.format}</div>
                        <div style={{ fontSize: '12px', color: LTT3 }}>Moy. €{Math.round(best.avg_price).toLocaleString()} · {best.count} ventes</div>
                        {current && current.format !== best.format && <div style={{ marginTop: '6px', fontSize: '11px', color: AMB }}>{isFr ? `Ce lot (${current.format}) : moy. €${Math.round(current.avg_price).toLocaleString()}` : `This lot (${current.format}): avg €${Math.round(current.avg_price).toLocaleString()}`}</div>}
                      </div>
                    );
                  })()}
                  {timingData?.best_house && (
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '6px' }}>{isFr ? 'MAISON OPTIMALE' : 'BEST AUCTION HOUSE'}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', marginBottom: '2px' }}>{timingData.best_house}</div>
                      {timingData.best_avg_price && <div style={{ fontSize: '12px', color: LTT3 }}>Moy. €{Math.round(timingData.best_avg_price).toLocaleString()}</div>}
                    </div>
                  )}
                  {timingData?.best_month && (
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '6px' }}>{isFr ? 'MEILLEURE PÉRIODE' : 'BEST TIMING'}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', marginBottom: '2px' }}>{timingData.best_month}</div>
                      {timingData.best_season && <div style={{ fontSize: '12px', color: LTT3 }}>{timingData.best_season}{timingData.best_avg_price && ` · €${Math.round(timingData.best_avg_price).toLocaleString()} moy.`}</div>}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Hammer history */}
            {hammerHistory?.locked ? (
              <div style={{ border: '0.5px solid rgba(232,228,220,0.4)', borderRadius: '10px', padding: '20px 24px', marginBottom: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '12px' }}>◆ {isFr ? 'HISTORIQUE DES VENTES RÉELLES' : 'REALIZED PRICES HISTORY'}</div>
                <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.5 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: 'var(--navy)' }}>€ 48 500</div>
                  <div style={{ fontSize: '12px', color: LTT3, marginTop: '4px' }}>124 ventes · Médiane €32 000</div>
                </div>
                <div style={{ marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: BL, letterSpacing: '0.1em' }}>
                  <span style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '3px 8px', borderRadius: '3px' }}>INVESTOR+</span>
                  <span style={{ marginLeft: '10px', color: LTT3 }}>{isFr ? 'Accédez à l\'historique complet des prix réalisés' : 'Access full realized price history'}</span>
                </div>
              </div>
            ) : hammerHistory && hammerHistory.total_sales > 0 ? (
              <div style={{ border: '0.5px solid rgba(232,228,220,0.4)', borderRadius: '10px', padding: '20px 24px', marginBottom: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '16px' }}>
                  ◆ {isFr ? 'HISTORIQUE DES VENTES RÉELLES' : 'REALIZED PRICES HISTORY'} · {hammerHistory.total_sales} {isFr ? 'VENTES' : 'SALES'}
                </div>
                <div style={{ display: 'flex', gap: '32px', marginBottom: '20px' }}>
                  {hammerHistory.median_eur && <div><div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '4px' }}>{isFr ? 'MÉDIANE' : 'MEDIAN'}</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: 'var(--navy)' }}>€{Math.round(hammerHistory.median_eur).toLocaleString()}</div></div>}
                </div>
              </div>
            ) : null}
            {/* Liquidity / sell-through details */}
            {(lot.artist?.liquidity_score != null || lot.artist?.sell_through_rate != null) && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: LTT3, letterSpacing: '0.1em', marginBottom: '8px', textTransform: 'uppercase' }}>LIQUIDITÉ & DEMANDE</div>
                {lot.artist?.liquidity_score != null && (
                  <div style={{ fontSize: '13px', color: LTT2, marginBottom: '6px', lineHeight: 1.6 }}>
                    <strong style={{ color: LTT1 }}>{isFr ? 'Liquidité' : 'Liquidity'}</strong> — {isFr ? 'Les œuvres de cet artiste trouvent régulièrement acheteur.' : 'This artist\'s works regularly find buyers.'} {isFr ? 'Score' : 'Score'} : {Math.round(lot.artist.liquidity_score)}/100
                  </div>
                )}
                {lot.artist?.sell_through_rate != null && (
                  <div style={{ fontSize: '13px', color: LTT2, marginBottom: '6px', lineHeight: 1.6 }}>
                    <strong style={{ color: LTT1 }}>{isFr ? 'Demande' : 'Demand'}</strong> — {Math.round(lot.artist.sell_through_rate * 100)}% {isFr ? 'des œuvres similaires trouvent acheteur en première présentation.' : 'of similar works find a buyer at first auction.'}
                  </div>
                )}
                {estBias != null && (
                  <div style={{ fontSize: '13px', color: LTT2, lineHeight: 1.6 }}>
                    <strong style={{ color: LTT1 }}>{isFr ? 'Biais d\'estimation' : 'Estimation bias'}</strong> — {isFr ? 'Les œuvres comparables dépassent souvent leur estimation.' : 'Comparable works often exceed their estimate.'}
                  </div>
                )}
              </div>
            )}
          </Accordion>
        </div>

        {/* ═══ COMMENT LE SCORE EST CALCULÉ (accordion — tout en bas) ═══ */}
        <div style={{ padding: '0 40px' }}>
          <Accordion label={isFr ? 'Comment est calculé ce score ?' : 'How is this score calculated?'}>
            {[
              { label: isFr ? 'Prix observé / comparables' : 'Observed price / comparables', pct: 40 },
              { label: isFr ? 'Demande artiste' : 'Artist demand', pct: 30 },
              { label: isFr ? 'Qualité des données' : 'Data quality', pct: 20 },
              { label: isFr ? 'Liquidité' : 'Liquidity', pct: 10 },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0' }}>
                <span style={{ fontSize: '13px', color: LTT2, width: '200px', flexShrink: 0 }}>{row.label}</span>
                <div style={{ flex: 1, height: '4px', background: LTB, borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: GOLD, borderRadius: '2px' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3, width: '32px', textAlign: 'right' }}>{row.pct}%</span>
              </div>
            ))}
          </Accordion>
        </div>

        {/* ═══ MÉMO D'INVESTISSEMENT + DOSSIER ═══ */}
        <div style={{ padding: '0 40px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
            {/* Memo card */}
            <div style={{ background: isInvestor ? DK : '#F9F8F5', border: `1px solid ${isInvestor ? DKB : LTB}`, borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', color: isInvestor ? '#F0EDE6' : LTT1, fontWeight: 500 }}>{isFr ? "Mémo d'investissement" : 'Investment Memo'}</span>
              </div>
              <div style={{ fontSize: '12px', color: isInvestor ? '#6B7280' : LTT3, marginBottom: '16px', lineHeight: 1.5 }}>
                {isFr ? 'Analyse advisor complète — prix justifié, liquidité, timing, verdict.' : 'Full advisor analysis — price, liquidity, timing, verdict.'}
              </div>
              {!isInvestor && <div style={{ marginBottom: '12px' }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D6EBF', padding: '3px 8px', borderRadius: '3px' }}>INVESTOR+</span></div>}
              {isInvestor ? (
                <button onClick={generateMemo} disabled={memoLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: GOLD, letterSpacing: '0.08em', background: 'none', border: `0.5px solid rgba(198,168,90,0.4)`, padding: '7px 14px', borderRadius: '4px', cursor: memoLoading ? 'default' : 'pointer', opacity: memoLoading ? 0.6 : 1 }}>
                  {memoLoading ? '...' : (memo ? (isFr ? '◆ MÉMO GÉNÉRÉ →' : '◆ MEMO READY →') : (isFr ? '◆ GÉNÉRER LE MÉMO →' : '◆ GENERATE MEMO →'))}
                </button>
              ) : (
                <div>
                  <div style={{ fontSize: '12px', color: LTT3, marginBottom: '12px', lineHeight: 1.5 }}>
                    {isFr ? 'Verdict advisor · Conviction · Recommandation complète' : 'Advisor verdict · Conviction · Full recommendation'}
                  </div>
                  <button onClick={() => setUpgradeModal('investor')} style={{ background: '#C6A85A', color: '#0C1622', border: 'none', borderRadius: '5px', padding: '10px 24px', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '1px', cursor: 'pointer' }}>
                    {isFr ? 'GÉNÉRER LE MÉMO COMPLET →' : 'GENERATE FULL MEMO →'}
                  </button>
                  <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                    {isFr ? `Investor · 19€/mois${isTrialActive() ? ` · ${getTrialDaysLeft()} jours restants` : ' · 7 jours gratuits'}` : `Investor · €19/mo${isTrialActive() ? ` · ${getTrialDaysLeft()} days left` : ' · 7 days free'}`}
                  </div>
                </div>
              )}
            </div>
            {/* Dossier card */}
            <div style={{ background: 'var(--bg-subtle)', border: `1px solid ${LTB}`, borderRadius: '12px', padding: '14px 18px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="7" stroke="#9CA3AF" strokeWidth="1.2"/><circle cx="8" cy="8" r="4" stroke="#9CA3AF" strokeWidth="1.2"/><circle cx="8" cy="8" r="1.5" fill="#9CA3AF"/></svg>
                <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', color: LTT1, fontWeight: 500 }}>{isFr ? "Dossier d'investissement" : 'Investment Dossier'}</span>
              </div>
              <div style={{ fontSize: '12px', color: LTT3, marginBottom: '16px', lineHeight: 1.5 }}>
                {isFr ? "Analyse complète — projections 5/10/20 ans, valorisation artiste & verdict IA." : "Full analysis — 5/10/20yr projections, artist valuation & AI verdict."}<span style={{ color: LTT3, marginLeft: '4px' }}>· PDF · Analyse complète</span>
              </div>
              <div style={{ marginBottom: '16px' }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', background: '#F0F0FF', border: '1px solid #C7C7F0', color: '#5B5BD6', padding: '3px 8px', borderRadius: '3px' }}>PRO+</span></div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: GOLD, opacity: 0.4, letterSpacing: '0.08em', borderBottom: '1px solid rgba(198,168,90,0.3)', paddingBottom: '1px', marginTop: '12px', cursor: 'default' }}>◆ BIENTÔT DISPONIBLE</div>
            </div>
          </div>
        </div>

        {/* ── AI ANALYST ── */}
        {canSeeAI && lot && <div style={{ padding: '0 40px 24px' }}><AIAnalyst lotId={lot.id} artistName={lot.artist_name_raw} lotTitle={lot.title} dealScore={lot.deal_score} currentPrice={price} /></div>}

        {/* ── SOURCES ── */}
        <div style={{ padding: '16px 40px 24px' }}>
          {!hasAccess ? null : (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: '12px' }}>◆ SOURCES</div>
              <div style={{ ...wCard, padding: '12px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0' }}>
                  {trackUrl && (
                    <div style={{ ...dRow, paddingTop: '8px', paddingBottom: '8px' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '2px' }}>{isFr ? 'SOURCE DU LOT' : 'LOT SOURCE'}</div>
                        <div style={{ fontSize: '12px', color: LTT2 }}>{lot.auction_house_name || resolvedSource || 'Auction'}</div>
                      </div>
                      <a href={trackUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: BL, textDecoration: 'none', fontWeight: 600 }}>
                        {isFr ? 'Voir le lot ↗' : 'View lot ↗'}
                      </a>
                    </div>
                  )}
                  {lot.artist_name_raw && (
                    <div style={{ ...dRow, paddingTop: '8px', paddingBottom: '8px' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '2px' }}>{isFr ? 'RECHERCHE ARTISTE' : 'ARTIST SEARCH'}</div>
                        <div style={{ fontSize: '12px', color: LTT2 }}>{lot.artist_name_raw}</div>
                      </div>
                      <a href={sourceSearch[source] || `https://www.google.com/search?q=${artistEnc}+auction+results`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: BL, textDecoration: 'none', fontWeight: 600 }}>
                        {isFr ? 'Rechercher l\'artiste ↗' : 'Search artist ↗'}
                      </a>
                    </div>
                  )}
                  {lot.auction_house_name && (
                    <div style={{ ...dRow, paddingTop: '8px', paddingBottom: '8px', borderBottom: 'none' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', color: LTT3, textTransform: 'uppercase' as const, marginBottom: '2px' }}>{isFr ? 'MAISON DE VENTE' : 'AUCTION HOUSE'}</div>
                        <div style={{ fontSize: '12px', color: LTT2 }}>{lot.auction_house_name}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: LTT3 }}>{sourceLabel}</span>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: LTT3, margin: '10px 0 0', lineHeight: 1.5 }}>
                  {isFr
                    ? `Les liens sources peuvent rediriger via le tracking Nautilus avant d'accéder à la plateforme de vente.${lot.auction_house_name ? ` Ce lot est proposé par ${lot.auction_house_name.split('—')[0].trim()}.` : ''}`
                    : `Source links may redirect via Nautilus tracking before landing on the auction platform.${lot.auction_house_name ? ` This lot is listed by ${lot.auction_house_name.split('—')[0].trim()}.` : ''}`}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── IMAGE LIGHTBOX ── */}
      {showLightbox && lot.image_url && (
        <div onClick={() => setShowLightbox(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#6B7280', pointerEvents: 'none' }}>✕ ESC</div>
          <img src={lot.image_url} alt={lot.title} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}

      {/* ── INVESTMENT MEMO MODAL (unchanged) ── */}
      {showMemo && memo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(12,22,34,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={e => { if (e.target === e.currentTarget) setShowMemo(false); }}>
          <div style={{ background: LTC, borderRadius: '12px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}>
            <div style={{ background: DK, padding: '24px 32px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>NAUTILUS · INVESTMENT MEMO</div>
                  <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', color: '#F0EDE6', marginBottom: '4px' }}>{memo.title}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{memo.artist}</div>
                </div>
                <button onClick={() => setShowMemo(false)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '20px', cursor: 'pointer', padding: '0', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '20px' }}>
                {[
                  { label: 'CURRENT PRICE', value: memo.current_price >= 1000 ? `€${(memo.current_price / 1000).toFixed(0)}K` : `€${memo.current_price}` },
                  { label: 'TARGET LOW', value: memo.target_price?.low ? `€${(memo.target_price.low / 1000).toFixed(0)}K` : 'N/A' },
                  { label: 'TARGET HIGH', value: memo.target_price?.high ? `€${(memo.target_price.high / 1000).toFixed(0)}K` : 'N/A' },
                  { label: 'CONVICTION', value: memo.conviction >= 75 ? 'Conviction forte' : memo.conviction >= 55 ? 'Conviction modérée' : 'Conviction faible' },
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
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: memo.recommendation === 'ACHETER' ? GL : memo.recommendation === 'INTÉRESSANT' ? AMB : LTT3 }}>{memo.recommendation}</div>
              </div>
              {memo.hook && <div style={{ marginBottom: '20px' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>◆ POURQUOI CE LOT</div><p style={{ fontSize: '14px', color: LTT1, lineHeight: 1.8, margin: 0, fontStyle: 'italic' }}>{memo.hook}</p></div>}
              {memo.prix_justifie && <div style={{ marginBottom: '20px' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: LTT3, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>① LE PRIX EST-IL JUSTIFIÉ ?</div><p style={{ fontSize: '14px', color: LTT1, lineHeight: 1.8, margin: 0 }}>{memo.prix_justifie}</p></div>}
              {memo.liquidite && <div style={{ marginBottom: '20px' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: LTT3, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>② POURREZ-VOUS REVENDRE ?</div><p style={{ fontSize: '14px', color: LTT1, lineHeight: 1.8, margin: 0 }}>{memo.liquidite}</p></div>}
              {memo.timing && <div style={{ marginBottom: '20px' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: LTT3, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>③ EST-CE LE BON MOMENT ?</div><p style={{ fontSize: '14px', color: LTT1, lineHeight: 1.8, margin: 0 }}>{memo.timing}</p></div>}
              {memo.prudence && memo.prudence.length > 0 && <div style={{ marginBottom: '20px' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: LTT3, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>◆ CE QUI NOUS REND PRUDENTS</div>{memo.prudence.map((item: string, i: number) => (<div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '6px' }}><span style={{ color: RED, fontSize: '12px', marginTop: '2px', flexShrink: 0 }}>▲</span><span style={{ fontSize: '13px', color: LTT2, lineHeight: 1.6 }}>{item}</span></div>))}</div>}
              {memo.advisor_verdict && <div style={{ marginBottom: '20px', padding: '16px', background: LT, borderRadius: '8px', border: `1px solid ${LTB}` }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: GOLD, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '12px' }}>◆ CE QU'UN ADVISOR FERAIT</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: LTT1, marginBottom: '6px' }}>{memo.advisor_verdict.action}</div>{memo.advisor_verdict.horizon && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3, marginBottom: '8px' }}>Horizon · {memo.advisor_verdict.horizon}</div>}{memo.advisor_verdict.rationale && <p style={{ fontSize: '13px', color: LTT2, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>{memo.advisor_verdict.rationale}</p>}</div>}
              <div style={{ borderTop: `1px solid ${LTB}`, paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>Nautilus Intelligence · {new Date(memo.generated_at).toLocaleDateString('en-GB')}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: LTT3 }}>NOT FINANCIAL ADVICE · FOR INFORMATIONAL PURPOSES ONLY</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
