// app/(tabs)/collection.tsx — Collection Screen V2

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Colors, Fonts } from '@/lib/tokens';
import { collectionService, PortfolioItem } from '@/services/api';

const { width: SW } = Dimensions.get('window');
// 3 colonnes · gap 2px × 2 · padding 2px × 2 = 8px
const CELL = (SW - 8) / 3;

function fmtValue(n?: number | null): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`;
  return `${Math.round(n)}€`;
}

function getArtistInitial(item: PortfolioItem): string {
  const source = item.artist_name || item.title || '?';
  return source.charAt(0).toUpperCase();
}

export default function CollectionScreen() {
  const router = useRouter();
  const [items,      setItems]      = useState<PortfolioItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const data = await collectionService.list();
      setItems(Array.isArray(data) ? data : []);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadItems(); }, [loadItems]));

  const onRefresh = () => { setRefreshing(true); loadItems(); };

  const totalValue     = items.reduce((sum, i) => sum + (i.estimated_current_value_eur ?? 0), 0);
  const artistCount    = new Set(items.map(i => i.artist_name).filter(Boolean)).size;
  const valorizedCount = items.filter(i => i.estimated_current_value_eur != null).length;

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color={Colors.textPrimary} /></View>;
  }

  return (
    <View style={s.container}>

      {/* ── Topbar ── */}
      <View style={s.topbar}>
        <View>
          <Text style={s.tbt}>Ma collection</Text>
          <Text style={s.tbs}>
            {items.length} œuvre{items.length !== 1 ? 's' : ''}{' '}·{' '}
            {artistCount} artiste{artistCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={s.tbr}>
          <Pressable style={s.addBtn} onPress={() => router.push('/add-artwork')}>
            <Text style={s.addBtnText}>＋</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.textTertiary}
          />
        }
      >
        {items.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Votre collection vous attend.</Text>
            <Text style={s.emptySub}>Commencez par ajouter une première œuvre.</Text>
            <Pressable style={s.emptyBtn} onPress={() => router.push('/add-artwork')}>
              <Text style={s.emptyBtnTxt}>Ajouter une œuvre</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Mosaïque ── */}
            <View style={s.grid}>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  style={s.cell}
                  onPress={() => router.push(`/collection/${item.id}`)}
                >
                  <View style={s.cellPad} />
                  <View style={s.cellInner}>
                    <Text style={s.cellInitial}>{getArtistInitial(item)}</Text>
                    {item.medium ? (
                      <Text style={s.cellMedium} numberOfLines={1}>{item.medium}</Text>
                    ) : null}
                  </View>
                  {item.estimated_current_value_eur != null && (
                    <View style={s.cellValue}>
                      <Text style={s.cellValueTxt}>{fmtValue(item.estimated_current_value_eur)}</Text>
                    </View>
                  )}
                  <View style={s.dots}>
                    {item.estimated_current_value_eur != null && (
                      <View style={[s.dot, { backgroundColor: Colors.green }]} />
                    )}
                    {(item.document_urls?.length ?? 0) > 0 && (
                      <View style={[s.dot, { backgroundColor: Colors.blue }]} />
                    )}
                  </View>
                </Pressable>
              ))}

              {/* Cellule Ajouter */}
              <Pressable style={s.cellAdd} onPress={() => router.push('/add-artwork')}>
                <View style={s.cellPad} />
                <View style={s.cellInner}>
                  <Text style={s.cellAddPlus}>＋</Text>
                  <Text style={s.cellAddLabel}>Ajouter</Text>
                </View>
              </Pressable>
            </View>

            {/* Barre valeur */}
            {totalValue > 0 && (
              <View style={s.valBar}>
                <Text style={s.valLabel}>VALEUR ESTIMÉE</Text>
                <Text style={s.valAmount}>
                  {new Intl.NumberFormat('fr-FR').format(Math.round(totalValue))} €
                </Text>
                <Text style={s.valSub}>
                  {valorizedCount} œuvre{valorizedCount !== 1 ? 's' : ''} valorisée{valorizedCount !== 1 ? 's' : ''} · {items.length} au total
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loader:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Topbar
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: 52, paddingBottom: 10 },
  tbt:    { fontSize: Fonts.xl, fontWeight: Fonts.medium, color: Colors.textPrimary },
  tbs:    { fontSize: Fonts.base, color: Colors.textTertiary, marginTop: 1 },
  tbr:    { flexDirection: 'row', gap: 8, alignItems: 'center' },

  // Add button
  addBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: Colors.bgPrimary, fontSize: 18, lineHeight: 20 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 },

  // Cells — ratio 1:1 via paddingTop: '100%'
  cell:         { width: CELL, position: 'relative', backgroundColor: Colors.bgSecondary },
  cellPad:      { paddingTop: '100%' },
  cellInner:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 6 },
  cellInitial:  { fontSize: 26, fontWeight: '600', color: Colors.textTertiary },
  cellMedium:   { fontSize: 9, color: Colors.textTertiary, marginTop: 3, textAlign: 'center', opacity: 0.7 },
  cellValue:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 3, paddingHorizontal: 5 },
  cellValueTxt: { fontSize: 9, color: Colors.green, fontWeight: '600', textAlign: 'center' },

  // Dots
  dots: { position: 'absolute', top: 5, right: 5, flexDirection: 'row', gap: 3 },
  dot:  { width: 5, height: 5, borderRadius: 2.5 },

  // Cellule Ajouter
  cellAdd:      { width: CELL, position: 'relative', borderWidth: 0.5, borderStyle: 'dashed', borderColor: Colors.borderSecondary },
  cellAddPlus:  { fontSize: 20, color: Colors.textTertiary },
  cellAddLabel: { fontSize: 10, color: Colors.textTertiary, marginTop: 3 },

  // Barre valeur
  valBar:    { padding: 14, paddingHorizontal: 16, borderTopWidth: 0.5, borderTopColor: Colors.borderTertiary },
  valLabel:  { fontSize: Fonts.xs, color: Colors.textTertiary, letterSpacing: 0.6, marginBottom: 4, textTransform: 'uppercase' },
  valAmount: { fontSize: Fonts['2xl'], fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 },
  valSub:    { fontSize: Fonts.sm, color: Colors.textTertiary, marginTop: 2 },

  // Empty
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyTitle:  { fontSize: Fonts.xl, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  emptySub:    { fontSize: Fonts.md, color: Colors.textTertiary, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  emptyBtn:    { backgroundColor: Colors.blue, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnTxt: { color: '#FFFFFF', fontSize: Fonts.md, fontWeight: '500' },
});
