export function LegalDisclaimer() {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(13, 30, 53, 0.96)',
      borderTop: '1px solid rgba(184,151,58,.3)',
      padding: '8px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 50,
      backdropFilter: 'blur(4px)',
    }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', margin: 0, fontFamily: 'var(--font-mono)', letterSpacing: '.03em' }}>
        Nautilus provides market data for informational purposes only. No content constitutes financial advice or an investment recommendation.
        All decisions are at your own risk.
      </p>
      <a href="/legal" style={{ fontSize: 11, color: '#B8973A', fontFamily: 'var(--font-mono)', textDecoration: 'none', flexShrink: 0, marginLeft: 24 }}>
        Legal →
      </a>
    </div>
  );
}
