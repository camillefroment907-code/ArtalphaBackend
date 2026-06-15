// app/onboarding/index.tsx — 4-screen onboarding (replaces step1–7 flow)
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import {
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadow,
} from '@/constants/theme';

const { width: SW } = Dimensions.get('window');

interface Slide {
  step:    number;
  title:   string;
  sub:     string;
  symbol:  string;
  accent?: string;
}

const SLIDES: Slide[] = [
  {
    step:   1,
    symbol: '∿',
    title:  'Votre collection\nmérite mieux\nqu\'un tableur.',
    sub:    'Nautilus centralise toutes vos œuvres et vous donne leur valeur de marché en temps réel.',
    accent: Colors.gold,
  },
  {
    step:   2,
    symbol: '◈',
    title:  'Connaissez chaque\nœuvre comme\nson galeriste.',
    sub:    'Provenance, cote, historique de ventes — toute l\'intelligence du marché en un clic.',
    accent: Colors.gold,
  },
  {
    step:   3,
    symbol: '⬡',
    title:  'Anticipez avant\nles autres\ncollectionneurs.',
    sub:    'Alertes de marché, opportunités détectées par l\'IA, signaux d\'achat et de vente.',
    accent: Colors.gold,
  },
  {
    step:   4,
    symbol: 'N',
    title:  'Bienvenue dans\nNautilus.',
    sub:    'Commencez par ajouter votre première œuvre. La valorisation arrive en quelques secondes.',
    accent: Colors.gold,
  },
];

export default function OnboardingScreen() {
  const router    = useRouter();
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const next = () => {
    if (isLast) {
      router.replace('/(tabs)');
    } else {
      const nextStep = step + 1;
      setStep(nextStep);
      scrollRef.current?.scrollTo({ x: nextStep * SW, animated: true });
    }
  };

  const skip = () => router.replace('/(tabs)');

  return (
    <View style={s.root}>
      {/* Slides (non-interactive scroll — driven by state) */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={s.scrollView}
      >
        {SLIDES.map((sl, i) => (
          <View key={i} style={s.slide}>
            <View style={[s.symbolWrap, { borderColor: sl.accent }]}>
              <Text style={[s.symbol, { color: sl.accent }]}>{sl.symbol}</Text>
            </View>
            <Text style={s.title}>{sl.title}</Text>
            <Text style={s.sub}>{sl.sub}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View style={s.controls}>
        {/* Dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[s.dot, i === step && s.dotActive]}
            />
          ))}
        </View>

        {/* CTA */}
        <Pressable style={s.btn} onPress={next}>
          <Text style={s.btnText}>
            {isLast ? 'Commencer →' : 'Suivant'}
          </Text>
        </Pressable>

        {/* Skip */}
        {!isLast && (
          <Pressable style={s.skipLink} onPress={skip}>
            <Text style={s.skipTxt}>Passer</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgDark },

  scrollView: { flex: 1 },
  slide: {
    width: SW,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 80,
  },

  symbolWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  symbol: {
    fontSize: FontSize['3xl'],
    fontFamily: FontFamily.serifBold,
  },

  title: {
    fontSize: FontSize['4xl'],
    fontFamily: FontFamily.serifBold,
    color: Colors.textOnDark,
    textAlign: 'center',
    lineHeight: FontSize['4xl'] * 1.18,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  sub: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sans,
    color: Colors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: FontSize.md * 1.6,
    paddingHorizontal: 8,
  },

  // Controls
  controls: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 52,
    alignItems: 'center',
    gap: 16,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderOnDark,
  },
  dotActive: {
    backgroundColor: Colors.gold,
    width: 18,
  },

  btn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: 15,
    paddingHorizontal: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    ...Shadow.gold,
  },
  btnText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemibold,
    color: Colors.bgDark,
    letterSpacing: 0.2,
  },

  skipLink: { paddingVertical: 4 },
  skipTxt:  { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textOnDarkSubtle },
});
