// app/onboarding/step6.tsx — Fréquence d'achat

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { saveOnboardingData } from '@/lib/onboarding';

const OPTIONS = [
  { value: 'beginner',   label: 'Je débute',          sub: "Premier achat ou très occasionnel" },
  { value: '1_2_year',   label: '1 – 2 fois par an',  sub: 'Acheteur régulier' },
  { value: '3_5_year',   label: '3 – 5 fois par an',  sub: 'Collectionneur actif' },
  { value: '6_plus',     label: '6+ fois par an',      sub: 'Professionnel du marché' },
];

export default function Step6() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    await saveOnboardingData({ frequency: selected });
    router.push('/onboarding/step7');
  };

  return (
    <View style={s.container}>
      <View style={s.topRow}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <View style={s.dots}>
          {[1,2,3,4,5,6,7].map(i => (
            <View key={i} style={[s.dot, i === 6 && s.dotActive]} />
          ))}
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.header}>
        <Text style={s.step}>6 / 7</Text>
        <Text style={s.title}>Fréquence d'achat</Text>
        <Text style={s.sub}>Combien d'œuvres achetez-vous par an ?</Text>
      </View>

      <View style={s.options}>
        {OPTIONS.map(opt => {
          const active = selected === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[s.card, active && s.cardActive]}
              onPress={() => setSelected(opt.value)}
            >
              <View style={[s.radio, active && s.radioActive]}>
                {active && <View style={s.radioDot} />}
              </View>
              <View style={s.cardContent}>
                <Text style={[s.cardLabel, active && s.cardLabelActive]}>{opt.label}</Text>
                <Text style={s.cardSub}>{opt.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View style={s.footer}>
        <Pressable
          style={[s.cta, !selected && s.ctaOff]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={s.ctaTxt}>Continuer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.bgPrimary, paddingHorizontal: 24 },
  topRow:        { flexDirection: 'row', alignItems: 'center', paddingTop: 60 },
  back:          { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:       { fontSize: 20, color: Colors.textSecondary },
  dots:          { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.bgTertiary },
  dotActive:     { backgroundColor: Colors.textPrimary, width: 20 },
  header:        { paddingTop: 24, paddingBottom: 28 },
  step:          { fontSize: Fonts.base, color: Colors.textTertiary, marginBottom: 8 },
  title:         { fontSize: Fonts['4xl'], fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.8, marginBottom: 8 },
  sub:           { fontSize: Fonts.lg, color: Colors.textSecondary },
  options:       { gap: 9 },
  card:          { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, padding: 16 },
  cardActive:    { borderColor: Colors.textPrimary, borderWidth: 1.5, backgroundColor: '#F8F8F8' },
  radio:         { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borderSecondary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioActive:   { borderColor: Colors.textPrimary },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.textPrimary },
  cardContent:   { flex: 1 },
  cardLabel:     { fontSize: Fonts.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  cardLabelActive:{},
  cardSub:       { fontSize: Fonts.base, color: Colors.textTertiary },
  footer:        { paddingVertical: 24 },
  cta:           { backgroundColor: Colors.textPrimary, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  ctaOff:        { opacity: 0.35 },
  ctaTxt:        { color: Colors.bgPrimary, fontSize: Fonts.lg, fontWeight: '600' },
});
