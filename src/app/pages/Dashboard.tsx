import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

function fmtPrice(n: number | null | undefined, currency = '€'): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${currency}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency}${(n / 1_000).toFixed(0)}K`;
  return `${currency}${Math.round(n)}`;
}

const _cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000;

async function cachedFetch(url: string, options?: RequestInit): Promise<any> {
  const now = Date.now();
  if (_cache[url] && now - _cache[url].ts < CACHE_TTL) return _cache[url].data;
  const resp = await fetch(url, options);
  const data = await resp.json();
  _cache[url] = { data, ts: now };
  return data;
}

function LotImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  if (!src) return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '22px', opacity: 0.2, fontFamily: 'var(--font-serif)', color: 'var(--border)' }}>◇</span></div>;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--bg-subtle)' }}>
      {!loaded && !error && <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />}
      {!error ? (
        <img src={src} alt={alt} loading="lazy" decoding="async"
          onLoad={() => setLoaded(true)} onError={() => setError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '22px', opacity: 0.2 }}>◎</span></div>
      )}
    </div>
  );
}

function getMicroInsight(lot: any, lang: string): string | null {
  const pct = lot.pct_below_low_estimate;
  const score = lot.deal_score ?? 0;
  if (pct && pct >= 30) return lang === 'fr' ? `${Math.round(pct)}% sous estimation` : `${Math.round(pct)}% below estimate`;
  if (pct && pct >= 15) return lang === 'fr' ? `Prix attractif · ${Math.round(pct)}% sous marché` : `Attractive price · ${Math.round(pct)}% below market`;
  if (score >= 85) return lang === 'fr' ? 'Conviction exceptionnelle' : 'Exceptional conviction';
  if (score >= 75) return lang === 'fr' ? 'Fort signal Nautilus' : 'Strong Nautilus signal';
  return null;
}

function LotCard({ lot, lang, onClick }: { lot: any; lang: string; onClick: () => void }) {
  const score = lot.deal_score ?? 0;
  const insight = getMicroInsight(lot, lang);
  const badge = {
    color: score >= 80 ? '#C0392B' : score >= 65 ? '#B8922A' : '#6B7280',
    bg: score >= 80 ? 'rgba(192,57,43,0.08)' : score >= 65 ? 'rgba(184,146,42,0.08)' : 'rgba(107,114,128,0.08)',
    border: score >= 80 ? 'rgba(192,57,43,0.2)' : score >= 65 ? 'rgba(184,146,42,0.2)' : 'rgba(107,114,128,0.15)',
  };
  return (
    <div onClick={onClick}
      style={{ background: 'white', border: '1px solid #E8E4DC', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = '#1A2A44'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 4px 16px rgba(26,42,68,0.08)'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = '#E8E4DC'; el.style.transform = 'none'; el.style.boxShadow = 'none'; }}
    >
      <div style={{ height: '200px', background: '#F7F4EF', flexShrink: 0 }}>
        <LotImage src={lot.image_url} alt={lot.title} />
      </div>
      <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {lot.artist_name_raw || lot.artist?.name || '—'}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2A44', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.title || '—'}
        </div>
        {insight && (
          <div style={{ fontSize: '11px', color: '#2563EB', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            ◆ {insight}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
            {lot.estimate_low_eur
              ? fmtPrice(lot.estimate_low_eur)
              : lot.estimate_low
                ? fmtPrice(lot.estimate_low)
                : '—'}
          </span>
          <span style={{ padding: '3px 8px', borderRadius: '4px', background: badge.bg, border: `1px solid ${badge.border}`, fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: badge.color }}>
            {Math.round(score)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const [userProfile, setUserProfile] = useState<{
    preferred_categories: string[];
    investment_budget: string | null;
  } | null>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalLots, setTotalLots] = useState(0);
  const profileLoadedRef = useRef(false);

  const BUDGET_MAX: Record<string, number> = {
    under_500: 600, '500_2k': 2500, '2k_10k': 12000,
    '10k_50k': 60000, above_50k: 999999,
  };

  const buildFetchUrl = (profile: any, pageNum: number) => {
    const url = new URL(`${BACKEND}/api/lots`);
    url.searchParams.set('sort_by', 'deal_score');
    url.searchParams.set('page_size', '12');
    url.searchParams.set('page', String(pageNum));
    url.searchParams.set('min_score', '50');
    const cats = profile?.preferred_categories || [];
    if (cats.length === 1) url.searchParams.set('category', cats[0]);
    else if (cats.length > 1) url.searchParams.set('categories', cats.join(','));
    const budgetMax = profile?.investment_budget
      ? BUDGET_MAX[profile.investment_budget] ?? 999999
      : 999999;
    if (budgetMax < 999999) url.searchParams.set('estimate_max', String(budgetMax));
    return url.toString();
  };

  // Load profile then first page
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BACKEND}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((profile: any) => {
        const p = {
          preferred_categories: profile?.preferred_categories || [],
          investment_budget: profile?.investment_budget || null,
        };
        setUserProfile(p);
        profileLoadedRef.current = true;
        const url = buildFetchUrl(p, 1);
        return cachedFetch(url, { headers: { Authorization: `Bearer ${token}` } });
      })
      .then((d: any) => {
        setLots((d?.items || []).map((l: any) => l));
        setTotalLots(d?.total || 0);
        setHasMore((d?.items || []).length === 12);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const token = getToken();
    const nextPage = page + 1;
    try {
      const url = buildFetchUrl(userProfile, nextPage);
      const d = await cachedFetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      const newItems = d?.items || [];
      setLots(prev => [...prev, ...newItems]);
      setPage(nextPage);
      setHasMore(newItems.length === 12);
    } catch {} finally { setLoadingMore(false); }
  };

  const hasProfile = (userProfile?.preferred_categories?.length ?? 0) > 0;

  return (
    <div style={{ minHeight: 'calc(100vh - 57px)', background: '#FAFAF8' }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '28px 48px 20px', borderBottom: '1px solid #E8E4DC', background: 'white', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
            {hasProfile ? (
              <span>
                {userProfile!.preferred_categories.slice(0, 3).join(' · ')}
                {userProfile!.investment_budget && ` · ${{
                  under_500: '< €500', '500_2k': '€500–2k', '2k_10k': '€2k–10k',
                  '10k_50k': '€10k–50k', above_50k: '> €50k'
                }[userProfile!.investment_budget] || ''}`}
              </span>
            ) : (
              <span>{lang === 'fr' ? 'Votre sélection personnalisée' : 'Your personal selection'}</span>
            )}
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 600, color: '#1A2A44', margin: 0, letterSpacing: '-0.01em' }}>
            {lang === 'fr' ? 'Ma Sélection' : 'My Selection'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/app/profile/preferences')}
            style={{ fontSize: '12px', padding: '8px 16px', background: 'none', color: '#6B7280', border: '1px solid #E8E4DC', borderRadius: '6px', cursor: 'pointer' }}
          >
            {lang === 'fr' ? (hasProfile ? 'Modifier mes préférences' : 'Personnaliser →') : (hasProfile ? 'Edit preferences' : 'Personalize →')}
          </button>
          {totalLots > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#9CA3AF' }}>
              {totalLots.toLocaleString()} {lang === 'fr' ? 'opportunités' : 'opportunities'}
            </div>
          )}
        </div>
      </div>

      {/* ── FEED ── */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 48px' }}>

        {/* No profile banner */}
        {!loading && !hasProfile && (
          <div style={{ background: '#FBF5E9', border: '1px solid rgba(198,168,90,0.25)', borderRadius: '12px', padding: '24px 28px', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 600, color: '#1A2A44', marginBottom: '6px' }}>
                {lang === 'fr' ? 'Nautilus apprend à vous connaître' : 'Nautilus is learning your taste'}
              </div>
              <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6 }}>
                {lang === 'fr'
                  ? 'Dites-nous ce que vous aimez et nous sélectionnons pour vous. En attendant, voici les meilleures opportunités du moment.'
                  : 'Tell us what you love and we\'ll curate for you. Meanwhile, here are today\'s top opportunities.'}
              </div>
            </div>
            <button
              onClick={() => navigate('/app/profile/preferences')}
              style={{ flexShrink: 0, padding: '12px 24px', background: '#1A2A44', color: '#C6A85A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}
            >
              {lang === 'fr' ? 'Personnaliser ma sélection →' : 'Personalize my selection →'}
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #E8E4DC', borderRadius: '10px', overflow: 'hidden' }}>
                <div className="skeleton" style={{ height: '200px' }} />
                <div style={{ padding: '14px' }}>
                  <div className="skeleton" style={{ height: '10px', width: '60%', marginBottom: '8px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ height: '14px', width: '90%', marginBottom: '8px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ height: '11px', width: '40%', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lots grid */}
        {!loading && lots.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {lots.map((lot: any) => (
              <LotCard key={lot.id} lot={lot} lang={lang} onClick={() => navigate(`/app/lot/${lot.id}`)} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && lots.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: '#1A2A44', marginBottom: '8px' }}>
              {lang === 'fr' ? 'Aucune opportunité trouvée' : 'No opportunities found'}
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '24px' }}>
              {lang === 'fr' ? 'Essayez de modifier vos préférences' : 'Try adjusting your preferences'}
            </div>
            <button onClick={() => navigate('/app/profile/preferences')}
              style={{ padding: '10px 20px', background: '#1A2A44', color: '#C6A85A', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              {lang === 'fr' ? 'Modifier mes préférences' : 'Edit preferences'}
            </button>
          </div>
        )}

        {/* Load more */}
        {!loading && hasMore && lots.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{ padding: '12px 32px', background: 'white', color: '#1A2A44', border: '1px solid #E8E4DC', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: loadingMore ? 'default' : 'pointer', opacity: loadingMore ? 0.6 : 1 }}
            >
              {loadingMore
                ? (lang === 'fr' ? 'Chargement…' : 'Loading…')
                : (lang === 'fr' ? 'Voir plus d\'opportunités' : 'Load more opportunities')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
