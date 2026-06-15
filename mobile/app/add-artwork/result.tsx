// app/add-artwork/result.tsx — AI result confirmation (étape 58%)

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Radius } from '@/lib/tokens';

// Résultat simulé — en production, viendrait des params de l'étape analyse
const MOCK = {
  emoji:  '🎨',
  artist: 'KAREL APPEL · 1921–2006',
  title:  'Composition bleue',
  medium: '1958 · Huile sur toile',
  // Valeurs à passer aux étapes suivantes
  artistName: 'Karel Appel',
  year:       '1958',
  mediumVal:  'Huile sur toile',
};

export default function ResultScreen() {
  const router = useRouter();

  const goToPrice = () =>
    router.push({
      pathname: '/add-artwork/price',
      params: {
        artistName: MOCK.artistName,
        title:      MOCK.title,
        year:       MOCK.year,
        medium:     MOCK.mediumVal,
      },
    });

  const goToEdit = () =>
    router.push({
      pathname: '/add-artwork/manual',
      params: {
        artistName: MOCK.artistName,
        title:      MOCK.title,
        year:       MOCK.year,
        medium:     MOCK.mediumVal,
      },
    });

  return (
    <View style={s.container}>
      {/* ── Topbar ── */}
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <Text style={s.tbTitle}>Vérifier</Text>
        <Text style={s.tbStep}>3/4</Text>
      </View>
      <View style={s.progBg}><View style={[s.progFill, { width: '58%' }]} /></View>

      <View style={s.content}>
        <Text style={s.foundTxt}>Nous avons trouvé :</Text>

        {/* Result card */}
        <View style={s.resultCard}>
          <View style={s.rcImg}><Text style={s.rcEmoji}>{MOCK.emoji}</Text></View>
          <Text style={s.rcArtist}>{MOCK.artist}</Text>
          <Text style={s.rcTitle}>{MOCK.title}</Text>
          <Text style={s.rcMedium}>{MOCK.medium}</Text>
        </View>

        <Pressable style={s.primaryBtn} onPress={goToPrice}>
          <Text style={s.primaryBtnTxt}>✓  Confirmer</Text>
        </Pressable>

        <Pressable style={s.secondaryBtn} onPress={goToEdit}>
          <Text style={s.secondaryBtnTxt}>✏  Modifier</Text>
        </Pressable>

        <View style={s.hint}>
          <Text style={s.hintTxt}>
            Si ce n'est pas la bonne œuvre, modifiez librement les informations.
          </Text>
        </View>
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
  content:         { flex: 1, padding: 20, paddingHorizontal: 16 },
  foundTxt:        { fontSize: Fonts.md, color: Colors.textSecondary, marginBottom: 13 },
  resultCard:      { borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, padding: 15, marginBottom: 14 },
  rcImg:           { height: 110, backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  rcEmoji:         { fontSize: 46 },
  rcArtist:        { fontSize: Fonts.xs, color: Colors.textTertiary, letterSpacing: 0.4, marginBottom: 2, textTransform: 'uppercase' },
  rcTitle:         { fontSize: Fonts.xl, fontWeight: Fonts.medium, color: Colors.textPrimary, marginBottom: 2 },
  rcMedium:        { fontSize: Fonts.base, color: Colors.textSecondary },
  primaryBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: Radius.md, backgroundColor: Colors.textPrimary, marginBottom: 9 },
  primaryBtnTxt:   { color: Colors.bgPrimary, fontSize: Fonts.lg, fontWeight: Fonts.medium },
  secondaryBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 11, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderSecondary, marginBottom: 10 },
  secondaryBtnTxt: { fontSize: Fonts.md, color: Colors.textSecondary },
  hint:            { padding: 9, paddingHorizontal: 11, backgroundColor: Colors.bgSecondary, borderRadius: Radius.md },
  hintTxt:         { fontSize: 11, color: Colors.textTertiary, lineHeight: 16 },
});
