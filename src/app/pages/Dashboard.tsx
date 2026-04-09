import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken, getUser, getPlanLimits } from '../../lib/auth';

const API = import.meta.env.VITE_API_URL ?? '';

// ── helpers ──────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, currency = '€'): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${currency}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${currency}${(n / 1_000).toFixed(0)}K`;
  return `${currency}${n.toFixed(0)}`;
}

function scoreColor(s: number): string {
  if (s >= 80) return 'var(--gold)';
  if (s >= 65) return 'var(--navy)';
  return 'var(--text-3)';
}

function now(): string {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function todayStr(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── sub-components ────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--text-3)', marginBottom: '12px',
      display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      <span style={{ color: 'var(--gold)', fontSize: '8px' }}>◆</span>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0' }} />;
}

function KpiTile({
  label, value, sub, accent = false,
}: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      borderLeft: `2px solid ${accent ? 'var(--gold)' : 'var(--border)'}`,
      paddingLeft: '16px',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--text-3)', marginBottom: '6px',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 400,
        color: accent ? 'var(--gold)' : 'var(--navy)',
        lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          color: 'var(--text-3)', marginTop: '4px',
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function LotRow({ lot, rank, onClick }: { lot: any; rank: number; onClick: () => void }) {
  const score = lot.deal_score ?? lot.score ?? 0;
  const price = lot.current_price ?? lot.estimate_low ?? lot.price;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr 140px 90px 60px',
        gap: '8px', alignItems: 'center',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)',
      }}>
        {rank}
      </span>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>
          {lot.artist_name ?? '—'}
        </div>
        <div style={{
          fontSize: '11px', color: 'var(--text-3)',
          fontStyle: 'italic',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {lot.title ?? '—'}
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-2)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {lot.auction_house_name ?? lot.source ?? '—'}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600,
        color: 'var(--navy)', textAlign: 'right',
      }}>
        {fmt(price)}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
        color: scoreColor(score), textAlign: 'right',
      }}>
        {score.toFixed(0)}
      </div>
    </div>
  );
}

function TableHeader() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '24px 1fr 140px 90px 60px',
      gap: '8px', alignItems: 'center',
      padding: '6px 12px',
      borderBottom: '2px solid var(--border)',
      background: 'var(--bg-subtle)',
    }}>
      {['#', 'ARTISTE / ŒUVRE', 'MAISON', 'PRIX', 'SCORE'].map((h, i) => (
        <span key={h} style={{
          fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)',
          textAlign: i >= 3 ? 'right' : 'left',
        }}>
          {h}
        </span>
      ))}
    </div>
  );
}

function SourceRow({ source }: { source: any }) {
  const total = source.total ?? 0;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '12px', color: 'var(--navy)' }}>
        {source.name ?? source.source ?? '—'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '60px', height: '3px',
          background: 'var(--border)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (total / 500) * 100)}%`,
            background: 'var(--gold)',
            borderRadius: '2px',
          }} />
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
          color: 'var(--text-2)', minWidth: '32px', textAlign: 'right',
        }}>
          {total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function RecRow({ rec }: { rec: any }) {
  const score = rec.deal_score ?? rec.score ?? 0;
  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, marginRight: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)' }}>
            {rec.artist_name ?? '—'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontStyle: 'italic', marginTop: '2px' }}>
            {rec.title ?? '—'}
          </div>
          {rec.reason && (
            <div style={{
              fontSize: '11px', color: 'var(--text-2)', marginTop: '4px',
              lineHeight: 1.4,
            }}>
              {rec.reason}
            </div>
          )}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700,
          color: scoreColor(score), flexShrink: 0,
        }}>
          {score.toFixed(0)}
        </span>
      </div>
    </div>
  );
}

function QuickLink({ icon, label, sub, to }: { icon: string; label: string; sub: string; to: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 12px',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        background: 'transparent',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--gold-border)';
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold-subtle)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)' }}>{label}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{sub}</div>
      </div>
    </button>
  );
}

// ── main component ────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const limits = getPlanLimits();

  const [topLots, setTopLots]       = useState<any[]>([]);
  const [sources, setSources]       = useState<any[]>([]);
  const [recentRecs, setRecentRecs] = useState<any[]>([]);
  const [stats, setStats]           = useState({ total: 0, avgScore: 0, highConviction: 0 });
  const [loading, setLoading]       = useState(true);
  const [clock, setClock]           = useState(now());

  // live clock
  useEffect(() => {
    const id = setInterval(() => setClock(now()), 1000);
    return () => clearInterval(id);
  }, []);

  // fetch data
  useEffect(() => {
    const token = getToken();
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    Promise.all([
      fetch(`${API}/api/lots?sort_by=deal_score&sort_dir=desc&page_size=5&min_score=60`, { headers })
        .then(r => r.ok ? r.json() : { items: [], total: 0 }),
      fetch(`${API}/api/lots/sources`, { headers })
        .then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/agent/recommendations?limit=3`, { headers })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
    ]).then(([lotsData, sourcesData, recsData]) => {
      const items: any[] = lotsData.items ?? [];
      setTopLots(items);
      setSources(Array.isArray(sourcesData) ? sourcesData : []);
      setRecentRecs(Array.isArray(recsData) ? recsData : []);
      setStats({
        total: lotsData.total ?? items.length,
        avgScore: items.length
          ? Math.round(items.reduce((s: number, l: any) => s + (l.deal_score ?? 0), 0) / items.length)
          : 0,
        highConviction: items.filter((l: any) => (l.deal_score ?? 0) >= 75).length,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const isLocked = !user;
  const canSeeRecs = limits.hasFullArtistProfile;

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      background: 'var(--bg)',
      padding: '0',
    }}>
      {/* ── Terminal header bar ── */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--navy)',
        padding: '0 40px',
        height: '36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--gold)',
        }}>
          ARTALPHA TERMINAL
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.05em',
          }}>
            {todayStr()}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
            color: 'rgba(255,255,255,0.8)',
            letterSpacing: '0.08em',
          }}>
            {clock}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--gold)',
            background: 'rgba(180,140,60,0.15)',
            border: '1px solid rgba(180,140,60,0.3)',
            padding: '2px 7px', borderRadius: '2px',
          }}>
            ● LIVE
          </span>
        </div>
      </div>

      <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── KPI tiles ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '32px',
          marginBottom: '36px',
        }}>
          <KpiTile
            label="Lots analysés"
            value={loading ? '…' : stats.total.toLocaleString()}
            sub="toutes sources"
          />
          <KpiTile
            label="Score moyen"
            value={loading ? '…' : stats.avgScore}
            sub="top 5 lots"
          />
          <KpiTile
            label="Sources actives"
            value={loading ? '…' : sources.length}
            sub="plateformes"
          />
          <KpiTile
            label="Haute conviction"
            value={loading ? '…' : stats.highConviction}
            sub="score ≥ 75"
            accent
          />
        </div>

        <Divider />

        {/* ── Main grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: '40px',
          alignItems: 'start',
        }}>
          {/* Left: top lots table */}
          <div>
            <SectionLabel>Top opportunités — deal score desc</SectionLabel>
            <TableHeader />
            {loading ? (
              <div style={{
                padding: '32px 12px',
                fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)',
              }}>
                Chargement…
              </div>
            ) : topLots.length === 0 ? (
              <div style={{
                padding: '32px 12px',
                fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)',
              }}>
                Aucun lot disponible
              </div>
            ) : (
              topLots.map((lot, i) => (
                <LotRow
                  key={lot.id ?? i}
                  lot={lot}
                  rank={i + 1}
                  onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                />
              ))
            )}
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={() => navigate('/app/opportunities')}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--gold-dim)', background: 'transparent',
                  border: '1px solid var(--gold-border)',
                  padding: '7px 16px', borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold-subtle)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                Voir toutes les enchères →
              </button>
            </div>
          </div>

          {/* Right: sources breakdown */}
          <div>
            <SectionLabel>Sources — répartition</SectionLabel>
            {loading ? (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)',
                padding: '16px 0',
              }}>
                Chargement…
              </div>
            ) : sources.length === 0 ? (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)',
                padding: '16px 0',
              }}>
                Aucune donnée source
              </div>
            ) : (
              sources.slice(0, 10).map((s: any, i: number) => (
                <SourceRow key={s.name ?? s.source ?? i} source={s} />
              ))
            )}
          </div>
        </div>

        <Divider />

        {/* ── Secondary grid ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: '40px',
          alignItems: 'start',
        }}>
          {/* Left: AI recommendations */}
          <div>
            <SectionLabel>Intelligence IA — recommandations récentes</SectionLabel>
            {!canSeeRecs ? (
              <div style={{
                padding: '20px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--bg-subtle)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)',
                  marginBottom: '8px',
                }}>
                  ACCÈS RESTREINT
                </div>
                <div style={{ fontSize: '13px', color: 'var(--navy)', marginBottom: '12px' }}>
                  Les recommandations IA sont disponibles à partir du plan Investor.
                </div>
                <button
                  onClick={() => navigate('/app/pricing')}
                  className="btn btn-gold"
                  style={{ fontSize: '11px', padding: '8px 16px' }}
                >
                  Voir les plans →
                </button>
              </div>
            ) : recentRecs.length === 0 ? (
              <div style={{
                padding: '20px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)',
              }}>
                Aucune recommandation disponible.{' '}
                <button
                  onClick={() => navigate('/app/agent')}
                  style={{ color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                >
                  Démarrer une analyse →
                </button>
              </div>
            ) : (
              recentRecs.map((rec: any, i: number) => (
                <RecRow key={rec.id ?? i} rec={rec} />
              ))
            )}
            {canSeeRecs && (
              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={() => navigate('/app/agent')}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'var(--navy)', background: 'transparent',
                    border: '1px solid var(--border)',
                    padding: '7px 16px', borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  Ouvrir Intelligence →
                </button>
              </div>
            )}
          </div>

          {/* Right: quick links */}
          <div>
            <SectionLabel>Navigation rapide</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <QuickLink
                icon="🔨"
                label="Enchères"
                sub="Lots en vente aux enchères"
                to="/app/opportunities"
              />
              <QuickLink
                icon="🖼️"
                label="Marché primaire"
                sub="Galeries & plateformes"
                to="/app/primary"
              />
              <QuickLink
                icon="⭐"
                label="Convictions"
                sub="Sélection IA du jour"
                to="/app/convictions"
              />
              <QuickLink
                icon="👤"
                label="Artistes"
                sub="Profils & tendances"
                to="/app/artists"
              />
            </div>

            <div style={{ marginTop: '20px' }}>
              <SectionLabel>Marché</SectionLabel>
              <div style={{
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                background: 'var(--bg-subtle)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)',
                  marginBottom: '6px', letterSpacing: '0.08em',
                }}>
                  STATUT DU MARCHÉ
                </div>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                  {[
                    { label: 'Christie\'s', status: 'Actif' },
                    { label: 'Sotheby\'s', status: 'Actif' },
                    { label: 'Phillips', status: 'Actif' },
                    { label: 'Artcurial', status: 'Actif' },
                  ].map(({ label, status }) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '11px',
                    }}>
                      <span style={{ color: 'var(--text-2)' }}>{label}</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '10px',
                        color: 'var(--gold)', fontWeight: 600,
                      }}>
                        ● {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
