import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getToken, getUserPlan } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

const trackEvent = async (eventType: string, entityType: string, entityId: string, properties: Record<string, any> = {}) => {
  try {
    const token = getToken ? getToken() : localStorage.getItem('token');
    if (!token) return;
    await fetch(`${BACKEND}/api/agent/track-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event_type: eventType, entity_type: entityType, entity_id: entityId, properties })
    });
  } catch {}
};

// ── Price chart ───────────────────────────────────────────────────────────────

interface YearPoint { year: string; avg_price: number; max_price: number; sale_count: number; }

function PriceChart({ data, stats }: { data: YearPoint[]; stats: any }) {
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');
  const [hovered, setHovered] = useState<number | null>(null);

  if (!data || data.length < 2) return null;

  const W = 840, H = 220;
  const PAD = { top: 28, right: 28, bottom: 44, left: 80 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // ── Year bounds derived from data ─────────────────────────────────────────
  const years = data.map(d => parseInt(d.year)).sort((a, b) => a - b);
  const minYear = years[0];
  const maxYear = years[years.length - 1];

  // ── Outlier-resistant Y scale (cap at 95th percentile * 1.3) ──────────────
  const sorted = [...data].map(d => d.avg_price).sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
  const peakVal = Math.max(...data.map(d => d.avg_price));
  const hasMassiveOutlier = peakVal > p95 * 2.5;
  const yMax = hasMassiveOutlier ? p95 * 1.5 : peakVal * 1.18;
  const peakIdx = data.reduce((mi, d, i) => d.avg_price > data[mi].avg_price ? i : mi, 0);

  const xPos = (year: number) => PAD.left + ((year - minYear) / Math.max(maxYear - minYear, 1)) * innerW;
  const yPos = (v: number) => PAD.top + innerH - (Math.min(v, yMax) / yMax) * innerH;

  // ── Smooth monotone cubic bezier ─────────────────────────────────────────
  const pts = data.map(d => ({ x: xPos(parseInt(d.year)), y: yPos(d.avg_price) }));
  let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) * 0.38;
    linePath += ` C ${(pts[i].x + dx).toFixed(1)} ${pts[i].y.toFixed(1)}, ${(pts[i + 1].x - dx).toFixed(1)} ${pts[i + 1].y.toFixed(1)}, ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`;
  }
  const baseY = (PAD.top + innerH).toFixed(1);
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${baseY} L ${pts[0].x.toFixed(1)} ${baseY} Z`;

  // ── Smart X labels: max 8, always include endpoints + decade marks ────────
  const xLabelIdxs: number[] = [];
  if (data.length <= 8) {
    data.forEach((_, i) => xLabelIdxs.push(i));
  } else {
    xLabelIdxs.push(0);
    for (let i = 1; i < data.length - 1; i++) {
      if (parseInt(data[i].year) % 5 === 0) xLabelIdxs.push(i);
    }
    xLabelIdxs.push(data.length - 1);
    // Thin out if still crowded
    while (xLabelIdxs.length > 8) {
      const mid = xLabelIdxs.slice(1, -1).filter((_, i) => i % 2 === 0);
      xLabelIdxs.splice(1, xLabelIdxs.length - 2, ...mid);
    }
  }

  // ── Y ticks ───────────────────────────────────────────────────────────────
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => t * yMax);

  // ── Volume bars ───────────────────────────────────────────────────────────
  const maxCount = Math.max(...data.map(d => d.sale_count), 1);
  const volH = 18;
  const barW = Math.max(2, Math.min(12, innerW / data.length - 3));

  // ── Format ────────────────────────────────────────────────────────────────
  const fmt = (v: number) =>
    v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M` :
    v >= 1_000     ? `€${Math.round(v / 1_000)}K`       : `€${Math.round(v)}`;

  const trendUp   = stats?.trend_direction === 'up';
  const trendDown = stats?.trend_direction === 'down';
  const trendCol  = trendUp ? '#34D399' : trendDown ? '#F87171' : '#94A3B8';
  const trendIcon = trendUp ? '↑' : trendDown ? '↓' : '→';

  // ── Mouse handler ─────────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let closest = 0, minDist = Infinity;
    data.forEach((dp, i) => {
      const d = Math.abs(xPos(parseInt(dp.year)) - mx);
      if (d < minDist) { minDist = d; closest = i; }
    });
    setHovered(minDist < innerW / data.length * 0.7 ? closest : null);
  };

  const hov = hovered !== null ? data[hovered] : null;

  return (
    <div style={{
      background: 'linear-gradient(145deg, #0C1829 0%, #0F1F38 100%)',
      borderRadius: '16px',
      padding: '28px 32px 20px',
      marginBottom: '32px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle grid texture overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(59,130,246,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', position: 'relative' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px' }}>
            {isFr ? 'Historique des prix · Nautilus' : 'Hammer Price History · Nautilus'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {fmt(stats?.avg_hammer_eur || 0)}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{isFr ? 'prix adjugé moy.' : 'avg hammer'}</div>
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '5px' }}>
            {data[0].year}–{data[data.length - 1].year} · {stats?.total_sales?.toLocaleString()} sales
          </div>
        </div>

        {/* KPI pills */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexShrink: 0 }}>
          {stats?.max_hammer_eur != null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: '#F59E0B', lineHeight: 1 }}>{fmt(stats.max_hammer_eur)}</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>{isFr ? 'VENTE RECORD' : 'RECORD SALE'}</div>
            </div>
          )}
          {stats?.trend_pct != null && (
            <div style={{ textAlign: 'right', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: trendCol, lineHeight: 1 }}>{trendIcon} {stats.trend_pct > 0 ? '+' : ''}{stats.trend_pct}%</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>trend</div>
            </div>
          )}
          {stats?.sell_above_estimate_pct != null && (
            <div style={{ textAlign: 'right', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 700, color: '#60A5FA', lineHeight: 1 }}>{stats.sell_above_estimate_pct}%</div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>{isFr ? 'AU-DESSUS EST.' : 'ABOVE EST.'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Hover info bar */}
      <div style={{
        height: '28px', display: 'flex', alignItems: 'center', gap: '20px',
        marginBottom: '4px', opacity: hov ? 1 : 0, transition: 'opacity 0.15s',
      }}>
        {hov && <>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'white' }}>{hov.year}</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{isFr ? 'moy.' : 'avg'}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#93C5FD' }}>{fmt(hov.avg_price)}</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{isFr ? 'record' : 'record'}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#F59E0B' }}>{fmt(hov.max_price)}</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{hov.sale_count} sale{hov.sale_count !== 1 ? 's' : ''}</span>
        </>}
      </div>

      {/* SVG */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <rect x="0" y="0" width={W} height={H} fill="#0F1923" />
        <defs>
          <linearGradient id="pcLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>
          <linearGradient id="pcAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
            <stop offset="75%" stopColor="#3B82F6" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pcVolGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.1" />
          </linearGradient>
          <filter id="pcGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="pcClip">
            <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {/* Y grid + labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={yPos(v).toFixed(1)} x2={W - PAD.right} y2={yPos(v).toFixed(1)}
              stroke={i === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)'}
              strokeWidth="1" strokeDasharray={i === 0 ? undefined : '3 5'}
            />
            <text x={PAD.left - 8} y={yPos(v)} textAnchor="end" dominantBaseline="middle"
              style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.28)', fontFamily: 'monospace' }}>
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* Clipped chart group */}
        <g clipPath="url(#pcClip)">
          {/* Volume bars */}
          {data.map((d, i) => {
            const bh = d.sale_count > 0 ? Math.max(4, (d.sale_count / maxCount) * volH) : 0;
            return (
              <rect key={i}
                x={(xPos(parseInt(d.year)) - barW / 2).toFixed(1)} y={(PAD.top + innerH - bh).toFixed(1)}
                width={barW} height={bh.toFixed(1)}
                fill="rgba(99, 135, 220, 0.4)" rx="1"
              />
            );
          })}

          {/* Area */}
          <path d={areaPath} fill="url(#pcAreaGrad)" />

          {/* Glow line (wider, blurred) */}
          <path d={linePath} fill="none" stroke="#3B82F6" strokeWidth="6" strokeOpacity="0.18"
            strokeLinejoin="round" strokeLinecap="round" />

          {/* Main line */}
          <path d={linePath} fill="none" stroke="url(#pcLineGrad)" strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" />

          {/* Hover vertical rule */}
          {hovered !== null && (
            <line
              x1={xPos(parseInt(data[hovered].year)).toFixed(1)} y1={PAD.top}
              x2={xPos(parseInt(data[hovered].year)).toFixed(1)} y2={PAD.top + innerH}
              stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="4 4"
            />
          )}

          {/* Hover dot */}
          {hovered !== null && (
            <circle cx={xPos(parseInt(data[hovered].year)).toFixed(1)} cy={yPos(data[hovered].avg_price).toFixed(1)} r="5"
              fill="white" stroke="#3B82F6" strokeWidth="2.5" filter="url(#pcGlow)" />
          )}
        </g>

        {/* Outlier annotation (record sale above cap) */}
        {hasMassiveOutlier && (() => {
          const rx = xPos(parseInt(data[peakIdx].year));
          const anchorY = PAD.top + 4;
          const labelX = rx + (rx > W * 0.7 ? -8 : 8);
          const anchor = rx > W * 0.7 ? 'end' : 'start';
          return (
            <g>
              <line x1={rx} y1={PAD.top} x2={rx} y2={PAD.top + 20}
                stroke="rgba(245,158,11,0.5)" strokeWidth="1" strokeDasharray="3 3" />
              <polygon points={`${rx},${anchorY} ${rx - 4},${anchorY + 7} ${rx + 4},${anchorY + 7}`}
                fill="#F59E0B" opacity="0.9" />
              <text x={labelX} y={anchorY + 22} textAnchor={anchor}
                style={{ fontSize: '9px', fill: '#F59E0B', fontFamily: 'monospace', fontWeight: 700 }}>
                {data[peakIdx].year} · {fmt(data[peakIdx].avg_price)}
              </text>
            </g>
          );
        })()}

        {/* X-axis labels */}
        {xLabelIdxs.map(i => (
          <text key={i} x={xPos(parseInt(data[i].year)).toFixed(1)} y={PAD.top + innerH + 22} textAnchor="middle"
            style={{
              fontSize: '9px', fontFamily: 'monospace',
              fill: hovered === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              fontWeight: hovered === i ? 700 : 400,
            }}>
            {data[i].year}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ArtistIntelligence() {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');
  const navigate = useNavigate();
  const { artistName } = useParams<{ artistName: string }>();
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any>(null);
  const [wikiBio, setWikiBio] = useState<string | null>(null);
  const [formatMatrix, setFormatMatrix] = useState<any[]>([]);
  const [geoArbitrage, setGeoArbitrage] = useState<any>(null);
  const [timingOptimizer, setTimingOptimizer] = useState<any>(null);
  const [liquidityMap, setLiquidityMap] = useState<any>(null);
  const [calendarOverlay, setCalendarOverlay] = useState<any>(null);
  const [investmentGrade, setInvestmentGrade] = useState<any>(null);
  const [oracle, setOracle] = useState(null);
  const [plan, setPlan] = useState(getUserPlan());
  useEffect(() => { setPlan(getUserPlan()); }, []);
  const hasAccess = ["investor", "pro", "institutional"].includes(plan);

  // Must be before any early return — Rules of Hooks
  const auctionHouseStats = useMemo(() => {
    const lots = [...(artist?.all_lots || []), ...(artist?.top_lots || [])];
    if (lots.length === 0) return [];
    const grouped = lots.reduce((acc: Record<string, { count: number; prices: number[] }>, lot: any) => {
      const house = lot.auction_house_name || lot.source || 'Unknown';
      if (!acc[house]) acc[house] = { count: 0, prices: [] };
      acc[house].count += 1;
      if (lot.current_price && lot.current_price > 0) acc[house].prices.push(lot.current_price);
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avg: data.prices.length > 0 ? Math.round(data.prices.reduce((a: number, b: number) => a + b, 0) / data.prices.length) : null,
        max: data.prices.length > 0 ? Math.max(...data.prices) : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [artist?.all_lots, artist?.top_lots]);

  useEffect(() => {
    if (!artistName) { setLoading(false); return; }
    setLoading(true);
    const token = getToken();
    const name = encodeURIComponent(decodeURIComponent(artistName));
    fetch(`${BACKEND}/api/artist-profiles/${name}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        setArtist(data);
        setLoading(false);
        // If no ai_brief, fetch Wikipedia summary as fallback
        if (!data.ai_brief) {
          const wikiName = encodeURIComponent(decodeURIComponent(artistName).replace(/\s+/g, '_'));
          fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiName}`)
            .then(r => r.ok ? r.json() : null)
            .then(w => { if (w?.extract) setWikiBio(w.extract); })
            .catch(() => {});
        }
      })
      .catch(() => setLoading(false));

    // Price history — independent, non-blocking
    fetch(`${BACKEND}/api/artist-profiles/${name}/price-history`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.price_by_year?.length >= 2) setPriceHistory(d); })
      .catch(() => {});

    // Format matrix — independent, non-blocking
    fetch(`${BACKEND}/api/artist-profiles/${name}/format-matrix`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.formats?.length > 0) setFormatMatrix(d.formats); })
      .catch(() => {});

    // Geo arbitrage — independent, non-blocking
    fetch(`${BACKEND}/api/artist-profiles/${name}/geo-arbitrage`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.regions?.length >= 2) setGeoArbitrage(d); })
      .catch(() => {});

    // Month 3 features — non-blocking
    fetch(`${BACKEND}/api/artist-profiles/${name}/timing-optimizer`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.monthly_summary?.length > 0) setTimingOptimizer(d); })
      .catch(() => {});

    fetch(`${BACKEND}/api/artist-profiles/${name}/liquidity-map`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.cells?.some((c: any) => c.count > 0)) setLiquidityMap(d); })
      .catch(() => {});

    fetch(`${BACKEND}/api/artist-profiles/${name}/calendar-overlay`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.events?.length > 0) setCalendarOverlay(d); })
      .catch(() => {});

    fetch(`${BACKEND}/api/artist-profiles/${name}/investment-grade`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.score != null) setInvestmentGrade(d); })
      .catch(() => {});

    fetch(`${BACKEND}/api/artists/by-name/${name}/oracle`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setOracle(d); })
      .catch(() => {});
  }, [artistName]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const token = getToken();
      const r = await fetch(`${BACKEND}/api/artist-profiles/search/${encodeURIComponent(query)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await r.json();
      setSearchResults(d.artists || []);
    } catch { /* silent */ }
    setSearching(false);
  };

  const scoreColor = (score: number) =>
    score >= 80 ? '#C6A85A' : score >= 65 ? 'var(--electric)' : 'var(--text-3)';

  // ── Search / landing page ────────────────────────────────────
  if (!artistName) {
    return (
      <div style={{ minHeight: 'calc(100vh - 57px)', background: 'var(--bg)', padding: '40px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', marginBottom: '12px', textTransform: 'uppercase' }}>
              {isFr ? 'INTELLIGENCE ARTISTE' : 'ARTIST INTELLIGENCE'}
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>
              {isFr ? 'Rechercher un artiste' : 'Search any artist'}
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '440px', margin: '0 auto' }}>
              {isFr ? 'Intelligence marché complète — prix, scores, historique des enchères, analyse IA.' : 'Full market intelligence — prices, scores, auction history, AI analysis.'}
            </p>
          </div>

          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: '32px' }}>
            <input
              className="input"
              placeholder={isFr ? "Rechercher un artiste — ex. Picasso, Basquiat, Miró..." : "Search artist — e.g. Picasso, Basquiat, Miró..."}
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              style={{ fontSize: '16px', padding: '16px 20px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(10,22,40,0.06)', width: '100%' }}
              autoFocus
            />
            {searching && (
              <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-3)' }}>
                Searching...
              </div>
            )}

            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: 'var(--shadow-md)', zIndex: 100, marginTop: '4px', overflow: 'hidden' }}>
                {searchResults.map((a: any) => (
                  <button key={a.name}
                    onClick={() => navigate(`/app/artists/${encodeURIComponent(a.name)}`)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{a.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                        {a.lot_count} lots · Avg €{a.avg_price.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ padding: '3px 10px', borderRadius: '4px', background: a.avg_score >= 80 ? 'rgba(198,168,90,0.1)' : 'var(--electric-subtle)', border: `1px solid ${a.avg_score >= 80 ? 'rgba(198,168,90,0.3)' : 'var(--electric-border)'}` }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: scoreColor(a.avg_score) }}>{a.avg_score}/100</span>
                      </div>
                      <span style={{ color: 'var(--text-3)', fontSize: '14px' }}>→</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '16px' }}>
              Recently tracked artists
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text)', marginBottom: '8px' }}>
            Chargement de l'intelligence artiste...
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────
  if (!artist || artist.detail) {
    return (
      <div style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', marginBottom: '10px' }}>
            No data for this artist yet
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px' }}>
            Nautilus hasn't indexed lots for this artist. Try searching another name.
          </p>
          <button onClick={() => navigate('/app/artists')} style={{ padding: '10px 24px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Search artists →
          </button>
        </div>
      </div>
    );
  }

  const stats = artist.statistics || {};

  return (
    <div style={{ minHeight: 'calc(100vh - 57px)', background: 'var(--bg)' }}>

      {/* Breadcrumb */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '13px' }}>
          {isFr ? '← Retour' : '← Back'}
        </button>
        <span style={{ color: 'var(--border)' }}>·</span>
        <button onClick={() => navigate('/app/artists')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {isFr ? 'Intelligence Artiste' : 'Artist Intelligence'}
        </button>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px' }}>

        {/* Artist header */}
        <div className="intelligence-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', marginBottom: '32px' }}>

          {/* Left — Identity + AI brief */}
          <div>
            {/* Name + dates */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '42px', fontWeight: 600, color: 'var(--text)', margin: 0, lineHeight: 1.1 }}>
                {artist.artist_name || artist.name}
              </h1>
              {(artist.birth_year || artist.death_year) && (
                <span style={{ fontSize: '15px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {artist.birth_year || '?'}
                  {artist.death_year ? `–${artist.death_year}` : '–'}
                </span>
              )}
              {investmentGrade && (() => {
                const g = investmentGrade.grade as string;
                const col = g === 'A' ? '#10B981' : g === 'B+' ? '#3B82F6' : g === 'B' ? '#60A5FA' : g === 'C' ? '#F59E0B' : '#EF4444';
                const bg  = g === 'A' ? 'rgba(16,185,129,0.08)' : g === 'B+' ? 'rgba(59,130,246,0.08)' : g === 'B' ? 'rgba(96,165,250,0.08)' : g === 'C' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
                return (
                  <div title={`Liquidity ${investmentGrade.sub_scores.liquidity}/20 · Cycle ${investmentGrade.sub_scores.cycle}/20 · Sell-through ${investmentGrade.sub_scores.sell_through}/20 · Trend ${investmentGrade.sub_scores.trend}/20 · Supply ${investmentGrade.sub_scores.supply}/20`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px 4px 8px', background: bg, border: `1px solid ${col}`, borderRadius: '20px', cursor: 'default', flexShrink: 0 }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'white', lineHeight: 1 }}>{g}</span>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: col, lineHeight: 1 }}>{investmentGrade.score}/100</div>
                      <div style={{ fontSize: '9px', color: col, opacity: 0.8, lineHeight: 1.2, letterSpacing: '0.06em' }}>{isFr ? "Grade d'investissement" : investmentGrade.label}</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Nationality + movement badges */}
            {(artist.nationality || artist.movement) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                {artist.nationality && (
                  <span style={{ padding: '3px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-2)' }}>
                    {artist.nationality}
                  </span>
                )}
                {artist.movement && (
                  <span style={{ padding: '3px 10px', background: 'rgba(198,168,90,0.08)', border: '1px solid rgba(198,168,90,0.3)', borderRadius: '20px', fontSize: '12px', color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                    {artist.movement}
                  </span>
                )}
              </div>
            )}

            {/* Stat bar */}
            {(() => {
              const rec = priceHistory?.statistics?.max_hammer_eur ?? stats.max_price;
              const trendPct = priceHistory?.statistics?.trend_pct;
              const totalSales = priceHistory?.total_sales ?? artist.total_lots;
              const aboveEst = priceHistory?.statistics?.sell_above_estimate_pct;
              const fmtStat = (v: number) => v >= 1_000_000 ? `€${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `€${Math.round(v/1_000)}K` : `€${Math.round(v)}`;
              const cols = [
                rec != null ? { key: 'record', label: isFr ? 'PRIX RECORD' : 'RECORD', value: fmtStat(rec), color: '#C6A85A', big: true } : null,
                trendPct != null ? { key: 'trend', label: 'TREND', value: `${trendPct >= 0 ? '↑' : '↓'} ${Math.abs(trendPct)}%`, color: trendPct >= 0 ? '#34D399' : '#F87171', big: true } : null,
                aboveEst != null ? { key: 'above', label: 'AU-DESSUS EST.', value: `${aboveEst}%`, color: '#60A5FA', big: true } : null,
              ].filter(Boolean) as { key: string; label: string; value: string; color: string; big: boolean }[];
              if (cols.length === 0) return null;
              return (
                <div style={{ display: 'flex', background: 'var(--navy)', borderRadius: '10px', marginBottom: '20px', overflow: 'hidden' }}>
                  {cols.map((col, i) => (
                    <div key={col.key} style={{ flex: 1, padding: '14px 16px', borderLeft: i > 0 ? '0.5px solid rgba(255,255,255,0.08)' : 'none' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '6px' }}>{col.label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: col.big ? '24px' : '14px', fontWeight: col.big ? 700 : 400, color: col.color, lineHeight: 1 }}>{col.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* AI brief / Wikipedia fallback / placeholder */}
            {artist.ai_brief ? (
              <div style={{ background: 'var(--navy)', borderRadius: '10px', padding: '18px 22px', marginBottom: '20px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '12px' }}>◆ ANALYSE NAUTILUS</div>
                {[
                  { key: 'MOMENTUM', value: stats.momentum === 'rising' ? '↑ En hausse — activité croissante' : (stats.momentum === 'falling' || stats.momentum === 'low') ? '↓ En baisse — activité décroissante' : '→ Stable — marché équilibré', color: stats.momentum === 'rising' ? '#16A34A' : (stats.momentum === 'falling' || stats.momentum === 'low') ? '#F87171' : 'rgba(255,255,255,0.6)' },
                  { key: 'CONVICTION', value: (stats.avg_score || 0) >= 80 ? `${stats.avg_score}/100 — Forte conviction` : (stats.avg_score || 0) >= 60 ? `${stats.avg_score}/100 — Intérêt modéré` : `${stats.avg_score || 0}/100 — Signal faible`, color: (stats.avg_score || 0) >= 60 ? '#C6A85A' : 'rgba(255,255,255,0.6)' },
                  { key: 'TENDANCE', value: (priceHistory?.statistics?.trend_direction ?? stats?.trend_direction) === 'up' ? 'Hausse sur 24 mois' : (priceHistory?.statistics?.trend_direction ?? stats?.trend_direction) === 'down' ? 'Baisse sur 24 mois' : 'Latéral sur 24 mois', color: (priceHistory?.statistics?.trend_direction ?? stats?.trend_direction) === 'up' ? '#16A34A' : (priceHistory?.statistics?.trend_direction ?? stats?.trend_direction) === 'down' ? '#F87171' : 'rgba(255,255,255,0.6)' },
                ].map(row => (
                  <div key={row.key} style={{ display: 'flex', gap: '12px', alignItems: 'baseline', marginBottom: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: '110px', flexShrink: 0 }}>{row.key}</span>
                    <span style={{ fontSize: '13px', color: row.color, lineHeight: 1.5 }}>{row.value}</span>
                  </div>
                ))}
                {formatMatrix.length > 0 && (() => {
                  const bf = formatMatrix.reduce((best: any, f: any) => (f.sell_above_estimate_pct || 0) > (best.sell_above_estimate_pct || 0) ? f : best, formatMatrix[0]);
                  return (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: '110px', flexShrink: 0 }}>MEILLEUR FORMAT</span>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{bf.format} · €{bf.avg_price >= 1000 ? `${Math.round(bf.avg_price/1000)}K` : Math.round(bf.avg_price)} · {bf.sell_above_estimate_pct}% au-dessus est.</span>
                    </div>
                  );
                })()}
                {timingOptimizer?.best_month && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: '110px', flexShrink: 0 }}>MEILLEUR MARCHÉ</span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{timingOptimizer.best_month} · {timingOptimizer.best_season} · {timingOptimizer.best_house}</span>
                  </div>
                )}
              </div>
            ) : wikiBio ? (
              <div style={{ background: 'var(--navy)', borderRadius: '10px', padding: '18px 22px', marginBottom: '20px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '8px' }}>
                  ◆ ARTIST BIOGRAPHY
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, margin: 0, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {wikiBio}
                </p>
              </div>
            ) : (
              <div style={{ background: '#F5F3EE', border: '1px solid #E8E4DD', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
                <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#9CA3AF', margin: 0, lineHeight: 1.6 }}>
                  Market data available — artist biography coming soon.
                </p>
              </div>
            )}

            {hasAccess && auctionHouseStats.length > 0 && (
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px' }}>
                  {isFr ? 'PRINCIPALES MAISONS DE VENTE' : 'TOP AUCTION HOUSES'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
                  {auctionHouseStats.map(house => (
                    <div key={house.name} style={{ background: '#FFFFFF', border: '1px solid #E8E4DD', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.12em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
                        {house.name}
                      </div>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>
                          {house.count} lots
                        </span>
                        {house.avg && (
                          <span style={{ fontSize: 12, color: '#4B5563' }}>
                            {isFr ? 'moy.' : 'avg'} €{house.avg.toLocaleString()}
                          </span>
                        )}
                        {house.max && (
                          <span style={{ fontSize: 12, color: '#C6A85A' }}>
                            max €{house.max.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ background: 'var(--navy)', borderRadius: '10px', padding: '20px 24px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '6px' }}>
                {isFr ? 'SCORE DE CONVICTION MOY.' : 'AVG CONVICTION SCORE'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '44px', fontWeight: 700, color: (stats.avg_score || 0) >= 80 ? '#C6A85A' : 'white', lineHeight: 1 }}>
                  {stats.avg_score || '—'}
                </span>
                <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>/100</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                <div style={{ height: '100%', borderRadius: '2px', width: `${stats.avg_score || 0}%`, background: (stats.avg_score || 0) >= 80 ? '#C6A85A' : '#2563EB', transition: 'width 0.8s ease' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: isFr ? 'LOTS SUIVIS' : 'LOTS TRACKED', value: artist.total_lots?.toLocaleString() || '0', color: undefined },
                { label: isFr ? 'PRIX MOYEN' : 'AVG PRICE', value: stats.avg_price ? `€${stats.avg_price.toLocaleString()}` : '—', color: undefined },
                { label: isFr ? 'FOURCHETTE DE PRIX' : 'PRICE RANGE', value: stats.max_price ? `€${(stats.min_price || 0).toLocaleString()}–${(stats.max_price || 0).toLocaleString()}` : '—', color: undefined },
                { label: 'MOMENTUM', value: isFr ? (stats.momentum === 'rising' ? 'EN HAUSSE' : (stats.momentum === 'falling' || stats.momentum === 'low') ? 'EN BAISSE' : 'STABLE') : (stats.momentum || 'stable').toUpperCase(), color: stats.momentum === 'rising' ? '#34D399' : undefined },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: color || 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value}
                  </div>
                </div>
              ))}
              {(priceHistory?.statistics?.trend_direction ?? stats?.trend_direction) && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px', gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    TREND DIRECTION
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: (priceHistory?.statistics?.trend_direction ?? stats?.trend_direction) === 'up' ? '#34D399' : (priceHistory?.statistics?.trend_direction ?? stats?.trend_direction) === 'down' ? '#F87171' : '#94A3B8' }}>
                    {(priceHistory?.statistics?.trend_direction ?? stats?.trend_direction) === 'up' ? 'UP ↑' : (priceHistory?.statistics?.trend_direction ?? stats?.trend_direction) === 'down' ? 'DOWN ↓' : 'STABLE →'}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                trackEvent('artist_follow', 'artist', artist?.artist_name || artist?.name || '', {
                  artist_name: artist?.artist_name || artist?.name,
                  from_page: 'artist_intelligence',
                });
                navigate('/app/portfolio?tab=artists');
              }}
              style={{ padding: '12px', background: 'var(--electric)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
            >
              {isFr ? '★ Suivre cet artiste' : '★ Follow this artist'}
            </button>

            {/* Oracle — right column */}
            {oracle !== null && hasAccess && (
              <div style={{ background: 'var(--navy)', borderRadius: '10px', padding: '18px 22px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '14px' }}>◆ NAUTILUS ORACLE</div>
                {(() => {
                  const oracleDisplayKeys = ['oracle_signal', 'oracle_score_6m', 'oracle_score_18m', 'oracle_target_upside', 'oracle_narrative', 'confidence', 'oracle_window'];
                  return Object.entries(oracle as Record<string, unknown>)
                    .filter(([k, v]) => oracleDisplayKeys.includes(k) && v != null)
                    .map(([key, value]) => (
                      <div key={key} style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>{key.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.75 }}>{String(value)}</div>
                      </div>
                    ));
                })()}
              </div>
            )}

            {/* Actions rapides */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 18px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>ACTIONS RAPIDES</div>
              {[
                { label: 'Parcourir les opportunités', right: `${artist.total_lots} lots →`, to: `/app/explore?artist=${encodeURIComponent(artist.artist_name || artist.name || '')}` },
                { label: 'Voir les convictions ≥ 80', right: '→', to: '/app/explore?min_score=80' },
                { label: 'Créer une alerte artiste', right: '→', to: '/app/intelligence' },
              ].map(({ label, right, to }, idx) => (
                <button key={label} onClick={() => navigate(to)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', background: 'none', border: 'none', borderBottom: idx < 2 ? '1px solid var(--border-light)' : 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--electric)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'}
                >
                  <span>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>{right}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Categories */}
        {artist.categories?.length > 0 && (
          <div style={{ marginBottom: '32px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{isFr ? 'TRAVAILLE EN :' : 'WORKS IN:'}</span>
            {artist.categories.map((c: any) => (
              <span key={c.name} style={{ padding: '4px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-2)' }}>
                {c.name} <span style={{ color: 'var(--text-3)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>({c.count})</span>
              </span>
            ))}
          </div>
        )}

        {/* Top lots */}
        {artist.top_lots?.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', margin: 0 }}>
                {isFr ? 'Meilleures opportunités' : 'Top opportunities'}
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {artist.total_lots} {isFr ? 'lots au total' : 'lots total'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {(hasAccess ? artist.top_lots : artist.top_lots.slice(0, 2)).map((lot: any, idx: number) => {
                const locked = !hasAccess && idx >= 0;
                return (
                <div key={lot.id}
                  onClick={() => locked ? (window.location.href = '/app/pricing') : navigate(`/app/opportunities/${lot.id}`)}
                  style={{ background: 'white', border: '1px solid var(--border)', borderTop: `2px solid ${scoreColor(lot.deal_score || 0)}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                >
                  <div style={{ height: '160px', background: 'var(--bg-subtle)', position: 'relative', overflow: 'hidden' }}>
                    {lot.image_url ? (
                      <img src={lot.image_url} alt={lot.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '28px', opacity: 0.1 }}>◎</span>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(10,22,40,0.85)', padding: '3px 7px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'white' }}>
                      {lot.deal_score != null ? `${Math.round(lot.deal_score)}/100` : '—'}
                    </div>
                    {locked && (
                      <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(12,22,34,0.88)', borderRadius: 3, padding: '3px 7px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#C6A85A', letterSpacing: '0.12em' }}>
                        INVESTOR
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--text)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(locked ? { filter: 'blur(4px)', userSelect: 'none' } : {}) }}>
                      {lot.title}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                        {lot.current_price || lot.estimate_low ? `€${(lot.current_price || lot.estimate_low).toLocaleString()}` : '—'}
                      </span>
                      {lot.pct_below_low_estimate > 0 && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--electric)', fontFamily: 'var(--font-mono)' }}>
                          +{Math.round(lot.pct_below_low_estimate)}% ↑
                        </span>
                      )}
                    </div>
                    <div style={{ height: '2px', background: 'var(--bg-subtle)', borderRadius: '1px', marginTop: '8px' }}>
                      <div style={{ height: '100%', borderRadius: '1px', width: `${lot.deal_score || 0}%`, background: scoreColor(lot.deal_score || 0) }} />
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {!hasAccess && (
          <div style={{ margin: '32px auto 40px', padding: '28px 32px', background: 'var(--navy)', borderRadius: 8, maxWidth: 400, textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', marginBottom: '14px' }}>
              ◆ {isFr ? 'OPPORTUNITÉS INVESTOR+' : 'INVESTOR+ OPPORTUNITIES'}
            </div>
            <div style={{ fontSize: 14, color: '#fff', fontFamily: 'Georgia,serif', fontWeight: 400, lineHeight: 1.5, marginBottom: 8 }}>
              {isFr ? 'Voir où les collectionneurs achètent maintenant' : 'See where collectors are buying now'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 14, lineHeight: 1.6 }}>
              {isFr ? 'Opportunités sous estimation · liquidité · timing d\'achat' : 'Below-estimate opportunities · liquidity · buy timing'}
            </div>
            <a href="/app/pricing" style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#C6A85A', letterSpacing: '0.12em', textDecoration: 'none', borderBottom: '1px solid rgba(198,168,90,0.35)', paddingBottom: 2 }}>
              {isFr ? 'Passer Investor — €19/mois →' : 'Get Investor access — €19/mo →'}
            </a>
          </div>
        )}

        {priceHistory && hasAccess && (
          <PriceChart
            data={priceHistory.price_by_year}
            stats={{ ...priceHistory.statistics, total_sales: priceHistory.total_sales }}
          />
        )}
        {timingOptimizer && hasAccess && (() => {
            const fmtT = (v: number) => v >= 1_000_000 ? `€${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `€${Math.round(v/1_000)}K` : `€${Math.round(v)}`;
            const maxAvgT = Math.max(...timingOptimizer.monthly_summary.map((m: any) => m.avg_price));
            const SEASON_COLOR_T: Record<string, string> = { Spring: '#34D399', Summer: '#F59E0B', Autumn: '#F87171', Winter: '#60A5FA' };
            return (
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--text)', margin: 0 }}>{isFr ? 'Optimiseur de timing' : 'Timing Optimizer'}</h2>
                  {timingOptimizer.best_month && (
                    <div style={{ background: 'var(--navy)', borderRadius: '8px', padding: '10px 16px', textAlign: 'right' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>{isFr ? 'MEILLEURE PÉRIODE' : 'BEST WINDOW'}</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#C6A85A', marginTop: '3px' }}>📅 {timingOptimizer.best_month} · {timingOptimizer.best_season}</div>
                      {timingOptimizer.best_house && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{timingOptimizer.best_house}</div>}
                    </div>
                  )}
                </div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px 24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '6px', alignItems: 'end', height: '100px' }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                      const entry = timingOptimizer.monthly_summary.find((x: any) => x.month === m);
                      const MONTH_SHORT = ['J','F','M','A','M','J','J','A','S','O','N','D'];
                      const barH = entry ? Math.max(8, (entry.avg_price / maxAvgT) * 80) : 0;
                      const sc = entry ? SEASON_COLOR_T[entry.season] : 'var(--border)';
                      const isBest = entry && entry.avg_price === maxAvgT;
                      return (
                        <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          {isBest && <div style={{ fontSize: '8px', color: '#C6A85A', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>★</div>}
                          <div title={entry ? `${entry.month_name}: ${fmtT(entry.avg_price)} avg · ${entry.total_sales} sales` : 'No data'}
                            style={{ width: '100%', height: `${barH}px`, background: entry ? sc : 'var(--bg-subtle)', borderRadius: '3px 3px 0 0', opacity: entry ? (isBest ? 1 : 0.65) : 0.3 }} />
                          <div style={{ fontSize: '9px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{MONTH_SHORT[m-1]}</div>
                          {entry && <div style={{ fontSize: '8px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{fmtT(entry.avg_price)}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
                    {(() => {
                      const seasonFr: Record<string, string> = { Spring: 'Printemps', Summer: 'Été', Autumn: 'Automne', Winter: 'Hiver' };
                      return Object.entries(SEASON_COLOR_T).map(([s, c]) => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: c }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{isFr ? (seasonFr[s] || s) : s}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                {timingOptimizer.entries?.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                    {timingOptimizer.entries.slice(0, 4).map((e: any, i: number) => (
                      <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px', borderLeft: `3px solid ${SEASON_COLOR_T[e.season] || '#6B7280'}` }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>{e.house}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>{e.month_name} · {e.count} sales</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: i === 0 ? '#C6A85A' : 'var(--text)' }}>{fmtT(e.avg_price)}</div>
                        {e.sell_above_pct !== null && <div style={{ fontSize: '10px', color: e.sell_above_pct >= 70 ? '#34D399' : e.sell_above_pct >= 50 ? '#F59E0B' : '#F87171', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{e.sell_above_pct}% {isFr ? 'au-dessus est.' : 'above est.'}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
        })()}

        {!hasAccess ? null : (
          <>
            {/* Format Performance Matrix */}
            {formatMatrix.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', margin: 0 }}>
                  {isFr ? 'Matrice de performance par format' : 'Format Performance Matrix'}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {formatMatrix.reduce((s, f) => s + f.count, 0).toLocaleString()} {isFr ? 'ventes analysées' : 'sales analyzed'}
              </span>
            </div>

            {/* Matrix table */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr 110px 110px 110px 90px',
                gap: 0,
                padding: '8px 20px',
                background: 'var(--bg-subtle)',
                borderBottom: '1px solid var(--border)',
              }}>
                {['FORMAT', 'VOLUME', isFr ? 'PRIX MOY.' : 'AVG PRICE', isFr ? 'PRIX RECORD' : 'RECORD', isFr ? 'ENTRÉE' : 'ENTRY', isFr ? 'AU-DESSUS EST.' : 'ABOVE EST.'].map(h => (
                  <div key={h} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
                    {h}
                  </div>
                ))}
              </div>

              {(() => {
                const maxCount = Math.max(...formatMatrix.map(f => f.count));
                const maxAvg   = Math.max(...formatMatrix.map(f => f.avg_price));
                const fmt = (v: number) =>
                  v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1_000   ? `€${Math.round(v / 1_000)}K`
                  :                `€${Math.round(v)}`;

                const FORMAT_ICON: Record<string, string> = {
                  'Oil': '🖼', 'Acrylic': '🎨', 'Works on Paper': '✏️',
                  'Prints': '🖨', 'Photography': '📷', 'Sculpture': '🗿',
                  'Mixed Media': '◈', 'Paintings': '🖼', 'Other': '◇',
                };
                const FORMAT_COLOR: Record<string, string> = {
                  'Oil': '#1D4ED8', 'Acrylic': '#7C3AED', 'Works on Paper': '#065F46',
                  'Prints': '#92400E', 'Photography': '#1F2937', 'Sculpture': '#B45309',
                  'Mixed Media': '#6B21A8', 'Paintings': '#1D4ED8', 'Other': '#6B7280',
                };

                return formatMatrix.map((f, i) => {
                  const color = FORMAT_COLOR[f.format] || '#6B7280';
                  const volPct = (f.count / maxCount) * 100;
                  const avgPct = (f.avg_price / maxAvg) * 100;
                  const isTop = f.avg_price === maxAvg;

                  return (
                    <div
                      key={f.format}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr 110px 110px 110px 90px',
                        gap: 0,
                        padding: '14px 20px',
                        borderBottom: i < formatMatrix.length - 1 ? '1px solid var(--border-light)' : 'none',
                        alignItems: 'center',
                        background: isTop ? 'rgba(198,168,90,0.03)' : 'transparent',
                      }}
                    >
                      {/* Format name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '3px', height: '28px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
                            {f.format}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                            {f.count} {isFr ? 'ventes' : 'sales'}
                          </div>
                        </div>
                      </div>

                      {/* Volume bar */}
                      <div style={{ paddingRight: '20px' }}>
                        <div style={{ height: '6px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${volPct}%`, background: color, borderRadius: '3px', opacity: 0.7, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>

                      {/* Avg price + mini bar */}
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: isTop ? '#C6A85A' : 'var(--text)' }}>
                          {fmt(f.avg_price)}
                        </div>
                        <div style={{ height: '2px', background: 'var(--bg-subtle)', borderRadius: '1px', marginTop: '4px', width: '70px' }}>
                          <div style={{ height: '100%', width: `${avgPct}%`, background: isTop ? '#C6A85A' : color, borderRadius: '1px', opacity: 0.6 }} />
                        </div>
                      </div>

                      {/* Record */}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-2)' }}>
                        {fmt(f.max_price)}
                      </div>

                      {/* Entry (min) */}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>
                        {fmt(f.min_price)}
                      </div>

                      {/* Sell above estimate */}
                      <div>
                        {f.sell_above_estimate_pct !== null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
                              color: f.sell_above_estimate_pct >= 70 ? '#34D399' : f.sell_above_estimate_pct >= 50 ? '#F59E0B' : '#F87171',
                            }}>
                              {f.sell_above_estimate_pct}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
              {[
                { label: isFr ? 'PRIX MOY.' : 'AVG PRICE', desc: isFr ? 'Prix adjugé moyen (EUR)' : 'Mean hammer price (EUR)' },
                { label: isFr ? 'PRIX RECORD' : 'RECORD', desc: isFr ? 'Prix adjugé le plus élevé' : 'Highest hammer price achieved' },
                { label: isFr ? 'ENTRÉE' : 'ENTRY', desc: isFr ? "Prix adjugé le plus bas (investissement min.)" : 'Lowest hammer price (min. investment)' },
                { label: isFr ? 'AU-DESSUS EST.' : 'ABOVE EST.', desc: isFr ? "% des ventes dépassant l'estimation haute" : '% of sales exceeding high estimate' },
              ].map(({ label, desc }) => (
                <div key={label} style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>{label}</span> — {desc}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Geographic Arbitrage Detector */}
        {geoArbitrage && geoArbitrage.regions.length >= 2 && (() => {
          const regions: any[] = geoArbitrage.regions;
          const maxAvg = Math.max(...regions.map((r: any) => r.avg_price_eur));
          const maxCount = Math.max(...regions.map((r: any) => r.count));
          const fmt = (v: number) =>
            v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M`
            : v >= 1_000   ? `€${Math.round(v / 1_000)}K`
            :                `€${Math.round(v)}`;

          return (
            <div style={{ marginBottom: '32px' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', margin: 0 }}>
                    {isFr ? 'Arbitrage géographique' : 'Geographic Arbitrage Detector'}
                  </h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {geoArbitrage.spread_pct !== null && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: geoArbitrage.spread_pct > 30 ? '#34D399' : 'var(--text)' }}>
                      +{geoArbitrage.spread_pct}%
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    {isFr ? 'écart de prix' : 'price spread'}
                  </div>
                </div>
              </div>

              {/* Buy / Sell callout */}
              {geoArbitrage.best_buy && geoArbitrage.best_sell && geoArbitrage.best_buy !== geoArbitrage.best_sell && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>🛒</span>
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#34D399', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>{isFr ? 'MEILLEUR MARCHÉ POUR ACHETER' : 'BEST MARKET TO BUY'}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>{geoArbitrage.best_buy}</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(198,168,90,0.05)', border: '1px solid rgba(198,168,90,0.2)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>🏷</span>
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>{isFr ? 'MEILLEUR MARCHÉ POUR VENDRE' : 'BEST MARKET TO SELL'}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>{geoArbitrage.best_sell}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Regions table */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                {/* Column headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 1fr 120px 120px 90px',
                  padding: '8px 20px',
                  background: 'var(--bg-subtle)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {['MARKET', 'VOLUME', 'AVG PRICE', 'MEDIAN', 'ABOVE EST.'].map(h => (
                    <div key={h} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
                      {h}
                    </div>
                  ))}
                </div>

                {regions.map((r: any, i: number) => {
                  const isBestSell = r.region === geoArbitrage.best_sell;
                  const isBestBuy  = r.region === geoArbitrage.best_buy;
                  const avgPct  = (r.avg_price_eur / maxAvg) * 100;
                  const volPct  = (r.count / maxCount) * 100;
                  const barColor = isBestSell ? '#C6A85A' : isBestBuy ? '#34D399' : '#2563EB';

                  return (
                    <div
                      key={r.region}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '180px 1fr 120px 120px 90px',
                        padding: '14px 20px',
                        borderBottom: i < regions.length - 1 ? '1px solid var(--border-light)' : 'none',
                        alignItems: 'center',
                        background: isBestSell ? 'rgba(198,168,90,0.02)' : isBestBuy ? 'rgba(52,211,153,0.02)' : 'transparent',
                      }}
                    >
                      {/* Market name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '3px', height: '28px', borderRadius: '2px', background: barColor, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '14px', lineHeight: 1.2 }}>
                            {r.flag} <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.region}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                            {r.count} {isFr ? 'ventes' : 'sales'}
                            {isBestSell && <span style={{ color: '#C6A85A', marginLeft: '6px' }}>{isFr ? '★ meilleure vente' : '★ best sell'}</span>}
                            {isBestBuy  && <span style={{ color: '#34D399', marginLeft: '6px' }}>{isFr ? '↓ meilleur achat' : '↓ best buy'}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Volume bar */}
                      <div style={{ paddingRight: '20px' }}>
                        <div style={{ height: '6px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${volPct}%`, background: barColor, borderRadius: '3px', opacity: 0.65 }} />
                        </div>
                      </div>

                      {/* Avg price */}
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: isBestSell ? '#C6A85A' : 'var(--text)' }}>
                          {fmt(r.avg_price_eur)}
                        </div>
                        <div style={{ height: '2px', background: 'var(--bg-subtle)', borderRadius: '1px', marginTop: '4px', width: '70px' }}>
                          <div style={{ height: '100%', width: `${avgPct}%`, background: barColor, borderRadius: '1px', opacity: 0.5 }} />
                        </div>
                      </div>

                      {/* Median */}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-2)' }}>
                        {fmt(r.median_price_eur)}
                      </div>

                      {/* Sell above estimate */}
                      <div>
                        {r.sell_above_estimate_pct !== null ? (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
                            color: r.sell_above_estimate_pct >= 70 ? '#34D399' : r.sell_above_estimate_pct >= 50 ? '#F59E0B' : '#F87171',
                          }}>
                            {r.sell_above_estimate_pct}%
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Note */}
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: '10px' }}>
                {isFr ? 'Régions déduites de la devise des enchères. Prix normalisés en EUR.' : 'Market regions inferred from auction currency. All prices normalized to EUR.'}
                {geoArbitrage.total_sales && ` · ${geoArbitrage.total_sales.toLocaleString()} historical sales analyzed.`}
              </div>
            </div>
          );
        })()}

        {/* ── Liquidity Depth Map ──────────────────────────────────────── */}
        {liquidityMap && (() => {
          const fmt = (v: number) => v >= 1_000_000 ? `€${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `€${Math.round(v/1_000)}K` : `€${v}`;
          const cells: any[] = liquidityMap.cells || [];
          const PERIOD_COLORS = ['#3B82F6', '#6366F1', '#8B5CF6'];
          return (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', margin: 0 }}>{isFr ? 'Carte de liquidité' : 'Liquidity Depth Map'}</h2>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{liquidityMap.total_sales?.toLocaleString()} {isFr ? 'ventes cartographiées' : 'sales mapped'}</span>
              </div>

              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                {/* Column headers — price bands */}
                <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(5, 1fr)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-subtle)' }} />
                  {liquidityMap.price_bands.map((b: string) => (
                    <div key={b} style={{ padding: '8px 6px', background: 'var(--bg-subtle)', textAlign: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>{b}</div>
                  ))}
                </div>

                {/* Rows — time periods */}
                {liquidityMap.periods.map((period: string, pi: number) => {
                  const periodFr: Record<string, string> = { 'Last 2 years': '2 dernières années', '2–5 years ago': 'il y a 2 à 5 ans', '5+ years ago': 'il y a 5 ans+' };
                  return (
                  <div key={period} style={{ display: 'grid', gridTemplateColumns: '120px repeat(5, 1fr)', borderBottom: pi < 2 ? '1px solid var(--border-light)' : 'none' }}>
                    <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '3px', height: '28px', borderRadius: '2px', background: PERIOD_COLORS[pi], marginRight: '8px', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', lineHeight: 1.3 }}>{isFr ? (periodFr[period] || period) : period}</span>
                    </div>
                    {liquidityMap.price_bands.map((_: string, bi: number) => {
                      const cell = cells.find((c: any) => c.price_band === bi && c.period === pi);
                      const intensity = cell?.intensity || 0;
                      const bg = intensity > 0
                        ? `rgba(${pi === 0 ? '59,130,246' : pi === 1 ? '99,102,241' : '139,92,246'}, ${Math.max(0.06, intensity * 0.7)})`
                        : 'transparent';
                      return (
                        <div key={bi} title={cell?.count ? `${cell.count} sales · avg ${cell.avg_price ? fmt(cell.avg_price) : '—'}` : 'No data'}
                          style={{ padding: '14px 8px', background: bg, textAlign: 'center', transition: 'background 0.2s', borderLeft: '1px solid var(--border-light)' }}>
                          {cell?.count > 0 ? (
                            <>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{cell.count}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{cell.avg_price ? fmt(cell.avg_price) : ''}</div>
                            </>
                          ) : (
                            <div style={{ fontSize: '12px', color: 'var(--border)' }}>—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: '8px' }}>
                {isFr ? 'Intensité = densité relative des ventes. Plus foncé = plus liquide à cette fourchette.' : 'Cell intensity = relative sales density. Darker = more liquid at this price range.'}
              </div>
            </div>
          );
        })()}

        {/* ── Institutional Calendar Overlay ──────────────────────────── */}
        {calendarOverlay && (() => {
          const fmt = (v: number) => v >= 1_000_000 ? `€${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `€${Math.round(v/1_000)}K` : `€${v}`;
          const MONTH_NAMES = isFr ? ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'] : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          return (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', margin: 0 }}>{isFr ? 'Calendrier institutionnel' : 'Institutional Calendar Overlay'}</h2>
                </div>
                {calendarOverlay.peak_season && (
                  <div style={{ background: 'rgba(198,168,90,0.08)', border: '1px solid rgba(198,168,90,0.25)', borderRadius: '8px', padding: '8px 14px', textAlign: 'right' }}>
                    <div style={{ fontSize: '9px', color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>{isFr ? 'SAISON FORTE' : 'PEAK SEASON'}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginTop: '2px' }}>{calendarOverlay.peak_season} · {calendarOverlay.peak_month}</div>
                  </div>
                )}
              </div>

              {/* Monthly activity ring */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px 24px', marginBottom: '12px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '14px' }}>{isFr ? 'Activité des ventes par mois' : 'Historical sale activity by month'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '4px' }}>
                  {MONTH_NAMES.map((mn, i) => {
                    const entry = calendarOverlay.active_months.find((a: any) => a.month_name === mn);
                    const maxSales = Math.max(...calendarOverlay.active_months.map((a: any) => a.total_sales), 1);
                    const intensity = entry ? entry.total_sales / maxSales : 0;
                    const isPeak = calendarOverlay.peak_month === mn;
                    return (
                      <div key={mn} style={{ textAlign: 'center' }}>
                        <div title={entry ? `${mn}: ${entry.total_sales} sales` : `${mn}: no data`}
                          style={{ height: '32px', borderRadius: '4px', background: intensity > 0 ? `rgba(198,168,90,${Math.max(0.1, intensity * 0.9)})` : 'var(--bg-subtle)', border: isPeak ? '2px solid #C6A85A' : '1px solid transparent', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {entry && <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: intensity > 0.5 ? 'white' : 'var(--text-2)', fontWeight: 700 }}>{entry.total_sales}</span>}
                        </div>
                        <div style={{ fontSize: '8px', color: isPeak ? '#C6A85A' : 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: '4px', fontWeight: isPeak ? 700 : 400 }}>{mn}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent major events */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                {calendarOverlay.events
                  .filter((e: any) => e.is_tier1 && e.year >= new Date().getFullYear() - 3)
                  .sort((a: any, b: any) => b.year - a.year || b.month - a.month)
                  .slice(0, 8)
                  .map((e: any, i: number) => (
                    <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>{e.month_name} {e.year}</div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.house}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#C6A85A', fontWeight: 700 }}>{fmt(e.max_price)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{e.count} lots</div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })()}

        {/* All lots table */}
        {artist.all_lots?.length > 0 && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', marginBottom: '16px' }}>
              {t('artist.allLots')}
            </h2>
            <div className="intelligence-table-wrap" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                    {[t('artist.title'), t('artist.score'), t('lot.price'), t('artist.estRange'), t('artist.auctionHouse'), t('artist.date'), ''].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {artist.all_lots.map((lot: any, i: number) => (
                    <tr key={lot.id}
                      style={{ borderBottom: i < artist.all_lots.length - 1 ? '1px solid var(--border-light)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                      onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-subtle)'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                          {lot.title || 'Untitled'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: scoreColor(lot.deal_score || 0), flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: scoreColor(lot.deal_score || 0) }}>
                            {lot.deal_score != null ? Math.round(lot.deal_score) : '—'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                          {lot.current_price ? `€${lot.current_price.toLocaleString()}` : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                          {lot.estimate_low ? `€${lot.estimate_low.toLocaleString()}` : '—'}
                          {lot.estimate_high ? `–€${lot.estimate_high.toLocaleString()}` : ''}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '120px' }}>
                          {lot.auction_house_name || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                          {lot.auction_date ? new Date(lot.auction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--electric)', fontWeight: 600 }}>→</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
