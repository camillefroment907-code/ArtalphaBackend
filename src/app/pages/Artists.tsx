import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getToken, getPlanLimits } from '../../lib/auth';
import { useSEO } from '../../lib/useSEO';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function Artists() {
  useSEO({ title: "Artistes — Nautilus", description: "Cotes et signaux institutionnels pour les artistes suivis." });
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');
  const limits = getPlanLimits();
  const [topArtists, setTopArtists] = useState<any[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  useEffect(() => {
    const token = getToken();
    fetch(`${BACKEND}/api/artist-profiles/search`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => { setTopArtists(d.artists || []); setLoadingArtists(false); })
      .catch(() => setLoadingArtists(false));
  }, []);

  const scoreColor = (score: number) =>
    score >= 83 ? '#C6A85A' : score >= 70 ? 'var(--electric)' : 'var(--text-3)';

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const token = getToken();
      const res = await fetch(`${BACKEND}/api/artist-profiles/search/${encodeURIComponent(q)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setSearchResults(data.artists || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  // ── LOCKED STATE ─────────────────────────────────────────────
  if (!limits.hasFullAnalysis) {
    return (
      <div className="page" style={{
        background: 'var(--bg)', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
      }}>
        <div style={{
          maxWidth: '720px', width: '100%',
        }}>
          {/* Badge */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--gold-dim)', marginBottom: '16px',
          }}>
            INVESTOR+
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: '48px', fontWeight: 600,
            color: 'var(--navy)', margin: '0 0 0',
          }}>
            Artist Intelligence
          </h1>

          {/* Gold rule */}
          <div style={{
            width: '60px', height: '2px', background: 'var(--gold)',
            margin: '24px auto',
          }} />

          {/* Feature teasers */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '40px' }}>
            {[
              {
                icon: '◎',
                title: 'Artist Cotation',
                desc: 'Price history and auction results for 50,000+ artists across all major houses',
              },
              {
                icon: '↗',
                title: 'Market Momentum',
                desc: 'Identify artists with rising institutional demand before prices correct upward',
              },
              {
                icon: '≋',
                title: 'Comparable Sales',
                desc: 'Exact comparable lots adjusted for size, period, and condition',
              },
            ].map(f => (
              <div key={f.icon} style={{
                flex: 1, background: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: '2px',
                padding: '28px', textAlign: 'left',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '24px',
                  color: 'var(--navy)', marginBottom: '12px',
                }}>
                  {f.icon}
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: '18px',
                  color: 'var(--text)', marginBottom: '8px',
                }}>
                  {f.title}
                </div>
                <div style={{
                  fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7,
                }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Blurred fake grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
            marginBottom: '40px', pointerEvents: 'none', userSelect: 'none',
          }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{
                height: '280px', background: 'var(--bg-subtle)',
                borderRadius: '2px', filter: 'blur(6px)', opacity: 0.4,
              }} />
            ))}
          </div>

          {/* CTA block */}
          <div style={{
            background: 'var(--navy)', borderRadius: '2px',
            padding: '48px 40px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600,
              color: 'white', marginBottom: '8px',
            }}>
              Access Artist Intelligence
            </div>
            <div style={{
              fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px',
            }}>
              Available from Investor plan · €19/month
            </div>
            <button
              className="btn btn-gold"
              style={{ fontSize: '13px', padding: '14px 28px' }}
              onClick={() => navigate('/app/pricing')}
            >
              Upgrade to Investor →
            </button>
            <div style={{
              marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.35)',
            }}>
              7-day free trial · cancel anytime
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── UNLOCKED STATE ───────────────────────────────────────────
  return (
    <div className="page" style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ padding: '40px 0 28px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
            Artists
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
            Track rising artists and market momentum
          </p>
        </div>

        {/* Search */}
        <div style={{ marginTop: '28px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
              placeholder="Rechercher un artiste…"
              style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text)', background: 'white', outline: 'none' }}
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              style={{ padding: '10px 18px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: (searching || !searchQuery.trim()) ? 'not-allowed' : 'pointer', opacity: (searching || !searchQuery.trim()) ? 0.6 : 1, transition: 'opacity 0.15s' }}
            >
              {searching ? '…' : 'Rechercher'}
            </button>
          </form>

          {searchResults !== null && (
            <div style={{ marginTop: '16px' }}>
              {searchResults.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-3)', padding: '12px 0', margin: 0 }}>
                  Aucun artiste trouvé pour « {searchQuery} »
                </p>
              ) : (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                  {searchResults.map((a: any, i: number) => (
                    <button key={a.name}
                      onClick={() => navigate(`/app/artists/${encodeURIComponent(a.name)}`)}
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'transparent', border: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid var(--border-light)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                    >
                      <div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{a.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                          {a.lot_count} lots · Avg €{(a.avg_price || 0).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ padding: '3px 10px', borderRadius: '4px', background: a.avg_score >= 83 ? 'rgba(198,168,90,0.1)' : 'var(--electric-subtle)', border: `1px solid ${a.avg_score >= 83 ? 'rgba(198,168,90,0.3)' : 'var(--electric-border)'}` }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: scoreColor(a.avg_score) }}>{a.avg_score}/100</span>
                        </div>
                        <span style={{ color: 'var(--text-3)', fontSize: '14px' }}>→</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recently tracked artists */}
        <div style={{ marginTop: '32px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '16px' }}>
            {isFr ? 'ARTISTES RÉCEMMENT SUIVIS' : 'RECENTLY TRACKED ARTISTS'}
          </div>

          {loadingArtists ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: '13px', color: 'var(--text-3)' }}>Loading…</div>
          ) : topArtists.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: '13px', color: 'var(--text-3)' }}>No artists found.</div>
          ) : (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              {topArtists.map((a: any, i: number) => (
                <button key={a.name}
                  onClick={() => navigate(`/app/artists/${encodeURIComponent(a.name)}`)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'transparent', border: 'none', borderBottom: i < topArtists.length - 1 ? '1px solid var(--border-light)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{a.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {a.lot_count} lots · Avg €{(a.avg_price || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ padding: '3px 10px', borderRadius: '4px', background: a.avg_score >= 83 ? 'rgba(198,168,90,0.1)' : 'var(--electric-subtle)', border: `1px solid ${a.avg_score >= 83 ? 'rgba(198,168,90,0.3)' : 'var(--electric-border)'}` }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: scoreColor(a.avg_score) }}>{a.avg_score}/100</span>
                    </div>
                    <span style={{ color: 'var(--text-3)', fontSize: '14px' }}>→</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
