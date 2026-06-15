// app/onboarding/step1.tsx — Qui êtes-vous ?

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { saveOnboardingData } from '@/lib/onboarding';

const OPTIONS = [
  { value: 'collector' as const, label: 'Collectionneur', sub: 'Je constitue et gère mon patrimoine art' },
  { value: 'advisor'   as const, label: 'Art Advisor',    sub: 'Je conseille des clients sur leurs achats' },
  { value: 'gallery'   as const, label: 'Galerie',         sub: 'Je vends et prise des œuvres' },
  { value: 'investor'  as const, label: 'Investisseur',    sub: "L'art comme actif patrimonial" },
];

export default function Step1() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selected) return;
    await saveOnboardingData({ profileType: selected as never });
    router.push('/onboarding/step2');
  };

  return (
    <View style={s.container}>
      <View style={s.dots}>
        {[1,2,3,4,5,6,7].map(i => (
          <View key={i} style={[s.dot, i === 1 && s.dotActive]} />
        ))}
      </View>

      <View style={s.header}>
        <Text style={s.step}>1 / 7</Text>
        <Text style={s.title}>Vous êtes…</Text>
        <Text style={s.sub}>Nautilus s'adapte à votre profil.</Text>
      </View>

      <View style={s.options}>
        {OPTIONS.map(opt => (
          <Pressable
            key={opt.value}
            style={[s.card, selected === opt.value && s.cardActive]}
            onPress={() => setSelected(opt.value)}
          >
            <Text style={[s.cardLabel, selected === opt.value && s.cardLabelActive]}>
              {opt.label}
            </Text>
            <Text style={[s.cardSub, selected === opt.value && s.cardSubActive]}>
              {opt.sub}
            </Text>
          </Pressable>
        ))}
      </View>

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
  container: { flex: 1, backgroundColor: Colors.bgPrimary, paddingHorizontal: 24 },
  dots:      { flexDirection: 'row', gap: 6, paddingTop: 64, paddingBottom: 4, alignSelf: 'center' },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.bgTertiary },
  dotActive: { backgroundColor: Colors.textPrimary, width: 20 },
  header:    { paddingTop: 28, paddingBottom: 32 },
  step:      { fontSize: Fonts.base, color: Colors.textTertiary, marginBottom: 8 },
  title:     { fontSize: Fonts['4xl'], fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.8, marginBottom: 8 },
  sub:       { fontSize: Fonts.lg, color: Colors.textSecondary },
  options:   { flex: 1, gap: 10 },
  card:      { borderWidth: 1, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, padding: 16, paddingVertical: 18 },
  cardActive:{ borderColor: Colors.textPrimary, borderWidth: 1.5, backgroundColor: '#F8F8F8' },
  cardLabel: { fontSize: Fonts.xl, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3 },
  cardLabelActive: {},
  cardSub:   { fontSize: Fonts.base, color: Colors.textTertiary },
  cardSubActive: { color: Colors.textSecondary },
  footer:    { paddingVertical: 24 },
  cta:       { backgroundColor: Colors.textPrimary, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  ctaOff:    { opacity: 0.35 },
  ctaTxt:    { color: Colors.bgPrimary, fontSize: Fonts.lg, fontWeight: '600' },
});
