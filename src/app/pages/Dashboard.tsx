import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken, getUser, getPlanLimits } from '../../lib/auth';

const API = import.meta.env.VITE_API_URL ?? '';

// ── Source metadata ───────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number | null | undefined, currency = '€'): string {
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

function scoreColor(s: number): string {
  if (s >= 80) return 'var(--gold)';
  if (s >= 65) return 'var(--navy)';
  return 'var(--text-3)';
}

interface PortfolioStats {
  total_invested: number;
  total_items: number;
  estimated_total_value: number;
  gain_pct: number;
}

// ── Sub-components ────────────────────────────────────────────
function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <h2 style={{
        fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600,
        color: 'var(--navy)', margin: '0 0 3px',
      }}>
        {children}
      </h2>
      {sub && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)',
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SkeletonLine({ width = '100%', height = '12px' }: { width?: string; height?: string }) {
  return (
    <div className="skeleton" style={{ width, height, borderRadius: '3px', marginBottom: '6px' }} />
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.45)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
        color: 'white',
      }}>
        {value}
      </span>
    </div>
  );
}

// ── LotRow (Bloomberg list format) ────────────────────────────
function LotRow({ lot, onClick }: { lot: any; onClick: () => void }) {
  const score = lot.deal_score ?? 0;
  const price = lot.current_price ?? lot.estimate_low ?? 0;
  const upside = Math.round(lot.pct_below_low_estimate ?? 0);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer', transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Thumbnail */}
      <div style={{
        width: '48px', height: '48px', borderRadius: '2px',
        background: 'var(--bg-subtle)', flexShrink: 0, overflow: 'hidden',
      }}>
        {lot.image_url ? (
          <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--border)', fontSize: '16px' }}>◇</span>
          </div>
        )}
      </div>

      {/* Artist + title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--navy)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: '2px',
        }}>
          {lot.artist_name ?? '—'}
        </div>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lot.title ?? 'Untitled'}
        </div>
      </div>

      {/* Score badge */}
      <div style={{
        padding: '3px 8px',
        background: 'var(--navy-subtle, rgba(26,42,68,0.07))',
        borderRadius: '3px', flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
          color: scoreColor(score),
        }}>
          {score.toFixed(0)}
        </span>
      </div>

      {/* Price */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700,
        color: 'var(--text)', flexShrink: 0, minWidth: '60px', textAlign: 'right',
      }}>
        {fmt(price)}
      </div>

      {/* Upside */}
      {upside > 5 && (
        <div style={{
          padding: '2px 7px',
          background: 'var(--gold-subtle)',
          border: '1px solid var(--gold-border)',
          borderRadius: '3px', flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
            color: 'var(--gold-dim)',
          }}>
            +{upside}%
          </span>
        </div>
      )}

      {/* Arrow */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: 'var(--navy)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', flexShrink: 0,
      }}>
        →
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const limits = getPlanLimits();
  const canSeeRecs = limits.hasFullArtistProfile;

  const [topLots, setTopLots]         = useState<any[]>([]);
  const [sources, setSources]         = useState<any[]>([]);
  const [recentRecs, setRecentRecs]   = useState<any[]>([]);
  const [totalLots, setTotalLots]     = useState(0);
  const [primaryCount, setPrimaryCount] = useState(0);
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);

  const [lotsLoading, setLotsLoading]       = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [recsLoading, setRecsLoading]       = useState(true);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Top lots + total
    fetch(`${API}/api/lots?sort_by=deal_score&sort_dir=desc&page_size=3&min_score=60`, { headers })
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then(data => {
        setTopLots(data.items ?? []);
        setTotalLots(data.total ?? 0);
        setLotsLoading(false);
      })
      .catch(() => setLotsLoading(false));

    // Sources
    fetch(`${API}/api/lots/sources`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setSources(Array.isArray(data) ? data : []); setSourcesLoading(false); })
      .catch(() => setSourcesLoading(false));

    // Primary count
    fetch(`${API}/api/lots/primary?page_size=1`, { headers })
      .then(r => r.ok ? r.json() : { total: 0 })
      .then(data => setPrimaryCount(data.total ?? 0))
      .catch(() => {});

    // Agent recs
    if (canSeeRecs) {
      fetch(`${API}/api/agent/recommendations?limit=3`, { headers })
        .then(r => r.ok ? r.json() : [])
        .then(data => { setRecentRecs(Array.isArray(data) ? data : []); setRecsLoading(false); })
        .catch(() => setRecsLoading(false));
    } else {
      setRecsLoading(false);
    }

    // Portfolio
    if (user) {
      fetch(`${API}/api/portfolio/stats`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(data => { setPortfolioStats(data); setPortfolioLoading(false); })
        .catch(() => setPortfolioLoading(false));
    } else {
      setPortfolioLoading(false);
    }
  }, [canSeeRecs, user]);

  const avgScore = topLots.length
    ? Math.round(topLots.reduce((s, l) => s + (l.deal_score ?? 0), 0) / topLots.length)
    : 0;

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', background: 'var(--bg)' }}>

      {/* ── ROW 1: Market Status Bar ─────────────────────────── */}
      <div style={{
        background: 'var(--navy)', padding: '10px 40px',
        display: 'flex', alignItems: 'center', gap: '40px',
      }}>
        {/* Stats */}
        <StatusItem label="Sources actives" value={sourcesLoading ? '…' : String(sources.length)} />
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)' }} />
        <StatusItem label="Lots en base" value={lotsLoading ? '…' : totalLots.toLocaleString('fr-FR')} />
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)' }} />
        <StatusItem label="Dernière mise à jour" value="< 15 min" />
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)' }} />
        <StatusItem label="Score moyen" value={lotsLoading ? '…' : String(avgScore)} />
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.12)' }} />
        <StatusItem label="Marché primaire" value={String(primaryCount)} />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: 'var(--gold)', animation: 'pulseDot 2s infinite',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.12em', color: 'white',
          }}>
            LIVE
          </span>
        </div>
      </div>

      <div style={{ padding: '28px 40px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── ROW 2 ─────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr',
          gap: '40px', marginBottom: '32px', alignItems: 'start',
        }}>

          {/* ── LEFT: Top Opportunities ── */}
          <div>
            <SectionTitle sub="SÉLECTION IA · MISE À JOUR 15MIN">
              Meilleures Opportunités
            </SectionTitle>

            <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{
                display: 'flex', padding: '7px 14px',
                background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)',
                gap: '12px',
              }}>
                {['ARTISTE / ŒUVRE', '', 'SCORE', 'PRIX', ''].map((h, i) => (
                  <span key={i} style={{
                    fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)',
                    flex: i === 0 ? 1 : 'none',
                    minWidth: i === 1 ? '48px' : undefined,
                  }}>
                    {h}
                  </span>
                ))}
              </div>

              {lotsLoading ? (
                <div style={{ padding: '16px' }}>
                  <SkeletonLine height="60px" />
                  <SkeletonLine height="60px" />
                  <SkeletonLine height="60px" />
                </div>
              ) : topLots.length === 0 ? (
                <div style={{
                  padding: '32px 16px', textAlign: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)',
                }}>
                  Aucun lot disponible
                </div>
              ) : (
                topLots.map(lot => (
                  <LotRow
                    key={lot.id}
                    lot={lot}
                    onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                  />
                ))
              )}
            </div>

            <div style={{ marginTop: '12px' }}>
              <button
                onClick={() => navigate('/app/explore')}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.06em', color: 'var(--navy)',
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: '0',
                  textDecoration: 'underline',
                }}
              >
                Voir toutes les opportunités →
              </button>
            </div>
          </div>

          {/* ── RIGHT: Market Intelligence ── */}
          <div>
            <SectionTitle>Intelligence Marché</SectionTitle>

            {sourcesLoading ? (
              <>
                <SkeletonLine /><SkeletonLine /><SkeletonLine />
                <SkeletonLine /><SkeletonLine /><SkeletonLine />
              </>
            ) : sources.length === 0 ? (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)',
              }}>
                Aucune source disponible
              </div>
            ) : (
              <div>
                {sources.slice(0, 6).map((s: any) => {
                  const key = (s.source ?? s.name ?? '').toLowerCase();
                  const flag = SOURCE_FLAG[key] ?? '🌐';
                  const label = SOURCE_LABEL[key] ?? s.source ?? s.name ?? '—';
                  const status = s.status ?? 'offline';
                  return (
                    <div
                      key={s.source ?? s.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 0', borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ fontSize: '14px', flexShrink: 0 }}>{flag}</span>
                      <span style={{ fontSize: '12px', color: 'var(--navy)', flex: 1 }}>{label}</span>
                      <div style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: dotColor(status), flexShrink: 0,
                      }} />
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                        color: 'var(--text-3)', minWidth: '40px', textAlign: 'right',
                      }}>
                        {(s.lot_count ?? s.total ?? 0).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
                <p style={{
                  fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                  fontSize: '11px', color: 'var(--text-3)', marginTop: '12px',
                }}>
                  Données agrégées de 10+ sources mondiales
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: '32px' }} />

        {/* ── ROW 3 ─────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '32px', alignItems: 'start',
        }}>

          {/* ── LEFT: Agent Signals ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <h2 style={{
                fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600,
                color: 'var(--navy)', margin: 0,
              }}>
                Signaux Agent IA
              </h2>
              {recentRecs.length > 0 && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
                  letterSpacing: '0.08em',
                  background: 'var(--gold)', color: 'white',
                  padding: '2px 7px', borderRadius: '10px',
                }}>
                  {recentRecs.length}
                </span>
              )}
            </div>

            {!canSeeRecs ? (
              <div style={{
                background: 'var(--navy)', borderRadius: '6px',
                padding: '20px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'white',
                  marginBottom: '8px', fontWeight: 600,
                }}>
                  Configurez votre agent
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', lineHeight: 1.5 }}>
                  Obtenez des signaux IA personnalisés basés sur vos préférences d'investissement.
                </p>
                <button
                  onClick={() => navigate('/app/pricing')}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    background: 'var(--gold)', color: 'white',
                    border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer',
                  }}
                >
                  Débloquer →
                </button>
              </div>
            ) : recsLoading ? (
              <><SkeletonLine height="48px" /><SkeletonLine height="48px" /><SkeletonLine height="48px" /></>
            ) : recentRecs.length === 0 ? (
              <div style={{
                background: 'var(--navy)', borderRadius: '6px', padding: '20px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'white',
                  marginBottom: '8px', fontWeight: 600,
                }}>
                  Configurez votre agent
                </div>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', lineHeight: 1.5 }}>
                  Démarrez une analyse pour recevoir des recommandations personnalisées.
                </p>
                <button
                  onClick={() => navigate('/app/agent')}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    background: 'var(--gold)', color: 'white',
                    border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer',
                  }}
                >
                  Démarrer →
                </button>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                {recentRecs.map((rec: any, i: number) => {
                  const verdict = rec.verdict ?? rec.recommendation ?? '';
                  const score = rec.conviction ?? rec.deal_score ?? rec.score ?? 0;
                  const verdictStyle = verdict === 'STRONG_BUY'
                    ? { bg: 'var(--gold-subtle)', color: 'var(--gold-dim)', border: 'var(--gold-border)' }
                    : verdict === 'BUY'
                    ? { bg: 'rgba(26,42,68,0.07)', color: 'var(--navy)', border: 'rgba(26,42,68,0.2)' }
                    : { bg: 'var(--bg-subtle)', color: 'var(--text-3)', border: 'var(--border)' };
                  return (
                    <div
                      key={rec.id ?? i}
                      onClick={() => navigate('/app/agent')}
                      style={{
                        padding: '10px 14px', borderBottom: '1px solid var(--border)',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        {verdict && (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            background: verdictStyle.bg, color: verdictStyle.color,
                            border: `1px solid ${verdictStyle.border}`,
                            padding: '2px 6px', borderRadius: '2px',
                          }}>
                            {verdict.replace('_', ' ')}
                          </span>
                        )}
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rec.artist_name ?? '—'}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                          color: 'var(--text-3)',
                        }}>
                          {score}/100
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── CENTER: Quick Actions ── */}
          <div>
            <SectionTitle>Actions Rapides</SectionTitle>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '8px',
            }}>
              {[
                { icon: '◆', label: 'Voir les opportunités', to: '/app/explore' },
                { icon: '◈', label: 'Configurer l\'agent',   to: '/app/agent' },
                { icon: '◇', label: 'Mon portfolio',          to: '/app/portfolio' },
                { icon: '⚡', label: 'Mes alertes',           to: '/app/alerts' },
              ].map(({ icon, label, to }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '8px',
                    padding: '16px',
                    background: 'white', border: '1px solid var(--border)',
                    borderRadius: '2px', cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)' }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Portfolio Snapshot ── */}
          <div>
            <SectionTitle>Mon Portfolio</SectionTitle>

            {portfolioLoading ? (
              <><SkeletonLine height="40px" /><SkeletonLine height="40px" /><SkeletonLine height="40px" /></>
            ) : !user ? (
              <div style={{
                padding: '20px', border: '1px solid var(--border)', borderRadius: '4px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '12px' }}>
                  Connectez-vous pour voir votre portfolio
                </div>
                <button onClick={() => navigate('/app/login')} className="btn btn-navy" style={{ fontSize: '11px' }}>
                  Se connecter
                </button>
              </div>
            ) : !portfolioStats || portfolioStats.total_items === 0 ? (
              <div style={{ padding: '12px 0' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '12px' }}>
                  Aucune œuvre ajoutée
                </div>
                <button
                  onClick={() => navigate('/app/portfolio')}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px',
                    color: 'var(--navy)', background: 'none', border: 'none',
                    cursor: 'pointer', textDecoration: 'underline', padding: 0,
                  }}
                >
                  Ajouter une œuvre →
                </button>
              </div>
            ) : (
              <div>
                {[
                  { label: 'Total investi',   value: fmt(portfolioStats.total_invested), mono: true },
                  { label: 'Valeur estimée',  value: fmt(portfolioStats.estimated_total_value), mono: true, accent: true },
                  {
                    label: 'Rendement',
                    value: `${portfolioStats.gain_pct >= 0 ? '+' : ''}${portfolioStats.gain_pct}%`,
                    mono: true,
                    special: portfolioStats.gain_pct >= 0 ? 'pos' : 'neg',
                  },
                  { label: 'Nbre d\'œuvres',  value: String(portfolioStats.total_items), mono: true },
                ].map(({ label, value, mono, accent, special }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    padding: '8px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{label}</span>
                    <span style={{
                      fontFamily: mono ? 'var(--font-mono)' : undefined,
                      fontSize: '13px', fontWeight: 700,
                      color: special === 'pos' ? '#1A7A4A'
                           : special === 'neg' ? '#C0392B'
                           : accent ? 'var(--navy)'
                           : 'var(--text)',
                    }}>
                      {value}
                    </span>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/app/portfolio')}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px',
                    color: 'var(--navy)', background: 'none', border: 'none',
                    cursor: 'pointer', textDecoration: 'underline', padding: '10px 0 0',
                    display: 'block',
                  }}
                >
                  Gérer mon portfolio →
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
