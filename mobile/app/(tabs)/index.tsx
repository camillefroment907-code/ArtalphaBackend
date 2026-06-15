// app/(tabs)/index.tsx — Collection Dashboard

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadow,
} from '@/constants/theme';
import { portfolioService, alertService, PortfolioItem, Alert } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { Ionicons } from '@expo/vector-icons';

const { width: SW } = Dimensions.get('window');
const MINI = (SW - Spacing.md * 2 - Spacing.sm * 5) / 6;

function fmtValue(n?: number | null): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`;
  return `${Math.round(n)}€`;
}

function fmtTotal(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "À l'instant";
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(diff / 86_400_000);
  if (d < 7) return `Il y a ${d}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Health score (client-side)
function computeHealthScore(items: PortfolioItem[]): number {
  if (items.length === 0) return 0;
  const withVal  = items.filter((i) => i.estimated_current_value_eur != null).length / items.length;
  const withPric = items.filter((i) => i.purchase_price_eur != null).length / items.length;
  const withDocs = items.filter((i) => (i.document_urls?.length ?? 0) > 0).length / items.length;
  const artists  = new Set(items.map((i) => i.artist_id).filter(Boolean)).size;
  const divScore = Math.min(artists / 5, 1);
  return Math.round((withVal * 30 + withPric * 25 + withDocs * 25 + divScore * 20));
}

function healthLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellente',    color: Colors.green };
  if (score >= 60) return { label: 'Bonne',         color: Colors.green };
  if (score >= 40) return { label: 'À renforcer',   color: Colors.warning };
  return               { label: 'Incomplète',    color: Colors.error };
}

const LARRY_CHIPS = [
  'Valeur de ma collection',
  'Quelle œuvre vendre ?',
  'Tendances du marché',
];

export default function CollectionDashboard() {
  const router = useRouter();
  const user   = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0] ?? '';

  const [items,      setItems]      = useState<PortfolioItem[]>([]);
  const [alerts,     setAlerts]     = useState<Alert[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [its, als] = await Promise.all([
        portfolioService.list().catch(() => [] as PortfolioItem[]),
        alertService.list().catch(() => [] as Alert[]),
      ]);
      setItems(Array.isArray(its) ? its : []);
      setAlerts(Array.isArray(als) ? als.slice(0, 3) : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color={Colors.gold} /></View>;
  }

  const totalValue   = items.reduce((sum, i) => sum + (i.estimated_current_value_eur ?? 0), 0);
  const artistCount  = new Set(items.map((i) => i.artist_name).filter(Boolean)).size;
  const previews     = items.slice(0, 6);
  const healthScore  = computeHealthScore(items);
  const healthInfo   = healthLabel(healthScore);
  const unreadAlerts = alerts.filter((a) => !a.is_read).length;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
    >

      {/* ── Topbar ── */}
      <View style={s.topbar}>
        <Text style={s.greeting}>
          {firstName ? `Bonjour, ${firstName}` : 'Bonjour'}
        </Text>
        <Pressable style={s.bellBtn} onPress={() => router.push('/alerts')}>
          <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
          {unreadAlerts > 0 && <View style={s.bellDot} />}
        </Pressable>
      </View>

      {/* ── Hero Collection card (navy) ── */}
      <Pressable style={s.hero} onPress={() => router.push('/(tabs)/collection')}>
        <Text style={s.heroLabel}>MA COLLECTION</Text>

        {totalValue > 0 ? (
          <Text style={s.heroValue}>{fmtTotal(totalValue)} €</Text>
        ) : (
          <Text style={s.heroValueEmpty}>
            {items.length > 0 ? `${items.length} œuvre${items.length !== 1 ? 's' : ''}` : '—'}
          </Text>
        )}

        <Text style={s.heroMeta}>
          {artistCount} artiste{artistCount !== 1 ? 's' : ''}
          {' · '}{items.length} œuvre{items.length !== 1 ? 's' : ''}
          {totalValue === 0 && items.length > 0 ? ' · estimation en cours' : ''}
        </Text>

        {/* Mini grid preview (6 items) */}
        <View style={s.miniRow}>
          {previews.map((item) => (
            <View key={item.id} style={s.mini}>
              <Text style={s.miniInitial}>
                {(item.artist_name ?? item.title ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          ))}
          {Array.from({ length: Math.max(0, 6 - previews.length) }).map((_, i) => (
            <View key={`ph-${i}`} style={[s.mini, s.miniEmpty]} />
          ))}
        </View>

        <View style={s.heroFooter}>
          <Text style={s.heroFooterTxt}>Voir tout →</Text>
        </View>
      </Pressable>

      {/* ── Collection Health ── */}
      {items.length > 0 && (
        <Pressable style={s.healthCard} onPress={() => router.push('/collection-health')}>
          <View style={s.healthTop}>
            <Text style={s.healthTitle}>Collection Health</Text>
            <Text style={[s.healthScore, { color: healthInfo.color }]}>
              {healthScore}/100
            </Text>
          </View>
          <View style={s.healthBar}>
            <View style={[s.healthBarFill, { width: `${healthScore}%`, backgroundColor: healthInfo.color }]} />
          </View>
          <Text style={[s.healthLabel, { color: healthInfo.color }]}>{healthInfo.label} →</Text>
        </Pressable>
      )}

      {/* ── Alertes ── */}
      {alerts.length > 0 && (
        <>
          <View style={s.secHdr}>
            <Text style={s.secTitle}>Alertes marché</Text>
            <Pressable onPress={() => router.push('/alerts')}>
              <Text style={s.secLink}>Tout voir →</Text>
            </Pressable>
          </View>
          <View style={s.alertsCard}>
            {alerts.map((a, i) => (
              <View key={a.id} style={[s.alertRow, i < alerts.length - 1 && s.alertBorder]}>
                <View style={[s.alertDot, { backgroundColor: a.is_read ? Colors.textTertiary : Colors.gold }]} />
                <View style={s.alertBody}>
                  <Text style={s.alertTitle} numberOfLines={2}>{a.title}</Text>
                  <Text style={s.alertMeta}>{timeAgo(a.created_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Larry AI ── */}
      <View style={s.secHdr}>
        <Text style={s.secTitle}>Demandez à Larry</Text>
      </View>
      <View style={s.larryCard}>
        <Text style={s.larryLabel}>NAUTILUS INTELLIGENCE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {LARRY_CHIPS.map((q) => (
            <Pressable
              key={q}
              style={s.chip}
              onPress={() => router.push({ pathname: '/(tabs)/larry', params: { q } })}
            >
              <Text style={s.chipTxt}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Empty state ── */}
      {items.length === 0 && (
        <Pressable style={s.emptyCard} onPress={() => router.push('/add-artwork')}>
          <Text style={s.emptyTitle}>Ajoutez votre première œuvre</Text>
          <Text style={s.emptySub}>Obtenez sa valeur de marché en quelques secondes.</Text>
          <View style={s.emptyBtn}>
            <Text style={s.emptyBtnTxt}>Commencer →</Text>
          </View>
        </Pressable>
      )}

    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 32 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  // Topbar
  topbar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: 12 },
  greeting: { fontSize: FontSize['2xl'], fontFamily: FontFamily.serifBold, color: Colors.textPrimary, letterSpacing: -0.2 },
  bellBtn:  { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  bellDot:  { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gold, borderWidth: 1.5, borderColor: Colors.bg },

  // Hero card
  hero: {
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.md,
  },
  heroLabel:      { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textOnDarkSubtle, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  heroValue:      { fontSize: FontSize['5xl'], fontFamily: FontFamily.serifBold, color: Colors.textOnDark, letterSpacing: -1, marginBottom: 4 },
  heroValueEmpty: { fontSize: FontSize['3xl'], fontFamily: FontFamily.serifBold, color: Colors.textOnDarkMuted, letterSpacing: -0.5, marginBottom: 4 },
  heroMeta:       { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textOnDarkMuted, marginBottom: 16 },

  miniRow:    { flexDirection: 'row', gap: Spacing.xs, marginBottom: 14 },
  mini:       { width: MINI, height: MINI, borderRadius: Radius.sm, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' },
  miniEmpty:  { opacity: 0.2 },
  miniInitial: { fontSize: 12, fontFamily: FontFamily.sansSemibold, color: 'rgba(255,255,255,0.6)' },

  heroFooter:    { borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.10)', paddingTop: 10 },
  heroFooterTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sansSemibold, color: Colors.gold, letterSpacing: 0.2 },

  // Health card
  healthCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  healthTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  healthTitle:   { fontSize: FontSize.base, fontFamily: FontFamily.sansSemibold, color: Colors.textPrimary },
  healthScore:   { fontSize: FontSize.base, fontFamily: FontFamily.sansBold },
  healthBar:     { height: 4, backgroundColor: Colors.bgElevated, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  healthBarFill: { height: '100%', borderRadius: 2 },
  healthLabel:   { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },

  // Section header
  secHdr:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.xs },
  secTitle: { fontSize: FontSize.md, fontFamily: FontFamily.sansSemibold, color: Colors.textPrimary },
  secLink:  { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textSecondary },

  // Alerts
  alertsCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  alertRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12 },
  alertBorder: { borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  alertDot:   { width: 7, height: 7, borderRadius: 3.5, marginTop: 5, flexShrink: 0 },
  alertBody:  { flex: 1 },
  alertTitle: { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium, color: Colors.textPrimary, lineHeight: 18, marginBottom: 2 },
  alertMeta:  { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textTertiary },

  // Larry
  larryCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  larryLabel: { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textTertiary, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 10 },
  chips:      { gap: 8, paddingRight: Spacing.md },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  chipTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium, color: Colors.textSecondary },

  // Empty state
  emptyCard: {
    margin: Spacing.md,
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadow.md,
  },
  emptyTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.serifBold, color: Colors.textOnDark, textAlign: 'center', marginBottom: 8, letterSpacing: -0.2 },
  emptySub:   { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textOnDarkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn:   { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 24, ...Shadow.gold },
  emptyBtnTxt: { fontSize: FontSize.base, fontFamily: FontFamily.sansSemibold, color: Colors.bgDark },
});
