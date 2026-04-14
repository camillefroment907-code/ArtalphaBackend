export function PageLoader() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '16px',
    }}>
      <div style={{ animation: 'spin 2s linear infinite' }}>
        <svg width="48" height="48" viewBox="0 0 40 40" fill="none">
          <path d="M 20 4 A 16 16 0 0 1 36 20" stroke="#0A1628" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M 36 20 A 16 16 0 0 1 20 36" stroke="#0A1628" strokeWidth="2.2" strokeLinecap="round" opacity="0.65"/>
          <path d="M 20 36 A 8 8 0 0 1 12 28" stroke="#C6A85A" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M 12 28 A 8 8 0 0 1 20 20" stroke="#C6A85A" strokeWidth="2.2" strokeLinecap="round" opacity="0.7"/>
          <path d="M 20 20 A 4 4 0 0 1 24 24" stroke="#0A1628" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="20" cy="20" r="1.8" fill="#C6A85A"/>
        </svg>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
