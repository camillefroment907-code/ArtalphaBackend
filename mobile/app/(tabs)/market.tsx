// app/(tabs)/market.tsx — Marché screen (Step 13)
// Placeholder — full implementation in Step 13
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Colors, FontFamily, FontSize, Spacing, Radius, Shadow } from '@/constants/theme';
import { marketService, AuctionLot, MarketOpportunity } from '@/services/api';

function fmtPrice(n?: number | null): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`;
  return `${Math.round(n)}€`;
}

type TabId = 'opps' | 'recent';

export default function MarketScreen() {
  const router = useRouter();
  const [tab,          setTab]          = useState<TabId>('opps');
  const [opps,         setOpps]         = useState<MarketOpportunity[]>([]);
  const [recent,       setRecent]       = useState<AuctionLot[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([
        marketService.opportunities().catch(() => [] as MarketOpportunity[]),
        marketService.recentLots({ limit: 30 }).catch(() => [] as AuctionLot[]),
      ]);
      setOpps(Array.isArray(o) ? o : []);
      setRecent(Array.isArray(r) ? r : []);
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

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Marché</Text>
        <Text style={s.sub}>Intelligence des ventes aux enchères</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['opps', 'recent'] as TabId[]).map((t) => (
          <Pressable key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === 'opps' ? 'Opportunités' : 'Récentes'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        contentContainerStyle={s.list}
      >
        {tab === 'opps' && (
          opps.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>Aucune opportunité détectée pour le moment.</Text>
            </View>
          ) : (
            opps.map((o, i) => (
              <Pressable
                key={i}
                style={s.card}
                onPress={() => o.artist_id && router.push(`/artist/${o.artist_id}`)}
              >
                <View style={s.cardTop}>
                  <Text style={s.cardName}>{o.artist_name}</Text>
                  {o.score != null && (
                    <View style={s.scoreBadge}>
                      <Text style={s.scoreTxt}>{Math.round(o.score)}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardReason}>{o.reason}</Text>
              </Pressable>
            ))
          )
        )}

        {tab === 'recent' && (
          recent.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>Aucune vente récente disponible.</Text>
            </View>
          ) : (
            recent.map((lot) => (
              <Pressable
                key={lot.id}
                style={s.card}
                onPress={() => router.push(`/artwork/${lot.id}`)}
              >
                <View style={s.cardTop}>
                  <Text style={s.cardName} numberOfLines={1}>
                    {lot.artist_name ?? '—'}
                  </Text>
                  <Text style={[
                    s.cardPrice,
                    lot.lot_performance === 'sold' ? s.priceGreen : s.priceGray,
                  ]}>
                    {fmtPrice(lot.price_result_eur)}
                  </Text>
                </View>
                <Text style={s.cardTitle} numberOfLines={1}>{lot.title ?? ''}</Text>
                <Text style={s.cardMeta}>
                  {lot.auction_house ?? ''}{lot.auction_date ? ` · ${lot.auction_date.slice(0, 7)}` : ''}
                </Text>
              </Pressable>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  header: { paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: 12 },
  title:  { fontSize: FontSize['3xl'], fontFamily: 'PlayfairDisplay_700Bold', color: Colors.textPrimary, letterSpacing: -0.3 },
  sub:    { fontSize: FontSize.sm, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 3 },

  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: 8, marginBottom: 8 },
  tabBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  tabBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  tabLabel:       { fontSize: FontSize.sm, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  tabLabelActive: { color: Colors.textOnDark },

  list: { paddingHorizontal: Spacing.md, paddingBottom: 32, gap: 10 },

  card: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { fontSize: FontSize.base, fontFamily: 'Inter_600SemiBold', color: Colors.textPrimary, flex: 1 },
  cardTitle:  { fontSize: FontSize.sm, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  cardMeta:   { fontSize: FontSize.xs, fontFamily: 'Inter_400Regular', color: Colors.textTertiary, marginTop: 2 },
  cardReason: { fontSize: FontSize.sm, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },

  cardPrice: { fontSize: FontSize.base, fontFamily: 'Inter_600SemiBold' },
  priceGreen: { color: Colors.green },
  priceGray:  { color: Colors.textTertiary },

  scoreBadge: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreTxt: { fontSize: FontSize.xs, fontFamily: 'Inter_700Bold', color: Colors.bgDark },

  empty:    { paddingVertical: 48, alignItems: 'center' },
  emptyTxt: { fontSize: FontSize.base, fontFamily: 'Inter_400Regular', color: Colors.textTertiary, textAlign: 'center' },
});
