import { useState, useEffect } from 'react';

const msgs = [
  'Scanning auction houses...',
  'Ranking by conviction score...',
  'Surfacing your opportunities...',
  'Analyzing active lots...',
];

export default function NautilusLoader() {
  const [i, setI] = useState(0);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const t1 = setInterval(() => setI(x => (x + 1) % msgs.length), 900);
    const t2 = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#FAFAF8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <svg width="72" height="72" viewBox="0 0 100 100"
        style={{ animation: 'nautilusPulse 1.8s ease-in-out infinite' }}>
        <style>{`
          @keyframes nautilusPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.08); opacity: 0.85; }
          }
        `}</style>
        <ellipse cx="50" cy="60" rx="30" ry="24" fill="#2563EB" opacity="0.15"/>
        <ellipse cx="50" cy="58" rx="28" ry="22" fill="#2563EB" opacity="0.25"/>
        <path d="M22 58 Q18 35 35 26 Q52 16 68 32 Q80 44 72 60 Z" fill="#2563EB"/>
        <ellipse cx="50" cy="60" rx="28" ry="22" fill="#2563EB"/>
        <circle cx="38" cy="54" r="10" fill="white"/>
        <circle cx="62" cy="54" r="10" fill="white"/>
        <circle cx="72" cy="46" r="5" fill="white"/>
        <circle cx="39" cy="55" r="5" fill="#1A2A44"/>
        <circle cx="63" cy="55" r="5" fill="#1A2A44"/>
        <circle cx="72" cy="47" r="2.5" fill="#1A2A44"/>
        <path d="M43 67 Q50 72 57 67" stroke="#C6A85A" strokeWidth="2.5"
          fill="none" strokeLinecap="round"/>
      </svg>
      <p style={{ marginTop: 20, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1A2A44', opacity: 0.5, fontFamily: 'Arial, sans-serif' }}>
        {msgs[i]}{'...'.slice(0, dots + 1)}
      </p>
    </div>
  );
}
