import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';
import { CopilotBar } from '../components/CopilotBar';
import { parseUTC, isLiveLot, timeLabel, isActiveAuction } from '../../lib/auction';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LotCard {
  id: string;
  title: string | null;
  artist_name_raw: string | null;
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

interface TopPickCard {
  rec_type: string;
  score: number;
  reason: string;
  lot: LotCard;
}

interface Brief {
  since: string;
  generated_at: string;
  new_lots_count: number;
  closing_today_count: number;
  new_lots: LotCard[];
  closing_soon: LotCard[];
  top_picks: TopPickCard[];
  top_deal: LotCard | null;
  agent_unread: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [v, setV] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setV(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return v;
}

function useIsDesktop() {
  const [v, setV] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const h = () => setV(window.innerWidth >= 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return v;
}

function fmt(n: number | null | undefined) {
  if (!n) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n);
}

function hoursLeft(iso: string): number {
  return (parseUTC(iso) - Date.now()) / 3600000;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function formatSince(iso: string): string {
  const ms = Date.now() - parseUTC(iso);
  const h = Math.floor(ms / 3600000);
  if (h < 2)  return 'la dernière heure';
  if (h < 24) return `${h}\u202fheures`;
  if (h < 48) return 'hier';
  return `${Math.floor(h / 24)}\u202fjours`;
}

// ─── Larry reasoning engine (pure frontend, zero API calls) ──────────────────

const REC_TYPE_LABELS: Record<string, string> = {
  deal_alert:     "Signal d'achat",
  artist_momentum:'Artiste suivi',
  category_match: 'Votre catégorie',
  below_estimate: "Sous l'estimation",
  distressed_sale:'Vente distressed',
  budget_match:   'Votre budget',
  new_to_auction: 'Nouvelle entrée',
  closing_soon:   'Urgence',
  trophy_lot:     'Lot prestige',
  emerging_artist:'Artiste émergent',
};

const REC_TYPE_COLORS: Record<string, string> = {
  deal_alert:     '#3b82f6',
  artist_momentum:'#8b5cf6',
  category_match: '#0ea5e9',
  below_estimate: '#C6A85A',
  distressed_sale:'#ef4444',
  budget_match:   '#22c55e',
  new_to_auction: '#f97316',
  closing_soon:   '#ef4444',
  trophy_lot:     '#C6A85A',
  emerging_artist:'#8b5cf6',
};

/** Returns pill style based on signal category */
function signalPillStyle(signal: string) {
  const isUrgency  = signal.includes('h restantes') || signal.includes('Enchères');
  const isPersonal = ['Artiste suivi', 'Votre catégorie', 'Dans votre budget', 'Votre période'].includes(signal);
  if (isUrgency)  return { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.28)',  color: '#ef4444'  };
  if (isPersonal) return { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.28)', color: '#3b82f6'  };
  return           { bg: 'rgba(198,168,90,0.12)',  border: 'rgba(198,168,90,0.35)',  color: '#A07830'  };
}

/** Personalization + urgency signals shown as ✓ pills on each conviction */
function buildSignals(lot: LotCard, recType: string): string[] {
  const signals: string[] = [];

  if (recType === 'artist_momentum') signals.push('Artiste suivi');
  if (recType === 'category_match')  signals.push('Votre catégorie');
  if (recType === 'budget_match')    signals.push('Dans votre budget');
  if (recType === 'period_match')    signals.push('Votre période');

  const h = lot.auction_date ? hoursLeft(lot.auction_date) : null;
  if (isLiveLot(lot.status))              signals.push('Enchères en cours');
  else if (h !== null && h > 0 && h < 24) signals.push('< 24\u202fh restantes');
  else if (h !== null && h > 0 && h < 48) signals.push('< 48\u202fh restantes');

  if (lot.pct_below_low_estimate && lot.pct_below_low_estimate >= 20)
    signals.push('Forte décote');
  else if (lot.pct_below_low_estimate && lot.pct_below_low_estimate >= 10)
    signals.push('Sous estimation');

  if (lot.deal_score && lot.deal_score >= 80) signals.push('Score fort');

  return signals.slice(0, 3);
}

/** Short conviction phrase — context-aware per rec_type */
function buildPhrase(lot: LotCard, recType?: string): string {
  const pct  = lot.pct_below_low_estimate;
  const h    = lot.auction_date ? hoursLeft(lot.auction_date) : null;
  const live = isLiveLot(lot.status);

  if (recType === 'artist_momentum') {
    if (pct && pct >= 15)
      return `Cet artiste correspond à votre profil — ${Math.round(pct)}\u202f% sous son estimation. Une combinaison rare.`;
    return `Artiste dans vos intérêts. Opportunité d'acquisition au bon moment du cycle de marché.`;
  }
  if (recType === 'category_match') {
    if (pct && pct >= 10)
      return `Votre catégorie préférée, avec une décote de ${Math.round(pct)}\u202f% sur l'estimation. Point d'entrée favorable.`;
    return `Catégorie correspondant à vos préférences. Meilleur rapport valeur/prix disponible actuellement.`;
  }
  if (recType === 'budget_match') {
    return `Dans votre fourchette habituelle. Le score et la décote visible en font une opportunité concrète maintenant.`;
  }
  if (recType === 'trophy_lot') {
    return `Potentiel de valorisation significatif. Parmi les acquisitions les plus stratégiques du moment.`;
  }
  if (recType === 'emerging_artist') {
    return `Prix d'entrée accessible sur un artiste en développement. Ce type de position précoce génère des rendements asymétriques.`;
  }
  if (pct && pct >= 20 && h !== null && h > 0 && h < 48) {
    return `Anomalie de prix\u202f: ${Math.round(pct)}\u202f% sous estimation${live ? ', enchères en cours' : ''}. La fenêtre se referme.`;
  }
  if (pct && pct >= 20) {
    return `${Math.round(pct)}\u202f% sous l'estimation basse — anomalie corrigée par le marché dans les 72\u202fh suivant la vente.`;
  }
  if (pct && pct >= 10) {
    return `Sous l'estimation de ${Math.round(pct)}\u202f% — rapport valeur/risque parmi les plus favorables du moment.`;
  }
  if (h !== null && h > 0 && h < 24) {
    return `Clôture dans moins de 24\u202fh. Parmi les opportunités les plus singulières de la semaine à ce prix.`;
  }
  return `Sélectionné pour son rapport valeur/prix sur le marché actuel.`;
}

/** Larry's actionable verdict on each conviction */
function buildVerdict(lot: LotCard, recType?: string): string {
  const pct  = lot.pct_below_low_estimate;
  const h    = lot.auction_date ? hoursLeft(lot.auction_date) : null;
  const live = isLiveLot(lot.status);

  if (h !== null && h > 0 && h < 6)  return "Décision dans l'heure. Je n'attendrais pas.";
  if (h !== null && h > 0 && h < 24) return 'Décision à prendre aujourd\'hui. Passé ce délai, la fenêtre se ferme.';
  if (pct && pct >= 25 && lot.estimate_low) {
    const target = Math.round(lot.estimate_low * 0.88 / 50) * 50;
    return `J'essaierais d'obtenir ce lot sous\u00a0${fmt(target)}.`;
  }
  if (pct && pct >= 15) return 'Le rapport valeur/prix est favorable. Je ne dépasserais pas l\'estimation basse.';
  if (recType === 'artist_momentum') return 'Artiste dans votre radar. Une entrée à considérer sérieusement maintenant.';
  if (recType === 'category_match')  return 'Correspond à votre profil. Point d\'entrée dans une catégorie que vous suivez.';
  if (live) return 'Enchères en cours. Je suivrais l\'évolution du prix en temps réel.';
  return 'Position intéressante. Je surveille cette vente.';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Section label with optional icon + accent color.
 * Each section gets a distinct visual identity via icon and colored separator.
 */
function SectionLabel({
  children, icon, accent, action,
}: {
  children: string;
  icon?: string;
  accent?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
      {icon && (
        <span style={{
          fontSize: '11px', color: accent || 'var(--text-3)',
          lineHeight: 1, flexShrink: 0, fontWeight: 700,
        }}>
          {icon}
        </span>
      )}
      <span style={{
        fontSize: '10px', fontFamily: 'var(--font-mono)',
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: accent || 'var(--text-3)', flexShrink: 0, fontWeight: 700,
      }}>
        {children}
      </span>
      <span style={{
        flex: 1, height: '1px',
        background: accent ? `color-mix(in srgb, ${accent} 25%, transparent)` : 'var(--border)',
      }} />
      {action}
    </div>
  );
}

/** Conviction card — vertical, with top accent bar + colored signal pills */
function ConvictionCard({
  pick, onClick,
}: {
  pick: TopPickCard; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const lot       = pick.lot;
  const live      = isLiveLot(lot.status);
  const time      = lot.auction_date ? timeLabel(lot.auction_date, live) : null;
  const phrase    = buildPhrase(lot, pick.rec_type);
  const verdict   = buildVerdict(lot, pick.rec_type);
  const signals   = buildSignals(lot, pick.rec_type);
  const typeLabel = REC_TYPE_LABELS[pick.rec_type] || 'Opportunité';
  const typeColor = REC_TYPE_COLORS[pick.rec_type] || '#3b82f6';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FAFAF8',
        border: `1px solid ${hovered ? 'rgba(26,42,68,0.22)' : 'rgba(26,42,68,0.10)'}`,
        borderTop: `3px solid ${typeColor}`,
        borderRadius: '8px',
        padding: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column',
        boxShadow: hovered
          ? '0 6px 24px rgba(26,42,68,0.10)'
          : '0 1px 4px rgba(26,42,68,0.05)',
      }}
    >
      {/* ── Image banner — full-width, artwork visible ── */}
      <div style={{
        width: '100%', height: '190px',
        overflow: 'hidden', flexShrink: 0,
        background: 'rgba(26,42,68,0.07)',
        position: 'relative',
      }}>
        {lot.image_url
          ? <img
              src={lot.image_url} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
            />
          : <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(26,42,68,0.15)', fontSize: '36px',
            }}>◇</div>
        }
        {/* Badges overlaid on image */}
        <div style={{
          position: 'absolute', bottom: '10px', left: '10px', right: '10px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '6px',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: typeColor,
            background: 'rgba(10,18,36,0.72)', backdropFilter: 'blur(6px)',
            padding: '3px 8px', borderRadius: '3px',
          }}>
            {typeLabel}
          </span>
          {time && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
              color: time.color,
              background: 'rgba(10,18,36,0.72)', backdropFilter: 'blur(6px)',
              padding: '3px 8px', borderRadius: '3px', flexShrink: 0,
            }}>
              {time.urgent && '⚡ '}{time.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Content section ── */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Identity: artist + title + house */}
        <div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600,
            color: 'var(--navy)', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {lot.artist_name_raw || '—'}
          </div>
          {lot.title && (
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: '11px',
              color: 'var(--text-3)', fontStyle: 'italic',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginTop: '2px',
            }}>
              {lot.title}
            </div>
          )}
          {lot.auction_house_name && (
            <div style={{
              fontSize: '10px', color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)', marginTop: '3px', letterSpacing: '0.04em',
            }}>
              {lot.auction_house_name}
            </div>
          )}
        </div>

      {/* ── Conviction phrase — left accent border + subtle tint ── */}
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: '12px',
        color: 'var(--navy)', lineHeight: 1.65,
        borderLeft: `2px solid ${typeColor}`,
        paddingLeft: '10px',
        background: `${typeColor}07`,
        borderRadius: '0 4px 4px 0',
        padding: '7px 10px',
      }}>
        {phrase}
      </div>

      {/* ── Personalization signals — color-coded pills ── */}
      {signals.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {signals.map(s => {
            const ps = signalPillStyle(s);
            return (
              <span key={s} style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.05em',
                color: ps.color,
                background: ps.bg,
                border: `1px solid ${ps.border}`,
                padding: '2px 8px', borderRadius: '20px',
              }}>
                ✓ {s}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Larry verdict — gold ✦ icon signals it's Larry speaking ── */}
      <div style={{
        display: 'flex', gap: '7px', alignItems: 'flex-start',
        fontFamily: 'var(--font-serif)', fontSize: '12px',
        fontStyle: 'italic', lineHeight: 1.6,
      }}>
        <span style={{ color: 'var(--gold)', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>✦</span>
        <span style={{ color: 'rgba(26,42,68,0.75)' }}>"{verdict}"</span>
      </div>

      {/* ── Footer: price + CTA ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid rgba(26,42,68,0.08)', paddingTop: '11px', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--navy)' }}>
            {fmt(lot.current_price || lot.estimate_low)}
          </span>
          {lot.pct_below_low_estimate && lot.pct_below_low_estimate >= 10 && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
              color: '#A07830',
              background: 'rgba(198,168,90,0.12)',
              border: '1px solid rgba(198,168,90,0.30)',
              padding: '1px 6px', borderRadius: '3px',
            }}>
              −{Math.round(lot.pct_below_low_estimate)}%
            </span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onClick(); }}
          style={{
            padding: '6px 14px',
            background: hovered ? 'var(--navy)' : 'rgba(26,42,68,0.06)',
            border: '1px solid rgba(26,42,68,0.2)',
            color: hovered ? '#fff' : 'var(--navy)',
            borderRadius: '4px', fontSize: '11px', fontWeight: 600,
            cursor: 'pointer', letterSpacing: '0.04em',
            fontFamily: 'var(--font-mono)', transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          Analyser →
        </button>
      </div>

      </div>{/* end content section */}
    </div>
  );
}

/** Expiring lot — real card with urgency color coding (left border + tinted background) */
function ExpiringRow({ lot, onClick }: { lot: LotCard; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const live = isLiveLot(lot.status);
  const time = lot.auction_date ? timeLabel(lot.auction_date, live) : null;
  const h    = lot.auction_date ? hoursLeft(lot.auction_date) : null;

  const action =
    h !== null && h > 0 && h < 6  ? 'Décision urgente' :
    h !== null && h > 0 && h < 24 ? 'À décider aujourd\'hui' :
    'À surveiller';

  const urgencyColor  =
    h !== null && h > 0 && h < 6  ? '#ef4444' :
    h !== null && h > 0 && h < 24 ? '#f97316' :
    'rgba(26,42,68,0.3)';
  const urgencyBg     =
    h !== null && h > 0 && h < 6  ? 'rgba(239,68,68,0.05)' :
    h !== null && h > 0 && h < 24 ? 'rgba(249,115,22,0.04)' :
    'transparent';
  const urgencyBorder =
    h !== null && h > 0 && h < 6  ? 'rgba(239,68,68,0.18)' :
    h !== null && h > 0 && h < 24 ? 'rgba(249,115,22,0.18)' :
    'rgba(26,42,68,0.08)';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 11px',
        background: hovered ? 'rgba(26,42,68,0.04)' : urgencyBg,
        border: `1px solid ${urgencyBorder}`,
        borderLeft: `3px solid ${urgencyColor}`,
        borderRadius: '6px',
        marginBottom: '7px',
        cursor: 'pointer', transition: 'background 0.12s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--navy)',
          fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lot.artist_name_raw || '—'}
        </div>
        <div style={{
          fontSize: '10px', color: urgencyColor, marginTop: '1px',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', fontWeight: 600,
        }}>
          {action}
        </div>
      </div>
      {time && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
          color: time.color, flexShrink: 0,
        }}>
          {time.urgent && '⚡ '}{time.label}
        </div>
      )}
    </div>
  );
}

/** New signal row — colored dot + signal badge, information-first */
function SignalRow({ lot, onClick }: { lot: LotCard; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const live   = isLiveLot(lot.status);
  const time   = lot.auction_date ? timeLabel(lot.auction_date, live) : null;
  const hasPct = lot.pct_below_low_estimate && lot.pct_below_low_estimate >= 10;
  const hasScore = !hasPct && lot.deal_score && lot.deal_score >= 70;

  const signal =
    hasPct   ? `−${Math.round(lot.pct_below_low_estimate!)}% sous estimation` :
    hasScore ? `Score\u00a0${lot.deal_score}/100` :
    'Nouveau lot analysé';

  const signalColor =
    hasPct   ? '#A07830' :
    hasScore ? '#8b5cf6' :
    'var(--text-3)';
  const signalBg =
    hasPct   ? 'rgba(198,168,90,0.10)' :
    hasScore ? 'rgba(139,92,246,0.10)' :
    'rgba(26,42,68,0.05)';
  const dotColor =
    hasPct   ? '#C6A85A' :
    hasScore ? '#8b5cf6' :
    'rgba(26,42,68,0.2)';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 0',
        borderBottom: '1px solid rgba(26,42,68,0.07)',
        cursor: 'pointer',
        opacity: hovered ? 0.72 : 1,
        transition: 'opacity 0.12s',
      }}
    >
      {/* Colored dot indicator */}
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: dotColor, flexShrink: 0,
      }} />

      {/* Artist + house */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
          color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lot.artist_name_raw || '—'}
        </span>
        {lot.auction_house_name && (
          <span style={{ fontSize: '11px', color: 'var(--text-3)', flexShrink: 0 }}>
            · {lot.auction_house_name}
          </span>
        )}
      </div>

      {/* Signal badge + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
          color: signalColor, background: signalBg,
          padding: '2px 7px', borderRadius: '3px',
          letterSpacing: '0.04em',
        }}>
          {signal}
        </span>
        {time && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: time.color, fontWeight: 600,
          }}>
            {time.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const navigate  = useNavigate();
  const isMobile  = useIsMobile();
  const isDesktop = useIsDesktop();
  const [brief, setBrief]     = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${BACKEND}/api/recommendations/market-brief`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setBrief(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--text-3)',
          animation: 'todayFade 1.6s ease-in-out infinite',
        }}>
          Analyse en cours…
        </span>
        <style>{'@keyframes todayFade{0%,100%{opacity:0.2}50%{opacity:0.8}}'}</style>
      </div>
    );
  }

  if (!brief) {
    return (
      <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--navy)' }}>Indisponible pour le moment</div>
        <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>Veuillez réessayer dans quelques instants.</div>
      </div>
    );
  }

  const convictions: TopPickCard[] = (brief.top_picks || []).length
    ? (brief.top_picks || []).slice(0, 3)
    : brief.top_deal
      ? [{ rec_type: 'deal_alert', score: brief.top_deal.deal_score ?? 70, reason: '', lot: brief.top_deal }]
      : [];

  const expiringLots = brief.closing_soon
    .filter(l => isActiveAuction(l.auction_date))
    .slice(0, 5);

  const topConviction = convictions[0]?.lot ?? brief.top_deal ?? null;

  const convictionCols = isMobile ? '1fr' : isDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)';
  const signalCols     = isMobile ? '1fr' : 'repeat(2, 1fr)';

  return (
    <main style={{
      maxWidth: '1440px', margin: '0 auto',
      padding: isMobile ? '24px 16px 72px' : '36px 48px 88px',
    }}>
      <style>{'@keyframes todayFade{0%,100%{opacity:0.2}50%{opacity:0.8}}'}</style>

      {/* ── ZONE 0: Header ────────────────────────────────────────────────── */}
      <div style={{
        marginBottom: isMobile ? '28px' : '32px',
        paddingBottom: isMobile ? '20px' : '24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'flex-end',
        justifyContent: 'space-between', gap: '16px',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--text-3)', marginBottom: '10px',
          }}>
            {formatDate(brief.generated_at)}
          </div>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: isMobile ? '17px' : '20px',
            color: 'var(--navy)', lineHeight: 1.45,
          }}>
            {convictions.length > 0
              ? <>
                  Parmi{' '}
                  <span style={{ fontWeight: 500 }}>{brief.new_lots_count.toLocaleString('fr-FR')}</span>
                  {' '}lots analysés depuis {formatSince(brief.since)},{' '}
                  Larry a retenu{' '}
                  <span style={{ color: 'var(--gold)', fontWeight: 500 }}>
                    {convictions.length} décision{convictions.length > 1 ? 's' : ''}
                  </span>
                  {' '}pour vous.
                </>
              : <>Nautilus a passé en revue le marché depuis {formatSince(brief.since)}.</>
            }
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
          {(brief.closing_today_count ?? 0) > 0 && (
            <button
              onClick={() => navigate('/app/urgent')}
              style={{
                background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.32)',
                color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: '10px',
                fontWeight: 700, letterSpacing: '0.08em',
                padding: '5px 14px', borderRadius: '20px', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ⚡ {brief.closing_today_count} vente{(brief.closing_today_count ?? 0) > 1 ? 's' : ''} urgente{(brief.closing_today_count ?? 0) > 1 ? 's' : ''}
            </button>
          )}
          {brief.agent_unread > 0 && (
            <button
              onClick={() => navigate('/app/agent')}
              style={{
                background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.32)',
                color: '#3b82f6', fontFamily: 'var(--font-mono)', fontSize: '10px',
                fontWeight: 700, letterSpacing: '0.08em',
                padding: '5px 14px', borderRadius: '20px', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ◆ {brief.agent_unread} alerte{brief.agent_unread > 1 ? 's' : ''} agent
            </button>
          )}
        </div>
      </div>

      {/* ── ZONE 1: Conviction grid ─────────────────────────────────────── */}
      <div style={{ marginBottom: isMobile ? '32px' : '40px' }}>
        <SectionLabel icon="◈" accent="#C6A85A">
          Convictions du jour — Larry pour vous
        </SectionLabel>

        {convictions.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: convictionCols,
            gap: '16px',
          }}>
            {convictions.map(pick => (
              <ConvictionCard
                key={pick.lot.id}
                pick={pick}
                onClick={() => navigate(`/app/opportunities/${pick.lot.id}`)}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: '40px 0', color: 'var(--text-3)', fontSize: '13px', fontStyle: 'italic' }}>
            Aucune conviction personnalisée disponible pour le moment.
          </div>
        )}
      </div>

      {/* ── ZONE 2: Larry (left) + Sidebar (right) ─────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 300px',
        gap: isMobile ? '32px' : '48px',
        marginBottom: isMobile ? '32px' : '40px',
        alignItems: 'start',
      }}>

        {/* Larry — card with identity banner */}
        <div>
          {/* Larry identity card */}
          <div style={{
            border: '1px solid rgba(26,42,68,0.12)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}>
            {/* Banner */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '11px',
              padding: '13px 16px',
              background: 'rgba(26,42,68,0.04)',
              borderBottom: '1px solid rgba(26,42,68,0.09)',
            }}>
              {/* L monogram */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--navy)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--gold)', fontSize: '13px',
                fontFamily: 'var(--font-serif)', fontWeight: 700, flexShrink: 0,
              }}>
                L
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px', fontWeight: 600,
                  color: 'var(--navy)', fontFamily: 'var(--font-sans)',
                }}>
                  Larry
                </div>
                <div style={{
                  fontSize: '10px', color: 'var(--text-3)',
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                }}>
                  Votre analyste IA personnel
                </div>
              </div>
              {/* Online indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e',
                }} />
                <span style={{
                  fontSize: '9px', color: '#22c55e',
                  fontFamily: 'var(--font-mono)', fontWeight: 700,
                  letterSpacing: '0.06em',
                }}>
                  EN LIGNE
                </span>
              </div>
            </div>

            {/* CopilotBar */}
            <div style={{ padding: '16px' }}>
              <CopilotBar
                mode="chat"
                topDealId={topConviction?.id ?? null}
                topDealScore={topConviction?.deal_score ?? null}
                urgentCount={brief.closing_today_count ?? brief.closing_soon.length}
                sourcePage="today"
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div>

          {/* Agent alert */}
          {brief.agent_unread > 0 && (
            <div
              onClick={() => navigate('/app/agent')}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px',
                background: 'rgba(59,130,246,0.07)',
                border: '1px solid rgba(59,130,246,0.22)',
                borderLeft: '3px solid #3b82f6',
                borderRadius: '8px', cursor: 'pointer',
                marginBottom: '20px',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.07)')}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: '10px', color: '#3b82f6',
              }}>
                ◆
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)', marginBottom: '1px' }}>
                  {brief.agent_unread} alerte{brief.agent_unread > 1 ? 's' : ''} vous attendent
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                  Voir les résultats →
                </div>
              </div>
            </div>
          )}

          {/* Ce qui expire */}
          {expiringLots.length > 0 ? (
            <div>
              <SectionLabel
                icon="⚡"
                accent="#ef4444"
                action={
                  <button
                    onClick={() => navigate('/app/urgent')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '10px', color: 'var(--electric)', fontWeight: 600,
                      padding: 0, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', flexShrink: 0,
                    }}
                  >
                    Tout voir →
                  </button>
                }
              >
                Ce qui expire
              </SectionLabel>
              {expiringLots.map(lot => (
                <ExpiringRow
                  key={lot.id}
                  lot={lot}
                  onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                />
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-3)', fontSize: '11px', fontStyle: 'italic', paddingTop: '4px' }}>
              Aucune vente imminente dans les 48 prochaines heures.
            </div>
          )}
        </div>
      </div>

      {/* ── ZONE 3: Nouveaux signaux ─────────────────────────────────────── */}
      {brief.new_lots.length > 0 && (
        <div>
          <SectionLabel
            icon="↑"
            accent="#0ea5e9"
            action={
              brief.new_lots_count > brief.new_lots.length
                ? <button
                    onClick={() => navigate('/app/explore')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '10px', color: 'var(--electric)', fontWeight: 600,
                      padding: 0, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', flexShrink: 0,
                    }}
                  >
                    {brief.new_lots_count.toLocaleString('fr-FR')} au total →
                  </button>
                : undefined
            }
          >
            Nouveaux signaux détectés
          </SectionLabel>

          <div style={{
            display: 'grid',
            gridTemplateColumns: signalCols,
            gap: isMobile ? '0' : '0 40px',
          }}>
            {brief.new_lots.map(lot => (
              <SignalRow
                key={lot.id}
                lot={lot}
                onClick={() => navigate(`/app/opportunities/${lot.id}`)}
              />
            ))}
          </div>
        </div>
      )}

    </main>
  );
}
