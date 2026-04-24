import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getToken, getUserPlan } from '../../lib/auth';

const BACKEND = 'https://artalpha-backend-production.up.railway.app';

interface Signal {
  type: string;
  icon: string;
  label: string;
  detail: string;
  color: string;
}

interface Lot {
  id: string;
  title: string;
  current_price: number | null;
  deal_score: number | null;
  image_url: string | null;
  auction_house_name: string | null;
  url: string | null;
}

interface ArtistProfile {
  id: string;
  name: string;
  nationality: string | null;
  birth_year: number | null;
  death_year: number | null;
  biography: string | null;
  ai_brief?: string | null;
  movement?: string | null;
  image_url: string | null;
  artsy_url: string | null;
  investment_tier: string | null;
  momentum_score: number | null;
  liquidity_score: number | null;
  institutional_score: number | null;
  gallery_tier_avg: number | null;
  gallery_count: number;
  top_gallery_name: string | null;
  public_collections_count: number;
  shows_last_12m: number;
  shows_prev_12m?: number;
  is_pre_auction: boolean;
  statistics?: { trend_direction?: string };
  signals: Signal[];
  lots: Lot[];
}

function ArtistInitials({ name, size = 200 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: 'var(--navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 48, color: 'white' }}>
        {initials}
      </span>
    </div>
  );
}

function ScoreTile({ label, value, unit = '' }: { label: string; value: number | null; unit?: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '16px 20px',
        textAlign: 'center',
        borderRight: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'white' }}>
        {value !== null && value !== undefined ? `${value}${unit}` : '—'}
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const map: Record<string, { label: string; color: string }> = {
    blue_chip: { label: 'BLUE CHIP', color: 'var(--gold)' },
    mid_career: { label: 'MID CAREER', color: 'var(--electric)' },
    emerging: { label: 'EMERGING', color: 'var(--text-2)' },
  };
  const config = map[tier] ?? { label: tier.toUpperCase(), color: 'var(--text-2)' };
  return (
    <div style={{
      display: 'inline-block',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.15em',
      color: config.color,
      border: `1px solid ${config.color}`,
      borderRadius: 3,
      padding: '3px 8px',
      marginBottom: 10,
    }}>
      {config.label}
    </div>
  );
}

function LotCard({ lot }: { lot: Lot }) {
  const navigate = useNavigate();
  const score = lot.deal_score ?? 0;
  const scoreColor = score >= 70 ? 'var(--gold)' : score >= 55 ? 'var(--electric)' : 'var(--text-3)';

  return (
    <div
      onClick={() => navigate(`/app/opportunities/${lot.id}`)}
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--navy)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ height: 160, background: 'var(--surface)', overflow: 'hidden' }}>
        {lot.image_url ? (
          <img src={lot.image_url} alt={lot.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--surface-2)' }} />
        )}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lot.title}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>
            {lot.current_price ? `€${lot.current_price.toLocaleString()}` : '—'}
          </div>
          {lot.deal_score !== null && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              color: scoreColor,
              border: `1px solid ${scoreColor}`,
              borderRadius: 3,
              padding: '2px 6px',
            }}>
              {Math.round(score)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--text)', marginBottom: 16, marginTop: 0 }}>
      {children}
    </h2>
  );
}

export default function ArtistDetail() {
  const { id: name } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [wikiBio, setWikiBio] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    setLoading(true);
    setNotFound(false);
    const token = getToken();
    fetch(`${BACKEND}/api/artist-profiles/${encodeURIComponent(name)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => {
        if (d) {
          setData(d);
          if (!d.ai_brief) {
            const wikiName = encodeURIComponent((d.name || '').replace(/\s+/g, '_'));
            fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiName}`)
              .then(r => r.ok ? r.json() : null)
              .then(w => { if (w?.extract) setWikiBio(w.extract); })
              .catch(() => {});
          }
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [name]);

  if (loading) {
    return (
      <div style={{ padding: '40px 48px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ height: 16, background: 'var(--surface-2)', borderRadius: 4, width: 120, marginBottom: 32 }} />
        <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
          <div style={{ width: 200, height: 200, borderRadius: 4, background: 'var(--surface-2)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 20, background: 'var(--surface-2)', borderRadius: 4, width: 80, marginBottom: 16 }} />
            <div style={{ height: 36, background: 'var(--surface-2)', borderRadius: 4, width: 300, marginBottom: 12 }} />
            <div style={{ height: 14, background: 'var(--surface-2)', borderRadius: 4, width: 160 }} />
          </div>
        </div>
        <div style={{ height: 80, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 32 }} />
        <div style={{ height: 200, background: 'var(--surface-2)', borderRadius: 4 }} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div style={{ padding: '40px 48px', maxWidth: 800, margin: '0 auto', textAlign: 'center', paddingTop: 120 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, marginBottom: 16 }}>
          Artist profile not found
        </h2>
        <p style={{ color: 'var(--text-3)', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          Data will be available after the next enrichment cycle (every 6 hours).
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--electric)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}
        >
          ← GO BACK
        </button>
      </div>
    );
  }

  const [plan, setPlan] = useState(getUserPlan());
  useEffect(() => { setPlan(getUserPlan()); }, []);
  const showTrend = data.shows_prev_12m !== undefined && data.shows_prev_12m !== null;
  const trendUp = showTrend && data.shows_last_12m > (data.shows_prev_12m ?? 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 80 }}>
      <div style={{ padding: '32px 48px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 32, padding: 0 }}
        >
          ← BACK
        </button>

        {/* HERO SECTION */}
        <div style={{ display: 'flex', gap: 32, marginBottom: 32, alignItems: 'flex-start' }}>
          {/* Image */}
          {data.image_url ? (
            <img
              src={data.image_url}
              alt={data.name}
              style={{ width: 200, height: 200, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <ArtistInitials name={data.name} />
          )}

          {/* Info */}
          <div style={{ flex: 1, paddingTop: 4 }}>
            <TierBadge tier={data.investment_tier} />
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--text)', margin: '0 0 8px 0' }}>
              {data.name}
            </h1>
            {(data.nationality || data.movement || data.birth_year) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {data.nationality && (
                  <span style={{ padding: '3px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--text-2)' }}>
                    {data.nationality}
                  </span>
                )}
                {data.movement && (
                  <span style={{ padding: '3px 10px', background: 'rgba(198,168,90,0.08)', border: '1px solid rgba(198,168,90,0.3)', borderRadius: 20, fontSize: 12, color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                    {data.movement}
                  </span>
                )}
                {data.birth_year && (
                  <span style={{ padding: '3px 10px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    {data.birth_year}{data.death_year ? `–${data.death_year}` : '–'}
                  </span>
                )}
              </div>
            )}
            {data.artsy_url && (
              <a
                href={data.artsy_url}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--electric)', textDecoration: 'none' }}
              >
                View on Artsy →
              </a>
            )}
          </div>
        </div>

        {/* SCORES STRIP */}
        <div
          style={{
            display: 'flex',
            background: 'var(--navy)',
            borderRadius: 6,
            marginBottom: 40,
            overflow: 'hidden',
          }}
        >
          <ScoreTile label="Momentum" value={data.momentum_score} unit="/100" />
          <ScoreTile label="Liquidity" value={data.liquidity_score} unit="/100" />
          <ScoreTile label="Institutional" value={data.institutional_score} unit="/100" />
          <div style={{ flex: 1, padding: '16px 20px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
              Galleries
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'white' }}>
              {data.gallery_count > 0 ? `${data.gallery_count}` : '—'}
            </div>
          </div>
          {data.statistics?.trend_direction && (
            <div style={{ flex: 1, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
                Trend
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: data.statistics.trend_direction === 'up' ? '#34D399' : data.statistics.trend_direction === 'down' ? '#F87171' : '#94A3B8' }}>
                {data.statistics.trend_direction === 'up' ? '↑' : data.statistics.trend_direction === 'down' ? '↓' : '→'}
              </div>
            </div>
          )}
        </div>

        {plan === 'free' ? (
          <>
            <div style={{ marginBottom: 40 }}>
              {data.ai_brief ? (
                <div style={{ background: 'var(--navy)', borderRadius: 10, padding: '18px 22px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: 8 }}>◆ NAUTILUS ANALYST BRIEF</div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, margin: 0 }}>{data.ai_brief}</p>
                </div>
              ) : wikiBio ? (
                <div style={{ background: 'var(--navy)', borderRadius: 10, padding: '18px 22px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: 8 }}>◆ NAUTILUS ANALYST BRIEF</div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, margin: 0, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{wikiBio}</p>
                </div>
              ) : data.biography ? (
                <div style={{ background: 'var(--navy)', borderRadius: 10, padding: '18px 22px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: 8 }}>◆ NAUTILUS ANALYST BRIEF</div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, margin: 0 }}>{data.biography.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}</p>
                </div>
              ) : (
                <div style={{ background: '#F5F3EE', border: '1px solid #E8E4DD', borderRadius: 8, padding: '16px 20px' }}>
                  <p style={{ fontSize: 12, fontStyle: 'italic', color: '#9CA3AF', margin: 0, lineHeight: 1.6 }}>Market data available — artist biography coming soon.</p>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'center', padding: '48px 24px', background: '#f8f8f6', borderRadius: 8, marginTop: 24 }}>
              <div style={{ fontSize: 13, letterSpacing: '0.15em', color: '#C6A85A', marginBottom: 8 }}>INVESTOR+ FEATURE</div>
              <div style={{ fontSize: 20, fontFamily: 'Georgia,serif', color: '#1A2A44', marginBottom: 16 }}>Full artist intelligence is available from the Investor plan</div>
              <a href="/app/pricing" style={{ background: '#2563EB', color: '#fff', padding: '12px 28px', fontSize: 13, fontWeight: 600, textDecoration: 'none', borderRadius: 4 }}>Unlock full access →</a>
            </div>
          </>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 40 }}>
          {/* LEFT COLUMN */}
          <div>
            {/* SIGNALS */}
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>Investment Signals</SectionTitle>
              {data.signals && data.signals.length > 0 ? (
                data.signals.map((signal, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      padding: '14px 16px',
                      background: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      marginBottom: 10,
                    }}
                  >
                    <span style={{
                      fontSize: 16,
                      color: signal.color === 'gold'
                        ? 'var(--gold)'
                        : signal.color === 'electric'
                          ? 'var(--electric)'
                          : 'var(--navy)',
                    }}>
                      {signal.icon}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                        {signal.label}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{signal.detail}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  Insufficient data for signal generation
                </div>
              )}
            </div>

            {/* BIOGRAPHY */}
            <div style={{ marginBottom: 40 }}>
              {data.ai_brief ? (
                <div style={{ background: 'var(--navy)', borderRadius: 10, padding: '18px 22px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: 8 }}>
                    ◆ NAUTILUS ANALYST BRIEF
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, margin: 0 }}>
                    {data.ai_brief}
                  </p>
                </div>
              ) : wikiBio ? (
                <div style={{ background: 'var(--navy)', borderRadius: 10, padding: '18px 22px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: 8 }}>
                    ◆ NAUTILUS ANALYST BRIEF
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, margin: 0, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {wikiBio}
                  </p>
                </div>
              ) : data.biography ? (
                <div style={{ background: 'var(--navy)', borderRadius: 10, padding: '18px 22px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: 8 }}>
                    ◆ NAUTILUS ANALYST BRIEF
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, margin: 0 }}>
                    {data.biography.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}
                  </p>
                </div>
              ) : (
                <div style={{ background: '#F5F3EE', border: '1px solid #E8E4DD', borderRadius: 8, padding: '16px 20px' }}>
                  <p style={{ fontSize: 12, fontStyle: 'italic', color: '#9CA3AF', margin: 0, lineHeight: 1.6 }}>
                    Market data available — artist biography coming soon.
                  </p>
                </div>
              )}
            </div>

            {/* CURRENT LOTS */}
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                <SectionTitle>Current Opportunities</SectionTitle>
                {data.lots && data.lots.length > 0 && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--electric)',
                    border: '1px solid var(--electric)',
                    borderRadius: 3,
                    padding: '2px 6px',
                  }}>
                    {data.lots.length}
                  </span>
                )}
              </div>
              {data.lots && data.lots.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {data.lots.map((lot) => (
                    <LotCard key={lot.id} lot={lot} />
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '32px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  textAlign: 'center',
                  color: 'var(--text-3)',
                  fontSize: 14,
                }}>
                  No current lots on Nautilus for this artist
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — INVESTMENT CONTEXT */}
          <div>
            <SectionTitle>Investment Context</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Gallery Representation */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '18px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                  Gallery Representation
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {data.top_gallery_name || 'Data unavailable'}
                </div>
                {data.gallery_count > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {data.gallery_count} {data.gallery_count === 1 ? 'gallery' : 'galleries'}
                  </div>
                )}
              </div>

              {/* Public Collections */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '18px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                  Public Collections
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {data.public_collections_count > 0
                    ? `${data.public_collections_count} institutions`
                    : 'No data'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Institutional floor</div>
              </div>

              {/* Market Activity */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '18px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                  Market Activity
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {data.shows_last_12m} shows{' '}
                  {showTrend && (
                    <span style={{ color: trendUp ? 'var(--electric)' : 'var(--text-3)', fontSize: 14 }}>
                      {trendUp ? '↑' : '↓'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Last 12 months</div>
              </div>

              {/* Pre-auction badge */}
              {data.is_pre_auction && (
                <div style={{
                  background: 'var(--gold)',
                  borderRadius: 6,
                  padding: '16px 20px',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.6)', marginBottom: 6 }}>
                    Pre-Auction Window
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.8)', lineHeight: 1.5 }}>
                    Optimal primary market entry — not yet at auction
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
