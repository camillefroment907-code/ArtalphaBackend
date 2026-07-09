// app/add-artwork/index.tsx — Mode selection (étape 12%)

import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/lib/tokens';

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

        {/* Welcome banner — inchangé */}
        {showWelcome && (
          <View style={s.welcomeBanner}>
            <Text style={s.welcomeTxt}>Bienvenue ! Ajoutez votre première œuvre pour découvrir ce qu'elle vaut.</Text>
          </View>
        )}

        <Text style={s.subtitle}>Photographiez une œuvre.</Text>
        <Text style={s.subtitleStrong}>
          Nautilus l'identifie, l'estime et l'ajoute à votre collection.
        </Text>

        {/* Hero Photo Card */}
        <Pressable style={s.photoCard} onPress={() => router.push('/add-artwork/photo')}>
          <View style={s.photoIconWrap}>
            <Ionicons name="camera-outline" size={22} color="rgba(255,255,255,0.85)" />
          </View>
          <Text style={s.photoTitle}>Photographier une œuvre</Text>
          <Text style={s.photoSub}>Pointez vers l'œuvre ou son étiquette.</Text>
          <Text style={s.photoSteps}>Identification · Estimation · Ajout à la collection</Text>
          <View style={s.photoCta}>
            <Text style={s.photoCtaTxt}>Commencer</Text>
          </View>
        </Pressable>

        {/* Search card */}
        <Pressable style={s.searchCard} onPress={() => router.push('/add-artwork/search')}>
          <View style={s.searchIconWrap}>
            <Ionicons name="search-outline" size={18} color="#1A1A1A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.searchTitle}>Rechercher une œuvre</Text>
            <Text style={s.searchSub}>Artiste, titre ou maison de vente</Text>
          </View>
          <Text style={s.searchArr}>›</Text>
        </Pressable>

        {/* Manuel */}
        <Pressable style={s.manualLnk} onPress={() => router.push('/add-artwork/manual')}>
          <Text style={s.manualTxt}>ou <Text style={s.manualCta}>ajouter manuellement</Text></Text>
        </Pressable>

        {/* Bientôt */}
        <View style={s.soonRow}>
          <Text style={s.soonTxt}>Import facture — bientôt</Text>
          <Text style={s.soonDot}>·</Text>
          <Text style={s.soonTxt}>Lien — bientôt</Text>
        </View>

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

  welcomeBanner: { backgroundColor: Colors.greenLight, borderRadius: Radius.md, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: Colors.green },
  welcomeTxt:    { fontSize: Fonts.sm, color: Colors.greenDark, lineHeight: 18 },

  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 20,
    marginBottom: 2,
    lineHeight: 20,
  },
  subtitleStrong: {
    fontSize: 13,
    fontWeight: Fonts.medium,
    color: Colors.textPrimary,
    marginBottom: 20,
    lineHeight: 20,
  },

  photoCard: {
    backgroundColor: '#0F2D5C',
    borderRadius: 18,
    padding: 24,
    marginBottom: 10,
  },
  photoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  photoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  photoSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.50)',
    lineHeight: 20,
    marginBottom: 18,
  },
  photoSteps: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.3,
    marginBottom: 22,
  },
  photoCta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  photoCtaTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F2D5C',
  },

  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderTertiary,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  searchIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  searchSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  searchArr: {
    fontSize: 20,
    color: Colors.borderTertiary,
    lineHeight: 24,
  },

  manualLnk: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  manualTxt: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  manualCta: {
    color: '#1B4FCC',
    fontWeight: '500',
  },

  soonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  soonTxt: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  soonDot: {
    fontSize: 11,
    color: Colors.borderTertiary,
  },
});
