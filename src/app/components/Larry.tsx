import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getPlanLimits, getToken } from '../../lib/auth';

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

interface LarryProps {
  lotId?: string;
}

const API = 'https://artalpha-backend-production.up.railway.app';


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

const cleanLarry = (text: string) =>
  text
    .replace(/\s*—\s*Larry[\s\S]*$/im, '')
    .replace(/\[FORTE\]|\[MODÉRÉE\]|\[FAIBLE\]|\[FORTE \]|\[MODÉRÉ\]/gi, '')
    .replace(/—\s*Larry/gi, '')
    .trim();

export function Larry({ lotId }: LarryProps) {
  const { t } = useTranslation();
  const limits = getPlanLimits();
  const isLocked = !limits.hasAIVerdict;
  const ALL_SUGGESTIONS = t('larry.suggestions', { returnObjects: true }) as string[];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [proactiveMessages, setProactiveMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fresh random 3 suggestions every time panel opens
  useEffect(() => {
    if (open) setSuggestions(shuffle(ALL_SUGGESTIONS).slice(0, 3));
  }, [open]);

  // Fetch proactive messages when Larry opens
  useEffect(() => {
    if (!open) return;
    const token = getToken();
    if (!token) return;

    fetch(`${API}/api/larry/proactive`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setProactiveMessages(data.messages || []))
      .catch(() => {});
  }, [open]);

  const fetchUsage = useCallback(async () => {
    const token = getToken();
    if (!token || isLocked) return;
    try {
      const res = await fetch(`${API}/api/chat/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsage(await res.json());
      } else if (res.status === 404) {
        setUsage({ used: 0, limit: 30, plan: 'investor', can_chat: true });
      }
    } catch {
      setUsage({ used: 0, limit: 30, plan: 'investor', can_chat: true });
    }
  }, [isLocked]);

  const fetchHistory = useCallback(async () => {
    const token = getToken();
    if (!token || isLocked) return;
    try {
      const res = await fetch(`${API}/api/chat/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.map((m: { role: string; content: string }) => ({
          id: uid(),
          role: m.role as 'user' | 'assistant',
          content: cleanLarry(m.content),
        })));
      }
      // 404 or error: leave messages as [] silently
    } catch {
      // silent
    }
  }, [isLocked]);

  useEffect(() => {
    if (open && !isLocked) {
      fetchUsage();
      if (messages.length === 0) fetchHistory();
    }
  }, [open, isLocked, fetchUsage, fetchHistory, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    const token = getToken();
    if (!token || streaming || !text.trim()) return;
    setError(null);

    const tempId = uid();
    const userMsg: Message = { id: uid(), role: 'user', content: text.trim() };
    const assistantMsg: Message = { id: tempId, role: 'assistant', content: '', streaming: true };

    // Always append — never replace the array
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s

      const res = await fetch(`${API}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text.trim(), lot_id: lotId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail = errData.detail || 'Connection error.';
        let content: string;
        if (res.status === 404) {
          content = 'Larry will be available very soon. Deployment in progress.';
        } else if (res.status === 403) {
          content = '🔒 ' + detail;
        } else if (res.status === 429) {
          content = '⏳ ' + detail;
        } else {
          content = 'An error occurred. Please try again.';
          setError(detail);
        }
        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...m, content, streaming: false } : m
        ));
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
              setMessages(prev => prev.map(m =>
                m.id === tempId
                  ? { ...m, content: 'An error occurred. Please try again.', streaming: false }
                  : m
              ));
              return;
            }
            if (parsed.delta) {
              setMessages(prev => prev.map(m =>
                m.id === tempId
                  ? { ...m, content: cleanLarry(m.content + parsed.delta) }
                  : m
              ));
            }
            if (parsed.done) {
              setMessages(prev => prev.map(m =>
                m.id === tempId
                  ? { ...m, content: cleanLarry(parsed.full || m.content), streaming: false }
                  : m
              ));
              setUsage(prev => prev ? { ...prev, used: prev.used + 1 } : prev);
            }
          } catch { continue; }
        }
      }

      // Ensure streaming is marked done
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, streaming: false } : m
      ));

      fetchUsage();
    } catch (err: any) {
      const msg = err?.name === 'AbortError'
        ? 'Larry is taking a while to respond. Please try again in a moment.'
        : 'Could not connect to server. Please check your connection.';
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, content: msg, streaming: false }
          : m
      ));
    } finally {
      setStreaming(false);
    }
  };

  const handleSuggestionClick = (s: string) => {
    setInput(s);
    sendMessage(s);
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

  const usagePct = usage && usage.limit > 0
    ? Math.round((usage.used / usage.limit) * 100)
    : 0;

  const hasProactiveAlert = proactiveMessages.some(m => m.priority === 'high');

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'var(--navy)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          zIndex: 9999,
          fontFamily: 'var(--font-serif)',
          fontSize: '20px',
          fontWeight: 700,
          transition: 'transform 0.15s ease',
        }}
        title="Talk to Larry"
      >
        {hasProactiveAlert && !open && (
          <div style={{
            position: 'absolute',
            inset: '-3px',
            borderRadius: '50%',
            border: '2px solid var(--gold)',
            animation: 'pulseDot 2s infinite',
            opacity: 0.6,
            pointerEvents: 'none',
          }} />
        )}
        {open ? '×' : 'L'}
        {unreadCount > 0 && !open && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: 'var(--gold)',
            animation: 'pulse 2s infinite',
          }} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '88px',
            right: '24px',
            width: '380px',
            height: '560px',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
            zIndex: 9998,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--navy)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 700 }}>
                {t('larry.title')}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                {t('larry.subtitle')}
              </div>
            </div>
            {usage && usage.limit < 9999 && (
              <div style={{ fontSize: '11px', opacity: 0.8, textAlign: 'right' }}>
                {t('larry.usage', { used: usage.used, limit: usage.limit })}
              </div>
            )}
          </div>

          {isLocked ? (
            /* Locked state */
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 24px',
              textAlign: 'center',
              gap: '16px',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--navy)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '22px',
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
              }}>L</div>
              <div>
                <p style={{ fontWeight: 600, color: 'var(--navy)', margin: 0, fontSize: '15px' }}>
                  {t('larry.lockedTitle')}
                </p>
                <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '8px 0 0' }}>
                  {t('larry.lockedSub')}
                </p>
              </div>
              <a
                href="/app/pricing"
                style={{
                  display: 'block',
                  padding: '10px 24px',
                  background: 'var(--navy)',
                  color: '#fff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginTop: '8px',
                }}
              >
                {t('larry.lockedCta')}
              </a>
            </div>
          ) : (
            <>
              {/* Messages area */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                {messages.length === 0 && (
                  <div>
                    <p style={{
                      color: 'var(--text-2)',
                      fontSize: '13px',
                      textAlign: 'center',
                      margin: '0 0 16px',
                    }}>
                      {t('larry.welcome')}
                    </p>

                    {/* Proactive notification cards */}
                    {proactiveMessages.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        {proactiveMessages.slice(0, 2).map((msg: any) => (
                          <div
                            key={msg.id}
                            style={{
                              background: 'var(--navy)',
                              borderRadius: '8px',
                              padding: '12px 14px',
                              marginBottom: '8px',
                              cursor: 'pointer',
                              transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.85'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                            onClick={() => {
                              setMessages([{
                                id: uid(),
                                role: 'assistant' as const,
                                content: msg.larry_message,
                                streaming: false,
                              }]);
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                {msg.type === 'exceptional_lot' ? '◆ STRONG SIGNAL' : msg.type === 'market_signal' ? '⚡ MARKET ACTIVE' : '◐ PRIMARY MARKET'}
                              </div>
                              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
                                {msg.priority === 'high' ? 'PRIORITY' : 'NEW'}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'white', fontWeight: 600, marginBottom: '3px' }}>
                              {msg.title}
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
                              {msg.detail}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--gold)', marginTop: '8px', fontWeight: 600 }}>
                              {msg.cta}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {suggestions.map(s => (
                        <button
                          key={s}
                          onClick={() => handleSuggestionClick(s)}
                          style={{
                            background: 'none',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: 'var(--text-2)',
                            transition: 'border-color 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--navy)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                    }}
                  >
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: msg.role === 'user' ? 'var(--navy)' : 'var(--surface)',
                      color: msg.role === 'user' ? '#fff' : 'var(--text-1)',
                      fontSize: '13px',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                      {msg.streaming && (
                        <span style={{
                          display: 'inline-block',
                          marginLeft: '2px',
                          animation: 'blink 1s step-end infinite',
                          color: 'var(--gold)',
                          fontWeight: 700,
                        }}>▌</span>
                      )}
                    </div>
                  </div>
                ))}

                {error && (
                  <div style={{
                    fontSize: '12px',
                    color: '#c0392b',
                    padding: '8px 12px',
                    background: '#fdf2f2',
                    borderRadius: '8px',
                    border: '1px solid #f5c6c6',
                  }}>
                    {error}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Usage bar */}
              {usage && usage.limit < 9999 && (
                <div style={{ padding: '0 16px 8px' }}>
                  <div style={{
                    height: '3px',
                    background: 'var(--border)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${usagePct}%`,
                      background: usagePct >= 90 ? '#e74c3c' : 'var(--gold)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* Input area */}
              {usage && !usage.can_chat && usage.limit > 0 ? (
                <div style={{
                  padding: '16px',
                  borderTop: '1px solid var(--border)',
                  textAlign: 'center',
                  color: 'var(--text-2)',
                  fontSize: '12px',
                }}>
                  {t('larry.monthlyLimit')}
                </div>
              ) : (
                <div style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-end',
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
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      outline: 'none',
                      minHeight: '36px',
                      maxHeight: '100px',
                      overflowY: 'auto',
                      color: 'var(--text-1)',
                      background: streaming ? 'var(--surface)' : '#fff',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--navy)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={streaming || !input.trim()}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: streaming || !input.trim() ? 'var(--border)' : 'var(--navy)',
                      color: '#fff',
                      border: 'none',
                      cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'background 0.15s',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </>
  );
}
