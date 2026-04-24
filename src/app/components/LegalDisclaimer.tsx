import { useEffect, useState } from 'react';

export function LegalDisclaimer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      setVisible(scrolled >= total - 100);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(10,22,40,0.95)',
      color: 'rgba(255,255,255,0.35)',
      fontSize: 10,
      textAlign: 'center',
      padding: '5px 16px',
      letterSpacing: '0.04em',
      zIndex: 999,
      pointerEvents: 'none',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
    }}>
      Nautilus provides market data for informational purposes only. Not financial advice.
    </div>
  );
}
