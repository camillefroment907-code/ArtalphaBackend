import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
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
    badge: "MOST POPULAR",
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

  let btnLabel = "Start 7-day free trial";
  let btnDisabled = false;
  if (isActive) { btnLabel = "Your current plan"; btnDisabled = true; }
  else if (isSamePlanDiffInterval) btnLabel = `Switch to ${interval}`;
  else if (isYearlyLocked) { btnLabel = "Available at renewal"; btnDisabled = true; }
  else if (isUpgrade) btnLabel = "Upgrade — billed prorata";

  return (
    <div
      style={{
        background: "white",
        border: isActive ? "2px solid var(--navy)" : plan.highlight ? "2px solid var(--text)" : "1px solid var(--border)",
        borderRadius: "12px",
        padding: "32px",
        position: "relative",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        boxShadow: plan.highlight ? "0 12px 40px rgba(0,0,0,0.1)" : "0 2px 8px rgba(0,0,0,0.04)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
    >
      {plan.badge && !isActive && (
        <div style={{ position: "absolute", top: "-13px", left: "50%", transform: "translateX(-50%)", background: "var(--text)", color: "white", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", padding: "4px 16px", borderRadius: "20px", whiteSpace: "nowrap" }}>
          {plan.badge}
        </div>
      )}
      {isActive && (
        <div style={{ position: "absolute", top: "-13px", right: "16px", background: "var(--gold-dim)", color: "white", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", padding: "4px 12px", borderRadius: "20px" }}>
          YOUR PLAN
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
          {plan.name}
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-2)" }}>{plan.tagline}</div>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
          <span style={{ fontSize: "15px", color: "var(--text-2)" }}>€</span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "52px", fontWeight: 600, color: "var(--text)", lineHeight: 1 }}>
            {price}
          </span>
          <span style={{ fontSize: "14px", color: "var(--text-2)" }}>/mo</span>
        </div>
        {interval === "yearly" && (
          <div style={{ fontSize: "12px", color: "var(--navy)", fontWeight: 600, marginTop: "4px" }}>
            €{plan.yearlyTotal}/year · save €{(plan.monthly - plan.yearly) * 12}/year
          </div>
        )}
        <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "4px" }}>{plan.limit}</div>
      </div>

      <div style={{ flex: 1, marginBottom: "24px" }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0", borderBottom: i < plan.features.length - 1 ? "1px solid #F5F5F2" : "none" }}>
            <span style={{ color: "var(--navy)", fontWeight: 700, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => !btnDisabled && onSelect(priceKey, plan.id)}
        disabled={btnDisabled || isLoading}
        style={{
          width: "100%", padding: "14px",
          background: btnDisabled ? "var(--bg-subtle)" : plan.highlight ? "var(--text)" : "var(--navy)",
          color: btnDisabled ? "var(--text-3)" : "white",
          border: "none", borderRadius: "8px",
          fontSize: "13px", fontWeight: 600,
          cursor: btnDisabled || isLoading ? "not-allowed" : "pointer",
          letterSpacing: "0.05em", textTransform: "uppercase",
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
    } catch (e: any) {
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
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(250,250,248,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 32px",
        display: "flex", alignItems: "center", gap: "16px",
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "transparent", border: "none", cursor: "pointer",
            color: "#888", fontSize: "14px", padding: "6px 0",
            transition: "color 0.15s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--navy)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#888"; }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4"/>
          </svg>
          Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#aaa" }}>
          <span
            onClick={() => navigate("/app/opportunities")}
            style={{ cursor: "pointer", transition: "color 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.color = "var(--navy)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.color = "#aaa"; }}
          >
            Opportunities
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M4 2l4 4-4 4"/>
          </svg>
          <span style={{ color: "#555", fontWeight: 500 }}>Pricing</span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "64px 24px 48px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold-dim)", marginBottom: "16px" }}>
          Investment Plans
        </div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 600, color: "var(--text)", marginBottom: "16px", lineHeight: 1.15 }}>
          Access to Alpha
        </h1>
        <p style={{ fontSize: "16px", color: "var(--text-2)", maxWidth: "500px", margin: "0 auto 32px", lineHeight: 1.7 }}>
          Identify undervalued artworks before the market corrects. Intelligence for serious collectors.
        </p>

        {/* Monthly / Annual toggle */}
        <div style={{ display: "inline-flex", background: "var(--bg-subtle)", borderRadius: "8px", padding: "4px", gap: "2px" }}>
          {(["monthly", "yearly"] as Interval[]).map((i) => (
            <button
              key={i}
              onClick={() => setInterval(i)}
              style={{
                padding: "9px 24px",
                background: interval === i ? "white" : "transparent",
                border: "none", borderRadius: "6px",
                fontSize: "13px", fontWeight: interval === i ? 600 : 400,
                color: interval === i ? "var(--text)" : "var(--text-2)",
                cursor: "pointer",
                boxShadow: interval === i ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
                display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              {i === "yearly" ? "Annual" : "Monthly"}
              {i === "yearly" && (
                <span style={{ background: "var(--navy)", color: "white", fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px" }}>
                  -25%
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ marginTop: "16px", fontSize: "13px", color: "var(--text-3)", fontStyle: "italic" }}>
          From €9/month · 7-day free trial · No credit card required
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ maxWidth: "960px", margin: "0 auto 24px", padding: "0 24px" }}>
          <div style={{ padding: "14px 20px", background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: "8px", fontSize: "14px", color: "var(--red)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: "20px", lineHeight: 1 }}>×</button>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 24px 64px", display: "flex", gap: "20px", alignItems: "stretch" }}>
        {PLANS.map((plan) => (
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
        <div style={{
          background: "white",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "36px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "22px", fontWeight: 600, color: "var(--text)" }}>
                Institutional
              </div>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "var(--gold-dim)", background: "rgba(163,139,74,0.08)", padding: "3px 10px", borderRadius: "10px", border: "1px solid rgba(163,139,74,0.2)" }}>
                CUSTOM PRICING
              </span>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-2)", maxWidth: "520px", lineHeight: 1.6 }}>
              For auction houses, family offices, wealth managers and art funds. Custom limits, dedicated analytics team, API integration, SLA guarantees, and white-label options.
            </p>
          </div>
          <button
            onClick={() => navigate("/app/contact?plan=institutional")}
            style={{ padding: "14px 32px", background: "var(--text)", color: "white", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", transition: "all 0.15s ease" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--navy)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--text)"; }}
          >
            Contact Sales →
          </button>
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "0 24px 64px" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600, color: "var(--text)", textAlign: "center", marginBottom: "8px" }}>
          Compare Plans
        </h2>
        <p style={{ fontSize: "14px", color: "var(--text-2)", textAlign: "center", marginBottom: "36px" }}>
          Full breakdown of features across all plans
        </p>

        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "16px 24px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-3)" }}>
              Feature
            </div>
            {PLANS.map((p) => (
              <div key={p.id} style={{ padding: "16px", textAlign: "center", fontSize: "13px", fontWeight: 600, color: currentPlan === p.id ? "var(--navy)" : "var(--text)", borderLeft: "1px solid var(--border)" }}>
                {p.name}
                {currentPlan === p.id && (
                  <div style={{ fontSize: "10px", color: "var(--gold-dim)", fontWeight: 700, marginTop: "2px" }}>YOUR PLAN</div>
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
          ].map(({ label, values }, i) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: i < 9 ? "1px solid #F0F0EC" : "none" }}>
              <div style={{ padding: "13px 24px", fontSize: "13px", color: "var(--text-2)" }}>{label}</div>
              {values.map((v, j) => (
                <div key={j} style={{
                  padding: "13px", textAlign: "center", fontSize: "13px",
                  borderLeft: "1px solid #F0F0EC",
                  color: v === "—" ? "var(--text-ghost)" : (v === "✓" || v === "Unlimited" || v === "Full") ? "var(--navy)" : "var(--text)",
                  fontWeight: v === "✓" ? 700 : 400,
                }}>
                  {v}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "0 24px 80px" }}>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600, color: "var(--text)", textAlign: "center", marginBottom: "36px" }}>
          FAQ
        </h2>
        {[
          { q: "How does the 7-day trial work?", a: "Full access to your chosen plan for 7 days. No credit card needed to start. If you don't cancel before the trial ends, you'll be charged automatically." },
          { q: "Can I upgrade mid-subscription?", a: "Yes, anytime. You pay the prorated difference immediately and your new plan activates instantly." },
          { q: "Can I downgrade an annual plan?", a: "Annual plans cannot be downgraded mid-year. You keep your current plan until renewal. Upgrades are always available immediately." },
          { q: "Can I cancel anytime?", a: "Monthly plans: cancel anytime, access until end of billing period. Annual plans: run until renewal date." },
          { q: "How accurate is the AI scoring?", a: "Scores are based on comparable sales across Drouot and Interenchères, updated every 15 minutes. We show confidence levels on each opportunity." },
        ].map(({ q, a }, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--border)", padding: "20px 0" }}>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>{q}</div>
            <div style={{ fontSize: "14px", color: "var(--text-2)", lineHeight: 1.7 }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
