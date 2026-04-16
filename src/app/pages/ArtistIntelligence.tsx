import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function ArtistIntelligence() {
  const navigate = useNavigate();
  const { artistName } = useParams<{ artistName: string }>();
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!artistName) { setLoading(false); return; }
    setLoading(true);
    const token = getToken();
    fetch(`${BACKEND}/api/artist-profiles/${encodeURIComponent(decodeURIComponent(artistName))}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => { setArtist(data); setLoading(false); })
      .catch(() => setLoading(false));
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
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {artist.movement || 'Artist'}
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '42px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.1 }}>
              {artist.artist_name || artist.name}
            </h1>
            {artist.nationality && (
              <div style={{ fontSize: '14px', color: 'var(--text-3)', marginBottom: '16px' }}>
                {artist.nationality}
              </div>
            )}

            {artist.ai_brief && (
              <div style={{ background: 'var(--navy)', borderRadius: '10px', padding: '18px 22px', marginBottom: '20px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em', marginBottom: '8px' }}>
                  ◆ NAUTILUS ANALYST BRIEF
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, margin: 0 }}>
                  {artist.ai_brief}
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
