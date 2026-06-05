import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken, getUser } from '../../lib/auth';
import { parseUTC } from '../../lib/auction';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

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
  estimate_low: number | null;
  estimate_high: number | null;
  category: string | null;
  status: string | null;
  current_price: number | null;
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

function scoreColor(score: number | null): string {
  if (!score) return '#B8922A';
  if (score >= 85) return '#C0392B';
  if (score >= 75) return '#C6A85A';
  return '#B8922A';
}

// ── Status chip ───────────────────────────────────────────────────────────────

interface StatusChip { label: string; color: string; pulse: 'green' | 'orange' | null }

function lotStatusChip(status: string | null, auction_date: string | null): StatusChip | null {
  if (status === 'sold')      return { label: 'Adjugé',         color: 'var(--text-3)', pulse: null };
  if (status === 'unsold')    return { label: 'Terminé',        color: 'var(--text-3)', pulse: null };
  if (status === 'withdrawn') return { label: 'Retiré',         color: 'var(--text-3)', pulse: null };

  const h = hoursUntil(auction_date);

  // Auction date passed with no terminal status → assume sale is in progress
  if (status === 'live' || (h !== null && h <= 0)) {
    return { label: 'Vente en cours', color: '#22c55e', pulse: 'green' };
  }
  if (h === null) return null;
  if (h < 1 / 20) return { label: `Dans ${Math.round(h * 3600)}s`, color: '#ef4444', pulse: 'orange' };
  if (h < 1)      return { label: `Dans ${Math.round(h * 60)} min`, color: '#f97316', pulse: 'orange' };
  if (h < 6)      return { label: `Dans ${Math.round(h)}h`,          color: '#f97316', pulse: null };
  if (h < 24)     return { label: "Aujourd'hui",                     color: 'var(--gold)', pulse: null };
  const d = Math.ceil(h / 24);
  if (d <= 7)     return { label: `Dans ${d}j`,                      color: 'var(--text-3)', pulse: null };
  return null;
}

// ── Badge logic ───────────────────────────────────────────────────────────────

interface Badge { label: string; color: string }

function primaryBadge(pick: TopPick): Badge {
  const lot = pick.lot;
  const h   = hoursUntil(lot.auction_date);

  if (h !== null && h > 0 && h < 6 && (lot.deal_score ?? 0) >= 80) {
    return { label: `⚡ Clôture dans ${Math.round(h)}h — conviction forte`, color: '#ef4444' };
  }

  switch (pick.rec_type) {
    case 'agent_match':      return { label: '◈ Correspond à votre stratégie',  color: '#C6A85A' };
    case 'preference_match': return { label: '◈ Correspond à vos préférences',  color: '#C6A85A' };
    case 'artist_momentum':  return { label: '◈ Artiste dans votre profil',     color: '#C6A85A' };
    case 'category_match':   return { label: '◈ Catégorie favorite',            color: '#C6A85A' };
    case 'budget_match':     return { label: '◈ Dans votre budget',             color: '#C6A85A' };
    case 'period_match':     return { label: '◈ Votre période de prédilection', color: '#C6A85A' };
    case 'similar_to_saved': return { label: '◈ Similaire à vos favoris',       color: '#C6A85A' };
    case 'below_estimate':
    case 'distressed_sale': {
      const pct = lot.pct_below_low_estimate;
      if (pct && pct >= 10) return { label: `↓ ${Math.round(pct)}% sous l'estimation basse`, color: '#22c55e' };
      return { label: '◈ Anomalie de prix détectée', color: '#22c55e' };
    }
    default: {
      const pct = lot.pct_below_low_estimate;
      if (pct && pct >= 15) return { label: `↓ ${Math.round(pct)}% sous l'estimation basse`, color: '#22c55e' };
      return { label: '◈ Opportunité du moment', color: '#C6A85A' };
    }
  }
}

function secondaryBadge(pick: TopPick): Badge | null {
  const pct = pick.lot.pct_below_low_estimate;
  if (pick.rec_type === 'preference_match' && pct && pct >= 10) {
    return { label: `↓ ${Math.round(pct)}% sous l'estimation`, color: '#22c55e' };
  }
  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnDirect() {
  const navigate              = useNavigate();
  getUser();
  const [brief, setBrief]         = useState<MarketBrief | null>(null);
  const [loading, setLoading]     = useState(true);
  const [fetchedAt]               = useState(() => new Date());
  const [showAll, setShowAll]     = useState(false);
  const [allRecs, setAllRecs]     = useState<TopPick[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${BACKEND}/api/recommendations/market-brief`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBrief(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function loadAllRecs() {
    if (showAll) { setShowAll(false); return; }
    if (allRecs.length > 0) { setShowAll(true); return; }
    setLoadingAll(true);
    const token = getToken();
    fetch(`${BACKEND}/api/recommendations/for-you?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { recommendations: [] })
      .then(data => {
        const topIds = new Set((brief?.top_picks ?? []).map(p => p.lot.id));
        const extras = (data.recommendations as TopPick[]).filter(r => !topIds.has(r.lot.id));
        setAllRecs(extras);
        setShowAll(true);
      })
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }

  const minsAgo    = Math.round((Date.now() - fetchedAt.getTime()) / 60_000);
  const updatedStr = minsAgo < 1 ? "À l'instant" : `il y a ${minsAgo} min`;
  const totalPicks = brief?.top_picks.length ?? 0;

  return (
    <main style={{ maxWidth: '1520px', margin: '0 auto', padding: '36px 24px 80px' }}>

      {/* ── Keyframes (once per page) ── */}
      <style>{`
        @keyframes ed-live    { 0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}  70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}  100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
        @keyframes ed-s-green { 0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}  70%{box-shadow:0 0 0 6px rgba(34,197,94,0)}  100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
        @keyframes ed-s-orange{ 0%{box-shadow:0 0 0 0 rgba(249,115,22,0.5)} 70%{box-shadow:0 0 0 6px rgba(249,115,22,0)} 100%{box-shadow:0 0 0 0 rgba(249,115,22,0)} }
        @keyframes ed-shimmer { 0%,100%{opacity:0.5} 50%{opacity:0.9} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0, animation: 'ed-live 2s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            Nautilus · En direct
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, color: 'var(--navy)', margin: '0 0 6px', lineHeight: 1.2 }}>
              Meilleures opportunités
            </h1>
            {!loading && brief && totalPicks > 0 && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                {totalPicks} lot{totalPicks > 1 ? 's' : ''} correspondent à votre profil
              </div>
            )}
          </div>
          {!loading && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.04em', flexShrink: 0, paddingBottom: '2px' }}>
              {updatedStr}
            </div>
          )}
        </div>
      </div>

      {/* ── States ── */}
      {loading ? <SkeletonState /> : !brief ? <ErrorState /> : (
        <>
          {brief.top_picks.length === 0 ? (
            <OnboardingCard onClick={() => navigate('/app/profile/preferences')} />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {brief.top_picks.slice(0, 8).map(pick => (
                  <ConvictionCard
                    key={pick.lot.id}
                    pick={pick}
                    onClick={() => navigate(`/app/opportunities/${pick.lot.id}`)}
                  />
                ))}
                {showAll && allRecs.map(pick => (
                  <ConvictionCard
                    key={pick.lot.id}
                    pick={pick}
                    onClick={() => navigate(`/app/opportunities/${pick.lot.id}`)}
                  />
                ))}
              </div>

              <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
                {showAll && allRecs.length === 0 && !loadingAll ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    Toutes les opportunités sont affichées.
                  </div>
                ) : (
                  <button
                    onClick={loadAllRecs}
                    disabled={loadingAll}
                    style={{
                      padding: '10px 28px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.06em',
                      color: 'var(--text-2)',
                      cursor: loadingAll ? 'default' : 'pointer',
                      transition: 'border-color 0.15s, color 0.15s',
                      opacity: loadingAll ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { if (!loadingAll) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--navy)'; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; }}
                  >
                    {loadingAll ? 'Chargement…' : showAll ? 'Réduire ↑' : "Voir plus d'opportunités →"}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

// ── Conviction card ───────────────────────────────────────────────────────────

function ConvictionCard({ pick, onClick }: { pick: TopPick; onClick: () => void }) {
  const lot    = pick.lot;
  const pb     = primaryBadge(pick);
  const sb     = secondaryBadge(pick);
  const score  = lot.deal_score ?? pick.score;
  const sColor = scoreColor(score);
  const h      = hoursUntil(lot.auction_date);
  const chip   = lotStatusChip(lot.status, lot.auction_date);
  // Countdown overlay only for < 60 min and still upcoming (not live)
  const showCountdown = h !== null && h > 0 && h < 1;

  return (
    <div
      onClick={onClick}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => {
        const d = e.currentTarget as HTMLDivElement;
        d.style.borderColor = 'rgba(26,42,68,0.25)';
        d.style.boxShadow   = '0 4px 20px rgba(10,18,36,0.1)';
        d.style.transform   = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        const d = e.currentTarget as HTMLDivElement;
        d.style.borderColor = 'var(--border)';
        d.style.boxShadow   = 'none';
        d.style.transform   = 'translateY(0)';
      }}
    >
      {/* Image */}
      <div style={{ width: '100%', aspectRatio: '4/3', position: 'relative', overflow: 'hidden', background: 'var(--bg-subtle)', flexShrink: 0 }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-ghost)', fontSize: '40px' }}>◇</div>
        }

        {/* Score — bottom left */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(10,22,40,0.82)', backdropFilter: 'blur(6px)', borderRadius: 4, padding: '4px 8px', display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: sColor, lineHeight: 1 }}>{Math.round(score)}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>/100</span>
        </div>

        {/* Countdown overlay — bottom right, only < 60 min */}
        {showCountdown && h !== null && (
          <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(239,68,68,0.88)', backdropFilter: 'blur(6px)', borderRadius: 4, padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'white', letterSpacing: '0.06em' }}>
            ⚡ {Math.round(h * 60)} MIN
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Status chip */}
        {chip && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
            {chip.pulse && (
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: chip.color,
                animation: chip.pulse === 'green' ? 'ed-s-green 2s ease-in-out infinite' : 'ed-s-orange 1.8s ease-in-out infinite',
              }} />
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: chip.color, letterSpacing: '0.06em' }}>
              {chip.label}
            </span>
          </div>
        )}

        {/* Primary badge */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: pb.color, letterSpacing: '0.04em', marginBottom: sb ? 2 : 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pb.label}
        </div>

        {/* Secondary badge */}
        {sb && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: sb.color, letterSpacing: '0.04em', marginBottom: 10 }}>
            {sb.label}
          </div>
        )}

        {/* Artist */}
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 400, color: 'var(--navy)', lineHeight: 1.2, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.artist_name_raw || '—'}
        </div>

        {/* Title */}
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 12, fontStyle: 'italic', color: 'var(--text-2)', lineHeight: 1.4, marginBottom: 12, minHeight: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {lot.title || ''}
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: 'auto', marginBottom: 14 }}>
          {(lot.estimate_low || lot.estimate_high) && (
            <span>Est. {fmt(lot.estimate_low)}{lot.estimate_high ? ` – ${fmt(lot.estimate_high)}` : ''}</span>
          )}
          {lot.auction_house_name && (
            <span>· {lot.auction_house_name}</span>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={e => { e.stopPropagation(); onClick(); }}
          style={{ width: '100%', padding: 10, background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.01em', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0f1f3a')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--navy)')}
        >
          Voir le lot →
        </button>
      </div>
    </div>
  );
}

// ── Onboarding card ───────────────────────────────────────────────────────────

function OnboardingCard({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ background: 'rgba(26,42,68,0.03)', border: '1px dashed rgba(26,42,68,0.15)', borderRadius: 8, padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 28, opacity: 0.2 }}>◇</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--navy)', fontWeight: 400 }}>
        Votre radar est inactif.
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 380, lineHeight: 1.65 }}>
        Nautilus ne connaît pas encore vos catégories ni votre budget.
        Configurez vos préférences pour activer la personnalisation.
      </div>
      <button
        onClick={onClick}
        style={{ marginTop: 4, padding: '10px 22px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#0f1f3a')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--navy)')}
      >
        Configurer mes préférences →
      </button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonState() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ aspectRatio: '4/3', background: 'var(--bg-subtle)', animation: 'ed-shimmer 1.4s ease-in-out infinite' }} />
          <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ height: 10, width: '50%', background: 'var(--bg-subtle)', borderRadius: 3, animation: 'ed-shimmer 1.4s ease-in-out infinite' }} />
            <div style={{ height: 10, width: '75%', background: 'var(--bg-subtle)', borderRadius: 3, animation: 'ed-shimmer 1.4s ease-in-out infinite' }} />
            <div style={{ height: 17, width: '85%', background: 'var(--bg-subtle)', borderRadius: 3, animation: 'ed-shimmer 1.4s ease-in-out infinite' }} />
            <div style={{ height: 12, width: '55%', background: 'var(--bg-subtle)', borderRadius: 3, animation: 'ed-shimmer 1.4s ease-in-out infinite' }} />
            <div style={{ height: 36, background: 'var(--bg-subtle)', borderRadius: 5, marginTop: 8, animation: 'ed-shimmer 1.4s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-3)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>◇</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--navy)', marginBottom: 8 }}>
        Données momentanément indisponibles
      </div>
      <div style={{ fontSize: 13 }}>Réessayez dans quelques instants.</div>
    </div>
  );
}
