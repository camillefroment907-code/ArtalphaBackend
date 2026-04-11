type Variant = 'horizontal' | 'full' | 'symbol';
type ColorScheme = 'dark' | 'white' | 'gold';

interface LogoProps {
  variant?: Variant;
  color?: ColorScheme;
  size?: number;
}

export function Logo({ variant = 'horizontal', color = 'dark', size = 28 }: LogoProps) {
  const c = {
    dark:  { primary: '#0A1628', accent: '#C6A85A', text: '#0A1628' },
    white: { primary: '#FFFFFF', accent: '#C6A85A', text: '#FFFFFF' },
    gold:  { primary: '#C6A85A', accent: '#0A1628', text: '#C6A85A' },
  }[color];

  const Symbol = () => (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 20 4 A 16 16 0 0 1 36 20" stroke={c.primary} strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M 36 20 A 16 16 0 0 1 20 36" stroke={c.primary} strokeWidth="2.2" strokeLinecap="round" opacity="0.65"/>
      <path d="M 20 36 A 8 8 0 0 1 12 28" stroke={c.accent} strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M 12 28 A 8 8 0 0 1 20 20" stroke={c.accent} strokeWidth="2.2" strokeLinecap="round" opacity="0.7"/>
      <path d="M 20 20 A 4 4 0 0 1 24 24" stroke={c.primary} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="20" r="1.8" fill={c.accent}/>
    </svg>
  );

  if (variant === 'symbol') {
    return <Symbol />;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <Symbol />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: `${Math.round(size * 0.68)}px`,
          fontWeight: 600,
          color: c.text,
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}>
          Nautilus
        </span>
        {variant === 'full' && (
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: `${Math.round(size * 0.32)}px`,
            fontWeight: 500,
            color: c.text,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            opacity: 0.55,
            lineHeight: 1,
          }}>
            Market Intelligence
          </span>
        )}
      </div>
    </div>
  );
}

export default Logo;
