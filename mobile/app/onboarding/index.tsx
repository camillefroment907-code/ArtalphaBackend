// app/onboarding/index.tsx — Carrousel intro Nautilus (3 slides pré-inscription)
// Fond linen #F7F4EE · Texte ink #1A1A1A · Accent bleu #1B4FCC
// Slide 1 : organisation · Slide 2 : fiche œuvre · Slide 3 : conversion

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
  FontFamily,
  FontSize,
  Spacing,
  Radius,
} from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { markOnboardingComplete } from '@/lib/onboarding';

const ONBOARDING_VERSION_KEY = 'nautilus_onboarding_version';
const ONBOARDING_VERSION     = '2';

async function markOnboardingCompleteWithVersion() {
  await markOnboardingComplete();
  await AsyncStorage.setItem(ONBOARDING_VERSION_KEY, ONBOARDING_VERSION);
}

const { width: SW } = Dimensions.get('window');

const INK    = '#1A1A1A';
const LINEN  = '#F7F4EE';
const MUTED  = '#6E6E73';
const BLUE   = '#1B4FCC';
const BORDER = '#E8E4DC';

// ── Slide 2 — Fiche œuvre élégante ───────────────────────────────────────────

function MockArtworkCard() {
  const docs = ['Certificat', 'Facture', 'Provenance'];
  return (
    <View style={card.wrap}>
      <View style={card.image} />
      <View style={card.body}>
        <Text style={card.artist}>Marc Chagall</Text>
        <Text style={card.title}>Les amoureux</Text>
        <Text style={card.date}>Huile sur toile · 1928</Text>
        <View style={card.docs}>
          {docs.map((d) => (
            <View key={d} style={card.chip}>
              <Text style={card.chipDot}>·</Text>
              <Text style={card.chipTxt}>{d}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  wrap: {
    width: SW - Spacing.xl * 2 - 16,
    borderRadius: Radius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  image: {
    height: 160,
    backgroundColor: '#D9D3C7',
  },
  body: {
    padding: 20,
    gap: 4,
  },
  artist: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.sans,
    color: MUTED,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: FontSize['2xl'],
    fontFamily: FontFamily.serifBold,
    color: INK,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  date: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.sans,
    color: MUTED,
    marginBottom: 12,
  },
  docs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: LINEN,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipDot: { fontSize: 10, color: BLUE },
  chipTxt: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.sansMedium,
    color: INK,
  },
});

// ── Slides ────────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id:       1,
    title:    'Toute votre\ncollection.\nEnfin organisée.',
    sub:      'Toutes les informations importantes de votre collection réunies dans un seul espace.',
    ctaLabel: 'Découvrir →',
    showCard: false,
  },
  {
    id:       2,
    title:    'Tout ce qui compte\nsur chaque œuvre.',
    sub:      'Certificat. Facture. Provenance. Historique.\nToujours à portée de main.',
    ctaLabel: 'Voir comment →',
    showCard: true,
  },
  {
    id:       3,
    title:    'Votre collection\nmérite mieux\nqu\'un tableur.',
    sub:      'Organisez vos œuvres, retrouvez vos documents et accédez à des estimations actualisées quand vous le souhaitez.',
    ctaLabel: null,
    showCard: false,
  },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router    = useRouter();
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const slide  = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const goToLogin = async () => {
    await markOnboardingCompleteWithVersion();
    router.replace('/auth/login');
  };

  const next = async () => {
    if (isLast) {
      await markOnboardingCompleteWithVersion();
      router.replace('/auth/register');
    } else {
      const nextStep = step + 1;
      setStep(nextStep);
      scrollRef.current?.scrollTo({ x: nextStep * SW, animated: true });
    }
  };

  return (
    <View style={s.root}>

      {/* Skip — visible slides 1 et 2 seulement */}
      {!isLast && (
        <Pressable style={s.skip} onPress={goToLogin}>
          <Text style={s.skipTxt}>J'ai déjà un compte</Text>
        </Pressable>
      )}

      {/* Slides */}
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
            {sl.showCard && <MockArtworkCard />}
            <View style={[s.textBlock, sl.showCard && s.textBlockCompact]}>
              <Text style={[s.title, sl.showCard && s.titleSmall]}>{sl.title}</Text>
              <Text style={s.sub}>{sl.sub}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Contrôles bas */}
      <View style={s.controls}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotActive]} />
          ))}
        </View>

        {isLast ? (
          <View style={s.conversionBtns}>
            <Pressable style={s.btnPrimary} onPress={next}>
              <Text style={s.btnPrimaryTxt}>Créer ma collection →</Text>
            </Pressable>
            <Pressable onPress={goToLogin} style={s.loginHint}>
              <Text style={s.loginHintTxt}>J'ai déjà un compte</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={s.btn} onPress={next}>
            <Text style={s.btnTxt}>{slide.ctaLabel}</Text>
          </Pressable>
        )}
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: LINEN },

  skip:    { position: 'absolute', top: 56, right: Spacing.lg, zIndex: 10, paddingVertical: 6 },
  skipTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: MUTED },

  scrollView: { flex: 1 },
  slide: {
    width: SW,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 80,
    gap: 28,
  },

  textBlock:        { alignItems: 'center', gap: 14 },
  textBlockCompact: { gap: 10 },

  title: {
    fontSize: FontSize['4xl'],
    fontFamily: FontFamily.serifBold,
    color: INK,
    textAlign: 'center',
    lineHeight: FontSize['4xl'] * 1.2,
    letterSpacing: -0.5,
  },
  titleSmall: {
    fontSize: FontSize['3xl'],
    lineHeight: FontSize['3xl'] * 1.2,
  },
  sub: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sans,
    color: MUTED,
    textAlign: 'center',
    lineHeight: FontSize.md * 1.65,
    maxWidth: 320,
  },

  // Controls
  controls: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 52,
    alignItems: 'center',
    gap: 16,
  },
  dots:      { flexDirection: 'row', gap: 6 },
  dot:       { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: BORDER },
  dotActive: { backgroundColor: INK, width: 20 },

  // CTA slides 1 & 2
  btn: {
    backgroundColor: INK,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  btnTxt: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemibold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Slide 3 — conversion
  conversionBtns:  { alignSelf: 'stretch', gap: 14 },
  btnPrimary: {
    backgroundColor: INK,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnPrimaryTxt: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemibold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  loginHint:    { alignItems: 'center', paddingVertical: 4 },
  loginHintTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: BLUE },
});
