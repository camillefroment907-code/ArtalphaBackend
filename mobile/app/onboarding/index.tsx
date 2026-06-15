// app/onboarding/index.tsx — 3-screen onboarding (valeur avant inscription)
// Règle : montrer la valeur du produit AVANT de demander email/password
// Post-onboarding : /auth/register (nouveau) ou /auth/login (existant)

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
import { markOnboardingComplete } from '@/lib/onboarding';

const { width: SW } = Dimensions.get('window');

// ── Slide 3 — Estimation mockée (style price.tsx) ────────────────────────────

function MockEstimationCard() {
  return (
    <View style={mock.card}>
      <View style={mock.topRow}>
        <Text style={mock.cardTitle}>Valeur de marché estimée</Text>
        <View style={mock.grade}>
          <Text style={mock.gradeTxt}>Grade A</Text>
        </View>
      </View>
      <Text style={mock.range}>1 140 000 — 3 806 000 €</Text>
      <Text style={mock.median}>Médiane estimée · 2 340 000 €</Text>
      <View style={mock.metaRow}>
        <Text style={mock.meta}>200 ventes analysées</Text>
        <Text style={mock.trend}>↑ En hausse</Text>
      </View>
      <View style={mock.recap}>
        <Text style={mock.recapArtist}>Pablo Picasso</Text>
        <Text style={mock.recapTitle}>Huile sur toile, 1962</Text>
      </View>
    </View>
  );
}

const mock = StyleSheet.create({
  card:      { borderWidth: 1.5, borderColor: Colors.gold, borderRadius: Radius.lg, padding: 16, backgroundColor: 'rgba(27,79,204,0.08)', width: SW - Spacing.xl * 2 - 16 },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: FontSize.sm, color: Colors.gold, fontFamily: FontFamily.sansSemibold },
  grade:     { borderWidth: 1, borderColor: Colors.gold, borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  gradeTxt:  { fontSize: FontSize.xs, color: Colors.gold, fontFamily: FontFamily.sansBold, letterSpacing: 0.3 },
  range:     { fontSize: FontSize['2xl'], fontFamily: FontFamily.serifBold, color: Colors.textOnDark, letterSpacing: -0.5, marginBottom: 3 },
  median:    { fontSize: FontSize.sm, color: Colors.textOnDarkMuted, fontFamily: FontFamily.sans, marginBottom: 10 },
  metaRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  meta:      { fontSize: FontSize.xs, color: Colors.textOnDarkSubtle, fontFamily: FontFamily.sans },
  trend:     { fontSize: FontSize.xs, color: Colors.gold, fontFamily: FontFamily.sansSemibold },
  recap:     { gap: 2 },
  recapArtist: { fontSize: FontSize.xs, color: Colors.textOnDarkMuted, fontFamily: FontFamily.sans },
  recapTitle:  { fontSize: FontSize.sm, color: Colors.textOnDark, fontFamily: FontFamily.sansMedium },
});

// ── Slides data ───────────────────────────────────────────────────────────────

interface Slide {
  id:        number;
  symbol:    string;
  title:     string;
  sub:       string;
  showMock?: boolean;
  ctaLabel:  string;
}

const SLIDES: Slide[] = [
  {
    id:       1,
    symbol:   '?',
    title:    'Vous possédez\ndes œuvres d\'art.',
    sub:      'Mais savez-vous\nce qu\'elles valent aujourd\'hui ?',
    ctaLabel: 'Découvrir →',
  },
  {
    id:       2,
    symbol:   '◈',
    title:    '1,5 million de données\nde marché analysées.',
    sub:      'Nautilus estime chaque œuvre que vous possédez grâce aux données du marché réel.',
    ctaLabel: 'Voir comment →',
  },
  {
    id:       3,
    symbol:   'N',
    title:    'C\'est ça,\nNautilus.',
    sub:      'Commencez gratuitement.\nAjoutez une œuvre, recevez son estimation.',
    showMock: true,
    ctaLabel: 'Créer mon compte gratuit →',
  },
];

// ── Screen ─────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router    = useRouter();
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const slide  = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const goToLogin = async () => {
    await markOnboardingComplete();
    router.replace('/auth/login');
  };

  const next = async () => {
    if (isLast) {
      await markOnboardingComplete();
      router.replace('/auth/register');
    } else {
      const nextStep = step + 1;
      setStep(nextStep);
      scrollRef.current?.scrollTo({ x: nextStep * SW, animated: true });
    }
  };

  return (
    <View style={s.root}>

      {/* ── "J'ai déjà un compte" — visible sur chaque slide ── */}
      <Pressable style={s.loginLink} onPress={goToLogin}>
        <Text style={s.loginLinkTxt}>J'ai déjà un compte</Text>
      </Pressable>

      {/* ── Slides ── */}
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
            {sl.showMock ? (
              <>
                <MockEstimationCard />
                <View style={s.mockTextWrap}>
                  <Text style={s.title}>{sl.title}</Text>
                  <Text style={s.sub}>{sl.sub}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={s.symbolWrap}>
                  <Text style={s.symbol}>{sl.symbol}</Text>
                </View>
                <Text style={s.title}>{sl.title}</Text>
                <Text style={s.sub}>{sl.sub}</Text>
              </>
            )}
          </View>
        ))}
      </ScrollView>

      {/* ── Bottom controls ── */}
      <View style={s.controls}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotActive]} />
          ))}
        </View>

        <Pressable style={s.btn} onPress={next}>
          <Text style={s.btnText}>{slide.ctaLabel}</Text>
        </Pressable>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgDark },

  // "J'ai déjà un compte" — top right
  loginLink:    { position: 'absolute', top: 56, right: Spacing.lg, zIndex: 10, paddingVertical: 6, paddingHorizontal: 2 },
  loginLinkTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textOnDarkSubtle, textDecorationLine: 'underline' },

  scrollView: { flex: 1 },
  slide: {
    width: SW,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 100,
    gap: 20,
  },

  symbolWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { fontSize: FontSize['3xl'], fontFamily: FontFamily.serifBold, color: Colors.gold },

  title: {
    fontSize: FontSize['4xl'],
    fontFamily: FontFamily.serifBold,
    color: Colors.textOnDark,
    textAlign: 'center',
    lineHeight: FontSize['4xl'] * 1.18,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sans,
    color: Colors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: FontSize.md * 1.6,
  },

  mockTextWrap: { alignItems: 'center', gap: 8, marginTop: 4 },

  // Controls
  controls: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 52,
    alignItems: 'center',
    gap: 16,
  },
  dots:      { flexDirection: 'row', gap: 6 },
  dot:       { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: Colors.borderOnDark },
  dotActive: { backgroundColor: Colors.gold, width: 18 },

  btn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignSelf: 'stretch',
    alignItems: 'center',
    ...Shadow.gold,
  },
  btnText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemibold,
    color: Colors.textOnDark,
    letterSpacing: 0.2,
  },
});
