export function LegalDisclaimer() {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(10,22,40,0.92)',
      color: 'rgba(255,255,255,0.35)',
      fontSize: 10,
      textAlign: 'center',
      padding: '5px 16px',
      letterSpacing: '0.04em',
      zIndex: 999,
      pointerEvents: 'none',
    }}>
      Nautilus provides market data for informational purposes only. Not financial advice.
    </div>
  );
}
