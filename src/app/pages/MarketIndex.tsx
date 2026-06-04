import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';
import { useSEO } from '../../lib/useSEO';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

export default function MarketIndex() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [beta, setBeta] = useState<any>(null);
  const [lotsAnalyzed, setLotsAnalyzed] = useState<number | null>(null);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [exceptionalCount, setExceptionalCount] = useState<number | null>(null);

  useSEO({
    title: 'Art Market Index · Nautilus',
    description: 'Live art market signals, price trends, and auction intelligence. Updated in real time.',
  });

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, []);

  useEffect(() => {
    const token = getToken();
    const h = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${BACKEND}/api/market/index`, { headers: h })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    // Real lot counts from sentiment endpoint
    fetch(`${BACKEND}/api/market/sentiment`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.segments?.length) return;
        const total = d.segments.reduce((sum: number, s: any) => sum + (s.total_lots_30d || 0), 0);
        const weightedScore = d.segments.reduce((sum: number, s: any) => sum + (s.avg_score || 0) * (s.total_lots_30d || 0), 0);
        setLotsAnalyzed(total);
        setAvgScore(total > 0 ? Math.round(weightedScore / total * 10) / 10 : d.overall_score);
      })
      .catch(() => {});

    // Exceptional count: lots with deal_score >= 83
    fetch(`${BACKEND}/api/lots?sort_by=deal_score&sort_dir=desc&min_score=83&page_size=1`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.total != null) setExceptionalCount(d.total); })
      .catch(() => {});

    fetch(`${BACKEND}/api/market/beta`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.segments?.length > 0) setBeta(d); })
      .catch(() => {});
  }, []);

  const index = data?.index;
  const week = data?.week;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Public header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '14px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
            <path d="M 20 4 A 16 16 0 0 1 36 20" stroke="#0A1628" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M 36 20 A 16 16 0 0 1 20 36" stroke="#0A1628" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
            <path d="M 20 36 A 8 8 0 0 1 12 28" stroke="#C6A85A" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="20" cy="20" r="2" fill="#C6A85A"/>
          </svg>
          <span style={{ fontFamily: "-apple-system, 'Inter', 'Helvetica Neue', Arial, sans-serif", fontSize: '16px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '-0.02em' }}>Nautilus</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a href="/app/signup" style={{ background: 'var(--electric)', color: 'white', padding: '8px 20px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em' }}>
            GET ACCESS
          </a>
        </div>
      </div>

      {/* Hero — Index score */}
      <div style={{ background: 'var(--navy)', padding: '64px 40px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(198,168,90,0.8)', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
            NAUTILUS ART MARKET INDEX · {week?.week_of?.toUpperCase() || 'WEEKLY PUBLICATION'}
          </div>

          {loading ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '80px', fontWeight: 700, color: 'rgba(255,255,255,0.1)' }}>—</div>
          ) : (
            <>
              {/* Big index number */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '12px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '96px', fontWeight: 700, color: index?.color || 'white', lineHeight: 1, letterSpacing: '-2px' }}>
                  {index?.score}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'rgba(255,255,255,0.4)' }}>/100</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <span style={{ fontSize: '14px', color: index?.trend_direction === 'up' ? '#34D399' : index?.trend_direction === 'down' ? '#EF4444' : 'rgba(255,255,255,0.4)' }}>
                      {index?.trend_direction === 'up' ? '↑' : index?.trend_direction === 'down' ? '↓' : '→'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                      {index?.trend > 0 ? '+' : ''}{index?.trend}% vs last month
                    </span>
                  </div>
                </div>
              </div>

              {/* Sentiment label */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 20px', borderRadius: '24px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: index?.color || 'white' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: index?.color || 'white', letterSpacing: '0.1em' }}>
                    {index?.sentiment}
                  </span>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>—</span>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{index?.sentiment_label}</span>
                </div>
              </div>

              {/* AI Commentary */}
              {data?.commentary && (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #C6A85A', borderRadius: '0 8px 8px 0', padding: '16px 24px', maxWidth: '640px', margin: '0 auto 32px', textAlign: 'left' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#C6A85A', fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', marginBottom: '8px' }}>
                    ◆ ANALYST COMMENTARY
                  </div>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, margin: 0, fontStyle: 'italic' }}>
                    {data.commentary}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Weekly stats row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0' }}>
            {[
              { label: 'LOTS ANALYZED', value: lotsAnalyzed != null ? lotsAnalyzed.toLocaleString() : (week?.lots_analyzed?.toLocaleString() || '—') },
              { label: 'AVG SCORE', value: avgScore != null ? `${avgScore}/100` : (week?.avg_score ? `${week.avg_score}/100` : '—') },
              { label: 'EXCEPTIONAL', value: exceptionalCount != null ? exceptionalCount.toLocaleString() : (week?.exceptional_count?.toString() || '—') },
            ].map(({ label, value }, i) => (
              <div key={label} style={{ padding: '14px 32px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{value}</div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.16em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top lots of the week */}
      {data?.top_lots?.length > 0 && (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '56px 40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
              THIS WEEK'S TOP SIGNALS
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text)', margin: 0 }}>
              Highest conviction opportunities
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '36px' }}>
            {data.top_lots.map((lot: any, i: number) => (
              <div key={lot.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px 20px', display: 'flex', gap: '16px', alignItems: 'center', filter: i >= 2 ? 'blur(4px)' : 'none', userSelect: i >= 2 ? 'none' : 'auto', position: 'relative' }}>
                {/* Rank */}
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: i === 0 ? '#C6A85A' : 'var(--bg-subtle)', border: `1px solid ${i === 0 ? '#C6A85A' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: i === 0 ? 'white' : 'var(--text-3)' }}>#{i + 1}</span>
                </div>

                {/* Image */}
                <div style={{ width: '56px', height: '56px', borderRadius: '6px', background: 'var(--bg-subtle)', flexShrink: 0, overflow: 'hidden' }}>
                  {lot.image_url && <img src={lot.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>
                    {lot.artist_name_raw || 'Unknown'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lot.title}
                  </div>
                </div>

                {/* Price + score */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                      €{(lot.current_price || lot.estimate_low || 0).toLocaleString()}
                    </div>
                    {lot.pct_below_low_estimate > 0 && (
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--electric)', fontFamily: 'var(--font-mono)' }}>
                        +{lot.pct_below_low_estimate.toFixed(0)}% upside
                      </div>
                    )}
                  </div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: lot.deal_score >= 83 ? 'rgba(198,168,90,0.1)' : 'var(--electric-subtle)', border: `1px solid ${lot.deal_score >= 83 ? 'rgba(198,168,90,0.4)' : 'var(--electric-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: lot.deal_score >= 83 ? '#C6A85A' : 'var(--electric)', lineHeight: 1 }}>
                      {lot.deal_score?.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Unlock CTA */}
          <div style={{ textAlign: 'center', padding: '32px 40px', background: 'var(--navy)', borderRadius: '12px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'white', marginBottom: '8px' }}>
              See all {(lotsAnalyzed ?? week?.lots_analyzed)?.toLocaleString() || 'live'} opportunities
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px', lineHeight: 1.7 }}>
              The Nautilus Index is free. Full market intelligence — Founding price — €10/mo.
            </p>
            <a href="/app/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'white', color: 'var(--navy)', padding: '13px 32px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>
              Access full intelligence →
            </a>
          </div>
        </div>
      )}

      {/* Macro Art Market Beta */}
      {beta?.segments?.length > 0 && (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 40px 56px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
              MACRO ART MARKET BETA
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--text)', margin: '0 0 8px' }}>
              Segment Beta vs Nautilus Index
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
              Beta {'>'} 1 = amplifies market moves · Beta {'<'} 1 = defensive · Based on {beta.market_months} months
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {beta.segments.map((seg: any) => {
              const b = seg.beta ?? 0;
              const interp = seg.interpretation;
              const col = interp === 'Aggressive' ? '#EF4444' : interp === 'Defensive' ? '#10B981' : '#3B82F6';
              const barPct = Math.min(100, Math.max(0, (b / 2) * 100));
              return (
                <div key={seg.segment} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{seg.segment}</div>
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: col, fontWeight: 700, letterSpacing: '0.06em' }}>{interp}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: col }}>
                      β {b.toFixed(2)}
                    </div>
                  </div>
                  {/* Beta bar: midpoint = β1.0 */}
                  <div style={{ height: '4px', background: 'var(--bg-subtle)', borderRadius: '2px', position: 'relative', marginBottom: '8px' }}>
                    <div style={{ position: 'absolute', left: '50%', top: '-2px', width: '1px', height: '8px', background: 'var(--border)' }} />
                    <div style={{ position: 'absolute', left: `${Math.min(barPct, 100)}%`, top: 0, width: '8px', height: '4px', borderRadius: '2px', background: col, transform: 'translateX(-50%)' }} />
                    <div style={{ height: '4px', width: `${barPct}%`, background: col, opacity: 0.2, borderRadius: '2px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    <span>β 0</span>
                    <span>~{seg.avg_lots_per_month} lots/mo</span>
                    <span>β 2</span>
                  </div>
                  {seg.correlation != null && (
                    <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      r = {seg.correlation.toFixed(2)} correlation
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '24px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', margin: 0 }}>
          Nautilus Art Market Index · Published weekly · NOT FINANCIAL ADVICE · Data from 10+ global auction houses
        </p>
      </div>
    </div>
  );
}
