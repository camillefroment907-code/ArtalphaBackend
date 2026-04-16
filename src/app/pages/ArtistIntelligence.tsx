import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// ── Price chart ───────────────────────────────────────────────────────────────

interface YearPoint { year: string; avg_price: number; max_price: number; sale_count: number; }

function PriceChart({ data, stats }: { data: YearPoint[]; stats: any }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (!data || data.length < 2) return null;

  const W = 840, H = 220;
  const PAD = { top: 28, right: 28, bottom: 44, left: 80 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // ── Outlier-resistant Y scale (cap at 95th percentile * 1.3) ──────────────
  const sorted = [...data].map(d => d.avg_price).sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
  const peakVal = Math.max(...data.map(d => d.avg_price));
  const hasMassiveOutlier = peakVal > p95 * 2.5;
  const yMax = hasMassiveOutlier ? p95 * 1.5 : peakVal * 1.18;
  const peakIdx = data.reduce((mi, d, i) => d.avg_price > data[mi].avg_price ? i : mi, 0);

  const xPos = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yPos = (v: number) => PAD.top + innerH - (Math.min(v, yMax) / yMax) * innerH;

  // ── Smooth monotone cubic bezier ─────────────────────────────────────────
  const pts = data.map((d, i) => ({ x: xPos(i), y: yPos(d.avg_price) }));
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
    data.forEach((_, i) => {
      const d = Math.abs(xPos(i) - mx);
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
            Hammer Price History · Artsy
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {fmt(stats?.avg_hammer_eur || 0)}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>avg hammer</div>
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
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>record sale</div>
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
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>above est.</div>
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
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>avg</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#93C5FD' }}>{fmt(hov.avg_price)}</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>record</span>
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
            const bh = Math.max(1, (d.sale_count / maxCount) * volH);
            return (
              <rect key={i}
                x={(xPos(i) - barW / 2).toFixed(1)} y={(PAD.top + innerH - bh).toFixed(1)}
                width={barW} height={bh.toFixed(1)}
                fill="url(#pcVolGrad)" rx="1"
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
              x1={xPos(hovered).toFixed(1)} y1={PAD.top}
              x2={xPos(hovered).toFixed(1)} y2={PAD.top + innerH}
              stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="4 4"
            />
          )}

          {/* Hover dot */}
          {hovered !== null && (
            <circle cx={xPos(hovered).toFixed(1)} cy={yPos(data[hovered].avg_price).toFixed(1)} r="5"
              fill="white" stroke="#3B82F6" strokeWidth="2.5" filter="url(#pcGlow)" />
          )}
        </g>

        {/* Outlier annotation (record sale above cap) */}
        {hasMassiveOutlier && (() => {
          const rx = xPos(peakIdx);
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
          <text key={i} x={xPos(i).toFixed(1)} y={PAD.top + innerH + 22} textAnchor="middle"
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
  const navigate = useNavigate();
  const { artistName } = useParams<{ artistName: string }>();
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any>(null);

  useEffect(() => {
    if (!artistName) { setLoading(false); return; }
    setLoading(true);
    const token = getToken();
    const name = encodeURIComponent(decodeURIComponent(artistName));
    fetch(`${BACKEND}/api/artist-profiles/${name}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => { setArtist(data); setLoading(false); })
      .catch(() => setLoading(false));

    // Price history — independent, non-blocking
    fetch(`${BACKEND}/api/artist-profiles/${name}/price-history`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.price_by_year?.length >= 2) setPriceHistory(d); })
      .catch(() => {});
  }, [artistName]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`${BACKEND}/api/artist-profiles/search/${encodeURIComponent(query)}`);
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
              Artist Intelligence
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>
              Search any artist
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '440px', margin: '0 auto' }}>
              Full market intelligence — prices, scores, auction history, AI analysis.
            </p>
          </div>

          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: '32px' }}>
            <input
              className="input"
              placeholder="Search artist — e.g. Picasso, Basquiat, Miró..."
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
            Loading artist intelligence...
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
          ← Back
        </button>
        <span style={{ color: 'var(--border)' }}>·</span>
        <button onClick={() => navigate('/app/artists')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Artist Intelligence
        </button>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px' }}>

        {/* Artist header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', marginBottom: '32px' }}>

          {/* Left — Identity + AI brief */}
          <div>
            {/* Name + dates */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '42px', fontWeight: 600, color: 'var(--text)', margin: 0, lineHeight: 1.1 }}>
                {artist.artist_name || artist.name}
              </h1>
              {(artist.birth_year || artist.death_year) && (
                <span style={{ fontSize: '15px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {artist.birth_year || '?'}
                  {artist.death_year ? `–${artist.death_year}` : '–'}
                </span>
              )}
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

            {/* AI brief or fallback */}
            {artist.ai_brief ? (
              <div style={{ background: 'var(--navy)', borderRadius: '10px', padding: '18px 22px', marginBottom: '20px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '8px' }}>
                  ◆ NAUTILUS ANALYST BRIEF
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, margin: 0 }}>
                  {artist.ai_brief}
                </p>
              </div>
            ) : (
              <div style={{ background: '#F5F3EE', border: '1px solid #E8E4DD', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
                <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#9CA3AF', margin: 0, lineHeight: 1.6 }}>
                  Market data available — artist biography coming soon.
                </p>
              </div>
            )}

            {artist.top_auction_houses?.length > 0 && (
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Top auction houses
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {artist.top_auction_houses.map((h: any) => (
                    <div key={h.name} style={{ padding: '5px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{h.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{h.count}</span>
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
                AVG CONVICTION SCORE
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
                { label: 'LOTS TRACKED', value: artist.total_lots?.toLocaleString() || '0', color: undefined },
                { label: 'AVG PRICE', value: stats.avg_price ? `€${stats.avg_price.toLocaleString()}` : '—', color: undefined },
                { label: 'PRICE RANGE', value: stats.max_price ? `€${(stats.min_price || 0).toLocaleString()}–${(stats.max_price || 0).toLocaleString()}` : '—', color: undefined },
                { label: 'MOMENTUM', value: (stats.momentum || 'stable').toUpperCase(), color: stats.momentum === 'rising' ? '#34D399' : undefined },
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
            </div>

            <button
              onClick={() => navigate('/app/portfolio?tab=artists')}
              style={{ padding: '12px', background: 'var(--electric)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
            >
              ★ Follow this artist
            </button>
          </div>
        </div>

        {/* Categories */}
        {artist.categories?.length > 0 && (
          <div style={{ marginBottom: '32px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>WORKS IN:</span>
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
                Top opportunities
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {artist.total_lots} lots total
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {artist.top_lots.map((lot: any) => (
                <div key={lot.id}
                  onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                  style={{ background: 'white', border: '1px solid var(--border)', borderTop: `2px solid ${scoreColor(lot.deal_score || 0)}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
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
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--text)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              ))}
            </div>
          </div>
        )}

        {/* Price history chart */}
        {priceHistory && (
          <PriceChart
            data={priceHistory.price_by_year}
            stats={{ ...priceHistory.statistics, total_sales: priceHistory.total_sales }}
          />
        )}

        {/* All lots table */}
        {artist.all_lots?.length > 0 && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text)', marginBottom: '16px' }}>
              All tracked lots
            </h2>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                    {['Title', 'Score', 'Price', 'Est. Range', 'Auction House', 'Date', ''].map(h => (
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
      </div>
    </div>
  );
}
