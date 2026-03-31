"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, X, Zap, TrendingUp, Crown, Building2, Flame, AlertCircle } from "lucide-react";

const PLAN_ORDER = ["free", "starter", "investor", "pro", "elite"];

const PLANS = [
  {
    id: "free",
    name: "Free",
    icon: Zap,
    tagline: "Discover the market",
    monthly: 0,
    yearly: 0,
    color: "#52525b",
    highlighted: false,
    badge: null as string | null,
    isContact: false,
    features: [
      { label: "3 deals / day",       ok: true  },
      { label: "Deal scores visible", ok: true  },
      { label: "Top deals access",    ok: true  },
      { label: "1 alert / day",       ok: true  },
      { label: "24h history",         ok: true  },
      { label: "Real-time feed",      ok: false },
      { label: "Favorite artists",    ok: false },
      { label: "Portfolio tracker",   ok: false },
      { label: "API access",          ok: false },
    ],
    priceKey: null as null | { monthly: string; yearly: string },
  },
  {
    id: "starter",
    name: "Starter",
    icon: TrendingUp,
    tagline: "Entry-level intelligence",
    monthly: 9,
    yearly: 90,
    color: "#3b82f6",
    highlighted: false,
    badge: null as string | null,
    isContact: false,
    features: [
      { label: "15 deals / day",      ok: true  },
      { label: "Full deal scores",    ok: true  },
      { label: "5 alerts / day",      ok: true  },
      { label: "Basic filters",       ok: true  },
      { label: "5 favorite artists",  ok: true  },
      { label: "7-day history",       ok: true  },
      { label: "Real-time feed",      ok: false },
      { label: "Portfolio tracker",   ok: false },
      { label: "API access",          ok: false },
    ],
    priceKey: { monthly: "starter_monthly", yearly: "starter_yearly" },
  },
  {
    id: "investor",
    name: "Investor",
    icon: Flame,
    tagline: "For active collectors",
    monthly: 29,
    yearly: 290,
    color: "#d4a843",
    highlighted: true,
    badge: "Most Popular" as string | null,
    isContact: false,
    features: [
      { label: "50 deals / day",      ok: true  },
      { label: "Real-time alerts",    ok: true  },
      { label: "Advanced filters",    ok: true  },
      { label: "Unlimited favorites", ok: true  },
      { label: "Full history",        ok: true  },
      { label: "Early deal access",   ok: true  },
      { label: "Portfolio tracker",   ok: false },
      { label: "ROI projections",     ok: false },
      { label: "API access",          ok: false },
    ],
    priceKey: { monthly: "investor_monthly", yearly: "investor_yearly" },
  },
  {
    id: "pro",
    name: "Pro",
    icon: Crown,
    tagline: "For serious investors",
    monthly: 99,
    yearly: 990,
    color: "#a78bfa",
    highlighted: false,
    badge: "Best Value" as string | null,
    isContact: false,
    features: [
      { label: "Unlimited deals",       ok: true  },
      { label: "Priority alerts",       ok: true  },
      { label: "Portfolio tracker",     ok: true  },
      { label: "ROI projections",       ok: true  },
      { label: "Rarity & liquidity",    ok: true  },
      { label: "Trend analytics",       ok: true  },
      { label: "Lite API access",       ok: true  },
      { label: "CSV export",            ok: true  },
      { label: "Dedicated support",     ok: false },
    ],
    priceKey: { monthly: "pro_monthly", yearly: "pro_yearly" },
  },
  {
    id: "elite",
    name: "Elite",
    icon: Building2,
    tagline: "For galleries & funds",
    monthly: null as number | null,
    yearly: null as number | null,
    color: "#f59e0b",
    highlighted: false,
    badge: null as string | null,
    isContact: true,
    features: [
      { label: "Everything in Pro",       ok: true },
      { label: "Before-everyone access",  ok: true },
      { label: "Ultra-priority alerts",   ok: true },
      { label: "Exclusive data",          ok: true },
      { label: "Full API access",         ok: true },
      { label: "New sources first",       ok: true },
      { label: "Direct support",          ok: true },
      { label: "SLA guarantee",           ok: true },
      { label: "Custom integrations",     ok: true },
    ],
    priceKey: null as null | { monthly: string; yearly: string },
  },
];

function getToken(): string | null {
  try {
    for (const key of ["hono-auth", "artalpha-auth", "balthus-auth"]) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        const token = parsed?.state?.token || parsed?.token;
        if (token) return token;
      }
    }
    const match = document.cookie.match(/(?:^|;\s*)hono_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {}
  return null;
}

function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  const FAQS = [
    {
      q: "Is the 7-day trial completely free?",
      a: "Yes — no charge during your trial. You won't be billed until day 8. Cancel anytime before then and you'll never pay a cent. We require a payment method upfront to ensure a seamless transition if you choose to continue.",
    },
    {
      q: "Can I cancel my subscription at any time?",
      a: "Monthly plans can be cancelled at any time — you keep access until the end of the billing period. Annual plans can be cancelled but access continues until the end of the 12-month term. No partial refunds on annual plans, but you'll never be charged again after cancellation.",
    },
    {
      q: "What happens when I upgrade from Investor to Pro mid-year?",
      a: "You pay the prorated difference for the remaining months on your current annual cycle, then start a fresh 12-month Pro subscription. For example, upgrading after 3 months on Investor Yearly means you pay 9 months of the price difference, then €990 for the next 12 months. Stripe handles this calculation automatically.",
    },
    {
      q: "Can I downgrade my plan?",
      a: "On monthly plans, you can downgrade at any time effective at the next billing cycle. On annual plans, downgrading is not available until your current annual term ends — you've committed to 12 months. You can always upgrade during an annual term.",
    },
    {
      q: "How is lot data collected and how often is it updated?",
      a: "ArtAlpha aggregates data from Drouot, Interenchères, Invaluable, and other major auction houses. The feed refreshes every 15 minutes. Deal scores are calculated in real-time using our proprietary algorithm weighing price vs. estimate, artist liquidity, house reputation, and historical market data.",
    },
    {
      q: "What payment methods do you accept?",
      a: "We accept all major credit and debit cards (Visa, Mastercard, Amex), as well as Apple Pay, Google Pay, and Link by Stripe. All payments are processed securely by Stripe — we never store your card details.",
    },
    {
      q: "Is my financial and collection data secure?",
      a: "Your portfolio data is encrypted at rest and in transit. We never share or sell your data to third parties. Our infrastructure is hosted on SOC 2 compliant cloud providers. You can export or delete your data at any time from your account settings.",
    },
    {
      q: "What is a 'deal score' and how reliable is it?",
      a: "The deal score (0–100) reflects how attractive a lot is relative to its estimated value and market context. A score above 75 indicates a statistically undervalued lot. Scores are based on estimate vs. current price, artist auction history, house reputation, and time remaining. It is an analytical signal, not investment advice.",
    },
    {
      q: "Does ArtAlpha cover international auction houses?",
      a: "Currently ArtAlpha covers leading French houses (Drouot, Interenchères) and international platforms (Invaluable). We are actively integrating Christie's, Sotheby's, and Bonhams. Elite plan members get access to new sources as soon as they go live.",
    },
    {
      q: "What is the Elite plan and who is it for?",
      a: "Elite is a bespoke plan for galleries, family offices, and institutional collectors who need before-everyone access, full API integration, and dedicated analyst support. Pricing is custom and based on usage volume. Contact us at contact@artalpha.com to discuss your needs.",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 40px" }}>
      {FAQS.map((faq, i) => (
        <div key={i} style={{ borderBottom: "1px solid #1a1a1d" }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 0",
              background: "none",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              gap: "16px",
            }}
          >
            <span style={{
              fontSize: "14px",
              fontWeight: 500,
              color: open === i ? "#d4a843" : "#fafafa",
              lineHeight: 1.4,
              transition: "color 0.15s ease",
            }}>
              {faq.q}
            </span>
            <span style={{
              fontSize: "18px",
              color: open === i ? "#d4a843" : "#52525b",
              flexShrink: 0,
              transition: "all 0.2s ease",
              transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
              display: "inline-block",
              fontWeight: 300,
              lineHeight: 1,
            }}>
              +
            </span>
          </button>
          {open === i && (
            <div style={{
              paddingBottom: "20px",
              fontSize: "13px",
              color: "#71717a",
              lineHeight: 1.7,
            }}>
              {faq.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type ConfirmModal = {
  plan: typeof PLANS[0];
  priceKey: string;
  isUpgrade: boolean;
  isDowngrade: boolean;
};

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<string>("monthly");
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/billing/subscription", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.plan) setCurrentPlan(d.plan);
        if (d.billing_interval) setBillingInterval(d.billing_interval);
      })
      .catch(() => {});
  }, []);

  const handleSubscribe = (plan: typeof PLANS[0]) => {
    setError(null);

    if (plan.id === "free") {
      window.location.href = "/auth/register";
      return;
    }
    if (plan.id === "elite") {
      window.location.href = "mailto:contact@artalpha.com?subject=ArtAlpha Elite Plan";
      return;
    }
    if (plan.id === currentPlan) return;

    const token = getToken();
    if (!token) {
      window.location.href = `/auth/register?redirect=/pricing`;
      return;
    }

    const currentIdx = PLAN_ORDER.indexOf(currentPlan ?? "free");
    const targetIdx = PLAN_ORDER.indexOf(plan.id);
    const isUpgrade = targetIdx > currentIdx;
    const isDowngrade = targetIdx < currentIdx && currentPlan !== "free";

    setConfirmModal({ plan, priceKey: plan.priceKey?.[billing] || "", isUpgrade, isDowngrade });
  };

  const confirmCheckout = async () => {
    if (!confirmModal) return;
    const { plan, priceKey } = confirmModal;
    setConfirmModal(null);
    setLoading(plan.id);

    const token = getToken();
    if (!token) {
      window.location.href = "/auth/login?redirect=/pricing";
      return;
    }

    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price_key: priceKey }),
      });
      const data = await res.json();

      if (data.upgraded) {
        setCurrentPlan(plan.id);
        return;
      }
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      if (res.status === 401) {
        window.location.href = "/auth/login?redirect=/pricing";
        return;
      }
      const msg = data.detail?.message || (typeof data.detail === "string" ? data.detail : null) || "Error creating session";
      setError(msg);
    } catch {
      setError("Connection error — please try again");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0b" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #27272a", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #d4a843, #f0c060)", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#09090b", fontFamily: "serif" }}>A</span>
          </div>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#fafafa", fontFamily: "'Playfair Display', serif", letterSpacing: "0.05em" }}>ArtAlpha</span>
        </Link>
        <div style={{ display: "flex", gap: "12px" }}>
          <Link href="/auth/login" style={{ padding: "7px 14px", border: "1px solid #27272a", borderRadius: "3px", color: "#a1a1aa", fontSize: "13px", textDecoration: "none" }}>Sign in</Link>
          <Link href="/auth/register" style={{ padding: "7px 14px", background: "#d4a843", borderRadius: "3px", color: "#09090b", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>Get started</Link>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "60px 24px" }}>
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#d4a843", marginBottom: "16px" }}>Pricing</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(32px, 5vw, 52px)", color: "#fafafa", marginBottom: "16px", lineHeight: 1.1 }}>
            Your edge in the<br />art market
          </h1>
          <p style={{ color: "#71717a", fontSize: "16px", maxWidth: "480px", margin: "0 auto 32px" }}>
            Join 2,000+ collectors and investors who use ArtAlpha to find undervalued art before anyone else.
          </p>

          {/* Billing toggle */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", background: "#111113", border: "1px solid #27272a", borderRadius: "4px", padding: "6px 16px" }}>
            <button
              onClick={() => setBilling("monthly")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: billing === "monthly" ? 600 : 400, color: billing === "monthly" ? "#fafafa" : "#71717a", padding: "4px 0" }}
            >
              Monthly
            </button>
            <div
              onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")}
              style={{ width: "36px", height: "20px", background: billing === "yearly" ? "#d4a843" : "#27272a", borderRadius: "10px", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
            >
              <div style={{ position: "absolute", top: "2px", left: billing === "yearly" ? "18px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
            </div>
            <button
              onClick={() => setBilling("yearly")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: billing === "yearly" ? 600 : 400, color: billing === "yearly" ? "#fafafa" : "#71717a", padding: "4px 0", display: "flex", alignItems: "center", gap: "6px" }}
            >
              Yearly
              <span style={{ fontSize: "10px", background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "3px", padding: "1px 5px", fontWeight: 700 }}>
                −17%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: "24px", padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "4px", display: "flex", alignItems: "flex-start", gap: "10px" }}
          >
            <AlertCircle size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: "1px" }} />
            <span style={{ fontSize: "13px", color: "#fca5a5", flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: 0 }}>×</button>
          </motion.div>
        )}

        {/* Manage subscription link */}
        {currentPlan && currentPlan !== "free" && (
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <Link href="/profile" style={{ fontSize: "12px", color: "#52525b", textDecoration: "none", borderBottom: "1px solid #3f3f46", paddingBottom: "1px" }}>
              Manage subscription, invoices &amp; cancellation →
            </Link>
          </div>
        )}

        {/* Plans grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "12px",
          alignItems: "stretch",
        }}>
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const color = plan.color;

            const priceLabel = (() => {
              if (plan.id === "elite") return null;
              if (plan.monthly === 0) return "Free";
              if (billing === "yearly") return `€${plan.yearly}/yr`;
              return `€${plan.monthly}/mo`;
            })();

            const subLabel = (() => {
              if (plan.id === "elite" || plan.monthly === 0 || plan.monthly === null) return null;
              if (billing === "yearly" && plan.yearly && plan.monthly) {
                return `€${Math.round(plan.yearly / 12)}/mo billed annually`;
              }
              if (billing === "monthly" && plan.yearly) {
                return `or €${plan.yearly}/yr · save ${Math.round(100 - (plan.yearly / (plan.monthly * 12)) * 100)}%`;
              }
              return null;
            })();

            const currentIdx = PLAN_ORDER.indexOf(currentPlan ?? "free");
            const planIdx = PLAN_ORDER.indexOf(plan.id);
            const isCurrentPlan = currentPlan === plan.id;
            const isLowerPlan = currentPlan !== null && currentPlan !== "free" && planIdx < currentIdx;
            const isDisabled = isCurrentPlan || isLowerPlan || loading === plan.id;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  position: "relative",
                  background: isCurrentPlan
                    ? "rgba(34,197,94,0.04)"
                    : plan.highlighted ? "rgba(212,168,67,0.05)" : "#111113",
                  border: isCurrentPlan
                    ? "2px solid #22c55e"
                    : plan.highlighted ? "1px solid rgba(212,168,67,0.4)" : "1px solid #27272a",
                  borderRadius: "6px",
                  padding: "24px 20px",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "560px",
                  boxShadow: isCurrentPlan
                    ? "0 0 0 1px rgba(34,197,94,0.2), 0 0 24px rgba(34,197,94,0.08)"
                    : plan.highlighted ? "0 0 40px rgba(212,168,67,0.08)" : "none",
                }}
              >
                {/* Badge */}
                {isCurrentPlan ? (
                  <div style={{
                    position: "absolute", top: "-11px", left: "50%", transform: "translateX(-50%)",
                    background: "#22c55e",
                    color: "#fff",
                    fontSize: "10px", fontWeight: 700,
                    padding: "3px 12px", borderRadius: "10px",
                    whiteSpace: "nowrap",
                  }}>
                    ✓ Your current plan
                  </div>
                ) : plan.badge ? (
                  <div style={{
                    position: "absolute", top: "-11px", left: "50%", transform: "translateX(-50%)",
                    background: plan.highlighted ? "#d4a843" : "#1a1a1d",
                    border: `1px solid ${color}`,
                    color: plan.highlighted ? "#09090b" : color,
                    fontSize: "10px", fontWeight: 700,
                    padding: "3px 12px", borderRadius: "10px",
                    whiteSpace: "nowrap",
                  }}>
                    {plan.badge}
                  </div>
                ) : null}

                {/* Plan header */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <div style={{ width: "26px", height: "26px", background: `${color}20`, borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa" }}>{plan.name}</div>
                </div>
                <div style={{ fontSize: "11px", color: "#52525b", marginBottom: "16px" }}>{plan.tagline}</div>

                {/* Price block — fixed height */}
                <div style={{ height: "96px", marginBottom: "16px", display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
                  {plan.id === "elite" ? (
                    <>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", color: "#fafafa", lineHeight: 1.1 }}>Custom</div>
                      <div style={{ fontSize: "11px", color: "#52525b", marginTop: "6px" }}>Tailored for your needs</div>
                    </>
                  ) : plan.monthly === 0 ? (
                    <>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "28px", fontWeight: 700, color: "#fafafa", lineHeight: 1.1 }}>Free</div>
                      <div style={{ fontSize: "11px", color: "#52525b", marginTop: "6px" }}>No credit card required</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "28px", fontWeight: 700, color: "#fafafa", lineHeight: 1.1 }}>
                        {priceLabel}
                      </div>
                      <div style={{ fontSize: "11px", color: "#52525b", marginTop: "6px", height: "16px", overflow: "hidden" }}>
                        {subLabel}
                      </div>
                    </>
                  )}
                  {/* Trial row — always reserves same space */}
                  <div style={{ marginTop: "6px", height: "18px" }}>
                    {plan.id !== "free" && !plan.isContact && !isCurrentPlan && (
                      <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 500 }}>
                        7 days free
                      </span>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => !isDisabled && handleSubscribe(plan)}
                  disabled={isDisabled}
                  style={{
                    width: "100%",
                    padding: "11px",
                    borderRadius: "3px",
                    border: isCurrentPlan
                      ? "1px solid rgba(34,197,94,0.4)"
                      : isLowerPlan
                      ? "1px solid #1a1a1d"
                      : plan.highlighted ? "none" : `1px solid ${color}44`,
                    background: isCurrentPlan
                      ? "rgba(34,197,94,0.1)"
                      : isLowerPlan
                      ? "#0d0d0f"
                      : plan.highlighted ? (loading === plan.id ? "#a07830" : "#d4a843") : `${color}15`,
                    color: isCurrentPlan
                      ? "#22c55e"
                      : isLowerPlan
                      ? "#3f3f46"
                      : plan.highlighted ? "#09090b" : color,
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    marginBottom: "16px",
                    transition: "all 0.15s ease",
                    opacity: loading === plan.id ? 0.6 : 1,
                    letterSpacing: "0.02em",
                  }}
                >
                  {loading === plan.id
                    ? "Loading..."
                    : isCurrentPlan
                    ? "✓ Current plan"
                    : isLowerPlan
                    ? (billingInterval === "yearly" ? "Available at renewal" : "Downgrade")
                    : plan.id === "elite"
                    ? "Contact us →"
                    : plan.id === "free"
                    ? "Start free →"
                    : currentPlan && currentPlan !== "free"
                    ? "Upgrade →"
                    : "Get started →"
                  }
                </button>

                {/* Divider */}
                <div style={{ height: "1px", background: "#1a1a1d", marginBottom: "14px" }} />

                {/* Features */}
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      {f.ok ? (
                        <Check size={12} style={{ color: "#22c55e", flexShrink: 0, marginTop: "2px" }} />
                      ) : (
                        <X size={12} style={{ color: "#2a2a2a", flexShrink: 0, marginTop: "2px" }} />
                      )}
                      <span style={{ fontSize: "12px", color: f.ok ? "#d4d4d8" : "#3f3f46", lineHeight: 1.4 }}>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Trust signals */}
        <div style={{ marginTop: "56px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#3f3f46", marginBottom: "24px" }}>
            Secure payment by Stripe · Cancel anytime · 7 days free on paid plans
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "48px", flexWrap: "wrap" }}>
            {[
              { value: "1651+", label: "Live lots" },
              { value: "15min", label: "Scan cycle" },
              { value: "3",     label: "Sources" },
              { value: "7 days", label: "Free trial" },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "monospace", fontSize: "24px", fontWeight: 700, color: "#d4a843" }}>{value}</div>
                <div style={{ fontSize: "10px", color: "#52525b", marginTop: "4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: "960px", margin: "80px auto 0", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#d4a843", marginBottom: "12px" }}>FAQ</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "32px", color: "#fafafa" }}>Everything you need to know</h2>
          </div>
          <FaqSection />
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{
              background: "#111113",
              border: "1px solid #27272a",
              borderRadius: "8px",
              padding: "40px 36px",
              maxWidth: "440px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "20px" }}>
              {confirmModal.isUpgrade ? "⬆️" : "🔄"}
            </div>

            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: "#fafafa", marginBottom: "12px" }}>
              {confirmModal.isUpgrade ? "Upgrade your plan" : "Change your plan"}
            </h3>

            <p style={{ fontSize: "14px", color: "#71717a", lineHeight: 1.6, marginBottom: "8px" }}>
              You are switching to{" "}
              <strong style={{ color: "#fafafa", textTransform: "capitalize" }}>
                {confirmModal.plan.name}
              </strong>
              {" "}({billing === "yearly"
                ? `€${confirmModal.plan.yearly}/year`
                : `€${confirmModal.plan.monthly}/month`
              }).
            </p>

            {confirmModal.isUpgrade && currentPlan !== "free" && billingInterval === "yearly" && (
              <p style={{ fontSize: "12px", color: "#a1a1aa", lineHeight: 1.6, marginBottom: "8px" }}>
                You will be charged the prorated difference for your remaining months, then the full {confirmModal.plan.name} price at your next renewal.
              </p>
            )}

            {!isCurrentPlanPaid(currentPlan) && (
              <p style={{ fontSize: "12px", color: "#52525b", marginBottom: "24px" }}>
                7 days free — no charge until your trial ends.
              </p>
            )}

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  flex: 1, padding: "11px",
                  background: "transparent",
                  border: "1px solid #27272a",
                  borderRadius: "3px",
                  color: "#71717a",
                  fontSize: "13px", fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmCheckout}
                style={{
                  flex: 1, padding: "11px",
                  background: "#d4a843",
                  border: "none",
                  borderRadius: "3px",
                  color: "#09090b",
                  fontSize: "13px", fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Confirm →
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function isCurrentPlanPaid(plan: string | null): boolean {
  return plan !== null && plan !== "free";
}
