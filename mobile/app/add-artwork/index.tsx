// app/add-artwork/index.tsx — Mode selection (étape 12%)

import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Radius } from '@/lib/tokens';

const MODES = [
  { id: 'photo',     icon: '📷', label: 'Photo',      desc: "Photographiez l'œuvre ou son étiquette", active: true  },
  { id: 'facture',   icon: '🧾', label: 'Facture',    desc: 'Importez une facture ou un certificat',  active: false },
  { id: 'lien',      icon: '🔗', label: 'Lien',       desc: 'Artsy, Artcurial, Christie\'s, Drouot…', active: false },
  { id: 'rechercher',icon: '🔍', label: 'Rechercher', desc: 'Artiste, œuvre ou maison de vente',      active: true  },
];

export default function AddArtworkScreen() {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('show_welcome_banner').then((val) => {
      if (val) {
        setShowWelcome(true);
        AsyncStorage.removeItem('show_welcome_banner');
      }
    });
  }, []);

  const handleMode = (id: string) => {
    if (id === 'photo')      router.push('/add-artwork/photo');
    else if (id === 'rechercher') router.push('/add-artwork/search');
  };

  return (
    <View style={s.container}>
      {/* ── Topbar ── */}
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.closeBtn}>
          <Text style={s.closeTxt}>✕</Text>
        </Pressable>
        <Text style={s.tbTitle}>Ajouter une œuvre</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={s.progBg}><View style={[s.progFill, { width: '12%' }]} /></View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {showWelcome && (
          <View style={s.welcomeBanner}>
            <Text style={s.welcomeTxt}>Bienvenue ! Ajoutez votre première œuvre pour découvrir ce qu'elle vaut.</Text>
          </View>
        )}
        <Text style={s.heading}>Choisissez ce que vous avez.</Text>
        <Text style={s.sub}>Nous nous occupons du reste.</Text>

        <View style={s.grid}>
          {MODES.map(mode => (
            <Pressable
              key={mode.id}
              style={[s.modeCard, !mode.active && s.modeCardOff]}
              onPress={() => mode.active && handleMode(mode.id)}
            >
              <Text style={s.modeIcon}>{mode.icon}</Text>
              <Text style={s.modeTitle}>{mode.label}</Text>
              <Text style={s.modeDesc}>{mode.desc}</Text>
              {!mode.active && <Text style={s.modeSoon}>Bientôt</Text>}
            </Pressable>
          ))}
        </View>

        <Pressable style={s.manualLnk} onPress={() => router.push('/add-artwork/manual')}>
          <Text style={s.manualTxt}>✍️ Ajouter manuellement</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  topbar:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  closeBtn:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeTxt:  { fontSize: 18, color: Colors.textSecondary },
  tbTitle:   { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  progBg:    { height: 2, backgroundColor: Colors.bgSecondary },
  progFill:  { height: 2, backgroundColor: Colors.green },
  scroll:    { flex: 1 },
  content:   { padding: 20, paddingHorizontal: 16 },
  heading:   { fontSize: 17, fontWeight: Fonts.medium, color: Colors.textPrimary, marginBottom: 5 },
  sub:       { fontSize: Fonts.md, color: Colors.textSecondary, marginBottom: 22, lineHeight: 19 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  modeCard:  { width: '48%', backgroundColor: Colors.bgPrimary, borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, padding: 15, paddingHorizontal: 13 },
  modeCardOff: { opacity: 0.5 },
  modeIcon:  { fontSize: 24, marginBottom: 7 },
  modeTitle: { fontSize: Fonts.md, fontWeight: Fonts.medium, color: Colors.textPrimary, marginBottom: 2 },
  modeDesc:  { fontSize: 11, color: Colors.textTertiary, lineHeight: 15 },
  modeSoon:  { fontSize: 10, color: Colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
  welcomeBanner: { backgroundColor: Colors.greenLight, borderRadius: Radius.md, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: Colors.green },
  welcomeTxt:    { fontSize: Fonts.sm, color: Colors.greenDark, lineHeight: 18 },
  manualLnk: { alignItems: 'center', paddingVertical: 7 },
  manualTxt: { fontSize: Fonts.base, color: Colors.textTertiary },
});
