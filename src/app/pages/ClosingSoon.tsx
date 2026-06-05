import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { getToken, getUser } from '../../lib/auth';
import { parseUTC, isLiveLot, timeLabel } from '../../lib/auction';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// ── localStorage persistence — lots stay visible 24h across refreshes ─────────
function todayKey(): string {
  return `nautilus_lots_${new Date().toISOString().slice(0, 10)}`;
}
function loadPersistedLots(): LotCard[] {
  try { const r = localStorage.getItem(todayKey()); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function persistLots(lots: LotCard[]): void {
  try {
    const today = todayKey();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('nautilus_lots_') && k !== today) localStorage.removeItem(k);
    }
    localStorage.setItem(today, JSON.stringify(lots));
  } catch { /* storage full — silent */ }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopPickLot {
  id: string;
  title: string | null;
  artist_name_raw: string | null;
  deal_score: number | null;
  pct_below_low_estimate: number | null;
  image_url: string | null;
  auction_house_name: string | null;
  auction_date: string | null;
  sale_name?: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  category: string | null;
  status: string | null;
}

interface TopPick {
  rec_type: string;
  score: number;
  reason: string;
  lot: TopPickLot;
}

interface LotCard {
  id: string;
  title: string | null;
  artist_name_raw: string | null;
  deal_score: number | null;
  pct_below_low_estimate: number | null;
  image_url: string | null;
  auction_house_name: string | null;
  auction_date: string | null;
  sale_name?: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  category: string | null;
  status: string | null;
  current_price: number | null;
  hammer_price?: number | null;
}

interface MarketBrief {
  since: string;
  generated_at: string;
  new_lots_count: number;
  closing_today_count: number;
  closing_soon: LotCard[];
  top_picks: TopPick[];
  new_lots: LotCard[];
  agent_unread: number;
}

// ── Lot status ────────────────────────────────────────────────────────────────

type LotStatus = 'live' | 'upcoming' | 'ended';

function deriveLotStatus(lot: { status: string | null; auction_date: string | null }): LotStatus {
  if (lot.status) {
    const s = lot.status.toLowerCase();
    if (s === 'sold' || s === 'passed' || s === 'ended' || s === 'closed') return 'ended';
    if (s === 'live' || s === 'open' || s === 'active') return 'live';
  }
  if (lot.auction_date) {
    const h = hoursUntil(lot.auction_date);
    if (h === null) return 'upcoming';
    if (h < 0) return 'ended';
    if (h < 0.25) return 'live';
  }
  return 'upcoming';
}

// ── Lot timing label — always present, no exceptions ─────────────────────────

function lotTimingLabel(lot: { auction_date: string | null; status: string | null }): { text: string; color: string; dot: 'red' | 'orange' | 'green' | 'gray' } {
  const status = deriveLotStatus(lot);

  if (status === 'ended') {
    const timeStr = lot.auction_date
      ? new Date(parseUTC(lot.auction_date)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '';
    return { text: `Terminé${timeStr ? ' · ' + timeStr : ''}`, color: '#6B7280', dot: 'gray' };
  }

  if (status === 'live') {
    return { text: 'Vente en cours', color: '#16a34a', dot: 'green' };
  }

  // upcoming — compute exact countdown
  const h = hoursUntil(lot.auction_date);
  if (h === null) return { text: 'Date à confirmer', color: '#6B7280', dot: 'gray' };

  if (h < 1) {
    const mins = Math.round(h * 60);
    if (mins <= 10) return { text: `Clôture dans ${mins} min`, color: '#dc2626', dot: 'red' };
    return { text: `Dans ${mins} min`, color: '#ea580c', dot: 'orange' };
  }
  if (h <= 6) {
    return { text: `Clôture dans ${Math.floor(h)}h${Math.round((h % 1) * 60).toString().padStart(2, '0')}`, color: '#dc2626', dot: 'red' };
  }
  if (h < 24) {
    return { text: `Dans ${Math.floor(h)}h ${Math.round((h % 1) * 60).toString().padStart(2, '0')}min`, color: '#d97706', dot: 'orange' };
  }
  const d = Math.floor(h / 24);
  if (d === 1) {
    const t = new Date(parseUTC(lot.auction_date!)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return { text: `Demain · ${t}`, color: '#d97706', dot: 'orange' };
  }
  return {
    text: `Dans ${d} jours`,
    color: '#6B7280',
    dot: 'orange',
  };
}

// ── Sale grouping ─────────────────────────────────────────────────────────────

interface SaleGroup {
  key: string;
  house: string;
  saleName: string;
  auctionDate: string;
  lots: LotCard[];
  status: LotStatus;
  bestLot: LotCard | null;
  maxScore: number;
  scoredLotCount: number;
}

function groupIntoSales(lots: LotCard[]): SaleGroup[] {
  const map = new Map<string, SaleGroup>();

  for (const lot of lots) {
    if (!lot.auction_house_name || !lot.auction_date) continue;
    const dateKey = lot.auction_date.slice(0, 13); // group by house + hour
    const key = `${lot.auction_house_name}::${dateKey}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        house: lot.auction_house_name,
        saleName: lot.sale_name ?? lot.auction_house_name,
        auctionDate: lot.auction_date,
        lots: [],
        status: deriveLotStatus(lot),
        bestLot: null,
        maxScore: 0,
        scoredLotCount: 0,
      });
    }
    const group = map.get(key)!;
    group.lots.push(lot);

    const score = lot.deal_score ?? 0;
    if (score > group.maxScore) {
      group.maxScore = score;
      group.bestLot = lot;
    }
    if (score > 0) group.scoredLotCount++;

    // Re-derive status from most urgent lot in group
    const ls = deriveLotStatus(lot);
    if (ls === 'live') group.status = 'live';
    else if (ls === 'upcoming' && group.status !== 'live') group.status = 'upcoming';
  }

  return [...map.values()].sort((a, b) => parseUTC(a.auctionDate) - parseUTC(b.auctionDate));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000)}K`;
  return `€${n.toLocaleString('fr-FR')}`;
}

function hoursUntil(iso: string | null): number | null {
  if (!iso) return null;
  return (parseUTC(iso) - Date.now()) / 3_600_000;
}

function sortKey(pick: TopPick): number {
  const h = hoursUntil(pick.lot.auction_date);
  const score = pick.lot.deal_score ?? pick.score ?? 0;
  if (h === null || h < 0) return score;
  if (h < 6)  return score + 40;
  if (h < 24) return score + 20;
  if (h < 72) return score + 10;
  return score;
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 83) return { label: 'Exceptionnel', color: '#1A6B3C' };
  if (score >= 77) return { label: 'Très fort',    color: '#1A6B3C' };
  if (score >= 70) return { label: 'Opportunité',  color: '#B8922A' };
  return                  { label: 'À surveiller', color: '#6B7280' };
}

function mergeLots(persisted: LotCard[], incoming: LotCard[]): LotCard[] {
  const map = new Map<string, LotCard>();
  for (const l of persisted) map.set(l.id, l);
  for (const l of incoming) map.set(l.id, { ...map.get(l.id), ...l });
  return [...map.values()];
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

// ── Primary badge for pick ────────────────────────────────────────────────────

interface Badge { label: string; color: string }

function primaryBadge(pick: TopPick): Badge {
  const lot = pick.lot;
  const h   = hoursUntil(lot.auction_date);
  if (h !== null && h > 0 && h <= 6 && (lot.deal_score ?? 0) >= 77) {
    return { label: `⚡ Clôture dans ${h < 1 ? Math.round(h * 60) + 'min' : Math.floor(h) + 'h'} — conviction forte`, color: '#dc2626' };
  }
  switch (pick.rec_type) {
    case 'agent_match':       return { label: '◈ Correspond à votre stratégie', color: '#B8922A' };
    case 'preference_match':  return { label: '◈ Correspond à vos préférences', color: '#B8922A' };
    case 'artist_momentum':   return { label: '◈ Artiste dans votre profil',     color: '#B8922A' };
    case 'category_match':    return { label: '◈ Catégorie favorite',             color: '#B8922A' };
    case 'budget_match':      return { label: '◈ Dans votre budget',              color: '#B8922A' };
    case 'period_match':      return { label: '◈ Votre période de prédilection',  color: '#B8922A' };
    case 'similar_to_saved':  return { label: '◈ Similaire à vos favoris',        color: '#B8922A' };
    case 'below_estimate':
    case 'distressed_sale': {
      const pct = lot.pct_below_low_estimate;
      if (pct && pct >= 10) return { label: `↓ ${Math.round(pct)}% sous l'estimation basse`, color: '#1A6B3C' };
      return { label: '◈ Anomalie de prix détectée', color: '#1A6B3C' };
    }
    default: {
      const pct = lot.pct_below_low_estimate;
      if (pct && pct >= 15) return { label: `↓ ${Math.round(pct)}% sous l'estimation basse`, color: '#1A6B3C' };
      return { label: '◈ Opportunité du moment', color: '#B8922A' };
    }
  }
}

// ── Briefing ──────────────────────────────────────────────────────────────────

interface BriefingData {
  verdict: string;
  tone: 'urgent' | 'active' | 'calm';
  stats: { value: string; label: string; highlight: boolean; urgent?: boolean; onClick?: () => void }[];
}

function buildBriefing(brief: MarketBrief, allDayLots: LotCard[], navigate: (p: string) => void): BriefingData {
  const urgent = brief.closing_soon.filter(l => {
    const h = hoursUntil(l.auction_date);
    return h !== null && h > 0 && h <= 6 && (l.deal_score ?? 0) >= 77;
  });
  const highConviction = brief.top_picks.filter(p => (p.lot.deal_score ?? p.score ?? 0) >= 77);
  const sinceH = Math.round((Date.now() - parseUTC(brief.since)) / 3_600_000);
  const liveNow = allDayLots.filter(l => deriveLotStatus(l) === 'live').length;

  let verdict: string;
  let tone: BriefingData['tone'];

  if (liveNow > 0 && urgent.length > 0) {
    verdict = `${liveNow} vente${liveNow > 1 ? 's' : ''} en cours. ${urgent.length} opportunité${urgent.length > 1 ? 's' : ''} haute conviction clôture${urgent.length > 1 ? 'nt' : ''} dans les 6 prochaines heures.`;
    tone = 'urgent';
  } else if (urgent.length >= 2) {
    verdict = `${urgent.length} opportunités haute conviction clôturent dans les 6 prochaines heures. Action requise.`;
    tone = 'urgent';
  } else if (urgent.length === 1) {
    const h = Math.floor(hoursUntil(urgent[0].auction_date) ?? 0);
    verdict = `${urgent[0].artist_name_raw ?? 'Un lot haute conviction'} clôture dans ${h}h. C'est le signal du moment.`;
    tone = 'urgent';
  } else if (brief.agent_unread > 0) {
    verdict = `${brief.agent_unread} alerte${brief.agent_unread > 1 ? 's' : ''} de votre stratégie d'investissement attendent votre lecture.`;
    tone = 'active';
  } else if (highConviction.length >= 4) {
    verdict = `Le marché est actif aujourd'hui. Larry a identifié ${highConviction.length} opportunités correspondant à votre profil.`;
    tone = 'active';
  } else if (brief.new_lots_count > 100 && sinceH <= 24) {
    verdict = `${brief.new_lots_count.toLocaleString('fr-FR')} nouveaux lots analysés depuis votre dernière visite.${highConviction.length > 0 ? ` ${highConviction.length} correspondent à votre profil.` : ''}`;
    tone = 'calm';
  } else if (getTimeOfDay() === 'morning' && brief.closing_today_count > 0) {
    verdict = `${brief.closing_today_count} vente${brief.closing_today_count > 1 ? 's clôturent' : ' clôture'} aujourd'hui. Bonne session.`;
    tone = 'calm';
  } else if (brief.top_picks.length === 0) {
    verdict = 'Aucune opportunité ne correspond encore à votre profil. Configurez vos préférences pour activer Larry.';
    tone = 'calm';
  } else {
    verdict = `${brief.top_picks.length} lot${brief.top_picks.length > 1 ? 's correspondent' : ' correspond'} à votre profil cette semaine.`;
    tone = 'calm';
  }

  return {
    verdict, tone,
    stats: [
      { value: String(brief.top_picks.length), label: 'pour votre profil', highlight: brief.top_picks.length > 0, onClick: () => navigate('/app/live') },
      { value: String(urgent.length), label: 'action < 6h', highlight: urgent.length > 0, urgent: urgent.length > 0 },
      { value: String(liveNow), label: 'ventes en cours', highlight: liveNow > 0 },
      {
        value: brief.agent_unread > 0 ? String(brief.agent_unread) : String(brief.closing_today_count),
        label: brief.agent_unread > 0 ? 'alertes stratégie' : 'clôtures aujourd\'hui',
        highlight: brief.agent_unread > 0 || brief.closing_today_count > 0,
        onClick: brief.agent_unread > 0 ? () => navigate('/app/agent') : undefined,
      },
    ],
  };
}

// ── Animated number ───────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: string }) {
  const [display, setDisplay] = useState('0');
  const numVal = parseInt(value.replace(/\D/g, ''), 10);
  const started = useRef(false);
  useEffect(() => {
    if (isNaN(numVal) || started.current) { setDisplay(value); return; }
    started.current = true;
    if (numVal === 0) { setDisplay('0'); return; }
    let step = 0; const steps = 18; const interval = 600 / steps;
    const timer = setInterval(() => {
      step++;
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setDisplay(String(Math.round(eased * numVal)));
      if (step >= steps) { setDisplay(value); clearInterval(timer); }
    }, interval);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}</span>;
}

// ── Dot component ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: LotStatus }) {
  const cfg = {
    live:     { bg: '#16a34a', pulse: true },
    upcoming: { bg: '#d97706', pulse: false },
    ended:    { bg: '#9CA3AF', pulse: false },
  }[status];
  return (
    <span style={{
      display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%',
      background: cfg.bg, flexShrink: 0,
      animation: cfg.pulse ? 'nautilus-pulse 1.4s ease-in-out infinite' : undefined,
    }} />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnDirect() {
  const navigate = useNavigate();
  getUser();
  const [brief, setBrief]         = useState<MarketBrief | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const [allDayLots, setAllDayLots]   = useState<LotCard[]>(() => loadPersistedLots());
  const [allRecs, setAllRecs]         = useState<TopPick[]>([]);
  const [loadingAll, setLoadingAll]   = useState(false);
  const [showAllPicks, setShowAllPicks] = useState(false);
  const [endedOpen, setEndedOpen]     = useState(false);
  const [, setTick] = useState(0); // force re-render for countdowns

  const doFetch = useCallback(() => {
    const token = getToken();
    fetch(`${BACKEND}/api/recommendations/market-brief`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: MarketBrief | null) => {
        if (!data) return;
        setBrief(data);
        const incoming = [...data.closing_soon, ...data.new_lots];
        setAllDayLots(prev => {
          const merged = mergeLots(prev, incoming);
          persistLots(merged);
          return merged;
        });
        setLastRefresh(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { doFetch(); }, [doFetch]);
  // Silent auto-refresh every 2 min
  useEffect(() => { const id = setInterval(doFetch, 120_000); return () => clearInterval(id); }, [doFetch]);
  // Countdown tick every 30s
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30_000); return () => clearInterval(id); }, []);

  function loadAllRecs() {
    if (allRecs.length > 0) { setShowAllPicks(true); return; }
    setLoadingAll(true);
    const token = getToken();
    fetch(`${BACKEND}/api/recommendations/for-you?limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { recommendations: [] })
      .then(data => {
        const topIds = new Set((brief?.top_picks ?? []).map(p => p.lot.id));
        setAllRecs((data.recommendations as TopPick[]).filter(r => !topIds.has(r.lot.id)));
        setShowAllPicks(true);
      })
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }

  // Section 1 — always top 3 by urgency×score, no score floor
  const allPicks = brief ? [...brief.top_picks, ...allRecs].sort((a, b) => sortKey(b) - sortKey(a)) : [];
  const top3     = allPicks.slice(0, 3);
  const rest     = allPicks.slice(3);

  // Section 2 — sales grouped
  const sales       = groupIntoSales(allDayLots);
  const salesLive    = sales.filter(s => s.status === 'live');
  const salesUpcoming = sales.filter(s => s.status === 'upcoming');
  const salesEnded   = sales.filter(s => s.status === 'ended');

  const briefing = brief ? buildBriefing(brief, allDayLots, navigate) : null;
  const minsAgo  = Math.round((Date.now() - lastRefresh.getTime()) / 60_000);
  const updatedStr = minsAgo < 1 ? "À l'instant" : `Il y a ${minsAgo} min`;

  return (
    <>
      <style>{`
        @keyframes nautilus-pulse { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes nautilus-shimmer { 0%,100%{opacity:.45} 50%{opacity:.75} }
      `}</style>
      <main style={{ maxWidth: '1520px', margin: '0 auto', padding: '36px 24px 80px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '8px' }}>
              Nautilus · Marché en temps réel
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, color: 'var(--navy)', margin: 0, lineHeight: 1.2 }}>
              En direct
            </h1>
          </div>
          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
              {updatedStr}
              <button onClick={doFetch} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px', lineHeight: 1.5 }}>↻</button>
            </div>
          )}
        </div>

        {loading ? <SkeletonState /> : !brief ? <ErrorState /> : (
          <>
            {/* ══ BRIEFING LARRY ══ */}
            {briefing && <LarryBriefing briefing={briefing} />}

            {/* ══ SECTION 1 — POUR VOUS ══ */}
            <section style={{ marginBottom: '48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--navy)' }}>
                    ⭐ Pour vous
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                    top 3 · urgence × score
                  </span>
                </div>
                {allPicks.length > 3 && (
                  <button
                    onClick={() => showAllPicks ? setShowAllPicks(false) : loadAllRecs()}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {loadingAll ? 'Chargement…' : showAllPicks ? 'Réduire ↑' : `${rest.length} de plus →`}
                  </button>
                )}
              </div>

              {brief.top_picks.length === 0 ? (
                <OnboardingCard onClick={() => navigate('/app/profile/preferences')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {top3.map(pick => (
                    <PickRow key={pick.lot.id} pick={pick} onClick={() => navigate(`/app/opportunities/${pick.lot.id}`)} />
                  ))}
                  {showAllPicks && rest.map(pick => (
                    <PickRow key={pick.lot.id} pick={pick} onClick={() => navigate(`/app/opportunities/${pick.lot.id}`)} muted />
                  ))}
                </div>
              )}
            </section>

            {/* ══ SECTION 2 — VENTES DU JOUR ══ */}
            {allDayLots.length > 0 && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
                    📡 Ventes du jour
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                    {sales.length} vente{sales.length > 1 ? 's' : ''} · 24h
                  </span>
                </div>

                {/* EN COURS */}
                {salesLive.length > 0 && (
                  <SaleGroup
                    status="live"
                    label="En cours"
                    sales={salesLive}
                    onClickSale={s => navigate(`/app/opportunities/${s.bestLot?.id ?? ''}`)}
                    style={{ marginBottom: '20px' }}
                  />
                )}

                {/* À VENIR */}
                {salesUpcoming.length > 0 && (
                  <SaleGroup
                    status="upcoming"
                    label="À venir"
                    sales={salesUpcoming}
                    onClickSale={s => navigate(`/app/opportunities/${s.bestLot?.id ?? ''}`)}
                    style={{ marginBottom: '20px' }}
                  />
                )}

                {/* TERMINÉES — collapsible */}
                {salesEnded.length > 0 && (
                  <div style={{ borderLeft: '3px solid var(--border)', paddingLeft: '12px', opacity: endedOpen ? .75 : .55, transition: 'opacity .2s' }}>
                    <button
                      onClick={() => setEndedOpen(o => !o)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px', width: '100%' }}
                    >
                      <StatusDot status="ended" />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                        Terminées
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                        {salesEnded.length}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', marginLeft: 'auto' }}>
                        {endedOpen ? '↑' : '↓'}
                      </span>
                    </button>
                    {endedOpen && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                        {salesEnded.map(s => (
                          <SaleCard key={s.key} sale={s} status="ended" onClick={() => navigate(`/app/opportunities/${s.bestLot?.id ?? ''}`)} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

// ── PickRow — enriched list item for Section 1 ────────────────────────────────

function PickRow({ pick, onClick, muted = false }: { pick: TopPick; onClick: () => void; muted?: boolean }) {
  const lot    = pick.lot;
  const pb     = primaryBadge(pick);
  const score  = lot.deal_score ?? pick.score;
  const sl     = scoreLabel(score);
  const timing = lotTimingLabel(lot);
  const isUrgent = timing.dot === 'red';

  const bg = isUrgent
    ? 'rgba(220,38,38,0.04)'
    : 'var(--bg-card)';
  const border = isUrgent
    ? '1px solid rgba(220,38,38,0.18)'
    : '1px solid var(--border)';

  return (
    <div
      onClick={onClick}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        display: 'grid',
        gridTemplateColumns: '68px 1fr auto auto',
        alignItems: 'center',
        gap: '14px',
        padding: '10px 14px',
        background: bg,
        border,
        borderRadius: '6px',
        cursor: 'pointer',
        opacity: muted ? .75 : 1,
        transition: 'background .1s, opacity .1s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = bg; (e.currentTarget as HTMLElement).style.opacity = muted ? '.75' : '1'; }}
    >
      {/* Thumbnail */}
      <div style={{ width: '68px', height: '68px', borderRadius: '5px', overflow: 'hidden', background: 'var(--bg-subtle)', flexShrink: 0, position: 'relative' }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(26,42,68,.15)', fontSize: '20px' }}>◇</div>
        }
      </div>

      {/* Artist + title + reason */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: pb.color, letterSpacing: '.04em', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pb.label}
        </div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 400, color: 'var(--navy)', lineHeight: 1.2, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.artist_name_raw || '—'}
        </div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '11px', fontStyle: 'italic', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>
          {lot.title || ''}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {lot.estimate_low && <span>Est. {fmt(lot.estimate_low)}{lot.estimate_high ? ` – ${fmt(lot.estimate_high)}` : ''}</span>}
          {lot.pct_below_low_estimate && lot.pct_below_low_estimate >= 5 && (
            <span style={{ color: '#1A6B3C' }}>↓ {Math.round(lot.pct_below_low_estimate)}% est.</span>
          )}
          {lot.auction_house_name && <span>· {lot.auction_house_name}</span>}
        </div>
      </div>

      {/* Score */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: sl.color, marginBottom: '2px', whiteSpace: 'nowrap' }}>
          {sl.label}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
          {Math.round(score)} / 100
        </div>
      </div>

      {/* Timing — always present */}
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
          {timing.dot === 'green' && (
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', animation: 'nautilus-pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: timing.color, whiteSpace: 'nowrap' }}>
            {timing.text}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── SaleGroup — EN COURS / À VENIR with colored left-border ──────────────────

function SaleGroup({ status, label, sales, onClickSale, style }: {
  status: LotStatus;
  label: string;
  sales: SaleGroup[];
  onClickSale: (s: SaleGroup) => void;
  style?: React.CSSProperties;
}) {
  const cfg = {
    live:     { border: '#16a34a', labelColor: '#15803d', dotColor: '#16a34a', pulse: true },
    upcoming: { border: '#d97706', labelColor: '#b45309', dotColor: '#d97706', pulse: false },
    ended:    { border: '#9CA3AF', labelColor: '#6B7280', dotColor: '#9CA3AF', pulse: false },
  }[status];

  return (
    <div style={{ borderLeft: `3px solid ${cfg.border}`, paddingLeft: '14px', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <StatusDot status={status} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: cfg.labelColor }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
          {sales.length} vente{sales.length > 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
        {sales.map(s => (
          <SaleCard key={s.key} sale={s} status={status} onClick={() => onClickSale(s)} />
        ))}
      </div>
    </div>
  );
}

// ── SaleCard — mini-card incarnating a sale with its best lot ─────────────────

function SaleCard({ sale, status, onClick }: { sale: SaleGroup; status: LotStatus; onClick: () => void }) {
  const timing = sale.bestLot ? lotTimingLabel(sale.bestLot) : null;
  const scoreLot = sale.maxScore > 0 ? scoreLabel(sale.maxScore) : null;

  const bgCfg = {
    live:     { bg: 'rgba(22,163,74,.04)',  border: 'rgba(22,163,74,.2)',  innerBorder: 'rgba(22,163,74,.12)' },
    upcoming: { bg: 'rgba(217,119,6,.04)',  border: 'rgba(217,119,6,.2)',  innerBorder: 'rgba(217,119,6,.12)' },
    ended:    { bg: 'var(--bg-card)',        border: 'var(--border)',        innerBorder: 'var(--border)' },
  }[status];

  return (
    <div
      onClick={onClick}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{ border: `1px solid ${bgCfg.border}`, borderRadius: '8px', background: bgCfg.bg, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow .15s', opacity: status === 'ended' ? .7 : 1 }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(10,18,36,.08)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
    >
      {/* Best lot image */}
      <div style={{ height: '80px', background: 'rgba(26,42,68,.06)', position: 'relative', overflow: 'hidden' }}>
        {sale.bestLot?.image_url
          ? <img src={sale.bestLot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(26,42,68,.15)', fontSize: '24px' }}>◇</div>
        }
        {/* Score badge */}
        {scoreLot && (
          <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(10,18,36,.7)', backdropFilter: 'blur(4px)', borderRadius: '4px', padding: '3px 7px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: scoreLot.color }}>{scoreLot.label}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '10px 12px' }}>
        {/* Sale name */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sale.saleName !== sale.house ? sale.saleName : ''}
        </div>
        {/* House */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--navy)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sale.house}
        </div>

        {/* Status + timing */}
        {timing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
            {status === 'live' && (
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', animation: 'nautilus-pulse 1.4s ease-in-out infinite' }} />
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: timing.color }}>
              {timing.text}
            </span>
          </div>
        )}

        {/* Divider + lot info */}
        <div style={{ borderTop: `1px solid ${bgCfg.innerBorder}`, paddingTop: '7px' }}>
          {sale.bestLot && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-2)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sale.bestLot.artist_name_raw ?? '—'}
            </div>
          )}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
            {sale.scoredLotCount > 0
              ? `${sale.scoredLotCount} opportunité${sale.scoredLotCount > 1 ? 's' : ''} détectée${sale.scoredLotCount > 1 ? 's' : ''}`
              : `${sale.lots.length} lot${sale.lots.length > 1 ? 's' : ''}`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Larry Briefing ────────────────────────────────────────────────────────────

function LarryBriefing({ briefing }: { briefing: BriefingData }) {
  const { verdict, tone, stats } = briefing;
  const border = tone === 'urgent' ? 'rgba(220,38,38,.2)' : tone === 'active' ? 'rgba(198,168,90,.2)' : 'var(--border)';
  const accent = tone === 'urgent' ? '#dc2626' : tone === 'active' ? 'var(--gold)' : 'var(--text-3)';
  const bg     = tone === 'urgent' ? 'rgba(220,38,38,.025)' : 'rgba(26,42,68,.015)';

  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: '8px', background: bg, padding: '22px 26px', marginBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: accent }}>◆ Larry · Briefing du jour</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 400, color: 'var(--navy)', lineHeight: 1.65, margin: '0 0 22px', maxWidth: '680px' }}>
        {verdict}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
        {stats.map((s, i) => (
          <div key={i} onClick={s.onClick} style={{ background: s.urgent ? 'rgba(220,38,38,.05)' : 'var(--bg-card)', padding: '13px 16px', cursor: s.onClick ? 'pointer' : 'default', transition: 'background .1s' }}
            onMouseEnter={e => { if (s.onClick) (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; }}
            onMouseLeave={e => { if (s.onClick) (e.currentTarget as HTMLElement).style.background = s.urgent ? 'rgba(220,38,38,.05)' : 'var(--bg-card)'; }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '21px', fontWeight: 700, color: s.urgent ? '#dc2626' : s.highlight ? 'var(--navy)' : 'var(--text-3)', lineHeight: 1, marginBottom: '4px', letterSpacing: '-.02em' }}>
              <AnimatedNumber value={s.value} />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: s.urgent ? '#dc2626' : 'var(--text-3)', letterSpacing: '.02em' }}>
              {s.label}{s.onClick && <span style={{ marginLeft: '3px', opacity: .5 }}>→</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Utility components ────────────────────────────────────────────────────────

function OnboardingCard({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ background: 'rgba(26,42,68,.025)', border: '1px dashed rgba(26,42,68,.15)', borderRadius: '8px', padding: '44px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '24px', opacity: .2 }}>◇</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', color: 'var(--navy)' }}>Votre radar est inactif.</div>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', maxWidth: '360px', lineHeight: 1.6 }}>
        Nautilus ne connaît pas encore vos préférences. Configurez votre profil pour activer la personnalisation.
      </div>
      <button onClick={onClick} style={{ marginTop: '4px', padding: '9px 20px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
        Configurer mes préférences →
      </button>
    </div>
  );
}

function SkeletonState() {
  return (
    <>
      <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '22px 26px', marginBottom: '40px', animation: 'nautilus-shimmer 1.4s ease-in-out infinite', background: 'var(--bg-subtle)' }}>
        <div style={{ height: '9px', width: '160px', background: 'var(--border)', borderRadius: '3px', marginBottom: '14px' }} />
        <div style={{ height: '18px', width: '58%', background: 'var(--border)', borderRadius: '3px', marginBottom: '6px' }} />
        <div style={{ height: '18px', width: '38%', background: 'var(--border)', borderRadius: '3px', marginBottom: '22px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px' }}>
          {[0,1,2,3].map(i => <div key={i} style={{ height: '58px', background: 'var(--border)' }} />)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '68px 1fr auto auto', gap: '14px', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '6px', alignItems: 'center', animation: 'nautilus-shimmer 1.4s ease-in-out infinite' }}>
            <div style={{ width: '68px', height: '68px', borderRadius: '5px', background: 'var(--bg-subtle)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ height: '10px', width: '70%', background: 'var(--bg-subtle)', borderRadius: '3px' }} />
              <div style={{ height: '15px', width: '85%', background: 'var(--bg-subtle)', borderRadius: '3px' }} />
              <div style={{ height: '10px', width: '55%', background: 'var(--bg-subtle)', borderRadius: '3px' }} />
            </div>
            <div style={{ width: '70px', height: '30px', background: 'var(--bg-subtle)', borderRadius: '3px' }} />
            <div style={{ width: '90px', height: '14px', background: 'var(--bg-subtle)', borderRadius: '3px' }} />
          </div>
        ))}
      </div>
    </>
  );
}

function ErrorState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-3)' }}>
      <div style={{ fontSize: '28px', marginBottom: '12px' }}>◇</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--navy)', marginBottom: '8px' }}>Données momentanément indisponibles</div>
      <div style={{ fontSize: '13px' }}>Réessayez dans quelques instants.</div>
    </div>
  );
}
