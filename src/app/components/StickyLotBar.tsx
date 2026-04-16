interface StickyLotBarProps {
  artist: string;
  title: string;
  score: number;
  tier: 'EXCEPTIONAL' | 'STRONG' | 'INTERESTING';
  signal: string;
  visible: boolean;
}

export function StickyLotBar({ artist, title, score, tier, signal, visible }: StickyLotBarProps) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--bg-inset)',
      borderBottom: '0.5px solid var(--border-dark)',
      padding: '10px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
      transform: visible ? 'translateY(0)' : 'translateY(-100%)',
      transition: 'transform 0.2s ease',
    }}>
      <div>
        <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{artist}</div>
        <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 14, color: 'var(--text-1)' }}>{title}</div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ background: '#162040', border: '0.5px solid #2A4480', color: '#7EB0F0', fontFamily: 'monospace', fontSize: 10, padding: '3px 8px', borderRadius: 4 }}>{signal}</span>
        <span style={{ background: '#1C2E1C', border: '0.5px solid #3D6B3D', color: '#6FCF6F', fontFamily: 'monospace', fontSize: 10, padding: '3px 8px', borderRadius: 4 }}>{score}/100 · {tier}</span>
      </div>
    </div>
  );
}
