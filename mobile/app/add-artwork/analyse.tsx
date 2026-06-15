// app/add-artwork/analyse.tsx — Analysis loading (étape 46%)

import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Radius } from '@/lib/tokens';

export default function AnalyseScreen() {
  const router = useRouter();

  return (
    <View style={s.container}>
      {/* ── Topbar ── */}
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <Text style={s.tbTitle}>Analyse en cours</Text>
        <Text style={s.tbStep}>2/4</Text>
      </View>
      <View style={s.progBg}><View style={[s.progFill, { width: '46%' }]} /></View>

      <View style={s.content}>
        <ActivityIndicator size="large" color={Colors.green} style={s.spinner} />
        <Text style={s.loadingTxt}>Analyse de votre œuvre…</Text>
        <Text style={s.loadingSub}>Identification de l'artiste et du titre</Text>

        <Pressable
          style={s.secondaryBtn}
          onPress={() => router.push('/add-artwork/result')}
        >
          <Text style={s.secondaryBtnTxt}>→ Voir le résultat</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bgPrimary },
  topbar:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  backBtn:         { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:         { fontSize: 20, color: Colors.textSecondary },
  tbTitle:         { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  tbStep:          { fontSize: Fonts.base, color: Colors.textTertiary },
  progBg:          { height: 2, backgroundColor: Colors.bgSecondary },
  progFill:        { height: 2, backgroundColor: Colors.green },
  content:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, paddingHorizontal: 16 },
  spinner:         { marginBottom: 14 },
  loadingTxt:      { fontSize: Fonts.md, color: Colors.textSecondary, marginBottom: 5 },
  loadingSub:      { fontSize: 11, color: Colors.textTertiary, marginBottom: 22 },
  secondaryBtn:    { paddingVertical: 11, paddingHorizontal: 20, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderSecondary },
  secondaryBtnTxt: { fontSize: Fonts.md, color: Colors.textSecondary },
});
