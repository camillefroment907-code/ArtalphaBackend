import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function SignalFeed() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');
  const [urgentLots, setUrgentLots] = useState<any[]>([]);
  const [topLots, setTopLots] = useState<any[]>([]);
  const [sentiment, setSentiment] = useState<any>(null);
  const [marketStats, setMarketStats] = useState({ total: 0, exceptional: 0, avgScore: 0 });
  const [countdown, setCountdown] = useState<Record<string, string>>({});
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [portfolioReturn, setPortfolioReturn] = useState(0);
  const [lotCount, setLotCount] = useState<number>(0);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1);
      setLastRefresh(new Date());
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = getToken();
    const h: Record<string,string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Dashboard stats — total lots, avg score, deals today, real source count
    fetch(`${BACKEND}/api/lots/stats`, { headers: h })
      .then(r => r.json())
      .then((d: any) => {
        setLotCount(d.total_lots_tracked || 0);
        setMarketStats(prev => ({
          ...prev,
          exceptional: d.deals_detected_today ?? prev.exceptional,
          avgScore: d.avg_deal_score ? Math.round(d.avg_deal_score) : prev.avgScore,
        }));
      })
      .catch(() => {});

    // Lots closing today (within 24h) — "Ventes à ne pas manquer"
    fetch(`${BACKEND}/api/lots/closing-today?days=1&limit=5&min_score=55`, { headers: h })
      .then(r => r.json())
      .then(d => setUrgentLots(d.items || []))
      .catch(() => {});

    // Top deals coming up in next 30 days — "Top Ventes du Mois"
    fetch(`${BACKEND}/api/lots/closing-today?days=30&limit=8&min_score=65`, { headers: h })
      .then(r => r.json())
      .then(d => setTopLots(d.items || []))
      .catch(() => {});

    // Market sentiment
    fetch(`${BACKEND}/api/market/sentiment`, { headers: h })
      .then(r => r.json())
      .then(setSentiment)
      .catch(() => {});

    // Portfolio
    fetch(`${BACKEND}/api/portfolio/items`, { headers: h })
      .then(r => r.json())
      .then(d => {
        const items = d.items || d || [];
        const invested = items.reduce((s: number, i: any) => s + (i.purchase_price_eur || 0), 0);
        const value = items.reduce((s: number, i: any) => s + (i.estimated_current_value_eur || i.purchase_price_eur || 0), 0);
        setPortfolioValue(value);
        setPortfolioReturn(invested > 0 ? ((value - invested) / invested * 100) : 0);
      })
      .catch(() => {});

    // Watchlist count (auth required)
    if (token) {
      fetch(`${BACKEND}/api/portfolio/watchlist`, { headers: h })
        .then(r => r.ok ? r.json() : [])
        .then((d: any) => setWatchlistCount(Array.isArray(d) ? d.length : 0))
        .catch(() => {});
    }
  }, [refreshKey]);

  // Live countdown — updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const newC: Record<string, string> = {};
      [...urgentLots, ...topLots].forEach((lot: any) => {
        const closes = lot.auction_date;
        if (!closes) return;
        const diff = new Date(closes).getTime() - now.getTime();
        if (diff <= 0) { newC[lot.id] = 'CLOSED'; return; }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        newC[lot.id] = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
      });
      setCountdown(newC);
    }, 1000);
    return () => clearInterval(timer);
  }, [urgentLots, topLots]);

  const upside = (lot: any) => {
    if (lot.pct_below_low_estimate) return `+${lot.pct_below_low_estimate.toFixed(0)}%`;
    if (lot.estimate_low && lot.current_price && lot.current_price < lot.estimate_low)
      return `+${((lot.estimate_low - lot.current_price) / lot.current_price * 100).toFixed(0)}%`;
    return null;
  };

  return (
    <div style={{ height: 'calc(100vh - 57px)', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ═══ KPI BAR ═══ */}
      <div style={{ background: 'var(--navy)', height: '48px', display: 'flex', alignItems: 'stretch', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { label: 'CLÔTURE AUJOURD\'HUI', value: urgentLots.length > 0 ? `${urgentLots.length} LOTS` : '—', color: urgentLots.length > 0 ? '#EF4444' : 'rgba(255,255,255,0.3)', pulse: urgentLots.length > 0 },
          { label: 'EXCEPTIONNEL', value: `${marketStats.exceptional}`, color: '#C6A85A', pulse: false },
          { label: 'SCORE MOY.', value: `${marketStats.avgScore}/100`, color: 'white', pulse: false },
          { label: 'MARCHÉ', value: sentiment?.overall || 'NEUTRAL', color: sentiment?.overall === 'BULLISH' ? '#34D399' : 'rgba(255,255,255,0.6)', pulse: false },
          { label: 'MON PORTFOLIO', value: `€${portfolioValue.toLocaleString()}`, color: portfolioReturn >= 0 ? '#34D399' : '#EF4444', pulse: false },
        ].map(({ label, value, color, pulse }, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 24px', borderRight: i < 4 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
            {pulse && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />}
            <div>
              <div style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            </div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '24px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
            LIVE · {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="signal-feed-layout" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>

        {/* LEFT — Signal stream */}
        <div style={{ overflowY: 'auto', padding: '20px 24px' }}>

          {/* URGENT */}
          {urgentLots.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
                  VENTES À NE PAS MANQUER AUJOURD'HUI
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {urgentLots.map((lot: any) => (
                  <div key={lot.id}
                    style={{ background: 'white', border: '1px solid #FCA5A5', borderLeft: '3px solid #EF4444', borderRadius: '8px', padding: '14px 18px', display: 'flex', gap: '14px', alignItems: 'center', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                    onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'}
                  >
                    <div style={{ width: '64px', height: '64px', borderRadius: '6px', background: 'var(--bg-subtle)', flexShrink: 0, overflow: 'hidden' }}>
                      {lot.image_url && <img src={lot.image_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>
                        {lot.artist_name_raw || 'Unknown Artist'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                        {lot.title}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                          €{(lot.current_price || lot.estimate_low || 0).toLocaleString()}
                        </span>
                        {upside(lot) && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--electric)', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', padding: '2px 6px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                            {upside(lot)}
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '40px', height: '3px', background: 'var(--bg-subtle)', borderRadius: '1px' }}>
                            <div style={{ height: '100%', width: `${lot.deal_score || 0}%`, background: lot.deal_score >= 80 ? '#C6A85A' : 'var(--electric)', borderRadius: '1px' }} />
                          </div>
                          <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{lot.deal_score?.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                      <div style={{ padding: '6px 10px', background: '#FEF2F2', borderRadius: '6px', border: '1px solid #FCA5A5', textAlign: 'center' }}>
                        <div style={{ fontSize: '8px', color: '#EF4444', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' }}>CLOSES IN</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, color: '#EF4444' }}>{countdown[lot.id] || '—'}</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); navigate(`/app/opportunities/${lot.id}`); }}
                        style={{ padding: '6px 14px', background: 'var(--navy)', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: 'white', cursor: 'pointer' }}>
                        View →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TOP SIGNALS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
                  {isFr ? 'TOP VENTES DU MOIS' : 'TOP SALES THIS MONTH'}
                </span>
              </div>
              <button onClick={() => navigate('/app/explore?tab=best')}
                style={{ fontSize: '11px', color: 'var(--electric)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                Voir tout →
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {topLots.map((lot: any) => {
                const up = upside(lot);
                const scoreColor = lot.deal_score >= 80 ? '#C6A85A' : lot.deal_score >= 65 ? 'var(--electric)' : 'var(--text-3)';
                return (
                  <div key={lot.id}
                    onClick={() => navigate(`/app/opportunities/${lot.id}`)}
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                  >
                    <div style={{ height: '140px', background: 'var(--bg-subtle)', position: 'relative', overflow: 'hidden' }}>
                      {lot.image_url ? (
                        <img src={lot.image_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '28px', opacity: 0.1 }}>◎</span>
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(10,22,40,0.85)', backdropFilter: 'blur(4px)', padding: '3px 7px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: scoreColor }} />
                        {lot.deal_score?.toFixed(0)}/100
                      </div>
                      {lot.deal_score >= 80 && (
                        <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#C6A85A', padding: '2px 6px', borderRadius: '3px', fontSize: '8px', fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)' }}>
                          EXCEPTIONAL
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lot.artist_name_raw || 'Unknown Artist'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '13px', color: 'var(--text)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lot.title}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                          €{(lot.current_price || lot.estimate_low || 0).toLocaleString()}
                        </span>
                        {up && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--electric)', fontFamily: 'var(--font-mono)' }}>{up} ↑</span>}
                      </div>
                      <div style={{ height: '2px', background: 'var(--bg-subtle)', borderRadius: '1px' }}>
                        <div style={{ height: '100%', borderRadius: '1px', width: `${lot.deal_score || 0}%`, background: scoreColor, transition: 'width 0.6s ease' }} />
                      </div>
                      {countdown[lot.id] && countdown[lot.id] !== 'CLOSED' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>CLOSES IN</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{countdown[lot.id]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="signal-feed-sidebar" style={{ background: 'white', borderLeft: '1px solid var(--border)', overflowY: 'auto' }}>

          {/* Market stats */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '14px' }}>
              {isFr ? 'Activité du marché' : 'Market Activity'}
            </div>
            {[
              { label: 'Lots aux enchères', value: lotCount > 0 ? lotCount.toLocaleString() : '—', sub: 'Suivi en temps réel' },
              { label: 'Score moyen', value: `${marketStats.avgScore}/100`, sub: 'Sélection actuelle' },
              { label: 'Exceptionnels', value: `${marketStats.exceptional}`, sub: 'Score ≥ 80' },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{sub}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Sentiment */}
          {sentiment && (
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {isFr ? 'Sentiment marché' : 'Market Sentiment'}
                </div>
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '3px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                  {sentiment.overall}
                </span>
              </div>
              {sentiment.segments?.slice(0, 5).map((seg: any) => (
                <div key={seg.segment} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)', width: '110px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.segment}</div>
                  <div style={{ flex: 1, height: '3px', background: 'var(--bg-subtle)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', borderRadius: '2px', width: `${seg.avg_score}%`, background: seg.sentiment === 'BULLISH' ? 'var(--electric)' : seg.sentiment === 'BEARISH' ? '#EF4444' : 'var(--border)', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', width: '24px', textAlign: 'right' }}>{seg.avg_score}</div>
                </div>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>
              Actions rapides
            </div>
            {[
              { icon: '⚡', label: 'Lots exceptionnels', sub: 'Score 80+', action: () => navigate('/app/explore?tab=best'), color: '#C6A85A' },
              { icon: '⏱', label: 'Clôture dans 24h', sub: 'Agir maintenant', action: () => navigate('/app/explore?tab=live'), color: '#EF4444' },
              { icon: '◆', label: 'Générer un mémo IA', sub: 'N\'importe quel lot', action: () => navigate('/app/explore'), color: 'var(--electric)' },
              { icon: '★', label: 'Ma liste de suivi', sub: `${watchlistCount} lots`, action: () => navigate('/app/portfolio?tab=watchlist'), color: 'var(--navy)' },
            ].map(({ icon, label, sub, action, color }) => (
              <button key={label} onClick={action} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '6px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--navy)'; (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)'; }}
              >
                <span style={{ fontSize: '14px', color, width: '20px', textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{sub}</div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-3)', flexShrink: 0 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
