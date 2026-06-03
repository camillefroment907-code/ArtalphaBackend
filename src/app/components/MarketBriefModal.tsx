import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken, getUser } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

function todayKey() {
  return `nautilus_today_${new Date().toISOString().slice(0, 10)}`;
}

interface BriefSummary {
  new_lots_count: number;
  closing_soon: { id: string }[];
  closing_today_count?: number;
  agent_unread: number;
  top_deal: {
    artist_name_raw: string;
    title: string;
    deal_score: number;
    pct_below_low_estimate?: number;
    image_url: string;
    auction_house_name: string;
    auction_date?: string;
  } | null;
  since: string;
}

function buildModalPhrase(deal: BriefSummary['top_deal']): string {
  if (!deal) return '';
  const pct = deal.pct_below_low_estimate;
  if (deal.auction_date) {
    const h = (new Date(deal.auction_date).getTime() - Date.now()) / 3600000;
    if (pct && pct >= 15 && h > 0 && h < 24) {
      return `Estimé ${Math.round(pct)} % sous sa valeur — vente ce soir.`;
    }
    if (h > 0 && h < 24) {
      return `Vente dans moins de 24 heures. Notre sélection prioritaire.`;
    }
  }
  if (pct && pct >= 15) {
    return `${Math.round(pct)} % sous l'estimation basse. Une anomalie de prix rare.`;
  }
  if (pct && pct >= 8) {
    return `Parmi les meilleures opportunités valeur/risque identifiées ce jour.`;
  }
  return `Notre recommandation prioritaire du moment.`;
}

export function MarketBriefModal() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState<BriefSummary | null>(null);
  const [visible, setVisible] = useState(false);
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

  function openBrief() {
    dismiss();
    navigate('/app/today');
  }

  if (!visible || dismissed || !brief) return null;

  const closingCount = brief.closing_today_count ?? brief.closing_soon.length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(26,42,68,0.45)',
          backdropFilter: 'blur(3px)',
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
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-lg)',
        width: 'min(440px, calc(100vw - 32px))',
        overflow: 'hidden',
        animation: 'briefSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>

        {/* Header */}
        <div style={{
          background: 'var(--navy)',
          padding: '20px 24px 18px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontSize: '10px', fontFamily: 'var(--font-mono)',
              letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase', marginBottom: '8px',
            }}>
              Nautilus · Aujourd'hui
            </div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: '18px',
              color: '#fff', lineHeight: 1.3,
            }}>
              {brief.new_lots_count > 0
                ? <>{brief.new_lots_count.toLocaleString('fr-FR')} lots analysés
                    {closingCount > 0 && <>, dont{' '}
                      <span style={{ color: 'var(--gold)' }}>{closingCount}</span>{' '}
                      se ferment aujourd'hui
                    </>}.
                  </>
                : <>Nautilus a travaillé pour vous depuis hier.</>
              }
            </div>
          </div>
          <button
            onClick={dismiss}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)', fontSize: '20px',
              lineHeight: 1, padding: '0 0 0 12px', flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Conviction du jour */}
        {brief.top_deal && (
          <div style={{
            padding: '18px 24px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', gap: '16px', alignItems: 'flex-start',
          }}>
            <div style={{
              width: '64px', height: '80px',
              borderRadius: '4px', overflow: 'hidden', flexShrink: 0,
              background: 'var(--bg-subtle)',
            }}>
              {brief.top_deal.image_url && (
                <img
                  src={brief.top_deal.image_url} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '10px', fontFamily: 'var(--font-mono)',
                letterSpacing: '0.10em', textTransform: 'uppercase',
                color: 'var(--electric)', marginBottom: '6px',
              }}>
                Conviction du jour
              </div>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '16px',
                color: 'var(--navy)', fontWeight: 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: '6px',
              }}>
                {brief.top_deal.artist_name_raw}
              </div>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: '12px',
                fontStyle: 'italic', color: 'var(--text-2)',
                lineHeight: 1.5,
              }}>
                {buildModalPhrase(brief.top_deal)}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: '16px 24px', display: 'flex', gap: '10px' }}>
          <button
            onClick={openBrief}
            style={{
              flex: 1, padding: '10px 16px',
              background: 'var(--navy)', color: '#fff',
              border: 'none', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Voir ma recommandation →
          </button>
          <button
            onClick={dismiss}
            style={{
              padding: '10px 16px',
              background: 'var(--bg-subtle)', color: 'var(--text-2)',
              border: '1px solid var(--border)', borderRadius: '6px',
              fontSize: '13px', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Plus tard
          </button>
        </div>
      </div>

      <style>{`
        @keyframes briefFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes briefSlideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)) } to { opacity: 1; transform: translate(-50%, -50%) } }
      `}</style>
    </>
  );
}
