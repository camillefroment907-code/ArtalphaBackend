import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getToken, getUserPlan } from '../../lib/auth';
import { useSEO } from '../../lib/useSEO';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

interface LotSummary {
  id: string;
  title: string;
  artist_name_raw: string | null;
  deal_score: number | null;
  current_price: number | null;
  estimate_low: number | null;
  estimate_high: number | null;
  image_url: string | null;
  auction_date: string | null;
  category: string | null;
  currency: string | null;
}

interface HouseEntry {
  house: string;
  lot_count: number;
  avg_score: number;
  max_score: number;
  dates: string[];
  top_lots: LotSummary[];
}

interface DateEntry {
  date: string;
  urgent: boolean;
  lot_count: number;
  avg_score: number;
  houses: string[];
  top_lots: LotSummary[];
}

interface CalendarData {
  total_lots: number;
  days: number;
  by_house: HouseEntry[];
  by_date: DateEntry[];
}

const DAY_OPTIONS = [7, 14, 30, 60];

function fmtPrice(price: number | null, currency: string | null) {
  if (!price) return '—';
  const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  if (price >= 1000) return `${sym}${(price / 1000).toFixed(0)}k`;
  return `${sym}${price.toLocaleString()}`;
}

function fmtDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function ScoreBadge({ score }: { score: number | null }) {
  if (!score) return null;
  const color = score >= 80 ? 'var(--gold)' : score >= 65 ? 'var(--electric)' : 'var(--text-3)';
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
      color, background: 'transparent', padding: '2px 0',
    }}>
      {Math.round(score)}
    </span>
  );
}

function LotThumb({ lot, onClick }: { lot: LotSummary; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 10px', borderRadius: '6px',
        cursor: 'pointer', transition: 'background 0.12s',
        borderBottom: '1px solid var(--border)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {lot.image_url ? (
        <img
          src={lot.image_url}
          alt={lot.title}
          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: '40px', height: '40px', background: 'var(--bg-subtle)', borderRadius: '4px', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.artist_name_raw || lot.title}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.artist_name_raw ? lot.title : lot.category || ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '2px' }}>
        <ScoreBadge score={lot.deal_score} />
        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {fmtPrice(lot.estimate_low, lot.currency)}
        </span>
      </div>
    </div>
  );
}

function HouseCard({ entry, onLotClick }: { entry: HouseEntry; onLotClick: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '10px', overflow: 'hidden',
    }}>
      <div
        style={{
          padding: '14px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '12px',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{entry.house}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
            {entry.lot_count} lots · {entry.dates.slice(0, 3).map(fmtDate).join(', ')}
            {entry.dates.length > 3 ? ` +${entry.dates.length - 3} more` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {entry.max_score >= 75 && (
            <span style={{
              padding: '2px 7px', borderRadius: '4px',
              background: 'var(--gold-subtle, rgba(234,179,8,0.1))',
              border: '1px solid var(--gold)',
              fontSize: '10px', fontWeight: 700, color: 'var(--gold)',
              fontFamily: 'var(--font-mono)',
            }}>
              ◆ {Math.round(entry.max_score)}
            </span>
          )}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            style={{ transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none', opacity: 0.4 }}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {expanded && (
        <div>
          {entry.top_lots.map(lot => (
            <LotThumb key={lot.id} lot={lot} onClick={() => onLotClick(lot.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DateRow({ entry, onLotClick }: { entry: DateEntry; onLotClick: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: entry.urgent ? 'rgba(239,68,68,0.03)' : 'var(--bg-card)',
      border: `1px solid ${entry.urgent ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
      borderRadius: '10px', overflow: 'hidden',
    }}>
      <div
        style={{
          padding: '14px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '12px',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ flexShrink: 0, width: '52px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: entry.urgent ? '#EF4444' : 'var(--navy)', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
            {new Date(entry.date).getDate()}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {new Date(entry.date).toLocaleDateString('en-GB', { month: 'short' })}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {entry.urgent && (
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#EF4444', fontFamily: 'var(--font-mono)' }}>URGENT</span>
            )}
            {entry.houses.slice(0, 3).map(h => (
              <span key={h} style={{
                padding: '1px 6px', borderRadius: '3px',
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                fontSize: '10px', color: 'var(--text-2)',
              }}>{h}</span>
            ))}
            {entry.houses.length > 3 && (
              <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>+{entry.houses.length - 3}</span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
            {entry.lot_count} lots · avg score {entry.avg_score}
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          style={{ transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none', opacity: 0.4, flexShrink: 0 }}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {expanded && (
        <div>
          {entry.top_lots.map(lot => (
            <LotThumb key={lot.id} lot={lot} onClick={() => onLotClick(lot.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AuctionCalendar() {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');
  useSEO({
    title: isFr ? "Calendrier des Enchères — Nautilus" : "Auction Calendar — Nautilus",
    description: isFr ? "Ventes à venir chez Christie's, Sotheby's, Drouot et 50+ maisons." : "Upcoming sales at Christie's, Sotheby's, Drouot and 50+ houses.",
  });
  const nav = useNavigate();
  const [days, setDays] = useState(30);
  const [view, setView] = useState<'houses' | 'dates'>('houses');
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const plan = getUserPlan();
  const hasAccess = ["investor", "pro", "institutional"].includes(plan);

  useEffect(() => {
    setLoading(true);
    const token = getToken();
    fetch(`${BACKEND}/api/lots/calendar?days=${days}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  const urgentCount = data?.by_date.filter(d => d.urgent).reduce((s, d) => s + d.lot_count, 0) ?? 0;

  return (
    <div style={{ padding: '0', maxWidth: '900px', margin: '0 auto' }}>
      {/* Hero section */}
      <div style={{ padding: '40px 32px 32px', borderBottom: '1px solid var(--border)', marginBottom: '28px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '10px' }}>
          {t('calendar.sectionLabel')}
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 8px', letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)' }}>
          {t('calendar.title')}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: '0 0 24px', lineHeight: 1.6, maxWidth: '560px' }}>
          {t('calendar.subtitle')}
        </p>
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
          {[
            { label: t('calendar.statLiveLots'), value: data ? `${data.total_lots.toLocaleString()}` : '—' },
            { label: t('calendar.statClosingSoon'), value: urgentCount > 0 ? `${urgentCount}` : '0', urgent: urgentCount > 0 },
            { label: t('calendar.statHouses'), value: data ? `${data.by_house.length}` : '—' },
          ].map(({ label, value, urgent }) => (
            <div key={label}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: urgent ? '#EF4444' : 'var(--navy)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px', letterSpacing: '0.04em' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', padding: '0 32px' }}>
        {/* Day range */}
        <div style={{ display: 'flex', gap: '4px', ...(!hasAccess ? { pointerEvents: 'none' as const, opacity: 0.4 } : {}) }}>
          {DAY_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '5px 12px',
                fontSize: '12px', fontWeight: days === d ? 600 : 400,
                fontFamily: 'var(--font-mono)',
                background: days === d ? '#2563EB' : 'var(--bg-subtle)',
                color: days === d ? '#fff' : 'var(--text-2)',
                border: `1px solid ${days === d ? '#2563EB' : 'var(--border)'}`,
                borderRadius: '6px', cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto', ...(!hasAccess ? { pointerEvents: 'none' as const, opacity: 0.4 } : {}) }}>
          {(['houses', 'dates'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '5px 14px',
                fontSize: '12px', fontWeight: view === v ? 600 : 400,
                background: view === v ? 'var(--electric-subtle)' : 'transparent',
                color: view === v ? 'var(--electric)' : 'var(--text-2)',
                border: `1px solid ${view === v ? 'var(--electric-border)' : 'var(--border)'}`,
                borderRadius: '6px', cursor: 'pointer',
                transition: 'all 0.12s',
                textTransform: 'capitalize',
              }}
            >
              {v === 'houses' ? t('calendar.viewByHouse') : t('calendar.viewByDate')}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 32px 32px' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
            {t('calendar.loading')}
          </div>
        ) : !data || (view === 'houses' ? data.by_house.length === 0 : data.by_date.length === 0) ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
            {t('calendar.noAuctions')}
          </div>
        ) : view === 'houses' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {(!hasAccess ? data.by_house.slice(0, 6) : data.by_house).map(entry => (
                <HouseCard
                  key={entry.house}
                  entry={entry}
                  onLotClick={id => nav(`/app/explore?lot=${id}`)}
                />
              ))}
            </div>
            {!hasAccess && (
              <div style={{ marginTop: '-40px' }}>
                <div style={{ height: '80px', background: 'linear-gradient(to bottom, transparent, var(--bg))' }} />
                <div style={{ textAlign: 'center', padding: '48px 24px', background: '#f8f8f6', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, letterSpacing: '0.15em', color: '#C6A85A', marginBottom: 8 }}>{t('calendar.paywallTitle')}</div>
                  <div style={{ fontSize: 20, fontFamily: 'Georgia,serif', color: '#1A2A44', marginBottom: 16 }}>{t('calendar.paywallSub')}</div>
                  <a href="/app/pricing" style={{ background: '#2563EB', color: '#fff', padding: '12px 28px', fontSize: 13, fontWeight: 600, textDecoration: 'none', borderRadius: 4 }}>{t('calendar.paywallCta')}</a>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(!hasAccess ? data.by_date.slice(0, 6) : data.by_date).map(entry => (
                <DateRow
                  key={entry.date}
                  entry={entry}
                  onLotClick={id => nav(`/app/explore?lot=${id}`)}
                />
              ))}
            </div>
            {!hasAccess && (
              <div style={{ marginTop: '-40px' }}>
                <div style={{ height: '80px', background: 'linear-gradient(to bottom, transparent, var(--bg))' }} />
                <div style={{ textAlign: 'center', padding: '48px 24px', background: '#f8f8f6', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, letterSpacing: '0.15em', color: '#C6A85A', marginBottom: 8 }}>{t('calendar.paywallTitle')}</div>
                  <div style={{ fontSize: 20, fontFamily: 'Georgia,serif', color: '#1A2A44', marginBottom: 16 }}>{t('calendar.paywallSub')}</div>
                  <a href="/app/pricing" style={{ background: '#2563EB', color: '#fff', padding: '12px 28px', fontSize: 13, fontWeight: 600, textDecoration: 'none', borderRadius: 4 }}>{t('calendar.paywallCta')}</a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
