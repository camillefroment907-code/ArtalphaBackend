// app/onboarding/step3.tsx — Budget d'acquisition

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { saveOnboardingData } from '@/lib/onboarding';

const BUDGETS = [
  { value: 'under_5k',    label: 'Moins de 5 000 €',      sub: 'Marché secondaire émergent' },
  { value: '5k_25k',      label: '5 000 – 25 000 €',      sub: 'Segment mid-market' },
  { value: '25k_100k',    label: '25 000 – 100 000 €',    sub: 'Artistes établis' },
  { value: 'over_100k',   label: '100 000 € et plus',      sub: 'Blue-chip et grandes maisons' },
];

export default function Step3() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    await saveOnboardingData({ budget: selected });
    router.push('/onboarding/step4');
  };

  return (
    <View style={s.container}>
      <View style={s.topRow}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <View style={s.dots}>
          {[1,2,3,4,5,6,7].map(i => (
            <View key={i} style={[s.dot, i === 3 && s.dotActive]} />
          ))}
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.header}>
        <Text style={s.step}>3 / 7</Text>
        <Text style={s.title}>Budget d'acquisition</Text>
        <Text style={s.sub}>Par œuvre, en moyenne.</Text>
      </View>

      <View style={s.options}>
        {BUDGETS.map(b => {
          const active = selected === b.value;
          return (
            <Pressable
              key={b.value}
              style={[s.card, active && s.cardActive]}
              onPress={() => setSelected(b.value)}
            >
              <View style={[s.radio, active && s.radioActive]}>
                {active && <View style={s.radioDot} />}
              </View>
              <View style={s.cardContent}>
                <Text style={[s.cardLabel, active && s.cardLabelActive]}>{b.label}</Text>
                <Text style={s.cardSub}>{b.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={s.footer}>
        <Pressable
          style={[s.cta, !selected && s.ctaOff]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={s.ctaTxt}>Continuer</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/onboarding/step4')} style={s.skip}>
          <Text style={s.skipTxt}>Passer cette étape</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bgPrimary, paddingHorizontal: 24 },
  topRow:         { flexDirection: 'row', alignItems: 'center', paddingTop: 60 },
  back:           { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:        { fontSize: 20, color: Colors.textSecondary },
  dots:           { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.bgTertiary },
  dotActive:      { backgroundColor: Colors.textPrimary, width: 20 },
  header:         { paddingTop: 24, paddingBottom: 28 },
  step:           { fontSize: Fonts.base, color: Colors.textTertiary, marginBottom: 8 },
  title:          { fontSize: Fonts['4xl'], fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.8, marginBottom: 8 },
  sub:            { fontSize: Fonts.lg, color: Colors.textSecondary },
  options:        { flex: 1, gap: 9 },
  card:           { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, padding: 16 },
  cardActive:     { borderColor: Colors.textPrimary, borderWidth: 1.5, backgroundColor: '#F8F8F8' },
  radio:          { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borderSecondary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioActive:    { borderColor: Colors.textPrimary },
  radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.textPrimary },
  cardContent:    { flex: 1 },
  cardLabel:      { fontSize: Fonts.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  cardLabelActive:{},
  cardSub:        { fontSize: Fonts.base, color: Colors.textTertiary },
  footer:         { paddingVertical: 20, gap: 10 },
  cta:            { backgroundColor: Colors.textPrimary, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  ctaOff:         { opacity: 0.35 },
  ctaTxt:         { color: Colors.bgPrimary, fontSize: Fonts.lg, fontWeight: '600' },
  skip:           { alignItems: 'center', paddingVertical: 6 },
  skipTxt:        { fontSize: Fonts.base, color: Colors.textTertiary },
});
