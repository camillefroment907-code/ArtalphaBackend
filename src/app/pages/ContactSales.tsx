import { useState, FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";

export default function ContactSales() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan") || "institutional";

  const [form, setForm] = useState({
    name: "", email: "", company: "", employees: "", budget: "", message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    const API = import.meta.env.VITE_API_URL || "https://artalpha-backend-production.up.railway.app";
    const payload = { ...form, plan, source: "pricing_institutional" };

    try {
      const res = await fetch(`${API}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (!res || !res.ok) {
        const subject = encodeURIComponent(`Nautilus Institutional Inquiry — ${form.company}`);
        const body = encodeURIComponent(
          `Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company}\nType: ${form.employees}\nBudget: ${form.budget}\n\nMessage:\n${form.message}`
        );
        window.open(`mailto:contact@get-nautilus.com?subject=${subject}&body=${body}`);
      }

      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", border: "1px solid #E5E5E5",
    borderRadius: "6px", fontSize: "14px", outline: "none",
    background: "#FAFAF8", boxSizing: "border-box",
    fontFamily: "Inter, sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "11px", fontWeight: 700, color: "#666",
    letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px",
  };
  const focusGreen = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = "#1A2A44");
  const blurGrey = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = "#E5E5E5");

  if (status === "sent") {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "480px", padding: "48px" }}>
          <div style={{ fontSize: "48px", marginBottom: "24px" }}>✉️</div>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", color: "#1A1A1A", marginBottom: "12px" }}>
            Message received
          </h2>
          <p style={{ color: "#666", lineHeight: 1.7, marginBottom: "32px" }}>
            Thank you for your interest in Nautilus Institutional. Our team will contact you within 24 hours.
          </p>
          <button
            onClick={() => navigate("/pricing")}
            style={{ padding: "12px 28px", background: "#1A2A44", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
          >
            Back to Pricing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
      <div style={{ width: "100%", maxWidth: "600px" }}>

        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#A38B4A", marginBottom: "12px" }}>
            Institutional Access
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "32px", fontWeight: 600, color: "#1A1A1A", marginBottom: "12px" }}>
            Let's talk
          </h1>
          <p style={{ fontSize: "15px", color: "#666", lineHeight: 1.7, maxWidth: "440px", margin: "0 auto" }}>
            Custom pricing for auction houses, family offices, wealth managers and art funds. We'll build a plan around your needs.
          </p>
        </div>

        <div style={{ background: "white", border: "1px solid #E5E5E5", borderRadius: "12px", padding: "40px", boxShadow: "0 2px 16px rgba(0,0,0,0.04)" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input required type="text" value={form.name} onChange={set("name")} placeholder="Alexandre Dupont" style={inputStyle} onFocus={focusGreen} onBlur={blurGrey} />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input required type="email" value={form.email} onChange={set("email")} placeholder="a.dupont@family-office.com" style={inputStyle} onFocus={focusGreen} onBlur={blurGrey} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Company / Organization *</label>
              <input required type="text" value={form.company} onChange={set("company")} placeholder="Dupont Family Office" style={inputStyle} onFocus={focusGreen} onBlur={blurGrey} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Organization Type</label>
                <select value={form.employees} onChange={set("employees")} style={{ ...inputStyle, appearance: "none" as any }} onFocus={focusGreen} onBlur={blurGrey}>
                  <option value="">Select type</option>
                  <option value="family_office">Family Office</option>
                  <option value="auction_house">Auction House</option>
                  <option value="wealth_manager">Wealth Manager</option>
                  <option value="art_fund">Art Fund</option>
                  <option value="gallery">Gallery</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Annual Art Budget</label>
                <select value={form.budget} onChange={set("budget")} style={{ ...inputStyle, appearance: "none" as any }} onFocus={focusGreen} onBlur={blurGrey}>
                  <option value="">Select range</option>
                  <option value="100k-500k">€100K – €500K</option>
                  <option value="500k-1m">€500K – €1M</option>
                  <option value="1m-5m">€1M – €5M</option>
                  <option value="5m+">€5M+</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>What are you looking for?</label>
              <textarea
                value={form.message}
                onChange={set("message")}
                placeholder="Describe your use case, team size, integration needs, or any specific requirements…"
                rows={4}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                onFocus={focusGreen}
                onBlur={blurGrey}
              />
            </div>

            {status === "error" && (
              <div style={{ padding: "12px 16px", background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: "6px", fontSize: "13px", color: "#C0392B" }}>
                Something went wrong. Please email us at{" "}
                <a href="mailto:contact@get-nautilus.com" style={{ color: "#C0392B", fontWeight: 600 }}>contact@get-nautilus.com</a>
              </div>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              style={{ padding: "14px", background: "#1A2A44", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: status === "sending" ? "not-allowed" : "pointer", letterSpacing: "0.06em", textTransform: "uppercase", opacity: status === "sending" ? 0.7 : 1, transition: "all 0.15s ease" }}
              onMouseEnter={(e) => { if (status !== "sending") (e.currentTarget as HTMLButtonElement).style.background = "#1A2A44"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1A2A44"; }}
            >
              {status === "sending" ? "Sending…" : "Send Message →"}
            </button>

            <p style={{ textAlign: "center", fontSize: "12px", color: "#9A9A9A" }}>
              We respond within 24 hours · contact@get-nautilus.com
            </p>
          </form>
        </div>

      </div>
    </div>
  );
}
