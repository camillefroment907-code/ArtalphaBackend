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

interface CopilotBarProps {
  mode?:        'chips' | 'chat';
  topDealId?:   string | null;
  urgentCount?: number;
  sourcePage?:  string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CopilotBar({
  mode = 'chips',
  topDealId,
  urgentCount = 0,
  sourcePage = 'today',
}: CopilotBarProps) {
  const navigate = useNavigate();

  // Chat state
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId]               = useState(() => crypto.randomUUID());
  const messagesRef               = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

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

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    setInput('');
    setMessages(prev => [
      ...prev,
      { role: 'user',      content: text },
      { role: 'assistant', content: '' },
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

      {/* Eyebrow */}
      <div style={{
        fontFamily:    'var(--font-mono)',
        fontSize:      '10px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color:         'var(--text-3)',
        marginBottom:  '14px',
      }}>
        Votre conseiller
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
                      Nautilus
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
              placeholder="Posez une question à Nautilus…"
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
