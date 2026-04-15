import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
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

  const [topLots, setTopLots]               = useState<any[]>([]);
  const [recentLots, setRecentLots]         = useState<any[]>([]);
  const [sentiment, setSentiment]           = useState<any>(null);
  const [marketStats, setMarketStats]       = useState<{ total_lots: number; avg_score: number; exceptional: number }>({ total_lots: 0, avg_score: 0, exceptional: 0 });
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [portfolioReturn, setPortfolioReturn] = useState(0);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [agentAlerts, setAgentAlerts]       = useState<any[]>([]);
  const [brief, setBrief]                   = useState<string>('');

  useEffect(() => {
    const token = getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Top lots
    cachedFetch(`${BACKEND}/api/lots?sort_by=deal_score&sort_dir=desc&min_score=60&page_size=6`, { headers })
      .then((d: any) => {
        const items = d.items || [];
        setTopLots(items);
        const total = d.total || 0;
        const avgScore = items.length > 0
          ? Math.round(items.reduce((s: number, l: any) => s + (l.deal_score ?? 0), 0) / items.length)
          : 0;
        const exceptional = items.filter((l: any) => (l.deal_score ?? 0) >= 80).length;
        setMarketStats({ total_lots: total, avg_score: avgScore, exceptional });
      })
      .catch(() => {});

    // Market sentiment
    cachedFetch(`${BACKEND}/api/market/sentiment`)
      .then((d: any) => { if (d?.segments) setSentiment(d); })
      .catch(() => {});

    // Recent lots
    cachedFetch(`${BACKEND}/api/lots?sort_by=created_at&sort_dir=desc&page_size=5`, { headers })
      .then((d: any) => setRecentLots(d.items || []))
      .catch(() => {});

    // Portfolio
    if (token) {
      cachedFetch(`${BACKEND}/api/portfolio/items`, { headers })
        .then((d: any) => {
          const items: any[] = d.items || d || [];
          setPortfolioItems(items);
          const invested = items.reduce((s: number, i: any) => s + (i.purchase_price_eur || 0), 0);
          const value = items.reduce((s: number, i: any) => s + (i.estimated_current_value_eur || i.purchase_price_eur || 0), 0);
          setPortfolioValue(value);
          setPortfolioReturn(invested > 0 ? (value - invested) / invested * 100 : 0);
        })
        .catch(() => {});

      // Agent alerts
      cachedFetch(`${BACKEND}/api/agent/alerts`, { headers })
        .then((d: any) => setAgentAlerts(d.alerts || (Array.isArray(d) ? d : [])))
        .catch(() => {});
    }
  }, []);

  // AI Market Brief — streams from chat endpoint
  useEffect(() => {
    if (topLots.length === 0) return;
    const token = getToken();
    const avgScore = Math.round(topLots.reduce((s, l) => s + (l.deal_score ?? 0), 0) / topLots.length);
    const exceptional = topLots.filter(l => (l.deal_score ?? 0) >= 80).length;

    fetch(`${BACKEND}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        message: `You are Larry, art investment advisor for Nautilus.

Generate an AI Market Brief of 3 ULTRA concise bullet points (max 15 words each) based on this market data:
- ${topLots.length} opportunities detected, avg score ${avgScore}/100
- ${exceptional} EXCEPTIONAL lots (score ≥ 80)
- Top opportunity: ${topLots[0]?.artist_name_raw || 'Unknown'} — ${topLots[0]?.title || ''} at ${topLots[0]?.current_price ? '€' + Math.round(topLots[0].current_price) : 'unknown price'}

STRICT response format — exactly 3 lines, each starting with ◆:
◆ [market insight 1]
◆ [market insight 2]
◆ [market insight 3]

No introduction, no conclusion, just the 3 lines.`,
      }),
    })
      .then(async resp => {
        if (!resp.ok) return;
        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        if (!reader) return;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.delta) fullText += parsed.delta;
              if (parsed.done) {
                setBrief((parsed.full || fullText).replace(/\s*—\s*Larry[\s\S]*$/im, '').trim());
              }
            } catch { continue; }
          }
        }
      })
      .catch(() => {});
  }, [topLots]);

  return (
    <div style={{
      height: 'calc(100vh - 57px)',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ═══ ZONE A — KPI BAR (full width, 48px) ═══ */}
      <div style={{
        background: 'var(--navy)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        height: '48px',
        flexShrink: 0,
      }}>
        {([
          { label: 'LOTS TRACKED', value: marketStats.total_lots > 0 ? marketStats.total_lots.toLocaleString() : '—', delta: null, highlight: false },
          { label: 'EXCEPTIONAL', value: marketStats.exceptional > 0 ? marketStats.exceptional.toString() : '—', delta: null, highlight: true },
          { label: 'AVG SCORE', value: marketStats.avg_score > 0 ? `${marketStats.avg_score}/100` : '—', delta: null, highlight: false },
          { label: 'MARKET', value: sentiment?.overall || 'NEUTRAL', delta: null, highlight: false },
          {
            label: 'PORTFOLIO',
            value: fmtPrice(portfolioValue || null),
            delta: portfolioReturn ? `${portfolioReturn >= 0 ? '+' : ''}${portfolioReturn.toFixed(1)}%` : null,
            highlight: false,
          },
        ] as Array<{ label: string; value: string; delta: string | null; highlight: boolean }>).map(({ label, value, delta, highlight }, i) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center',
            padding: '0 24px',
            borderRight: i < 4 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            height: '100%',
          }}>
            <div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em' }}>
                {label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: highlight ? '#C6A85A' : 'white', lineHeight: 1.2 }}>
                {value}
                {delta && (
                  <span style={{ marginLeft: '6px', fontSize: '11px', color: portfolioReturn >= 0 ? '#34D399' : '#F87171' }}>
                    {delta}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Right: date + live indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* ═══ ZONES B + C ═══ */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>

        {/* ═══ ZONE B — LEFT MAIN ═══ */}
        <div style={{ overflowY: 'auto', padding: '24px 28px', borderRight: '1px solid var(--border)' }}>

          {/* Today's Picks */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>
                  Today's Picks
                </h2>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                  AI SELECTION
                </span>
              </div>
              <button
                onClick={() => navigate('/app/explore?tab=best')}
                style={{ fontSize: '12px', color: 'var(--electric)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                View all →
              </button>
            </div>

            {/* 3 lot cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              {topLots.length === 0
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ borderRadius: '8px', height: '240px' }} />
                  ))
                : topLots.slice(0, 3).map((lot: any, i: number) => {
                    const upside = lot.upside_percentage
                      ? `+${lot.upside_percentage.toFixed(0)}%`
                      : lot.estimate_low && lot.current_price && lot.current_price < lot.estimate_low
                      ? `+${((lot.estimate_low - lot.current_price) / lot.current_price * 100).toFixed(0)}%`
                      : (lot.pct_below_low_estimate ?? 0) > 5
                      ? `+${Math.round(lot.pct_below_low_estimate)}%`
                      : null;
                    return (
                      <div key={lot.id}
                        onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                        style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'var(--shadow-md)'; el.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'none'; el.style.transform = 'none'; }}
                      >
                        <div style={{ height: '160px', background: 'var(--bg-subtle)', position: 'relative', overflow: 'hidden' }}>
                          <LotImage src={lot.image_url} alt={lot.title} />
                          <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(10,22,40,0.85)', backdropFilter: 'blur(4px)', padding: '3px 7px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'white' }}>
                            {lot.deal_score != null ? Math.round(lot.deal_score) : '—'}/100
                          </div>
                          {i === 0 && (
                            <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#C6A85A', padding: '2px 8px', borderRadius: '3px', fontSize: '8px', fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                              #1 TODAY
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lot.artist_name_raw || lot.artist?.name || lot.artist_name || 'Unknown'}
                          </div>
                          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--text)', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lot.title || 'Untitled'}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                              {fmtPrice(lot.current_price ?? lot.estimate_low)}
                            </span>
                            {upside && (
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--electric)', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', padding: '2px 7px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                                {upside}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>

            {/* AI Brief */}
            {brief && (
              <div style={{ background: 'var(--navy)', borderRadius: '8px', padding: '18px 22px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', flexShrink: 0, marginTop: '2px' }}>
                  <svg viewBox="0 0 40 40" fill="none">
                    <path d="M 20 4 A 16 16 0 0 1 36 20" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                    <path d="M 36 20 A 16 16 0 0 1 20 36" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.5"/>
                    <path d="M 20 36 A 8 8 0 0 1 12 28" stroke="#C6A85A" strokeWidth="2.2" strokeLinecap="round"/>
                    <circle cx="20" cy="20" r="1.8" fill="#C6A85A"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', letterSpacing: '0.04em' }}>AI Market Brief</span>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: '#34D399', fontFamily: 'var(--font-mono)', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', padding: '1px 6px', borderRadius: '2px', letterSpacing: '0.12em' }}>LIVE</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                    {brief}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Intelligence Signals */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--text)', margin: '0 0 12px' }}>
              Intelligence Signals
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {([
                {
                  tag: 'BEST OPPORTUNITY',
                  icon: '◆',
                  color: '#C6A85A',
                  title: topLots[0] ? (topLots[0].artist_name_raw || topLots[0].artist?.name || topLots[0].artist_name || 'Unknown') : '—',
                  sub: topLots[0] ? `Score ${topLots[0].deal_score != null ? Math.round(topLots[0].deal_score) : '—'}/100 · ${fmtPrice(topLots[0].current_price ?? topLots[0].estimate_low)}` : 'Loading...',
                  cta: 'View lot →',
                  action: () => topLots[0] && navigate(`/app/opportunities/${topLots[0].id}`),
                },
                {
                  tag: 'MARKET SIGNAL',
                  icon: '◎',
                  color: 'var(--electric)',
                  title: sentiment?.overall || 'NEUTRAL',
                  sub: `${sentiment?.overall_score != null ? sentiment.overall_score.toFixed(0) : '—'}/100 · ${sentiment?.segments?.length || 0} segments tracked`,
                  cta: 'Explore →',
                  action: () => navigate('/app/explore?tab=best'),
                },
                {
                  tag: 'YOUR PORTFOLIO',
                  icon: '◐',
                  color: 'var(--navy)',
                  title: portfolioItems.length > 0
                    ? `${portfolioReturn >= 0 ? '+' : ''}${portfolioReturn.toFixed(1)}%`
                    : '—',
                  sub: `${portfolioItems.length} works · ${fmtPrice(portfolioValue || null)} est. value`,
                  cta: 'Manage →',
                  action: () => navigate('/app/portfolio'),
                },
              ] as Array<{ tag: string; icon: string; color: string; title: string; sub: string; cta: string; action: () => void }>).map(({ tag, icon, color, title, sub, cta, action }) => (
                <div key={tag}
                  onClick={action}
                  style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '6px' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'var(--navy)'; el.style.boxShadow = 'var(--shadow-sm)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'var(--border)'; el.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color }}>{icon}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>{tag}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '17px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.4 }}>{sub}</div>
                  <div style={{ fontSize: '11px', color: 'var(--electric)', fontWeight: 700, marginTop: '4px' }}>{cta}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Signals */}
          {agentAlerts.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--text)', margin: 0 }}>Agent Signals</h3>
                <button onClick={() => navigate('/app/agent')} style={{ fontSize: '12px', color: 'var(--electric)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Manage →
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {agentAlerts.slice(0, 3).map((alert: any, i: number) => (
                  <div key={alert.id || i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{alert.name || alert.strategy_type || 'Signal'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{alert.description || (alert.max_price ? `Budget ${fmtPrice(alert.max_price)}` : '')}</div>
                    </div>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: alert.is_active ? '#34D399' : 'var(--border)', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ═══ ZONE C — RIGHT SIDEBAR ═══ */}
        <div style={{ overflowY: 'auto', background: 'white', borderLeft: '1px solid var(--border)' }}>

          {/* Market Activity */}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 14px' }}>
              Market Activity
            </h3>
            {[
              { label: 'Auction lots', sub: 'Global coverage', value: marketStats.total_lots > 0 ? marketStats.total_lots.toLocaleString() : '—' },
              { label: 'Avg deal score', sub: 'Current selection', value: marketStats.avg_score > 0 ? `${marketStats.avg_score}/100` : '—' },
              { label: 'Exceptional lots', sub: 'Score ≥ 80', value: marketStats.exceptional > 0 ? marketStats.exceptional.toString() : '—' },
            ].map(({ label, sub, value }, i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 2 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{sub}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Market Sentiment */}
          {sentiment && (
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                    Market Sentiment
                  </h3>
                  <div style={{ position: 'relative', display: 'inline-block' }}
                    onMouseEnter={e => { const t = (e.currentTarget as HTMLDivElement).querySelector('.tt') as HTMLDivElement | null; if (t) t.style.display = 'block'; }}
                    onMouseLeave={e => { const t = (e.currentTarget as HTMLDivElement).querySelector('.tt') as HTMLDivElement | null; if (t) t.style.display = 'none'; }}
                  >
                    <div style={{ width: '15px', height: '15px', borderRadius: '50%', background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontSize: '9px', color: 'var(--text-3)', fontWeight: 700 }}>?</div>
                    <div className="tt" style={{ display: 'none', position: 'absolute', bottom: '20px', right: '0', background: 'var(--navy)', color: 'white', fontSize: '11px', padding: '10px 12px', borderRadius: '6px', width: '200px', zIndex: 100, lineHeight: 1.5 }}>
                      Sentiment is calculated from deal scores and lot volume across segments. ↑ Bullish = strong demand.
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '3px', letterSpacing: '0.1em',
                  background: sentiment.overall === 'BULLISH' ? 'var(--electric-subtle)' : 'var(--bg-subtle)',
                  color: sentiment.overall === 'BULLISH' ? 'var(--electric)' : 'var(--text-3)',
                  border: `1px solid ${sentiment.overall === 'BULLISH' ? 'var(--electric-border)' : 'var(--border)'}`,
                }}>
                  {sentiment.overall}
                </span>
              </div>
              {sentiment.segments?.slice(0, 5).map((seg: any) => (
                <div key={seg.segment} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)', width: '110px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.segment}</div>
                  <div style={{ flex: 1, height: '3px', background: 'var(--bg-subtle)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', borderRadius: '2px', width: `${Math.min(seg.avg_score, 100)}%`, background: seg.sentiment === 'BULLISH' ? 'var(--electric)' : seg.sentiment === 'BEARISH' ? '#EF4444' : 'var(--border)', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', width: '28px', textAlign: 'right', flexShrink: 0 }}>{seg.avg_score}</div>
                </div>
              ))}
            </div>
          )}

          {/* New This Cycle */}
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                New This Cycle
              </h3>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#C6A85A', animation: 'pulse 2s infinite' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {recentLots.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: '56px', borderRadius: '4px', marginBottom: '8px' }} />
                  ))
                : recentLots.slice(0, 5).map((lot: any) => {
                    const artist = lot.artist_name_raw || lot.artist?.name || lot.artist_name;
                    const rawTitle = lot.title?.replace(/^\d+h\s*\d+m.*?[-–]\s*/i, '').trim();
                    const displayTitle = artist && artist !== '—' && artist !== 'Unknown'
                      ? artist
                      : rawTitle?.slice(0, 35) || 'Untitled';
                    const displaySub = artist && artist !== '—' && artist !== 'Unknown'
                      ? rawTitle?.slice(0, 30) || ''
                      : lot.auction_house_name || '';

                    return (
                      <div key={lot.id}
                        onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                        style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'opacity 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.7'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                      >
                        <div style={{ width: '44px', height: '44px', background: 'var(--bg-subtle)', borderRadius: '4px', flexShrink: 0, overflow: 'hidden' }}>
                          <LotImage src={lot.image_url} alt="" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                            {displayTitle}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displaySub}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
                          {fmtPrice(lot.current_price ?? lot.estimate_low)}
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
