import { useState, useEffect } from 'react';
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
            {lot.estimate_low ? fmtPrice(lot.estimate_low) : '—'}
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

  const [marketStats, setMarketStats] = useState<{ total_lots: number; avg_score: number; exceptional: number }>({ total_lots: 0, avg_score: 0, exceptional: 0 });
  const [refreshKey, setRefreshKey]   = useState(0);
  const [userProfile, setUserProfile] = useState<{
    preferred_categories: string[];
    investment_budget: string | null;
  } | null>(null);
  const [selectionLots, setSelectionLots] = useState<any[]>([]);
  const [discoveryLots, setDiscoveryLots] = useState<any[]>([]);
  const [directLots, setDirectLots]       = useState<any[]>([]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = getToken();

    if (token) {
      fetch(`${BACKEND}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : null)
        .then((profile: any) => {
          if (!profile) return;
          setUserProfile({
            preferred_categories: profile.preferred_categories || [],
            investment_budget: profile.investment_budget || null,
          });

          const BUDGET_MAX: Record<string, number> = {
            under_500: 600,
            '500_2k': 2500,
            '2k_10k': 12000,
            '10k_50k': 60000,
            above_50k: 999999,
          };
          const budgetMax = profile.investment_budget
            ? BUDGET_MAX[profile.investment_budget] ?? 999999
            : 999999;
          const firstCat = profile.preferred_categories?.[0] || '';

          // Bloc 1 — Sélection pour vous
          const selUrl = new URL(`${BACKEND}/api/lots`);
          selUrl.searchParams.set('sort_by', 'deal_score');
          selUrl.searchParams.set('page_size', '4');
          selUrl.searchParams.set('min_score', '55');
          if (firstCat) selUrl.searchParams.set('category', firstCat);
          if (budgetMax < 999999) selUrl.searchParams.set('estimate_max', String(Math.round(budgetMax * 1.2)));
          cachedFetch(selUrl.toString(), { headers: { Authorization: `Bearer ${token}` } })
            .then((d: any) => setSelectionLots(d.items || []))
            .catch(() => {});

          // Bloc 2 — Signaux forts (global)
          cachedFetch(`${BACKEND}/api/lots?sort_by=deal_score&page_size=4&min_score=65`)
            .then((d: any) => setDiscoveryLots(d.items || []))
            .catch(() => {});

          // Bloc 3 — En direct des artistes
          cachedFetch(`${BACKEND}/api/lots?tab=primary&page_size=3&sort_by=deal_score`)
            .then((d: any) => setDirectLots(d.items || []))
            .catch(() => {});
        })
        .catch(() => {});
    }

    // Dashboard stats — total lots, avg score, deals today
    fetch(`${BACKEND}/api/lots/stats`)
      .then(r => r.json())
      .then((d: any) => {
        setMarketStats(prev => ({
          ...prev,
          total_lots: d.total_lots_tracked || prev.total_lots,
          avg_score: d.avg_deal_score ? Math.round(d.avg_deal_score) : prev.avg_score,
          exceptional: d.deals_detected_today ?? prev.exceptional,
        }));
      })
      .catch(() => {});
  }, [refreshKey]);

  return (
    <div style={{ minHeight: 'calc(100vh - 57px)', background: '#FAFAF8' }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '32px 48px 24px', borderBottom: '1px solid #E8E4DC', background: 'white', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
            {lang === 'fr' ? 'Votre sélection' : 'Your selection'}
            {userProfile?.preferred_categories?.length > 0 && (
              <span style={{ marginLeft: '8px', color: '#C6A85A' }}>
                · {userProfile.preferred_categories.slice(0, 2).join(' · ')}
                {userProfile.investment_budget && ` · ${{
                  under_500: '< €500', '500_2k': '€500–2k', '2k_10k': '€2k–10k',
                  '10k_50k': '€10k–50k', above_50k: '> €50k'
                }[userProfile.investment_budget] || ''}`}
              </span>
            )}
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 600, color: '#1A2A44', margin: 0, letterSpacing: '-0.01em' }}>
            {lang === 'fr' ? 'Ma Sélection' : 'My Selection'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {(!userProfile?.preferred_categories?.length) && (
            <button
              onClick={() => navigate('/app/onboarding')}
              style={{ fontSize: '12px', padding: '8px 16px', background: '#1A2A44', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              {lang === 'fr' ? 'Personnaliser ma sélection →' : 'Personalize my selection →'}
            </button>
          )}
          {userProfile?.preferred_categories?.length > 0 && (
            <button
              onClick={() => navigate('/app/onboarding')}
              style={{ fontSize: '12px', padding: '8px 16px', background: 'none', color: '#6B7280', border: '1px solid #E8E4DC', borderRadius: '6px', cursor: 'pointer' }}
            >
              {lang === 'fr' ? 'Modifier mes préférences' : 'Edit preferences'}
            </button>
          )}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#9CA3AF' }}>
            {marketStats.total_lots > 0 ? `${marketStats.total_lots.toLocaleString()} lots` : ''}
          </div>
        </div>
      </div>

      {/* ── MAIN FEED ── */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 48px' }}>

        {/* No profile banner */}
        {!userProfile?.preferred_categories?.length && (
          <div style={{ background: '#FBF5E9', border: '1px solid rgba(198,168,90,0.3)', borderRadius: '10px', padding: '20px 24px', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', fontWeight: 600, color: '#1A2A44', marginBottom: '4px' }}>
                {lang === 'fr' ? 'Personnalisez votre sélection' : 'Personalize your selection'}
              </div>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>
                {lang === 'fr'
                  ? 'Indiquez vos catégories et budget pour voir des œuvres qui vous correspondent vraiment.'
                  : 'Tell us your categories and budget to see artworks that truly match your taste.'}
              </div>
            </div>
            <button
              onClick={() => navigate('/app/onboarding')}
              style={{ flexShrink: 0, marginLeft: '24px', padding: '10px 20px', background: '#1A2A44', color: '#C6A85A', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {lang === 'fr' ? 'Compléter mon profil →' : 'Complete my profile →'}
            </button>
          </div>
        )}

        {/* BLOC 1 — Sélection pour vous */}
        {selectionLots.length > 0 && (
          <div style={{ marginBottom: '56px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 600, color: '#1A2A44', margin: '0 0 4px' }}>
                  {lang === 'fr' ? 'Sélection pour vous' : 'Selected for you'}
                </h2>
                <div style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                  {lang === 'fr' ? 'Basé sur votre profil' : 'Based on your profile'}
                </div>
              </div>
              <button onClick={() => navigate('/app/explore?tab=best')}
                style={{ fontSize: '12px', color: '#1A2A44', fontWeight: 600, background: 'none', border: '1px solid #E8E4DC', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>
                {lang === 'fr' ? 'Voir tout →' : 'View all →'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {selectionLots.map((lot: any) => (
                <LotCard key={lot.id} lot={lot} lang={lang} onClick={() => navigate(`/app/lot/${lot.id}`)} />
              ))}
            </div>
          </div>
        )}

        {/* BLOC 2 — Signaux forts */}
        {discoveryLots.length > 0 && (
          <div style={{ marginBottom: '56px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 600, color: '#1A2A44', margin: '0 0 4px' }}>
                  {lang === 'fr' ? 'Signaux forts' : 'Strong signals'}
                </h2>
                <div style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                  {lang === 'fr' ? 'Meilleures opportunités du moment' : 'Top opportunities right now'}
                </div>
              </div>
              <button onClick={() => navigate('/app/explore?tab=best')}
                style={{ fontSize: '12px', color: '#1A2A44', fontWeight: 600, background: 'none', border: '1px solid #E8E4DC', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>
                {lang === 'fr' ? 'Voir tout →' : 'View all →'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {discoveryLots.map((lot: any) => (
                <LotCard key={lot.id} lot={lot} lang={lang} onClick={() => navigate(`/app/lot/${lot.id}`)} />
              ))}
            </div>
          </div>
        )}

        {/* BLOC 3 — En direct des artistes */}
        {directLots.length > 0 && (
          <div style={{ marginBottom: '56px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 600, color: '#1A2A44', margin: '0 0 4px' }}>
                  {lang === 'fr' ? 'En direct des artistes' : 'Direct from artists'}
                </h2>
                <div style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                  {lang === 'fr' ? 'Sans commission galerie' : 'No gallery commission'}
                </div>
              </div>
              <button onClick={() => navigate('/app/explore?tab=primary')}
                style={{ fontSize: '12px', color: '#1A2A44', fontWeight: 600, background: 'none', border: '1px solid #E8E4DC', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer' }}>
                {lang === 'fr' ? 'Voir tout →' : 'View all →'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {directLots.map((lot: any) => (
                <LotCard key={lot.id} lot={lot} lang={lang} onClick={() => navigate(`/app/lot/${lot.id}`)} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {selectionLots.length === 0 && discoveryLots.length === 0 && directLots.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', color: '#1A2A44', marginBottom: '8px' }}>
              {lang === 'fr' ? 'Chargement de votre sélection…' : 'Loading your selection…'}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
