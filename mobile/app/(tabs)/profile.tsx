// app/(tabs)/profile.tsx — Profile Screen (Nautilus design)

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
import { PortfolioItem } from '@/services/api';

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

export default function ProfileScreen() {
  const router  = useRouter();
  const storeUser = useAuthStore((s) => s.user);
  const logout  = useAuthStore((s) => s.logout);

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
            api.get<PortfolioItem[]>('/api/portfolio/items').catch(() => [] as PortfolioItem[]),
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

  const name        = me?.full_name ?? storeUser?.name ?? '';
  const email       = me?.email ?? storeUser?.email ?? '';
  const plan        = me?.plan ?? storeUser?.plan ?? 'free';
  const initials    = getInitials(name || email);
  const artistCount = new Set(items.map((i) => i.artist_name).filter(Boolean)).size;
  const totalValue  = items.reduce((s, i) => s + (i.estimated_current_value_eur ?? 0), 0);
  const planLabel   = PLAN_LABELS[plan] ?? 'Gratuit';
  const isPaid      = isPaidPlan(plan);

  const trialDays = me?.trial_end
    ? Math.max(0, Math.ceil((new Date(me.trial_end).getTime() - Date.now()) / 86_400_000))
    : 0;

  const SETTINGS: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void; danger?: boolean }[] = [
    { icon: 'notifications-outline', label: 'Notifications', value: 'Activées' },
    { icon: 'shield-checkmark-outline', label: 'Confidentialité' },
    { icon: 'download-outline', label: 'Exporter ma collection' },
    { icon: 'log-out-outline', label: 'Se déconnecter', onPress: handleLogout, danger: true },
  ];

  return (
    <ScrollView
      style={s.root}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.scroll}
    >

      {/* ── Profile header (dark) ── */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initials}</Text>
        </View>
        <Text style={s.name}>{name || email}</Text>
        {name && email ? <Text style={s.email}>{email}</Text> : null}

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
            <Text style={s.statL}>Valeur € est.</Text>
          </View>
        </View>
      </View>

      {/* ── Abonnement ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Mon abonnement</Text>

        <View style={s.planCard}>
          <View>
            <Text style={s.planName}>{planLabel}</Text>
            <Text style={s.planSub}>
              {me?.trial_active && trialDays > 0
                ? `Essai · ${trialDays} jour${trialDays > 1 ? 's' : ''} restant${trialDays > 1 ? 's' : ''}`
                : isPaid ? 'Abonnement actif' : 'Plan gratuit'}
            </Text>
          </View>
          <View style={[s.planBadge, isPaid && { backgroundColor: Colors.gold }]}>
            <Text style={[s.planBadgeTxt, isPaid && { color: Colors.bgDark }]}>
              {isPaid ? 'Actif' : 'Gratuit'}
            </Text>
          </View>
        </View>

        {!isPaid && (
          <Pressable style={s.upgradeBtn} onPress={() => router.push('/paywall' as any)}>
            <Text style={s.upgradeBtnTxt}>Passer à Investor →</Text>
          </Pressable>
        )}
      </View>

      {/* ── Réglages ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Réglages</Text>
        <View style={s.settingsList}>
          {SETTINGS.map((item, i) => (
            <Pressable
              key={item.label}
              style={[s.settingRow, i < SETTINGS.length - 1 && s.settingBorder]}
              onPress={item.onPress}
            >
              <View style={s.settingIcon}>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={item.danger ? Colors.error : Colors.textSecondary}
                />
              </View>
              <Text style={[s.settingLabel, item.danger && { color: Colors.error }]}>
                {item.label}
              </Text>
              {item.value && <Text style={s.settingValue}>{item.value}</Text>}
              {!item.danger && <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />}
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Footer ── */}
      <View style={s.footer}>
        <Text style={s.footerTxt}>Nautilus · v1.0</Text>
        <Text style={s.footerTxt}>get-nautilus.com</Text>
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 40 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  // Header
  header: {
    backgroundColor: Colors.bgDark,
    paddingTop: 64,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
  section:      { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  sectionTitle: { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textTertiary, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 12 },

  // Plan
  planCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: 10,
  },
  planName:     { fontSize: FontSize.base, fontFamily: FontFamily.sansSemibold, color: Colors.textPrimary },
  planSub:      { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textTertiary, marginTop: 2 },
  planBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border },
  planBadgeTxt: { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textSecondary },

  upgradeBtn: {
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    ...Shadow.md,
  },
  upgradeBtnTxt: { fontSize: FontSize.base, fontFamily: FontFamily.sansSemibold, color: Colors.gold, letterSpacing: 0.1 },

  // Settings
  settingsList: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  settingRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: Spacing.md },
  settingBorder: { borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  settingIcon:   { width: 32, height: 32, borderRadius: Radius.md, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  settingLabel:  { flex: 1, fontSize: FontSize.base, fontFamily: FontFamily.sansMedium, color: Colors.textPrimary },
  settingValue:  { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textTertiary },

  // Footer
  footer:    { paddingVertical: 20, alignItems: 'center', gap: 4 },
  footerTxt: { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textTertiary },
});
