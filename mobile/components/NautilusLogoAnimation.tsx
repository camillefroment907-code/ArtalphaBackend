// components/NautilusLogoAnimation.tsx
// Animated Nautilus logo — 4 phases, 3100ms total
// Phase 1: clip reveal top→bottom (0–1200ms)
// Phase 2: color #1A1A1A → #1B4FCC (1200–1700ms)
// Phase 3: wind flex per sail (1700–2700ms)
// Phase 4: wordmark fade+rise (2700–3100ms)

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  interpolateColor,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  G,
  Path,
  Defs,
  ClipPath,
  Rect,
} from 'react-native-svg';

// ─── Logo geometry ────────────────────────────────────────────────────────────
// Potrace paths in native coordinate space.
// Parent <G> transform: translate(0,1254) scale(0.1,-0.1)
// ViewBox: "234 180 790 689"

const SAIL1_D =
  'M5492 4389 c783 -684 1746 -1849 2368 -2864 486 -793 822 -1615 930 -2278 ' +
  '59 -361 50 -753 -25 -1047 -53 -212 -147 -422 -247 -555 l-53 -70 -648 -3 ' +
  'c-388 -1 -647 2 -647 7 0 5 11 56 24 113 105 446 159 1053 137 1531 ' +
  '-17 336 -48 599 -112 932 -219 1141 -836 2612 -1729 4120 -96 163 -113 195 ' +
  '-101 195 6 0 52 -37 103 -81z';

const SAIL2_D =
  'M4915 1903 c216 -301 345 -487 538 -776 761 -1137 1237 -2044 1465 -2797 ' +
  '62 -203 146 -557 128 -540 -2 3 -50 82 -106 175 -177 294 -452 698 -675 989 ' +
  '-147 191 -455 569 -460 564 -2 -2 -9 -50 -15 -108 -58 -523 -236 -998 ' +
  '-508 -1360 -111 -147 -315 -341 -474 -448 l-47 -32 -406 2 -405 3 89 117 ' +
  'c276 364 503 780 646 1183 192 541 285 1262 255 1966 -16 386 -40 605 ' +
  '-106 992 -19 110 -34 202 -34 203 0 20 32 -17 115 -133z';

// ViewBox dimensions for clip rect sizing
const VB_X      = 234;
const VB_Y      = 180;
const VB_W      = 790;
const VB_H      = 689;

// ─── Colors ───────────────────────────────────────────────────────────────────
const COLOR_INK  = '#1A1A1A';
const COLOR_BLUE = '#1B4FCC';

// ─── Animated SVG primitives ──────────────────────────────────────────────────
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Props ────────────────────────────────────────────────────────────────────
export type NautilusLogoAnimationProps = {
  size?:         number;
  showWordmark?: boolean;
  autoPlay?:     boolean;
  onComplete?:   () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function NautilusLogoAnimation({
  size         = 96,
  showWordmark = true,
  autoPlay     = true,
  onComplete,
}: NautilusLogoAnimationProps) {
  // Shared values
  const clip1H    = useSharedValue(0); // Phase 1 — sail 1 clip height
  const clip2H    = useSharedValue(0); // Phase 1 — sail 2 clip height
  const colorProg = useSharedValue(0); // Phase 2 — color interpolation
  const wind1X    = useSharedValue(0); // Phase 3 — sail 1 translateX
  const wind2X    = useSharedValue(0); // Phase 3 — sail 2 translateX
  const wordProg  = useSharedValue(0); // Phase 4 — wordmark

  useEffect(() => {
    if (!autoPlay) return;

    const ease = Easing.inOut(Easing.quad);
    const easeOut = Easing.out(Easing.quad);

    // Phase 1 — clip reveal
    clip1H.value = withTiming(VB_H, { duration: 900, easing: ease });
    clip2H.value = withDelay(200, withTiming(VB_H, { duration: 1000, easing: ease }));

    // Phase 2 — color shift (starts at 1200ms)
    colorProg.value = withDelay(1200, withTiming(1, { duration: 500, easing: ease }));

    // Phase 3 — wind (starts at 1700ms)
    wind1X.value = withDelay(
      1700,
      withSequence(
        withTiming(3,  { duration: 500, easing: ease }),
        withTiming(0,  { duration: 500, easing: ease }),
      ),
    );
    wind2X.value = withDelay(
      1800,
      withSequence(
        withTiming(-2, { duration: 500, easing: ease }),
        withTiming(0,  { duration: 500, easing: ease }),
      ),
    );

    // Phase 4 — wordmark (starts at 2700ms)
    wordProg.value = withDelay(
      2700,
      withTiming(1, {
        duration: 400,
        easing: easeOut,
      }),
    );

    // onComplete fires after all phases
    if (onComplete) {
      // Schedule after full 3100ms
      const timer = setTimeout(() => runOnJS(onComplete)(), 3200);
      return () => clearTimeout(timer);
    }
  }, [autoPlay]);

  // ── Animated clip rect heights ──────────────────────────────────────────────
  const clip1Props = useAnimatedProps(() => ({
    height: clip1H.value,
    y:      VB_Y,
    x:      VB_X,
    width:  VB_W,
  }));

  const clip2Props = useAnimatedProps(() => ({
    height: clip2H.value,
    y:      VB_Y,
    x:      VB_X,
    width:  VB_W,
  }));

  // ── Animated fill color (shared between both sails) ─────────────────────────
  const sail1Props = useAnimatedProps(() => ({
    fill: interpolateColor(colorProg.value, [0, 1], [COLOR_INK, COLOR_BLUE]),
  }));

  const sail2Props = useAnimatedProps(() => ({
    fill: interpolateColor(colorProg.value, [0, 1], [COLOR_INK, COLOR_BLUE]),
  }));

  // ── Phase 3 — wind translateX on G wrappers ─────────────────────────────────
  const wind1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: wind1X.value }],
  }));

  const wind2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: wind2X.value }],
  }));

  // ── Phase 4 — wordmark opacity + translateY ─────────────────────────────────
  const wordStyle = useAnimatedStyle(() => ({
    opacity:   wordProg.value,
    transform: [{ translateY: 6 * (1 - wordProg.value) }],
  }));

  // ── Layout ──────────────────────────────────────────────────────────────────
  // Logo SVG aspect: viewBox 790 × 689 → height = size * (689/790)
  const logoH   = size * (VB_H / VB_W);
  const fontSize = size * 0.14;

  return (
    <View style={[st.root, { width: size }]}>
      {/* Logo area — explicit height so wordmark is pushed below */}
      <View style={{ width: size, height: logoH }}>
        {/* Sail 1 — right sail (larger, background) */}
        <Animated.View style={[StyleSheet.absoluteFill, wind1Style]}>
          <Svg
            width={size}
            height={logoH}
            viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
          >
            <Defs>
              <ClipPath id="clip_sail1">
                <AnimatedRect animatedProps={clip1Props} />
              </ClipPath>
            </Defs>
            <G
              transform="translate(0,1254) scale(0.1,-0.1)"
              clipPath="url(#clip_sail1)"
            >
              <AnimatedPath d={SAIL1_D} animatedProps={sail1Props} />
            </G>
          </Svg>
        </Animated.View>

        {/* Sail 2 — left sail (foreground accent) */}
        <Animated.View style={[StyleSheet.absoluteFill, wind2Style]}>
          <Svg
            width={size}
            height={logoH}
            viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
          >
            <Defs>
              <ClipPath id="clip_sail2">
                <AnimatedRect animatedProps={clip2Props} />
              </ClipPath>
            </Defs>
            <G
              transform="translate(0,1254) scale(0.1,-0.1)"
              clipPath="url(#clip_sail2)"
            >
              <AnimatedPath d={SAIL2_D} animatedProps={sail2Props} />
            </G>
          </Svg>
        </Animated.View>
      </View>

      {/* Wordmark */}
      {showWordmark && (
        <Animated.Text
          style={[st.wordmark, { fontSize, marginTop: 16 }, wordStyle]}
        >
          NAUTILUS
        </Animated.Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    letterSpacing: 3,
    color: COLOR_BLUE,
    textAlign: 'center',
  },
});
