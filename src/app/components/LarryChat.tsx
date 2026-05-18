import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getPlanLimits, getToken, getUserPlan } from '../../lib/auth';
import { LarryFace } from './Larry';
import type { LarryVariant } from './Larry';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface Usage {
  used: number;
  limit: number;
  plan: string;
  can_chat: boolean;
}

interface LarryChatProps {
  lotId?: string;
}

const API = 'https://artalpha-backend-production.up.railway.app';

function renderWithLinks(text: string) {
  const urlRegex = /(https:\/\/(?:www\.)?get-nautilus\.com\S*)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    part.match(/^https:\/\/(?:www\.)?get-nautilus\.com/)
      ? <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: '#C6A85A', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
      : part
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let _counter = 0;
function uid() { return `m-${++_counter}-${Date.now()}`; }

const QUICK_ACTIONS = [
  { label: 'Max bid?',  msg: 'What is the maximum I should bid on this lot including buyer premium? Lead with a single number in euros.' },
  { label: 'Worth it?', msg: 'Is this lot worth buying at current price? Answer YES or NO then one reason.' },
  { label: 'Key risk?', msg: 'What is the single biggest risk with this lot? One sentence.' },
  { label: 'Exit?',     msg: 'When and how should I resell? Give timeframe and target price.' },
];

const cleanLarry = (text: string) =>
  text
    .replace(/\s*—\s*Larry[\s\S]*$/im, '')
    .replace(/\[FORTE\]|\[MODÉRÉE\]|\[FAIBLE\]|\[FORTE \]|\[MODÉRÉ\]/gi, '')
    .replace(/—\s*Larry/gi, '')
    .trim();

export function LarryChat({ lotId: existingLotId }: LarryChatProps) {
  const { t } = useTranslation();
  const getCurrentLotId = () => {
    const path = window.location.pathname;
    if (!path.includes('/opportunities/')) return null;
    const id = path.split('/opportunities/')[1]?.split('/')[0];
    return id || null;
  };
  const limits = getPlanLimits();
  const isLocked = !limits.hasAIVerdict;
  const userPlan = getUserPlan();
  const canLiveMode = ['investor', 'pro', 'elite', 'institutional'].includes(userPlan);
  const ALL_SUGGESTIONS = t('larry.suggestions', { returnObjects: true }) as string[];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [proactiveMessages, setProactiveMessages] = useState<any[]>([]);
  const [liveMode, setLiveMode] = useState(false);
  const [upcomingAlert, setUpcomingAlert] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNewConversation = useRef(false);

  useEffect(() => {
    if (open) setSuggestions(shuffle(ALL_SUGGESTIONS).slice(0, 3));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const token = getToken();
    if (!token) return;
    fetch(`${API}/api/larry/proactive`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setProactiveMessages(data.messages || []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) return;
    const token = getToken();
    if (!token) return;
    const SESSION_KEY = 'nautilus_larry_proactive_shown';
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/larry/proactive`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const msgs = data.messages || [];
        if (msgs.length > 0) {
          setProactiveMessages(msgs);
          setUnreadCount(msgs.length);
          sessionStorage.setItem(SESSION_KEY, '1');
        }
      } catch { /* silent */ }
    }, 30_000);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const checkUpcoming = async () => {
      try {
        const res = await fetch(`${API}/api/subscriptions/upcoming`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const now = new Date();
        const valid = data.filter((s: any) => new Date(s.auction_date) > now);
        if (valid.length > 0 && !open) {
          if (sessionStorage.getItem(`dismissed_alert_${valid[0].id}`)) return;
          setUpcomingAlert(valid[0]);
        } else {
          setUpcomingAlert(null);
        }
      } catch { /* silent */ }
    };
    checkUpcoming();
    const interval = setInterval(checkUpcoming, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [open]);

  const fetchUsage = useCallback(async () => {
    const token = getToken();
    if (!token || isLocked) return;
    try {
      const res = await fetch(`${API}/api/chat/usage`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsage(await res.json());
      else if (res.status === 404) setUsage({ used: 0, limit: 30, plan: 'investor', can_chat: true });
    } catch {
      setUsage({ used: 0, limit: 30, plan: 'investor', can_chat: true });
    }
  }, [isLocked]);

  const fetchHistory = useCallback(async () => {
    const token = getToken();
    if (!token || isLocked) return;
    try {
      const res = await fetch(`${API}/api/chat/history`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((m: { role: string; content: string }) => ({
          id: uid(),
          role: m.role as 'user' | 'assistant',
          content: cleanLarry(m.content),
        })));
      }
    } catch { /* silent */ }
  }, [isLocked]);

  useEffect(() => {
    if (open && !isLocked) {
      fetchUsage();
      if (messages.length === 0 && !isNewConversation.current) fetchHistory();
    }
  }, [open, isLocked, fetchUsage, fetchHistory, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const token = getToken();
    if (!token || streaming || !text.trim()) return;

    const tempId = uid();
    const userMsg: Message = { id: uid(), role: 'user', content: text.trim() };
    const assistantMsg: Message = { id: tempId, role: 'assistant', content: '', streaming: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${API}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text.trim(), lot_id: getCurrentLotId() || existingLotId, live_mode: liveMode }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail = errData.detail || 'Connection error.';
        let content = res.status === 404 ? 'Larry arrive très bientôt. Déploiement en cours.'
          : res.status === 403 ? '🔒 ' + detail
          : res.status === 429 ? '⏳ ' + detail
          : 'Une erreur est survenue. Réessayez.';
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content, streaming: false } : m));
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) {
              setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: 'Une erreur est survenue.', streaming: false } : m));
              return;
            }
            if (parsed.delta) {
              setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: cleanLarry(m.content + parsed.delta) } : m));
            }
            if (parsed.done) {
              setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: cleanLarry(parsed.full || m.content), streaming: false } : m));
              setUsage(prev => prev ? { ...prev, used: prev.used + 1 } : prev);
            }
          } catch { continue; }
        }
      }
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, streaming: false } : m));
      fetchUsage();
    } catch (err: any) {
      const msg = err?.name === 'AbortError'
        ? 'Larry met du temps à répondre. Réessayez dans un instant.'
        : 'Impossible de se connecter. Vérifiez votre connexion.';
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: msg, streaming: false } : m));
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !streaming) sendMessage(input);
    }
  };

  const handleOpen = () => {
    setOpen(prev => !prev);
    setUnreadCount(0);
  };

  const newConversation = () => {
    isNewConversation.current = true;
    setMessages([]);
    setSuggestions(shuffle(ALL_SUGGESTIONS).slice(0, 3));
    setInput('');
  };

  const usagePct = usage && usage.limit > 0 ? Math.round((usage.used / usage.limit) * 100) : 0;
  const hasProactiveAlert = proactiveMessages.some(m => m.priority === 'high');
  const hasOpportunity = proactiveMessages.some(m => m.type === 'exceptional_lot');

  const launcherVariant: LarryVariant = streaming ? 'analyse'
    : hasProactiveAlert ? 'alert'
    : hasOpportunity ? 'opportunity'
    : open ? 'analyse'
    : 'sleep';

  return (
    <>
      <style>{`
        @keyframes lc-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes lc-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.7} }
        @keyframes lc-slideup { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .lc-panel { animation: lc-slideup 0.2s ease; }
        .lc-suggestion:hover { background: #f0f2f5 !important; }
        .lc-send:hover:not(:disabled) { background: #1a3566 !important; }
        .lc-new:hover { background: rgba(255,255,255,0.15) !important; }
        .lc-close-header:hover { background: rgba(255,255,255,0.15) !important; }
        .lc-msg-area::-webkit-scrollbar { width: 4px; }
        .lc-msg-area::-webkit-scrollbar-track { background: transparent; }
        .lc-msg-area::-webkit-scrollbar-thumb { background: #dde0e6; border-radius: 2px; }
      `}</style>

      {/* ── CHAT PANEL ── */}
      {open && (
        <div
          className="lc-panel"
          style={{
            position: 'fixed',
            bottom: '88px',
            right: '20px',
            width: '375px',
            height: '580px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 12px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            border: liveMode ? '2px solid #C6A85A' : '2px solid transparent',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10000,
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          {/* ── HEADER ── */}
          <div style={{
            background: '#0A1628',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0,
          }}>
            {/* Larry avatar circle */}
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <LarryFace size={40} />
            </div>

            {/* Name + status */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                Larry
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {liveMode ? 'Paste artist · lot · URL' : t('larry.subtitle')}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
              {/* New conversation */}
              {messages.length > 0 && (
                <>
                  <button
                    className="lc-new"
                    onClick={newConversation}
                    title="Nouvelle conversation"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={newConversation}
                    title="New conversation"
                    style={{
                      background: 'none', border: 'none',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'pointer', fontSize: 16,
                      padding: '4px 8px',
                    }}
                  >
                    ✕ New
                  </button>
                </>
              )}
              {/* Live mode toggle */}
              {canLiveMode && (
                <button
                  onClick={() => setLiveMode(!liveMode)}
                  style={{
                    background: liveMode ? '#C6A85A' : 'transparent',
                    color: liveMode ? '#1A2A44' : '#C6A85A',
                    border: '1px solid #C6A85A',
                    borderRadius: 4, padding: '4px 12px',
                    fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.1em', cursor: 'pointer',
                  }}
                >
                  {liveMode ? '⚡ LIVE ON' : '⚡ LIVE'}
                </button>
              )}
              {/* Usage */}
              {usage && usage.limit < 9999 && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono, monospace)', paddingInline: '6px' }}>
                  {usage.used}/{usage.limit}
                </div>
              )}
              {/* Close */}
              <button
                className="lc-close-header"
                onClick={() => setOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: '20px',
                  lineHeight: 1,
                  transition: 'background 0.15s',
                }}
                title="Fermer"
              >
                ×
              </button>
            </div>
          </div>

          {/* ── BODY ── */}
          {isLocked ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 24px',
              textAlign: 'center',
              gap: '14px',
            }}>
              <LarryFace size={72} />
              <div>
                <p style={{ fontWeight: 700, color: '#0A1628', margin: 0, fontSize: '15px' }}>
                  {t('larry.lockedTitle')}
                </p>
                <p style={{ color: '#6b7280', fontSize: '13px', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {t('larry.lockedSub')}
                </p>
              </div>
              <a
                href="/app/pricing"
                style={{
                  display: 'inline-block',
                  padding: '10px 24px',
                  background: '#0A1628',
                  color: '#fff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {t('larry.lockedCta')}
              </a>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div
                className="lc-msg-area"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: '#f8f9fb',
                }}
              >
                {/* Empty state */}
                {messages.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Welcome bubble from Larry */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#e8ecf2',
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                      }}>
                        <LarryFace size={28} />
                      </div>
                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '18px 18px 18px 4px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: '#111827',
                        lineHeight: 1.55,
                        maxWidth: '82%',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}>
                        {t('larry.welcome')}
                      </div>
                    </div>

                    {/* Proactive cards */}
                    {proactiveMessages.length > 0 && proactiveMessages.slice(0, 2).map((msg: any) => (
                      <div
                        key={msg.id}
                        onClick={() => setMessages([{ id: uid(), role: 'assistant', content: msg.larry_message, streaming: false }])}
                        style={{
                          background: '#0A1628',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          cursor: 'pointer',
                          transition: 'opacity 0.15s',
                          marginLeft: '36px',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.88'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                      >
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#C6A85A', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: '4px' }}>
                          {msg.type === 'exceptional_lot' ? '◆ SIGNAL FORT' : msg.type === 'market_signal' ? '⚡ MARCHÉ ACTIF' : '◐ MARCHÉ PRIMAIRE'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600, marginBottom: '2px' }}>{msg.title}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>{msg.detail}</div>
                        <div style={{ fontSize: '11px', color: '#C6A85A', marginTop: '6px', fontWeight: 600 }}>{msg.cta} →</div>
                      </div>
                    ))}

                    {/* Suggestions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '36px', marginTop: '4px' }}>
                      {suggestions.map(s => (
                        <button
                          key={s}
                          className="lc-suggestion"
                          onClick={() => { setInput(s); sendMessage(s); }}
                          style={{
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '20px',
                            padding: '8px 14px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#0A1628',
                            fontWeight: 500,
                            transition: 'background 0.12s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message bubbles */}
                {messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  const prevRole = idx > 0 ? messages[idx - 1].role : null;
                  const showAvatar = !isUser && prevRole !== 'assistant';
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: isUser ? 'row-reverse' : 'row',
                        gap: '8px',
                        alignItems: 'flex-end',
                      }}
                    >
                      {/* Larry avatar — show only at start of assistant group */}
                      {!isUser && (
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: showAvatar ? '#e8ecf2' : 'transparent',
                          overflow: 'hidden',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                        }}>
                          {showAvatar && <LarryFace size={28} />}
                        </div>
                      )}

                      <div style={{
                        maxWidth: '75%',
                        padding: '10px 14px',
                        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isUser ? '#0A1628' : '#ffffff',
                        color: isUser ? '#ffffff' : '#111827',
                        fontSize: '13px',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                        border: isUser ? 'none' : '1px solid #e5e7eb',
                        wordBreak: 'break-word',
                      }}>
                        {isUser ? msg.content : renderWithLinks(msg.content)}
                        {msg.streaming && (
                          <span style={{
                            display: 'inline-block',
                            width: '2px',
                            height: '14px',
                            background: '#C6A85A',
                            marginLeft: '3px',
                            verticalAlign: 'middle',
                            animation: 'lc-blink 1s step-end infinite',
                          }} />
                        )}
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>

              {/* Usage bar */}
              {usage && usage.limit < 9999 && (
                <div style={{ padding: '0 16px 0', background: '#fff', flexShrink: 0 }}>
                  <div style={{ height: '2px', background: '#f3f4f6', borderRadius: '1px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${usagePct}%`,
                      background: usagePct >= 90 ? '#ef4444' : '#C6A85A',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* Live mode quick actions */}
              {liveMode && (
                <div style={{ padding: '8px 12px 4px', background: '#fff', display: 'flex', flexWrap: 'wrap', gap: '6px', borderTop: '1px solid #f3f4f6' }}>
                  {QUICK_ACTIONS.map(action => (
                    <button
                      key={action.label}
                      onClick={() => sendMessage(action.msg)}
                      disabled={streaming}
                      style={{
                        padding: '5px 10px', borderRadius: 4,
                        border: '1px solid #C6A85A',
                        background: 'transparent', color: '#C6A85A',
                        fontSize: 11, fontWeight: 700,
                        letterSpacing: '0.08em',
                        cursor: streaming ? 'not-allowed' : 'pointer',
                        opacity: streaming ? 0.5 : 1,
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              {usage && !usage.can_chat && usage.limit > 0 ? (
                <div style={{ padding: '14px 16px', background: '#fff', textAlign: 'center', fontSize: '12px', color: '#6b7280', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
                  {t('larry.monthlyLimit')}
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px',
                  background: '#fff',
                  borderTop: '1px solid #f3f4f6',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-end',
                  flexShrink: 0,
                }}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('larry.placeholder')}
                    rows={1}
                    disabled={streaming}
                    style={{
                      flex: 1,
                      resize: 'none',
                      border: '1px solid #e5e7eb',
                      borderRadius: '22px',
                      padding: '9px 14px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      outline: 'none',
                      minHeight: '38px',
                      maxHeight: '96px',
                      overflowY: 'auto',
                      color: '#111827',
                      background: '#f8f9fb',
                      lineHeight: 1.5,
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#0A1628')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  />
                  <button
                    className="lc-send"
                    onClick={() => sendMessage(input)}
                    disabled={streaming || !input.trim()}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: streaming || !input.trim() ? '#e5e7eb' : '#0A1628',
                      color: streaming || !input.trim() ? '#9ca3af' : '#fff',
                      border: 'none',
                      cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'background 0.15s',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── UPCOMING AUCTION ALERT BANNER ── */}
      {upcomingAlert && !open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24,
          background: '#1A2A44',
          border: '2px solid #C6A85A',
          borderRadius: 12, padding: '12px 16px',
          maxWidth: 280, zIndex: 999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            color: '#C6A85A', fontSize: 11,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em', marginBottom: 6,
          }}>
            ⚡ AUCTION ALERT
          </div>
          <div style={{ color: 'white', fontSize: 13, marginBottom: 10 }}>
            {upcomingAlert.artist_name || upcomingAlert.auction_house_name || 'A followed lot'} goes live soon
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                setOpen(true);
                setLiveMode(true);
                setUpcomingAlert(null);
              }}
              style={{
                background: '#C6A85A', color: '#1A2A44',
                border: 'none', borderRadius: 4,
                padding: '6px 12px', fontSize: 11,
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              Open Larry Live
            </button>
            <button
              onClick={() => {
                sessionStorage.setItem(`dismissed_alert_${upcomingAlert.id}`, 'true');
                setUpcomingAlert(null);
              }}
              style={{
                background: 'none', color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 4, padding: '6px 12px',
                fontSize: 11, cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── LAUNCHER BUTTON ── */}
      <button
        onClick={handleOpen}
        className="larry-launcher"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#0A1628',
          border: 'none',
          cursor: 'pointer',
          zIndex: 10001,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.28)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 0,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        title="Parler à Larry"
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.06)';
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.34)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.28)';
        }}
      >
        {open ? (
          <span style={{ color: '#fff', fontSize: '24px', lineHeight: '56px', fontWeight: 300 }}>×</span>
        ) : (
          <div style={{ marginTop: '-2px' }}>
            <LarryFace size={56} />
          </div>
        )}

        {/* Unread badge */}
        {unreadCount > 0 && !open && (
          <div style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            minWidth: '18px',
            height: '18px',
            borderRadius: '9px',
            background: '#C6A85A',
            border: '2px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 700,
            color: '#0A1628',
            paddingInline: '3px',
            animation: 'lc-pulse 2s infinite',
          }}>
            {unreadCount}
          </div>
        )}

        {/* Alert ring */}
        {hasProactiveAlert && !open && (
          <div style={{
            position: 'absolute',
            inset: '-3px',
            borderRadius: '50%',
            border: '2px solid #C6A85A',
            animation: 'lc-pulse 2s infinite',
            opacity: 0.7,
            pointerEvents: 'none',
          }} />
        )}
      </button>
    </>
  );
}
