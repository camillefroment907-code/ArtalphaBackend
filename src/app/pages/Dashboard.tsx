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

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const [topLots, setTopLots]               = useState<any[]>([]);
  const [sentiment, setSentiment]           = useState<any>(null);
  const [marketStats, setMarketStats]       = useState<{ total_lots: number; avg_score: number; exceptional: number }>({ total_lots: 0, avg_score: 0, exceptional: 0 });
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [agentAlerts, setAgentAlerts]       = useState<any[]>([]);
  const [brief, setBrief]                   = useState<string>('');
  const [refreshKey, setRefreshKey]         = useState(0);
  const [closingSoonCount, setClosingSoonCount] = useState(0);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Dashboard stats — total lots, avg score, deals today, real source count
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

    // Top picks: best-scored lots closing in the next 30 days
    cachedFetch(`${BACKEND}/api/lots/closing-today?days=30&limit=6&min_score=60`)
      .then((d: any) => {
        setTopLots(d.items || []);
      })
      .catch(() => {});

    // Closing soon count — dedicated fetch with wider net (days=1, no score filter)
    fetch(`${BACKEND}/api/lots/closing-today?days=1&limit=50&min_score=0`)
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => { if (d) setClosingSoonCount(d.total); })
      .catch(() => {});

    // Market sentiment
    cachedFetch(`${BACKEND}/api/market/sentiment`)
      .then((d: any) => { if (d?.segments) setSentiment(d); })
      .catch(() => {});


    // Portfolio
    if (token) {
      cachedFetch(`${BACKEND}/api/portfolio/items`, { headers })
        .then((d: any) => {
          const items: any[] = d.items || d || [];
          setPortfolioItems(items);
        })
        .catch(() => {});

      // Agent alerts
      cachedFetch(`${BACKEND}/api/agent/alerts`, { headers })
        .then((d: any) => setAgentAlerts(d.alerts || (Array.isArray(d) ? d : [])))
        .catch(() => {});
    }
  }, [refreshKey]);

  // AI Market Brief — dedicated dashboard-brief endpoint
  useEffect(() => {
    if (topLots.length === 0) return;
    const token = getToken();
    if (!token) return;
    fetch(`${BACKEND}/api/chat/dashboard-brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Accept-Language': lang },
    })
      .then(r => r.ok ? r.json() : null)
      .then((d: any) => { if (d?.brief) setBrief(d.brief); })
      .catch(() => {});
  }, [topLots]);

  // ── Derived values for Key Insights ──────────────────────────
  const estimationBias = topLots.length > 0
    ? Math.round(topLots.reduce((s, l) => s + (l.pct_below_low_estimate ?? 0), 0) / topLots.length)
    : 0;
  const bestUpside = topLots.length > 0
    ? Math.round(Math.max(...topLots.map(l => l.pct_below_low_estimate ?? 0)))
    : 0;
  const exceptionalLots = topLots.filter(l => (l.deal_score ?? 0) >= 80);
  const nowMs = Date.now();
  const closingSoon = topLots.filter(l => {
    if (!l.auction_date) return false;
    const diff = new Date(l.auction_date).getTime() - nowMs;
    return diff > 0 && diff < 86_400_000;
  });

  // Score badge color
  const scoreBadge = (ds: number) => ({
    color: ds >= 80 ? '#C0392B' : ds >= 65 ? '#B8922A' : '#6B7280',
    bg: ds >= 80 ? 'rgba(192,57,43,0.10)' : ds >= 65 ? 'rgba(184,146,42,0.10)' : 'rgba(107,114,128,0.10)',
    border: ds >= 80 ? 'rgba(192,57,43,0.25)' : ds >= 65 ? 'rgba(184,146,42,0.25)' : 'rgba(107,114,128,0.20)',
  });

  return (
    <div style={{ height: 'calc(100vh - 57px)', background: '#FAFAF8', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ══════════════════════════════════════════════
          HERO — full width, cream, no dark background
      ══════════════════════════════════════════════ */}
      <div style={{
        background: '#FAFAF8',
        borderBottom: '1px solid #E8E4DC',
        padding: '28px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {/* Left: headline */}
        <div>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: '26px',
            fontWeight: 600,
            color: '#1A2A44',
            margin: '0 0 5px',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}>
            {t('dashboard.heroTitle')}
          </h1>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#9CA3AF',
            margin: 0,
            letterSpacing: '0.08em',
          }}>
            {t('dashboard.heroSubtitle')}
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', marginLeft: '8px', verticalAlign: 'middle', animation: 'pulse 2s infinite' }} />
          </p>
        </div>

        {/* Right: 3 inline stats */}
        <div style={{ display: 'flex', gap: '0', border: '1px solid #E8E4DC', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
          {[
            {
              label: t('dashboard.statsAvgConviction'),
              value: marketStats.avg_score > 0 ? `${marketStats.avg_score}/100` : '—',
              accent: '#1A2A44',
            },
            {
              label: t('dashboard.statsMarket'),
              value: sentiment?.overall === 'BULLISH' ? 'Fenêtre d\'achat' : sentiment?.overall === 'BEARISH' ? 'Momentum faible' : 'Marché stable',
              accent: sentiment?.overall === 'BULLISH' ? '#2563EB' : '#6B7280',
            },
          ].map(({ label, value, accent }, i) => (
            <div key={label} style={{
              padding: '14px 28px',
              borderRight: i < 1 ? '1px solid #E8E4DC' : 'none',
              textAlign: 'center',
              minWidth: '110px',
            }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 700, color: accent, lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#9CA3AF', marginTop: '4px', letterSpacing: '0.06em' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MAIN BODY — left scroll + right sidebar
      ══════════════════════════════════════════════ */}
      <div className="dashboard-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>

        {/* LEFT — scrollable main */}
        <div className="no-scrollbar" style={{ overflowY: 'auto', padding: '28px 32px', borderRight: '1px solid #E8E4DC' }}>

          {/* ── Section header ── */}
          <div className="dashboard-desktop-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 600, color: '#1A2A44', margin: 0 }}>
                {t('dashboard.bestOpps')}
              </h2>
            </div>
            <button
              onClick={() => navigate('/app/explore?tab=best')}
              style={{ fontSize: '12px', color: 'var(--electric)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.01em' }}
            >
              {t('dashboard.viewAll')}
            </button>
          </div>

          {/* ── 4 opportunity cards ── */}
          <div className="dashboard-desktop-only" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {topLots.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ borderRadius: '10px', height: '280px' }} />
                ))
              : topLots.slice(0, 4).map((lot: any) => {
                  const ds = lot.deal_score ?? 0;
                  const badge = scoreBadge(ds);
                  const upside = Math.round(lot.pct_below_low_estimate ?? 0);
                  const realCost = lot.real_cost?.cost_basis;
                  return (
                    <div
                      key={lot.id}
                      onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                      style={{ background: 'white', border: '1px solid #E8E4DC', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.18s, transform 0.18s' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.09)'; el.style.transform = 'translateY(-3px)'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'none'; el.style.transform = 'none'; }}
                    >
                      {/* Image 4/3 */}
                      <div style={{ position: 'relative', paddingTop: '75%', background: '#F3F0EB', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0 }}>
                          <LotImage src={lot.image_url} alt={lot.title} />
                        </div>
                        {/* Score badge */}
                        <div style={{
                          position: 'absolute', top: '9px', right: '9px',
                          background: badge.bg, border: `1px solid ${badge.border}`,
                          borderRadius: '5px', padding: '3px 8px',
                          fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                          color: badge.color, backdropFilter: 'blur(4px)',
                        }}>
                          {Math.round(ds)}
                        </div>
                      </div>

                      {/* Info */}
                      <div style={{ padding: '12px 14px 14px' }}>
                        <div style={{
                          fontSize: '9px', fontWeight: 800, color: '#9CA3AF',
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
                          textTransform: 'uppercase', marginBottom: '3px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {lot.artist_name_raw || lot.artist?.name || 'Unknown Artist'}
                        </div>
                        <div style={{
                          fontFamily: 'Georgia, serif', fontSize: '13px', fontWeight: 600,
                          color: '#1A2A44', marginBottom: '12px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {lot.title || 'Untitled'}
                        </div>

                        {/* 3-column bottom row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', borderTop: '1px solid #F0EDE8', paddingTop: '10px' }}>
                          <div>
                            <div style={{ fontSize: '9px', color: '#9CA3AF', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: '2px' }}>{t('dashboard.colEst')}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                              {fmtPrice(lot.estimate_low)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', color: '#9CA3AF', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: '2px' }}>{t('dashboard.colCost')}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                              {fmtPrice(realCost ?? lot.current_price)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', color: '#9CA3AF', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', marginBottom: '2px' }}>{t('dashboard.colUpside')}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 800, color: upside > 0 ? '#059669' : '#9CA3AF' }}>
                              {upside > 0 ? `+${upside}%` : '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>

          {/* ── KEY INSIGHTS ROW ── */}
          <div className="dashboard-desktop-only" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            background: 'white', border: '1px solid #E8E4DC', borderRadius: '10px',
            overflow: 'hidden', marginBottom: '24px',
          }}>
            {[
              {
                icon: '↓',
                iconColor: '#2563EB',
                value: estimationBias > 0 ? `-${estimationBias}%` : '—',
                label: t('dashboard.kpiBelowEst'),
                sub: t('dashboard.kpiAvgBias'),
              },
              {
                icon: '↑',
                iconColor: '#059669',
                value: bestUpside > 0 ? `+${bestUpside}%` : '—',
                label: t('dashboard.kpiBestUpside'),
                sub: t('dashboard.kpiMaxPotential'),
              },
              {
                icon: '⏱',
                iconColor: '#D97706',
                value: closingSoonCount > 0 ? closingSoonCount.toString() : '0',
                label: t('dashboard.kpiClosingSoon'),
                sub: t('dashboard.kpiWithin24h'),
              },
            ].map(({ icon, iconColor, value, label, sub }, i) => (
              <div key={label} style={{
                padding: '20px 22px',
                borderRight: i < 2 ? '1px solid #E8E4DC' : 'none',
                display: 'flex', flexDirection: 'column', gap: '4px',
              }}>
                <div style={{ fontSize: '18px', color: iconColor, lineHeight: 1, marginBottom: '4px' }}>{icon}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1A2A44', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#9CA3AF', letterSpacing: '0.04em' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ── RECENT EXCEPTIONAL TABLE ── */}
          <div className="dashboard-desktop-only" style={{ background: 'white', border: '1px solid #E8E4DC', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #E8E4DC' }}>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '15px', fontWeight: 600, color: '#1A2A44', margin: 0 }}>
                {t('dashboard.recentExceptional')}
              </h3>
              <button
                onClick={() => navigate('/app/explore?tab=best')}
                style={{ fontSize: '12px', color: 'var(--electric)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {t('dashboard.viewAll')}
              </button>
            </div>

            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 90px 90px 90px 60px 36px',
              gap: '8px', padding: '9px 20px',
              background: '#F7F4EF',
              borderBottom: '1px solid #E8E4DC',
            }}>
              {[t('dashboard.colArtwork'), t('dashboard.colArtist'), t('dashboard.colEstValue'), t('dashboard.colRealCost'), t('dashboard.colUpside'), t('dashboard.colScore'), ''].map(h => (
                <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {topLots.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: '52px', margin: '6px 20px', borderRadius: '4px' }} />
                ))
              : topLots.slice(0, 5).map((lot: any) => {
                  const ds = lot.deal_score ?? 0;
                  const badge = scoreBadge(ds);
                  const upside = Math.round(lot.pct_below_low_estimate ?? 0);
                  const realCost = lot.real_cost?.cost_basis;
                  const trend = ds >= 75 ? '↑' : ds >= 60 ? '→' : '↓';
                  const trendColor = ds >= 75 ? '#059669' : ds >= 60 ? '#D97706' : '#9CA3AF';
                  return (
                    <div
                      key={lot.id}
                      onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                      style={{
                        display: 'grid', gridTemplateColumns: '2fr 1.2fr 90px 90px 90px 60px 36px',
                        gap: '8px', padding: '12px 20px',
                        borderBottom: '1px solid #F0EDE8',
                        cursor: 'pointer', alignItems: 'center', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAF8'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'white'; }}
                    >
                      {/* Artwork */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: '#F3F0EB' }}>
                          <LotImage src={lot.image_url} alt="" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A2A44', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lot.title || 'Untitled'}
                          </div>
                          <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lot.auction_house_name || lot.source || '—'}
                          </div>
                        </div>
                      </div>
                      {/* Artist */}
                      <div style={{ fontSize: '12px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lot.artist_name_raw || lot.artist?.name || '—'}
                      </div>
                      {/* Est. Value */}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#374151' }}>
                        {fmtPrice(lot.estimate_low)}
                      </div>
                      {/* Real Cost */}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#374151' }}>
                        {fmtPrice(realCost ?? lot.current_price)}
                      </div>
                      {/* Upside */}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: upside > 0 ? '#059669' : '#9CA3AF' }}>
                        {upside > 0 ? `+${upside}%` : '—'}
                      </div>
                      {/* Score */}
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: '3px 8px', borderRadius: '4px',
                        background: badge.bg, border: `1px solid ${badge.border}`,
                        fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: badge.color,
                      }}>
                        {Math.round(ds)}
                      </div>
                      {/* Trend */}
                      <div style={{ fontSize: '16px', fontWeight: 700, color: trendColor, textAlign: 'center' }}>
                        {trend}
                      </div>
                    </div>
                  );
                })}
          </div>

          {/* ── MOBILE VIEW ── */}
          <div className="dashboard-mobile-only" style={{ display: 'none' }}>

            {/* 3 métriques clés */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: lang === 'fr' ? 'Lots suivis' : 'Lots tracked',     value: marketStats.total_lots > 0 ? marketStats.total_lots.toLocaleString() : '—' },
                { label: lang === 'fr' ? 'Score moyen' : 'Avg score',        value: marketStats.avg_score > 0 ? `${marketStats.avg_score}/100` : '—' },
                { label: lang === 'fr' ? 'Score ≥ 80' : 'Score ≥ 80',        value: marketStats.exceptional > 0 ? marketStats.exceptional.toString() : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'white', border: '1px solid #E8E4DC', borderRadius: '10px', padding: '14px 10px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#1A2A44', lineHeight: 1 }}>{value}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#9CA3AF', marginTop: '4px', letterSpacing: '0.06em' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Titre section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '15px', fontWeight: 600, color: '#1A2A44', margin: 0 }}>
                {t('dashboard.recentExceptional')}
              </h3>
            </div>

            {/* 4 lots en cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {(topLots.length === 0 ? Array.from({ length: 4 }) : topLots.slice(0, 4)).map((lot: any, i: number) => {
                if (!lot) return <div key={i} className="skeleton" style={{ height: '72px', borderRadius: '10px' }} />;
                const ds = lot.deal_score ?? 0;
                const badge = scoreBadge(ds);
                const upside = Math.round(lot.pct_below_low_estimate ?? 0);
                return (
                  <div key={lot.id || i} onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                    style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'white', border: '1px solid #E8E4DC', borderRadius: '10px', padding: '12px', cursor: 'pointer' }}
                  >
                    <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#F3F0EB' }}>
                      <LotImage src={lot.image_url} alt="" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1A2A44', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lot.title || '—'}</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lot.auction_house_name || ''}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                      {upside > 0 && (
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', fontFamily: 'var(--font-mono)' }}>+{upside}%</span>
                      )}
                      <span style={{ padding: '2px 7px', borderRadius: '4px', background: badge.bg, border: `1px solid ${badge.border}`, fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: badge.color }}>
                        {Math.round(ds)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bouton voir tous */}
            <button
              onClick={() => navigate('/app/explore')}
              style={{ width: '100%', padding: '13px', background: '#1A2A44', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}
            >
              {lang === 'fr' ? 'Voir tous les signaux →' : 'View all signals →'}
            </button>
          </div>

        </div>

        {/* ══════════════════════════════════════════════
            RIGHT SIDEBAR — 320px
        ══════════════════════════════════════════════ */}
        <div className="no-scrollbar dashboard-sidebar dashboard-desktop-only" style={{ overflowY: 'auto', background: 'white', borderLeft: '1px solid #E8E4DC' }}>

          {/* Market Activity */}
          <div style={{ padding: '20px', borderBottom: '1px solid #E8E4DC' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '15px', fontWeight: 600, color: '#1A2A44', margin: '0 0 14px' }}>
              {t('dashboard.marketActivity')}
            </h3>
            {[
              { label: t('dashboard.auctionLots'), sub: t('dashboard.globalCoverage'), value: marketStats.total_lots > 0 ? marketStats.total_lots.toLocaleString() : '—' },
              { label: t('dashboard.avgDealScore'), sub: t('dashboard.currentSelection'), value: marketStats.avg_score > 0 ? `${marketStats.avg_score}/100` : '—' },
              { label: t('dashboard.exceptionalLots'), sub: lang === 'fr' ? "Nouveaux deals aujourd'hui" : 'New deals today', value: marketStats.exceptional > 0 ? marketStats.exceptional.toString() : '—' },
            ].map(({ label, sub, value }, i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? '1px solid #F0EDE8' : 'none' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{label}</div>
                  <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{sub}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: '#1A2A44' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Market Sentiment */}
          {sentiment && (
            <div style={{ padding: '20px', borderBottom: '1px solid #E8E4DC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '15px', fontWeight: 600, color: '#1A2A44', margin: 0 }}>
                  {t('dashboard.marketSentiment')}
                </h3>
                <span style={{
                  fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '3px', letterSpacing: '0.1em',
                  background: sentiment.overall === 'BULLISH' ? 'var(--electric-subtle)' : '#F7F4EF',
                  color: sentiment.overall === 'BULLISH' ? 'var(--electric)' : '#9CA3AF',
                  border: `1px solid ${sentiment.overall === 'BULLISH' ? 'var(--electric-border)' : '#E8E4DC'}`,
                }}>
                  {sentiment.overall}
                </span>
              </div>
              {sentiment.segments?.slice(0, 5).map((seg: any) => (
                <div key={seg.segment} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#6B7280', width: '100px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.segment}</div>
                  <div style={{ flex: 1, height: '3px', background: '#F0EDE8', borderRadius: '2px' }}>
                    <div style={{ height: '100%', borderRadius: '2px', width: `${Math.min(seg.avg_score, 100)}%`, background: seg.sentiment === 'BULLISH' ? '#2563EB' : seg.sentiment === 'BEARISH' ? '#EF4444' : '#E8E4DC', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#9CA3AF', width: '28px', textAlign: 'right', flexShrink: 0 }}>{seg.avg_score}</div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div style={{ padding: '20px' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '15px', fontWeight: 600, color: '#1A2A44', margin: '0 0 12px' }}>
              {t('dashboard.quickActions')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: t('dashboard.browseOpportunities'), sub: t('dashboard.lotsAvailableCount', { count: marketStats.total_lots > 0 ? marketStats.total_lots.toLocaleString() : '—' }), icon: '◆', to: '/app/explore?tab=best' },
                { label: t('dashboard.viewConvictions'), sub: t('dashboard.aiHighestConviction'), icon: '★', to: '/app/explore?tab=convictions' },
                { label: t('dashboard.myPortfolio'), sub: t('dashboard.worksTracked', { count: portfolioItems.length }), icon: '◐', to: '/app/portfolio' },
                { label: t('dashboard.askLarry'), sub: t('dashboard.aiAdvisor'), icon: '◎', to: '/app/agent' },
              ].map(({ label, sub, icon, to }) => (
                <div
                  key={to}
                  onClick={() => navigate(to)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '7px', border: '1px solid #E8E4DC', cursor: 'pointer', transition: 'background 0.1s, border-color 0.1s', background: 'white' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.background = '#FAFAF8'; el.style.borderColor = '#1A2A44'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.background = 'white'; el.style.borderColor = '#E8E4DC'; }}
                >
                  <span style={{ fontSize: '14px', color: '#1A2A44', flexShrink: 0, width: '20px', textAlign: 'center' }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A2A44' }}>{label}</div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{sub}</div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0 }}>→</span>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Signals (if any) */}
          {agentAlerts.length > 0 && (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '15px', fontWeight: 600, color: '#1A2A44', margin: 0 }}>{t('dashboard.agentSignals')}</h3>
                <button onClick={() => navigate('/app/agent')} style={{ fontSize: '12px', color: 'var(--electric)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                  {t('dashboard.manage')}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {agentAlerts.slice(0, 3).map((alert: any, i: number) => (
                  <div key={alert.id || i} style={{ background: '#FAFAF8', border: '1px solid #E8E4DC', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '1px' }}>{alert.name || alert.strategy_type || 'Signal'}</div>
                      <div style={{ fontSize: '10px', color: '#9CA3AF' }}>{alert.budget_max_eur ? `Budget max : ${fmtPrice(alert.budget_max_eur)}` : alert.artist_name ? alert.artist_name : ''}</div>
                    </div>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: alert.is_active ? '#34D399' : '#E8E4DC', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
