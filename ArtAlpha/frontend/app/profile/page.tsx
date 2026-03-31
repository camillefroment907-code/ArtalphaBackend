"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User, CreditCard, Bell, Shield, TrendingUp,
  LogOut, ChevronRight, Check, Edit3, Save, X,
} from "lucide-react";

const PLAN_COLORS: Record<string, string> = {
  free: "#71717a", starter: "#3b82f6",
  investor: "#d4a843", pro: "#a78bfa", elite: "#f59e0b",
};
const PLAN_LABELS: Record<string, string> = {
  free: "Free", starter: "Starter",
  investor: "Investor", pro: "Pro", elite: "Elite",
};

const CATEGORIES = ["Paintings", "Sculptures", "Drawings", "Prints", "Photography", "Asian Art", "Jewelry", "Furniture", "Books"];
const PERIODS = ["Ancient", "Medieval", "Renaissance", "17th–18th c.", "19th century", "Modern (1900–1960)", "Contemporary (1960+)"];
const REGIONS = ["France", "Europe", "Americas", "Asia", "Middle East", "Africa", "International"];
const COLLECTOR_TYPES = [
  { value: "occasional", label: "Occasional buyer", sub: "1–3 acquisitions/year" },
  { value: "active", label: "Active collector", sub: "4–12 acquisitions/year" },
  { value: "professional", label: "Professional investor", sub: "Art as asset class" },
  { value: "institution", label: "Institution / Gallery", sub: "Portfolio management" },
];
const HORIZONS = [
  { value: "short", label: "Short term", sub: "< 3 years" },
  { value: "medium", label: "Medium term", sub: "3–10 years" },
  { value: "long", label: "Long term", sub: "> 10 years" },
];

function getToken(): string {
  try {
    for (const k of ["artalpha-auth", "hono-auth"]) {
      const s = localStorage.getItem(k);
      if (s) {
        const p = JSON.parse(s);
        const t = p?.state?.token || p?.token;
        if (t) return t;
      }
    }
  } catch {}
  return "";
}

type Tab = "overview" | "investor" | "preferences" | "notifications" | "subscription" | "security";

export default function ProfilePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push("/auth/login"); return; }

    fetch("/api/profile/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setProfile(d);
        setForm({
          full_name: d.full_name || "",
          phone: d.phone || "",
          collector_type: d.collector_type || "",
          annual_budget_eur: d.annual_budget_eur || "",
          min_lot_budget_eur: d.min_lot_budget_eur || "",
          max_lot_budget_eur: d.max_lot_budget_eur || "",
          investment_horizon: d.investment_horizon || "",
          preferred_categories: d.preferred_categories || [],
          preferred_periods: d.preferred_periods || [],
          preferred_regions: d.preferred_regions || [],
          min_deal_score: d.min_deal_score || 70,
          notify_email: d.notify_email ?? true,
          notify_sms: d.notify_sms ?? false,
          alert_email: d.alert_email || d.email || "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    const token = getToken();
    try {
      await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      setProfile((p) => ({ ...p, ...form }));
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const logout = () => {
    try {
      for (const k of ["artalpha-auth", "hono-auth"]) localStorage.removeItem(k);
    } catch {}
    router.push("/auth/login");
  };

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#52525b", fontSize: "14px" }}>Loading...</div>
      </div>
    );
  }

  const planKey = (profile?.plan || "free").toLowerCase();
  const planColor = PLAN_COLORS[planKey] || "#71717a";

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",      label: "Overview" },
    { id: "investor",      label: "Investor Profile" },
    { id: "preferences",   label: "Art Preferences" },
    { id: "notifications", label: "Alerts" },
    { id: "subscription",  label: "Subscription" },
    { id: "security",      label: "Security" },
  ];

  const inputStyle = {
    background: "#18181b", border: "1px solid #27272a", borderRadius: "3px",
    color: "#fafafa", fontSize: "13px", padding: "8px 12px", outline: "none", width: "100%",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0b" }}>
      {/* Top bar */}
      <div style={{ height: "52px", borderBottom: "1px solid #27272a", display: "flex", alignItems: "center", padding: "0 24px", gap: "16px", position: "sticky", top: 0, background: "#0a0a0b", zIndex: 30 }}>
        <Link href="/dashboard" style={{ fontFamily: "'Playfair Display', serif", fontSize: "14px", fontWeight: 600, color: "#fafafa", textDecoration: "none" }}>
          ← Dashboard
        </Link>
        <div style={{ fontSize: "14px", color: "#3f3f46" }}>/</div>
        <div style={{ fontSize: "14px", color: "#71717a" }}>My Account</div>
        <div style={{ flex: 1 }} />
        {saved && (
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#22c55e" }}>
            <Check size={12} /> Saved
          </motion.div>
        )}
        <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "1px solid #27272a", borderRadius: "3px", padding: "6px 12px", color: "#71717a", fontSize: "12px", cursor: "pointer" }}>
          <LogOut size={12} /> Sign out
        </button>
      </div>

      <div style={{ display: "flex", maxWidth: "1100px", margin: "0 auto", padding: "32px 24px", gap: "32px" }}>
        {/* Sidebar */}
        <div style={{ width: "200px", flexShrink: 0 }}>
          {/* Avatar card */}
          <div style={{ textAlign: "center", marginBottom: "16px", padding: "20px 16px", background: "#111113", border: "1px solid #27272a", borderRadius: "6px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: `linear-gradient(135deg, ${planColor}, ${planColor}88)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: "22px", fontWeight: 700, color: "#09090b", fontFamily: "serif" }}>
              {(profile?.full_name || profile?.email || "?")[0].toUpperCase()}
            </div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#fafafa", marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.full_name || profile?.email?.split("@")[0]}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 10px", background: `${planColor}18`, border: `1px solid ${planColor}44`, borderRadius: "10px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: planColor }} />
              <span style={{ fontSize: "10px", fontWeight: 700, color: planColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {PLAN_LABELS[planKey] || "Free"}
              </span>
            </div>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center",
                padding: "9px 12px", borderRadius: "3px", border: "none",
                background: tab === t.id ? "rgba(212,168,67,0.1)" : "transparent",
                borderLeft: tab === t.id ? "2px solid #d4a843" : "2px solid transparent",
                color: tab === t.id ? "#d4a843" : "#71717a",
                fontSize: "13px", fontWeight: tab === t.id ? 600 : 400,
                cursor: "pointer", textAlign: "left", width: "100%",
                transition: "all 0.1s ease",
              }}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: "#fafafa" }}>Profile</h2>
                {!editing
                  ? <button onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", background: "transparent", border: "1px solid #27272a", borderRadius: "3px", color: "#71717a", fontSize: "12px", cursor: "pointer" }}>
                      <Edit3 size={12} /> Edit
                    </button>
                  : <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => setEditing(false)} style={{ padding: "7px 10px", background: "transparent", border: "1px solid #27272a", borderRadius: "3px", color: "#71717a", fontSize: "12px", cursor: "pointer" }}>
                        <X size={12} />
                      </button>
                      <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", background: "#d4a843", border: "none", borderRadius: "3px", color: "#09090b", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                        <Save size={12} />{saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                }
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
                {[
                  { label: "Portfolio", value: profile?.portfolio_count ?? 0, unit: "artworks" },
                  { label: "Watchlist", value: profile?.watchlist_count ?? 0, unit: "lots" },
                  { label: "Member since", value: profile?.created_at ? new Date(profile.created_at).getFullYear() : "—", unit: "" },
                ].map(({ label, value, unit }) => (
                  <div key={label} style={{ padding: "16px 20px", background: "#111113", border: "1px solid #27272a", borderRadius: "4px" }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.15em", color: "#52525b", textTransform: "uppercase", marginBottom: "8px" }}>{label}</div>
                    <div style={{ fontFamily: "monospace", fontSize: "28px", fontWeight: 700, color: "#fafafa", lineHeight: 1 }}>{value}</div>
                    {unit && <div style={{ fontSize: "11px", color: "#52525b", marginTop: "4px" }}>{unit}</div>}
                  </div>
                ))}
              </div>

              {/* Fields */}
              <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: "4px", overflow: "hidden" }}>
                {[
                  { label: "Full name", field: "full_name", placeholder: "Your name", readonly: false },
                  { label: "Email", field: "email", placeholder: "", readonly: true },
                  { label: "Phone", field: "phone", placeholder: "+33 6 xx xx xx xx", readonly: false },
                ].map(({ label, field, placeholder, readonly }, i, arr) => (
                  <div key={field} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < arr.length - 1 ? "1px solid #1a1a1d" : "none" }}>
                    <div style={{ width: "140px", fontSize: "12px", color: "#52525b", flexShrink: 0 }}>{label}</div>
                    {editing && !readonly
                      ? <input
                          value={form[field] || ""}
                          onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                          placeholder={placeholder}
                          style={{ ...inputStyle, width: "auto", flex: 1 }}
                          onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#d4a843"}
                          onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#27272a"}
                        />
                      : <div style={{ fontSize: "13px", color: readonly ? "#52525b" : "#fafafa" }}>
                          {profile?.[field] || <span style={{ color: "#3f3f46" }}>Not set</span>}
                        </div>
                    }
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── INVESTOR PROFILE ── */}
          {tab === "investor" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: "#fafafa" }}>Investor Profile</h2>
                <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", background: "#d4a843", border: "none", borderRadius: "3px", color: "#09090b", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  <Save size={13} />{saving ? "Saving..." : "Save changes"}
                </button>
              </div>

              {/* Collector type */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "#52525b", textTransform: "uppercase", marginBottom: "12px" }}>Collector type</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {COLLECTOR_TYPES.map(ct => (
                    <button key={ct.value} onClick={() => setForm(p => ({ ...p, collector_type: ct.value }))}
                      style={{ padding: "14px 16px", background: form.collector_type === ct.value ? "rgba(212,168,67,0.1)" : "#111113", border: `1px solid ${form.collector_type === ct.value ? "#d4a843" : "#27272a"}`, borderRadius: "4px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: form.collector_type === ct.value ? "#d4a843" : "#fafafa", marginBottom: "3px" }}>{ct.label}</div>
                      <div style={{ fontSize: "11px", color: "#52525b" }}>{ct.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Budget */}
              <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: "4px", overflow: "hidden", marginBottom: "24px" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #1a1a1d" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#52525b", textTransform: "uppercase", marginBottom: "10px" }}>Annual acquisition budget</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "16px", color: "#71717a" }}>€</span>
                    <input type="number" value={form.annual_budget_eur || ""} onChange={e => setForm(p => ({ ...p, annual_budget_eur: Number(e.target.value) }))}
                      placeholder="e.g. 50000"
                      style={{ flex: 1, background: "#18181b", border: "1px solid #27272a", borderRadius: "3px", color: "#fafafa", fontSize: "16px", fontFamily: "monospace", padding: "8px 12px", outline: "none" }}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#d4a843"}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#27272a"}
                    />
                    <span style={{ fontSize: "12px", color: "#52525b" }}>/ year</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  {[
                    { label: "Min per lot", field: "min_lot_budget_eur", placeholder: "500" },
                    { label: "Max per lot", field: "max_lot_budget_eur", placeholder: "20000" },
                  ].map(({ label, field, placeholder }, i) => (
                    <div key={field} style={{ padding: "14px 20px", borderRight: i === 0 ? "1px solid #1a1a1d" : "none" }}>
                      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#52525b", textTransform: "uppercase", marginBottom: "8px" }}>{label}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "14px", color: "#71717a" }}>€</span>
                        <input type="number" value={form[field] || ""} onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))}
                          placeholder={placeholder}
                          style={{ flex: 1, background: "#18181b", border: "1px solid #27272a", borderRadius: "3px", color: "#fafafa", fontSize: "14px", fontFamily: "monospace", padding: "6px 10px", outline: "none" }}
                          onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#d4a843"}
                          onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#27272a"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Investment horizon */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "#52525b", textTransform: "uppercase", marginBottom: "12px" }}>Investment horizon</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {HORIZONS.map(h => (
                    <button key={h.value} onClick={() => setForm(p => ({ ...p, investment_horizon: h.value }))}
                      style={{ flex: 1, padding: "14px", background: form.investment_horizon === h.value ? "rgba(212,168,67,0.1)" : "#111113", border: `1px solid ${form.investment_horizon === h.value ? "#d4a843" : "#27272a"}`, borderRadius: "4px", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: form.investment_horizon === h.value ? "#d4a843" : "#fafafa", marginBottom: "3px" }}>{h.label}</div>
                      <div style={{ fontSize: "11px", color: "#52525b" }}>{h.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Min deal score */}
              <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: "4px", padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#52525b", textTransform: "uppercase" }}>Minimum deal score for alerts</div>
                  <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: 700, color: "#d4a843" }}>{form.min_deal_score}/100</div>
                </div>
                <input type="range" min={50} max={95} step={5} value={form.min_deal_score || 70}
                  onChange={e => setForm(p => ({ ...p, min_deal_score: Number(e.target.value) }))}
                  style={{ width: "100%", accentColor: "#d4a843" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#3f3f46", marginTop: "4px" }}>
                  <span>50 — Any</span><span>70 — Good</span><span>80 — Hot</span><span>95 — Fire</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── ART PREFERENCES ── */}
          {tab === "preferences" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: "#fafafa" }}>Art Preferences</h2>
                <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", background: "#d4a843", border: "none", borderRadius: "3px", color: "#09090b", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  <Save size={13} />{saving ? "Saving..." : "Save changes"}
                </button>
              </div>

              {[
                { label: "Art categories", field: "preferred_categories", options: CATEGORIES },
                { label: "Art periods", field: "preferred_periods", options: PERIODS },
                { label: "Geographic regions", field: "preferred_regions", options: REGIONS },
              ].map(({ label, field, options }) => (
                <div key={field} style={{ marginBottom: "24px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "#52525b", textTransform: "uppercase", marginBottom: "12px" }}>{label}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {options.map(opt => {
                      const selected = (form[field] || []).includes(opt);
                      return (
                        <button key={opt}
                          onClick={() => setForm(p => ({ ...p, [field]: toggleArray(p[field] || [], opt) }))}
                          style={{ padding: "7px 14px", background: selected ? "rgba(212,168,67,0.12)" : "#111113", border: `1px solid ${selected ? "#d4a843" : "#27272a"}`, borderRadius: "20px", color: selected ? "#d4a843" : "#71717a", fontSize: "12px", fontWeight: selected ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                          {selected && "✓ "}{opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab === "notifications" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: "#fafafa" }}>Alerts &amp; Notifications</h2>
                <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", background: "#d4a843", border: "none", borderRadius: "3px", color: "#09090b", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  <Save size={13} />{saving ? "Saving..." : "Save"}
                </button>
              </div>

              <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: "4px", overflow: "hidden", marginBottom: "20px" }}>
                {[
                  { field: "notify_email", label: "Email alerts", sub: "Receive deal alerts by email", available: true },
                  { field: "notify_sms", label: "SMS alerts", sub: "Coming soon", available: false },
                ].map(({ field, label, sub, available }, i) => (
                  <div key={field} style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: i === 0 ? "1px solid #1a1a1d" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: available ? "#fafafa" : "#52525b" }}>{label}</div>
                      <div style={{ fontSize: "11px", color: "#52525b", marginTop: "2px" }}>{sub}</div>
                    </div>
                    <div
                      onClick={() => available && setForm(p => ({ ...p, [field]: !p[field] }))}
                      style={{ width: "40px", height: "22px", borderRadius: "11px", background: form[field] && available ? "#d4a843" : "#27272a", cursor: available ? "pointer" : "not-allowed", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                    >
                      <div style={{ position: "absolute", top: "3px", left: form[field] && available ? "21px" : "3px", width: "16px", height: "16px", background: "white", borderRadius: "50%", transition: "left 0.2s" }} />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#52525b", textTransform: "uppercase", marginBottom: "8px" }}>Alert email address</div>
                <input type="email" value={form.alert_email || ""} onChange={e => setForm(p => ({ ...p, alert_email: e.target.value }))}
                  placeholder="your@email.com"
                  style={{ background: "#111113", border: "1px solid #27272a", borderRadius: "3px", color: "#fafafa", fontSize: "13px", padding: "10px 14px", outline: "none", width: "100%" }}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#d4a843"}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = "#27272a"}
                />
              </div>
            </motion.div>
          )}

          {/* ── SUBSCRIPTION ── */}
          {tab === "subscription" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: "#fafafa", marginBottom: "24px" }}>Subscription &amp; Billing</h2>

              {/* Current plan card */}
              <div style={{ background: "#111113", border: `1px solid ${planColor}44`, borderRadius: "4px", padding: "24px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", color: "#52525b", textTransform: "uppercase", marginBottom: "6px" }}>Current plan</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", color: "#fafafa" }}>{PLAN_LABELS[planKey] || "Free"}</div>
                      <div style={{ padding: "3px 10px", background: `${planColor}18`, border: `1px solid ${planColor}44`, borderRadius: "10px", fontSize: "11px", fontWeight: 700, color: planColor }}>
                        {profile?.plan_status === "trialing" ? "Trial" : "Active"}
                      </div>
                    </div>
                  </div>
                  <Link href="/pricing" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", background: "#d4a843", borderRadius: "3px", color: "#09090b", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
                    {profile?.plan === "free" ? "Upgrade →" : "Change plan →"}
                  </Link>
                </div>

                {profile?.current_period_end && (
                  <div style={{ fontSize: "12px", color: "#52525b" }}>
                    {profile?.cancel_at_period_end
                      ? `⚠️ Cancels on ${new Date(profile.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                      : `Renews ${new Date(profile.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                    }
                    {profile?.billing_interval && (
                      <span style={{ marginLeft: "12px", padding: "1px 8px", background: "#18181b", borderRadius: "3px", fontSize: "10px", textTransform: "capitalize" }}>
                        {profile.billing_interval}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stripe portal */}
              {planKey !== "free" && (
                <div style={{ marginBottom: "20px" }}>
                  <button
                    onClick={async () => {
                      const token = getToken();
                      const res = await fetch("/api/billing/create-portal-session", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                      const d = await res.json();
                      if (d.portal_url) window.location.href = d.portal_url;
                    }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "16px 20px", background: "#111113", border: "1px solid #27272a", borderRadius: "4px", color: "#fafafa", fontSize: "13px", cursor: "pointer", textAlign: "left" }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>Invoices &amp; payment method</div>
                      <div style={{ fontSize: "11px", color: "#52525b", marginTop: "2px" }}>Manage via Stripe secure portal</div>
                    </div>
                    <ChevronRight size={14} style={{ color: "#52525b" }} />
                  </button>
                </div>
              )}

              {/* Cancel */}
              {planKey !== "free" && !profile?.cancel_at_period_end && (
                <div style={{ padding: "16px 20px", background: "#0d0d0f", border: "1px solid #1a1a1d", borderRadius: "4px" }}>
                  <div style={{ fontSize: "13px", color: "#52525b", marginBottom: "12px" }}>
                    Want to cancel? You&apos;ll keep access until the end of your {profile?.billing_interval || "billing"} period.
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm("Cancel your subscription? You'll keep access until the end of your current period.")) return;
                      const token = getToken();
                      const res = await fetch("/api/billing/cancel-subscription", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                      const d = await res.json();
                      if (d.cancelled) {
                        setProfile(p => p ? ({ ...p, cancel_at_period_end: true }) : p);
                      }
                    }}
                    style={{ fontSize: "12px", color: "#ef4444", background: "none", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "3px", padding: "7px 14px", cursor: "pointer" }}
                  >
                    Cancel subscription
                  </button>
                </div>
              )}

              {planKey !== "free" && profile?.cancel_at_period_end && (
                <div style={{ padding: "16px 20px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "13px", color: "#71717a" }}>Cancellation scheduled. Want to keep your plan?</div>
                  <button
                    onClick={async () => {
                      const token = getToken();
                      const res = await fetch("/api/billing/reactivate-subscription", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                      const d = await res.json();
                      if (d.reactivated) setProfile(p => p ? ({ ...p, cancel_at_period_end: false }) : p);
                    }}
                    style={{ fontSize: "12px", color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "3px", padding: "7px 14px", cursor: "pointer" }}
                  >
                    Reactivate →
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── SECURITY ── */}
          {tab === "security" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", color: "#fafafa", marginBottom: "24px" }}>Security</h2>

              <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a1d" }}>
                  <div style={{ fontSize: "12px", color: "#52525b", marginBottom: "4px" }}>Email address</div>
                  <div style={{ fontSize: "14px", color: "#fafafa" }}>{profile?.email}</div>
                </div>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a1d" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "#52525b", marginBottom: "4px" }}>Password</div>
                      <div style={{ fontSize: "14px", color: "#fafafa" }}>••••••••••••</div>
                    </div>
                    <button style={{ fontSize: "12px", color: "#d4a843", background: "none", border: "none", cursor: "pointer" }}>
                      Change password →
                    </button>
                  </div>
                </div>
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: "12px", color: "#52525b", marginBottom: "8px" }}>Session</div>
                  <button
                    onClick={logout}
                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 16px", background: "transparent", border: "1px solid #27272a", borderRadius: "3px", color: "#71717a", fontSize: "13px", cursor: "pointer" }}
                  >
                    <LogOut size={13} /> Sign out of all sessions
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}
