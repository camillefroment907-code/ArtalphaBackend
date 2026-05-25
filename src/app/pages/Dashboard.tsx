import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

const FX_TO_EUR: Record<string, number> = {
  EUR: 1.0, USD: 0.92, GBP: 1.17, SEK: 0.087,
  CHF: 1.05, DKK: 0.134, NOK: 0.087, JPY: 0.006,
  HKD: 0.118, AUD: 0.59, CAD: 0.68,
};

const BUDGET_MAX: Record<string, number> = {
  under_500: 600, '500_2k': 2500, '2k_10k': 12000,
  '10k_50k': 60000, above_50k: 999999,
};

function fmtPriceEur(amount: number | null | undefined, currency: string | null | undefined): string {
  if (!amount) return '—';
  const rate = FX_TO_EUR[currency?.toUpperCase() || 'EUR'] ?? 1;
  const eur = Math.round(amount * rate);
  return fmtPrice(eur);
}

function fmtPrice(n: number | null | undefined, currency = '€'): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${currency}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency}${(n / 1_000).toFixed(0)}K`;
  return `${currency}${Math.round(n)}`;
}

const _cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 0;

async function cachedFetch(url: string, options?: RequestInit): Promise<any> {
  const now = Date.now();
  if (_cache[url] && now - _cache[url].ts < CACHE_TTL) return _cache[url].data;
  const resp = await fetch(url, options);
  const data = await resp.json();
  _cache[url] = { data, ts: now };
  return data;
}

function buildFetchUrl(
  profile: any, pageNum: number,
  searchTerm: string, sort: string, cat: string,
): string {
  const url = new URL(`${BACKEND}/api/lots`);
  url.searchParams.set('sort_by', sort);
  url.searchParams.set('page_size', '12');
  url.searchParams.set('page', String(pageNum));
  url.searchParams.set('min_score', '50');
  if (searchTerm.trim()) url.searchParams.set('search', searchTerm.trim());
  const cats = cat ? [cat] : (profile?.preferred_categories || []);
  if (cats.length === 1) url.searchParams.set('category', cats[0]);
  else if (cats.length > 1) url.searchParams.set('categories', cats.join(','));
  const budgetMax = profile?.investment_budget
    ? BUDGET_MAX[profile.investment_budget] ?? 999999
    : 999999;
  if (budgetMax < 999999 && !searchTerm.trim()) url.searchParams.set('estimate_max', String(budgetMax));
  return url.toString();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LotImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  if (!src) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '22px', opacity: 0.2, fontFamily: 'var(--font-serif)', color: 'var(--border)' }}>◇</span>
    </div>
  );
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--bg-subtle)' }}>
      {!loaded && !error && <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />}
      {!error ? (
        <img src={src} alt={alt} loading="lazy" decoding="async"
          onLoad={() => setLoaded(true)} onError={() => setError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '22px', opacity: 0.2 }}>◎</span>
        </div>
      )}
    </div>
  );
}

function getMicroInsight(lot: any, lang: string): string | null {
  const pct = lot.pct_below_low_estimate;
  if (pct && pct >= 30) return lang === 'fr' ? `${Math.round(pct)}% sous estimation` : `${Math.round(pct)}% below estimate`;
  if (pct && pct >= 15) return lang === 'fr' ? `Prix attractif · ${Math.round(pct)}% sous marché` : `Attractive price · ${Math.round(pct)}% below market`;
  return null;
}

function HeartButton({ lotId, wishlisted, onToggle }: { lotId: string; wishlisted: boolean; onToggle: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(lotId); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={wishlisted ? 'Retirer de ma wishlist' : 'Ajouter à ma wishlist'}
      style={{
        position: 'absolute', top: '10px', right: '10px',
        width: '32px', height: '32px',
        background: wishlisted ? 'rgba(198,168,90,0.95)' : 'rgba(255,255,255,0.88)',
        border: `1px solid ${wishlisted ? 'rgba(198,168,90,0.5)' : 'rgba(232,228,220,0.9)'}`,
        borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', transition: 'all 0.15s',
        backdropFilter: 'blur(4px)',
        transform: hovered ? 'scale(1.12)' : 'scale(1)',
        boxShadow: wishlisted ? '0 2px 8px rgba(198,168,90,0.35)' : '0 1px 4px rgba(0,0,0,0.08)',
        zIndex: 2, color: wishlisted ? 'white' : '#9CA3AF',
      }}
    >
      {wishlisted ? '♥' : '♡'}
    </button>
  );
}

function LotCard({ lot, lang, onClick, wishlisted, onWishlistToggle }: {
  lot: any; lang: string; onClick: () => void; wishlisted: boolean; onWishlistToggle: (id: string) => void;
}) {
  const score = lot.deal_score ?? 0;
  const insight = getMicroInsight(lot, lang);
  const badge = {
    color: score >= 80 ? '#1A6B3C' : score >= 65 ? '#B8922A' : '#6B7280',
    bg: score >= 80 ? 'rgba(26,107,60,0.08)' : score >= 65 ? 'rgba(184,146,42,0.08)' : 'rgba(107,114,128,0.08)',
    border: score >= 80 ? 'rgba(26,107,60,0.2)' : score >= 65 ? 'rgba(184,146,42,0.2)' : 'rgba(107,114,128,0.15)',
  };
  const label = score >= 90 ? 'Exceptionnel' : score >= 80 ? 'Très fort' : score >= 65 ? 'Opportunité' : 'À surveiller';
  return (
    <div onClick={onClick}
      style={{ background: 'white', border: '1px solid #E8E4DC', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = '#1A2A44'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 4px 16px rgba(26,42,68,0.08)'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = '#E8E4DC'; el.style.transform = 'none'; el.style.boxShadow = 'none'; }}
    >
      <div style={{ height: '200px', background: '#F7F4EF', flexShrink: 0, position: 'relative' }}>
        <LotImage src={lot.image_url} alt={lot.title} />
        <HeartButton lotId={lot.id} wishlisted={wishlisted} onToggle={onWishlistToggle} />
      </div>
      <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {lot.artist_name_raw || lot.artist?.name || '—'}
        </div>
        {insight && (
          <div style={{ fontSize: '11px', color: '#2563EB', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            ◆ {insight}
          </div>
        )}
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2A44', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lot.title || '—'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
            {fmtPriceEur(lot.estimate_low, lot.currency)}
          </span>
          <span style={{ padding: '3px 8px', borderRadius: '4px', background: badge.bg, border: `1px solid ${badge.border}`, fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: badge.color }}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: '20px',
      border: `1px solid ${active ? '#1A2A44' : '#E8E4DC'}`,
      background: active ? '#1A2A44' : 'transparent',
      color: active ? 'white' : '#6B7280',
      fontSize: '12px', fontWeight: active ? 600 : 400,
      cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

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

  // Search + filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'deal_score' | 'auction_date' | 'created_at'>('deal_score');
  const [activeCategory, setActiveCategory] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wishlist
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  // ── Load profile + wishlist IDs on mount ──────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    fetch(`${BACKEND}/api/wishlist/ids`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((ids: string[]) => setWishlistIds(new Set(ids)))
      .catch(() => {});

    fetch(`${BACKEND}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((profile: any) => {
        setUserProfile({
          preferred_categories: profile?.preferred_categories || [],
          investment_budget: profile?.investment_budget || null,
        });
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Fetch lots whenever profile or filters change ─────────────────────────
  useEffect(() => {
    if (userProfile === null) return;
    setLoading(true);
    const token = getToken();
    const url = buildFetchUrl(userProfile, 1, search, sortBy, activeCategory);
    cachedFetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((d: any) => {
        setLots(d?.items || []);
        setTotalLots(d?.total || 0);
        setHasMore((d?.items || []).length === 12);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userProfile, search, sortBy, activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load more ─────────────────────────────────────────────────────────────
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const token = getToken();
    const nextPage = page + 1;
    try {
      const url = buildFetchUrl(userProfile, nextPage, search, sortBy, activeCategory);
      const d = await cachedFetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      const newItems = d?.items || [];
      setLots(prev => [...prev, ...newItems]);
      setPage(nextPage);
      setHasMore(newItems.length === 12);
    } catch {} finally { setLoadingMore(false); }
  };

  // ── Search debounce ───────────────────────────────────────────────────────
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearch(val), 350);
  };

  // ── Wishlist toggle ───────────────────────────────────────────────────────
  const toggleWishlist = async (lotId: string) => {
    const token = getToken();
    if (!token) return;
    const isWishlisted = wishlistIds.has(lotId);
    setWishlistIds(prev => {
      const next = new Set(prev);
      isWishlisted ? next.delete(lotId) : next.add(lotId);
      return next;
    });
    try {
      await fetch(`${BACKEND}/api/wishlist/${lotId}`, {
        method: isWishlisted ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setWishlistIds(prev => {
        const next = new Set(prev);
        isWishlisted ? next.add(lotId) : next.delete(lotId);
        return next;
      });
    }
  };

  const hasProfile = (userProfile?.preferred_categories?.length ?? 0) > 0;
  const profileCats = userProfile?.preferred_categories || [];

  // Client-side budget safety filter — belt-and-suspenders in case API cache serves stale results
  const budgetCap = userProfile?.investment_budget ? BUDGET_MAX[userProfile.investment_budget] ?? 999999 : 999999;
  const displayLots = budgetCap < 999999
    ? lots.filter((lot: any) => {
        if (!lot.estimate_low) return true;
        const rate = FX_TO_EUR[lot.currency?.toUpperCase() || 'EUR'] ?? 1;
        return Math.round(lot.estimate_low * rate) <= budgetCap;
      })
    : lots;

  const SORT_OPTIONS = [
    { key: 'deal_score' as const,   label: 'Meilleures opportunités' },
    { key: 'auction_date' as const, label: 'Date de vente' },
    { key: 'created_at' as const,   label: 'Récents' },
  ];

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
            {hasProfile
              ? (lang === 'fr' ? 'Modifier mes préférences' : 'Edit preferences')
              : (lang === 'fr' ? 'Personnaliser →' : 'Personalize →')}
          </button>
          {totalLots > 0 && !loading && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#9CA3AF' }}>
              {totalLots.toLocaleString()} {lang === 'fr' ? 'opportunités' : 'opportunities'}
            </div>
          )}
        </div>
      </div>

      {/* ── SEARCH + FILTERS BAR ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #E8E4DC', padding: '16px 48px' }}>

        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <span style={{
            position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '16px', color: '#9CA3AF', pointerEvents: 'none', lineHeight: 1,
          }}>
            ⌕
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder={lang === 'fr' ? 'Rechercher un artiste, une œuvre…' : 'Search artist, artwork…'}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 36px 10px 38px',
              border: '1px solid #E8E4DC', borderRadius: '8px',
              fontSize: '13px', color: '#1A2A44', background: '#FAFAF8',
              outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#1A2A44')}
            onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); }}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                fontSize: '18px', lineHeight: 1, padding: 0,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Sort */}
          <div style={{ display: 'flex', gap: '4px', paddingRight: '12px', borderRight: profileCats.length > 1 ? '1px solid #E8E4DC' : 'none' }}>
            {SORT_OPTIONS.map(opt => (
              <Pill key={opt.key} label={opt.label} active={sortBy === opt.key} onClick={() => setSortBy(opt.key)} />
            ))}
          </div>

          {/* Category chips — only if user has multiple prefs */}
          {profileCats.length > 1 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <Pill label={lang === 'fr' ? 'Toutes' : 'All'} active={activeCategory === ''} onClick={() => setActiveCategory('')} />
              {profileCats.map(cat => (
                <Pill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(cat === activeCategory ? '' : cat)} />
              ))}
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
                  : "Tell us what you love and we'll curate for you. Meanwhile, here are today's top opportunities."}
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

        {/* Loading skeleton */}
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
        {!loading && displayLots.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {displayLots.map((lot: any) => (
              <LotCard
                key={lot.id}
                lot={lot}
                lang={lang}
                onClick={() => navigate(`/app/lot/${lot.id}`)}
                wishlisted={wishlistIds.has(lot.id)}
                onWishlistToggle={toggleWishlist}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && displayLots.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: '#1A2A44', marginBottom: '8px' }}>
              {search
                ? (lang === 'fr' ? 'Aucun résultat pour cette recherche' : 'No results found')
                : (lang === 'fr' ? 'Aucune opportunité trouvée' : 'No opportunities found')}
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '24px' }}>
              {search
                ? (lang === 'fr' ? 'Essayez un autre terme ou élargissez les filtres' : 'Try a different term or broaden your filters')
                : (lang === 'fr' ? 'Essayez de modifier vos préférences' : 'Try adjusting your preferences')}
            </div>
            {!search && (
              <button onClick={() => navigate('/app/profile/preferences')}
                style={{ padding: '10px 20px', background: '#1A2A44', color: '#C6A85A', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                {lang === 'fr' ? 'Modifier mes préférences' : 'Edit preferences'}
              </button>
            )}
          </div>
        )}

        {/* Load more */}
        {!loading && hasMore && displayLots.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{ padding: '12px 32px', background: 'white', color: '#1A2A44', border: '1px solid #E8E4DC', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: loadingMore ? 'default' : 'pointer', opacity: loadingMore ? 0.6 : 1 }}
            >
              {loadingMore
                ? (lang === 'fr' ? 'Chargement…' : 'Loading…')
                : (lang === 'fr' ? "Voir plus d'opportunités" : 'Load more opportunities')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
