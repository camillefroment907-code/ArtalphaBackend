// app/profile/succession.tsx — Préparer ma succession

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadow,
} from '@/constants/theme';
import { collectionService, PortfolioItem } from '@/services/api';
import { formatPrice } from '@/utils/format';

type SectionItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  soon?: boolean;
  onPress?: () => void;
};

const SECTIONS: SectionItem[] = [
  {
    icon: 'list-outline',
    label: 'Inventaire de la collection',
    description: 'Liste complète de vos œuvres avec descriptions et photos.',
    soon: true,
  },
  {
    icon: 'trending-up-outline',
    label: 'Valeur estimée',
    description: 'Rapport de valorisation basé sur les données de marché actuelles.',
    soon: true,
  },
  {
    icon: 'document-text-outline',
    label: 'Documents manquants',
    description: 'Certificats, factures et provenances à compléter.',
    soon: true,
  },
  {
    icon: 'people-outline',
    label: 'Bénéficiaires',
    description: 'Associez vos œuvres à vos héritiers et bénéficiaires désignés.',
    soon: true,
  },
  {
    icon: 'briefcase-outline',
    label: 'Export notaire',
    description: 'Générez un dossier PDF complet pour votre notaire.',
    soon: true,
  },
  {
    icon: 'link-outline',
    label: 'Lien sécurisé de partage',
    description: 'Partagez un accès limité à votre collection avec vos proches.',
    soon: true,
  },
];

export default function SuccessionScreen() {
  const router = useRouter();
  const [items,   setItems]   = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      collectionService.list()
        .then((data) => { if (active) setItems(Array.isArray(data) ? data : []); })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [])
  );

  const totalValue  = items.reduce((s, i) => s + (i.estimated_current_value_eur ?? 0), 0);
  const valuedCount = items.filter((i) => i.estimated_current_value_eur != null).length;
  const artistCount = new Set(items.map((i) => i.artist_name).filter(Boolean)).size;

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color={Colors.gold} /></View>;
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Préparer ma succession</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Hero card ── */}
        <View style={s.heroCard}>
          <View style={s.heroIcon}>
            <Ionicons name="leaf-outline" size={22} color={Colors.gold} />
          </View>
          <Text style={s.heroTitle}>Votre collection, votre héritage.</Text>
          <Text style={s.heroSub}>
            Organisez la transmission de votre patrimoine artistique. Renseignez vos bénéficiaires, complétez vos documents et générez un dossier pour votre notaire.
          </Text>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statV}>{items.length}</Text>
              <Text style={s.statL}>Œuvres</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statV}>{artistCount}</Text>
              <Text style={s.statL}>Artistes</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statV}>
                {totalValue > 0
                  ? totalValue >= 1_000_000
                    ? `${(totalValue / 1_000_000).toFixed(1)}M`
                    : `${Math.round(totalValue / 1_000)}k`
                  : '—'}
              </Text>
              <Text style={s.statL}>Valeur €</Text>
            </View>
          </View>
        </View>

        {/* ── Sections ── */}
        <Text style={s.sectionTitle}>ÉTAPES DE TRANSMISSION</Text>
        <View style={s.card}>
          {SECTIONS.map((item, i) => (
            <View key={item.label} style={i < SECTIONS.length - 1 ? s.borderBottom : undefined}>
              <Pressable style={s.row} disabled={item.soon} onPress={item.onPress}>
                <View style={s.rowIcon}>
                  <Ionicons name={item.icon} size={17} color={Colors.textSecondary} />
                </View>
                <View style={s.rowBody}>
                  <View style={s.rowTop}>
                    <Text style={s.rowLabel}>{item.label}</Text>
                    {item.soon && (
                      <View style={s.soonPill}>
                        <Text style={s.soonTxt}>Bientôt</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.rowDesc}>{item.description}</Text>
                </View>
              </Pressable>
            </View>
          ))}
        </View>

        {/* ── Info banner ── */}
        <View style={s.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.gold} />
          <Text style={s.infoTxt}>
            Ces fonctionnalités seront disponibles prochainement. Nous vous contacterons dès qu'elles seront accessibles sur votre plan.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  scroll: { paddingBottom: 48 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.md, fontFamily: FontFamily.sansSemibold, color: Colors.textPrimary },

  // Hero card
  heroCard: {
    margin: Spacing.md,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadow.sm,
  },
  heroIcon:  { width: 48, height: 48, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.serifBold, color: Colors.textPrimary, textAlign: 'center', marginBottom: 8, letterSpacing: -0.2 },
  heroSub:   { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 20 },

  statsRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  stat:        { alignItems: 'center' },
  statV:       { fontSize: FontSize['2xl'], fontFamily: FontFamily.serifBold, color: Colors.textPrimary },
  statL:       { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textTertiary, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  // Section title
  sectionTitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.sansSemibold,
    color: Colors.textTertiary,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginHorizontal: Spacing.md,
    marginBottom: 8,
  },

  // Card
  card: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  borderBottom: { borderBottomWidth: 0.5, borderBottomColor: Colors.border },

  // Row
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: Spacing.md },
  rowIcon: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  rowBody: { flex: 1 },
  rowTop:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  rowLabel:{ fontSize: FontSize.base, fontFamily: FontFamily.sansMedium, color: Colors.textPrimary, flex: 1 },
  rowDesc: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textSecondary, lineHeight: 18 },

  soonPill: { backgroundColor: Colors.bgElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  soonTxt:  { fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium, color: Colors.textTertiary },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    margin: Spacing.md,
    marginTop: 16,
    padding: Spacing.md,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoTxt: { flex: 1, fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textSecondary, lineHeight: 18 },
});
