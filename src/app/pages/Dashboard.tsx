import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken, getUser, getPlanLimits } from '../../lib/auth';
import { Logo } from '../components/Logo';

const API = import.meta.env.VITE_API_URL ?? '';

const SOURCE_FLAG: Record<string, string> = {
  drouot: '🇫🇷', interencheres: '🇫🇷', artcurial: '🇫🇷', artsper: '🇫🇷', singulart: '🇫🇷',
  invaluable: '🇺🇸', liveauctioneers: '🇺🇸', phillips: '🇺🇸',
  sothebys: '🇬🇧', christies: '🇬🇧', bonhams: '🇬🇧', saatchi_art: '🇬🇧',
  artsy: '🌐', catawiki: '🇳🇱', other: '🌐',
};
const SOURCE_LABEL: Record<string, string> = {
  drouot: 'Drouot', interencheres: 'Interenchères', artcurial: 'Artcurial',
  artsper: 'Artsper', singulart: 'Singulart', invaluable: 'Invaluable',
  liveauctioneers: 'LiveAuctioneers', phillips: 'Phillips',
  sothebys: "Sotheby's", christies: "Christie's", bonhams: 'Bonhams',
  saatchi_art: 'Saatchi Art', artsy: 'Artsy', catawiki: 'Catawiki', other: 'Other',
};

function fmtPrice(n: number | null | undefined, currency = '€'): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${currency}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency}${(n / 1_000).toFixed(0)}K`;
  return `${currency}${Math.round(n)}`;
}

function dotColor(status: string): string {
  if (status === 'fresh') return 'var(--navy)';
  if (status === 'stale') return 'var(--gold)';
  return 'var(--text-3)';
}

interface CoverageData {
  coverage_pct: number;
  fresh_sources: number;
  total_sources: number;
  total_lots: number;
  avg_confidence: number | null;
  lots_with_rationale: number;
  status: string;
}

function generateBrief(topLots: any[], sources: any[], totalLots: number, coverage?: CoverageData | null): string[] {
  const lines: string[] = [];
  if (coverage) {
    lines.push(`${coverage.fresh_sources}/${coverage.total_sources} sources live · ${coverage.coverage_pct.toFixed(0)}% market coverage · ${totalLots > 0 ? totalLots.toLocaleString('fr-FR') : '—'} lots`);
  } else {
    lines.push(`${sources.length || '—'} active sources · ${totalLots > 0 ? totalLots.toLocaleString('fr-FR') : '—'} lots in database`);
  }
  if (topLots.length > 0) {
    const best = topLots[0];
    lines.push(`Top signal: ${best.artist_name ?? 'Unknown'} · Score ${best.deal_score != null ? Math.round(best.deal_score) : '—'}/100`);
  }
  if (coverage?.lots_with_rationale) {
    lines.push(`${coverage.lots_with_rationale} AI-analysed lots · Live market scanning active`);
  } else {
    lines.push('AI analysis updated < 15 min ago · Live market scanning active');
  }
  return lines;
}

interface PortfolioStats {
  total_invested: number;
  total_items: number;
  estimated_total_value: number;
  gain_pct: number;
}

function SkeletonLine({ width = '100%', height = '12px' }: { width?: string; height?: string }) {
  return <div className="skeleton" style={{ width, height, borderRadius: '4px', marginBottom: '6px' }} />;
}

function PickCard({ lot, onClick }: { lot: any; onClick: () => void }) {
  const score = lot.deal_score ?? 0;
  return (
    <div
      onClick={onClick}
      style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s', background: 'white' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--electric-border)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
    >
      <div style={{ position: 'relative', paddingTop: '56%', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
        {lot.image_url
          ? <img src={lot.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'var(--border)', fontSize: '22px' }}>◇</span></div>
        }
        <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '3px 7px', background: 'rgba(10,22,40,0.82)', borderRadius: '4px', backdropFilter: 'blur(4px)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'white' }}>{Math.round(score)}</span>
          <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.55)' }}>/100</span>
        </div>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.08em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>{lot.artist_name ?? '—'}</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>{lot.title ?? 'Untitled'}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: lot.score_rationale ? '6px' : '0' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{fmtPrice(lot.current_price ?? lot.estimate_low)}</span>
          {(lot.pct_below_low_estimate ?? 0) > 5 && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#1A7A4A', background: 'rgba(26,122,74,0.08)', padding: '2px 6px', borderRadius: '3px' }}>
              +{Math.round(lot.pct_below_low_estimate)}%
            </span>
          )}
        </div>
        {lot.score_rationale && (
          <div style={{ fontSize: '10px', color: 'var(--text-3)', fontStyle: 'italic', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
            {lot.score_rationale}
          </div>
        )}
      </div>
    </div>
  );
}

const _cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function cachedFetch(url: string, options?: RequestInit): Promise<any> {
  const now = Date.now();
  if (_cache[url] && now - _cache[url].ts < CACHE_TTL) {
    return _cache[url].data;
  }
  const resp = await fetch(url, options);
  const data = await resp.json();
  _cache[url] = { data, ts: now };
  return data;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const limits = getPlanLimits();
  const canSeeRecs = limits.hasFullArtistProfile;

  const [topLots, setTopLots]         = useState<any[]>([]);
  const [newLots, setNewLots]         = useState<any[]>([]);
  const [sources, setSources]         = useState<any[]>([]);
  const [agentRecs, setAgentRecs]     = useState<any[]>([]);
  const [totalLots, setTotalLots]     = useState(0);
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);

  const [coverage, setCoverage]             = useState<CoverageData | null>(null);

  const [lotsLoading, setLotsLoading]       = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [recsLoading, setRecsLoading]       = useState(true);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    cachedFetch(`${API}/api/lots?sort_by=deal_score&sort_dir=desc&page_size=6&min_score=60`, { headers })
      .then(data => { setTopLots(data.items ?? []); setTotalLots(data.total ?? 0); setLotsLoading(false); })
      .catch(() => setLotsLoading(false));

    cachedFetch(`${API}/api/lots?sort_by=created_at&sort_dir=desc&page_size=3`, { headers })
      .then(data => setNewLots(data.items ?? []))
      .catch(() => {});

    cachedFetch(`${API}/api/lots/sources`, { headers })
      .then(data => { setSources(Array.isArray(data) ? data : []); setSourcesLoading(false); })
      .catch(() => setSourcesLoading(false));

    cachedFetch(`${API}/api/lots/coverage`, { headers })
      .then(data => { if (data) setCoverage(data); })
      .catch(() => {});

    if (canSeeRecs) {
      cachedFetch(`${API}/api/agent/recommendations?limit=3`, { headers })
        .then(data => { setAgentRecs(Array.isArray(data) ? data : []); setRecsLoading(false); })
        .catch(() => setRecsLoading(false));
    } else {
      setRecsLoading(false);
    }

    if (user) {
      cachedFetch(`${API}/api/portfolio/stats`, { headers })
        .then(data => { setPortfolioStats(data); setPortfolioLoading(false); })
        .catch(() => setPortfolioLoading(false));
    } else {
      setPortfolioLoading(false);
    }
  }, [canSeeRecs, user]);

  const briefLines = generateBrief(topLots, sources, totalLots, coverage);

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--bg)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', padding: '32px 40px', alignItems: 'start', maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── LEFT COLUMN ───────────────────────────────────── */}
        <div>

          {/* TODAY'S PICKS */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Today's Picks</h2>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>AI SELECTION · 15MIN</span>
            </div>
            {lotsLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ borderRadius: '6px', height: '180px' }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {topLots.map(lot => (
                  <PickCard key={lot.id} lot={lot} onClick={() => navigate(`/app/opportunities/${lot.id}`)} />
                ))}
              </div>
            )}
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={() => navigate('/app/explore')}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--electric)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                View all opportunities →
              </button>
            </div>
          </div>

          {/* AI BRIEF */}
          <div style={{ background: 'var(--navy)', borderRadius: '8px', padding: '16px 24px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Logo variant="symbol" color="white" size={28} />
            <div style={{ flex: 1 }}>
              {briefLines.map((line, i) => (
                <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: i === 0 ? 'white' : 'rgba(255,255,255,0.45)', marginBottom: i < briefLines.length - 1 ? '3px' : 0, letterSpacing: '0.04em' }}>
                  {line}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulseDot 2s infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)' }}>LIVE</span>
            </div>
          </div>

          {/* BOTTOM ROW 3-col */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', alignItems: 'start' }}>

            {/* Agent Signals */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Agent Signals</h3>
                {agentRecs.length > 0 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, background: 'var(--electric-subtle)', color: 'var(--electric)', border: '1px solid var(--electric-border)', padding: '2px 6px', borderRadius: '10px', letterSpacing: '0.08em' }}>
                    {agentRecs.length}
                  </span>
                )}
              </div>
              {(!canSeeRecs || (!recsLoading && agentRecs.length === 0)) ? (
                <div style={{ background: 'var(--navy)', borderRadius: '6px', padding: '18px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'white', marginBottom: '6px', fontWeight: 600 }}>Configure your agent</div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '0 0 14px', lineHeight: 1.5 }}>
                    Get AI signals tailored to your investment preferences.
                  </p>
                  <button
                    onClick={() => navigate(canSeeRecs ? '/app/agent' : '/app/pricing')}
                    className="btn-electric"
                    style={{ fontSize: '11px', padding: '7px 14px', textTransform: 'none' as const }}
                  >
                    {canSeeRecs ? 'Start →' : 'Unlock →'}
                  </button>
                </div>
              ) : recsLoading ? (
                <><SkeletonLine height="44px" /><SkeletonLine height="44px" /><SkeletonLine height="44px" /></>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                  {agentRecs.map((rec: any, i: number) => {
                    const verdict = rec.verdict ?? rec.recommendation ?? '';
                    const score = rec.conviction ?? rec.deal_score ?? rec.score ?? 0;
                    const isStrongBuy = verdict === 'STRONG_BUY';
                    return (
                      <div
                        key={rec.id ?? i}
                        onClick={() => navigate('/app/agent')}
                        style={{ padding: '10px 12px', borderBottom: i < agentRecs.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {verdict && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: isStrongBuy ? 'rgba(198,168,90,0.12)' : 'rgba(26,42,68,0.08)', color: isStrongBuy ? 'var(--gold-dim)' : 'var(--navy)', border: `1px solid ${isStrongBuy ? 'rgba(198,168,90,0.3)' : 'rgba(26,42,68,0.15)'}`, padding: '2px 5px', borderRadius: '2px' }}>
                              {verdict.replace('_', ' ')}
                            </span>
                          )}
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.artist_name ?? '—'}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>{score}/100</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: 'var(--navy)', margin: '0 0 14px' }}>Quick Actions</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { icon: '◆', label: 'Explore Lots',    to: '/app/explore',   color: 'var(--electric)' },
                  { icon: '◈', label: 'Configure Agent', to: '/app/agent',     color: 'var(--gold)' },
                  { icon: '◇', label: 'My Portfolio',     to: '/app/portfolio', color: 'var(--navy)' },
                  { icon: '⚡', label: 'Alerts',          to: '/app/alerts',    color: '#1A7A4A' },
                ].map(({ icon, label, to, color }) => (
                  <button
                    key={to}
                    onClick={() => navigate(to)}
                    style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', background: 'white', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--electric-border)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
                  >
                    <span style={{ fontSize: '16px', color }}>{icon}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)' }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Portfolio Snapshot */}
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: 'var(--navy)', margin: '0 0 14px' }}>Portfolio</h3>
              {portfolioLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ borderRadius: '6px', height: '52px' }} />
                  ))}
                </div>
              ) : !user ? (
                <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '10px' }}>Sign in to see your portfolio</div>
                  <button onClick={() => navigate('/app/login')} className="btn-electric" style={{ fontSize: '11px', padding: '7px 14px', textTransform: 'none' as const }}>
                    Sign in
                  </button>
                </div>
              ) : !portfolioStats || portfolioStats.total_items === 0 ? (
                <div style={{ padding: '8px 0', fontSize: '13px', color: 'var(--text-3)' }}>
                  No artworks yet.{' '}
                  <button onClick={() => navigate('/app/portfolio')} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--electric)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    Add one →
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    {([
                      { label: 'Invested',   value: fmtPrice(portfolioStats.total_invested) },
                      { label: 'Est. Value', value: fmtPrice(portfolioStats.estimated_total_value) },
                      { label: 'Return',     value: `${portfolioStats.gain_pct >= 0 ? '+' : ''}${portfolioStats.gain_pct}%`, color: portfolioStats.gain_pct >= 0 ? '#1A7A4A' : '#C0392B' },
                      { label: 'Works',      value: String(portfolioStats.total_items) },
                    ] as Array<{ label: string; value: string; color?: string }>).map(({ label, value, color }) => (
                      <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => navigate('/app/portfolio')} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--electric)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    Manage portfolio →
                  </button>
                </>
              )}
            </div>

          </div>
        </div>

        {/* ── RIGHT: MARKET ACTIVITY ────────────────────────── */}
        <div style={{ position: 'sticky', top: '80px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--navy)', margin: '0 0 16px' }}>Market Activity</h2>

          {/* Source Health */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', background: 'white' }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Source Health</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulseDot 2s infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.08em' }}>LIVE</span>
              </div>
            </div>
            {sourcesLoading ? (
              <div style={{ padding: '12px' }}>
                <SkeletonLine /><SkeletonLine /><SkeletonLine /><SkeletonLine />
              </div>
            ) : sources.length === 0 ? (
              <div style={{ padding: '14px', fontSize: '12px', color: 'var(--text-3)' }}>No sources available</div>
            ) : (
              sources.slice(0, 8).map((s: any, i: number) => {
                const key = (s.source ?? s.name ?? '').toLowerCase();
                const flag = SOURCE_FLAG[key] ?? '🌐';
                const label = SOURCE_LABEL[key] ?? s.source ?? s.name ?? '—';
                const status = s.status ?? 'offline';
                return (
                  <div key={s.source ?? s.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderBottom: i < Math.min(sources.length, 8) - 1 ? '1px solid var(--border-light, rgba(0,0,0,0.06))' : 'none' }}>
                    <span style={{ fontSize: '13px', flexShrink: 0 }}>{flag}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1 }}>{label}</span>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor(status), flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', minWidth: '36px', textAlign: 'right' }}>
                      {(s.lot_count ?? s.total ?? 0).toLocaleString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* New This Cycle */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>New This Cycle</h3>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulseDot 2s infinite' }} />
            </div>
            {newLots.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Loading…</div>
            ) : (
              <div>
                {newLots.map((lot, i) => (
                  <div
                    key={lot.id}
                    onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                    style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: i < newLots.length - 1 ? '1px solid var(--border-light, rgba(0,0,0,0.06))' : 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.65'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'var(--bg-subtle)', flexShrink: 0, overflow: 'hidden' }}>
                      {lot.image_url && <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.06em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lot.artist_name ?? '—'}</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lot.title ?? 'Untitled'}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', marginTop: '2px' }}>{fmtPrice(lot.current_price ?? lot.estimate_low)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
