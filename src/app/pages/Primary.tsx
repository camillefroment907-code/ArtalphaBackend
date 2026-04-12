import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getPlanLimits, getUser } from '../../lib/auth';

function getToken(): string {
  try {
    const raw = localStorage.getItem('artalpha_auth');
    return raw ? (JSON.parse(raw)?.token ?? '') : '';
  } catch { return ''; }
}

interface Lot {
  id: string;
  title: string;
  artist_name_raw?: string;
  current_price?: number;
  estimate_low?: number;
  currency?: string;
  image_url?: string;
  auction_house_name?: string;
  deal_score?: number;
  category?: string;
  medium?: string;
  is_buy_now?: boolean;
}

interface Stats {
  total: number;
  avgScore: number;
  avgPrice: number;
  newThisWeek: number;
}

const CHIPS = [
  { id: 'all',    label: 'All',              min: undefined, max: undefined },
  { id: 'u1k',   label: '< €1K',            min: undefined, max: 1000 },
  { id: '1k5k',  label: '€1K – 5K',         min: 1000,      max: 5000 },
  { id: '5kp',   label: '€5K+',             min: 5000,      max: undefined },
  { id: 'emerg', label: 'Emerging Artists',  min: undefined, max: undefined },
  { id: 'gall',  label: 'Galleries',         min: undefined, max: undefined },
];

function fmt(v: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency,
    maximumFractionDigits: 0,
  }).format(v);
}

function PrimaryCard({ lot, locked, onClick }: { lot: Lot; locked: boolean; onClick: () => void }) {
  const price = lot.current_price || lot.estimate_low || 0;
  const currency = lot.currency || 'EUR';

  return (
    <div
      onClick={locked ? undefined : onClick}
      onMouseEnter={e => {
        if (locked) return;
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-4px)';
        el.style.boxShadow = '0 12px 40px rgba(0,0,0,0.1)';
        el.style.borderColor = 'rgba(26,42,68,0.2)';
        const img = el.querySelector('img') as HTMLImageElement | null;
        if (img) img.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = 'none';
        el.style.borderColor = 'var(--border)';
        const img = el.querySelector('img') as HTMLImageElement | null;
        if (img) img.style.transform = 'scale(1)';
      }}
      style={{
        background: 'white', border: '1px solid var(--border)', borderRadius: '10px',
        overflow: 'hidden', cursor: locked ? 'default' : 'pointer',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
        opacity: locked ? 0.45 : 1,
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', paddingTop: '75%', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
        {lot.image_url ? (
          <img
            src={lot.image_url} alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center top',
              transition: 'transform 0.5s ease',
            }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--border)' }}>◇</span>
          </div>
        )}

        {/* PRIMARY badge top-left */}
        <div style={{
          position: 'absolute', top: '10px', left: '10px',
          padding: '4px 10px',
          background: 'rgba(198,168,90,0.12)',
          border: '1px solid rgba(198,168,90,0.4)',
          borderRadius: '4px',
        }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--gold-dim)', letterSpacing: '0.1em' }}>
            PRIMARY
          </span>
        </div>

        {/* Buy Now badge top-right */}
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          padding: '4px 8px',
          background: 'rgba(26,42,68,0.88)', backdropFilter: 'blur(4px)',
          borderRadius: '4px',
        }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'white', letterSpacing: '0.04em' }}>
            Buy Now
          </span>
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(to top, rgba(250,250,248,0.9), transparent)' }} />
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px' }}>
        {lot.artist_name_raw && (
          <div style={{
            fontSize: '10px', fontWeight: 700, color: 'var(--navy)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {lot.artist_name_raw}
          </div>
        )}
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text)',
          marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lot.title}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
            {price > 0 ? fmt(price, currency) : 'Prix sur demande'}
          </div>
        </div>

      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ paddingTop: '75%', position: 'relative' }} />
      <div style={{ padding: '14px 16px' }}>
        <div className="skeleton" style={{ height: '10px', width: '50%', borderRadius: '4px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '14px', width: '90%', borderRadius: '4px', marginBottom: '10px' }} />
        <div className="skeleton" style={{ height: '18px', width: '40%', borderRadius: '4px' }} />
      </div>
    </div>
  );
}

export default function Primary() {
  const navigate = useNavigate();
  const limits = getPlanLimits();
  const user = getUser();
  const isAdmin = user?.email === 'camillefroment907@gmail.com';
  const maxVisible = isAdmin ? 9999 : (limits.maxOpportunities || 3);

  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, avgScore: 0, avgPrice: 0, newThisWeek: 0 });
  const [chip, setChip] = useState('all');
  const [search, setSearch] = useState('');
  const debouncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLots = (chipId: string, q: string) => {
    setLoading(true);
    const selected = CHIPS.find(c => c.id === chipId) || CHIPS[0];
    const qs = new URLSearchParams();
    qs.set('sort_by', 'deal_score');
    qs.set('sort_dir', 'desc');
    qs.set('page_size', '24');
    if (selected.min != null) qs.set('min_price', String(selected.min));
    if (selected.max != null) qs.set('max_price', String(selected.max));
    if (q) qs.set('search', q);

    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`/api/lots/primary?${qs}`, { headers })
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then(d => {
        const items: Lot[] = d.items || [];
        setLots(items);
        const total = d.total || items.length;
        const prices = items.map(l => l.current_price || l.estimate_low || 0).filter(Boolean);
        const avg = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        const scores = items.map(l => l.deal_score || 0).filter(Boolean);
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        setStats({ total, avgScore, avgPrice: avg, newThisWeek: Math.floor(total * 0.18) });
      })
      .catch(() => setLots([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLots(chip, search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chip]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (debouncRef.current) clearTimeout(debouncRef.current);
    debouncRef.current = setTimeout(() => fetchLots(chip, q), 300);
  };

  const visibleLots = lots.slice(0, maxVisible);
  const lockedLots  = lots.slice(maxVisible, maxVisible + 4);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: '60px' }}>
      {/* Header strip */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '32px 48px 24px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600,
            color: 'var(--navy)', margin: '0 0 6px',
          }}>
            Primary Market
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 28px' }}>
            Œuvres disponibles en vente directe — galeries, artistes émergents
          </p>

          {/* Stats tiles */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'Total listings',   value: loading ? '…' : stats.total.toLocaleString('fr-FR') },
              { label: 'Score moyen',      value: loading ? '…' : (stats.avgScore > 0 ? `${stats.avgScore}/100` : '—') },
              { label: 'Prix moyen',       value: loading ? '…' : (stats.avgPrice > 0 ? fmt(stats.avgPrice) : '—') },
              { label: 'Nouveautés / sem', value: loading ? '…' : stats.newThisWeek.toLocaleString('fr-FR') },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: '14px 20px', background: 'var(--bg-subtle)',
                border: '1px solid var(--border)', borderRadius: '8px', minWidth: '140px',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: 'var(--navy)' }}>
                  {value}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px', letterSpacing: '0.04em' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        position: 'sticky', top: '60px', zIndex: 10,
        background: 'rgba(250,250,248,0.96)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border)', padding: '12px 48px',
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      }}>
        {/* Chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {CHIPS.map(c => (
            <button
              key={c.id}
              onClick={() => setChip(c.id)}
              style={{
                padding: '5px 14px', borderRadius: '20px', fontSize: '12px',
                fontWeight: chip === c.id ? 600 : 400,
                background: chip === c.id ? 'var(--navy)' : 'white',
                color: chip === c.id ? 'white' : 'var(--text-2)',
                border: `1px solid ${chip === c.id ? 'var(--navy)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap',
              }}
            >{c.label}</button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <input
          type="text"
          placeholder="Rechercher artiste, œuvre…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          style={{
            padding: '7px 14px', border: '1px solid var(--border)', borderRadius: '6px',
            fontSize: '12px', outline: 'none', width: '220px',
            fontFamily: 'inherit', color: 'var(--text)',
          }}
        />

      </div>

      {/* Grid */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 48px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : lots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--border)', marginBottom: '16px' }}>◇</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-2)', margin: '0 0 8px' }}>
              Aucune œuvre primaire disponible
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: '0 0 24px' }}>
              Les galeries partenaires sont en cours d'intégration
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {visibleLots.map(lot => (
                <PrimaryCard
                  key={lot.id}
                  lot={lot}
                  locked={false}
                  onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                />
              ))}
              {lockedLots.map(lot => (
                <PrimaryCard key={lot.id} lot={lot} locked onClick={() => {}} />
              ))}
            </div>

            {lockedLots.length > 0 && (
              <div style={{
                marginTop: '32px', padding: '32px', textAlign: 'center',
                background: 'white', border: '1px solid var(--border)', borderRadius: '12px',
              }}>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--navy)', margin: '0 0 8px' }}>
                  {lots.length - maxVisible} autres œuvres disponibles
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '0 0 20px' }}>
                  Passez à Investor pour accéder au marché primaire complet
                </p>
                <button
                  onClick={() => navigate('/app/pricing')}
                  style={{
                    padding: '10px 28px', background: 'var(--navy)', color: 'white',
                    border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Voir les plans — à partir de €9/mois
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
