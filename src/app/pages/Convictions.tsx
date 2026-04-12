import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getPlanLimits, getUser } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

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
  auction_date?: string;
  market_type?: string;
  source?: string;
}

const PRICE_CHIPS = [
  { id: 'all',    label: 'Toutes',     min: undefined, max: undefined,  market: undefined },
  { id: 'enc',    label: 'Enchères',   min: undefined, max: undefined,  market: 'auction' },
  { id: 'pri',    label: 'Primaire',   min: undefined, max: undefined,  market: 'primary' },
  { id: 'u5k',    label: '< €5K',      min: undefined, max: 5000,       market: undefined },
  { id: '5k20k',  label: '€5K–20K',   min: 5000,      max: 20000,      market: undefined },
  { id: 'o20k',   label: '> €20K',     min: 20000,     max: undefined,  market: undefined },
];

function fmt(v: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
}

function ConvictionDots({ score }: { score: number }) {
  const filled = score >= 80 ? 3 : score >= 65 ? 2 : 1;
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: i <= filled ? 'var(--gold)' : 'var(--border)',
        }} />
      ))}
    </div>
  );
}

function MarketBadge({ marketType }: { marketType?: string }) {
  const isPrimary = marketType === 'primary' || marketType === 'gallery';
  return (
    <div style={{
      position: 'absolute', top: '10px', left: '10px',
      padding: '3px 8px', borderRadius: '4px',
      background: isPrimary ? 'rgba(198,168,90,0.15)' : 'rgba(26,42,68,0.85)',
      border: isPrimary ? '1px solid rgba(198,168,90,0.4)' : 'none',
      backdropFilter: isPrimary ? undefined : 'blur(4px)',
    }}>
      <span style={{
        fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em',
        color: isPrimary ? 'var(--gold-dim)' : 'white',
      }}>
        {isPrimary ? 'PRIMARY' : 'AUCTION'}
      </span>
    </div>
  );
}

function ConvictionCard({ lot, locked, onClick }: { lot: Lot; locked: boolean; onClick: () => void }) {
  const ds = lot.deal_score || 0;
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
        opacity: locked ? 0.4 : 1,
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', paddingTop: '80%', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
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
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--border)' }}>◇</span>
          </div>
        )}

        <MarketBadge marketType={lot.market_type} />

        {/* Score top-right */}
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          padding: '4px 8px', background: 'rgba(250,250,248,0.92)', backdropFilter: 'blur(4px)',
          borderRadius: '4px', border: '1px solid var(--border)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--navy)' }}>{Math.round(ds)}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-3)' }}>/100</span>
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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
            {price > 0 ? fmt(price, currency) : 'Prix sur demande'}
          </div>
          <ConvictionDots score={ds} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lot.auction_house_name || lot.source || ''}
          </span>
          {lot.auction_date && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', flexShrink: 0 }}>
              {new Date(lot.auction_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ paddingTop: '80%', position: 'relative' }} />
      <div style={{ padding: '14px 16px' }}>
        <div className="skeleton" style={{ height: '10px', width: '55%', borderRadius: '4px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '14px', width: '90%', borderRadius: '4px', marginBottom: '10px' }} />
        <div className="skeleton" style={{ height: '18px', width: '40%', borderRadius: '4px' }} />
      </div>
    </div>
  );
}

function SmallCard({ lot, onClick }: { lot: Lot; onClick: () => void }) {
  const price = lot.current_price || lot.estimate_low || 0;
  const currency = lot.currency || 'EUR';

  return (
    <div
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--navy)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
      style={{
        flex: '0 0 200px', width: '200px', background: 'white',
        border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden',
        cursor: 'pointer', transition: 'border-color 0.15s ease',
      }}
    >
      <div style={{ position: 'relative', paddingTop: '65%', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
        {lot.image_url ? (
          <img src={lot.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--border)' }}>◇</span>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(26,42,68,0.85)', padding: '2px 6px', borderRadius: '3px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'white' }}>{Math.round(lot.deal_score || 0)}</span>
        </div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.artist_name_raw || ''}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
          {lot.title}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
          {price > 0 ? fmt(price, currency) : '—'}
        </div>
      </div>
    </div>
  );
}

export default function Convictions() {
  const navigate = useNavigate();
  const limits = getPlanLimits();
  const user = getUser();
  const isAdmin = user?.email === 'camillefroment907@gmail.com';
  const maxVisible = isAdmin ? 12 : Math.min(limits.maxOpportunities || 3, 12);

  const [lots, setLots]           = useState<Lot[]>([]);
  const [todayLots, setTodayLots] = useState<Lot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [chip, setChip]           = useState('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMain = (chipId: string) => {
    setLoading(true);
    const selected = PRICE_CHIPS.find(c => c.id === chipId) || PRICE_CHIPS[0];
    const qs = new URLSearchParams();
    qs.set('limit', '12');
    if (selected.min != null) qs.set('budget_min', String(selected.min));
    if (selected.max != null) qs.set('budget_max', String(selected.max));

    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${BACKEND}/api/lots/for-investor?${qs}`, { headers })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => {
        let items: Lot[] = d.items || [];
        if (selected.market) {
          items = items.filter(l =>
            selected.market === 'auction'
              ? (!l.market_type || l.market_type === 'auction')
              : (l.market_type === 'primary' || l.market_type === 'gallery')
          );
        }
        setLots(items.slice(0, 12));
        setLastUpdated(new Date());
      })
      .catch(() => setLots([]))
      .finally(() => setLoading(false));
  };

  const fetchToday = () => {
    const today = new Date().toISOString().split('T')[0];
    const qs = new URLSearchParams();
    qs.set('sort_by', 'deal_score');
    qs.set('sort_dir', 'desc');
    qs.set('page_size', '6');
    qs.set('auction_date_from', today);
    qs.set('min_score', '45');

    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${BACKEND}/api/lots?${qs}`, { headers })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setTodayLots(d.items || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchMain(chip);
    fetchToday();

    // Refresh every 15 minutes
    intervalRef.current = setInterval(() => {
      fetchMain(chip);
      fetchToday();
    }, 15 * 60 * 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchMain(chip);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chip]);

  const visibleLots = lots.slice(0, maxVisible);
  const lockedLots  = lots.slice(maxVisible, 12);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: '60px' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '32px 48px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600,
              color: 'var(--navy)', margin: '0 0 4px',
            }}>
              Convictions
            </h1>
            {/* Gold rule */}
            <div style={{ width: '40px', height: '2px', background: 'var(--gold)', marginBottom: '12px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0 }}>
              Les 12 meilleures opportunités du moment — tous marchés confondus
            </p>
          </div>

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginTop: '4px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulseDot 2s infinite' }} />
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.08em' }}>
                LIVE · 15MIN
              </div>
              {lastUpdated && (
                <div style={{ fontSize: '9px', color: 'var(--text-3)', marginTop: '1px' }}>
                  Mis à jour {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chips toolbar */}
      <div style={{
        position: 'sticky', top: '60px', zIndex: 10,
        background: 'rgba(250,250,248,0.96)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border)', padding: '10px 48px',
        display: 'flex', gap: '6px', flexWrap: 'wrap',
      }}>
        {PRICE_CHIPS.map(c => (
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

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 48px' }}>
        {/* Main 3×4 grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '48px' }}>
            {Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : lots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', marginBottom: '48px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--border)', marginBottom: '16px' }}>◇</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-2)', margin: '0 0 8px' }}>
              Aucune conviction en ce moment
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
              Vérifiez dans 15 minutes
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
              {visibleLots.map(lot => (
                <ConvictionCard
                  key={lot.id}
                  lot={lot}
                  locked={false}
                  onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                />
              ))}
              {lockedLots.map(lot => (
                <ConvictionCard key={lot.id} lot={lot} locked onClick={() => {}} />
              ))}
            </div>

            {lockedLots.length > 0 && (
              <div style={{
                padding: '28px 32px', textAlign: 'center',
                background: 'white', border: '1px solid var(--border)', borderRadius: '12px',
                marginBottom: '48px',
              }}>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--navy)', margin: '0 0 6px' }}>
                  {12 - maxVisible} convictions verrouillées
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '0 0 18px' }}>
                  Passez à Investor pour accéder aux 12 meilleures opportunités
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

        {/* "Aujourd'hui" section */}
        {todayLots.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
                Sélection du jour
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                Enchères en cours aujourd'hui · Score ≥ 45
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
              {todayLots.map(lot => (
                <SmallCard
                  key={lot.id}
                  lot={lot}
                  onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
