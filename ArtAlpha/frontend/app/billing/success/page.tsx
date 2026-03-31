"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";

export default function BillingSuccessPage() {
  const router = useRouter();
  const [synced, setSynced] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    const sync = async () => {
      let token = "";
      try {
        for (const k of ["artalpha-auth", "hono-auth"]) {
          const s = localStorage.getItem(k);
          if (s) {
            const p = JSON.parse(s);
            token = p?.state?.token || p?.token || "";
            if (token) break;
          }
        }
      } catch {}

      if (!token) { setSynced(true); return; }

      try {
        const res = await fetch("/api/billing/sync-subscription", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        setPlan(d.plan);
        setSynced(true);
      } catch {
        setSynced(true);
      }
    };

    sync();
    const t = setTimeout(() => router.push("/dashboard"), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          textAlign: "center",
          background: "#111113",
          border: "1px solid #27272a",
          borderRadius: "8px",
          padding: "60px 48px",
          maxWidth: "440px",
          width: "100%",
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "rgba(34,197,94,0.15)",
            border: "2px solid #22c55e",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: "28px", color: "#22c55e",
          }}
        >
          ✓
        </motion.div>

        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", color: "#fafafa", marginBottom: "12px" }}>
          Welcome to ArtAlpha
        </div>

        {plan && plan !== "free" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.3)", borderRadius: "20px", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", color: "#d4a843", fontWeight: 700, textTransform: "capitalize" }}>
              {plan} plan activated
            </span>
          </div>
        )}

        <p style={{ color: "#71717a", fontSize: "14px", lineHeight: 1.6, marginBottom: "24px" }}>
          {synced
            ? "Your subscription is active. You now have full access."
            : "Activating your subscription..."
          }
        </p>

        <div style={{ fontSize: "12px", color: "#3f3f46", marginBottom: "20px" }}>
          Redirecting to dashboard in 6 seconds...
        </div>

        <Link href="/dashboard" style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          padding: "11px 24px", background: "#d4a843",
          borderRadius: "3px", color: "#09090b",
          fontSize: "14px", fontWeight: 600, textDecoration: "none",
        }}>
          Go to Dashboard →
        </Link>
      </motion.div>
    </div>
  );
}
