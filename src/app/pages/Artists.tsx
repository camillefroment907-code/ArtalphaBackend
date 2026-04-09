import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getPlanLimits } from '../../lib/auth';
import { mockArtists } from '../data/mockData';

type SortKey = 'trending' | 'price' | 'name';

export default function Artists() {
  const navigate = useNavigate();
  const limits = getPlanLimits();
  const [sortBy, setSortBy] = useState<SortKey>('trending');

  // ── LOCKED STATE ─────────────────────────────────────────────
  if (!limits.hasFullAnalysis) {
    return (
      <div className="page" style={{
        background: 'var(--bg)', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
      }}>
        <div style={{
          maxWidth: '720px', width: '100%',
        }}>
          {/* Badge */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--gold-dim)', marginBottom: '16px',
          }}>
            INVESTOR+
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: '48px', fontWeight: 600,
            color: 'var(--navy)', margin: '0 0 0',
          }}>
            Artist Intelligence
          </h1>

          {/* Gold rule */}
          <div style={{
            width: '60px', height: '2px', background: 'var(--gold)',
            margin: '24px auto',
          }} />

          {/* Feature teasers */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '40px' }}>
            {[
              {
                icon: '◎',
                title: 'Artist Cotation',
                desc: 'Price history and auction results for 50,000+ artists across all major houses',
              },
              {
                icon: '↗',
                title: 'Market Momentum',
                desc: 'Identify artists with rising institutional demand before prices correct upward',
              },
              {
                icon: '≋',
                title: 'Comparable Sales',
                desc: 'Exact comparable lots adjusted for size, period, and condition',
              },
            ].map(f => (
              <div key={f.icon} style={{
                flex: 1, background: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: '2px',
                padding: '28px', textAlign: 'left',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '24px',
                  color: 'var(--navy)', marginBottom: '12px',
                }}>
                  {f.icon}
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: '18px',
                  color: 'var(--text)', marginBottom: '8px',
                }}>
                  {f.title}
                </div>
                <div style={{
                  fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7,
                }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Blurred fake grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
            marginBottom: '40px', pointerEvents: 'none', userSelect: 'none',
          }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{
                height: '280px', background: 'var(--bg-subtle)',
                borderRadius: '2px', filter: 'blur(6px)', opacity: 0.4,
              }} />
            ))}
          </div>

          {/* CTA block */}
          <div style={{
            background: 'var(--navy)', borderRadius: '2px',
            padding: '48px 40px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600,
              color: 'white', marginBottom: '8px',
            }}>
              Access Artist Intelligence
            </div>
            <div style={{
              fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px',
            }}>
              Available from Investor plan · €29/month
            </div>
            <button
              className="btn btn-gold"
              style={{ fontSize: '13px', padding: '14px 28px' }}
              onClick={() => navigate('/app/pricing')}
            >
              Upgrade to Investor →
            </button>
            <div style={{
              marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.35)',
            }}>
              7-day free trial · cancel anytime
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── UNLOCKED STATE ───────────────────────────────────────────
  const sorted = [...mockArtists].sort((a, b) => {
    if (sortBy === 'trending') return parseFloat(b.marketTrend) - parseFloat(a.marketTrend);
    if (sortBy === 'price') return parseFloat(b.averagePrice.replace(/[^0-9.]/g, '')) - parseFloat(a.averagePrice.replace(/[^0-9.]/g, ''));
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'trending', label: 'Trending'    },
    { value: 'price',    label: 'Avg Price'   },
    { value: 'name',     label: 'Name'        },
  ];

  return (
    <div className="page" style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ padding: '40px 0 28px', borderBottom: '2px solid var(--border)' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
            Artists
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: '0 0 20px' }}>
            Track rising artists and market momentum
          </p>

          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="label-caps">Sort by:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {SORT_OPTIONS.map(opt => {
                const active = sortBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    style={{
                      padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: active ? 700 : 400,
                      border: active ? 'none' : '1px solid var(--border)',
                      background: active ? 'var(--navy)' : 'var(--bg-card)',
                      color: active ? 'white' : 'var(--text-2)',
                      transition: 'all 0.15s ease',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sample data banner */}
        <div style={{
          marginTop: '20px', marginBottom: '28px',
          padding: '12px 20px',
          background: 'var(--gold-subtle)', border: '1px solid var(--gold-border)',
          borderRadius: '2px', fontSize: '13px', color: 'var(--gold-dim)',
        }}>
          Artist database — connecting to live data soon. Showing sample artists.
        </div>

        {/* Artist grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px 24px',
        }}>
          {sorted.map(artist => (
            <div
              key={artist.id}
              onClick={() => navigate(`/app/artists/${artist.id}`)}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(-3px)';
                el.style.boxShadow = 'var(--shadow-md)';
                el.style.borderColor = 'var(--gold-border)';
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
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '2px', overflow: 'hidden', cursor: 'pointer',
                transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
              }}
            >
              {/* Image */}
              <div style={{ position: 'relative', paddingTop: '133%', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'cover', transition: 'transform 0.5s ease',
                  }}
                  loading="lazy"
                />
              </div>

              {/* Info */}
              <div style={{ padding: '20px' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', marginBottom: '4px' }}>
                  {artist.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '16px' }}>
                  {artist.nationality}, b. {artist.birthYear} · {artist.movement}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { label: 'Market Trend', value: artist.marketTrend + ' YoY', accent: true },
                    { label: 'Liquidity',    value: artist.liquidity,             accent: false },
                    { label: 'Average Price', value: artist.averagePrice,         accent: false },
                    { label: 'Record',        value: artist.recordPrice,          accent: false },
                  ].map(stat => (
                    <div key={stat.label}>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '3px', letterSpacing: '0.05em' }}>
                        {stat.label}
                      </div>
                      <div style={{
                        fontSize: '14px', fontFamily: 'var(--font-mono)',
                        color: stat.accent ? 'var(--navy)' : 'var(--text)',
                        fontWeight: stat.accent ? 700 : 400,
                      }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
