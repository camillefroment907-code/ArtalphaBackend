import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getSubscription } from "../../lib/api";
import { setUser, getUser } from "../../lib/auth";
import { useSEO } from "../../lib/useSEO";

const PLAN_LABELS: Record<string, string> = {
  starter: "Collector",
  investor: "Investor",
  pro: "Family Office",
  elite: "Institutional",
};

export default function BillingSuccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [plan, setPlan] = useState("");

  useSEO({ title: 'Subscription Confirmed · Nautilus', noindex: true });

  useEffect(() => {
    const sync = async () => {
      // Wait for Stripe webhook to process (3s gives the backend time to handle the event)
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const sub = await getSubscription();
        const user = getUser();
        if (user && sub.plan) {
          setUser({ ...user, plan: sub.plan as any });
        }
        setPlan(sub.plan || "");
        setStatus("success");
        setTimeout(() => navigate("/app/opportunities"), 4000);
      } catch {
        setStatus("error");
      }
    };
    sync();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: "480px", padding: "48px" }}>

        {status === "loading" && (
          <>
            <svg width="72" height="72" viewBox="0 0 100 100" style={{ animation: 'nautilusPulse 1.8s ease-in-out infinite', margin: '0 auto 24px', display: 'block' }}>
              <style>{`@keyframes nautilusPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:0.85}}`}</style>
              <ellipse cx="50" cy="60" rx="30" ry="24" fill="#2563EB" opacity="0.15"/>
              <ellipse cx="50" cy="58" rx="28" ry="22" fill="#2563EB" opacity="0.25"/>
              <path d="M22 58 Q18 35 35 26 Q52 16 68 32 Q80 44 72 60 Z" fill="#2563EB"/>
              <ellipse cx="50" cy="60" rx="28" ry="22" fill="#2563EB"/>
              <circle cx="38" cy="54" r="10" fill="white"/>
              <circle cx="62" cy="54" r="10" fill="white"/>
              <circle cx="72" cy="46" r="5" fill="white"/>
              <circle cx="39" cy="55" r="5" fill="#1A2A44"/>
              <circle cx="63" cy="55" r="5" fill="#1A2A44"/>
              <circle cx="72" cy="47" r="2.5" fill="#1A2A44"/>
              <path d="M43 67 Q50 72 57 67" stroke="#C6A85A" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            </svg>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "24px", color: "#1A1A1A", marginBottom: "8px" }}>
              Confirming your subscription…
            </h2>
            <p style={{ color: "#666" }}>Syncing with Stripe, please wait</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ width: "72px", height: "72px", background: "rgba(15,61,44,0.08)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "32px", color: "#1A2A44", fontWeight: 700 }}>
              ✓
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "32px", color: "#1A1A1A", marginBottom: "12px" }}>
              Welcome to Nautilus
            </h2>
            {plan && (
              <div style={{ display: "inline-block", padding: "4px 16px", background: "rgba(15,61,44,0.08)", color: "#1A2A44", borderRadius: "20px", fontSize: "13px", fontWeight: 600, marginBottom: "16px" }}>
                {PLAN_LABELS[plan] || plan} Plan Active
              </div>
            )}
            <p style={{ color: "#666", marginBottom: "8px", lineHeight: 1.7 }}>
              Your subscription is active. You now have access to the world's most undervalued artworks.
            </p>
            <p style={{ fontSize: "13px", color: "#9A9A9A", marginBottom: "32px" }}>
              Redirecting to your opportunities in a few seconds…
            </p>
            <button
              onClick={() => navigate("/app/opportunities")}
              style={{ padding: "13px 28px", background: "#1A2A44", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}
            >
              View My Opportunities →
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: "48px", marginBottom: "24px" }}>⚠️</div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "24px", color: "#1A1A1A", marginBottom: "12px" }}>
              Subscription sync failed
            </h2>
            <p style={{ color: "#666", marginBottom: "24px", lineHeight: 1.7 }}>
              Your payment was processed but we couldn't sync your plan. Please contact{" "}
              <a href="mailto:contact@get-nautilus.com" style={{ color: "#1A2A44" }}>contact@get-nautilus.com</a>
            </p>
            <button
              onClick={() => navigate("/app/opportunities")}
              style={{ padding: "12px 24px", background: "#1A1A1A", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
            >
              Go to Dashboard
            </button>
          </>
        )}

      </div>
    </div>
  );
}
