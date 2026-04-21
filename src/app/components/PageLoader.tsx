import { useState, useEffect } from 'react';

const MESSAGES = [
  'Scanning auction houses…',
  'Ranking by conviction score…',
  'Surfacing your opportunities…',
  'Analyzing 22,000+ active lots…',
];

export function PageLoader() {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#FAFAF8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '20px',
    }}>
      <style>{`
        @keyframes nautilusPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes nautilusProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes nautilusMsgIn {
          0% { opacity: 0; transform: translateY(4px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>

      {/* Palette logo — pulse */}
      <div style={{ animation: 'nautilusPulse 1.8s ease-in-out infinite' }}>
        <img
          src="/logo.png"
          alt="Nautilus"
          style={{ height: '64px', width: 'auto', display: 'block' }}
        />
      </div>

      {/* Rotating message */}
      <div style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          key={msgIdx}
          style={{
            fontSize: '11px',
            color: '#1A2A44',
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.04em',
            animation: 'nautilusMsgIn 0.9s ease-in-out',
          }}
        >
          {MESSAGES[msgIdx]}
        </span>
      </div>

      {/* Gold progress bar */}
      <div style={{
        width: '180px', height: '1px',
        background: 'rgba(198,168,90,0.2)',
        borderRadius: '1px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          background: '#C6A85A',
          borderRadius: '1px',
          animation: 'nautilusProgress 1.5s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
}
