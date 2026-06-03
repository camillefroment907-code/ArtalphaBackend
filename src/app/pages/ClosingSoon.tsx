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

function fmt(n: number | null | undefined) {
  if (!n) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function timeUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'terminé';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.floor(ms / 60000)} min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j ${h % 24}h`;
}

export default function ClosingSoon() {
  const navigate = useNavigate();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 3600000);

    const params = new URLSearchParams({
      auction_date_from: now.toISOString(),
      auction_date_to: in48h.toISOString(),
      sort_by: 'auction_date',
      sort_dir: 'asc',
      page_size: '40',
    });

    fetch(`${BACKEND}/api/lots?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => { setLots(data.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const now = Date.now();
  const urgent = lots.filter(l => l.auction_date && new Date(l.auction_date).getTime() - now < 6 * 3600000);
  const soon = lots.filter(l => l.auction_date && new Date(l.auction_date).getTime() - now >= 6 * 3600000);

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px' }}>
          Nautilus · Urgences
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 400, color: 'var(--navy)', lineHeight: 1.2, margin: 0, marginBottom: '8px' }}>
          Clôture dans les 48 prochaines heures
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-3)', margin: 0 }}>
          {loading ? 'Chargement…' : `${lots.length} lot${lots.length !== 1 ? 's' : ''} — dernière chance d'enchérir`}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', animation: 'fade 1.4s ease-in-out infinite' }}>
            Chargement…
          </span>
          <style>{'@keyframes fade{0%,100%{opacity:0.3}50%{opacity:0.9}}'}</style>
        </div>
      ) : lots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-3)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>◇</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--navy)', marginBottom: '8px' }}>Aucune vente imminente</div>
          <div style={{ fontSize: '13px' }}>Aucune vente ne clôture dans les 48 prochaines heures.</div>
        </div>
      ) : (
        <>
          {/* Urgent (< 6h) */}
          {urgent.length > 0 && (
            <div style={{ marginBottom: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '14px' }}>⚡</span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 500, color: 'var(--gold)' }}>
                  Clôture dans moins de 6h
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {urgent.map(lot => <LotRow key={lot.id} lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} />)}
              </div>
            </div>
          )}

          {/* Soon (6–48h) */}
          {soon.length > 0 && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 500, color: 'var(--navy)' }}>
                  Clôture dans 6 à 48h
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {soon.map(lot => <LotRow key={lot.id} lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} />)}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function LotRow({ lot, onClick }: { lot: Lot; onClick: () => void }) {
  const urgent = lot.auction_date && (new Date(lot.auction_date).getTime() - Date.now()) < 6 * 3600000;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', gap: '14px', alignItems: 'center',
        padding: '14px 16px',
        background: 'var(--bg-card)',
        border: `1px solid ${urgent ? 'rgba(198,168,90,0.4)' : 'var(--border)'}`,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-subtle)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Thumbnail */}
      <div style={{ width: '54px', height: '54px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-subtle)' }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)', fontSize: '18px' }}>◇</div>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', fontWeight: 500, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.artist_name_raw || '—'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
          {lot.title}
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
          {fmt(lot.current_price || lot.estimate_low)}
        </div>
      </div>

      {/* Right: countdown + score */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        {lot.auction_date && (
          <div style={{
            fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: urgent ? 'var(--gold)' : 'var(--navy)',
            marginBottom: '3px',
          }}>
            {urgent && '⚡ '}{timeUntil(lot.auction_date)}
          </div>
        )}
        {lot.deal_score !== null && lot.deal_score !== undefined && (
          <div style={{
            display: 'inline-block', padding: '1px 6px', borderRadius: '3px',
            background: 'rgba(26,42,68,0.07)', fontSize: '10px', fontWeight: 700, color: 'var(--navy)',
          }}>
            score {lot.deal_score}
          </div>
        )}
      </div>
    </div>
  );
}
