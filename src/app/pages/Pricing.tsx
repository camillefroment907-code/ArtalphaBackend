import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Logo } from "../components/Logo";
import { createCheckoutSession, getSubscription } from "../../lib/api";
import { isAuthenticated } from "../../lib/auth";

type Interval = "monthly" | "yearly";

const PLAN_ORDER = ["free", "starter", "investor", "pro", "elite"];

interface Plan {
  id: string;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  yearlyTotal: number;
  priceKeyMonthly: string;
  priceKeyYearly: string;
  highlight: boolean;
  badge?: string;
  limit: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Collector",
    tagline: "Your first edge in the art market",
    monthly: 9,
    yearly: 7,
    yearlyTotal: 86,
    priceKeyMonthly: "starter_monthly",
    priceKeyYearly: "starter_yearly",
    highlight: false,
    limit: "15 deals / day",
    features: [
      "15 undervalued artworks/day",
      "AI deal scoring (1–5 scale)",
      "Price vs estimate analysis",
      "Basic market signals",
      "5 artist watchlist",
      "7-day history",
    ],
  },
  {
    id: "investor",
    name: "Investor",
    tagline: "Professional-grade art intelligence",
    monthly: 29,
    yearly: 24,
    yearlyTotal: 290,
    priceKeyMonthly: "investor_monthly",
    priceKeyYearly: "investor_yearly",
    highlight: true,
    badge: "RECOMMENDED",
    limit: "50 deals / day",
    features: [
      "50 opportunities/day",
      "Full AI scoring & valuation",
      "Real-time market alerts",
      "Early deal access",
      "Unlimited artist watchlist",
      "Full history",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: "Family Office",
    tagline: "Complete infrastructure for serious capital",
    monthly: 99,
    yearly: 82,
    yearlyTotal: 990,
    priceKeyMonthly: "pro_monthly",
    priceKeyYearly: "pro_yearly",
    highlight: false,
    limit: "Unlimited + API",
    features: [
      "Unlimited opportunities",
      "Full portfolio tracking",
      "Full API access",
      "ROI projections",
      "Rarity & liquidity data",
      "CSV export",
      "Priority alerts",
    ],
  },
];

const FAQ_ITEMS = [
  { q: "How does the 7-day trial work?", a: "Full access to your chosen plan for 7 days. No credit card needed to start. If you don't cancel before the trial ends, you'll be charged automatically." },
  { q: "Can I upgrade mid-subscription?", a: "Yes, anytime. You pay the prorated difference immediately and your new plan activates instantly." },
  { q: "Can I downgrade an annual plan?", a: "Annual plans cannot be downgraded mid-year. You keep your current plan until renewal. Upgrades are always available immediately." },
  { q: "Can I cancel anytime?", a: "Monthly plans: cancel anytime, access until end of billing period. Annual plans: run until renewal date." },
];

function PlanCard({
  plan, interval, currentPlan, currentInterval, loading, onSelect,
}: {
  plan: Plan;
  interval: Interval;
  currentPlan: string;
  currentInterval: string;
  loading: string | null;
  onSelect: (key: string, id: string) => void;
}) {
  const price = interval === "monthly" ? plan.monthly : plan.yearly;
  const priceKey = interval === "monthly" ? plan.priceKeyMonthly : plan.priceKeyYearly;
  const isLoading = loading === priceKey;

  const currentIdx = PLAN_ORDER.indexOf(currentPlan);
  const planIdx = PLAN_ORDER.indexOf(plan.id);
  const isActive = currentPlan === plan.id && currentInterval === interval;
  const isSamePlanDiffInterval = currentPlan === plan.id && currentInterval !== interval;
  const isDowngrade = planIdx < currentIdx;
  const isUpgrade = planIdx > currentIdx && currentPlan !== "free";
  const isYearlyLocked = currentInterval === "yearly" && isDowngrade;

  let btnLabel = "Get access";
  let btnDisabled = false;
  if (isActive) { btnLabel = "Your current plan"; btnDisabled = true; }
  else if (isSamePlanDiffInterval) btnLabel = `Switch to ${interval}`;
  else if (isYearlyLocked) { btnLabel = "Available at renewal"; btnDisabled = true; }
  else if (isUpgrade) btnLabel = "Upgrade — billed prorata";

  return (
    <div
      style={{
        background: "white",
        border: isActive ? "2px solid var(--navy)" : plan.highlight ? "2px solid var(--electric)" : "1px solid var(--border)",
        borderRadius: "8px",
        padding: "32px",
        position: "relative",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        boxShadow: plan.highlight ? "0 0 0 4px var(--electric-subtle), 0 4px 16px rgba(0,0,0,0.08)" : "0 2px 8px rgba(0,0,0,0.04)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
    >
      {plan.badge && !isActive && (
        <div style={{ position: "absolute", top: "12px", right: "12px", background: "var(--electric-subtle)", color: "var(--electric)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", padding: "2px 8px", borderRadius: "4px", fontFamily: "var(--font-mono)", border: "1px solid var(--electric-border)" }}>
          {plan.badge}
        </div>
      )}
      {isActive && (
        <div style={{ position: "absolute", top: "12px", right: "12px", background: "var(--gold-subtle)", color: "var(--gold-dim)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", padding: "2px 8px", borderRadius: "4px", fontFamily: "var(--font-mono)", border: "1px solid var(--gold-border)" }}>
          YOUR PLAN
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
          {plan.name}
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-2)" }}>{plan.tagline}</div>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "15px", color: "var(--text-2)" }}>€</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "48px", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{price}</span>
          <span style={{ fontSize: "13px", color: "var(--text-2)" }}>/mo</span>
        </div>
        {interval === "yearly" && (
          <div style={{ fontSize: "12px", color: "var(--electric)", fontWeight: 600, marginTop: "4px" }}>
            €{plan.yearlyTotal}/year · save €{(plan.monthly - plan.yearly) * 12}/year
          </div>
        )}
        <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "4px" }}>{plan.limit}</div>
      </div>

      <div style={{ flex: 1, marginBottom: "24px" }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "7px 0" }}>
            <span style={{ color: "var(--electric)", fontSize: "11px", flexShrink: 0, marginTop: "2px" }}>→</span>
            <span style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => !btnDisabled && onSelect(priceKey, plan.id)}
        disabled={btnDisabled || isLoading}
        style={{
          width: "100%", padding: "14px",
          background: btnDisabled ? "var(--bg-subtle)" : plan.highlight ? "var(--electric)" : "var(--navy)",
          color: btnDisabled ? "var(--text-3)" : "white",
          border: "none", borderRadius: "6px",
          fontSize: "13px", fontWeight: 600,
          cursor: btnDisabled || isLoading ? "not-allowed" : "pointer",
          letterSpacing: "0.04em", textTransform: "uppercase" as const,
          transition: "all 0.15s ease",
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
            Redirecting to Stripe…
          </span>
        ) : btnLabel}
      </button>

      {isYearlyLocked && (
        <div style={{ textAlign: "center", fontSize: "11px", color: "var(--red)", marginTop: "8px" }}>
          Annual plan — available at renewal
        </div>
      )}
      {isUpgrade && !btnDisabled && (
        <div style={{ textAlign: "center", fontSize: "11px", color: "var(--text-2)", marginTop: "8px" }}>
          Upgrade instantly · prorated billing
        </div>
      )}
    </div>
  );
}

export default function Pricing() {
  const navigate = useNavigate();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{ plan: string; status: string; billing_interval?: string }>({ plan: "free", status: "active" });
  const authed = isAuthenticated();

  useEffect(() => {
    if (authed) getSubscription().then(setSubscription).catch(() => {});
  }, [authed]);

  const handleSelect = async (priceKey: string, planId: string) => {
    setError(null);
    if (!authed) {
      sessionStorage.setItem("intended_plan", priceKey);
      navigate(`/app/signup?plan=${planId}`);
      return;
    }
    setLoading(priceKey);
    try {
      const result = await createCheckoutSession(priceKey);
      const url = result.checkout_url || result.url;
      if (url) { window.location.href = url; return; }
      const err = result.error || result.detail;
      if (err === "not_authenticated" || (typeof err === "string" && err.includes("401"))) {
        navigate("/app/login");
        return;
      }
      setError(err || "Could not start checkout. Please try again.");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(null);
    }
  };

  const currentPlan = subscription.plan || "free";
  const currentInterval = subscription.billing_interval || "monthly";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Back nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(250,250,250,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border)", padding: "12px 32px", display: "flex", alignItems: "center", gap: "16px" }}>
        <Logo variant="horizontal" color="dark" size={20} />
        <div style={{ width: "1px", height: "20px", background: "var(--border)", margin: "0 4px" }} />
        <button
          onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: "13px", padding: "6px 0", transition: "color 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11L5 7l4-4"/>
          </svg>
          Back
        </button>
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "64px 24px 48px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, color: "var(--text)", marginBottom: "12px", lineHeight: 1.15 }}>
          Choose your level of access
        </h1>
        <p style={{ fontSize: "16px", color: "var(--text-2)", maxWidth: "480px", margin: "0 auto 32px", lineHeight: 1.7 }}>
          From market discovery to full investment intelligence.
        </p>

        {/* Toggle */}
        <div style={{ display: "inline-flex", gap: "0", borderBottom: "2px solid var(--border)" }}>
          {(["monthly", "yearly"] as Interval[]).map(i => (
            <button
              key={i}
              onClick={() => setInterval(i)}
              style={{
                padding: "10px 28px",
                background: "transparent",
                border: "none",
                borderBottom: interval === i ? "2px solid var(--electric)" : "2px solid transparent",
                marginBottom: "-2px",
                fontSize: "13px", fontWeight: interval === i ? 600 : 400,
                color: interval === i ? "var(--text)" : "var(--text-3)",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              {i === "yearly" ? "Annual" : "Monthly"}
              {i === "yearly" && (
                <span style={{ background: "var(--electric)", color: "white", fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
                  −25%
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--text-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
          7-day free trial included · Cancel anytime
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ maxWidth: "960px", margin: "0 auto 24px", padding: "0 24px" }}>
          <div style={{ padding: "14px 20px", background: "var(--red-subtle)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "6px", fontSize: "13px", color: "var(--red)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: "20px", lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 24px 64px", display: "flex", gap: "16px", alignItems: "stretch" }}>
        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            interval={interval}
            currentPlan={currentPlan}
            currentInterval={currentInterval}
            loading={loading}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Institutional */}
      <div style={{ maxWidth: "960px", margin: "0 auto 64px", padding: "0 24px" }}>
        <div style={{ background: "#0A1628", borderRadius: "8px", padding: "40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", flexWrap: "wrap" as const }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 600, color: "white" }}>
                Institutional Access
              </div>
              <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", color: "var(--gold)", background: "rgba(198,168,90,0.12)", padding: "3px 10px", borderRadius: "4px", border: "1px solid rgba(198,168,90,0.25)", fontFamily: "var(--font-mono)" }}>
                CUSTOM
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", maxWidth: "480px", lineHeight: 1.6, margin: 0 }}>
              For auction houses, family offices, wealth managers and art funds. Custom limits, dedicated analytics team, API integration, SLA guarantees, and white-label options.
            </p>
          </div>
          <button
            onClick={() => navigate("/app/contact?plan=institutional")}
            className="btn-electric"
            style={{ whiteSpace: "nowrap" }}
          >
            Contact sales →
          </button>
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 24px 64px" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600, color: "var(--text)", textAlign: "center", marginBottom: "8px" }}>
          Compare Plans
        </h2>
        <p style={{ fontSize: "13px", color: "var(--text-2)", textAlign: "center", marginBottom: "36px" }}>
          Full breakdown of features across all plans
        </p>

        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "16px 24px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "var(--text-3)", background: "var(--bg-subtle)" }}>
              Feature
            </div>
            {PLANS.map(p => (
              <div key={p.id} style={{ padding: "16px", textAlign: "center", fontSize: "13px", fontWeight: 600, color: p.highlight ? "var(--electric)" : currentPlan === p.id ? "var(--navy)" : "var(--text)", borderLeft: "1px solid var(--border)", background: p.highlight ? "var(--electric-subtle)" : "var(--bg-subtle)" }}>
                {p.name}
                {currentPlan === p.id && (
                  <div style={{ fontSize: "9px", color: "var(--gold-dim)", fontWeight: 700, marginTop: "2px", fontFamily: "var(--font-mono)" }}>YOUR PLAN</div>
                )}
              </div>
            ))}
          </div>

          {[
            { label: "Deals per day", values: ["15", "50", "Unlimited"] },
            { label: "AI deal scoring", values: ["Basic", "Full system", "Full + custom"] },
            { label: "Real-time feed", values: ["—", "✓", "✓"] },
            { label: "Real-time alerts", values: ["5/day", "Real-time", "Priority"] },
            { label: "Artist watchlist", values: ["5", "Unlimited", "Unlimited"] },
            { label: "History", values: ["7 days", "Full", "Full"] },
            { label: "Portfolio tracking", values: ["—", "—", "✓"] },
            { label: "ROI projections", values: ["—", "—", "✓"] },
            { label: "API access", values: ["—", "—", "✓"] },
            { label: "CSV export", values: ["—", "—", "✓"] },
          ].map(({ label, values }, i, arr) => (
            <div
              key={label}
              style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: i < arr.length - 1 ? "1px solid var(--border-light)" : "none", transition: "background 0.12s" }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "var(--bg-subtle)"}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
            >
              <div style={{ padding: "12px 24px", fontSize: "13px", color: "var(--text-2)" }}>{label}</div>
              {values.map((v, j) => (
                <div key={j} style={{ padding: "12px", textAlign: "center", fontSize: "13px", borderLeft: "1px solid var(--border-light)", color: v === "—" ? "var(--text-ghost)" : (v === "✓" || v === "Unlimited" || v === "Full") ? (j === 1 ? "var(--electric)" : "var(--navy)") : "var(--text)", fontWeight: v === "✓" ? 700 : 400, background: j === 1 ? "rgba(37,99,235,0.02)" : "transparent" }}>
                  {v}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ — 2-col, 4 items, always shown */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 24px 80px" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600, color: "var(--text)", marginBottom: "32px" }}>
          FAQ
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginBottom: "24px" }}>
          {FAQ_ITEMS.map(({ q, a }, i) => (
            <div key={i}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>{q}</div>
              <div style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.7 }}>{a}</div>
            </div>
          ))}
        </div>
        <div>
          <Link to="/faq" style={{ fontSize: "13px", color: "var(--electric)", textDecoration: "none", fontWeight: 500 }}>
            View full FAQ →
          </Link>
        </div>
      </div>

    </div>
  );
}
