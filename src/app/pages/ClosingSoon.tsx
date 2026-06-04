import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';
import { parseUTC, isLiveLot, timeLabel, isActiveAuction } from '../../lib/auction';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

interface Lot {
  id: string;
  title: string;
  artist_name_raw: string;
  current_price: number | null;
  estimate_low: number | null;
  estimate_high: number | null;
  deal_score: number | null;
  pct_below_low_estimate: number | null;
  image_url: string | null;
  auction_date: string | null;
  auction_house_name: string | null;
  category: string | null;
  status: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (!n) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

// parseUTC, isLiveLot, timeLabel, isActiveAuction imported from ../../lib/auction

// ── Signals — state-dependent ─────────────────────────────────────────────────
// LIVE only: price / discount signals — the bid is a real market signal
// UPCOMING:  market / artist signals — current_price is not yet meaningful

type Signal = { label: string; color: string; bg: string; border: string };

function getSignal(lot: Lot): Signal {
  const score = lot.deal_score ?? 0;

  if (isLiveLot(lot.status)) {
    const pct = lot.pct_below_low_estimate ?? 0;
    if (pct >= 40)   return { label: 'Forte décote',           color: '#22c55e', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.22)' };
    if (pct >= 25)   return { label: 'Sous estimation',        color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.18)' };
    if (score >= 80) return { label: 'Opportunité identifiée', color: '#C6A85A', bg: 'rgba(198,168,90,0.10)',  border: 'rgba(198,168,90,0.25)' };
    if (score >= 70) return { label: 'Forte demande',          color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.20)' };
    if (score >= 60) return { label: 'Marché solide',          color: '#94a3b8', bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.18)' };
                     return { label: 'En cours',               color: '#6b7280', bg: 'rgba(107,114,128,0.05)', border: 'rgba(107,114,128,0.15)' };
  } else {
    if (score >= 80) return { label: 'Artiste recherché',      color: '#C6A85A', bg: 'rgba(198,168,90,0.10)',  border: 'rgba(198,168,90,0.25)' };
    if (score >= 70) return { label: 'Historique favorable',   color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.20)' };
    if (score >= 60) return { label: 'Marché actif',           color: '#94a3b8', bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.18)' };
                     return { label: 'Larry suit ce lot',      color: '#6b7280', bg: 'rgba(107,114,128,0.05)', border: 'rgba(107,114,128,0.15)' };
  }
}

function priorityScore(lot: Lot): number {
  // For upcoming lots don't use pct_below (it's based on opening bid, not market)
  if (isLiveLot(lot.status)) return (lot.deal_score || 0) + (lot.pct_below_low_estimate ?? 0) * 0.5;
  return lot.deal_score || 0;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClosingSoon() {
  const navigate = useNavigate();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${BACKEND}/api/recommendations/closing-soon?hours=48&limit=80`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { lots: [] })
      .then(data => { setLots(data.lots || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Backend already guarantees auction_date >= now — no client-side date filter needed
  const activeLots = lots;

  // Live lots are more immediately actionable — surface them first in top picks
  const byPriority = [
    ...activeLots.filter(l => isLiveLot(l.status)).sort((a, b) => priorityScore(b) - priorityScore(a)),
    ...activeLots.filter(l => !isLiveLot(l.status)).sort((a, b) => priorityScore(b) - priorityScore(a)),
  ];

  const TOP_N = Math.min(5, activeLots.length);
  const topPicks = byPriority.slice(0, TOP_N);
  const topPickIds = new Set(topPicks.map(l => l.id));

  // Remaining — chronological
  const remaining = activeLots
    .filter(l => !topPickIds.has(l.id))
    .sort((a, b) => {
      if (!a.auction_date) return 1;
      if (!b.auction_date) return -1;
      return parseUTC(a.auction_date) - parseUTC(b.auction_date);
    });

  const liveCount     = activeLots.filter(l => isLiveLot(l.status)).length;
  const upcomingCount = activeLots.length - liveCount;

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px 80px' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px' }}>
          Nautilus · Dernière chance
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, color: 'var(--navy)', lineHeight: 1.2, margin: '0 0 10px' }}>
          Clôtures dans les 48 prochaines heures
        </h1>
        {!loading && activeLots.length > 0 && (
          <div style={{ display: 'flex', gap: '16px' }}>
            {liveCount > 0 && (
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
                ● {liveCount} vente{liveCount > 1 ? 's' : ''} en cours
              </span>
            )}
            {upcomingCount > 0 && (
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                ○ {upcomingCount} à venir
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── States ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonState />
      ) : activeLots.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ── Section 1 : Larry + top picks ─────────────────────────────── */}
          <div style={{ marginBottom: '48px' }}>
            {/* Larry banner */}
            <div style={{
              padding: '14px 20px',
              background: 'rgba(198,168,90,0.05)',
              border: '1px solid rgba(198,168,90,0.22)',
              borderBottom: topPicks.length > 0 ? 'none' : '1px solid rgba(198,168,90,0.22)',
              borderRadius: topPicks.length > 0 ? '8px 8px 0 0' : '8px',
              display: 'flex', alignItems: 'flex-start', gap: '14px',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--gold)', flexShrink: 0, paddingTop: '1px' }}>
                ◆ LARRY
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text)', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
                Larry surveille <strong>{activeLots.length}</strong> lot{activeLots.length > 1 ? 's' : ''} en clôture imminente.
                {topPicks.length > 0 && <> <strong>{topPicks.length}</strong> méritent particulièrement votre attention.</>}
              </span>
            </div>

            {/* Premium cards */}
            {topPicks.length > 0 && (
              <div style={{ border: '1px solid rgba(198,168,90,0.22)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                {topPicks.map((lot, i) => (
                  <PremiumCard
                    key={lot.id}
                    lot={lot}
                    isLast={i === topPicks.length - 1}
                    onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Section 2 : All remaining lots ────────────────────────────── */}
          {remaining.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Toutes les clôtures — {remaining.length} lot{remaining.length > 1 ? 's' : ''}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {remaining.map(lot => (
                  <CompactRow key={lot.id} lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

// ── Premium Card ──────────────────────────────────────────────────────────────

function PremiumCard({ lot, isLast, onClick }: { lot: Lot; isLast: boolean; onClick: () => void }) {
  const live   = isLiveLot(lot.status);
  const signal = getSignal(lot);
  const time   = lot.auction_date ? timeLabel(lot.auction_date, live) : null;

  return (
    <div
      onClick={onClick}
      role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{ display: 'flex', cursor: 'pointer', background: 'var(--bg-card)', borderBottom: isLast ? 'none' : '1px solid var(--border)', transition: 'background 0.12s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
    >
      {/* Image + live badge */}
      <div style={{ width: '110px', height: '110px', flexShrink: 0, background: 'var(--bg-subtle)', overflow: 'hidden', position: 'relative' }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.88 }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)', fontSize: '24px' }}>◇</div>
        }
        {/* Status overlay */}
        <div style={{
          position: 'absolute', bottom: '6px', left: '6px',
          fontSize: '8px', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em',
          color: live ? '#22c55e' : 'var(--text-3)',
          background: 'rgba(0,0,0,0.65)', borderRadius: '2px', padding: '2px 5px',
        }}>
          {live ? '● EN COURS' : '○ À VENIR'}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '14px 20px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Top: artist / title / signal */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '10px' }}>
          <div style={{ minWidth: 0 }}>
            {lot.artist_name_raw && (
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {lot.artist_name_raw}
              </div>
            )}
            <div style={{ fontSize: '14px', fontFamily: 'var(--font-serif)', color: 'var(--navy)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lot.title || 'Sans titre'}
            </div>
          </div>
          <span style={{
            flexShrink: 0, fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700,
            letterSpacing: '0.08em', color: signal.color, background: signal.bg,
            border: `1px solid ${signal.border}`, borderRadius: '3px', padding: '3px 9px', whiteSpace: 'nowrap',
          }}>
            {signal.label.toUpperCase()}
          </span>
        </div>

        {/* Bottom: price row — differs by state */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
          {live ? (
            // LIVE: show current bid and compare to estimate
            <>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>Enchère actuelle</div>
                <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--navy)' }}>
                  {fmt(lot.current_price)}
                </div>
              </div>
              {lot.estimate_low && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>Estimation basse</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textDecoration: lot.current_price && lot.current_price < lot.estimate_low ? 'line-through' : 'none' }}>
                      {fmt(lot.estimate_low)}
                    </span>
                    {lot.pct_below_low_estimate && lot.pct_below_low_estimate > 5 && (
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#22c55e', fontWeight: 700 }}>
                        -{lot.pct_below_low_estimate.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            // UPCOMING: show estimate only — current_price is not yet meaningful
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>Estimation</div>
              <div style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--navy)' }}>
                {lot.estimate_low && lot.estimate_high
                  ? `${fmt(lot.estimate_low)} — ${fmt(lot.estimate_high)}`
                  : fmt(lot.estimate_low)
                }
              </div>
            </div>
          )}

          {/* Maison */}
          {lot.auction_house_name && (
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>Maison de vente</div>
              <div style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{lot.auction_house_name}</div>
            </div>
          )}

          {/* Countdown — always pushed right */}
          {time && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>
                {live ? 'Clôture' : 'Passage au marteau'}
              </div>
              <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: time.color }}>
                {time.urgent && '⚡ '}{time.label}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Compact Row ───────────────────────────────────────────────────────────────

function CompactRow({ lot, onClick }: { lot: Lot; onClick: () => void }) {
  const live   = isLiveLot(lot.status);
  const signal = getSignal(lot);
  const time   = lot.auction_date ? timeLabel(lot.auction_date, live) : null;

  return (
    <div
      onClick={onClick}
      role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
    >
      {/* Status dot */}
      <span style={{ fontSize: '8px', flexShrink: 0, color: live ? '#22c55e' : 'var(--text-3)' }}>
        {live ? '●' : '○'}
      </span>

      {/* Thumbnail */}
      <div style={{ width: '38px', height: '38px', flexShrink: 0, borderRadius: '3px', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)', fontSize: '14px' }}>◇</div>
        }
      </div>

      {/* Artist + title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
          {lot.artist_name_raw || '—'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.title}
        </div>
      </div>

      {/* Signal badge */}
      <span style={{
        flexShrink: 0, fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.07em',
        color: signal.color, background: signal.bg, border: `1px solid ${signal.border}`,
        borderRadius: '2px', padding: '2px 7px', whiteSpace: 'nowrap',
      }}>
        {signal.label.toUpperCase()}
      </span>

      {/* Price — state-dependent */}
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '80px' }}>
        {live ? (
          <>
            <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--navy)' }}>
              {fmt(lot.current_price)}
            </div>
            {lot.pct_below_low_estimate && lot.pct_below_low_estimate > 5 && (
              <div style={{ fontSize: '10px', color: '#22c55e', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                -{lot.pct_below_low_estimate.toFixed(0)}%
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '1px' }}>Est.</div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--navy)' }}>
              {fmt(lot.estimate_low)}
            </div>
          </>
        )}
      </div>

      {/* Countdown */}
      {time && (
        <div style={{ flexShrink: 0, minWidth: '130px', textAlign: 'right' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: time.color }}>
            {time.urgent && '⚡ '}{time.label}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonState() {
  return (
    <>
      <style>{`@keyframes shimmer{0%{opacity:0.4}50%{opacity:0.7}100%{opacity:0.4}}`}</style>
      <div style={{ border: '1px solid rgba(198,168,90,0.22)', borderRadius: '8px', overflow: 'hidden', marginBottom: '48px' }}>
        <div style={{ height: '46px', background: 'rgba(198,168,90,0.05)', borderBottom: '1px solid rgba(198,168,90,0.22)' }} />
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', height: '110px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', background: 'var(--bg-card)' }}>
            <div style={{ width: '110px', background: 'var(--bg-subtle)', animation: 'shimmer 1.4s ease-in-out infinite' }} />
            <div style={{ flex: 1, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
              <div style={{ height: '10px', width: '100px', background: 'var(--bg-subtle)', borderRadius: '3px', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div style={{ height: '14px', width: '60%', background: 'var(--bg-subtle)', borderRadius: '3px', animation: 'shimmer 1.4s ease-in-out infinite' }} />
              <div style={{ height: '10px', width: '40%', background: 'var(--bg-subtle)', borderRadius: '3px', animation: 'shimmer 1.4s ease-in-out infinite' }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-3)' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>◇</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--navy)', marginBottom: '8px' }}>Aucune vente imminente</div>
      <div style={{ fontSize: '13px' }}>Aucune vente ne clôture dans les 48 prochaines heures.</div>
    </div>
  );
}
