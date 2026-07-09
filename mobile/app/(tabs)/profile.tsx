// app/(tabs)/profile.tsx — Profile / Collection Admin

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
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
import { useAuthStore, isPaidPlan } from '@/store/auth';
import { api } from '@/lib/api';
import { collectionService, PortfolioItem } from '@/services/api';
import { formatPrice } from '@/utils/format';

interface Me {
  full_name?: string;
  email?: string;
  plan?: string;
  trial_end?: string | null;
  trial_active?: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuit',
  starter: 'Collector',
  investor: 'Investor',
  pro: 'Family Office',
  institutional: 'Institutional',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

type RowItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  soon?: boolean;
};

function SectionRow({ item, last }: { item: RowItem; last?: boolean }) {
  return (
    <Pressable
      style={[row.r, last && row.last]}
      onPress={item.onPress}
      disabled={item.soon}
    >
      <View style={row.icon}>
        <Ionicons name={item.icon} size={17} color={item.danger ? Colors.error : Colors.textSecondary} />
      </View>
      <Text style={[row.label, item.danger && { color: Colors.error }]}>{item.label}</Text>
      {item.soon && <Text style={row.soon}>Bientôt</Text>}
      {item.value && !item.soon && <Text style={row.value}>{item.value}</Text>}
      {!item.danger && !item.soon && <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />}
    </Pressable>
  );
}

const row = StyleSheet.create({
  r:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: Spacing.md },
  last:  { borderBottomWidth: 0 },
  icon:  { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { flex: 1, fontSize: FontSize.base, fontFamily: FontFamily.sansMedium, color: Colors.textPrimary },
  value: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textTertiary },
  soon:  { fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium, color: Colors.textTertiary, backgroundColor: Colors.bgElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
});

export default function ProfileScreen() {
  const router    = useRouter();
  const storeUser = useAuthStore((s) => s.user);
  const logout    = useAuthStore((s) => s.logout);

  const [me,      setMe]      = useState<Me | null>(null);
  const [items,   setItems]   = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [meData, itemsData] = await Promise.all([
            api.get<Me>('/api/auth/me').catch(() => ({
              full_name: storeUser?.name,
              email: storeUser?.email,
              plan: storeUser?.plan,
            } as Me)),
            collectionService.list().catch(() => [] as PortfolioItem[]),
          ]);
          if (active) {
            setMe(meData);
            setItems(Array.isArray(itemsData) ? itemsData : []);
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [storeUser])
  );

  const handleLogout = () =>
    Alert.alert('Se déconnecter', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: async () => { await logout(); router.replace('/auth/login'); },
      },
    ]);

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color={Colors.gold} /></View>;
  }

  const name       = me?.full_name ?? storeUser?.name ?? '';
  const email      = me?.email ?? storeUser?.email ?? '';
  const plan       = me?.plan ?? storeUser?.plan ?? 'free';
  const initials   = getInitials(name || email);
  const artistCount = new Set(items.map((i) => i.artist_name).filter(Boolean)).size;
  const totalValue  = items.reduce((s, i) => s + (i.estimated_current_value_eur ?? 0), 0);
  const planLabel   = PLAN_LABELS[plan] ?? 'Gratuit';
  const isPaid      = isPaidPlan(plan);

  const trialDays = me?.trial_end
    ? Math.max(0, Math.ceil((new Date(me.trial_end).getTime() - Date.now()) / 86_400_000))
    : 0;

  const ACCOUNT_ROWS: RowItem[] = [
    { icon: 'person-outline',             label: 'Informations personnelles', soon: true },
    { icon: 'card-outline',               label: 'Abonnement', value: planLabel },
    { icon: 'shield-checkmark-outline',   label: 'Sécurité', soon: true },
  ];

  const COLLECTION_ROWS: RowItem[] = [
    { icon: 'download-outline',           label: 'Exporter ma collection', soon: true },
    { icon: 'document-text-outline',      label: 'Générer un rapport PDF', soon: true },
    { icon: 'share-outline',              label: 'Partager avec mon conseiller', soon: true },
    { icon: 'folder-outline',             label: 'Mes documents', soon: true },
    { icon: 'ribbon-outline',             label: 'Mes certificats', soon: true },
    { icon: 'receipt-outline',            label: 'Mes factures', soon: true },
  ];

  const TRANSMISSION_ROWS: RowItem[] = [
    {
      icon: 'leaf-outline',
      label: 'Préparer ma succession',
      onPress: () => router.push('/profile/succession' as any),
    },
    { icon: 'people-outline',             label: 'Bénéficiaires', soon: true },
    { icon: 'document-attach-outline',    label: 'Dossier de transmission', soon: true },
    { icon: 'link-outline',               label: 'Lien sécurisé de partage', soon: true },
  ];

  const SETTINGS_ROWS: RowItem[] = [
    { icon: 'notifications-outline',      label: 'Notifications', value: 'Activées' },
    { icon: 'lock-closed-outline',        label: 'Confidentialité', soon: true },
    { icon: 'log-out-outline',            label: 'Se déconnecter', onPress: handleLogout, danger: true },
  ];

  return (
    <ScrollView
      style={s.root}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.scroll}
    >

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initials}</Text>
        </View>
        <Text style={s.name}>{name || email}</Text>
        {name && email ? <Text style={s.email}>{email}</Text> : null}

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
            <Text style={s.statL}>Valeur € est.</Text>
          </View>
        </View>
      </View>

      {/* ── Mon compte ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Mon compte</Text>
        <View style={s.card}>
          {ACCOUNT_ROWS.map((item, i) => (
            <View key={item.label} style={i < ACCOUNT_ROWS.length - 1 && s.borderBottom}>
              <SectionRow item={item} last={i === ACCOUNT_ROWS.length - 1} />
            </View>
          ))}
        </View>

        {!isPaid && (
          <Pressable style={s.upgradeBtn} onPress={() => router.push('/paywall' as any)}>
            <Text style={s.upgradeBtnTxt}>Passer à Investor →</Text>
          </Pressable>
        )}
      </View>

      {/* ── Ma collection ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Ma collection</Text>
        <View style={s.card}>
          {COLLECTION_ROWS.map((item, i) => (
            <View key={item.label} style={i < COLLECTION_ROWS.length - 1 && s.borderBottom}>
              <SectionRow item={item} last={i === COLLECTION_ROWS.length - 1} />
            </View>
          ))}
        </View>
      </View>

      {/* ── Transmission ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Transmission</Text>
        <View style={s.card}>
          {TRANSMISSION_ROWS.map((item, i) => (
            <View key={item.label} style={i < TRANSMISSION_ROWS.length - 1 && s.borderBottom}>
              <SectionRow item={item} last={i === TRANSMISSION_ROWS.length - 1} />
            </View>
          ))}
        </View>
      </View>

      {/* ── Paramètres ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Paramètres</Text>
        <View style={s.card}>
          {SETTINGS_ROWS.map((item, i) => (
            <View key={item.label} style={i < SETTINGS_ROWS.length - 1 && s.borderBottom}>
              <SectionRow item={item} last={i === SETTINGS_ROWS.length - 1} />
            </View>
          ))}
        </View>
      </View>

      <View style={s.footer}>
        <Text style={s.footerTxt}>Nautilus · v1.0</Text>
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 48 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  // Header dark
  header: {
    backgroundColor: Colors.bgDark,
    paddingTop: 64,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 68, height: 68, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarTxt: { fontSize: FontSize['2xl'], fontFamily: FontFamily.serifBold, color: Colors.gold },
  name:      { fontSize: FontSize.xl, fontFamily: FontFamily.serifBold, color: Colors.textOnDark, letterSpacing: -0.2, marginBottom: 4 },
  email:     { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textOnDarkMuted, marginBottom: 20 },

  statsRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stat:        { alignItems: 'center' },
  statV:       { fontSize: FontSize['2xl'], fontFamily: FontFamily.serifBold, color: Colors.textOnDark },
  statL:       { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textOnDarkSubtle, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.borderOnDark },

  // Sections
  section:      { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 4 },
  sectionTitle: { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textTertiary, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8 },

  card: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  borderBottom: { borderBottomWidth: 0.5, borderBottomColor: Colors.border },

  upgradeBtn: {
    marginTop: 10,
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    ...Shadow.md,
  },
  upgradeBtnTxt: { fontSize: FontSize.base, fontFamily: FontFamily.sansSemibold, color: Colors.textOnDark },

  footer:    { paddingVertical: 20, alignItems: 'center' },
  footerTxt: { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textTertiary },
});
