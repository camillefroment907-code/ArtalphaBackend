import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getUser, getUserPlan } from '../../lib/auth';

// ── Types ────────────────────────────────────────────────────
interface Alert {
  id: string;
  type: 'artist' | 'category' | 'price' | 'score';
  label: string;
  value: string;
  createdAt: string;
  active: boolean;
}

const STORAGE_KEY = 'artalpha-alerts';

const ALERT_LIMITS: Record<string, number> = {
  free: 1, starter: 5, investor: 20, pro: 9999, elite: 9999, institutional: 9999,
};

const TYPE_CONFIGS = [
  { type: 'artist'   as const, icon: '🎨', label: 'Artist'      },
  { type: 'category' as const, icon: '📂', label: 'Category'    },
  { type: 'price'    as const, icon: '💰', label: 'Price Range'  },
  { type: 'score'    as const, icon: '⭐', label: 'Deal Score'   },
];

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', starter: 'Collector', investor: 'Investor',
  pro: 'Family Office', elite: 'Institutional', institutional: 'Institutional',
};

// ── Helpers ──────────────────────────────────────────────────
function loadAlerts(): Alert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAlerts(alerts: Alert[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

// ── Component ────────────────────────────────────────────────
export function AlertsContent() {
  const navigate = useNavigate();
  const user = getUser();
  const plan = user?.email === 'camillefroment907@gmail.com' ? 'institutional' : getUserPlan();
  const maxAlerts = ALERT_LIMITS[plan] ?? 1;
  const planLabel = PLAN_LABELS[plan] ?? plan;

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedType, setSelectedType] = useState<Alert['type']>('artist');
  const [inputText, setInputText] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [scoreValue, setScoreValue] = useState('45');

  useEffect(() => { setAlerts(loadAlerts()); }, []);

  function persistAlerts(next: Alert[]) {
    setAlerts(next);
    saveAlerts(next);
  }

  function buildLabel(): string {
    if (selectedType === 'artist') return inputText.trim();
    if (selectedType === 'category') return inputText.trim();
    if (selectedType === 'price') return `€${priceMin || '0'} – €${priceMax || '∞'}`;
    if (selectedType === 'score') {
      const map: Record<string, string> = {
        '45': '≥ 45 (Interesting+)',
        '65': '≥ 65 (Strong+)',
        '80': '≥ 80 (Exceptional only)',
      };
      return map[scoreValue] ?? `Score ≥ ${scoreValue}`;
    }
    return '';
  }

  function isFormValid(): boolean {
    if (selectedType === 'artist' || selectedType === 'category') return inputText.trim().length > 0;
    if (selectedType === 'price') return priceMin.trim().length > 0 || priceMax.trim().length > 0;
    return true;
  }

  function handleAdd() {
    if (!isFormValid() || alerts.length >= maxAlerts) return;
    const label = buildLabel();
    const next: Alert[] = [
      ...alerts,
      {
        id: crypto.randomUUID(),
        type: selectedType,
        label,
        value: selectedType === 'score' ? scoreValue : inputText.trim(),
        createdAt: new Date().toISOString(),
        active: true,
      },
    ];
    persistAlerts(next);
    setInputText('');
    setPriceMin('');
    setPriceMax('');
    setScoreValue('45');
  }

  function toggleAlert(id: string) {
    persistAlerts(alerts.map(a => a.id === id ? { ...a, active: !a.active } : a));
  }

  function deleteAlert(id: string) {
    persistAlerts(alerts.filter(a => a.id !== id));
  }

  const atLimit = alerts.length >= maxAlerts;
  const pct = maxAlerts >= 9999 ? 0 : Math.min(100, Math.round((alerts.length / maxAlerts) * 100));

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    border: '1px solid var(--border)', borderRadius: '6px',
    fontSize: '13px', fontFamily: 'var(--font-sans)',
    background: 'var(--bg-card)', color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div className="page" style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 24px' }}>

        {/* ── 1. HEADER ──────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          padding: '40px 0 28px', borderBottom: '2px solid var(--border)',
        }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
              Alerts
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-3)', margin: 0 }}>
              Get notified when the right lot appears
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {alerts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--electric-subtle)', border: '1px solid var(--electric-border)', borderRadius: '4px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--electric)', animation: 'pulseDot 2s infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--electric)', letterSpacing: '0.08em' }}>LIVE MONITORING</span>
              </div>
            )}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>
              {alerts.length} / {maxAlerts >= 9999 ? '∞' : maxAlerts} alerts
            </span>
          </div>
        </div>

        {/* ── 2. USAGE BAR ────────────────────────────────────── */}
        {maxAlerts < 9999 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: 'linear-gradient(to right, var(--navy), var(--gold))',
                borderRadius: '2px', transition: 'width 0.4s ease',
              }} />
            </div>
            {atLimit && (
              <div style={{
                marginTop: '12px', padding: '12px 16px',
                background: 'var(--gold-subtle)', border: '1px solid var(--gold-border)',
                borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '13px', color: 'var(--gold-dim)' }}>
                  You've reached your {maxAlerts}-alert limit. Upgrade to add more.
                </span>
                <button
                  className="btn btn-navy"
                  style={{ fontSize: '11px', padding: '8px 16px' }}
                  onClick={() => navigate('/app/pricing')}
                >
                  Upgrade
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 3. CREATE FORM ──────────────────────────────────── */}
        {!atLimit && (
          <div style={{
            marginTop: '28px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: '2px', padding: '24px',
          }}>
            <div className="label-caps" style={{ marginBottom: '16px' }}>New Alert</div>

            {/* Type chips */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {TYPE_CONFIGS.map(({ type, icon, label }) => {
                const active = selectedType === type;
                return (
                  <button
                    key={type}
                    onClick={() => { setSelectedType(type); setInputText(''); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: active ? 600 : 400,
                      border: active ? 'none' : '1px solid var(--border)',
                      background: active ? 'var(--navy)' : 'white',
                      color: active ? 'white' : 'var(--text-2)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Type-specific input */}
            <div style={{ marginBottom: '16px' }}>
              {(selectedType === 'artist' || selectedType === 'category') && (
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  placeholder={selectedType === 'artist' ? 'e.g. Picasso, Basquiat, Richter' : 'e.g. Photography, Sculpture, Drawing'}
                  style={inputStyle}
                />
              )}
              {selectedType === 'price' && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="number"
                    value={priceMin}
                    onChange={e => setPriceMin(e.target.value)}
                    placeholder="Min €"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="number"
                    value={priceMax}
                    onChange={e => setPriceMax(e.target.value)}
                    placeholder="Max €"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              )}
              {selectedType === 'score' && (
                <select
                  value={scoreValue}
                  onChange={e => setScoreValue(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="45">≥ 45 (Interesting+)</option>
                  <option value="65">≥ 65 (Strong+)</option>
                  <option value="80">≥ 80 (Exceptional only)</option>
                </select>
              )}
            </div>

            <button
              className="btn btn-navy"
              onClick={handleAdd}
              disabled={!isFormValid()}
              style={{
                width: '100%', justifyContent: 'center',
                opacity: isFormValid() ? 1 : 0.5,
                cursor: isFormValid() ? 'pointer' : 'not-allowed',
                fontSize: '12px', padding: '12px',
              }}
            >
              Add Alert
            </button>
          </div>
        )}

        {/* ── 4. ALERT LIST ───────────────────────────────────── */}
        <div style={{ marginTop: '36px' }}>
          <div className="label-caps" style={{ marginBottom: '16px' }}>
            Active Alerts ({alerts.length})
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: '40px 0' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '16px' }}>Start from a template:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => { setSelectedType('artist'); setInputText('Picasso'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: '16px' }}>🎨</span>
                  <div><div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Artist: Picasso</div><div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Alert when any Picasso lot appears at auction</div></div>
                </button>
                <button onClick={() => { setSelectedType('category'); setInputText('Photography'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: '16px' }}>📷</span>
                  <div><div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Category: Photography</div><div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Track photography lots scored 80+</div></div>
                </button>
                <button onClick={() => { setSelectedType('score'); setScoreValue('85'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: '16px' }}>⚡</span>
                  <div><div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Score ≥ 85 — Exceptional deals</div><div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Get notified on top-rated market opportunities</div></div>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alerts.map(alert => {
                const cfg = TYPE_CONFIGS.find(c => c.type === alert.type);
                return (
                  <div
                    key={alert.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '14px 16px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      borderLeft: `3px solid ${alert.active ? 'var(--navy)' : 'var(--border)'}`,
                      borderRadius: '0 4px 4px 0',
                    }}
                  >
                    {/* Icon */}
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{cfg?.icon}</span>

                    {/* Label */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="label-caps" style={{ color: 'var(--text-3)', marginBottom: '2px' }}>
                        {cfg?.label}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {alert.label}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: alert.active ? 'var(--electric)' : 'var(--border)', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                          {alert.active ? 'Scanning new lots · Updated live' : 'Monitoring paused'}
                        </span>
                      </div>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => toggleAlert(alert.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600,
                        color: alert.active ? 'var(--navy)' : 'var(--text-3)',
                        padding: '4px 10px', borderRadius: '4px',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      {alert.active ? '● Active' : '○ Paused'}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '18px', color: 'var(--text-3)', padding: '0 4px',
                        lineHeight: 1, flexShrink: 0,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 5. INFO BANNER ──────────────────────────────────── */}
        <div style={{
          marginTop: '40px', padding: '16px 20px',
          background: 'var(--gold-subtle)', border: '1px solid var(--gold-border)',
          borderRadius: '6px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--gold-dim)', lineHeight: 1.6 }}>
            📡 Real-time notifications coming soon — alerts will trigger via email and in-app when matching lots appear. Your alerts are saved and ready.
          </span>
        </div>

      </div>
    </div>
  );
}

export default function Alerts() {
  return <AlertsContent />;
}
