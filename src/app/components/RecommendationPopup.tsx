/**
 * RecommendationPopup — shown once after login if recommendations are available.
 * Renders as a fixed bottom-right card. Dismisses on click-through or ✕.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getUser } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
const SESSION_KEY = 'nautilus_rec_popup_shown';

interface RecCard {
  rec_type: string;
  score: number;
  reason: string;
  lot: {
    id: string;
    title: string;
    artist_name_raw: string;
    estimate_low: number | null;
    deal_score: number | null;
    image_url: string | null;
    auction_house_name: string | null;
  };
}

export function RecommendationPopup() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [rec, setRec] = useState<RecCard | null>(null);

  useEffect(() => {
    // Only show once per session, only for logged-in users
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const user = getUser();
    if (!user?.token) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${BACKEND}/api/recommendations/for-you?limit=3`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const items: RecCard[] = data.recommendations || [];
        const top = items.find(r => r.lot?.image_url) || items[0];
        if (top) {
          setRec(top);
          setVisible(true);
          sessionStorage.setItem(SESSION_KEY, '1');
        }
      } catch {
        // silent
      }
    }, 4000); // 4s after mount

    return () => clearTimeout(timer);
  }, []);

  if (!visible || !rec) return null;

  const lot = rec.lot;
  const score = lot.deal_score ?? rec.score;
  const estimate = lot.estimate_low ? `Est. €${lot.estimate_low.toLocaleString()}` : '';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        zIndex: 9000,
        width: '300px',
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 8px 40px rgba(10,22,40,0.14)',
        overflow: 'hidden',
        animation: 'slideUp 0.3s ease',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>✦ FOR YOU</span>
        </div>
        <button
          onClick={() => setVisible(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '14px', lineHeight: 1 }}
        >✕</button>
      </div>

      {/* Lot card */}
      <div
        onClick={() => { navigate(`/app/opportunities/${lot.id}`); setVisible(false); }}
        style={{ cursor: 'pointer', padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}
      >
        {lot.image_url && (
          <img
            src={lot.image_url}
            alt=""
            style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {lot.artist_name_raw && (
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lot.artist_name_raw}
            </div>
          )}
          <div style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lot.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {score && (
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>
                {score.toFixed(0)}/100
              </span>
            )}
            {estimate && (
              <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{estimate}</span>
            )}
          </div>
        </div>
      </div>

      {/* Reason */}
      <div style={{ padding: '0 14px 10px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-2)', background: 'var(--bg-subtle)', borderRadius: '5px', padding: '6px 8px', lineHeight: 1.4 }}>
          {rec.reason}
        </div>
      </div>

      {/* CTA */}
      <div
        onClick={() => { navigate('/app/explore?tab=for-you'); setVisible(false); }}
        style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--navy)', cursor: 'pointer', textAlign: 'center', letterSpacing: '0.06em' }}
      >
        See all recommendations →
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
