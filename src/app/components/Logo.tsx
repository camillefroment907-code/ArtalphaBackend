type Variant = 'horizontal' | 'full' | 'symbol';
type ColorScheme = 'dark' | 'white' | 'gold';

interface LogoProps {
  variant?: Variant;
  color?: ColorScheme;
  size?: number;
}

// CSS filters applied to the transparent-background PNG
// 'dark'  → no filter   (blue palette on light bg)
// 'white' → invert       (white palette on dark bg)
// 'gold'  → sepia tint   (gold palette on dark bg)
const FILTER: Record<ColorScheme, string> = {
  dark:  'none',
  white: 'brightness(0) invert(1)',
  gold:  'brightness(0) sepia(1) saturate(4) hue-rotate(5deg)',
};

const TEXT_COLOR: Record<ColorScheme, string> = {
  dark:  '#0A1628',
  white: '#FFFFFF',
  gold:  '#C6A85A',
};

export function Logo({ variant = 'horizontal', color = 'dark', size = 28 }: LogoProps) {
  const Symbol = () => (
    <img
      src="/logo.png"
      alt="Nautilus"
      style={{ display: 'block', height: `${size}px`, width: 'auto', filter: FILTER[color] }}
    />
  );

  if (variant === 'symbol') {
    return <Symbol />;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Symbol />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{
          fontFamily: "-apple-system, 'Inter', 'Helvetica Neue', Arial, sans-serif",
          fontSize: `${Math.round(size * 0.68)}px`,
          fontWeight: 700,
          color: TEXT_COLOR[color],
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          Nautilus
        </span>
        {variant === 'full' && (
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: `${Math.round(size * 0.32)}px`,
            fontWeight: 500,
            color: TEXT_COLOR[color],
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
