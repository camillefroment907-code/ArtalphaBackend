import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';

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

function timeInfo(iso: string): { label: string; short: string; urgent: boolean; color: string } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: 'Terminé', short: 'Terminé', urgent: false, color: 'var(--text-3)' };
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(ms / 3600000);
  if (totalMin < 60) return { label: `Se termine dans ${totalMin} min`, short: `${totalMin} min`, urgent: true, color: '#ef4444' };
  if (h < 6)  return { label: `Se termine dans ${h}h`, short: `${h}h`, urgent: true, color: '#f97316' };
  if (h < 24) return { label: "Se termine aujourd'hui", short: "Aujourd'hui", urgent: true, color: 'var(--gold)' };
  if (h < 48) return { label: 'Se termine demain', short: 'Demain', urgent: false, color: 'var(--text-3)' };
  return { label: `Dans ${Math.floor(h / 24)}j`, short: `${Math.floor(h / 24)}j`, urgent: false, color: 'var(--text-3)' };
}

function getSignal(lot: Lot): { label: string; color: string; bg: string; border: string } {
  const pct = lot.pct_below_low_estimate ?? 0;
  const score = lot.deal_score ?? 0;
  if (pct >= 40) return { label: 'Forte décote',          color: '#22c55e', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.22)' };
  if (pct >= 25) return { label: 'Décote significative',  color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.18)' };
  if (score >= 80) return { label: 'Opportunité identifiée', color: '#C6A85A', bg: 'rgba(198,168,90,0.10)', border: 'rgba(198,168,90,0.25)' };
  if (score >= 70) return { label: 'Forte demande',        color: '#38bdf8', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.20)' };
  if (score >= 60) return { label: 'Marché solide',        color: '#94a3b8', bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.18)' };
  return                  { label: 'À surveiller',         color: '#6b7280', bg: 'rgba(107,114,128,0.05)', border: 'rgba(107,114,128,0.15)' };
}

function priorityScore(lot: Lot): number {
  return (lot.deal_score || 0) + (lot.pct_below_low_estimate ? lot.pct_below_low_estimate * 0.6 : 0);
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

  const now = Date.now();
  // Strip already-ended lots
  const activeLots = lots.filter(l => !l.auction_date || new Date(l.auction_date).getTime() > now);

  // Top picks — best by composite priority score, max 5
  const byPriority = [...activeLots].sort((a, b) => priorityScore(b) - priorityScore(a));
  const TOP_N = Math.min(5, activeLots.length);
  const topPicks = byPriority.slice(0, TOP_N);
  const topPickIds = new Set(topPicks.map(l => l.id));

  // Remaining — chronological
  const remaining = activeLots
    .filter(l => !topPickIds.has(l.id))
    .sort((a, b) => {
      if (!a.auction_date) return 1;
      if (!b.auction_date) return -1;
      return new Date(a.auction_date).getTime() - new Date(b.auction_date).getTime();
    });

  const larryCount = activeLots.filter(l =>
    (l.deal_score && l.deal_score >= 60) || (l.pct_below_low_estimate && l.pct_below_low_estimate >= 20)
  ).length;

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px 80px' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px' }}>
          Nautilus · Dernière chance
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, color: 'var(--navy)', lineHeight: 1.2, margin: '0 0 8px' }}>
          Clôtures dans les 48 prochaines heures
        </h1>
        {!loading && activeLots.length > 0 && (
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
            {activeLots.length} lot{activeLots.length !== 1 ? 's' : ''} en cours · dernière chance d'enchérir
          </p>
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
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                letterSpacing: '0.08em', color: 'var(--gold)', flexShrink: 0,
              }}>
                ◆ LARRY
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text)', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                {larryCount > 0
                  ? `Larry a identifié ${larryCount} opportunité${larryCount > 1 ? 's' : ''} qui mérite${larryCount > 1 ? 'nt' : ''} votre attention avant leur clôture.`
                  : `${activeLots.length} lot${activeLots.length > 1 ? 's' : ''} clôture${activeLots.length > 1 ? 'nt' : ''} dans les 48h — voici ceux à surveiller en priorité.`
                }
              </span>
            </div>

            {/* Premium cards */}
            {topPicks.length > 0 && (
              <div style={{
                border: '1px solid rgba(198,168,90,0.22)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                overflow: 'hidden',
              }}>
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

          {/* ── Section 2 : Toutes les clôtures ───────────────────────────── */}
          {remaining.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em',
                  color: 'var(--text-3)', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                  Toutes les clôtures — {remaining.length} lot{remaining.length !== 1 ? 's' : ''}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {remaining.map(lot => (
                  <CompactRow
                    key={lot.id}
                    lot={lot}
                    onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                  />
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
  const time = lot.auction_date ? timeInfo(lot.auction_date) : null;
  const signal = getSignal(lot);
  const price = lot.current_price || lot.estimate_low;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        display: 'flex',
        cursor: 'pointer',
        background: 'var(--bg-card)',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
    >
      {/* Image */}
      <div style={{
        width: '110px', height: '110px', flexShrink: 0,
        background: 'var(--bg-subtle)', overflow: 'hidden', position: 'relative',
      }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.88 }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)', fontSize: '24px' }}>◇</div>
        }
      </div>

      {/* Content */}
      <div style={{
        flex: 1, padding: '14px 20px', minWidth: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        {/* Top row: artist / title / signal */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '10px' }}>
          <div style={{ minWidth: 0 }}>
            {lot.artist_name_raw && (
              <div style={{
                fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
                color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '4px',
              }}>
                {lot.artist_name_raw}
              </div>
            )}
            <div style={{
              fontSize: '14px', fontFamily: 'var(--font-serif)', color: 'var(--navy)',
              fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {lot.title || 'Sans titre'}
            </div>
          </div>
          <span style={{
            flexShrink: 0, fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700,
            letterSpacing: '0.08em', color: signal.color, background: signal.bg,
            border: `1px solid ${signal.border}`, borderRadius: '3px', padding: '3px 9px',
            whiteSpace: 'nowrap',
          }}>
            {signal.label.toUpperCase()}
          </span>
        </div>

        {/* Bottom row: price / estimate / house / countdown */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>Mise actuelle</div>
            <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--navy)' }}>{fmt(price)}</div>
          </div>

          {lot.estimate_low && price !== lot.estimate_low && (
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>Estimation basse</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textDecoration: 'line-through' }}>{fmt(lot.estimate_low)}</span>
                {lot.pct_below_low_estimate && lot.pct_below_low_estimate > 0 && (
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#22c55e', fontWeight: 700 }}>
                    -{lot.pct_below_low_estimate.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          )}

          {lot.auction_house_name && (
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>Maison de vente</div>
              <div style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{lot.auction_house_name}</div>
            </div>
          )}

          {/* Countdown — pushed right */}
          {time && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '2px' }}>Clôture</div>
              <div style={{
                fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: time.color, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end',
              }}>
                {time.urgent && <span>⚡</span>}
                {time.label}
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
  const time = lot.auction_date ? timeInfo(lot.auction_date) : null;
  const signal = getSignal(lot);
  const price = lot.current_price || lot.estimate_low;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
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
        flexShrink: 0, fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700,
        letterSpacing: '0.07em', color: signal.color, background: signal.bg,
        border: `1px solid ${signal.border}`, borderRadius: '2px', padding: '2px 7px',
        whiteSpace: 'nowrap',
      }}>
        {signal.label.toUpperCase()}
      </span>

      {/* Price + discount */}
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '72px' }}>
        <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--navy)' }}>
          {fmt(price)}
        </div>
        {lot.pct_below_low_estimate && lot.pct_below_low_estimate > 0 && (
          <div style={{ fontSize: '10px', color: '#22c55e', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            -{lot.pct_below_low_estimate.toFixed(0)}%
          </div>
        )}
      </div>

      {/* Countdown */}
      {time && (
        <div style={{ flexShrink: 0, minWidth: '120px', textAlign: 'right' }}>
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
      <div style={{
        border: '1px solid rgba(198,168,90,0.22)', borderRadius: '8px', overflow: 'hidden',
        marginBottom: '48px',
      }}>
        {/* Banner skeleton */}
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
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--navy)', marginBottom: '8px' }}>
        Aucune vente imminente
      </div>
      <div style={{ fontSize: '13px' }}>Aucune vente ne clôture dans les 48 prochaines heures.</div>
    </div>
  );
}
