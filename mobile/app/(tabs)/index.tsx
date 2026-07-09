// app/(tabs)/index.tsx — Home collection Nautilus

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collectionService } from '@/services/api';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PortfolioItem {
  id: string;
  title?: string | null;
  artist_name?: string | null;
  medium?: string | null;
  year?: number | null;
  year_created?: number | null;
  dimensions?: string | null;
  estimated_current_value_eur?: number | null;
  current_value?: number | null;
  purchase_price?: number | null;
  created_at?: string | null;
}

interface BackendAlert {
  id: string;
  artist_name?: string | null;
  medium?: string | null;
  auction_house_name?: string | null;
  sale_date?: string | null;
  estimate_low?: number | null;
  source_url?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const getInitials = (name?: string | null): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const formatEur = (v?: number | null): string | null => {
  if (!v || v === 0) return null;
  return new Intl.NumberFormat('fr-FR').format(Math.round(v)) + ' €';
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [alerts, setAlerts] = useState<BackendAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [portfolioResult, alertsResult] = await Promise.allSettled([
        collectionService.list() as Promise<unknown>,
        api.get<unknown>('/api/alerts?page=1&page_size=10'),
      ]);
      if (portfolioResult.status === 'fulfilled') {
        const d = portfolioResult.value as PortfolioItem[] | { items: PortfolioItem[] };
        setItems(Array.isArray(d) ? d : (d.items || []));
      }
      if (alertsResult.status === 'fulfilled') {
        const d = alertsResult.value as BackendAlert[] | { items: BackendAlert[] };
        setAlerts(Array.isArray(d) ? d : (d.items || []));
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Calculs ────────────────────────────────────────────────────────────────

  const totalWorks = items.length;
  const uniqueArtists = new Set(
    items.map(i => i.artist_name).filter(Boolean)
  ).size;
  const totalValue = items.reduce((s, i) =>
    s + (i.estimated_current_value_eur || i.current_value || 0), 0
  );
  const incompleteCount = items.filter(
    i => !i.medium || !(i.year ?? i.year_created) || !i.dimensions
  ).length;
  const featured = [...items]
    .filter(i => i.estimated_current_value_eur || i.current_value)
    .sort((a, b) =>
      (b.estimated_current_value_eur || b.current_value || 0) -
      (a.estimated_current_value_eur || a.current_value || 0)
    )[0]
    ?? [...items].sort((a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime()
    )[0];
  const displayAlerts = alerts.slice(0, 2);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F4EE' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0F2D5C"
          />
        }
      >

        {/* ── HERO ── */}
        <View style={[s.hero, { paddingTop: insets.top + 20 }]}>

          {/* Topbar */}
          <View style={s.heroTopbar}>
            <Text style={s.heroWordmark}>NAUTILUS</Text>
            <View style={s.heroBell}>
              <Text style={{ fontSize: 14, opacity: 0.5 }}>🔔</Text>
            </View>
          </View>

          {/* Eyebrow */}
          <Text style={s.heroEyebrow}>Votre collection</Text>

          {/* Count block */}
          <View style={{ marginBottom: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={s.heroCount}>{totalWorks}</Text>
              <Text style={s.heroCountSuffix}> œuvre{totalWorks !== 1 ? 's' : ''}</Text>
            </View>
            <Text style={s.heroArtists}>
              de {uniqueArtists} artiste{uniqueArtists !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Séparateur */}
          <View style={s.heroSep} />

          {/* Valeur */}
          <View style={{ marginBottom: 16 }}>
            {totalValue > 0 ? (
              <Text style={s.heroValue}>{formatEur(totalValue)} estimés</Text>
            ) : (
              <Text style={s.heroValueEmpty}>Valeur en cours de calcul</Text>
            )}
          </View>

          {/* CTA compléter — uniquement si incompleteCount > 0 */}
          {incompleteCount > 0 && (
            <TouchableOpacity
              style={s.heroCta}
              onPress={() => router.push('/collection-health')}
              activeOpacity={0.75}
            >
              <Text style={s.heroCtaTxt}>
                Compléter{' '}
                <Text style={{ color: 'white', fontWeight: '600' }}>{incompleteCount}</Text>
                {' '}œuvre{incompleteCount !== 1 ? 's' : ''} →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── SECTION "Dans votre collection" ── */}
        <View style={s.section}>
          <View style={s.secHeader}>
            <Text style={s.secTitle}>Dans votre collection</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/collection')}>
              <Text style={s.secLink}>Tout voir →</Text>
            </TouchableOpacity>
          </View>

          {featured ? (
            <TouchableOpacity
              style={s.featCard}
              onPress={() => router.push(`/collection/${featured.id}`)}
              activeOpacity={0.9}
            >
              {/* Zone image */}
              <View style={s.featImage}>
                <Text style={s.featInitials}>
                  {getInitials(featured.artist_name)}
                </Text>
                {(featured.medium || featured.year || featured.year_created) && (
                  <View style={s.featPill}>
                    <Text style={s.featPillTxt}>
                      {[featured.medium, featured.year ?? featured.year_created]
                        .filter(Boolean)
                        .join(' · ')
                        .toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Zone info */}
              <View style={s.featInfo}>
                <Text style={s.featArtist}>
                  {featured.artist_name || 'Artiste inconnu'}
                </Text>
                {(featured.medium || featured.year || featured.year_created || featured.dimensions) && (
                  <Text style={s.featMeta}>
                    {[featured.medium, featured.year ?? featured.year_created, featured.dimensions]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
                <View style={s.featFooter}>
                  <Text style={s.featValue}>
                    {formatEur(featured.estimated_current_value_eur ?? featured.current_value) ?? '—'}
                  </Text>
                  <Text style={s.featEstLabel}>estimation Nautilus</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : !loading ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTitle}>Votre collection vous attend.</Text>
              <Text style={s.emptySub}>Ajoutez votre première œuvre pour commencer.</Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => router.push('/add-artwork')}
                activeOpacity={0.85}
              >
                <Text style={s.emptyBtnTxt}>Ajouter une œuvre</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* ── SECTION "Découvrir" — masquée si aucune alerte ── */}
        {displayAlerts.length > 0 && (
          <View style={[s.section, { marginTop: 22 }]}>
            <View style={s.secHeader}>
              <Text style={s.secTitle}>Découvrir</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/alerts')}>
                <Text style={s.secLink}>Voir tout →</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.discoverIntro}>
              <Text style={{ fontWeight: '600', color: '#1A1A1A' }}>{displayAlerts.length}</Text>
              {' '}vente{displayAlerts.length !== 1 ? 's' : ''} récente{displayAlerts.length !== 1 ? 's' : ''} concernent des artistes présents dans votre collection.
            </Text>

            {displayAlerts.map((alert, idx) => (
              <TouchableOpacity
                key={alert.id}
                style={[s.alertCard, idx < displayAlerts.length - 1 && { marginBottom: 9 }]}
                onPress={alert.source_url ? () => Linking.openURL(alert.source_url!) : undefined}
                activeOpacity={alert.source_url ? 0.8 : 1}
              >
                {/* Thumb */}
                <View style={s.alertThumb}>
                  <Text style={s.alertThumbTxt}>{getInitials(alert.artist_name)}</Text>
                </View>

                {/* Corps */}
                <View style={{ flex: 1 }}>
                  <Text style={s.alertArtist}>{alert.artist_name || '—'}</Text>
                  <Text style={s.alertMeta} numberOfLines={1}>
                    {[
                      alert.medium,
                      alert.auction_house_name,
                      alert.sale_date
                        ? new Date(alert.sale_date).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>

                {/* Prix — uniquement si estimate_low existe */}
                {alert.estimate_low != null && (
                  <Text style={s.alertPrice}>{formatEur(alert.estimate_low)}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* FAB — hors ScrollView */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push('/add-artwork')}
        activeOpacity={0.85}
      >
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // HERO
  hero: {
    backgroundColor: '#0F2D5C',
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  heroTopbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  heroWordmark: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.9)',
  },
  heroBell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroCount: {
    fontSize: 52,
    fontWeight: '300',
    color: 'white',
    letterSpacing: -2,
  },
  heroCountSuffix: {
    fontSize: 19,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
  },
  heroArtists: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 5,
  },
  heroSep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
    marginBottom: 18,
  },
  heroValue: {
    fontSize: 22,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.5,
  },
  heroValueEmpty: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
  },
  heroCta: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCtaTxt: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },

  // SECTIONS
  section: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  secHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  secTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#6E6E73',
  },
  secLink: {
    fontSize: 12,
    color: '#1B4FCC',
    fontWeight: '500',
  },

  // FEATURED CARD
  featCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E2DC',
    overflow: 'hidden',
  },
  featImage: {
    height: 190,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featInitials: {
    fontSize: 44,
    color: 'rgba(255,255,255,0.12)',
    fontFamily: 'Georgia',
  },
  featPill: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featPillTxt: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.45)',
  },
  featInfo: {
    padding: 15,
  },
  featArtist: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  featMeta: {
    fontSize: 12,
    color: '#6E6E73',
    marginBottom: 12,
  },
  featFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F0EDE7',
    paddingTop: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featValue: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  featEstLabel: {
    fontSize: 11,
    color: '#6E6E73',
  },

  // EMPTY STATE
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: '#6E6E73',
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyBtnTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },

  // DISCOVER
  discoverIntro: {
    fontSize: 13,
    color: '#6E6E73',
    lineHeight: 20,
    marginBottom: 13,
  },
  alertCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E2DC',
    padding: 13,
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
  },
  alertThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertThumbTxt: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.22)',
    fontFamily: 'Georgia',
  },
  alertArtist: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  alertMeta: {
    fontSize: 11,
    color: '#6E6E73',
    marginTop: 2,
  },
  alertPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    fontSize: 28,
    color: 'white',
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -2,
  },
});
