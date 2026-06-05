import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken, getUser } from '../../lib/auth';
import { parseUTC, isLiveLot, timeLabel } from '../../lib/auction';

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

interface SaleSummary {
  house: string;
  lotCount: number;
  firstDate: string;
  displayDate: string;
  relevanceLabel: string | null;
  isUrgent: boolean;
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

function relativeDate(iso: string): string {
  const ms = parseUTC(iso);
  const h = (ms - Date.now()) / 3_600_000;
  if (h < 0) return 'Terminée';
  const d = new Date(ms);
  const t = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (h < 1) return `Dans ${Math.round(h * 60)} min`;
  if (h < 6) return `Ce soir · ${t}`;
  if (h < 24) return `Aujourd'hui · ${t}`;
  if (h < 48) return `Demain · ${t}`;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${t}`;
}

// ── Badge logic ───────────────────────────────────────────────────────────────

interface Badge { label: string; color: string }

/**
 * Primary badge — exact mapping from rec_type to the actual signal used.
 * Never shows "Artiste suivi" unless the lot genuinely matched an artist alert.
 */
function primaryBadge(pick: TopPick): Badge {
  const lot = pick.lot;
  const h   = hoursUntil(lot.auction_date);

  // Urgency overrides all
  if (h !== null && h > 0 && h < 6 && (lot.deal_score ?? 0) >= 80) {
    return { label: `⚡ Clôture dans ${Math.round(h)}h — conviction forte`, color: '#ef4444' };
  }

  switch (pick.rec_type) {
    case 'agent_match':
      // Agent alerts can match by artist, category, or budget — use neutral strategy label
      return { label: '◈ Correspond à votre stratégie', color: '#C6A85A' };
    case 'preference_match':
      return { label: '◈ Correspond à vos préférences', color: '#C6A85A' };
    case 'artist_momentum':
      // From CollectorDNA top_artists (behavioral, not explicit follow)
      return { label: '◈ Artiste dans votre profil', color: '#C6A85A' };
    case 'category_match':
      return { label: '◈ Catégorie favorite', color: '#C6A85A' };
    case 'budget_match':
      return { label: '◈ Dans votre budget', color: '#C6A85A' };
    case 'period_match':
      return { label: '◈ Votre période de prédilection', color: '#C6A85A' };
    case 'similar_to_saved':
      return { label: '◈ Similaire à vos favoris', color: '#C6A85A' };
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

/**
 * Secondary badge — only shown when genuinely additive to the primary.
 * For preference_match: if the lot is also below estimate, show both signals.
 */
function secondaryBadge(pick: TopPick): Badge | null {
  const pct = pick.lot.pct_below_low_estimate;
  if (pick.rec_type === 'preference_match' && pct && pct >= 10) {
    return { label: `↓ ${Math.round(pct)}% sous l'estimation`, color: '#22c55e' };
  }
  return null;
}

// ── Derive sales from closing_soon ────────────────────────────────────────────

function deriveSales(closingSoon: LotCard[], topPicks: TopPick[]): SaleSummary[] {
  const agentHouses = new Set(
    topPicks.filter(p => p.rec_type === 'agent_match').map(p => p.lot.auction_house_name).filter(Boolean) as string[]
  );
  const personalHouses = new Set(
    topPicks.map(p => p.lot.auction_house_name).filter(Boolean) as string[]
  );

  const map = new Map<string, SaleSummary>();

  for (const lot of closingSoon) {
    if (!lot.auction_house_name || !lot.auction_date) continue;
    const dateKey = lot.auction_date.slice(0, 10);
    const key = `${lot.auction_house_name}::${dateKey}`;
    const h = hoursUntil(lot.auction_date);

    if (!map.has(key)) {
      map.set(key, {
        house: lot.auction_house_name,
        lotCount: 0,
        firstDate: lot.auction_date,
        displayDate: relativeDate(lot.auction_date),
        relevanceLabel: agentHouses.has(lot.auction_house_name)
          ? '◈ Artiste que vous surveillez'
          : personalHouses.has(lot.auction_house_name)
          ? '◈ Lots dans votre profil'
          : null,
        isUrgent: h !== null && h > 0 && h <= 6,
      });
    }
    map.get(key)!.lotCount++;
  }

  return [...map.values()]
    .sort((a, b) => {
      if (a.relevanceLabel && !b.relevanceLabel) return -1;
      if (!a.relevanceLabel && b.relevanceLabel) return 1;
      return parseUTC(a.firstDate) - parseUTC(b.firstDate);
    })
    .slice(0, 5);
}

// ── Larry signal ──────────────────────────────────────────────────────────────

function buildLarrySignal(brief: MarketBrief): string | null {
  if (brief.agent_unread > 0) {
    return `${brief.agent_unread} alerte${brief.agent_unread > 1 ? 's' : ''} de votre stratégie en attente de lecture.`;
  }
  const sinceH = Math.round((Date.now() - parseUTC(brief.since)) / 3_600_000);
  if (brief.new_lots_count > 0 && sinceH <= 48) {
    const t = sinceH < 1 ? "moins d'une heure" : sinceH === 1 ? '1h' : `${sinceH}h`;
    return `${brief.new_lots_count.toLocaleString('fr-FR')} nouveaux lots analysés depuis votre dernière visite (il y a ${t}).`;
  }
  if (brief.closing_today_count > 0) {
    const n = brief.closing_today_count;
    return `${n} vente${n > 1 ? 's clôturent' : ' clôture'} dans les 24 prochaines heures.`;
  }
  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnDirect() {
  const navigate  = useNavigate();
  getUser(); // ensure session check
  const [brief, setBrief]       = useState<MarketBrief | null>(null);
  const [loading, setLoading]   = useState(true);
  const [fetchedAt]             = useState(() => new Date());
  const [showAll, setShowAll]   = useState(false);
  const [allRecs, setAllRecs]   = useState<TopPick[]>([]);
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

  /**
   * Load extended recommendations from the for-you engine (same strategies,
   * more results). Deduped against top_picks so no lot appears twice.
   */
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

  const closingImminently = brief?.closing_soon.filter(l => {
    const h = hoursUntil(l.auction_date);
    return h !== null && h > 0 && h <= 6;
  }) ?? [];

  const sales  = brief ? deriveSales(brief.closing_soon, brief.top_picks) : [];
  const signal = brief ? buildLarrySignal(brief) : null;

  const chips = brief ? [
    brief.top_picks.length > 0 && {
      label: `${brief.top_picks.length} opportunité${brief.top_picks.length > 1 ? 's' : ''} pour vous`,
      urgent: false,
    },
    brief.agent_unread > 0 && {
      label: `${brief.agent_unread} alerte${brief.agent_unread > 1 ? 's' : ''} stratégie`,
      urgent: false,
    },
    brief.new_lots_count > 0 && {
      label: `${brief.new_lots_count.toLocaleString('fr-FR')} nouveaux lots`,
      urgent: false,
    },
    brief.closing_today_count > 0 && {
      label: `⚡ ${brief.closing_today_count} clôture${brief.closing_today_count > 1 ? 's' : ''} aujourd'hui`,
      urgent: true,
    },
  ].filter((c): c is { label: string; urgent: boolean } => Boolean(c)) : [];

  const minsAgo  = Math.round((Date.now() - fetchedAt.getTime()) / 60_000);
  const updatedStr = minsAgo < 1 ? "À l'instant" : `Il y a ${minsAgo} min`;

  return (
    <main style={{ maxWidth: '1520px', margin: '0 auto', padding: '36px 24px 80px' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--text-3)', marginBottom: '8px',
          }}>
            Nautilus · Marché en temps réel
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: '28px',
            fontWeight: 400, color: 'var(--navy)', margin: 0, lineHeight: 1.2,
          }}>
            En direct
          </h1>
        </div>
        {!loading && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.04em' }}>
            {updatedStr}
          </div>
        )}
      </div>

      {/* ── States ── */}
      {loading ? <SkeletonState /> : !brief ? <ErrorState /> : (
        <>
          {/* Synthesis chips */}
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: signal ? '12px' : '32px' }}>
              {chips.map((chip, i) => (
                <div key={i} style={{
                  padding: '0 12px', height: '32px',
                  display: 'flex', alignItems: 'center',
                  background: chip.urgent ? 'rgba(239,68,68,0.07)' : 'rgba(26,42,68,0.05)',
                  border: `1px solid ${chip.urgent ? 'rgba(239,68,68,0.2)' : 'rgba(26,42,68,0.09)'}`,
                  borderRadius: '16px',
                  fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.04em',
                  color: chip.urgent ? '#ef4444' : 'var(--text-2)',
                  whiteSpace: 'nowrap' as const,
                }}>
                  {chip.label}
                </div>
              ))}
            </div>
          )}

          {/* Larry signal */}
          {signal && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 16px', marginBottom: '32px',
              background: 'rgba(198,168,90,0.05)',
              border: '1px solid rgba(198,168,90,0.18)',
              borderRadius: '6px',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                color: 'var(--gold)', letterSpacing: '0.1em', flexShrink: 0,
              }}>
                ◆ LARRY
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                {signal}
              </span>
            </div>
          )}

          {/* ── POUR VOUS ── */}
          <section style={{ marginBottom: '52px' }}>
            <SectionHeader
              label="Pour vous"
              meta={brief.top_picks.length > 0 ? `${brief.top_picks.length} sélection${brief.top_picks.length > 1 ? 's' : ''}` : undefined}
              action={{
                label: loadingAll ? 'Chargement…' : showAll ? 'Réduire ↑' : 'Voir tout →',
                onClick: loadAllRecs,
              }}
              color="var(--gold)"
            />
            {brief.top_picks.length === 0 ? (
              <OnboardingCard onClick={() => navigate('/app/profile/preferences')} />
            ) : (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '20px',
                }}>
                  {brief.top_picks.slice(0, 4).map(pick => (
                    <ConvictionCard
                      key={pick.lot.id}
                      pick={pick}
                      onClick={() => navigate(`/app/opportunities/${pick.lot.id}`)}
                    />
                  ))}
                </div>

                {/* Extended recommendations — same engine, more results */}
                {showAll && allRecs.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '20px',
                    marginTop: '20px',
                    paddingTop: '20px',
                    borderTop: '1px solid var(--border)',
                  }}>
                    {allRecs.map(pick => (
                      <ConvictionCard
                        key={pick.lot.id}
                        pick={pick}
                        onClick={() => navigate(`/app/opportunities/${pick.lot.id}`)}
                      />
                    ))}
                  </div>
                )}
                {showAll && allRecs.length === 0 && !loadingAll && (
                  <div style={{ marginTop: '20px', fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                    Aucune opportunité supplémentaire pour le moment.
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── CLÔTURE IMMINENTE ── */}
          {closingImminently.length > 0 && (
            <section style={{ marginBottom: '52px' }}>
              <SectionHeader
                label="Clôture imminente"
                meta="Dans les 6 prochaines heures"
                color="#ef4444"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {closingImminently.slice(0, 8).map(lot => (
                  <TimerRow
                    key={lot.id}
                    lot={lot}
                    onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── VENTES EN COURS ── */}
          {sales.length > 0 && (
            <section>
              <SectionHeader
                label="Ventes en cours"
                action={{ label: 'Calendrier →', onClick: () => navigate('/app/calendar') }}
                color="var(--text-3)"
              />
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 280px))',
                gap: '16px',
              }}>
                {sales.map((sale, i) => (
                  <SaleCard key={i} sale={sale} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  label, meta, action, color,
}: {
  label: string;
  meta?: string;
  action?: { label: string; onClick: () => void };
  color: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase', color,
        }}>
          {label}
        </span>
        {meta && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
            {meta}
          </span>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
            color: 'var(--text-3)', background: 'none', border: 'none',
            cursor: 'pointer', padding: 0,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Conviction card ───────────────────────────────────────────────────────────

function ConvictionCard({ pick, onClick }: { pick: TopPick; onClick: () => void }) {
  const lot   = pick.lot;
  const pb    = primaryBadge(pick);
  const sb    = secondaryBadge(pick);
  const score = lot.deal_score ?? pick.score;
  const sColor = scoreColor(score);
  const h     = hoursUntil(lot.auction_date);
  const live  = isLiveLot(lot.status);
  const time  = lot.auction_date ? timeLabel(lot.auction_date, live) : null;
  const isUrgent = h !== null && h > 0 && h < 24;

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
        transition: 'border-color 0.15s, box-shadow 0.15s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(26,42,68,0.25)';
        (e.currentTarget as HTMLDivElement).style.boxShadow  = '0 4px 16px rgba(10,18,36,0.08)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.boxShadow  = 'none';
      }}
    >
      {/* Image */}
      <div style={{
        width: '100%', aspectRatio: '4/3',
        position: 'relative', overflow: 'hidden',
        background: 'rgba(26,42,68,0.06)', flexShrink: 0,
      }}>
        {lot.image_url
          ? <img
              src={lot.image_url} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
            />
          : <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(26,42,68,0.14)', fontSize: '40px',
            }}>◇</div>
        }

        {/* Score badge — bottom left */}
        <div style={{
          position: 'absolute', bottom: '10px', left: '10px',
          background: 'rgba(10,18,36,0.72)', backdropFilter: 'blur(6px)',
          borderRadius: '4px', padding: '4px 8px',
          display: 'flex', alignItems: 'baseline', gap: '2px',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: sColor, lineHeight: 1 }}>
            {Math.round(score)}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>/100</span>
        </div>

        {/* Urgency chip — bottom right */}
        {isUrgent && h !== null && (
          <div style={{
            position: 'absolute', bottom: '10px', right: '10px',
            background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(6px)',
            borderRadius: '4px', padding: '4px 8px',
            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
            color: 'white', letterSpacing: '0.06em',
          }}>
            ⚡ {Math.round(h)}H
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Primary badge */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
          color: pb.color, letterSpacing: '0.04em',
          marginBottom: sb ? '2px' : '10px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {pb.label}
        </div>

        {/* Secondary badge */}
        {sb && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            color: sb.color, letterSpacing: '0.04em', marginBottom: '10px',
          }}>
            {sb.label}
          </div>
        )}

        {/* Artist */}
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 400,
          color: 'var(--navy)', lineHeight: 1.2, marginBottom: '4px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lot.artist_name_raw || '—'}
        </div>

        {/* Title */}
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '12px', fontStyle: 'italic',
          color: 'var(--text-2)', lineHeight: 1.4,
          marginBottom: '12px', minHeight: '16px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {lot.title || ''}
        </div>

        {/* Meta */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
          fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
          marginBottom: '14px', marginTop: 'auto',
        }}>
          {(lot.estimate_low || lot.estimate_high) && (
            <span>Est. {fmt(lot.estimate_low)}{lot.estimate_high ? ` – ${fmt(lot.estimate_high)}` : ''}</span>
          )}
          {lot.auction_house_name && (
            <span>· {lot.auction_house_name}</span>
          )}
          {time && (
            <span style={{ color: time.urgent ? time.color : 'inherit' }}>
              · {time.urgent ? '⚡ ' : ''}{time.label}
            </span>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={e => { e.stopPropagation(); onClick(); }}
          style={{
            width: '100%', padding: '10px',
            background: 'var(--navy)', color: '#fff',
            border: 'none', borderRadius: '5px',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', letterSpacing: '0.01em',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#0f1f3a')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--navy)')}
        >
          Voir cette conviction →
        </button>
      </div>
    </div>
  );
}

// ── Timer row ─────────────────────────────────────────────────────────────────

function TimerRow({ lot, onClick }: { lot: LotCard; onClick: () => void }) {
  const live = isLiveLot(lot.status);
  const h    = hoursUntil(lot.auction_date);
  const time = lot.auction_date ? timeLabel(lot.auction_date, live) : null;
  const progressFraction = h !== null ? Math.max(0, Math.min(1, h / 6)) : 0;
  const barColor = h !== null ? (h < 1 ? '#ef4444' : h < 3 ? '#f97316' : '#C6A85A') : '#C6A85A';

  return (
    <div
      onClick={onClick}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        display: 'grid',
        gridTemplateColumns: '44px 1fr 100px 150px',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
    >
      {/* Thumbnail */}
      <div style={{
        width: '44px', height: '44px', borderRadius: '4px',
        overflow: 'hidden', background: 'var(--bg-subtle)', flexShrink: 0,
      }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)', fontSize: '14px' }}>◇</div>
        }
      </div>

      {/* Artist + title */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '13px', fontWeight: 600, color: 'var(--navy)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'var(--font-sans)',
        }}>
          {lot.artist_name_raw || '—'}
        </div>
        {lot.title && (
          <div style={{
            fontSize: '11px', color: 'var(--text-3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {lot.title}
          </div>
        )}
      </div>

      {/* Estimate + house */}
      <div style={{ textAlign: 'right', minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--navy)', marginBottom: '2px' }}>
          {fmt(lot.estimate_low)}
        </div>
        {lot.auction_house_name && (
          <div style={{
            fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {lot.auction_house_name.length > 18 ? lot.auction_house_name.slice(0, 16) + '…' : lot.auction_house_name}
          </div>
        )}
      </div>

      {/* Timer + progress bar */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: time?.urgent ? time.color : barColor,
          marginBottom: '5px', textAlign: 'right',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {time ? `${time.urgent ? '⚡ ' : ''}${time.label}` : '—'}
        </div>
        <div style={{ width: '100%', height: '2px', background: 'rgba(26,42,68,0.1)', borderRadius: '1px', overflow: 'hidden' }}>
          <div style={{
            width: `${progressFraction * 100}%`, height: '100%',
            background: barColor, borderRadius: '1px',
          }} />
        </div>
      </div>
    </div>
  );
}

// ── Sale card ─────────────────────────────────────────────────────────────────

function SaleCard({ sale }: { sale: SaleSummary }) {
  const hasRelevance = Boolean(sale.relevanceLabel);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${hasRelevance ? 'rgba(198,168,90,0.28)' : 'var(--border)'}`,
      borderRadius: '8px',
      padding: '18px 20px',
      opacity: hasRelevance ? 1 : 0.6,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--navy)', marginBottom: '8px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {sale.house}
      </div>

      {hasRelevance ? (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: 'var(--gold)', marginBottom: '10px', fontWeight: 600,
        }}>
          {sale.relevanceLabel}
        </div>
      ) : (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: 'var(--text-3)', fontStyle: 'italic', marginBottom: '10px',
        }}>
          Hors de votre profil
        </div>
      )}

      <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '10px' }}>
        {sale.lotCount} lot{sale.lotCount > 1 ? 's' : ''} en clôture
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
        color: sale.isUrgent ? '#ef4444' : 'var(--text-3)',
      }}>
        {sale.isUrgent ? '⚡ ' : ''}{sale.displayDate}
      </div>
    </div>
  );
}

// ── Onboarding card ───────────────────────────────────────────────────────────

function OnboardingCard({ onClick }: { onClick: () => void }) {
  return (
    <div style={{
      background: 'rgba(26,42,68,0.03)',
      border: '1px dashed rgba(26,42,68,0.15)',
      borderRadius: '8px',
      padding: '48px 32px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '28px', opacity: 0.2 }}>◇</div>
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: '18px',
        color: 'var(--navy)', fontWeight: 400,
      }}>
        Votre radar est inactif.
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', maxWidth: '380px', lineHeight: 1.65 }}>
        Nautilus ne connaît pas encore vos catégories ni votre budget.
        Configurez vos préférences pour activer la personnalisation.
      </div>
      <button
        onClick={onClick}
        style={{
          marginTop: '4px', padding: '10px 22px',
          background: 'var(--navy)', color: '#fff',
          border: 'none', borderRadius: '6px',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          fontFamily: 'var(--font-sans)', transition: 'background 0.15s',
        }}
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
    <>
      <style>{`@keyframes shimmer{0%,100%{opacity:0.4}50%{opacity:0.7}}`}</style>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        {[90, 130, 110, 120].map((w, i) => (
          <div key={i} style={{ height: '32px', width: `${w}px`, background: 'var(--bg-subtle)', borderRadius: '16px', animation: 'shimmer 1.4s ease-in-out infinite' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ aspectRatio: '4/3', background: 'var(--bg-subtle)', animation: 'shimmer 1.4s ease-in-out infinite' }} />
            <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ height: '10px', width: '70%', background: 'var(--bg-subtle)', borderRadius: '3px', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div style={{ height: '17px', width: '85%', background: 'var(--bg-subtle)', borderRadius: '3px', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div style={{ height: '12px', width: '55%', background: 'var(--bg-subtle)', borderRadius: '3px', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div style={{ height: '36px', background: 'var(--bg-subtle)', borderRadius: '5px', marginTop: '8px', animation: 'shimmer 1.4s ease-in-out infinite' }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-3)' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>◇</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--navy)', marginBottom: '8px' }}>
        Données momentanément indisponibles
      </div>
      <div style={{ fontSize: '13px' }}>Réessayez dans quelques instants.</div>
    </div>
  );
}
