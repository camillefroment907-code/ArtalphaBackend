type Variant = 'horizontal' | 'full' | 'symbol';
type ColorScheme = 'dark' | 'white' | 'gold';

interface LogoProps {
  variant?: Variant;
  color?: ColorScheme;
  size?: number;
}

export function Logo({ variant = 'horizontal', color = 'dark', size = 28 }: LogoProps) {
  const c = {
    dark:  { text: '#0A1628' },
    white: { text: '#FFFFFF' },
    gold:  { text: '#C6A85A' },
  }[color];

  const Symbol = () => (
    <img
      src="/logo.png"
      alt="Nautilus logo"
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block' }}
    />
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
