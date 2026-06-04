/**
 * CopilotBar — dual-mode Copilot entry point
 *
 * mode="chips"  Legacy fallback — intent chips with immediate navigation
 * mode="chat"   Phase 3 — streaming LLM advisor (Conseiller Nautilus)
 *
 * Switching mode="chips" → mode="chat" in TodayPage.tsx is the only
 * frontend change needed to activate Phase 3 (already done).
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

// ── Intent taxonomy — matches backend VALID_INTENTS ───────────────────────────

type Intent =
  | 'conviction_explain'
  | 'urgency_check'
  | 'artist_analysis'
  | 'budget_guidance'
  | 'agent_alerts';

interface Chip {
  label:    string;
  intent:   Intent;
  fallback: string;
  badge?:   boolean;
}

// ── Message shape ─────────────────────────────────────────────────────────────

interface Message {
  role:    'user' | 'assistant';
  content: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

// ── Verdict ────────────────────────────────────────────────────────────────────

function getVerdict(score?: number | null) {
  if (!score) return null;
  if (score >= 80) return { label: 'FORT INTÉRÊT', color: '#22c55e', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.22)' };
  if (score >= 65) return { label: 'À SURVEILLER', color: '#C6A85A', bg: 'rgba(198,168,90,0.08)', border: 'rgba(198,168,90,0.22)' };
  if (score >= 50) return { label: 'SIGNAL MODÉRÉ', color: '#9ca3af', bg: 'rgba(255,255,255,0.04)', border: 'rgba(156,163,175,0.2)' };
  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CopilotBarProps {
  mode?:        'chips' | 'chat';
  topDealId?:   string | null;
  topDealScore?: number | null;
  urgentCount?: number;
  sourcePage?:  string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CopilotBar({
  mode = 'chips',
  topDealId,
  topDealScore,
  urgentCount = 0,
  sourcePage = 'today',
}: CopilotBarProps) {
  const navigate = useNavigate();

  // Chat state
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId]               = useState(() => crypto.randomUUID());
  const hasAutoSent               = useRef(false);
  const messagesRef               = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  // Usage quota
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit]         = useState<number | null>(null);

  useEffect(() => {
    if (mode !== 'chat') return;
    const token = getToken();
    if (!token) return;
    fetch(`${BACKEND}/api/copilot/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { remaining: number; limit: number } | null) => {
        if (data) {
          setRemaining(data.remaining);
          setLimit(data.limit);
        }
      })
      .catch(() => {});
  }, [mode]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-send first message on mount (once per session, chat mode only)
  useEffect(() => {
    if (mode !== 'chat') return;
    const SESSION_KEY = 'larry_today_auto_sent';
    if (hasAutoSent.current || sessionStorage.getItem(SESSION_KEY)) return;
    const token = getToken();
    if (!token) return;
    // Short delay so the component is fully mounted
    const timer = setTimeout(() => {
      hasAutoSent.current = true;
      sessionStorage.setItem(SESSION_KEY, '1');
      const prompt = topDealId
        ? 'Donne-moi ton verdict sur la conviction du jour en tenant compte de mon profil et de mon budget.'
        : "Qu'est-ce qui mérite mon attention aujourd'hui sur le marché ?";
      handleSend(prompt, true);
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const chips: Chip[] = [
    topDealId
      ? {
          label:    'Pourquoi cette recommandation ?',
          intent:   'conviction_explain',
          fallback: `/app/opportunities/${topDealId}`,
        }
      : null,
    {
      label:    "Y a-t-il quelque chose d'urgent ?",
      intent:   'urgency_check',
      fallback: '/app/urgent',
      badge:    urgentCount > 0,
    },
    {
      label:    'Quels artistes suivre en ce moment ?',
      intent:   'artist_analysis',
      fallback: '/app/market/artists-following',
    },
    {
      label:    'Que feriez-vous à ma place ?',
      intent:   'budget_guidance',
      fallback: '/app/market/opportunities',
    },
    {
      label:    'Ce que Nautilus surveille pour moi',
      intent:   'agent_alerts',
      fallback: '/app/alerts',
    },
  ].filter(Boolean) as Chip[];

  // ── Chat send ───────────────────────────────────────────────────────────────

  async function handleSend(overrideText?: string, isAuto = false) {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    setInput('');
    setMessages(prev => [
      ...prev,
      // For auto messages (pre-loaded), don't show the user prompt bubble
      ...(isAuto ? [] : [{ role: 'user' as const, content: text }]),
      { role: 'assistant' as const, content: '' },
    ]);
    setIsLoading(true);

    try {
      const token = getToken();
      if (!token) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: 'Veuillez vous connecter pour utiliser le Conseiller.' };
          return updated;
        });
        return;
      }

      const res = await fetch(`${BACKEND}/api/copilot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message:    text,
          session_id: sessionId,
          lot_id:     topDealId || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { detail?: string }).detail || 'Une erreur est survenue.';
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: msg };
          return updated;
        });
        return;
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6)) as {
              delta?: string;
              done?: boolean;
              error?: string;
            };

            if (parsed.delta) {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + parsed.delta };
                }
                return updated;
              });
            }

            if (parsed.error) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: parsed.error! };
                return updated;
              });
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
          updated[updated.length - 1] = {
            role:    'assistant',
            content: 'Désolé, une erreur est survenue. Réessayez dans un instant.',
          };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      setRemaining(prev => prev !== null && prev > 0 ? prev - 1 : prev);
      inputRef.current?.focus();
    }
  }

  // ── Chip handlers ───────────────────────────────────────────────────────────

  async function handleChipInChatMode(chip: Chip) {
    // Chips become conversation starters in chat mode
    await handleSend(chip.label);
  }

  async function handleChipInChipsMode(chip: Chip) {
    navigate(chip.fallback);
    fetch(`${BACKEND}/api/copilot/interaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        intent:      chip.intent,
        chip_label:  chip.label,
        source_page: sourcePage,
        lot_id:      topDealId || null,
      }),
    }).catch(() => {});
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      padding: '20px 0 28px',
      borderTop:    '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
    }}>

      {/* Header — Larry + verdict */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        justifyContent:'space-between',
        marginBottom:  '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      '11px',
            fontWeight:    700,
            letterSpacing: '0.06em',
            color:         'var(--gold, #C6A85A)',
          }}>
            ◆ LARRY
          </span>
          {(() => {
            const v = getVerdict(topDealScore);
            return v ? (
              <span style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      '10px',
                fontWeight:    700,
                letterSpacing: '0.1em',
                color:         v.color,
                background:    v.bg,
                border:        `1px solid ${v.border}`,
                borderRadius:  '3px',
                padding:       '2px 8px',
              }}>
                {v.label}
              </span>
            ) : null;
          })()}
        </div>

        {mode === 'chat' && remaining !== null && limit !== null && limit < 99999 && (
          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      '10px',
            letterSpacing: '0.08em',
            color:         remaining <= 3 ? 'var(--gold)' : 'var(--text-3)',
          }}>
            {remaining} message{remaining !== 1 ? 's' : ''} restant{remaining !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Chips mode (legacy) ─────────────────────────────────────────────── */}
      {mode === 'chips' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {chips.map(chip => (
            <ChipButton
              key={chip.intent}
              chip={chip}
              onClick={() => handleChipInChipsMode(chip)}
            />
          ))}
        </div>
      )}

      {/* ── Chat mode (Phase 3) ──────────────────────────────────────────────── */}
      {mode === 'chat' && (
        <>
          {/* Messages thread — shown once conversation starts */}
          {messages.length > 0 && (
            <div
              ref={messagesRef}
              style={{
                maxHeight:    '360px',
                overflowY:    'auto',
                marginBottom: '12px',
                display:      'flex',
                flexDirection:'column',
                gap:          '14px',
              }}
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display:       'flex',
                    flexDirection: 'column',
                    alignItems:    msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.role === 'assistant' && (
                    <span style={{
                      fontSize:      '10px',
                      fontFamily:    'var(--font-mono)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color:         'var(--electric)',
                      marginBottom:  '5px',
                    }}>
                      LARRY
                    </span>
                  )}
                  <div style={{
                    maxWidth:    '88%',
                    padding:     msg.role === 'user' ? '8px 13px' : '11px 15px',
                    background:  msg.role === 'user' ? 'var(--bg-subtle)' : 'transparent',
                    border:      msg.role === 'user' ? 'none' : '1px solid var(--border)',
                    borderRadius:'8px',
                    fontSize:    '13px',
                    color:       'var(--text)',
                    lineHeight:  '1.6',
                    fontFamily:  'var(--font-sans)',
                    whiteSpace:  'pre-wrap',
                    // Cursor blink on last empty assistant message (streaming)
                    ...(isLoading && i === messages.length - 1 && msg.role === 'assistant' && !msg.content
                      ? { minWidth: '24px', minHeight: '20px' }
                      : {}),
                  }}>
                    {msg.content
                      ? msg.content
                      : isLoading && i === messages.length - 1 && msg.role === 'assistant'
                        ? <BlinkingCursor />
                        : null
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: messages.length === 0 ? '12px' : '0' }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pose une question à Larry…"
              disabled={isLoading}
              style={{
                flex:        1,
                padding:     '9px 14px',
                fontSize:    '13px',
                fontFamily:  'var(--font-sans)',
                background:  'var(--bg-subtle)',
                border:      '1px solid var(--border)',
                borderRadius:'6px',
                color:       'var(--text)',
                outline:     'none',
                opacity:     isLoading ? 0.6 : 1,
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--electric)';
                e.currentTarget.style.boxShadow  = '0 0 0 3px var(--electric-subtle)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow  = 'none';
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              style={{
                padding:     '9px 16px',
                background:  isLoading || !input.trim() ? 'var(--bg-subtle)' : 'var(--navy)',
                color:       isLoading || !input.trim() ? 'var(--text-3)' : '#fff',
                border:      '1px solid var(--border)',
                borderRadius:'6px',
                fontSize:    '13px',
                cursor:      isLoading || !input.trim() ? 'default' : 'pointer',
                fontFamily:  'var(--font-sans)',
                transition:  'background 0.12s, color 0.12s',
              }}
            >
              →
            </button>
          </div>

          {/* Chip suggestions — shown only before first message */}
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {chips.map(chip => (
                <ChipButton
                  key={chip.intent}
                  chip={chip}
                  onClick={() => handleChipInChatMode(chip)}
                  small
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── BlinkingCursor ────────────────────────────────────────────────────────────

function BlinkingCursor() {
  return (
    <span style={{
      display:         'inline-block',
      width:           '2px',
      height:          '14px',
      background:      'var(--text-3)',
      verticalAlign:   'middle',
      animation:       'blink 1s step-end infinite',
    }} />
  );
}

// ── ChipButton ────────────────────────────────────────────────────────────────

function ChipButton({
  chip,
  onClick,
  small = false,
}: {
  chip:    Chip;
  onClick: () => void;
  small?:  boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          '6px',
        padding:      small ? '5px 11px' : '7px 14px',
        background:   'transparent',
        border:       '1px solid var(--border)',
        borderRadius: '100px',
        fontSize:     small ? '11px' : '12px',
        color:        'var(--text-2)',
        cursor:       'pointer',
        fontFamily:   'var(--font-sans)',
        letterSpacing:'0.01em',
        transition:   'background 0.12s, border-color 0.12s, color 0.12s',
        whiteSpace:   'nowrap',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background   = 'var(--bg-subtle)';
        e.currentTarget.style.borderColor  = 'var(--navy)';
        e.currentTarget.style.color        = 'var(--navy)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background   = 'transparent';
        e.currentTarget.style.borderColor  = 'var(--border)';
        e.currentTarget.style.color        = 'var(--text-2)';
      }}
    >
      {chip.label}
      {chip.badge && (
        <span style={{
          width:       '6px',
          height:      '6px',
          borderRadius:'50%',
          background:  'var(--gold)',
          display:     'inline-block',
          flexShrink:  0,
        }} />
      )}
    </button>
  );
}
