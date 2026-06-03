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
  agent_unread: number;
  top_deal: {
    artist_name_raw: string;
    title: string;
    deal_score: number;
    image_url: string;
    auction_house_name: string;
  } | null;
  since: string;
}

export function MarketBriefModal() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState<BriefSummary | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) return;
    // Already seen today
    if (localStorage.getItem(todayKey())) return;

    const token = getToken();
    fetch(`${BACKEND}/api/recommendations/market-brief`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setBrief(data);
        // Slight delay so the page has time to render first
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

  const since = new Date(brief.since);
  const sinceLabel = since.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

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
        width: 'min(480px, calc(100vw - 32px))',
        overflow: 'hidden',
        animation: 'briefSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Header stripe */}
        <div style={{
          background: 'var(--navy)',
          padding: '20px 24px 18px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Nautilus · Brief du jour
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: '#fff', lineHeight: 1.2 }}>
              Bonjour — voici ce qui<br />s'est passé depuis {sinceLabel}
            </div>
          </div>
          <button
            onClick={dismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '20px', lineHeight: 1, padding: '0 0 0 12px', flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          borderBottom: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          <Stat value={brief.new_lots_count} label="nouvelles opportunités" accent="var(--electric)" />
          <Stat value={brief.closing_soon.length} label="clôturent dans 48h" accent="var(--gold)" />
          <Stat value={brief.agent_unread} label="alertes non lues" accent="var(--navy)" />
        </div>

        {/* Top deal */}
        {brief.top_deal && (
          <div style={{ padding: '16px 24px', display: 'flex', gap: '14px', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0,
              background: 'var(--bg-subtle)',
            }}>
              {brief.top_deal.image_url && (
                <img src={brief.top_deal.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '3px' }}>
                ◆ Meilleure opportunité du moment
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {brief.top_deal.artist_name_raw}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {brief.top_deal.auction_house_name}
              </div>
            </div>
            <div style={{
              flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: 'var(--navy)',
            }}>
              {brief.top_deal.deal_score}
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
            }}
          >
            Voir Aujourd'hui →
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

function Stat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div style={{ padding: '16px', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: accent, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  );
}
