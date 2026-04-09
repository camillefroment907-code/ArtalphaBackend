import { useState, useEffect, useRef, useCallback } from 'react';
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

const ALL_SUGGESTIONS = [
  "Quelles sont tes meilleures opportunités en ce moment ?",
  "Comment débuter dans l'investissement art avec 10 000€ ?",
  "Quels artistes émergents surveiller en 2025 ?",
  "Comment lire un deal score ArtAlpha ?",
  "Drouot vs Christie's — où acheter ?",
  "Comment ajouter une œuvre à mon portfolio ?",
];

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
  const limits = getPlanLimits();
  const isLocked = !limits.hasAIVerdict;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fresh random 3 suggestions every time panel opens
  useEffect(() => {
    if (open) setSuggestions(shuffle(ALL_SUGGESTIONS).slice(0, 3));
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
      const res = await fetch(`${API}/api/chat/message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text.trim(), lot_id: lotId || undefined }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail = errData.detail || 'Erreur lors de la connexion à Larry.';
        let content: string;
        if (res.status === 404) {
          content = 'Je serai disponible très bientôt. Le déploiement est en cours.';
        } else if (res.status === 403) {
          content = '🔒 ' + detail;
        } else if (res.status === 429) {
          content = '⏳ ' + detail;
        } else {
          content = 'Une erreur est survenue. Réessayez.';
          setError(detail);
        }
        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...m, content, streaming: false } : m
        ));
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              // Append delta to the specific message by ID — never touch other messages
              setMessages(prev => prev.map(m =>
                m.id === tempId
                  ? { ...m, content: cleanLarry(m.content + data.delta), streaming: true }
                  : m
              ));
            }
            if (data.done) {
              setMessages(prev => prev.map(m =>
                m.id === tempId
                  ? { ...m, content: cleanLarry(data.full || m.content), streaming: false }
                  : m
              ));
              setUnreadCount(0);
            }
            if (data.error) {
              setError(data.error);
              setMessages(prev => prev.map(m =>
                m.id === tempId ? { ...m, content: data.error, streaming: false } : m
              ));
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }

      fetchUsage();
    } catch {
      setError('Connexion interrompue. Réessayez.');
      // Remove the empty assistant placeholder, keep the user message
      setMessages(prev => prev.filter(m => m.id !== tempId));
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
        title="Parler à Larry"
      >
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
                Larry
              </div>
              <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                Conseiller privé ArtAlpha
              </div>
            </div>
            {usage && usage.limit < 9999 && (
              <div style={{ fontSize: '11px', opacity: 0.8, textAlign: 'right' }}>
                {usage.used}/{usage.limit} messages
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
                  Rencontrez Larry
                </p>
                <p style={{ color: 'var(--text-2)', fontSize: '13px', margin: '8px 0 0' }}>
                  Votre conseiller privé en investissement art. Disponible à partir du plan Investor.
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
                Passer à Investor — €29/mois
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
                      Bonjour. Je suis Larry, votre conseiller art.<br />Comment puis-je vous aider ?
                    </p>
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
                  Limite mensuelle atteinte. Renouvellement le 1er du mois.
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
                    placeholder="Posez votre question à Larry…"
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
      `}</style>
    </>
  );
}
