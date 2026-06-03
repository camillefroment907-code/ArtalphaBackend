/**
 * CopilotBar — dual-mode Copilot entry point
 *
 * mode="chips"  Phase 2 — intent chips with immediate navigation + async logging
 * mode="chat"   Phase 3 — conversational input (activates when LLM is live)
 *
 * Designed for a single upgrade: flipping mode="chips" → mode="chat" in
 * TodayPage.tsx is the only frontend change needed to activate Phase 3.
 */

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
  fallback: string;       // client-side navigation fallback if API call fails
  badge?:   boolean;      // show a dot indicator
}

// ── Logging (fire-and-forget — never blocks navigation) ───────────────────────

async function logInteraction(
  intent: Intent,
  chipLabel: string,
  sourcePage: string,
  lotId?: string | null,
): Promise<{ action?: { url?: string } } | null> {
  try {
    const token = getToken();
    if (!token) return null;
    const res = await fetch(`${BACKEND}/api/copilot/interaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        intent,
        chip_label: chipLabel,
        source_page: sourcePage,
        lot_id: lotId || null,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CopilotBarProps {
  /** Phase 2: "chips" | Phase 3: "chat" */
  mode?: 'chips' | 'chat';
  /** ID of the Conviction du Jour lot — powers the conviction_explain chip */
  topDealId?: string | null;
  /** Shows urgency badge on relevant chip if > 0 */
  urgentCount?: number;
  /** Source page for logging */
  sourcePage?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CopilotBar({
  mode = 'chips',
  topDealId,
  urgentCount = 0,
  sourcePage = 'today',
}: CopilotBarProps) {
  const navigate = useNavigate();

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

  async function handleChip(chip: Chip) {
    // Navigate immediately — don't wait for the API
    navigate(chip.fallback);

    // Log in background — if API returns a smarter URL (Phase 3), ignored in Phase 2
    logInteraction(chip.intent, chip.label, sourcePage, topDealId).catch(() => {});
  }

  return (
    <div style={{
      padding: '20px 0 28px',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
    }}>

      {/* Eyebrow */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--text-3)', marginBottom: '14px',
      }}>
        Votre conseiller
      </div>

      {mode === 'chips' && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px',
        }}>
          {chips.map(chip => (
            <ChipButton
              key={chip.intent}
              chip={chip}
              onClick={() => handleChip(chip)}
            />
          ))}
        </div>
      )}

      {mode === 'chat' && (
        <>
          {/* Chat input — active in Phase 3 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Posez une question à Nautilus…"
              style={{
                flex: 1,
                padding: '9px 14px',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                outline: 'none',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--electric)';
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--electric-subtle)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              style={{
                padding: '9px 16px',
                background: 'var(--navy)', color: '#fff',
                border: 'none', borderRadius: '6px',
                fontSize: '13px', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              →
            </button>
          </div>

          {/* Chips as suggestions in chat mode */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {chips.map(chip => (
              <ChipButton
                key={chip.intent}
                chip={chip}
                onClick={() => handleChip(chip)}
                small
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── ChipButton ────────────────────────────────────────────────────────────────

function ChipButton({
  chip,
  onClick,
  small = false,
}: {
  chip: Chip;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: small ? '5px 11px' : '7px 14px',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: '100px',
        fontSize: small ? '11px' : '12px',
        color: 'var(--text-2)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        letterSpacing: '0.01em',
        transition: 'background 0.12s, border-color 0.12s, color 0.12s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-subtle)';
        e.currentTarget.style.borderColor = 'var(--navy)';
        e.currentTarget.style.color = 'var(--navy)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.color = 'var(--text-2)';
      }}
    >
      {chip.label}
      {chip.badge && (
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--gold)', display: 'inline-block', flexShrink: 0,
        }} />
      )}
    </button>
  );
}
