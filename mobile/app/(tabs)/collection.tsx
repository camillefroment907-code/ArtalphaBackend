// app/(tabs)/collection.tsx — Cockpit Patrimonial V2 (Session 7)

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { collectionService, PortfolioItem } from '@/services/api';
import { formatPriceShort } from '@/utils/format';

// ── Constants ──────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 32 - 8) / 2);

// ── Helpers ────────────────────────────────────────────────────────────────
const getTotalValue = (items: PortfolioItem[]): number | null => {
  const valued = items.filter(i => i.estimated_current_value_eur != null);
  if (!valued.length) return null;
  return valued.reduce((s, i) => s + i.estimated_current_value_eur!, 0);
};

const getArtistCount = (items: PortfolioItem[]): number =>
  new Set(items.map(i => i.artist_name?.toLowerCase().trim()).filter(Boolean)).size;

const getTopArtwork = (items: PortfolioItem[]): PortfolioItem | null =>
  items
    .filter(i => i.estimated_current_value_eur != null)
    .sort((a, b) => b.estimated_current_value_eur! - a.estimated_current_value_eur!)
    [0] ?? null;

const getConcentration = (top: PortfolioItem, total: number): number =>
  Math.round((top.estimated_current_value_eur! / total) * 100);

type ArtworkStatus = 'valued' | 'to_estimate' | 'to_complete';

const getStatus = (item: PortfolioItem): ArtworkStatus => {
  if (item.estimated_current_value_eur != null) return 'valued';
  if (item.artist_id) return 'to_estimate';
  return 'to_complete';
};

const STATUS_CONFIG: Record<ArtworkStatus, { label: string; bg: string; color: string }> = {
  valued:      { label: 'Valorisée',   bg: '#DCFCE7', color: '#166534' },
  to_estimate: { label: 'À estimer',   bg: '#E6ECF7', color: '#1B4FCC' },
  to_complete: { label: 'À compléter', bg: '#F3F4F6', color: '#6E6E73' },
};

const getActions = (
  items: PortfolioItem[],
  totalValue: number | null,
  topArtwork: PortfolioItem | null,
): { dot: string; label: string; desc: string }[] => {
  const actions: { dot: string; label: string; desc: string }[] = [];

  const withoutValue = items.filter(i => !i.estimated_current_value_eur && i.artist_id).length;
  if (withoutValue > 0) actions.push({
    dot: '#DC2626',
    label: 'Estimations à compléter',
    desc: `${withoutValue} œuvre${withoutValue > 1 ? 's' : ''} sans estimation`,
  });

  if (topArtwork && totalValue && getConcentration(topArtwork, totalValue) > 70) {
    actions.push({
      dot: '#D97706',
      label: 'Collection concentrée',
      desc: `${topArtwork.artist_name} représente ${getConcentration(topArtwork, totalValue)}% de la valeur`,
    });
  }

  const noDocs = items.filter(i => !i.provenance && !i.certificate_of_authenticity).length;
  if (noDocs > 0) actions.push({
    dot: '#9CA3AF',
    label: 'Documents manquants',
    desc: `${noDocs} œuvre${noDocs > 1 ? 's' : ''} sans provenance ni certificat`,
  });

  return actions.slice(0, 3);
};

// ── Shared placeholder styles (used by ArtworkPlaceholder + gallery) ───────
const ph = StyleSheet.create({
  wrap: {
    backgroundColor: '#EFEDE8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  corner:   { position: 'absolute', width: 10, height: 10 },
  cornerTL: { top: 10, left: 10, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: '#C4C1BB' },
  cornerTR: { top: 10, right: 10, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: '#C4C1BB' },
  cornerBL: { bottom: 10, left: 10, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: '#C4C1BB' },
  cornerBR: { bottom: 10, right: 10, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: '#C4C1BB' },
  frame: {
    width: '45%',
    height: '60%',
    borderWidth: 1,
    borderColor: '#D4D1CB',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameInitial: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 32,
    color: '#C0BDB7',
  },
  mediumLbl: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: '#B0ADA7',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});

// ── ArtworkPlaceholder ────────────────────────────────────────────────────
function ArtworkPlaceholder({
  initial,
  medium,
  height = 170,
  fullWidth = false,
}: {
  initial: string;
  medium?: string | null;
  height?: number;
  fullWidth?: boolean;
}) {
  return (
    <View style={[ph.wrap, { height }, fullWidth && { width: '100%' as any }]}>
      <View style={[ph.corner, ph.cornerTL]} />
      <View style={[ph.corner, ph.cornerTR]} />
      <View style={[ph.corner, ph.cornerBL]} />
      <View style={[ph.corner, ph.cornerBR]} />
      <View style={ph.frame}>
        <Text style={ph.frameInitial}>{initial}</Text>
      </View>
      {medium ? <Text style={ph.mediumLbl}>{medium}</Text> : null}
    </View>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLbl}>{text}</Text>;
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function CollectionScreen() {
  const router = useRouter();
  const [items,      setItems]      = useState<PortfolioItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(false);

  const loadItems = useCallback(async () => {
    try {
      setError(false);
      const data = await collectionService.list();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadItems(); }, [loadItems]));
  const onRefresh = () => { setRefreshing(true); loadItems(); };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.state}>
        <ActivityIndicator size="large" color="#1B4FCC" />
        <Text style={s.stateTxt}>Chargement de votre collection…</Text>
      </View>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={s.state}>
        <Text style={s.emptyH}>Impossible de charger la collection.</Text>
        <Text style={s.emptyP}>Réessayez dans quelques instants.</Text>
        <Pressable style={s.emptyCta} onPress={loadItems}>
          <Text style={s.emptyCtaTxt}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (!items.length) {
    return (
      <View style={s.state}>
        <View style={s.emptyFrame}>
          <View style={s.emptyFrameInner} />
        </View>
        <Text style={s.emptyH}>Votre collection commence ici.</Text>
        <Text style={s.emptyP}>
          Ajoutez une première œuvre pour obtenir{'\n'}une estimation et construire votre inventaire.
        </Text>
        <Pressable style={s.emptyCta} onPress={() => router.push('/add-artwork')}>
          <Text style={s.emptyCtaTxt}>Ajouter une œuvre</Text>
        </Pressable>
      </View>
    );
  }

  // ── Computed ─────────────────────────────────────────────────────────────
  const totalValue        = getTotalValue(items);
  const artistCount       = getArtistCount(items);
  const topArtwork        = getTopArtwork(items);
  const concentrationPct  = topArtwork && totalValue
    ? getConcentration(topArtwork, totalValue) : null;
  const withoutProvenance = items.filter(i => !i.provenance).length;
  const withoutCert       = items.filter(i => !i.certificate_of_authenticity).length;
  const actions           = getActions(items, totalValue, topArtwork);

  type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

  const patrimoineCards: {
    id: string;
    icon: IoniconName;
    iconBg: string;
    iconColor: string;
    title: string;
    desc: string;
    cta: string | null;
    active: boolean;
  }[] = [
    {
      id: 'diversification',
      icon: 'pie-chart-outline',
      iconBg: '#FEE2E2', iconColor: '#991B1B',
      title: 'Diversification',
      desc: concentrationPct != null
        ? `${concentrationPct}% exposé à ${topArtwork?.artist_name ?? 'un artiste'}`
        : 'Données insuffisantes',
      cta: concentrationPct != null ? 'Analyser →' : null,
      active: concentrationPct != null,
    },
    {
      id: 'documents',
      icon: 'document-text-outline',
      iconBg: '#FEF3C7', iconColor: '#92600A',
      title: 'Documents',
      desc: withoutProvenance > 0
        ? `${withoutProvenance} œuvre${withoutProvenance > 1 ? 's' : ''} sans provenance`
        : 'Documents complets ✓',
      cta: withoutProvenance > 0 ? 'Compléter →' : null,
      active: true,
    },
    {
      id: 'protection',
      icon: 'shield-checkmark-outline',
      iconBg: '#E6ECF7', iconColor: '#1B4FCC',
      title: 'Protection',
      desc: withoutCert > 0
        ? `${withoutCert} œuvre${withoutCert > 1 ? 's' : ''} sans certificat`
        : 'Certificats à jour ✓',
      cta: 'Configurer →',
      active: true,
    },
    {
      id: 'transmission',
      icon: 'leaf-outline',
      iconBg: '#F3F4F6', iconColor: '#9CA3AF',
      title: 'Transmission',
      desc: 'Préparer votre succession',
      cta: null,
      active: false,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>

      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Ma collection</Text>
          <Text style={s.headerSub}>
            {items.length} œuvre{items.length !== 1 ? 's' : ''} · {artistCount} artiste{artistCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable style={s.addBtn} onPress={() => router.push('/add-artwork')}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B4FCC" />
        }
        contentContainerStyle={s.scroll}
      >

        {/* ── SECTION 1 : HERO CARD ── */}
        <View style={s.hero}>
          <Text style={s.heroEyebrow}>VOTRE COLLECTION</Text>
          <Text style={s.heroAmount}>
            {totalValue != null ? formatPriceShort(totalValue) : '—'}
          </Text>
          <Text style={s.heroSublabel}>Patrimoine artistique estimé</Text>
          <View style={s.heroDivider} />
          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{items.length}</Text>
              <Text style={s.heroStatLbl}>œuvres</Text>
            </View>
            <View style={s.heroSep} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{artistCount}</Text>
              <Text style={s.heroStatLbl}>artistes</Text>
            </View>
            <View style={s.heroSep} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>
                {totalValue != null ? formatPriceShort(totalValue) : '—'}
              </Text>
              <Text style={s.heroStatLbl}>valorisé</Text>
            </View>
          </View>
          <Text style={s.heroAnalyse}>
            Analyse en cours pour les autres œuvres
          </Text>
        </View>

        {/* ── SECTION 2 : PIÈCE MAÎTRESSE ── */}
        <SectionLabel text="PIÈCE MAÎTRESSE" />
        {topArtwork ? (
          <Pressable
            style={s.topCard}
            onPress={() => router.push(`/collection/${topArtwork.id}`)}
          >
            {topArtwork.image_url ? (
              <Image
                source={{ uri: topArtwork.image_url }}
                style={{ height: 170, width: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <ArtworkPlaceholder
                initial={topArtwork.artist_name?.charAt(0)?.toUpperCase() ?? '?'}
                medium={topArtwork.medium}
                height={170}
                fullWidth
              />
            )}

            <View style={s.topInfo}>
              <Text style={s.topEyebrow}>PIÈCE MAÎTRESSE</Text>
              <Text style={s.topArtist}>
                {topArtwork.artist_name?.toUpperCase() ?? ''}
              </Text>
              <Text style={s.topTitle} numberOfLines={2}>
                {topArtwork.title && topArtwork.title !== topArtwork.artist_name
                  ? topArtwork.title
                  : 'Sans titre'}
              </Text>
              <Text style={s.topMeta}>
                {[topArtwork.medium, topArtwork.year_created, topArtwork.dimensions]
                  .filter(Boolean).join(' · ')}
              </Text>
              <Text style={s.topValue}>
                {formatPriceShort(topArtwork.estimated_current_value_eur!)}
              </Text>
              <Text style={s.topSubdesc}>Votre œuvre la plus précieuse</Text>
              {concentrationPct != null && concentrationPct >= 70 && (
                <View style={s.concentBadge}>
                  <Text style={s.concentText}>
                    {concentrationPct}% de la valeur de la collection
                  </Text>
                </View>
              )}
              <Text style={s.topCta}>Voir l'analyse →</Text>
            </View>
          </Pressable>
        ) : (
          <View style={[s.topCard, s.topEmpty]}>
            <Text style={s.topEmptyTitle}>Aucune pièce maîtresse identifiée</Text>
            <Text style={s.topEmptyText}>
              Complétez les informations de vos œuvres pour obtenir une valorisation.
            </Text>
            <Pressable onPress={() => router.push('/add-artwork')}>
              <Text style={s.topEmptyCta}>Compléter mes œuvres →</Text>
            </Pressable>
          </View>
        )}

        {/* ── SECTION 3 : PATRIMOINE ── */}
        <SectionLabel text="PATRIMOINE" />
        <View style={s.patriGrid}>
          {patrimoineCards.map(card => (
            <View key={card.id} style={s.patriCard}>
              <View style={[s.patriIcon, { backgroundColor: card.iconBg }]}>
                <Ionicons name={card.icon} size={15} color={card.iconColor} />
              </View>
              <Text style={s.patriTitle}>{card.title}</Text>
              <Text style={s.patriDesc}>{card.desc}</Text>
              {card.active && card.cta ? (
                <Text style={s.patriCta}>{card.cta}</Text>
              ) : (
                <Text style={s.patriDisabled}>Bientôt disponible</Text>
              )}
            </View>
          ))}
        </View>

        {/* ── SECTION 4 : À FAIRE ── */}
        {actions.length > 0 && (
          <>
            <SectionLabel text="À FAIRE" />
            <View style={s.actionsCard}>
              {actions.map((action, i) => (
                <View
                  key={action.label}
                  style={[s.actionRow, i < actions.length - 1 && s.actionBorder]}
                >
                  <View style={[s.actionDot, { backgroundColor: action.dot }]} />
                  <View style={s.actionBody}>
                    <Text style={s.actionLabel}>{action.label}</Text>
                    <Text style={s.actionDesc}>{action.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── SECTION 5 : GALERIE ── */}
        <SectionLabel text="ŒUVRES" />
        <View style={s.galRow}>
          {items.map(item => {
            const status  = getStatus(item);
            const cfg     = STATUS_CONFIG[status];
            const initial = item.artist_name?.charAt(0)?.toUpperCase() ?? '?';

            return (
              <Pressable
                key={item.id}
                style={[s.artCard, { width: CARD_W }]}
                onPress={() => router.push(`/collection/${item.id}`)}
              >
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={{ width: CARD_W, aspectRatio: 4 / 5 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[ph.wrap, { width: CARD_W, aspectRatio: 4 / 5 }]}>
                    <View style={[ph.corner, ph.cornerTL]} />
                    <View style={[ph.corner, ph.cornerTR]} />
                    <View style={[ph.corner, ph.cornerBL]} />
                    <View style={[ph.corner, ph.cornerBR]} />
                    <View style={ph.frame}>
                      <Text style={ph.frameInitial}>{initial}</Text>
                    </View>
                  </View>
                )}

                {/* Status badge — absolute over image */}
                <View style={[s.artBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.artBadgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                </View>

                {/* Infos */}
                <View style={s.artInfo}>
                  <Text style={s.artArtist} numberOfLines={1}>
                    {item.artist_name ?? '—'}
                  </Text>
                  <Text style={s.artTitle} numberOfLines={1}>
                    {item.title && item.title !== item.artist_name
                      ? item.title
                      : item.medium ?? 'Sans titre'}
                  </Text>
                  {status === 'valued' ? (
                    <Text style={s.artVal}>
                      {formatPriceShort(item.estimated_current_value_eur!)}
                    </Text>
                  ) : status === 'to_complete' ? (
                    <Text style={s.artNa}>Artiste non identifié</Text>
                  ) : (
                    <Text style={s.artNa}>—</Text>
                  )}
                </View>
              </Pressable>
            );
          })}

          {/* Card ajouter */}
          <Pressable
            style={[s.addCard, { width: CARD_W }]}
            onPress={() => router.push('/add-artwork')}
          >
            <Text style={s.addIcon}>+</Text>
            <Text style={s.addLbl}>Ajouter{'\n'}une œuvre</Text>
          </Pressable>

          {/* Spacer si items.length pair (total items+add card = impair) */}
          {items.length % 2 === 0 && (
            <View style={{ width: CARD_W, opacity: 0 }} />
          )}
        </View>

        <View style={{ height: 32 }} />

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F4EE' },

  // States
  state:           { flex: 1, backgroundColor: '#F7F4EE', alignItems: 'center', justifyContent: 'center', padding: 32 },
  stateTxt:        { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6E6E73', marginTop: 12 },
  emptyFrame:      { width: 80, height: 80, borderWidth: 1.5, borderColor: '#E5E2DC', borderRadius: 8, marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
  emptyFrameInner: { width: 40, height: 40, borderWidth: 1, borderColor: '#D4D1CB', borderRadius: 4 },
  emptyH:          { fontFamily: 'PlayfairDisplay_400Regular', fontSize: 22, color: '#111111', textAlign: 'center', marginBottom: 10 },
  emptyP:          { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6E6E73', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyCta:        { backgroundColor: '#1B4FCC', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28 },
  emptyCtaTxt:     { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E2DC',
  },
  headerTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: '#111111', letterSpacing: -0.2 },
  headerSub:   { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6E6E73', marginTop: 2 },
  addBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1B4FCC', alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingBottom: 32 },

  // Section label
  sectionLbl: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 2,
  },

  // ── SECTION 1 : Hero ────────────────────────────────────────────────────
  hero: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 22,
    backgroundColor: '#1B4FCC',
    borderRadius: 18,
    paddingTop: 26,
    paddingBottom: 20,
    paddingHorizontal: 22,
  },
  heroEyebrow:  { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: 1, marginBottom: 14 },
  heroAmount:   { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 52, color: '#FFFFFF', letterSpacing: -2, lineHeight: 56, marginBottom: 6 },
  heroSublabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 18 },
  heroDivider:  { height: 0.5, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 16 },
  heroStats:    { flexDirection: 'row', alignItems: 'center' },
  heroStat:     { flex: 1, alignItems: 'center' },
  heroStatVal:  { fontFamily: 'PlayfairDisplay_400Regular', fontSize: 20, color: '#FFFFFF' },
  heroStatLbl:  { fontFamily: 'Inter_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 3 },
  heroSep:      { width: 0.5, height: 30, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroAnalyse:  {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.12)',
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // ── SECTION 2 : Pièce maîtresse ─────────────────────────────────────────
  topCard:       { marginHorizontal: 16, marginBottom: 22, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 0.5, borderColor: '#E5E2DC', overflow: 'hidden' },
  topInfo:       { padding: 16 },
  topEyebrow:    { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#1B4FCC', letterSpacing: 0.8, marginBottom: 5 },
  topArtist:     { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#6E6E73', letterSpacing: 0.4, marginBottom: 3 },
  topTitle:      { fontFamily: 'PlayfairDisplay_400Regular', fontSize: 16, color: '#111111', marginBottom: 3, lineHeight: 22 },
  topMeta:       { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#9CA3AF', marginBottom: 14 },
  topValue:      { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, color: '#111111', marginBottom: 3 },
  topSubdesc:    { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6E6E73', fontStyle: 'italic' },
  concentBadge:  { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  concentText:   { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: '#92600A' },
  topCta:        { marginTop: 12, fontFamily: 'Inter_500Medium', fontSize: 13, color: '#1B4FCC' },
  topEmpty:      { padding: 24, alignItems: 'flex-start' },
  topEmptyTitle: { fontFamily: 'PlayfairDisplay_400Regular', fontSize: 16, color: '#111111', marginBottom: 8 },
  topEmptyText:  { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6E6E73', lineHeight: 19, marginBottom: 12 },
  topEmptyCta:   { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#1B4FCC' },

  // ── SECTION 3 : Patrimoine ───────────────────────────────────────────────
  patriGrid:    { marginHorizontal: 16, marginBottom: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  patriCard:    { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E2DC', padding: 14 },
  patriIcon:    { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  patriTitle:   { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#111111', marginBottom: 3 },
  patriDesc:    { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#6E6E73', lineHeight: 14 },
  patriCta:     { fontFamily: 'Inter_500Medium', fontSize: 10, color: '#1B4FCC', marginTop: 7 },
  patriDisabled:{ fontFamily: 'Inter_400Regular', fontSize: 10, color: '#C4C1BB', marginTop: 7 },

  // ── SECTION 4 : À faire ──────────────────────────────────────────────────
  actionsCard:  { marginHorizontal: 16, marginBottom: 22, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E2DC', overflow: 'hidden' },
  actionRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  actionBorder: { borderBottomWidth: 0.5, borderBottomColor: '#E5E2DC' },
  actionDot:    { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  actionBody:   { flex: 1 },
  actionLabel:  { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#111111', marginBottom: 2 },
  actionDesc:   { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6E6E73' },

  // ── SECTION 5 : Galerie ──────────────────────────────────────────────────
  galRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12 },

  artCard:    { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#E5E2DC', overflow: 'hidden' },
  artBadge:   { position: 'absolute', top: 6, right: 6, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  artBadgeTxt:{ fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  artInfo:    { padding: 10 },
  artArtist:  { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  artTitle:   { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#111111', marginBottom: 4 },
  artVal:     { fontFamily: 'PlayfairDisplay_400Regular', fontSize: 13, color: '#1B4FCC' },
  artNa:      { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#C4C1BB' },

  addCard: {
    aspectRatio: 1,
    backgroundColor: '#FAFAF8',
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: '#D4D1CB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  addIcon: { fontFamily: 'Inter_400Regular', fontSize: 24, color: '#C4C1BB', lineHeight: 28 },
  addLbl:  { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#C4C1BB', textAlign: 'center', paddingHorizontal: 8 },
});
