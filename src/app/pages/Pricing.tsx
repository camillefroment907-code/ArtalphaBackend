import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Logo } from "../components/Logo";
import { getToken } from "../../lib/auth";

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

interface Plan {
  key: string;
  name: string;
  monthlyPriceKey?: string;
  annualPriceKey?: string;
  price: number;
  annualPrice: number;
  description: string;
  highlight: boolean;
  cta: string;
  badge: string | null;
  features: string[];
}

const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Explorer',
    price: 0,
    annualPrice: 0,
    description: 'Discover what Nautilus can do',
    highlight: false,
    cta: 'Start free',
    badge: null,
    features: [
      '3 AI-scored opportunities/day',
      'Basic deal score (0–100)',
      'Price vs estimate analysis',
      '3 messages with Larry',
      '3 portfolio items',
      'Limited artist profiles',
    ],
  },
  {
    key: 'collector',
    name: 'Collector',
    monthlyPriceKey: 'collector_monthly',
    annualPriceKey: 'collector_annual',
    price: 9,
    annualPrice: 7,
    description: 'Your first edge in the art market',
    highlight: false,
    cta: 'Get access',
    badge: null,
    features: [
      '10 AI-detected opportunities/day',
      'Full deal score + rationale',
      'Price vs estimate analysis',
      'Market signals & alerts',
      '10 Larry messages/month',
      '5-artist watchlist',
      'Primary market access (10 works)',
      '10 portfolio items',
    ],
  },
  {
    key: 'investor',
    name: 'Investor',
    monthlyPriceKey: 'investor_monthly',
    annualPriceKey: 'investor_annual',
    price: 29,
    annualPrice: 24,
    description: 'Professional-grade art investment intelligence',
    highlight: true,
    cta: 'Get access',
    badge: 'Most popular',
    features: [
      'Unlimited opportunities',
      'Full AI scoring & valuation',
      'Real-time market alerts',
      'AI agent with 3 custom strategies',
      '30 Larry messages/month',
      'Investment Memo generator',
      'Full primary market access',
      'Unlimited portfolio tracking',
      'Full artist profiles & momentum',
      'Priority support',
    ],
  },
  {
    key: 'pro',
    name: 'Family Office',
    monthlyPriceKey: 'pro_monthly',
    annualPriceKey: 'pro_annual',
    price: 99,
    annualPrice: 82,
    description: 'Complete infrastructure for serious capital',
    highlight: false,
    cta: 'Get access',
    badge: null,
    features: [
      'Everything in Investor',
      'Investment Dossier (5–50yr projections)',
      'Unlimited Larry messages',
      'Unlimited AI agent strategies',
      'Unlimited AI analyses',
      'Institutional reporting',
      'CSV export',
      'API access',
      'Dedicated support',
    ],
  },
];

const COMPARE_ROWS = [
  { feature: 'AI-scored opportunities/day', free: '3',        collector: '10',       investor: 'Unlimited', pro: 'Unlimited' },
  { feature: 'Deal score (0–100)',          free: '✓',        collector: '✓',        investor: '✓',         pro: '✓'         },
  { feature: 'Primary market access',       free: '3 works',  collector: '10 works', investor: 'Unlimited', pro: 'Unlimited' },
  { feature: 'Convictions (AI top picks)',  free: '✗',        collector: '✓',        investor: '✓',         pro: '✓'         },
  { feature: 'Larry AI advisor',            free: '3 msg',    collector: '10 msg/mo',investor: '30 msg/mo', pro: 'Unlimited' },
  { feature: 'AI agent strategies',         free: '✗',        collector: '1',        investor: '3',         pro: 'Unlimited' },
  { feature: 'Investment Memo',             free: '✗',        collector: '✗',        investor: '20/mo',     pro: 'Unlimited' },
  { feature: 'Investment Dossier',          free: '✗',        collector: '✗',        investor: '✗',         pro: 'Unlimited' },
  { feature: 'Portfolio tracking',          free: '3 items',  collector: '10 items', investor: 'Unlimited', pro: 'Unlimited' },
  { feature: 'Artist profiles',             free: 'Basic',    collector: '✓',        investor: 'Full',      pro: 'Full'      },
  { feature: 'Market alerts',               free: '✗',        collector: '✓',        investor: '✓',         pro: '✓'         },
  { feature: 'API access',                  free: '✗',        collector: '✗',        investor: '✗',         pro: '✓'         },
  { feature: 'CSV export',                  free: '✗',        collector: '✗',        investor: '✗',         pro: '✓'         },
  { feature: 'Support',                     free: 'Community',collector: 'Email',    investor: 'Priority',  pro: 'Dedicated' },
];

const FAQ_ITEMS = [
  { q: "How does the 7-day trial work?", a: "Full access to your chosen plan for 7 days. No credit card needed to start. If you don't cancel before the trial ends, you'll be charged automatically." },
  { q: "Can I upgrade mid-subscription?", a: "Yes, anytime. You pay the prorated difference immediately and your new plan activates instantly." },
  { q: "Can I downgrade an annual plan?", a: "Annual plans cannot be downgraded mid-year. You keep your current plan until renewal. Upgrades are always available immediately." },
  { q: "Can I cancel anytime?", a: "Monthly plans: cancel anytime, access until end of billing period. Annual plans: run until renewal date." },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(true);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    if (!plan.monthlyPriceKey) {
      navigate('/app/dashboard');
      return;
    }

    const token = getToken();
    if (!token) {
      navigate('/app/signup');
      return;
    }

    setLoading(plan.key);
    setError(null);

    try {
      const priceKey = isAnnual ? plan.annualPriceKey : plan.monthlyPriceKey;

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
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid server response');
      }

      if (!resp.ok) {
        const msg = data?.detail || data?.error || data?.message || `Server error ${resp.status}`;
        throw new Error(typeof msg === 'string' ? msg : 'Checkout failed');
      }

      const url = data?.checkout_url || data?.url;
      if (!url) {
        throw new Error('No checkout URL received');
      }

      window.location.href = url;

    } catch (e: any) {
      setError(e?.message || 'Could not start checkout. Please try again.');
    } finally {
      setLoading('');
    }
  };

  // "starter" in DB = "collector" plan key in frontend
  const effectivePlan = currentPlan === 'starter' ? 'collector' : currentPlan;
  const comparePlanKeys = ['free', 'starter', 'investor', 'pro'];

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
        <Logo variant="horizontal" color="dark" size={20} />
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
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
        <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '480px', margin: '0 auto 32px', lineHeight: 1.7 }}>
          From market discovery to full investment intelligence.
        </p>

        {/* Monthly / Annual toggle */}
        <div style={{ display: 'inline-flex', borderBottom: '2px solid var(--border)' }}>
          {(['monthly', 'annual'] as const).map(i => (
            <button
              key={i}
              onClick={() => setIsAnnual(i === 'annual')}
              style={{
                padding: '10px 28px', background: 'transparent', border: 'none',
                borderBottom: (i === 'annual') === isAnnual ? '2px solid var(--electric)' : '2px solid transparent',
                marginBottom: '-2px',
                fontSize: '13px', fontWeight: (i === 'annual') === isAnnual ? 600 : 400,
                color: (i === 'annual') === isAnnual ? 'var(--text)' : 'var(--text-3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {i === 'annual' ? 'Annual' : 'Monthly'}
              {i === 'annual' && (
                <span style={{ background: 'var(--electric)', color: 'white', fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}>
                  −25%
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
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
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px',
        alignItems: 'stretch',
        maxWidth: '1100px', margin: '0 auto', padding: '0 24px 64px',
      }}>
        {PLANS.map(plan => {
          const isCurrentPlan = effectivePlan === plan.key;
          const price = isAnnual ? plan.annualPrice : plan.price;
          const isHighlight = plan.highlight;

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
                padding: '28px 24px',
                display: 'flex', flexDirection: 'column',
                height: '100%',
                transition: 'box-shadow 0.2s',
              }}
            >
              {/* TOP SECTION — fixed 184px so all CTAs align */}
              <div style={{ height: '184px', display: 'flex', flexDirection: 'column' }}>
                {/* Badge slot — always 32px, empty if no badge */}
                <div style={{ height: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '12px' }}>
                  {(isCurrentPlan || plan.badge) && (
                    <div style={{ background: 'var(--electric)', color: 'white', fontSize: '9px', fontWeight: 700, padding: '3px 12px', borderRadius: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                      {isCurrentPlan ? 'YOUR CURRENT PLAN' : plan.badge!.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Plan name */}
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', fontFamily: 'var(--font-mono)', color: isHighlight ? 'rgba(255,255,255,0.5)' : 'var(--text-3)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {plan.name}
                </div>

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: isHighlight ? 'rgba(255,255,255,0.6)' : 'var(--text-2)' }}>€</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '42px', fontWeight: 700, color: isHighlight ? 'white' : 'var(--text)', lineHeight: 1 }}>
                    {price}
                  </span>
                  {plan.price > 0 && (
                    <span style={{ fontSize: '12px', color: isHighlight ? 'rgba(255,255,255,0.5)' : 'var(--text-3)' }}>/mo</span>
                  )}
                </div>

                {/* Savings — always 20px height */}
                <div style={{ height: '20px', marginBottom: '8px' }}>
                  {isAnnual && plan.price > 0 && (
                    <div style={{ fontSize: '11px', fontWeight: 600, color: isHighlight ? 'var(--gold)' : 'var(--electric)' }}>
                      €{plan.annualPrice * 12}/year · save €{(plan.price - plan.annualPrice) * 12}/year
                    </div>
                  )}
                </div>

                {/* Description — always 2 lines */}
                <p style={{ fontSize: '12px', lineHeight: 1.6, margin: 0, color: isHighlight ? 'rgba(255,255,255,0.55)' : 'var(--text-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                  {plan.description}
                </p>
              </div>

              {/* CTA — immediately after fixed-height top section, all at same Y */}
              <div style={{ marginBottom: '20px' }}>
                {isCurrentPlan ? (
                  <div style={{ width: '100%', padding: '11px', borderRadius: '6px', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', color: 'var(--electric)', fontSize: '12px', fontWeight: 700, textAlign: 'center', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    ✓ Current plan
                  </div>
                ) : plan.key === 'free' ? (
                  <button
                    onClick={() => navigate('/app/dashboard')}
                    style={{ width: '100%', padding: '11px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}
                  >
                    {plan.cta}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelect(plan)}
                    disabled={loading === plan.key}
                    style={{
                      width: '100%', padding: '11px', borderRadius: '6px',
                      background: isHighlight ? 'white' : 'var(--navy)',
                      color: isHighlight ? 'var(--navy)' : 'white',
                      border: 'none', fontSize: '12px', fontWeight: 700,
                      cursor: loading === plan.key ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      opacity: loading === plan.key ? 0.7 : 1,
                    }}
                  >
                    {loading === plan.key ? 'Loading...' : plan.cta}
                  </button>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: isHighlight ? 'rgba(255,255,255,0.1)' : 'var(--border)', marginBottom: '16px' }} />

              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {plan.features.map((feature, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ color: isHighlight ? 'var(--gold)' : 'var(--electric)', fontSize: '10px', marginTop: '3px', flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: '12px', lineHeight: 1.5, color: isHighlight ? 'rgba(255,255,255,0.75)' : 'var(--text-2)' }}>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
            {(['Explorer', 'Collector', 'Investor', 'Family Office'] as const).map((name, i) => (
              <div key={name} style={{ padding: '16px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: i === 2 ? 'var(--gold)' : 'white', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                {name.toUpperCase()}
                {(currentPlan === comparePlanKeys[i] || (currentPlan === 'collector' && comparePlanKeys[i] === 'starter')) && (
                  <div style={{ fontSize: '8px', color: 'var(--electric)', marginTop: '2px' }}>● YOUR PLAN</div>
                )}
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
              {[row.free, row.collector, row.investor, row.pro].map((val, i) => (
                <div key={i} style={{
                  padding: '14px 12px', textAlign: 'center', fontSize: '12px',
                  color: val === '✓' ? 'var(--electric)' : val === '✗' ? 'var(--border)' : 'var(--text)',
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

      {/* Institutional */}
      <div style={{ maxWidth: '1100px', margin: '0 auto 64px', padding: '0 24px' }}>
        <div style={{ background: '#0A1628', borderRadius: '8px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' as const }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'white' }}>
                Institutional Access
              </div>
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--gold)', background: 'rgba(198,168,90,0.12)', padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(198,168,90,0.25)', fontFamily: 'var(--font-mono)' }}>
                CUSTOM
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', maxWidth: '480px', lineHeight: 1.6, margin: 0 }}>
              For auction houses, family offices, wealth managers and art funds. Custom limits, dedicated analytics team, API integration, SLA guarantees.
            </p>
          </div>
          <button
            onClick={() => navigate('/app/contact?plan=institutional')}
            className="btn-electric"
            style={{ whiteSpace: 'nowrap' as const }}
          >
            Contact sales →
          </button>
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
