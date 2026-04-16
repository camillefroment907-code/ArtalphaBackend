import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { analyzeArtwork, VERDICT_CONFIG, type AnalysisResult, type VerdictType } from '../../lib/analyst';
import { getPlanLimits, isAuthenticated, getUser } from '../../lib/auth';
import { getUsageStatus, incrementUsage } from '../../lib/analysisUsage';

// ── Usage Counter ─────────────────────────────────────────────────────────────

function UsageCounter({ remaining, limit }: { remaining: number; limit: number }) {
  const used   = limit - remaining;
  const pct    = limit > 0 ? (used / limit) * 100 : 100;
  const isLow  = remaining <= 3 && remaining > 0;
  const isEmpty = remaining === 0;
  const resetDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div style={{
      padding: '10px 16px',
      background: isEmpty ? 'rgba(192,57,43,0.06)' : isLow ? 'rgba(198,168,90,0.08)' : 'var(--bg-subtle)',
      border: `1px solid ${isEmpty ? 'rgba(192,57,43,0.2)' : isLow ? 'rgba(198,168,90,0.25)' : 'var(--border)'}`,
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: isEmpty ? '#C0392B' : isLow ? '#8B6914' : 'var(--text-2)' }}>
            {isEmpty
              ? 'No analyses remaining this month'
              : `${remaining} analys${remaining === 1 ? 'is' : 'es'} left this month`}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {used}/{limit}
          </span>
        </div>
        <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: isEmpty ? '#C0392B' : isLow ? 'var(--gold)' : 'var(--navy)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
        </div>
      </div>
      <span style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
        Resets {resetDate}
      </span>
    </div>
  );
}

interface Props {
  rawLot: any; // Raw API lot object
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VerdictBadge({ verdict, size = 'md' }: { verdict: VerdictType; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = VERDICT_CONFIG[verdict];
  const fontSize = size === 'lg' ? '18px' : size === 'sm' ? '11px' : '14px';
  const padding  = size === 'lg' ? '10px 22px' : size === 'sm' ? '4px 10px' : '8px 16px';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <span style={{ color: cfg.color, fontSize, lineHeight: 1 }}>{cfg.icon}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize, fontWeight: 800, color: cfg.color, letterSpacing: '0.1em' }}>{verdict}</span>
    </span>
  );
}

function CotationMeter({ score }: { score: number }) {
  const label = score >= 9 ? 'Blue Chip' : score >= 7 ? 'Established' : score >= 5 ? 'Mid-Career' : score >= 3 ? 'Emerging' : 'Decorative';
  const color = score >= 9 ? '#0a5c2e' : score >= 7 ? '#1A2A44' : score >= 5 ? '#8B6914' : '#888888';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span className="label-caps">Artist Cotation</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color }}>{score}/10 · {label}</span>
      </div>
      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score * 10}%`, background: `linear-gradient(to right, ${color}88, ${color})`, borderRadius: '3px' }} />
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const cfg: Record<string, { color: string; bg: string }> = {
    LOW:       { color: '#0a5c2e', bg: 'rgba(10,92,46,0.08)' },
    MODERATE:  { color: '#8B6914', bg: 'rgba(198,168,90,0.1)' },
    MEDIUM:    { color: '#8B6914', bg: 'rgba(198,168,90,0.1)' },
    STRONG:    { color: '#1A2A44', bg: 'rgba(26,42,68,0.08)' },
    UNKNOWN:   { color: '#888888', bg: 'rgba(0,0,0,0.04)' },
    HIGH:      { color: '#C0392B', bg: 'rgba(192,57,43,0.08)' },
    VERY_HIGH: { color: '#8B0000', bg: 'rgba(139,0,0,0.08)' },
  };
  const c = cfg[level?.toUpperCase()] ?? cfg.MEDIUM;
  return (
    <span style={{ padding: '2px 8px', background: c.bg, color: c.color, fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
      {level}
    </span>
  );
}

function PricingBadge({ pricing }: { pricing: string }) {
  const cfg: Record<string, { color: string; bg: string; label: string }> = {
    SIGNIFICANTLY_UNDERVALUED: { color: '#0a5c2e', bg: 'rgba(10,92,46,0.08)', label: 'Significantly Undervalued' },
    UNDERVALUED:               { color: '#1A2A44', bg: 'rgba(26,42,68,0.08)', label: 'Undervalued' },
    FAIR_VALUE:                { color: '#8B6914', bg: 'rgba(198,168,90,0.1)', label: 'Fair Value' },
    OVERVALUED:                { color: '#C0392B', bg: 'rgba(192,57,43,0.08)', label: 'Overvalued' },
  };
  const c = cfg[pricing] ?? cfg.FAIR_VALUE;
  return (
    <span style={{ padding: '3px 10px', background: c.bg, color: c.color, fontSize: '12px', fontWeight: 600 }}>
      {c.label}
    </span>
  );
}

function ProjectionChart({ projections, visibleYears, basePrice }: {
  projections: AnalysisResult['projections'];
  visibleYears: number[];
  basePrice: number;
}) {
  const fmt = (v: number) =>
    v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `€${(v / 1_000).toFixed(0)}K`
    : `€${v}`;

  const scenarios = [
    { key: 'conservative', label: 'Conservative', color: '#9A9A9A', data: projections.conservative },
    { key: 'base',         label: 'Base case',    color: 'var(--navy)', data: projections.base },
    { key: 'optimistic',   label: 'Optimistic',   color: '#0a5c2e', data: projections.optimistic },
  ];

  const allYears = [0, 5, 10, 20, 50].filter(y => y === 0 || visibleYears.includes(y));
  const getValue = (d: any, y: number) => y === 0 ? basePrice : (d[`${y}yr`] || 0);
  const maxVal = Math.max(...scenarios.flatMap(s => allYears.map(y => getValue(s.data, y))), 1);

  return (
    <div>
      <div className="label-caps" style={{ marginBottom: '14px' }}>Price Projection (EUR)</div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {scenarios.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '18px', height: '3px', background: s.color, borderRadius: '2px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{s.label} (+{(s.data.cagr * 100).toFixed(0)}%/yr)</span>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '140px', marginBottom: '6px' }}>
        {allYears.map(year => (
          <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', height: '120px' }}>
              {scenarios.map(s => {
                const val = getValue(s.data, year);
                const pct = (val / maxVal) * 100;
                return (
                  <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div
                      title={fmt(val)}
                      style={{ height: `${pct}%`, minHeight: '3px', background: s.color, borderRadius: '2px 2px 0 0', opacity: year === 0 ? 0.4 : 0.85 }}
                    />
                  </div>
                );
              })}
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {year === 0 ? 'Now' : `${year}yr`}
            </span>
          </div>
        ))}
      </div>

      {/* Values table */}
      <div style={{ border: '1px solid var(--border)', overflow: 'hidden', marginTop: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `110px ${allYears.map(() => '1fr').join(' ')}`, borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ padding: '7px 10px', fontSize: '10px', color: 'var(--text-3)' }}>Scenario</div>
          {allYears.map(y => (
            <div key={y} style={{ padding: '7px 4px', fontSize: '10px', color: 'var(--text-3)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
              {y === 0 ? 'Now' : `${y}yr`}
            </div>
          ))}
        </div>
        {scenarios.map((s, si) => (
          <div key={s.key} style={{ display: 'grid', gridTemplateColumns: `110px ${allYears.map(() => '1fr').join(' ')}`, borderBottom: si < 2 ? '1px solid var(--border)' : 'none', background: si === 1 ? 'white' : 'transparent' }}>
            <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{s.label}</span>
            </div>
            {allYears.map(y => {
              const val = getValue(s.data, y);
              const mult = basePrice > 0 ? val / basePrice : 1;
              return (
                <div key={y} style={{ padding: '8px 4px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: y === 0 ? 'var(--text-3)' : si === 0 ? '#777' : si === 2 ? '#0a5c2e' : 'var(--navy)' }}>
                    {fmt(val)}
                  </div>
                  {y > 0 && (
                    <div style={{ fontSize: '9px', color: 'var(--text-3)' }}>×{mult.toFixed(1)}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '8px', fontStyle: 'italic', lineHeight: 1.5 }}>
        ⚠ Projections are estimates. Art investment carries significant risk. Past performance does not guarantee future results. For informational purposes only.
      </p>
    </div>
  );
}

function LockedSection({ title, planRequired }: { title: string; planRequired: string }) {
  const navigate = useNavigate();
  return (
    <div style={{ position: 'relative', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ filter: 'blur(3px)', pointerEvents: 'none', padding: '16px', opacity: 0.35 }}>
        <div className="label-caps" style={{ marginBottom: '8px' }}>{title}</div>
        <div style={{ height: '52px', background: 'var(--bg-subtle)' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(250,250,248,0.88)', backdropFilter: 'blur(2px)' }}>
        <div style={{ fontSize: '13px', marginBottom: '3px' }}>🔒</div>
        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '8px' }}>{planRequired} plan required</div>
        <button
          onClick={() => navigate('/app/pricing')}
          style={{ padding: '5px 12px', background: 'var(--navy)', color: 'white', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
        >
          Upgrade →
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AIAnalyst({ rawLot }: Props) {
  const [status, setStatus]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  const limits  = getPlanLimits();
  const authed  = isAuthenticated();
  const user    = getUser();
  const planId  = user?.plan || 'free';
  const isAdmin = user?.email === 'camillefroment907@gmail.com';
  const usage   = getUsageStatus(planId);
  const hasAnalysisAccess = isAdmin || usage.limit > 0;
  const canAnalyze = isAdmin || usage.canAnalyze;

  console.log('[AIAnalyst] plan:', planId, 'canAnalyze:', canAnalyze, 'remaining:', isAdmin ? '∞' : usage.remaining);

  const runAnalysis = useCallback(async () => {
    if (!canAnalyze) { navigate('/app/pricing'); return; }
    setStatus('loading');
    setError('');
    try {
      const lotData = {
        artist:       rawLot.artist_name_raw || rawLot.artist_name || '',
        title:        rawLot.title || 'Untitled',
        price:        Number(rawLot.current_price || rawLot.estimate_low || 0),
        estimate:     Number(rawLot.estimate_high || rawLot.estimate_low || 0),
        medium:       rawLot.medium || rawLot.category || '',
        technique:    rawLot.technique || '',
        auction_house: rawLot.auction_house_name || rawLot.source || '',
        country:      rawLot.country || '',
        price_per_cm2:  rawLot.price_per_cm2 ? Number(rawLot.price_per_cm2) : undefined,
        artist_avg_price: rawLot.artist_avg_price ? Number(rawLot.artist_avg_price) : undefined,
        deal_score:   rawLot.deal_score ? Number(rawLot.deal_score) : undefined,
        pct_below:    rawLot.pct_below_low_estimate ? Number(rawLot.pct_below_low_estimate) : undefined,
      };
      const result = await analyzeArtwork(lotData);
      if (!isAdmin) incrementUsage(planId);
      setAnalysis(result);
      setStatus('done');
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
      setStatus('error');
    }
  }, [rawLot, canAnalyze, planId, isAdmin, navigate]);

  // Not logged in, or plan has no AI analysis access (free / starter)
  if (!authed || !hasAnalysisAccess) {
    return (
      <div style={{ padding: '32px 24px', background: 'white', border: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--navy)', marginBottom: '10px' }}>◆ Investment Intelligence</div>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', maxWidth: '440px', margin: '0 auto 20px', lineHeight: 1.7 }}>
          Unlock artist cotation, price projections, provenance analysis, comparable sales, and AI investment verdicts.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
          {['Artist cotation', '5–50yr projections', 'AI verdict', 'Risk assessment', 'Comparables'].map(f => (
            <span key={f} style={{ padding: '3px 10px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-2)' }}>{f}</span>
          ))}
        </div>
        <button
          onClick={() => navigate('/app/pricing')}
          style={{ padding: '11px 26px', background: 'var(--navy)', color: 'white', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Unlock from €29/month →
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px' }}>◎</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Investment Dossier</div>
              <span style={{ padding: '2px 6px', background: 'rgba(198,168,90,0.1)', border: '1px solid rgba(198,168,90,0.3)', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.1em' }}>FAMILY OFFICE+</span>
            </div>
          </div>
        </div>

        {status === 'idle' && (
          <button
            onClick={runAnalysis}
            title={!canAnalyze ? 'No analyses remaining this month' : ''}
            style={{
              padding: '8px 18px',
              background: canAnalyze ? 'var(--navy)' : 'var(--border)',
              color: canAnalyze ? 'white' : 'var(--text-3)',
              border: 'none', fontSize: '12px', fontWeight: 700,
              letterSpacing: '0.06em', cursor: 'pointer',
            }}
            onMouseEnter={e => { if (canAnalyze) e.currentTarget.style.background = 'var(--navy-bright)'; }}
            onMouseLeave={e => { if (canAnalyze) e.currentTarget.style.background = 'var(--navy)'; }}
          >
            {canAnalyze ? '✦ ANALYZE' : '↑ Upgrade'}
          </button>
        )}
        {status === 'done' && (
          <button
            onClick={() => { setStatus('idle'); setAnalysis(null); }}
            style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border)', fontSize: '11px', cursor: 'pointer' }}
          >
            ↺ Re-analyze
          </button>
        )}
      </div>

      {/* Usage counter (below header, above body) */}
      {!isAdmin && usage.limit > 0 && status !== 'done' && (
        <div style={{ padding: '0 20px 12px' }}>
          <UsageCounter remaining={usage.remaining} limit={usage.limit} />
        </div>
      )}

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Idle — no credits */}
        {status === 'idle' && !canAnalyze && usage.limit > 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>📊</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text)', marginBottom: '8px' }}>
              Monthly limit reached
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', maxWidth: '360px', margin: '0 auto 20px', lineHeight: 1.7 }}>
              You've used all {usage.limit} analyses this month. Upgrade for more — or wait until{' '}
              {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.
            </p>
            <button
              onClick={() => navigate('/app/pricing')}
              style={{ padding: '12px 24px', background: 'var(--navy)', color: 'white', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Upgrade for more analyses →
            </button>
          </div>
        )}

        {/* Idle — has credits */}
        {status === 'idle' && canAnalyze && (
          <p style={{ padding: '0', fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.6, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Full analysis — 5/10/20yr projections · artist valuation · AI verdict
          </p>
        )}

        {/* Loading */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '14px' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{ width: '6px', height: '6px', background: 'var(--navy)', borderRadius: '50%', animation: `aaPulse 1.4s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
            </div>
            <style>{`@keyframes aaPulse { 0%,100%{opacity:0.2;transform:scale(0.7)} 50%{opacity:1;transform:scale(1.3)} }`}</style>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', color: 'var(--text)', marginBottom: '4px' }}>
              Researching {rawLot.artist_name_raw || rawLot.artist_name || 'artist'}…
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Analyzing market data, comparable sales, and building projections</div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{ padding: '14px 18px', background: 'rgba(192,57,43,0.05)', border: '1px solid rgba(192,57,43,0.2)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#C0392B', marginBottom: '5px' }}>Analysis failed</div>
            <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '12px' }}>{error}</div>
            <button onClick={runAnalysis} style={{ padding: '7px 14px', background: 'var(--navy)', color: 'white', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
          </div>
        )}

        {/* Results */}
        {status === 'done' && analysis && (
          <>
            {/* 1. Verdict */}
            {limits.hasAIVerdict ? (
              <div style={{ padding: '18px 20px', background: VERDICT_CONFIG[analysis.verdict].bg, border: `1px solid ${VERDICT_CONFIG[analysis.verdict].border}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <div>
                    <div className="label-caps" style={{ marginBottom: '8px' }}>Investment Verdict</div>
                    <VerdictBadge verdict={analysis.verdict} size="lg" />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <RiskBadge level={analysis.overallRisk} />
                    <span style={{ padding: '2px 8px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
                      {analysis.confidence} CONFIDENCE
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.65, marginBottom: '14px' }}>{analysis.verdictReason}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ padding: '10px 14px', background: 'rgba(10,92,46,0.06)', border: '1px solid rgba(10,92,46,0.12)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#0a5c2e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '5px' }}>Bull Case</div>
                    <p style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.55 }}>{analysis.bullCase}</p>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.04)', border: '1px solid rgba(192,57,43,0.1)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#C0392B', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '5px' }}>Bear Case</div>
                    <p style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.55 }}>{analysis.bearCase}</p>
                  </div>
                </div>
                {(analysis.holdPeriod || analysis.idealBuyerProfile) && (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {analysis.holdPeriod && (
                      <div><span className="label-caps">Hold · </span><span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{analysis.holdPeriod}</span></div>
                    )}
                    {analysis.idealBuyerProfile && (
                      <div><span className="label-caps">Ideal buyer · </span><span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{analysis.idealBuyerProfile}</span></div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <LockedSection title="Investment Verdict" planRequired="Investor" />
            )}

            {/* 2. Artist cotation */}
            {limits.hasArtistCotation ? (
              <div style={{ padding: '18px 20px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <div className="label-caps" style={{ marginBottom: '14px' }}>Artist Profile & Cotation</div>
                {analysis.cotationScore > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <CotationMeter score={analysis.cotationScore} />
                    {analysis.cotationLabel && <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '5px' }}>{analysis.cotationLabel}</p>}
                  </div>
                )}
                {analysis.artistBiography && (
                  <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, marginBottom: '12px' }}>{analysis.artistBiography}</p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  {[
                    { label: 'Market Tier', value: analysis.marketTier?.replace('_', ' ') },
                    { label: 'Liquidity',   value: analysis.liquidity },
                    { label: 'Price Trend', value: analysis.priceTrend },
                  ].filter(i => i.value).map(({ label, value }) => (
                    <div key={label} style={{ padding: '8px 10px', background: 'white', border: '1px solid var(--border)' }}>
                      <div className="label-caps" style={{ marginBottom: '3px' }}>{label}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)' }}>{value}</div>
                    </div>
                  ))}
                </div>
                {limits.hasFullArtistProfile && analysis.notableSales && (
                  <div style={{ padding: '8px 12px', background: 'rgba(198,168,90,0.06)', border: '1px solid rgba(198,168,90,0.15)', marginBottom: '8px' }}>
                    <span className="label-gold" style={{ marginRight: '6px', fontSize: '10px' }}>Notable Sales</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{analysis.notableSales}</span>
                  </div>
                )}
                {analysis.similarArtists.length > 0 && (
                  <div>
                    <span className="label-caps" style={{ display: 'block', marginBottom: '5px' }}>Comparable Artists</span>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {analysis.similarArtists.map(a => (
                        <span key={a} style={{ padding: '2px 9px', background: 'white', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-2)' }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <LockedSection title="Artist Cotation" planRequired="Collector" />
            )}

            {/* 3. Market analysis (always visible if any access) */}
            <div style={{ padding: '18px 20px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
              <div className="label-caps" style={{ marginBottom: '12px' }}>Market Analysis</div>
              <div style={{ marginBottom: '10px' }}>
                <PricingBadge pricing={analysis.currentPricing} />
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.65, marginBottom: '10px' }}>{analysis.pricingExplanation}</p>
              {limits.hasMarketTiming && analysis.timingExplanation && (
                <div style={{ padding: '8px 12px', background: 'white', border: '1px solid var(--border)' }}>
                  <span className="label-caps" style={{ marginRight: '6px' }}>Timing: </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)', marginRight: '6px' }}>{analysis.marketTiming}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{analysis.timingExplanation}</span>
                </div>
              )}
            </div>

            {/* 4. Projections */}
            {limits.hasProjections && limits.projectionYears.length > 0 ? (
              <div style={{ padding: '18px 20px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <ProjectionChart
                  projections={analysis.projections}
                  visibleYears={limits.projectionYears}
                  basePrice={analysis.basePrice}
                />
                {!limits.hasFullArtistProfile && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(26,42,68,0.04)', border: '1px solid rgba(26,42,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>🔒 20yr and 50yr projections on Family Office plan</span>
                    <button onClick={() => navigate('/app/pricing')} style={{ padding: '4px 10px', background: 'var(--navy)', color: 'white', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>Upgrade</button>
                  </div>
                )}
              </div>
            ) : limits.hasArtistCotation ? (
              <LockedSection title="Price Projections (5–50yr)" planRequired="Collector" />
            ) : null}

            {/* 5. Provenance */}
            {limits.hasProvenance ? (
              analysis.provenanceNotes ? (
                <div style={{ padding: '18px 20px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                  <div className="label-caps" style={{ marginBottom: '10px' }}>Provenance & Authenticity</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="label-caps">Quality</span>
                    <RiskBadge level={analysis.provenanceQuality} />
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.65, marginBottom: '8px' }}>{analysis.provenanceNotes}</p>
                  {analysis.rarity && (
                    <div>
                      <span className="label-caps">Rarity: </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)' }}>{analysis.rarity.replace('_', ' ')} </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{analysis.rarityExplanation}</span>
                    </div>
                  )}
                </div>
              ) : null
            ) : limits.hasArtistCotation ? (
              <LockedSection title="Provenance & Authenticity" planRequired="Investor" />
            ) : null}

            {/* 6. Comparables */}
            {limits.hasComparables && analysis.comparableSales.length > 0 ? (
              <div style={{ padding: '18px 20px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <div className="label-caps" style={{ marginBottom: '10px' }}>Comparable Sales</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {analysis.comparableSales.slice(0, 4).map((comp, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'white', border: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.description}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{comp.house} · {comp.year}</div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--navy)', flexShrink: 0, marginLeft: '14px' }}>{comp.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : limits.hasArtistCotation ? (
              <LockedSection title="Comparable Sales" planRequired="Investor" />
            ) : null}

            {/* 7. Risk assessment */}
            {limits.hasAIVerdict && analysis.risks.length > 0 && (
              <div style={{ padding: '18px 20px', background: 'rgba(198,168,90,0.04)', border: '1px solid rgba(198,168,90,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div className="label-caps">Risk Assessment</div>
                  <RiskBadge level={analysis.overallRisk} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {analysis.risks.map((risk, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <RiskBadge level={risk.severity} />
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginRight: '5px' }}>{risk.factor}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{risk.explanation}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {analysis.riskMitigants.length > 0 && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                    <div className="label-caps" style={{ marginBottom: '5px' }}>Mitigants</div>
                    {analysis.riskMitigants.map((m, i) => (
                      <div key={i} style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', gap: '7px', marginBottom: '3px' }}>
                        <span style={{ color: '#0a5c2e', fontWeight: 700 }}>✓</span>{m}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Exit strategy */}
            {limits.hasAIVerdict && analysis.exitStrategy && (
              <div style={{ padding: '10px 16px', background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <span className="label-caps" style={{ marginRight: '8px' }}>Exit Strategy · </span>
                <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{analysis.exitStrategy}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
