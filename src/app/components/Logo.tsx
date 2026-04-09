interface LogoProps {
  variant?: 'full' | 'monogram' | 'horizontal';
  color?: 'dark' | 'gold' | 'white';
  size?: number;
}

export function Logo({ variant = 'full', color = 'dark', size = 40 }: LogoProps) {
  const colors = {
    dark: '#1C2B24',
    gold: '#A38B4A',
    white: '#FFFFFF',
  };

  const fillColor = colors[color];

  // Monogram - AA as mountain peaks / investment curves
  const Monogram = () => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* First mountain/curve (A) */}
      <path
        d="M15 75 L30 30 L45 75"
        stroke={fillColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Second mountain/curve (A) */}
      <path
        d="M55 75 L70 30 L85 75"
        stroke={fillColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );

  // Full logo with monogram + text
  if (variant === 'full') {
    return (
      <div className="flex flex-col items-center gap-3">
        <Monogram />
        <div
          className="tracking-[0.2em]"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: size * 0.35,
            color: fillColor,
            fontWeight: 400,
          }}
        >
          ARTALPHA
        </div>
      </div>
    );
  }

  // Horizontal version (monogram + text side by side)
  if (variant === 'horizontal') {
    return (
      <div className="flex items-center gap-4">
        <Monogram />
        <div
          className="tracking-[0.15em]"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: size * 0.4,
            color: fillColor,
            fontWeight: 400,
          }}
        >
          ArtAlpha
        </div>
      </div>
    );
  }

  // Monogram only
  return <Monogram />;
}

// Simplified version for favicon/small sizes
export function LogoIcon({ color = 'dark', size = 32 }: { color?: 'dark' | 'gold' | 'white'; size?: number }) {
  const colors = {
    dark: '#1C2B24',
    gold: '#A38B4A',
    white: '#FFFFFF',
  };

  const fillColor = colors[color];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Simplified AA as mountain peaks */}
      <path
        d="M15 75 L30 30 L45 75"
        stroke={fillColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <path
        d="M55 75 L70 30 L85 75"
        stroke={fillColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
