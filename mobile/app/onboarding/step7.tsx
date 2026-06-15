// app/onboarding/step7.tsx — Votre intelligence est prête (wow moment)

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { markOnboardingComplete, saveOnboardingData } from '@/lib/onboarding';

const STATS = [
  { value: '2.3B€',   label: "de ventes analysées" },
  { value: '180 000', label: "œuvres en base" },
  { value: '4 200',   label: "artistes suivis" },
];

export default function Step7() {
  const router = useRouter();

  const handleStart = async () => {
    await saveOnboardingData({ completedAt: new Date().toISOString() });
    await markOnboardingComplete();
    router.replace('/(tabs)');
  };

  return (
    <View style={s.container}>

      <View style={s.dots}>
        {[1,2,3,4,5,6,7].map(i => (
          <View key={i} style={[s.dot, i === 7 && s.dotActive]} />
        ))}
      </View>

      <View style={s.center}>
        <View style={s.logoRing}>
          <Text style={s.logoMark}>N</Text>
        </View>

        <Text style={s.title}>Votre intelligence{'\n'}est opérationnelle.</Text>
        <Text style={s.sub}>
          Nautilus analyse le marché en continu{'\n'}et détecte les opportunités avant les autres.
        </Text>

        <View style={s.divider} />

        <View style={s.statsRow}>
          {STATS.map(st => (
            <View key={st.value} style={s.stat}>
              <Text style={s.statValue}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.divider} />
      </View>

      <View style={s.footer}>
        <Pressable style={s.cta} onPress={handleStart}>
          <Text style={s.ctaTxt}>Découvrir Nautilus →</Text>
        </Pressable>
        <Text style={s.legal}>
          Intelligence marché · Données temps réel · Nautilus 2026
        </Text>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.textPrimary, paddingHorizontal: 28 },

  dots:      { flexDirection: 'row', gap: 6, paddingTop: 64, justifyContent: 'center' },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: Colors.green, width: 20 },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },

  logoRing:  { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: Colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  logoMark:  { fontSize: 28, fontWeight: '700', color: Colors.green, letterSpacing: -1 },

  title:     { fontSize: Fonts['3xl'], fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.6, textAlign: 'center', lineHeight: 32, marginBottom: 14 },
  sub:       { fontSize: Fonts.lg, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22 },

  divider:   { width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 28 },

  statsRow:  { flexDirection: 'row', gap: 28 },
  stat:      { alignItems: 'center' },
  statValue: { fontSize: Fonts.xl, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  statLabel: { fontSize: Fonts.xs, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },

  footer:    { paddingBottom: 40, gap: 14 },
  cta:       { backgroundColor: Colors.green, borderRadius: Radius.md, padding: 18, alignItems: 'center' },
  ctaTxt:    { color: '#FFFFFF', fontSize: Fonts.lg, fontWeight: '700', letterSpacing: 0.2 },
  legal:     { textAlign: 'center', fontSize: Fonts.xs, color: 'rgba(255,255,255,0.3)' },
});
