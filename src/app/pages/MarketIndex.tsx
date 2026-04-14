import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Logo } from '../components/Logo';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

interface Segment {
  segment: string;
  sentiment: string;
  avg_score: number;
  total_lots_30d: number;
  new_lots_7d: number;
  momentum_change: number;
}

interface MarketData {
  overall: string;
  overall_score: number;
  segments: Segment[];
  generated_at: string;
  next_update: string;
}

function sentimentColor(sentiment: string) {
  if (sentiment === 'BULLISH') return 'var(--electric)';
  if (sentiment === 'BEARISH') return '#DC2626';
  return 'var(--gold)';
}

function scoreColor(score: number) {
  if (score >= 70) return 'var(--electric)';
  if (score >= 50) return 'var(--gold)';
  return '#DC2626';
}

export default function MarketIndex() {
  const navigate = useNavigate();
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Nautilus Art Market Index — Weekly Art Investment Intelligence';
    fetch(`${BACKEND}/api/market/sentiment`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalLots = data?.segments?.reduce((a, s) => a + (s.total_lots_30d || 0), 0) || 0;
  const weekStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Nav */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <Logo variant="horizontal" color="dark" size={24} />
        </div>
        <button onClick={() => navigate('/app/signup')} className="btn-electric" style={{ fontSize: '11px', padding: '8px 20px', borderRadius: '6px' }}>
          Get access →
        </button>
      </div>

      {/* Hero */}
      <div style={{ background: 'var(--navy)', padding: '48px 0 40px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 40px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: '10px' }}>
            NAUTILUS · WEEKLY PUBLICATION
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', color: 'white', margin: '0 0 8px', fontWeight: 600 }}>
            Art Market Index
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Week of {weekStr}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 40px' }}>

        {/* Score + Segments */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', marginBottom: '32px' }}>

          {/* Overall index */}
          <div style={{ background: 'var(--navy)', borderRadius: '12px', padding: '32px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', marginBottom: '14px' }}>
              NAUTILUS INDEX
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '68px', fontWeight: 700, color: 'white', lineHeight: 1 }}>
              {loading ? '—' : data?.overall_score?.toFixed(0) ?? '—'}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>out of 100</div>
            <div style={{ marginTop: '16px', padding: '4px 16px', background: 'rgba(198,168,90,0.15)', border: '1px solid rgba(198,168,90,0.3)', borderRadius: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                {data?.overall ?? 'NEUTRAL'}
              </span>
            </div>
            {data?.generated_at && (
              <div style={{ marginTop: '14px', fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
                Updated {new Date(data.generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>

          {/* Segments */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px 28px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '20px' }}>
              Market by segment
            </div>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: '24px', borderRadius: '4px', marginBottom: '10px' }} />
              ))
            ) : (
              data?.segments?.map((seg) => (
                <div key={seg.segment} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', width: '150px', flexShrink: 0 }}>{seg.segment}</div>
                  <div style={{ flex: 1, height: '5px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px',
                      width: `${Math.min(seg.avg_score, 100)}%`,
                      background: sentimentColor(seg.sentiment),
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: scoreColor(seg.avg_score), fontWeight: 700, width: '36px', textAlign: 'right' }}>
                    {seg.avg_score.toFixed(0)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', width: '60px', textAlign: 'right' }}>
                    {seg.total_lots_30d.toLocaleString()} lots
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Signal summary */}
        {data && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px 28px', marginBottom: '32px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>
              This week's signals
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              {[
                { label: 'Lots tracked (30d)', value: totalLots.toLocaleString() },
                { label: 'New this week', value: data.segments.reduce((a, s) => a + (s.new_lots_7d || 0), 0).toLocaleString() },
                { label: 'Top segment', value: [...data.segments].sort((a, b) => b.avg_score - a.avg_score)[0]?.segment ?? '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>{value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ background: 'var(--navy)', borderRadius: '12px', padding: '48px 40px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'white', marginBottom: '12px', fontWeight: 600 }}>
            See the opportunities behind the index
          </div>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '28px', maxWidth: '420px', margin: '0 auto 28px', lineHeight: 1.7 }}>
            Nautilus scans {totalLots.toLocaleString() || 'thousands of'} lots across global auction houses and scores each one for investment potential.
          </p>
          <a
            href="/app/signup"
            style={{ display: 'inline-block', background: 'white', color: 'var(--navy)', padding: '14px 40px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', textDecoration: 'none', letterSpacing: '0.04em' }}
          >
            Access full intelligence →
          </a>
          <div style={{ marginTop: '14px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
            Free to start · No credit card required
          </div>
        </div>

      </div>
    </div>
  );
}
