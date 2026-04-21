/**
 * Larry — Nautilus AI Mascot
 *
 * Usage:
 *   import Larry from "./Larry";
 *   <Larry variant="analyse" size={120} />
 *
 * Variants: "analyse" | "opportunity" | "alert" | "sleep"
 */

export type LarryVariant = "analyse" | "opportunity" | "alert" | "sleep";

interface LarryProps {
  variant?: LarryVariant;
  size?: number;
  className?: string;
}

const CONFIG = {
  analyse: {
    body: "#1A2A44",
    iris: "#1e3a80", irisDeep: "#18306a",
    reflect: "#7ab8f8", reflectMain: "#ffffff",
    rim: "#C6A85A",
    mouth: "M64,126 Q77,130 90,126", mouthW: 1.5,
    eyeExtra: 0, eyeLy: 90, eyeRy: 90,
    eyeAnim: "larryBlink 5.8s",
  },
  opportunity: {
    body: "#1A2A44",
    iris: "#1a4aee", irisDeep: "#0d2060",
    reflect: "#aaccff", reflectMain: "#ffffff",
    rim: "#C6A85A",
    mouth: "M52,124 Q77,142 102,124", mouthW: 2.4,
    eyeExtra: 3, eyeLy: 88, eyeRy: 88,
    eyeAnim: "larryBlink 4.6s",
  },
  alert: {
    body: "#1A2A44",
    iris: "#1836aa", irisDeep: "#0c1c48",
    reflect: "#88aaee", reflectMain: "#ffffff",
    rim: "#C6A85A",
    mouth: "M65,123 Q77,126 89,123", mouthW: 1.4,
    eyeExtra: 0, eyeLy: 88, eyeRy: 92,
    eyeAnim: "larryBlinkFast 3.8s",
  },
  sleep: {
    body: "#0e1e30",
    iris: "#06101c", irisDeep: "#030810",
    reflect: "#c8b284", reflectMain: "#c8b284",
    rim: "#7a5e28",
    mouth: "M68,120 Q77,125 86,120", mouthW: 1.2,
    eyeExtra: 0, eyeLy: 90, eyeRy: 90,
    eyeAnim: "larryBlink 6s",
  },
} as const;

const KEYFRAMES = `
  @keyframes larryBob       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes larryBlink     { 0%,87%,100%{transform:scaleY(1)} 91%{transform:scaleY(.05)} }
  @keyframes larryBlinkFast { 0%,76%,100%{transform:scaleY(1)} 80%{transform:scaleY(.05)} }
`;

export default function Larry({ variant = "analyse", size = 160, className = "" }: LarryProps) {
  const c = CONFIG[variant];
  const isSleep = variant === "sleep";

  const eR = 22 + c.eyeExtra;
  const sR = eR - 3;
  const iR = sR - 5;
  const iI = iR - 3;
  const pR = iI - 4;

  const p = `lry-${variant}`;
  const instanceCss = `
    .${p}-body { animation: larryBob 4.5s ease-in-out infinite; transform-origin: 77px 100px; }
    .${p}-eye  { animation: ${c.eyeAnim} ease-in-out infinite; transform-origin: 77px 90px; }
  `;

  return (
    <svg
      width={size}
      height={Math.round(size * 1.25)}
      viewBox="0 0 160 200"
      overflow="visible"
      className={className}
      style={{ display: "block" }}
      role="img"
      aria-label={`Larry — ${variant}`}
    >
      <defs>
        <style>{KEYFRAMES + instanceCss}</style>
      </defs>

      <g className={`${p}-body`}>
        {/* Head */}
        <path
          d="M77,18 C113,18 143,49 143,91 C143,137 121,175 77,183 C33,175 11,137 11,91 C11,49 41,18 77,18Z"
          fill={c.body}
        />
        <path
          d="M77,18 C113,18 143,49 143,91 C143,137 121,175 77,183 C33,175 11,137 11,91 C11,49 41,18 77,18Z"
          fill="none" stroke={c.rim} strokeWidth=".5" opacity=".18"
        />

        {/* Eyes */}
        {isSleep ? (
          [
            { cx: 54,  path: "M31,90 Q54,74 77,90" },
            { cx: 100, path: "M77,90 Q100,74 123,90" },
          ].map(({ cx, path }, i) => (
            <g key={i}>
              <circle cx={cx} cy="90" r="23" fill="#030810" />
              <circle cx={cx} cy="90" r="20" fill="#06101c" />
              <circle cx={cx} cy="90" r="20" fill="none" stroke={c.rim} strokeWidth="1.9" />
              <path d={path} fill="none" stroke="#c8b284" strokeWidth="4" strokeLinecap="round" />
            </g>
          ))
        ) : (
          <g className={`${p}-eye`}>
            {[
              { cx: 54,  cy: c.eyeLy },
              { cx: 100, cy: c.eyeRy },
            ].map(({ cx, cy }) => (
              <g key={cx}>
                <circle cx={cx} cy={cy} r={eR+2} fill="#020509" />
                <circle cx={cx} cy={cy} r={eR}   fill="#edf3fc" />
                <circle cx={cx} cy={cy} r={iR}   fill={c.irisDeep} />
                <circle cx={cx} cy={cy} r={iI}   fill={c.iris} />
                <circle cx={cx} cy={cy} r={pR}   fill="#020509" />
                <circle cx={cx+5} cy={cy-6} r="4.5" fill={c.reflectMain} opacity=".97" />
                <circle cx={cx-4} cy={cy+7} r="2"   fill={c.reflect}     opacity=".5" />
                <circle cx={cx}   cy={cy}   r={eR+2} fill="none" stroke={c.rim} strokeWidth="2.4" />
              </g>
            ))}
          </g>
        )}

        {/* Mouth */}
        <path
          d={c.mouth} fill="none"
          stroke={c.rim} strokeWidth={c.mouthW}
          strokeLinecap="round"
          opacity={isSleep ? ".5" : ".75"}
        />
      </g>
    </svg>
  );
}

/** Eyes-only face — used in chat header, launcher button, and onboarding. */
export function LarryFace({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: 'block' }}
      role="img"
      aria-label="Larry"
    >
      <style>{`@keyframes lfBlink { 0%,87%,100%{transform:scaleY(1)} 91%{transform:scaleY(.05)} }`}</style>
      <circle cx="50" cy="50" r="48" fill="#1A2A44" />
      <circle cx="50" cy="50" r="48" fill="none" stroke="#C6A85A" strokeWidth="0.5" opacity="0.2" />
      <g style={{ animation: 'lfBlink 5.8s ease-in-out infinite', transformOrigin: '50px 50px' }}>
        <circle cx="33" cy="50" r="17" fill="#020509" />
        <circle cx="33" cy="50" r="15" fill="#edf3fc" />
        <circle cx="33" cy="50" r="11" fill="#1e3a80" />
        <circle cx="33" cy="50" r="7"  fill="#020509" />
        <circle cx="37" cy="44" r="3.5" fill="white" opacity="0.97" />
        <circle cx="29" cy="57" r="2"   fill="#7ab8f8" opacity="0.5" />
        <circle cx="33" cy="50" r="17" fill="none" stroke="#C6A85A" strokeWidth="1.8" />
        <circle cx="67" cy="50" r="17" fill="#020509" />
        <circle cx="67" cy="50" r="15" fill="#edf3fc" />
        <circle cx="67" cy="50" r="11" fill="#1e3a80" />
        <circle cx="67" cy="50" r="7"  fill="#020509" />
        <circle cx="71" cy="44" r="3.5" fill="white" opacity="0.97" />
        <circle cx="63" cy="57" r="2"   fill="#7ab8f8" opacity="0.5" />
        <circle cx="67" cy="50" r="17" fill="none" stroke="#C6A85A" strokeWidth="1.8" />
      </g>
    </svg>
  );
}
