/**
 * Larry — Nautilus AI Mascot
 *
 * Usage:
 *   import Larry from "./Larry";
 *   <Larry variant="analyse" size={120} />
 *
 * Variants: "analyse" | "opportunity" | "alert" | "sleep"
 * Props:
 *   variant  — emotional state (default: "analyse")
 *   size     — width in px, height scales at 1.45× (default: 160)
 *   className — optional CSS class
 */

export type LarryVariant = "analyse" | "opportunity" | "alert" | "sleep";

interface LarryProps {
  variant?: LarryVariant;
  size?: number;
  className?: string;
}

/* ─── Per-variant design tokens ─── */
const CONFIG = {
  analyse: {
    body: "#1A2A44", bodyInner: "#1f3258",
    iris: "#1e3a80", irisDeep: "#18306a",
    reflect: "#7ab8f8", reflectMain: "#ffffff",
    rim: "#C6A85A",
    mouth: "M64,126 Q77,130 90,126", mouthW: 1.5,
    eyeExtra: 0, eyeLy: 90, eyeRy: 90,
    brows: false, glasses: true, sparkles: false, sonar: false, zzz: false, terminal: true,
    bodyAnim: "larryBob 4.5s", eyeAnim: "larryBlink 5.8s",
    armL: "larrySwayL 4.4s", armR: "larrySwayR 4.4s",
    scope: "larryScan 6.5s",
    tilt: 0,
  },
  opportunity: {
    body: "#1A2A44", bodyInner: "#1f3258",
    iris: "#1a4aee", irisDeep: "#0d2060",
    reflect: "#aaccff", reflectMain: "#ffffff",
    rim: "#C6A85A",
    mouth: "M52,124 Q77,142 102,124", mouthW: 2.4,
    eyeExtra: 3, eyeLy: 88, eyeRy: 88,
    brows: false, glasses: false, sparkles: true, sonar: false, zzz: false, terminal: false,
    bodyAnim: "larryBob 4s", eyeAnim: "larryBlink 4.6s",
    armL: "larrySwayLf 3.4s", armR: "larrySwayRf 3.4s",
    scope: "larryScan 6s",
    tilt: 0,
  },
  alert: {
    body: "#1A2A44", bodyInner: "#1f3258",
    iris: "#1836aa", irisDeep: "#0c1c48",
    reflect: "#88aaee", reflectMain: "#ffffff",
    rim: "#C6A85A",
    mouth: "M65,123 Q77,126 89,123", mouthW: 1.4,
    eyeExtra: 0, eyeLy: 88, eyeRy: 92,
    brows: true, glasses: false, sparkles: false, sonar: true, zzz: false, terminal: false,
    bodyAnim: "larrySurge 2.1s", eyeAnim: "larryBlinkFast 3.8s",
    armL: "larrySwayLf 2.6s", armR: "larrySwayRf 2.6s",
    scope: "larryScanFast 1.8s",
    tilt: -4,
  },
  sleep: {
    body: "#0e1e30", bodyInner: "#142436",
    iris: "#06101c", irisDeep: "#030810",
    reflect: "#c8b284", reflectMain: "#c8b284",
    rim: "#7a5e28",
    mouth: "M68,120 Q77,125 86,120", mouthW: 1.2,
    eyeExtra: 0, eyeLy: 90, eyeRy: 90,
    brows: false, glasses: false, sparkles: false, sonar: false, zzz: true, terminal: false,
    bodyAnim: "larryBreathe 8s", eyeAnim: "larryBlink 6s",
    armL: "larrySwayLs 10s", armR: "larrySwayRs 10s",
    scope: "larryDroop 10s",
    tilt: 0,
  },
} as const;

/* ─── Keyframes (injected once via <style>) ─── */
const KEYFRAMES = `
  @keyframes larryBob       { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-9px)} }
  @keyframes larryBreathe   { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-4px)} }
  @keyframes larrySurge     { 0%,100%{transform:translateY(0) scale(1)} 40%{transform:translateY(-7px) scale(1.03)} 55%{transform:translateY(-6px) scale(.97)} }
  @keyframes larryBlink     { 0%,87%,100%{transform:scaleY(1)} 91%{transform:scaleY(.05)} }
  @keyframes larryBlinkFast { 0%,76%,100%{transform:scaleY(1)} 80%{transform:scaleY(.05)} }
  @keyframes larrySwayL     { 0%,100%{transform:rotate(0deg)}  50%{transform:rotate(-11deg)} }
  @keyframes larrySwayR     { 0%,100%{transform:rotate(0deg)}  50%{transform:rotate(11deg)} }
  @keyframes larrySwayLf    { 0%,100%{transform:rotate(4deg)}  50%{transform:rotate(16deg)} }
  @keyframes larrySwayRf    { 0%,100%{transform:rotate(-4deg)} 50%{transform:rotate(-16deg)} }
  @keyframes larrySwayLs    { 0%,100%{transform:rotate(2deg)}  50%{transform:rotate(-2deg)} }
  @keyframes larrySwayRs    { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg)} }
  @keyframes larryScan      { 0%,100%{transform:rotate(0deg)} 35%{transform:rotate(-18deg)} 68%{transform:rotate(12deg)} }
  @keyframes larryScanFast  { 0%,100%{transform:rotate(-7deg)} 50%{transform:rotate(11deg)} }
  @keyframes larryDroop     { 0%,100%{transform:rotate(12deg)} 50%{transform:rotate(22deg)} }
  @keyframes larryGlint     { 0%,100%{opacity:.45} 50%{opacity:1} }
  @keyframes larrySpk1      { 0%,100%{transform:scale(1) rotate(0deg)} 50%{transform:scale(1.65) rotate(24deg)} }
  @keyframes larrySpk2      { 0%,100%{transform:scale(1) rotate(0deg)} 50%{transform:scale(1.42) rotate(-20deg)} }
  @keyframes larrySpk3      { 0%,100%{transform:scale(1) rotate(0deg)} 50%{transform:scale(1.55) rotate(16deg)} }
  @keyframes larryPing1     { 0%{r:5px;opacity:.9}  100%{r:28px;opacity:0} }
  @keyframes larryPing2     { 0%{r:5px;opacity:.65} 100%{r:28px;opacity:0} }
  @keyframes larryZzz       { 0%{opacity:.85;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-22px) scale(1.25)} }
  @keyframes larryDl        { 0%,100%{opacity:0} 25%,75%{opacity:1} }
`;

export default function Larry({ variant = "analyse", size = 160, className = "" }: LarryProps) {
  const c = CONFIG[variant];
  const isSleep = variant === "sleep";
  const isAlert = variant === "alert";

  /* eye geometry */
  const eR  = 22 + c.eyeExtra;   // porthole outer radius
  const sR  = eR - 3;            // sclera
  const iR  = sR - 5;            // iris outer
  const iI  = iR - 3;            // iris inner
  const pR  = iI - 4;            // pupil

  /* per-instance CSS prefix to avoid collisions when multiple Larrys coexist */
  const p = `lry-${variant}`;

  const instanceCss = `
    .${p}-body { animation:${c.bodyAnim} ease-in-out infinite; transform-origin:77px 108px }
    .${p}-eye  { animation:${c.eyeAnim}  ease-in-out infinite; transform-origin:77px 90px }
    .${p}-al   { animation:${c.armL}     ease-in-out infinite; transform-origin:36px 152px }
    .${p}-ar   { animation:${c.armR}     ease-in-out infinite .4s; transform-origin:124px 152px }
    .${p}-sc   { animation:${c.scope}    ease-in-out infinite; transform-origin:77px 18px }
    .${p}-gl   { animation:larryGlint 3.8s ease-in-out infinite }
    .${p}-s1   { animation:larrySpk1 1.72s ease-in-out infinite; transform-origin:20px 34px }
    .${p}-s2   { animation:larrySpk2 1.72s ease-in-out infinite .24s; transform-origin:10px 58px }
    .${p}-s3   { animation:larrySpk3 1.72s ease-in-out infinite .48s; transform-origin:4px 78px }
    .${p}-p1   { animation:larryPing1 1.3s ease-out infinite; transform-origin:136px 26px }
    .${p}-p2   { animation:larryPing2 1.3s ease-out infinite .45s; transform-origin:136px 26px }
    .${p}-z1   { animation:larryZzz 3s ease-in-out infinite }
    .${p}-z2   { animation:larryZzz 3s ease-in-out infinite 1s }
    .${p}-z3   { animation:larryZzz 3s ease-in-out infinite 2s }
    .${p}-d1   { animation:larryDl 2s ease-in-out infinite }
    .${p}-d2   { animation:larryDl 2s ease-in-out infinite .67s }
    .${p}-d3   { animation:larryDl 2s ease-in-out infinite 1.33s }
  `;

  return (
    <svg
      width={size}
      height={Math.round(size * 1.45)}
      viewBox="0 0 160 230"
      overflow="visible"
      className={className}
      style={{ display: "block" }}
      role="img"
      aria-label={`Larry — ${variant}`}
    >
      <defs>
        <style>{KEYFRAMES + instanceCss}</style>
      </defs>

      {/* ═══ LEFT ARM ═══ */}
      <g className={`${p}-al`}>
        <path
          d={isSleep
            ? "M36,152 C18,162 10,178 14,192 C17,202 27,200 29,190 C31,182 23,178 21,187"
            : "M36,152 C18,160 9,176 13,190 C16,200 27,198 29,188 C31,180 23,176 21,185"}
          fill={isSleep ? "#0c1826" : c.body}
        />
        <circle cx="14" cy="193" r="3"   fill={c.rim} opacity=".2" />
        <circle cx="27" cy="201" r="2"   fill={c.rim} opacity=".14" />
      </g>

      {/* ═══ RIGHT ARM ═══ */}
      <g className={`${p}-ar`}>
        <path
          d={isSleep
            ? "M124,152 C142,162 152,180 148,194 C145,204 133,202 134,192 C135,184 143,180 145,189"
            : "M124,152 C142,160 153,178 149,192 C146,202 134,200 133,190 C131,182 140,178 142,187"}
          fill={isSleep ? "#0c1826" : c.body}
        />
        <circle cx="147" cy="196" r="3"  fill={c.rim} opacity=".2" />
        <circle cx="134" cy="204" r="2"  fill={c.rim} opacity=".14" />
      </g>

      {/* ═══ BODY ═══ */}
      <g
        className={`${p}-body`}
        style={isAlert ? { transform: `rotate(${c.tilt}deg)`, transformOrigin: "77px 108px" } : undefined}
      >
        {/* floor shadow */}
        <ellipse cx="80" cy="187" rx="44" ry="7" fill="#C6A85A" opacity=".04" />

        {/* depth clone */}
        <path
          d="M77,18 C113,18 143,49 143,91 C143,137 121,175 77,183 C33,175 11,137 11,91 C11,49 41,18 77,18Z"
          fill="#030710" opacity=".8" transform="translate(3,5)"
        />

        {/* main body */}
        <path
          d="M77,18 C113,18 143,49 143,91 C143,137 121,175 77,183 C33,175 11,137 11,91 C11,49 41,18 77,18Z"
          fill={c.body}
        />

        {/* inner warmth */}
        <path
          d="M77,28 C108,28 133,55 133,91 C133,129 114,163 77,170 C40,163 21,129 21,91 C21,55 46,28 77,28Z"
          fill={c.bodyInner} opacity=".38"
        />

        {/* dome highlight */}
        <ellipse cx="62" cy="51" rx="24" ry="14" fill="#2a3e62" opacity={isSleep ? ".28" : ".45"} />

        {/* belly */}
        <ellipse cx="79" cy="157" rx="30" ry="11" fill="#0b1520" opacity=".5" />

        {/* rivets */}
        {([
          [22,78],[20,98],[22,118],[132,78],[134,98],[132,118],
        ] as [number,number][]).map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="2.2" fill={c.rim} opacity={isSleep ? ".18" : ".42"} />
        ))}

        {/* ── PERISCOPE ── */}
        <g className={`${p}-sc`}>
          <rect x="74" y="1" width="6" height="20" rx="3" fill={c.rim} opacity={isSleep ? ".55" : "1"} />
          <path d="M67,1 L91,1 L89,7 L69,7Z" fill={c.rim} opacity={isSleep ? ".5" : "1"} />
          <circle cx="80" cy="1"   r="4.5" fill="#081428" />
          <circle cx="81" cy=".4"  r="1.8" fill="#5aaaf4" opacity={isSleep ? ".25" : ".88"} />
          <circle cx="79" cy="-.3" r=".8"  fill="#fff"    opacity={isSleep ? ".18" : ".6"} />
        </g>

        {/* contour */}
        <path
          d="M77,18 C113,18 143,49 143,91 C143,137 121,175 77,183 C33,175 11,137 11,91 C11,49 41,18 77,18Z"
          fill="none" stroke={c.rim} strokeWidth=".5" opacity=".18"
        />

        {/* ── EYES ── */}
        {isSleep ? (
          /* CLOSED */
          [
            { cx: 54,  path: "M31,90 Q54,74 77,90" },
            { cx: 100, path: "M77,90 Q100,74 123,90" },
          ].map(({ cx, path }, i) => (
            <g key={i}>
              <circle cx={cx} cy="90" r="23" fill="#030810" />
              <circle cx={cx} cy="90" r="20" fill="#06101c" />
              <circle cx={cx} cy="90" r="20" fill="none" stroke={c.rim} strokeWidth="1.9" />
              <path d={path} fill="none" stroke="#c8b284" strokeWidth="4" strokeLinecap="round" />
              <line x1={cx-18} y1="87" x2={cx-20} y2="79" stroke="#c8b284" strokeWidth="1.5" strokeLinecap="round" opacity=".42" />
              <line x1={cx-8}  y1="81" x2={cx-9}  y2="73" stroke="#c8b284" strokeWidth="1.5" strokeLinecap="round" opacity=".42" />
              <line x1={cx+2}  y1="78" x2={cx+2}  y2="70" stroke="#c8b284" strokeWidth="1.5" strokeLinecap="round" opacity=".42" />
              <line x1={cx+12} y1="81" x2={cx+13} y2="73" stroke="#c8b284" strokeWidth="1.5" strokeLinecap="round" opacity=".38" />
              <path d={`M${cx-18},94 Q${cx},101 ${cx+18},94`} fill="none" stroke="#c8b284" strokeWidth="1" strokeLinecap="round" opacity=".16" />
            </g>
          ))
        ) : (
          /* OPEN */
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
                <circle cx={cx+2} cy={cy+8} r="1"   fill={c.iris}        opacity=".28" />
                <circle cx={cx}   cy={cy}   r={eR+2} fill="none" stroke={c.rim} strokeWidth="2.4" />
              </g>
            ))}
          </g>
        )}

        {/* GLASSES — analyse */}
        {c.glasses && (
          <g className={`${p}-gl`}>
            <circle cx="54"  cy="90" r={eR+4} fill="none" stroke="#C6A85A" strokeWidth="1.4" />
            <circle cx="100" cy="90" r={eR+4} fill="none" stroke="#C6A85A" strokeWidth="1.4" />
            <line x1="76"  y1="89" x2="80"  y2="89" stroke="#C6A85A" strokeWidth="1.4" />
            <line x1="28"  y1="87" x2="20"  y2="84" stroke="#C6A85A" strokeWidth="1.3" />
            <line x1="128" y1="87" x2="136" y2="84" stroke="#C6A85A" strokeWidth="1.3" />
          </g>
        )}

        {/* V BROWS — alert */}
        {c.brows && (
          <>
            <path d="M30,70 Q54,62 72,69"   fill="none" stroke="#C6A85A" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M82,69 Q100,62 124,70"  fill="none" stroke="#C6A85A" strokeWidth="3.2" strokeLinecap="round" />
          </>
        )}

        {/* MOUTH */}
        <path
          d={c.mouth} fill="none"
          stroke={c.rim} strokeWidth={c.mouthW}
          strokeLinecap="round"
          opacity={isSleep ? ".5" : ".75"}
        />
      </g>

      {/* ═══ SPARKLES — opportunity ═══ */}
      {c.sparkles && (
        <>
          <g className={`${p}-s1`}>
            <line x1="20" y1="18" x2="20" y2="50" stroke="#C6A85A" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="4"  y1="34" x2="36" y2="34" stroke="#C6A85A" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="9"  y1="23" x2="31" y2="45" stroke="#C6A85A" strokeWidth="1.7" strokeLinecap="round" />
            <line x1="31" y1="23" x2="9"  y2="45" stroke="#C6A85A" strokeWidth="1.7" strokeLinecap="round" />
          </g>
          <g className={`${p}-s2`}>
            <line x1="10" y1="49" x2="10" y2="67" stroke="#C6A85A" strokeWidth="2"   strokeLinecap="round" />
            <line x1="1"  y1="58" x2="19" y2="58" stroke="#C6A85A" strokeWidth="2"   strokeLinecap="round" />
            <line x1="3"  y1="52" x2="17" y2="64" stroke="#C6A85A" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="17" y1="52" x2="3"  y2="64" stroke="#C6A85A" strokeWidth="1.2" strokeLinecap="round" />
          </g>
          <g className={`${p}-s3`}>
            <line x1="4"  y1="72" x2="4"  y2="84" stroke="#C6A85A" strokeWidth="1.3" strokeLinecap="round" opacity=".82" />
            <line x1="-2" y1="78" x2="10" y2="78" stroke="#C6A85A" strokeWidth="1.3" strokeLinecap="round" opacity=".82" />
          </g>
        </>
      )}

      {/* ═══ SONAR — alert ═══ */}
      {c.sonar && (
        <>
          <circle className={`${p}-p1`} cx="136" cy="26" r="5" fill="none" stroke="#C6A85A" strokeWidth="2"   />
          <circle className={`${p}-p2`} cx="136" cy="26" r="5" fill="none" stroke="#C6A85A" strokeWidth="1.4" />
          <circle cx="136" cy="26" r="6.5" fill="#C6A85A" />
          <circle cx="136" cy="26" r="2.5" fill="#05090f" />
        </>
      )}

      {/* ═══ ZZZ — sleep ═══ */}
      {c.zzz && (
        <>
          <g className={`${p}-z1`} style={{ transformOrigin: "124px 112px" }}>
            <text x="118" y="115" fontFamily="'Palatino Linotype',Georgia,serif" fontSize="14" fill="#C6A85A" fontWeight="700" fontStyle="italic">z</text>
          </g>
          <g className={`${p}-z2`} style={{ transformOrigin: "134px 94px" }}>
            <text x="127" y="97"  fontFamily="'Palatino Linotype',Georgia,serif" fontSize="20" fill="#C6A85A" fontWeight="700" fontStyle="italic">z</text>
          </g>
          <g className={`${p}-z3`} style={{ transformOrigin: "144px 72px" }}>
            <text x="138" y="75"  fontFamily="'Palatino Linotype',Georgia,serif" fontSize="12" fill="#C6A85A" fontWeight="700" fontStyle="italic">z</text>
          </g>
        </>
      )}

      {/* ═══ TERMINAL — analyse ═══ */}
      {c.terminal && (
        <>
          <rect x="2" y="172" width="38" height="30" rx="4" fill="#040c18" stroke="#C6A85A" strokeWidth=".9" />
          <rect x="4" y="174" width="34" height="4"  rx="1.5" fill="#C6A85A" opacity=".2" />
          <line className={`${p}-d1`} x1="6" y1="183" x2="34" y2="183" stroke="#C6A85A" strokeWidth=".9" />
          <line className={`${p}-d2`} x1="6" y1="189" x2="32" y2="189" stroke="#C6A85A" strokeWidth=".9" />
          <line className={`${p}-d3`} x1="6" y1="195" x2="30" y2="195" stroke="#C6A85A" strokeWidth=".9" />
        </>
      )}
    </svg>
  );
}
