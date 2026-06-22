// app/artwork/[id].tsx — Artwork Detail V3

import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Platform, Image, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { collectionService, PortfolioItem } from '@/services/api';
import { api } from '@/lib/api';
import { formatPrice } from '@/utils/format';

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'infos' | 'valeur' | 'comparables' | 'docs' | 'larry';

const TABS: { key: Tab; label: string }[] = [
  { key: 'infos',       label: 'Infos' },
  { key: 'valeur',      label: 'Valeur' },
  { key: 'comparables', label: 'Comparables' },
  { key: 'docs',        label: 'Documents' },
  { key: 'larry',       label: 'Assistant' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function getHistoire(item: PortfolioItem): string {
  const medium = item.medium?.toLowerCase() || 'cette œuvre';
  const artist = item.artist_name || 'cet artiste';
  let text = '';

  if (item.purchase_source && item.purchase_date) {
    const d = new Date(item.purchase_date);
    const dateStr = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    text += `Acquis chez **${item.purchase_source}** en **${dateStr}**, ce ${medium}`;
  } else if (item.purchase_source) {
    text += `Acquis chez **${item.purchase_source}**, ce ${medium}`;
  } else if (item.year_created) {
    text += `Daté de **${item.year_created}**, ce ${medium}`;
  } else {
    text = `Cette œuvre`;
  }

  text += ` appartient à l'œuvre de **${artist}**.`;

  return text;
}

function BoldText({ children, style }: { children: string; style?: object }) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith('**') ? (
          <Text key={i} style={{ fontWeight: '500' as const, color: Colors.textPrimary, fontStyle: 'normal' }}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        )
      )}
    </Text>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ArtworkDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('infos');
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!id) return;
    collectionService.get(id)
      .then(setItem)
      .catch(() => setError('Impossible de charger cette œuvre.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color={Colors.textPrimary} /></View>;
  }

  if (error || !item) {
    return (
      <View style={s.loader}>
        <Text style={s.errTxt}>{error ?? 'Œuvre introuvable.'}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 10 }}>
          <Text style={s.errBack}>← Retour</Text>
        </Pressable>
      </View>
    );
  }

  // ── Computed values ──────────────────────────────────────────────────────
  const artistDisplay = (item.artist_name ?? '').toUpperCase();
  const titleLine     = item.title ?? '—';
  const mediumLine    = [item.medium, item.dimensions].filter(Boolean).join(' · ');
  const isValued      = !!(item.estimated_current_value_eur);
  const isFollowed    = item.artist_id != null;
  const docCount      = item.document_urls?.length ?? 0;

  const purchasePrice = item.purchase_price_eur ?? null;
  const currentValue  = item.estimated_current_value_eur ?? null;

  const purchaseDateShort = item.purchase_date
    ? new Date(item.purchase_date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    : null;

  const histoire    = getHistoire(item);
  const larryPrompt = `Analyser ${item.artist_name || 'cette œuvre'}`;

  const ARCHIVE_MESSAGES: Record<string, string> = {
    sold:      'Cette œuvre a été déplacée dans votre historique de collection.',
    given:     'Cette œuvre a été déplacée dans votre historique de collection.',
    stolen:    'Cette œuvre a été signalée comme volée dans votre historique.',
    destroyed: 'Cette œuvre a été déplacée dans votre historique de collection.',
    error:     'Cette fiche a été masquée de votre collection.',
  };

  const confirmArchive = async (exitReason: string) => {
    if (archiving) return;
    setArchiving(true);
    try {
      await api.patch(
        `/api/collection/items/${id}/archive`,
        { exit_reason: exitReason },
      );
      const message = ARCHIVE_MESSAGES[exitReason] ??
        'Cette œuvre a été retirée de votre collection.';
      Alert.alert(
        exitReason === 'error' ? 'Fiche masquée' : 'Œuvre retirée',
        message,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/collection') }],
      );
    } catch {
      Alert.alert(
        'Erreur',
        'Impossible de retirer cette œuvre. Vérifiez votre connexion.',
      );
    } finally {
      setArchiving(false);
    }
  };

  const handleArchive = () => {
    Alert.alert(
      'Retirer de la collection',
      'Pourquoi cette œuvre quitte-t-elle votre collection ?',
      [
        { text: 'Vendue',           onPress: () => confirmArchive('sold') },
        { text: 'Donnée',           onPress: () => confirmArchive('given') },
        { text: 'Volée',            onPress: () => confirmArchive('stolen') },
        { text: 'Détruite ou perdue', onPress: () => confirmArchive('destroyed') },
        { text: 'Annuler', style: 'cancel' },
      ],
    );
  };

  const handleMenuOpen = () => {
    Alert.alert(
      item?.title || item?.artist_name || 'Cette œuvre',
      undefined,
      [
        { text: 'Retirer de la collection', style: 'destructive', onPress: handleArchive },
        { text: 'Supprimer cette fiche (erreur de saisie)', style: 'destructive', onPress: () => confirmArchive('error') },
        { text: 'Annuler', style: 'cancel' },
      ],
    );
  };

  return (
    <View style={s.container}>
      <ScrollView bounces style={s.scroll}>
        {/* ── Hero ── */}
        <View style={s.hero}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <View style={s.heroPlaceholder}>
              <Text style={s.heroInitials}>
                {item.artist_name
                  ? item.artist_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                  : '?'}
              </Text>
            </View>
          )}

          {/* Overlay */}
          <View style={s.heroOverlay}>
            {!!artistDisplay && <Text style={s.heroArtist}>{artistDisplay}</Text>}
            <Text style={s.heroTitle}>{titleLine || '—'}</Text>
            {!!mediumLine && <Text style={s.heroMedium}>{mediumLine}</Text>}
          </View>

          {/* Back */}
          <Pressable style={s.heroBk} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={17} color="#fff" />
          </Pressable>

          {/* Actions */}
          <View style={s.heroAct}>
            <Pressable style={s.heroBtn}>
              <Ionicons name="heart-outline" size={15} color="#fff" />
            </Pressable>
            <Pressable style={s.heroBtn} onPress={handleMenuOpen}>
              <Ionicons name="ellipsis-vertical" size={15} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* ── Histoire de l'œuvre ── */}
        <View style={s.histoire}>
          <View style={s.histLabel}>
            <Ionicons name="book-outline" size={12} color={Colors.textTertiary} />
            <Text style={s.histLabelTxt}>HISTOIRE DE L'ŒUVRE</Text>
          </View>
          <BoldText style={s.histText}>{histoire}</BoldText>
        </View>

        {/* ── Tabs ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap} contentContainerStyle={s.tabsContent}>
          {TABS.map(t => (
            <Pressable
              key={t.key}
              style={[s.tab, activeTab === t.key && s.tabOn]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[s.tabTxt, activeTab === t.key && s.tabTxtOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Tab Content ── */}
        <View style={s.tabContent}>
          {activeTab === 'infos' && (
            <>
              {/* Tags */}
              <View style={s.tags}>
                {isValued && (
                  <View style={[s.tag, s.tagGreen]}>
                    <Ionicons name="trending-up-outline" size={11} color="#085041" />
                    <Text style={s.tagTxtGreen}>Valorisée</Text>
                  </View>
                )}
                {isFollowed && (
                  <View style={[s.tag, s.tagBlue]}>
                    <Ionicons name="notifications-outline" size={11} color="#0C447C" />
                    <Text style={s.tagTxtBlue}>Suivie</Text>
                  </View>
                )}
                {docCount > 0 && (
                  <View style={[s.tag, s.tagGray]}>
                    <Ionicons name="attach-outline" size={11} color={Colors.textSecondary} />
                    <Text style={s.tagTxtGray}>{docCount} doc{docCount > 1 ? 's' : ''}</Text>
                  </View>
                )}
              </View>

              {/* 3-col stats */}
              <View style={s.stats}>
                <View style={s.stat}>
                  <Text style={s.statL}>Prix d'achat</Text>
                  <Text style={s.statV}>{formatPrice(purchasePrice)}</Text>
                  <Text style={s.statD}>{purchaseDateShort ?? '—'}</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statL}>Valeur</Text>
                  <Text style={[s.statV, isValued && { color: '#0F6E56' }]}>
                    {currentValue != null ? formatPrice(currentValue) : '—'}
                  </Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statL}>Millésime</Text>
                  <Text style={s.statV}>
                    {item.year_created != null ? String(item.year_created) : '—'}
                  </Text>
                </View>
              </View>

              {/* Info rows */}
              <InfoRow label="Artiste"     value={item.artist_name ?? '—'} />
              <InfoRow label="Medium"      value={item.medium ?? '—'} />
              <InfoRow label="Dimensions"  value={item.dimensions ?? '—'} />
              <InfoRow label="Provenance"  value={item.purchase_source ?? '—'} />
              <InfoRow label="Notes"       value={item.notes ?? '—'} last />
            </>
          )}

          {activeTab === 'valeur' && (
            <View style={s.comingSoon}>
              {item.estimated_current_value_eur != null ? (
                <>
                  <View style={s.valCard}>
                    <Text style={s.valLabel}>Valeur estimée</Text>
                    <Text style={s.valAmt}>{formatPrice(item.estimated_current_value_eur)}</Text>
                    {item.last_valuation_at && (
                      <Text style={s.valDate}>
                        {new Date(item.last_valuation_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </Text>
                    )}
                  </View>
                  {item.purchase_price_eur != null && (
                    <InfoRow label="Prix d'acquisition" value={formatPrice(item.purchase_price_eur)} last />
                  )}
                </>
              ) : item.latest_valuation ? (
                <>
                  <View style={s.valCard}>
                    <Text style={s.valLabel}>Estimation de marché</Text>
                    <Text style={s.valAmt}>
                      {formatPrice(item.latest_valuation.estimated_value_eur ?? null)}
                    </Text>
                    {item.latest_valuation.value_low != null && item.latest_valuation.value_high != null && (
                      <Text style={s.valGain}>
                        {formatPrice(item.latest_valuation.value_low)} – {formatPrice(item.latest_valuation.value_high)}
                      </Text>
                    )}
                    {item.latest_valuation.estimation_date && (
                      <Text style={s.valDate}>
                        {new Date(item.latest_valuation.estimation_date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </Text>
                    )}
                  </View>
                  {!!item.latest_valuation.confidence && (
                    <InfoRow label="Fiabilité" value={item.latest_valuation.confidence} />
                  )}
                  {item.latest_valuation.comparables_count != null && (
                    <InfoRow label="Comparables" value={`${item.latest_valuation.comparables_count} ventes`} last />
                  )}
                </>
              ) : (
                <Text style={s.soonTxt}>Estimation en cours de calcul.</Text>
              )}
            </View>
          )}

          {activeTab === 'comparables' && (
            <View style={s.comingSoon}>
              <Text style={s.soonTxt}>Comparables — bientôt disponible.</Text>
            </View>
          )}

          {activeTab === 'docs' && (
            <View style={s.comingSoon}>
              {item.document_urls && item.document_urls.length > 0 ? (
                item.document_urls.map((url, i) => (
                  <Text key={i} style={s.soonTxt} numberOfLines={2}>{url}</Text>
                ))
              ) : (
                <Text style={s.soonTxt}>Aucun document ajouté.</Text>
              )}
            </View>
          )}

          {activeTab === 'larry' && (
            <View style={s.comingSoon}>
              <Text style={s.soonTxt}>Posez une question à l'Assistant sur cette œuvre.</Text>
              <Pressable
                style={s.larryBtn}
                onPress={() => router.push({ pathname: '/(tabs)/larry', params: { q: larryPrompt } })}
              >
                <Text style={s.larryBtnTxt}>Ouvrir l'Assistant →</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={s.bottomBar}>
        <Pressable
          style={s.btnSecondary}
          onPress={() => router.push({
            pathname: '/add-artwork/manual',
            params: { editItemId: item.id },
          })}
        >
          <Text style={s.btnSecondaryTxt}>Modifier</Text>
        </Pressable>
        <Pressable
          style={s.btnPrimary}
          onPress={() => router.push({
            pathname: '/(tabs)/larry',
            params: { q: `Analyser ${item?.artist_name || 'cette œuvre'}` },
          })}
        >
          <Text style={s.btnPrimaryTxt}>Demander à Larry →</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.infoRow, last && s.infoRowLast]}>
      <Text style={s.infoL}>{label}</Text>
      <Text style={s.infoV}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const TOP_OFFSET = Platform.OS === 'ios' ? 52 : 36;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loader:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errTxt:    { fontSize: Fonts.base, color: Colors.textSecondary },
  errBack:   { fontSize: Fonts.base, color: Colors.textTertiary },
  scroll:    { flex: 1 },

  // Hero
  hero:        { height: 220, backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  heroPlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  heroInitials:    { fontSize: 52, fontWeight: '300', color: 'rgba(255,255,255,0.15)', fontFamily: 'Georgia' },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, paddingHorizontal: 14, backgroundColor: 'rgba(0,0,0,0.48)' },
  heroArtist:  { fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, marginBottom: 2 },
  heroTitle:   { fontSize: 16, fontWeight: Fonts.medium, color: '#fff', lineHeight: 20 },
  heroMedium:  { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroBk:      { position: 'absolute', top: TOP_OFFSET, left: 11, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' },
  heroAct:     { position: 'absolute', top: TOP_OFFSET, right: 11, flexDirection: 'row', gap: 7 },
  heroBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' },

  // Histoire
  histoire:     { padding: 14, paddingHorizontal: 15, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  histLabel:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
  histLabelTxt: { fontSize: 10, color: Colors.textTertiary, letterSpacing: 0.6 },
  histText:     { fontSize: Fonts.md, color: Colors.textSecondary, lineHeight: 21, fontStyle: 'italic' },

  // Tabs
  tabsWrap:    { borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  tabsContent: { paddingHorizontal: 14 },
  tab:         { paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn:       { borderBottomColor: Colors.textPrimary },
  tabTxt:      { fontSize: Fonts.md, color: Colors.textTertiary },
  tabTxtOn:    { color: Colors.textPrimary, fontWeight: Fonts.medium },

  // Tab content
  tabContent: { padding: 14 },

  // Tags
  tags:        { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 12 },
  tag:         { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 20 },
  tagGreen:    { backgroundColor: '#E1F5EE' },
  tagBlue:     { backgroundColor: '#E6F1FB' },
  tagGray:     { backgroundColor: Colors.bgSecondary },
  tagTxtGreen: { fontSize: Fonts.sm, color: '#085041' },
  tagTxtBlue:  { fontSize: Fonts.sm, color: '#0C447C' },
  tagTxtGray:  { fontSize: Fonts.sm, color: Colors.textSecondary },

  // 3-col stats
  stats:  { flexDirection: 'row', gap: 8, marginBottom: 13 },
  stat:   { flex: 1, backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, padding: 9, paddingHorizontal: 10 },
  statL:  { fontSize: 10, color: Colors.textTertiary, marginBottom: 3 },
  statV:  { fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  statD:  { fontSize: 10, marginTop: 2, color: Colors.textTertiary },

  // Info rows
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  infoRowLast: { borderBottomWidth: 0 },
  infoL:       { fontSize: Fonts.base, color: Colors.textSecondary },
  infoV:       { fontSize: Fonts.base, fontWeight: Fonts.medium, color: Colors.textPrimary, maxWidth: '55%', textAlign: 'right' },

  // Valeur tab
  valCard:  { borderRadius: Radius.lg, backgroundColor: '#E1F5EE', padding: 14, marginBottom: 14 },
  valLabel: { fontSize: Fonts.sm, color: '#085041', marginBottom: 4 },
  valAmt:   { fontSize: 28, fontWeight: Fonts.medium, color: '#0F6E56', marginBottom: 4 },
  valGain:  { fontSize: Fonts.base, fontWeight: Fonts.medium, marginBottom: 3, color: Colors.textSecondary },
  valDate:  { fontSize: Fonts.xs, color: Colors.green },

  // Coming soon / Larry
  comingSoon: { paddingVertical: 8 },
  soonTxt:    { fontSize: Fonts.base, color: Colors.textSecondary, lineHeight: 18 },
  larryBtn:   { marginTop: 14, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.md, backgroundColor: Colors.textPrimary },
  larryBtnTxt:{ fontSize: Fonts.md, color: Colors.bgPrimary, fontWeight: Fonts.medium },

  // Bottom bar
  bottomBar:      { flexDirection: 'row', gap: 8, padding: 10, paddingHorizontal: 14, borderTopWidth: 0.5, borderTopColor: Colors.borderTertiary },
  btnSecondary:   { flex: 1, padding: 10, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderSecondary, alignItems: 'center' },
  btnSecondaryTxt:{ fontSize: Fonts.md, color: Colors.textSecondary },
  btnPrimary:     { flex: 1, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.textPrimary, alignItems: 'center' },
  btnPrimaryTxt:  { fontSize: Fonts.md, fontWeight: Fonts.medium, color: Colors.bgPrimary },
});
