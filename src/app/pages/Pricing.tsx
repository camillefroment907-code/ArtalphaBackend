import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { getToken } from "../../lib/auth";
import { useSEO } from "../../lib/useSEO";

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

interface Plan {
  key: string;
  name: string;
  monthlyPriceKey?: string;
  annualPriceKey?: string;
  price: number;
  annualPrice?: number;
  annualMonthly?: number;
  badge?: string;
  priceSubtext?: string;
  description: string;
  highlight: boolean;
  cta: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Explorer',
    price: 0,
    description: 'Discover the market at your own pace.',
    highlight: false,
    cta: 'Current Plan',
    features: [
      '5 scored lots per day',
      'Deal score visible (0–100)',
      'Upside % visible',
      '1 top deal fully unlocked daily',
      '✗ Auction source hidden',
      '✗ Bidding links locked',
      '✗ No alerts',
      '✗ No AI analyst',
    ],
  },
  {
    key: 'investor',
    name: 'Investor',
    monthlyPriceKey: 'investor_monthly',
    annualPriceKey: 'investor_annual',
    price: 19,
    annualPrice: 190,
    annualMonthly: 15.83,
    badge: 'FOUNDING PRICE · LIMITED SPOTS',
    priceSubtext: 'Increases to €49/mo at public launch',
    description: 'For active collectors & investors.',
    highlight: true,
    cta: 'Get founding access →',
    features: [
      'Unlimited scored lots',
      'Full auction source revealed',
      'Direct bidding links',
      'How to bid guide',
      'Early access — before free users',
      'Real-time alerts (score ≥ 70)',
      'Ask your AI art analyst (20/month)',
      'Investment Memo (5/month)',
      '1 active strategy',
      'Basic portfolio tracking',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    monthlyPriceKey: 'pro_monthly',
    annualPriceKey: 'pro_annual',
    price: 99,
    annualPrice: 912,
    annualMonthly: 76,
    description: 'For serious art investors.',
    highlight: false,
    cta: 'Go Pro →',
    features: [
      'Everything in Investor',
      'Unlimited AI art analyst',
      'Unlimited Investment Memos',
      'Unlimited active strategies',
      'Alerts from score 60+',
      'Arbitrage signals',
      'Price projections (12/24 months)',
      'Portfolio IRR tracking',
      '+€X gained from Nautilus signals',
      'Export CSV / PDF',
      'Priority support',
    ],
  },
];

const COMPARE_ROWS = [
  { feature: 'Lots per day',            free: '5',             investor: 'Unlimited',      pro: 'Unlimited',   institutional: 'Custom'    },
  { feature: 'Deal score (0–100)',       free: '✓',             investor: '✓',              pro: '✓',           institutional: '✓'         },
  { feature: 'Upside %',                free: '✓',             investor: '✓',              pro: '✓',           institutional: '✓'         },
  { feature: 'Auction source',          free: 'Hidden',        investor: '✓',              pro: '✓',           institutional: '✓'         },
  { feature: 'Bidding links',           free: '✗',             investor: '✓',              pro: '✓',           institutional: '✓'         },
  { feature: 'How to bid',              free: '✗',             investor: '✓',              pro: '✓',           institutional: '✓'         },
  { feature: 'Early access',            free: '✗',             investor: '✓ (5 min edge)', pro: '✓',           institutional: '✓'         },
  { feature: 'Daily top deal',          free: '✓ (1/day)',     investor: '✓',              pro: '✓',           institutional: '✓'         },
  { feature: 'Real-time alerts',        free: '✗',             investor: 'Score ≥ 70',     pro: 'Score ≥ 60',  institutional: 'Custom'    },
  { feature: 'AI art analyst',          free: '✗',             investor: '20/month',       pro: 'Unlimited',   institutional: 'Unlimited' },
  { feature: 'Investment Memo',         free: '✗',             investor: '5/month',        pro: 'Unlimited',   institutional: 'Unlimited' },
  { feature: 'Active strategies',       free: '✗',             investor: '1',              pro: 'Unlimited',   institutional: 'Unlimited' },
  { feature: 'Arbitrage signals',       free: '✗',             investor: '✗',              pro: '✓',           institutional: '✓'         },
  { feature: 'Price projections',       free: '✗',             investor: '✗',              pro: '✓',           institutional: '✓'         },
  { feature: 'Portfolio IRR',           free: '✗',             investor: '✗',              pro: '✓',           institutional: '✓'         },
  { feature: '+€X performance track',   free: '✗',             investor: '✗',              pro: '✓',           institutional: '✓'         },
  { feature: 'Export CSV/PDF',          free: '✗',             investor: '✗',              pro: '✓',           institutional: '✓'         },
  { feature: 'Support',                 free: 'Community',     investor: 'Email',          pro: 'Priority',    institutional: 'Dedicated' },
];

const FAQ_ITEMS = [
  { q: "How does the 7-day trial work?", a: "Full access to your chosen plan for 7 days. No credit card needed to start. If you don't cancel before the trial ends, you'll be charged automatically." },
  { q: "Can I upgrade mid-subscription?", a: "Yes, anytime. You pay the prorated difference immediately and your new plan activates instantly." },
  { q: "Can I downgrade an annual plan?", a: "Annual plans cannot be downgraded mid-year. You keep your current plan until renewal. Upgrades are always available immediately." },
  { q: "Can I cancel anytime?", a: "Monthly plans: cancel anytime, access until end of billing period. Annual plans: run until renewal date." },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);

  useSEO({
    title: 'Pricing · Nautilus',
    description: 'Simple, transparent pricing for serious art investors. From first purchase to family office.',
  });

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${BACKEND}/api/billing/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setCurrentPlan(d.plan || 'free'))
      .catch(() => {});
  }, []);

  const handleSelect = async (plan: Plan) => {
    if (plan.key === 'free') {
      navigate('/app/dashboard');
      return;
    }
    if (plan.key === 'institutional') {
      navigate('/app/contact?plan=institutional');
      return;
    }

    const priceKey = isAnnual ? plan.annualPriceKey : plan.monthlyPriceKey;
    if (!priceKey) return;

    const token = getToken();
    if (!token) {
      navigate('/app/signup');
      return;
    }

    setLoading(plan.key);
    setError(null);

    try {
      const resp = await fetch(
        'https://artalpha-backend-production.up.railway.app/api/billing/create-checkout-session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ price_key: priceKey }),
        }
      );

      const text = await resp.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error('Invalid server response: ' + text); }

      if (!resp.ok) {
        const msg = typeof data?.detail === 'string' ? data.detail
          : typeof data?.error === 'string' ? data.error
          : `Server error ${resp.status}`;
        throw new Error(msg);
      }

      const url = data?.checkout_url || data?.url;
      if (!url) throw new Error('No checkout URL in response: ' + JSON.stringify(data));
      window.location.href = url;

    } catch (e: any) {
      console.error('CHECKOUT ERROR:', e);
      setError(e?.message || 'Could not start checkout. Please try again.');
    } finally {
      setLoading('');
    }
  };

  const effectivePlan = currentPlan === 'starter' ? 'investor' : currentPlan;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(250,250,250,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 32px', display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: '13px', padding: '6px 0', transition: 'color 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11L5 7l4-4"/>
          </svg>
          Back
        </button>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '64px 24px 48px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, color: 'var(--text)', marginBottom: '12px', lineHeight: 1.15 }}>
          Choose your level of access
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '480px', margin: '0 auto 8px', lineHeight: 1.7 }}>
          From market discovery to full investment intelligence.
        </p>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
          7-day free trial included · Cancel anytime
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ maxWidth: '1100px', margin: '0 auto 24px', padding: '0 24px' }}>
          <div style={{ padding: '14px 20px', background: 'var(--red-subtle)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '6px', fontSize: '13px', color: 'var(--red)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      {/* Plan cards — 4-column grid */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px 64px' }}>

        {/* Urgency strip */}
        <div style={{ textAlign: 'center', padding: '10px 20px', background: 'rgba(198,168,90,0.1)', borderRadius: 4, marginBottom: 24, fontSize: 12, color: '#1A2A44', letterSpacing: '0.06em' }}>
          ⚡ Founding member pricing — limited spots before public launch
        </div>

        {/* Annual toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginBottom: '28px', background: 'var(--bg-subtle)', borderRadius: '24px', padding: '4px', width: 'fit-content', margin: '0 auto 28px' }}>
          <button
            onClick={() => setIsAnnual(false)}
            style={{
              padding: '8px 24px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: !isAnnual ? 'white' : 'transparent',
              color: !isAnnual ? 'var(--text)' : 'var(--text-3)',
              boxShadow: !isAnnual ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            style={{
              padding: '8px 24px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: isAnnual ? 'white' : 'transparent',
              color: isAnnual ? 'var(--text)' : 'var(--text-3)',
              boxShadow: isAnnual ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            Annual
            <span style={{ fontSize: '9px', fontWeight: 700, background: '#16A34A', color: 'white', padding: '2px 6px', borderRadius: '8px', letterSpacing: '0.05em', whiteSpace: 'nowrap' as const }}>
              SAVE 23%
            </span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'stretch' }}>
          {PLANS.map(plan => {
            const isCurrentPlan = effectivePlan === plan.key;
            const isHighlight = plan.highlight;
            const annualSavings = plan.annualPrice ? (plan.price * 12 - plan.annualPrice) : 0;

            return (
              <div
                key={plan.key}
                style={{
                  background: isHighlight ? 'var(--navy)' : 'white',
                  border: isCurrentPlan
                    ? '2px solid var(--electric)'
                    : isHighlight
                    ? '2px solid var(--navy)'
                    : '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '24px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  transition: 'box-shadow 0.2s',
                }}
              >
                {/* Founding badge row — same height for all cards */}
                <div style={{ height: '22px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
                  {plan.badge && (
                    <div style={{ fontSize: '9px', color: '#C6A85A', letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      ⚡ {plan.badge}
                    </div>
                  )}
                </div>

                {/* Current plan badge row — same height for all cards */}
                <div style={{ height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '12px' }}>
                  {isCurrentPlan && (
                    <div style={{ background: 'var(--electric)', color: 'white', fontSize: '9px', fontWeight: 700, padding: '3px 12px', borderRadius: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                      YOUR CURRENT PLAN
                    </div>
                  )}
                </div>

                {/* Plan name */}
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', fontFamily: 'var(--font-mono)', color: isHighlight ? 'rgba(255,255,255,0.5)' : 'var(--text-3)', textTransform: 'uppercase' as const, marginBottom: '12px' }}>
                  {plan.name}
                </div>

                {/* Price + description — fixed height so CTA aligns across cards */}
                <div style={{ minHeight: '120px' }}>

                {/* Price block */}
                {plan.key === 'institutional' ? (
                  <div style={{ marginBottom: '12px', minHeight: '52px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                      CUSTOM PRICING
                    </div>
                  </div>
                ) : plan.key === 'free' ? (
                  <div style={{ marginBottom: '12px', minHeight: '52px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>€0</span>
                    </div>
                  </div>
                ) : plan.key === 'investor' ? (
                  <div style={{ marginBottom: '12px', minHeight: '52px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                        €{isAnnual ? '15.83' : '19'}
                      </span>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>/mo</span>
                    </div>
                    {isAnnual ? (
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        €190/year · save €{annualSavings}/year
                      </div>
                    ) : (
                      <div style={{ fontSize: '10px', color: '#C6A85A', letterSpacing: '0.07em', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        {plan.priceSubtext}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginBottom: '12px', minHeight: '52px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                        €{isAnnual && plan.annualMonthly ? plan.annualMonthly : plan.price}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>/mo</span>
                    </div>
                    {isAnnual && plan.annualPrice && (
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        €{plan.annualPrice}/year · save €{annualSavings}/year
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                <p style={{ fontSize: '12px', lineHeight: 1.6, margin: '0 0 16px', color: isHighlight ? 'rgba(255,255,255,0.55)' : 'var(--text-3)' }}>
                  {plan.description}
                </p>

                </div>{/* end price+description wrapper */}

                {/* CTA — above feature list */}
                <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                  {plan.key === 'free' ? (
                    <button
                      disabled
                      style={{
                        width: '100%', padding: '11px', borderRadius: '6px',
                        background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                        color: 'var(--text-3)', fontSize: '12px', fontWeight: 700,
                        cursor: 'not-allowed', letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      }}
                    >
                      {plan.cta}
                    </button>
                  ) : isCurrentPlan ? (
                    <div style={{ width: '100%', padding: '11px', borderRadius: '6px', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', color: 'var(--electric)', fontSize: '12px', fontWeight: 700, textAlign: 'center', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                      ✓ Current plan
                    </div>
                  ) : plan.key === 'investor' ? (
                    <>
                      <button
                        onClick={() => handleSelect(plan)}
                        disabled={loading === plan.key}
                        style={{
                          width: '100%', padding: '13px', borderRadius: '6px',
                          background: '#2563EB', color: 'white', border: 'none',
                          fontSize: '13px', fontWeight: 700,
                          cursor: loading === plan.key ? 'not-allowed' : 'pointer',
                          letterSpacing: '0.04em',
                          opacity: loading === plan.key ? 0.7 : 1,
                        }}
                      >
                        {loading === plan.key ? 'Loading...' : plan.cta}
                      </button>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '8px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        Renews automatically · Cancel anytime
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSelect(plan)}
                        disabled={loading === plan.key}
                        style={{
                          width: '100%', padding: '11px', borderRadius: '6px',
                          background: 'var(--navy)', color: 'white', border: 'none',
                          fontSize: '12px', fontWeight: 700,
                          cursor: loading === plan.key ? 'not-allowed' : 'pointer',
                          letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                          opacity: loading === plan.key ? 0.7 : 1,
                        }}
                      >
                        {loading === plan.key ? 'Loading...' : plan.cta}
                      </button>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '8px', lineHeight: 1.5, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        Renews automatically · Cancel anytime
                      </div>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: isHighlight ? 'rgba(255,255,255,0.1)' : 'var(--border)', marginBottom: '14px' }} />

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  {plan.features.map((feature, i) => {
                    const isNeg = feature.startsWith('✗');
                    const label = isNeg ? feature.slice(1).trim() : feature;
                    return (
                      <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ color: isNeg ? '#F87171' : (isHighlight ? 'var(--gold)' : 'var(--electric)'), fontSize: '10px', marginTop: '3px', flexShrink: 0 }}>
                          {isNeg ? '✗' : '✓'}
                        </span>
                        <span style={{ fontSize: '12px', lineHeight: 1.5, color: isNeg ? (isHighlight ? 'rgba(255,255,255,0.35)' : 'var(--text-3)') : (isHighlight ? 'rgba(255,255,255,0.75)' : 'var(--text-2)') }}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Institutional banner */}
      <div style={{ maxWidth: '1100px', margin: '0 auto 48px', padding: '0 24px' }}>
        <div style={{ background: '#0A1628', borderRadius: '8px', padding: '40px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' as const }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'white' }}>
                Institutional Access
              </div>
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--gold)', background: 'rgba(198,168,90,0.12)', padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(198,168,90,0.25)', fontFamily: 'var(--font-mono)' }}>
                CUSTOM
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', maxWidth: '500px', lineHeight: 1.6, margin: 0 }}>
              For auction houses, family offices, wealth managers and art funds. Custom limits, dedicated analytics team, API integration, SLA guarantees.
            </p>
          </div>
          <button
            onClick={() => navigate('/app/contact?plan=institutional')}
            style={{ whiteSpace: 'nowrap' as const, padding: '12px 24px', borderRadius: '6px', background: '#2563EB', color: 'white', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}
          >
            Contact Sales →
          </button>
        </div>
      </div>

      {/* Compare table */}
      <div style={{ maxWidth: '1100px', margin: '0 auto 64px', padding: '0 24px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--text)', textAlign: 'center', marginBottom: '32px' }}>
          Compare plans
        </h2>
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: 'var(--navy)' }}>
            <div style={{ padding: '16px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' }}>FEATURE</div>
            {(['Explorer', 'Investor', 'Pro', 'Institutional'] as const).map((name, i) => (
              <div key={name} style={{ padding: '16px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: i === 1 ? 'var(--gold)' : 'white', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                {name.toUpperCase()}
              </div>
            ))}
          </div>

          {/* Rows */}
          {COMPARE_ROWS.map((row, idx) => (
            <div
              key={row.feature}
              style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: idx % 2 === 0 ? 'white' : 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}
            >
              <div style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-2)', fontWeight: 500 }}>{row.feature}</div>
              {[row.free, row.investor, row.pro, row.institutional].map((val, i) => (
                <div key={i} style={{
                  padding: '14px 12px', textAlign: 'center', fontSize: '12px',
                  color: val === '✓' ? 'var(--electric)' : val === '✗' ? 'var(--border)' : val === 'Hidden' ? 'var(--text-3)' : 'var(--text)',
                  fontWeight: val === '✓' || val === 'Unlimited' ? 700 : 400,
                  fontFamily: (val === '✓' || val === '✗') ? 'inherit' : 'var(--font-mono)',
                }}>
                  {val}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--text)', marginBottom: '32px' }}>
          FAQ
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '24px' }}>
          {FAQ_ITEMS.map(({ q, a }, i) => (
            <div key={i}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>{q}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7 }}>{a}</div>
            </div>
          ))}
        </div>
        <Link to="/faq" style={{ fontSize: '13px', color: 'var(--electric)', textDecoration: 'none', fontWeight: 500 }}>
          View full FAQ →
        </Link>
      </div>
    </div>
  );
}
