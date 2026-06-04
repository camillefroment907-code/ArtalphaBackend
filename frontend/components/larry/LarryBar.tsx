"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Cookies from "js-cookie";
import { X, Send, ChevronRight, Sparkles } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "larry";
  content: string;
  isStreaming?: boolean;
}

interface LarryUsage {
  remaining: number;
  limit: number;
  can_chat: boolean;
}

// ── Verdict ────────────────────────────────────────────────────────────────────
// Non-prescriptive: describes the opportunity, not the action to take.

function getVerdict(score?: number | null) {
  if (!score) return null;
  if (score >= 80) return { label: "FORT INTÉRÊT", color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" };
  if (score >= 65) return { label: "À SURVEILLER", color: "var(--gold)", bg: "var(--gold-subtle)", border: "rgba(201,168,76,0.2)" };
  if (score >= 50) return { label: "SIGNAL MODÉRÉ", color: "var(--text-secondary)", bg: "rgba(255,255,255,0.04)", border: "var(--border)" };
  return null;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return Cookies.get("hono_token") || (typeof window !== "undefined" ? localStorage.getItem("hono_token") : null);
}

// ── Chips ──────────────────────────────────────────────────────────────────────

const CHIPS_WITH_LOT = [
  "Pourquoi ce score ?",
  "Quels sont les risques ?",
  "Que ferais-tu à ma place ?",
];

const CHIPS_NO_LOT = [
  "Quoi regarder aujourd'hui ?",
  "Mon portefeuille est-il équilibré ?",
  "Y a-t-il des opportunités urgentes ?",
];

// ── Component ─────────────────────────────────────────────────────────────────

interface LarryBarProps {
  /** UUID of the lot currently in view. Passed to the API for contextual analysis. */
  lotId?: string;
  lotTitle?: string;
  artistName?: string;
  dealScore?: number;
  /** compact = inline bloc on a page | full = open drawer directly */
  mode?: "compact" | "full";
  /** Called when the drawer is closed (only relevant in full mode) */
  onClose?: () => void;
}

export function LarryBar({
  lotId,
  lotTitle,
  artistName,
  dealScore,
  mode = "compact",
  onClose,
}: LarryBarProps) {
  const [isOpen, setIsOpen]         = useState(mode === "full");

  const closeDrawer = () => {
    setIsOpen(false);
    onClose?.();
  };
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [usage, setUsage]           = useState<LarryUsage | null>(null);
  const [sessionId]                 = useState(() => typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36));
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  const verdict = getVerdict(dealScore);
  const chips   = lotId ? CHIPS_WITH_LOT : CHIPS_NO_LOT;

  // ── Fetch usage ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/copilot/usage", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUsage(d); })
      .catch(() => {});
  }, []);

  // ── Auto-scroll ──────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string, isAuto = false) => {
    const token = getToken();
    if (!token || isStreaming) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!isAuto) {
      setMessages(prev => [...prev, { role: "user", content: trimmed }]);
      setInput("");
    }

    setMessages(prev => [...prev, { role: "larry", content: "", isStreaming: true }]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/copilot/message", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: trimmed,
          session_id: sessionId,
          lot_id: lotId ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "larry", content: "Une erreur s'est produite. Réessaie dans un instant." };
          return next;
        });
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.delta) {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "larry") {
                  next[next.length - 1] = { ...last, content: last.content + parsed.delta };
                }
                return next;
              });
            }
            if (parsed.done || parsed.error) {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "larry") next[next.length - 1] = { ...last, isStreaming: false };
                return next;
              });
              if (!isAuto) {
                setUsage(u => u ? { ...u, remaining: Math.max(0, u.remaining - 1) } : u);
              }
            }
          } catch { /* ignore malformed SSE line */ }
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "larry") next[next.length - 1] = { role: "larry", content: "Connexion interrompue. Réessaie." };
        return next;
      });
    } finally {
      setIsStreaming(false);
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.isStreaming) next[next.length - 1] = { ...last, isStreaming: false };
        return next;
      });
    }
  }, [sessionId, lotId, isStreaming]);

  // ── Open Larry: trigger first message automatically ──────────────────────────

  useEffect(() => {
    if (!isOpen || hasAutoOpened || messages.length > 0) return;
    setHasAutoOpened(true);
    const prompt = lotId
      ? "Donne-moi ton verdict sur ce lot en tenant compte de mon profil et de mon budget."
      : "Qu'est-ce qui mérite mon attention aujourd'hui sur le marché ?";
    sendMessage(prompt, true);
  }, [isOpen, hasAutoOpened, messages.length, lotId, sendMessage]);

  // ── Focus on open ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen]);

  // ── Keyboard shortcut (Escape) ───────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) closeDrawer(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // ── Render helpers ────────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const canSend = !isStreaming && input.trim().length > 0 && (usage?.can_chat ?? true);

  // ── COMPACT BLOC ──────────────────────────────────────────────────────────────

  if (!isOpen) {
    return (
      <div style={{
        background: "var(--carbon)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "var(--gold)", fontSize: "14px", fontWeight: 700, letterSpacing: "0.02em" }}>◆ LARRY</span>
            {verdict && (
              <span style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: verdict.color,
                background: verdict.bg,
                border: `1px solid ${verdict.border}`,
                borderRadius: "3px",
                padding: "2px 8px",
              }}>
                {verdict.label}
              </span>
            )}
            {dealScore && (
              <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-muted)" }}>
                {Math.round(dealScore)}/100
              </span>
            )}
          </div>

          <button
            onClick={() => setIsOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--gold)",
              background: "var(--gold-subtle)",
              border: "1px solid rgba(201,168,76,0.2)",
              borderRadius: "4px",
              padding: "5px 12px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              letterSpacing: "0.02em",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(201,168,76,0.14)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--gold-subtle)"; }}
          >
            Ouvrir Larry <ChevronRight size={12} />
          </button>
        </div>

        {/* Context line */}
        {(artistName || lotTitle) && (
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {artistName && <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{artistName}</span>}
            {artistName && lotTitle && <span style={{ color: "var(--text-ghost)", margin: "0 6px" }}>—</span>}
            {lotTitle && <span>{lotTitle.length > 60 ? lotTitle.slice(0, 60) + "…" : lotTitle}</span>}
          </div>
        )}

        {/* Chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {chips.map(chip => (
            <button
              key={chip}
              onClick={() => {
                setIsOpen(true);
                // The chip message will fire after the drawer opens via sendMessage
                // We store it so the auto-open effect picks it up
                setTimeout(() => sendMessage(chip), 300);
              }}
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                padding: "6px 12px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.color = "var(--text-primary)";
                b.style.borderColor = "rgba(201,168,76,0.3)";
                b.style.background = "var(--gold-subtle)";
              }}
              onMouseLeave={e => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.color = "var(--text-secondary)";
                b.style.borderColor = "var(--border)";
                b.style.background = "rgba(255,255,255,0.04)";
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── DRAWER ─────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 49,
          animation: "fadeIn 0.15s ease",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: "min(480px, 100vw)",
        background: "var(--carbon)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
        animation: "slideInRight 0.2s ease",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flexShrink: 0,
          background: "var(--obsidian)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "var(--gold)", fontSize: "15px", fontWeight: 700, letterSpacing: "0.02em" }}>◆ LARRY</span>
              {verdict && (
                <span style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: verdict.color,
                  background: verdict.bg,
                  border: `1px solid ${verdict.border}`,
                  borderRadius: "3px",
                  padding: "2px 8px",
                }}>
                  {verdict.label}
                </span>
              )}
            </div>
            <button
              onClick={closeDrawer}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                padding: "5px",
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
              title="Fermer (Échap)"
            >
              <X size={14} />
            </button>
          </div>

          {/* Lot context pill */}
          {(artistName || lotTitle) && (
            <div style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
              <Sparkles size={10} style={{ color: "var(--gold-dim)", flexShrink: 0 }} />
              <span>
                {artistName && <span style={{ color: "var(--text-secondary)" }}>{artistName}</span>}
                {artistName && lotTitle && " — "}
                {lotTitle && (lotTitle.length > 50 ? lotTitle.slice(0, 50) + "…" : lotTitle)}
              </span>
            </div>
          )}
        </div>

        {/* ── Messages ── */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}>
          {messages.length === 0 && (
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "28px", marginBottom: "12px", opacity: 0.3 }}>◆</div>
                Larry analyse…
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {msg.role === "larry" && (
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "var(--gold-dim)" }}>
                  LARRY
                </span>
              )}
              <div style={{
                maxWidth: "85%",
                padding: "12px 14px",
                borderRadius: msg.role === "user" ? "10px 10px 3px 10px" : "3px 10px 10px 10px",
                background: msg.role === "user"
                  ? "rgba(201,168,76,0.1)"
                  : "var(--graphite)",
                border: `1px solid ${msg.role === "user" ? "rgba(201,168,76,0.2)" : "var(--border)"}`,
                fontSize: "13px",
                lineHeight: "1.6",
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
              }}>
                {msg.content || (msg.isStreaming ? (
                  <span style={{ display: "inline-flex", gap: "3px", alignItems: "center" }}>
                    <span style={{ animation: "blink 1s infinite 0s", opacity: 0.6 }}>●</span>
                    <span style={{ animation: "blink 1s infinite 0.2s", opacity: 0.6 }}>●</span>
                    <span style={{ animation: "blink 1s infinite 0.4s", opacity: 0.6 }}>●</span>
                  </span>
                ) : "")}
                {msg.isStreaming && msg.content && (
                  <span style={{ display: "inline-block", width: "2px", height: "14px", background: "var(--gold)", marginLeft: "2px", animation: "blink 0.8s infinite", verticalAlign: "text-bottom" }} />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Chips ── */}
        {messages.filter(m => m.role === "larry" && !m.isStreaming && m.content).length > 0 && (
          <div style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            flexShrink: 0,
            background: "var(--obsidian)",
          }}>
            {chips.map(chip => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                disabled={isStreaming}
                style={{
                  fontSize: "11px",
                  color: isStreaming ? "var(--text-ghost)" : "var(--text-muted)",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "5px 10px",
                  cursor: isStreaming ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => {
                  if (!isStreaming) {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.color = "var(--text-primary)";
                    b.style.borderColor = "rgba(201,168,76,0.3)";
                    b.style.background = "var(--gold-subtle)";
                  }
                }}
                onMouseLeave={e => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.color = "var(--text-muted)";
                  b.style.borderColor = "var(--border)";
                  b.style.background = "rgba(255,255,255,0.03)";
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* ── Input ── */}
        <div style={{
          padding: "12px 20px 16px",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
          background: "var(--obsidian)",
        }}>
          <div style={{
            display: "flex",
            gap: "8px",
            alignItems: "flex-end",
            background: "var(--graphite)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "10px 12px",
            transition: "border-color 0.15s ease",
          }}
            onFocus={() => {}}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pose une question à Larry…"
              rows={1}
              disabled={isStreaming || (usage !== null && !usage.can_chat)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "13px",
                lineHeight: "1.5",
                resize: "none",
                fontFamily: "inherit",
                maxHeight: "120px",
                overflowY: "auto",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!canSend}
              style={{
                background: canSend ? "var(--gold)" : "var(--graphite)",
                border: "none",
                borderRadius: "4px",
                padding: "6px 8px",
                cursor: canSend ? "pointer" : "not-allowed",
                color: canSend ? "#09090b" : "var(--text-ghost)",
                display: "flex",
                alignItems: "center",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
            >
              <Send size={13} />
            </button>
          </div>

          {/* Usage counter */}
          {usage && usage.limit < 99999 && (
            <div style={{
              marginTop: "8px",
              textAlign: "right",
              fontSize: "10px",
              color: usage.remaining <= 3 ? "var(--gold)" : "var(--text-muted)",
              fontFamily: "monospace",
            }}>
              {usage.remaining} message{usage.remaining !== 1 ? "s" : ""} restant{usage.remaining !== 1 ? "s" : ""} ce mois
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn     { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes blink      { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>
    </>
  );
}
