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
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }`}</style>
      <img
        src="/logo.png"
        alt="Nautilus"
        style={{
          height: '64px',
          width: 'auto',
          display: 'block',
          animation: 'pulse 2s ease-in-out infinite',
          filter: 'drop-shadow(0 4px 16px rgba(37,99,235,0.3))',
        }}
      />
      <p style={{ marginTop: 20, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1A2A44', opacity: 0.5, fontFamily: 'Arial, sans-serif' }}>
        {msgs[i]}{'...'.slice(0, dots + 1)}
      </p>
    </div>
  );
}
