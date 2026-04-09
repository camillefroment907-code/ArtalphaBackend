import { useNavigate } from 'react-router';
import { getPlanLimits, getUser } from '../../lib/auth';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', starter: 'Collector', investor: 'Investor',
  pro: 'Family Office', elite: 'Institutional',
};

export default function Market() {
  const navigate = useNavigate();
  const limits = getPlanLimits();
  const user = getUser();
  const plan = user?.email === 'camillefroment907@gmail.com' ? 'elite' : (user?.plan ?? 'free');
  const planLabel = PLAN_LABELS[plan] ?? plan;

  // ── LOCKED STATE ─────────────────────────────────────────────
  if (!limits.hasFullArtistProfile) {
    return (
      <div className="page" style={{
        background: 'var(--bg)', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: '760px', width: '100%' }}>
          {/* Badge */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--gold-dim)', marginBottom: '16px',
          }}>
            FAMILY OFFICE
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: '48px', fontWeight: 600,
            color: 'var(--navy)', margin: 0,
          }}>
            Market Intelligence
          </h1>

          {/* Gold rule */}
          <div style={{
            width: '60px', height: '2px', background: 'var(--gold)',
            margin: '24px auto 40px',
          }} />

          {/* 2×2 feature teasers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
            marginBottom: '40px',
          }}>
            {[
              { icon: '⊕', title: 'Global Auction Monitor',  desc: 'Live feed from 10+ auction houses, updated every 15 minutes' },
              { icon: '≡', title: 'Category Trends',          desc: 'Price momentum by medium, period, and geography over 24 months' },
              { icon: '◈', title: 'Institutional Flow',       desc: 'Track where major collectors and funds are allocating capital' },
              { icon: '◎', title: 'Market Timing',            desc: 'AI-powered signals for optimal entry and exit windows' },
            ].map(f => (
              <div key={f.icon} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '2px', padding: '24px', textAlign: 'left',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '20px',
                  color: 'var(--navy)', marginBottom: '10px',
                }}>
                  {f.icon}
                </div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: '16px',
                  color: 'var(--text)', marginBottom: '6px',
                }}>
                  {f.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Blurred fake dashboard */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
            marginBottom: '40px', pointerEvents: 'none', userSelect: 'none',
          }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{
                height: '120px', background: 'var(--bg-subtle)',
                borderRadius: '2px', filter: 'blur(8px)', opacity: 0.3,
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
              Access Market Intelligence
            </div>
            <div style={{
              fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px',
            }}>
              Available from Family Office plan · €99/month
            </div>
            <button
              className="btn btn-gold"
              style={{ fontSize: '13px', padding: '14px 28px' }}
              onClick={() => navigate('/app/pricing')}
            >
              Upgrade to Family Office →
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
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          padding: '40px 0 28px', borderBottom: '2px solid var(--border)',
        }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Market Intelligence
          </h1>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--gold-dim)', background: 'var(--gold-subtle)',
            border: '1px solid var(--gold-border)',
            padding: '3px 9px', borderRadius: '4px',
          }}>
            {planLabel}
          </span>
        </div>

        {/* Banner */}
        <div style={{
          marginTop: '20px',
          padding: '14px 20px',
          background: 'var(--gold-subtle)', border: '1px solid var(--gold-border)',
          borderRadius: '2px', fontSize: '13px', color: 'var(--gold-dim)',
        }}>
          Full market dashboard launching soon. Your Family Office plan includes this feature.
        </div>

        {/* 4 stat tiles */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
          marginTop: '28px',
        }}>
          {[
            'Global Lots Today',
            'Avg Deal Score',
            'Sources Active',
            'Art Price Index',
          ].map(label => (
            <div key={label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '2px', padding: '28px',
            }}>
              <div className="label-caps" style={{ marginBottom: '12px' }}>{label}</div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 700,
                color: 'var(--navy)', marginBottom: '8px', lineHeight: 1,
              }}>
                —
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Live data coming soon</div>
            </div>
          ))}
        </div>

        {/* Center message */}
        <div style={{ marginTop: '48px', textAlign: 'center', padding: '48px 0' }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '48px',
            color: 'var(--border)', marginBottom: '20px',
          }}>
            ◇
          </div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '20px',
            color: 'var(--text-2)', marginBottom: '8px',
          }}>
            Market dashboard in development
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px' }}>
            Your alerts and opportunities are fully operational in the meantime.
          </div>
          <button
            className="btn btn-navy"
            style={{ fontSize: '12px', padding: '12px 24px' }}
            onClick={() => navigate('/app/opportunities')}
          >
            Browse Opportunities
          </button>
        </div>

      </div>
    </div>
  );
}
