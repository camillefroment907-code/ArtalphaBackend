// app/onboarding/step2.tsx — Vos objectifs (multi-select)

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { saveOnboardingData } from '@/lib/onboarding';

const GOALS = [
  { value: 'undervalued', label: 'Identifier les sous-évaluées',    sub: 'Avant que le marché ne les repère' },
  { value: 'track',       label: 'Suivre des artistes',              sub: 'Alertes et signaux en temps réel' },
  { value: 'price',       label: 'Valoriser mes œuvres',             sub: 'Prix de marché basés sur les ventes réelles' },
  { value: 'build',       label: 'Construire une collection',        sub: 'Structurée, diversifiée, performante' },
];

export default function Step2() {
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
    if (selected.size === 0) return;
    await saveOnboardingData({ goals: Array.from(selected) });
    router.push('/onboarding/step3');
  };

  return (
    <View style={s.container}>
      <View style={s.topRow}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <View style={s.dots}>
          {[1,2,3,4,5,6,7].map(i => (
            <View key={i} style={[s.dot, i === 2 && s.dotActive]} />
          ))}
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.header}>
        <Text style={s.step}>2 / 7</Text>
        <Text style={s.title}>Pourquoi Nautilus ?</Text>
        <Text style={s.sub}>Choisissez tout ce qui vous correspond.</Text>
      </View>

      <View style={s.options}>
        {GOALS.map(g => {
          const active = selected.has(g.value);
          return (
            <Pressable
              key={g.value}
              style={[s.card, active && s.cardActive]}
              onPress={() => toggle(g.value)}
            >
              <View style={s.cardLeft}>
                <View style={[s.check, active && s.checkActive]}>
                  {active && <Text style={s.checkMark}>✓</Text>}
                </View>
              </View>
              <View style={s.cardRight}>
                <Text style={[s.cardLabel, active && s.cardLabelActive]}>{g.label}</Text>
                <Text style={s.cardSub}>{g.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={s.footer}>
        <Pressable
          style={[s.cta, selected.size === 0 && s.ctaOff]}
          onPress={handleContinue}
          disabled={selected.size === 0}
        >
          <Text style={s.ctaTxt}>Continuer</Text>
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
  card:           { flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderWidth: 1, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, padding: 15 },
  cardActive:     { borderColor: Colors.textPrimary, borderWidth: 1.5, backgroundColor: '#F8F8F8' },
  cardLeft:       { paddingTop: 2 },
  check:          { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.borderSecondary, alignItems: 'center', justifyContent: 'center' },
  checkActive:    { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  checkMark:      { color: Colors.bgPrimary, fontSize: 11, fontWeight: '700' },
  cardRight:      { flex: 1 },
  cardLabel:      { fontSize: Fonts.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  cardLabelActive:{},
  cardSub:        { fontSize: Fonts.base, color: Colors.textTertiary },
  footer:         { paddingVertical: 24 },
  cta:            { backgroundColor: Colors.textPrimary, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  ctaOff:         { opacity: 0.35 },
  ctaTxt:         { color: Colors.bgPrimary, fontSize: Fonts.lg, fontWeight: '600' },
});
