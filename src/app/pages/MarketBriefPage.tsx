import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

interface LotCard {
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

interface RecCard {
  rec_type: string;
  score: number;
  reason: string;
  lot: LotCard & { url: string };
}

interface Brief {
  since: string;
  generated_at: string;
  new_lots_count: number;
  new_lots: LotCard[];
  closing_soon: LotCard[];
  top_picks: RecCard[];
  top_deal: LotCard | null;
  agent_unread: number;
}

function fmt(n: number | null | undefined) {
  if (!n) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function daysAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return 'hier';
  return `il y a ${diff} jours`;
}

function timeUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'terminé';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.floor(ms / 60000)} min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j ${h % 24}h`;
}

function MiniLotCard({ lot, onClick }: { lot: LotCard; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.transform = 'none';
      }}
    >
      <div style={{ position: 'relative', paddingTop: '70%', background: 'var(--bg-subtle)' }}>
        {lot.image_url ? (
          <img
            src={lot.image_url}
            alt={lot.title || ''}
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)', fontSize: '24px' }}>◇</div>
        )}
        {lot.deal_score !== null && lot.deal_score !== undefined && (
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            background: 'rgba(26,42,68,0.85)', color: 'var(--gold)',
            fontSize: '11px', fontWeight: 700,
            padding: '2px 7px', borderRadius: '4px',
          }}>
            {lot.deal_score}
          </div>
        )}
        {lot.auction_date && (
          <div style={{
            position: 'absolute', bottom: '6px', left: '8px',
            background: 'rgba(26,42,68,0.75)', color: 'rgba(255,255,255,0.9)',
            fontSize: '10px', fontWeight: 600,
            padding: '2px 6px', borderRadius: '3px',
          }}>
            {new Date(lot.auction_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </div>
        )}
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', fontWeight: 500, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.artist_name_raw || '—'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>
          {lot.title || '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
            {fmt(lot.current_price)}
          </span>
          {lot.estimate_low && (
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>est. {fmt(lot.estimate_low)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ClosingCard({ lot, onClick }: { lot: LotCard; onClick: () => void }) {
  const urgent = lot.auction_date && (new Date(lot.auction_date).getTime() - Date.now()) < 6 * 3600000;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', gap: '14px', alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: `1px solid ${urgent ? 'rgba(198,168,90,0.4)' : 'var(--border)'}`,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
    >
      <div style={{ width: '44px', height: '44px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-subtle)' }}>
        {lot.image_url && <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.artist_name_raw}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.auction_house_name}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        {lot.auction_date && (
          <div style={{ fontSize: '11px', fontWeight: 700, color: urgent ? 'var(--gold)' : 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
            {urgent && '⚡ '}{timeUntil(lot.auction_date)}
          </div>
        )}
        {lot.deal_score !== null && lot.deal_score !== undefined && (
          <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>score {lot.deal_score}</div>
        )}
      </div>
    </div>
  );
}

export default function MarketBriefPage() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState<Brief | null>(null);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', animation: 'fade 1.4s ease-in-out infinite' }}>
          Chargement du brief…
        </div>
        <style>{'@keyframes fade{0%,100%{opacity:0.3}50%{opacity:0.9}}'}</style>
      </div>
    );
  }

  if (!brief) {
    return (
      <div style={{ maxWidth: '680px', margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--navy)', marginBottom: '12px' }}>Brief indisponible</div>
        <div style={{ fontSize: '14px', color: 'var(--text-3)' }}>Impossible de charger le brief pour le moment.</div>
      </div>
    );
  }

  const sinceDate = new Date(brief.since);
  const sinceLabel = sinceDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px 80px' }}>
      {/* Page header */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '10px' }}>
          Nautilus · Brief du {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 400, color: 'var(--navy)', lineHeight: 1.2, margin: 0, marginBottom: '8px' }}>
          Votre marché depuis {sinceLabel}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-3)', margin: 0 }}>
          {brief.new_lots_count} nouvelles opportunités · {brief.closing_soon.length} clôturent dans 48h · {brief.agent_unread} alertes non lues
        </p>
      </div>

      {/* Top deal feature */}
      {brief.top_deal && (
        <div
          onClick={() => navigate(`/app/opportunities/${brief.top_deal!.id}`)}
          style={{
            display: 'flex', gap: '20px', alignItems: 'center',
            padding: '20px 24px',
            background: 'var(--navy)',
            borderRadius: '10px',
            cursor: 'pointer',
            marginBottom: '40px',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.92')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <div style={{ width: '72px', height: '72px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.08)' }}>
            {brief.top_deal.image_url && (
              <img src={brief.top_deal.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '6px' }}>
              ◆ Meilleure opportunité du moment
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {brief.top_deal.artist_name_raw}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {brief.top_deal.title} · {brief.top_deal.auction_house_name}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '32px', fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>
              {brief.top_deal.deal_score}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>/ 100</div>
          </div>
        </div>
      )}

      {/* 2-column grid for content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        {/* Left: New lots */}
        <div>
          <SectionHeader
            title={`${brief.new_lots_count} nouvelles opportunités`}
            sub={`Depuis ${daysAgo(brief.since)}`}
            action={brief.new_lots_count > 6 ? { label: 'Voir tout', onClick: () => navigate('/app/explore') } : undefined}
          />
          {brief.new_lots.length === 0 ? (
            <Empty label="Aucune nouvelle opportunité depuis votre dernière visite." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {brief.new_lots.map(l => (
                <MiniLotCard key={l.id} lot={l} onClick={() => navigate(`/app/opportunities/${l.id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {/* Closing soon */}
          <div>
            <SectionHeader
              title="Clôturent dans 48h"
              sub={`${brief.closing_soon.length} lot${brief.closing_soon.length !== 1 ? 's' : ''} — dernière chance`}
              action={{ label: 'Voir tout', onClick: () => navigate('/app/urgent') }}
              accent="var(--gold)"
            />
            {brief.closing_soon.length === 0 ? (
              <Empty label="Aucune vente ne clôture dans les 48 prochaines heures." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {brief.closing_soon.map(l => (
                  <ClosingCard key={l.id} lot={l} onClick={() => navigate(`/app/opportunities/${l.id}`)} />
                ))}
              </div>
            )}
          </div>

          {/* Agent alerts CTA */}
          {brief.agent_unread > 0 && (
            <div
              onClick={() => navigate('/app/agent')}
              style={{
                padding: '16px 20px',
                background: 'var(--electric-subtle)',
                border: '1px solid var(--electric-border)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '14px',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-subtle)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--electric-subtle)')}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--navy)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', flexShrink: 0,
              }}>
                ◆
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)', marginBottom: '2px' }}>
                  {brief.agent_unread} alerte{brief.agent_unread > 1 ? 's' : ''} de l'agent non lue{brief.agent_unread > 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                  Votre agent a analysé de nouvelles opportunités pour vous →
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top picks */}
      {brief.top_picks.length > 0 && (
        <div style={{ marginTop: '48px' }}>
          <SectionHeader
            title="Sélectionnés pour vous"
            sub="Recommandations personnalisées basées sur votre profil"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
            {brief.top_picks.map((rec) => (
              <div key={rec.lot.id}>
                <MiniLotCard lot={rec.lot} onClick={() => navigate(`/app/opportunities/${rec.lot.id}`)} />
                <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-3)', padding: '0 2px', lineHeight: 1.4 }}>
                  {rec.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function SectionHeader({
  title, sub, action, accent = 'var(--navy)',
}: {
  title: string;
  sub: string;
  action?: { label: string; onClick: () => void };
  accent?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 500, color: accent, lineHeight: 1.2 }}>
          {title}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>{sub}</div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--electric)', fontWeight: 600, padding: '2px 0', flexShrink: 0 }}
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      {label}
    </div>
  );
}
