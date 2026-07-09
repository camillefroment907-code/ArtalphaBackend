// app/(tabs)/alerts.tsx — Alerts Screen (Nautilus design)

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Colors, FontFamily, FontSize, Spacing, Radius, Shadow } from '@/constants/theme';
import { api } from '@/lib/api';

interface BackendAlert {
  id: string;
  title: string;
  body?: string;
  alert_type?: string;
  read?: boolean;
  created_at?: string;
  source_url?: string;
}

interface AlertsResponse {
  items: BackendAlert[];
  total: number;
}

type Category = 'all' | 'collection' | 'marche' | 'instit';

function getCategory(type?: string): 'collection' | 'marche' | 'instit' | 'other' {
  if (!type) return 'other';
  const t = type.toLowerCase();
  if (t.includes('market') || t.includes('sale') || t.includes('vente')) return 'marche';
  if (t.includes('institution') || t.includes('expo'))                    return 'instit';
  if (t.includes('collection') || t.includes('health') || t.includes('document')) return 'collection';
  return 'other';
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return "À l'instant";
  if (h < 24) return `Il y a ${h}h`;
  if (d === 1) return 'Hier';
  return `Il y a ${d}j`;
}

const CATEGORY_CONFIG = {
  marche:     { dot: Colors.green,   ctaLabel: 'Voir la vente' },
  instit:     { dot: Colors.info,    ctaLabel: "Voir l'impact" },
  collection: { dot: Colors.warning, ctaLabel: 'Compléter' },
  other:      { dot: Colors.textTertiary, ctaLabel: 'Voir le détail' },
} as const;

const TABS: { key: Category; label: string }[] = [
  { key: 'all',        label: 'Toutes' },
  { key: 'collection', label: 'Collection' },
  { key: 'marche',     label: 'Marché' },
  { key: 'instit',     label: 'Institutionnel' },
];

export default function AlertsScreen() {
  const [alerts,     setAlerts]     = useState<BackendAlert[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<Category>('all');
  const [readIds,    setReadIds]    = useState<Set<string>>(new Set());

  const loadAlerts = useCallback(async () => {
    try {
      const data = await api.get<AlertsResponse | BackendAlert[]>('/api/alerts?page=1&page_size=50');
      const items = Array.isArray(data) ? data : (data as AlertsResponse).items ?? [];
      setAlerts(items);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadAlerts(); }, [loadAlerts]));

  const isUnread = (a: BackendAlert) => !readIds.has(a.id) && a.read !== true;

  const filtered = alerts.filter((a) => {
    if (activeTab === 'all') return true;
    return getCategory(a.alert_type) === activeTab;
  });

  const unread   = filtered.filter(isUnread);
  const previous = filtered.filter((a) => !isUnread(a));

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color={Colors.gold} /></View>;
  }

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Alertes</Text>
          <Text style={s.sub}>
            {unread.length > 0
              ? `${unread.length} nouvelle${unread.length > 1 ? 's' : ''}`
              : 'Aucune alerte récente'}
          </Text>
        </View>
        {unread.length > 0 && (
          <Pressable onPress={() => setReadIds((prev) => new Set([...prev, ...unread.map((a) => a.id)]))}>
            <Text style={s.markAllTxt}>Tout lire</Text>
          </Pressable>
        )}
      </View>

      {/* ── Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsWrap}
        contentContainerStyle={s.tabsRow}
      >
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabTxt, activeTab === tab.key && s.tabTxtActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAlerts(); }} tintColor={Colors.gold} />
        }
        contentContainerStyle={s.list}
      >
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Aucune alerte{activeTab !== 'all' ? ' dans cette catégorie' : ''}.</Text>
            <Text style={s.emptySub}>Nautilus vous préviendra dès qu'un événement concerne votre collection.</Text>
          </View>
        ) : (
          <>
            {unread.length > 0 && (
              <View style={s.group}>
                <Text style={s.groupLabel}>NOUVELLES</Text>
                {unread.map((a) => <AlertCard key={a.id} alert={a} unread />)}
              </View>
            )}
            {previous.length > 0 && (
              <View style={s.group}>
                <Text style={s.groupLabel}>PRÉCÉDENTES</Text>
                {previous.map((a) => <AlertCard key={a.id} alert={a} unread={false} />)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function AlertCard({ alert, unread }: { alert: BackendAlert; unread: boolean }) {
  const cat    = getCategory(alert.alert_type);
  const config = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.other;

  return (
    <View style={[s.card, unread && { borderLeftWidth: 2.5, borderLeftColor: config.dot }]}>
      {/* Dot indicator */}
      <View style={[s.alertDot, { backgroundColor: unread ? config.dot : Colors.bgElevated }]} />

      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <Text style={s.cardTitle} numberOfLines={2}>{alert.title}</Text>
          <Text style={s.cardTime}>{timeAgo(alert.created_at)}</Text>
        </View>

        {alert.body ? <Text style={s.cardBody2} numberOfLines={3}>{alert.body}</Text> : null}

        <View style={s.cardFooter}>
          <Text style={s.cardType}>{alert.alert_type ?? 'Signal'}</Text>
          {alert.source_url ? (
            <Pressable onPress={() => Linking.openURL(alert.source_url!)}>
              <Text style={s.cardCta}>{config.ctaLabel} →</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: 12 },
  title:  { fontSize: FontSize['3xl'], fontFamily: FontFamily.serifBold, color: Colors.textPrimary, letterSpacing: -0.3 },
  sub:    { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textSecondary, marginTop: 3 },
  markAllTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium, color: Colors.textTertiary },

  tabsWrap: { flexGrow: 0, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  tabsRow:  { paddingHorizontal: Spacing.md, flexDirection: 'row', gap: 4 },
  tab:           { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -0.5 },
  tabActive:     { borderBottomColor: Colors.gold },
  tabTxt:        { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium, color: Colors.textTertiary },
  tabTxtActive:  { color: Colors.gold },

  list:  { padding: Spacing.md, paddingBottom: 40, gap: 10 },

  group:      { marginBottom: 6 },
  groupLabel: { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textTertiary, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 10 },

  card: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    padding: Spacing.md,
    gap: 10,
    ...Shadow.sm,
  },
  alertDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  cardBody:  { flex: 1 },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  cardTitle: { flex: 1, fontSize: FontSize.base, fontFamily: FontFamily.sansMedium, color: Colors.textPrimary, lineHeight: 19 },
  cardTime:  { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textTertiary, flexShrink: 0 },
  cardBody2: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textSecondary, lineHeight: 17, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardType:  { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textTertiary },
  cardCta:   { fontSize: FontSize.sm, fontFamily: FontFamily.sansSemibold, color: Colors.gold },

  empty:      { paddingVertical: 56, alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.serifBold, color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  emptySub:   { fontSize: FontSize.base, fontFamily: FontFamily.sans, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20 },
});
