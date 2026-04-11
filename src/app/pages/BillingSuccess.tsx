import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getSubscription } from "../../lib/api";
import { setUser, getUser } from "../../lib/auth";

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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ textAlign: "center", maxWidth: "480px", padding: "48px" }}>

        {status === "loading" && (
          <>
            <div style={{ width: "48px", height: "48px", border: "3px solid #E5E5E5", borderTopColor: "#1A2A44", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 24px" }} />
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
              <a href="mailto:contact@artalpha.art" style={{ color: "#1A2A44" }}>contact@artalpha.art</a>
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
