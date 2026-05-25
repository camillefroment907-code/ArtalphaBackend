import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getToken, getUserPlan } from '../../lib/auth';
import { useSEO } from '../../lib/useSEO';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';
const PAGE_SIZE = 12;

interface EmergingArtist {
  id: string;
  name: string;
  image_url: string | null;
  profile_url: string | null;
  biography: string | null;
  momentum_signal: 'rising' | 'stable' | null;
  momentum_score: number | null;
  source: string | null;
}

interface ApiResponse {
  artists: EmergingArtist[];
  blur_remaining: boolean;
  total_available: number;
}

export default function Emerging() {
  useSEO({ title: "Artistes Émergents — Nautilus", description: "Artistes en progression détectés par Nautilus Intelligence." });
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [artists, setArtists] = useState<EmergingArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [blurRemaining, setBlurRemaining] = useState(false);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [plan] = useState(getUserPlan());

  const hasAccess = ['investor', 'pro', 'institutional'].includes(plan);

  const fetchPage = useCallback(async (p: number, append: boolean) => {
    const token = getToken();
    try {
      const res = await fetch(`${BACKEND}/api/emerging/artists?page=${p}&page_size=${PAGE_SIZE}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const d: ApiResponse = await res.json();
      setArtists(prev => append ? [...prev, ...d.artists] : d.artists);
      setBlurRemaining(!hasAccess && d.blur_remaining);
      setTotalAvailable(d.total_available);
      setHasMore(d.artists.length === PAGE_SIZE && !d.blur_remaining);
    } catch {}
  }, [hasAccess]);

  useEffect(() => {
    fetchPage(1, false).finally(() => setLoading(false));
  }, [fetchPage]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const next = page + 1;
    await fetchPage(next, true);
    setPage(next);
    setLoadingMore(false);
  };

  const lockedCount = totalAvailable - artists.length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 80 }}>
      <div style={{ padding: '48px 48px 0', maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>
            ◆ NAUTILUS RADAR
          </div>
          <h1 className="emerging-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--text)', margin: '0 0 12px 0', fontWeight: 400 }}>
            {t('emerging.title')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.7, margin: 0, maxWidth: 560 }}>
            {t('emerging.subtitle')}
          </p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ height: 200, background: 'var(--surface-2)' }} />
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ height: 14, background: 'var(--surface-2)', borderRadius: 4, width: '60%', marginBottom: 10 }} />
                  <div style={{ height: 11, background: 'var(--surface-2)', borderRadius: 4, width: '90%', marginBottom: 6 }} />
                  <div style={{ height: 11, background: 'var(--surface-2)', borderRadius: 4, width: '75%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && artists.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.2 }}>◉</div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)', letterSpacing: '0.1em' }}>
              RADAR INITIALIZING — FIRST ARTISTS COMING SOON
            </p>
          </div>
        )}

        {/* Artist grid */}
        {!loading && artists.length > 0 && (
          <div style={{ position: 'relative' }}>
            <div className="emerging-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {artists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} navigate={navigate} />
              ))}

              {/* Blurred placeholder cards for locked content */}
              {blurRemaining && lockedCount > 0 && (
                Array.from({ length: Math.min(lockedCount, 9) }).map((_, i) => (
                  <div key={`locked-${i}`} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
                    <div style={{ height: 200, background: 'linear-gradient(135deg, #e8e4dd 0%, #d4cfc8 100%)' }} />
                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ height: 14, background: '#ddd', borderRadius: 4, width: '60%', marginBottom: 10 }} />
                      <div style={{ height: 11, background: '#ddd', borderRadius: 4, width: '90%', marginBottom: 6 }} />
                      <div style={{ height: 11, background: '#ddd', borderRadius: 4, width: '75%' }} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Paywall overlay */}
            {blurRemaining && (
              <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                height: '340px',
                background: 'linear-gradient(to bottom, transparent 0%, rgba(250,250,248,0.85) 40%, rgba(250,250,248,0.98) 100%)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: 32,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: 10 }}>
                    {t('emerging.paywallTitle')}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--text)', marginBottom: 18 }}>
                    {t('emerging.paywallSub', { count: lockedCount })}
                  </div>
                  <button
                    onClick={() => navigate('/app/pricing')}
                    style={{
                      background: 'var(--navy)', color: 'white',
                      border: 'none', borderRadius: 4,
                      padding: '12px 28px', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', letterSpacing: '0.04em',
                    }}
                  >
                    {t('emerging.paywallCta')}
                  </button>
                </div>
              </div>
            )}

            {/* Load more */}
            {hasMore && !blurRemaining && (
              <div style={{ textAlign: 'center', marginTop: 40 }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    background: 'transparent', color: 'var(--navy)',
                    border: '1px solid var(--navy)', borderRadius: 4,
                    padding: '11px 32px', fontSize: 12, fontWeight: 600,
                    cursor: loadingMore ? 'default' : 'pointer',
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
                    opacity: loadingMore ? 0.5 : 1,
                  }}
                >
                  {loadingMore ? t('common.loading') : t('emerging.loadMore')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ArtistCard({ artist, navigate }: { artist: EmergingArtist; navigate: ReturnType<typeof useNavigate> }) {
  const { t } = useTranslation();
  const bio = artist.biography
    ? artist.biography.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 120).trim() + (artist.biography.length > 120 ? '…' : '')
    : null;

  return (
    <div
      className="emerging-card"
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.15s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={() => navigate(`/app/artists/${encodeURIComponent(artist.name)}`)}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.transform = 'none';
      }}
    >
      {/* Photo */}
      <div className="emerging-card-img" style={{ height: 200, background: 'var(--navy)', overflow: 'hidden', flexShrink: 0 }}>
        {artist.image_url ? (
          <img
            src={artist.image_url}
            alt={artist.name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 40, color: 'rgba(255,255,255,0.3)' }}>
              {artist.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="emerging-card-body" style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Badges row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(() => {
            const score = artist.momentum_score;
            let prefix: string, label: string, color: string, border: string;
            if (score !== null && score >= 70) {
              prefix = '◈'; label = t('emerging.earlyConviction'); color = 'var(--gold)'; border = 'rgba(198,168,90,0.4)';
            } else if (score !== null && score >= 50) {
              prefix = '↑'; label = t('emerging.earlySignal'); color = 'var(--gold)'; border = 'rgba(198,168,90,0.4)';
            } else if (score !== null && score >= 30) {
              prefix = '→'; label = t('emerging.underObservation'); color = 'var(--text-3)'; border = 'var(--border)';
            } else {
              prefix = '◉'; label = t('emerging.radarNautilus'); color = 'var(--text-3)'; border = 'var(--border)';
            }
            return (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                color, border: `1px solid ${border}`,
                borderRadius: 3, padding: '2px 7px', letterSpacing: '0.1em',
              }}>
                {prefix} {label}
              </span>
            );
          })()}
          {artist.source && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--text-3)', border: '1px solid var(--border)',
              borderRadius: 3, padding: '2px 7px', letterSpacing: '0.1em',
            }}>
              {artist.source}
            </span>
          )}
        </div>

        {/* Name */}
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--text)', lineHeight: 1.3 }}>
          {artist.name}
        </div>

        {/* Mobile: momentum score */}
        {artist.momentum_score != null && (
          <span className="emerging-card-score" style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', fontFamily: 'var(--font-mono)' }}>
            +{artist.momentum_score}%
          </span>
        )}

        {/* Bio excerpt */}
        {bio && (
          <p className="emerging-card-bio" style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, margin: 0, flex: 1 }}>
            {bio}
          </p>
        )}

        {/* CTA */}
        <div className="emerging-card-cta" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--electric)', letterSpacing: '0.05em', marginTop: 4 }}>
          {t('emerging.viewArtist')}
        </div>
      </div>

      {/* Mobile arrow */}
      <span className="emerging-card-arrow" style={{ fontSize: 16, color: 'var(--text-3)', flexShrink: 0, paddingRight: 12 }}>→</span>
    </div>
  );
}
