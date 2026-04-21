import { useState, useEffect } from 'react';

const msgs = [
  'Scanning auction houses...',
  'Ranking by conviction score...',
  'Surfacing your opportunities...',
  'Analyzing active lots...',
];

export default function NautilusLoader() {
  const [i, setI] = useState(0);
  const [p, setP] = useState(0);

  useEffect(() => {
    const t1 = setInterval(() => setI(x => (x + 1) % msgs.length), 900);
    const t2 = setInterval(() => setP(x => Math.min(x + 2, 100)), 30);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#FAFAF8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <svg width="56" height="56" viewBox="0 0 100 100" style={{ animation: 'nautilusFacePulse 1.8s ease-in-out infinite' }}>
        <style>{'@keyframes nautilusFacePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}'}</style>
        <ellipse cx="50" cy="55" rx="28" ry="22" fill="#1A2A44"/>
        <circle cx="32" cy="38" r="18" fill="#1A2A44"/>
        <path d="M20 55 Q15 35 32 28 Q50 20 65 35 Q75 45 68 58 Z" fill="#1A2A44"/>
        <circle cx="37" cy="50" r="9" fill="white"/>
        <circle cx="63" cy="50" r="9" fill="white"/>
        <circle cx="38" cy="51" r="4.5" fill="#1A2A44"/>
        <circle cx="64" cy="51" r="4.5" fill="#1A2A44"/>
        <path d="M42 64 Q50 69 58 64" stroke="#C6A85A" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </svg>
      <p style={{ marginTop: 20, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1A2A44', opacity: 0.55, fontFamily: 'Arial,sans-serif' }}>
        {msgs[i]}
      </p>
      <div style={{ marginTop: 14, width: 160, height: 1, background: 'rgba(26,42,68,0.1)' }}>
        <div style={{ height: '100%', background: '#C6A85A', width: p + '%', transition: 'width 0.03s linear' }} />
      </div>
    </div>
  );
}
