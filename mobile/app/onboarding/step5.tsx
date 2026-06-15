// app/onboarding/step5.tsx — Médiums favoris

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { saveOnboardingData } from '@/lib/onboarding';

const CATEGORIES = [
  'Peinture', 'Photographie', 'Sculpture', 'Estampe',
  'Dessin', 'Art vidéo', 'Art numérique', 'Art textile',
];

export default function Step5() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (v: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  };

  const handleContinue = async () => {
    await saveOnboardingData({ categories: Array.from(selected) });
    router.push('/onboarding/step6');
  };

  return (
    <View style={s.container}>
      <View style={s.topRow}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <View style={s.dots}>
          {[1,2,3,4,5,6,7].map(i => (
            <View key={i} style={[s.dot, i === 5 && s.dotActive]} />
          ))}
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.header}>
        <Text style={s.step}>5 / 7</Text>
        <Text style={s.title}>Vos médiums</Text>
        <Text style={s.sub}>Quelles catégories vous intéressent ?</Text>
      </View>

      <View style={s.grid}>
        {CATEGORIES.map(cat => {
          const active = selected.has(cat);
          return (
            <Pressable
              key={cat}
              style={[s.chip, active && s.chipActive]}
              onPress={() => toggle(cat)}
            >
              <Text style={[s.chipTxt, active && s.chipTxtActive]}>{cat}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View style={s.footer}>
        <Pressable style={s.cta} onPress={handleContinue}>
          <Text style={s.ctaTxt}>Continuer</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/onboarding/step6')} style={s.skip}>
          <Text style={s.skipTxt}>Passer cette étape</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bgPrimary, paddingHorizontal: 24 },
  topRow:       { flexDirection: 'row', alignItems: 'center', paddingTop: 60 },
  back:         { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:      { fontSize: 20, color: Colors.textSecondary },
  dots:         { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.bgTertiary },
  dotActive:    { backgroundColor: Colors.textPrimary, width: 20 },
  header:       { paddingTop: 24, paddingBottom: 28 },
  step:         { fontSize: Fonts.base, color: Colors.textTertiary, marginBottom: 8 },
  title:        { fontSize: Fonts['4xl'], fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.8, marginBottom: 8 },
  sub:          { fontSize: Fonts.lg, color: Colors.textSecondary },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:         { paddingHorizontal: 16, paddingVertical: 11, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderSecondary },
  chipActive:   { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  chipTxt:      { fontSize: Fonts.md, color: Colors.textSecondary, fontWeight: '500' },
  chipTxtActive:{ color: Colors.bgPrimary },
  footer:       { paddingVertical: 20, gap: 10 },
  cta:          { backgroundColor: Colors.textPrimary, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  ctaTxt:       { color: Colors.bgPrimary, fontSize: Fonts.lg, fontWeight: '600' },
  skip:         { alignItems: 'center', paddingVertical: 6 },
  skipTxt:      { fontSize: Fonts.base, color: Colors.textTertiary },
});
