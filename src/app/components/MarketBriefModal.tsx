import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken, getUser } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

function todayKey() {
  return `nautilus_today_${new Date().toISOString().slice(0, 10)}`;
}

// ── Types — aligned with market-brief response ────────────────────────────────

interface TopPickLot {
  id: string;
  artist_name_raw: string | null;
  title: string | null;
  deal_score: number | null;
  pct_below_low_estimate: number | null;
  image_url: string | null;
  auction_house_name: string | null;
  auction_date: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  category: string | null;
}

interface TopPick {
  rec_type: string;
  score: number;
  reason: string;
  lot: TopPickLot;
}

interface BriefSummary {
  new_lots_count: number;
  closing_soon: { id: string }[];
  closing_today_count?: number;
  agent_unread: number;
  top_picks: TopPick[];
  since: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toLocaleString('fr-FR')}`;
}

function scoreColor(score: number | null): string {
  if (!score) return '#B8922A';
  if (score >= 85) return '#C0392B';
  if (score >= 75) return '#C6A85A';
  return '#B8922A';
}

function hoursUntil(iso: string | null): number | null {
  if (!iso) return null;
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

/** Build a user-facing conviction phrase from lot data + reason string. */
function buildConvictionPhrase(pick: TopPick): string {
  const lot = pick.lot;
  const pct = lot.pct_below_low_estimate;
  const h   = hoursUntil(lot.auction_date);

  // Urgency cases take priority
  if (h !== null && h > 0 && h < 6 && pct && pct >= 10) {
    return `⚡ Clôture dans ${Math.round(h)}h — ${Math.round(pct)}% sous l'estimation.`;
  }
  if (h !== null && h > 0 && h < 24) {
    return `Vente dans moins de 24 heures. Conviction prioritaire.`;
  }

  // Use the reason string from the strategy if it's already user-friendly French
  // (preference_match / agent_match produce clean French reasons)
  if (pick.rec_type === 'preference_match' || pick.rec_type === 'agent_match') {
    if (pick.reason && !pick.reason.includes('Matches your') && !pick.reason.includes('Deal score')) {
      return pick.reason;
    }
  }

  // Fallback: build from lot data
  if (pct && pct >= 15) {
    return `${Math.round(pct)}% sous l'estimation basse — anomalie de prix rare.`;
  }
  if (pct && pct >= 8) {
    return `Parmi les meilleures opportunités valeur/risque identifiées ce jour.`;
  }
  return `Sélection prioritaire du jour.`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketBriefModal() {
  const navigate = useNavigate();
  const [brief, setBrief]       = useState<BriefSummary | null>(null);
  const [visible, setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) return;
    if (localStorage.getItem(todayKey())) return;

    const token = getToken();
    fetch(`${BACKEND}/api/recommendations/market-brief`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setBrief(data);
        setTimeout(() => setVisible(true), 800);
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    localStorage.setItem(todayKey(), '1');
    setDismissed(true);
  }

  function openConviction(lotId: string) {
    dismiss();
    navigate(`/app/opportunities/${lotId}`);
  }

  function openToday() {
    dismiss();
    navigate('/app/today');
  }

  if (!visible || dismissed || !brief) return null;

  // ── Primary conviction — top_picks[0] (personalized, same source as Today page)
  const topPick: TopPick | null = brief.top_picks?.[0] ?? null;
  if (!topPick) return null;

  const lot = topPick.lot;
  const closingCount = brief.closing_today_count ?? brief.closing_soon.length;
  const phrase = buildConvictionPhrase(topPick);
  const score  = lot.deal_score ?? topPick.score;
  const color  = scoreColor(score);
  const h      = hoursUntil(lot.auction_date);
  const isUrgent = h !== null && h > 0 && h < 24;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,18,36,0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 300,
          animation: 'briefFadeIn 0.25s ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 301,
        background: 'var(--bg-card)',
        border: '1px solid rgba(26,42,68,0.14)',
        borderRadius: '12px',
        boxShadow: '0 24px 64px rgba(10,18,36,0.28), 0 2px 8px rgba(10,18,36,0.12)',
        width: 'min(580px, calc(100vw - 32px))',
        overflow: 'hidden',
        animation: 'briefSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>

        {/* ── Artwork image — full width ─────────────────────────────────── */}
        <div style={{
          width: '100%', height: '240px',
          position: 'relative', flexShrink: 0,
          background: 'rgba(26,42,68,0.08)',
          overflow: 'hidden',
        }}>
          {lot.image_url
            ? <img
                src={lot.image_url} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
              />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(26,42,68,0.18)', fontSize: '48px' }}>◇</div>
          }

          {/* Score badge — bottom left */}
          <div style={{
            position: 'absolute', bottom: '12px', left: '14px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <div style={{
              background: 'rgba(10,18,36,0.78)', backdropFilter: 'blur(8px)',
              borderRadius: '4px', padding: '5px 10px',
              display: 'flex', alignItems: 'baseline', gap: '3px',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color, lineHeight: 1 }}>
                {Math.round(score)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>/100</span>
            </div>
            {isUrgent && (
              <div style={{
                background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(8px)',
                borderRadius: '4px', padding: '5px 10px',
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                color: 'white', letterSpacing: '0.06em',
              }}>
                ⚡ {h !== null ? `${Math.round(h)}H` : 'URGENT'}
              </div>
            )}
          </div>

          {/* Close button — top right */}
          <button
            onClick={dismiss}
            style={{
              position: 'absolute', top: '10px', right: '10px',
              background: 'rgba(10,18,36,0.55)', backdropFilter: 'blur(4px)',
              border: 'none', borderRadius: '50%',
              width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.75)', fontSize: '16px', lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div style={{ padding: '22px 26px 0' }}>

          {/* Label */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: color, marginBottom: '10px', fontWeight: 700,
          }}>
            ◈ Conviction du jour
          </div>

          {/* Artist */}
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '22px',
            color: 'var(--navy)', fontWeight: 400, lineHeight: 1.2,
            marginBottom: '4px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {lot.artist_name_raw || '—'}
          </div>

          {/* Title */}
          {lot.title && (
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: '14px',
              fontStyle: 'italic', color: 'var(--text-2)', lineHeight: 1.4,
              marginBottom: '14px',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {lot.title}
            </div>
          )}

          {/* Conviction phrase */}
          <div style={{
            fontSize: '13px', color: 'var(--text)', lineHeight: 1.65,
            marginBottom: '16px',
            padding: '11px 14px',
            background: `rgba(${color === '#C0392B' ? '192,57,43' : color === '#C6A85A' ? '198,168,90' : '184,146,42'}, 0.07)`,
            borderLeft: `3px solid ${color}`,
            borderRadius: '0 4px 4px 0',
          }}>
            {phrase}
          </div>

          {/* Meta row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            marginBottom: '20px', flexWrap: 'wrap',
          }}>
            {lot.auction_house_name && (
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                {lot.auction_house_name}
              </span>
            )}
            {(lot.estimate_low || lot.estimate_high) && (
              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                Est. {fmt(lot.estimate_low)}{lot.estimate_high ? ` – ${fmt(lot.estimate_high)}` : ''}
              </span>
            )}
            {brief.new_lots_count > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                {brief.new_lots_count.toLocaleString('fr-FR')} lots analysés
                {closingCount > 0 && <> · <span style={{ color: '#ef4444', fontWeight: 600 }}>{closingCount} urgents</span></>}
              </span>
            )}
          </div>
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div style={{
          padding: '0 26px 22px',
          display: 'flex', gap: '10px',
        }}>
          <button
            onClick={() => openConviction(lot.id)}
            onMouseEnter={e => (e.currentTarget.style.background = '#0f1f3a')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--navy)')}
            style={{
              flex: 1, padding: '12px 20px',
              background: 'var(--navy)', color: '#fff',
              border: 'none', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', letterSpacing: '0.01em',
              transition: 'background 0.15s',
            }}
          >
            Voir cette conviction →
          </button>
          <button
            onClick={openToday}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(26,42,68,0.3)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            style={{
              padding: '12px 16px',
              background: 'transparent', color: 'var(--text-2)',
              border: '1px solid var(--border)', borderRadius: '6px',
              fontSize: '13px', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'border-color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            Tout voir
          </button>
        </div>

      </div>

      <style>{`
        @keyframes briefFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes briefSlideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)) } to { opacity: 1; transform: translate(-50%, -50%) } }
      `}</style>
    </>
  );
}
