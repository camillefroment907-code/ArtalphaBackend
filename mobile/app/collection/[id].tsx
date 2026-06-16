// app/collection/[id].tsx — Portfolio Item Detail (Nautilus design)

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontFamily, FontSize, Spacing, Radius, Shadow } from '@/constants/theme';
import { collectionService, PortfolioItem } from '@/services/api';
import { useValuation } from '@/hooks/useValuation';
import { formatPrice } from '@/utils/format';
import { api } from '@/lib/api';

const PHOTO_SIZE = Math.floor((Dimensions.get('window').width - Spacing.md * 2 - 8) / 3);

const ACQ_TYPE_LABEL: Record<string, string> = {
  purchase_gallery: 'Galerie',
  purchase_auction: 'Enchères',
  purchase_private: 'Particulier',
  gift:             'Don',
  inheritance:      'Héritage',
  succession:       'Succession',
  donation:         'Donation',
  exchange:         'Échange',
  other:            'Autre',
};

type Tab = 'infos' | 'valeur' | 'docs';

const TABS: { key: Tab; label: string }[] = [
  { key: 'infos',  label: 'Informations' },
  { key: 'valeur', label: 'Valeur' },
  { key: 'docs',   label: 'Documents' },
];

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const TOP = Platform.OS === 'ios' ? 52 : 36;

export default function CollectionItemDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item,           setItem]           = useState<PortfolioItem | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [activeTab,      setActiveTab]      = useState<Tab>('infos');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { revalue, loading: revalueLoading } = useValuation();

  const fetchItem = useCallback(() => {
    if (!id) return;
    collectionService.get(id)
      .then(setItem)
      .catch(() => setError('Impossible de charger cette œuvre.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchItem(); }, [fetchItem]);

  const handleRevalue = async () => {
    if (!id) return;
    await revalue(id);
    fetchItem();
  };

  const pickAndUpload = async (source: 'library' | 'camera') => {
    const { status } = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission refusée', source === 'camera'
        ? "Autorisez l'accès à l'appareil photo dans les réglages."
        : "Autorisez l'accès aux photos dans les réglages.");
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: `photo_${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      } as unknown as Blob);

      await api.upload<{ url: string }>(`/api/collection/items/${id}/upload-photo`, formData);
      fetchItem();
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'uploader la photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Ajouter une photo', '', [
      { text: 'Appareil photo', onPress: () => pickAndUpload('camera') },
      { text: 'Photothèque', onPress: () => pickAndUpload('library') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  if (loading) return <View style={s.loader}><ActivityIndicator color={Colors.gold} /></View>;

  if (error || !item) {
    return (
      <View style={s.loader}>
        <Text style={s.errTxt}>{error ?? 'Œuvre introuvable.'}</Text>
        <Pressable onPress={() => router.back()} style={s.errBack}>
          <Text style={s.errBackTxt}>← Retour</Text>
        </Pressable>
      </View>
    );
  }

  const artistName  = (item.artist_name ?? '').toUpperCase();
  const titleLine   = [item.title, item.year_created].filter(Boolean).join(', ');
  const mediumLine  = [item.medium, item.dimensions].filter(Boolean).join(' · ');
  const isValued    = item.estimated_current_value_eur != null;
  const docCount    = item.document_urls?.length ?? 0;
  const initial     = (item.artist_name ?? item.title ?? '?').charAt(0).toUpperCase();

  const gainPct = isValued && item.purchase_price_eur != null
    ? Math.round((item.estimated_current_value_eur! - item.purchase_price_eur) / item.purchase_price_eur * 100)
    : null;

  const purchaseDateStr = item.purchase_date
    ? new Date(item.purchase_date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : null;

  const assistantQ = `Analyser la meilleure stratégie pour ${item.title ?? item.artist_name ?? 'cette œuvre'}`;

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          {item.image_url
            ? <Image source={{ uri: item.image_url }} style={s.heroImage} resizeMode="cover" />
            : <View style={s.heroPlaceholder}><Text style={s.heroInitial}>{initial}</Text></View>
          }

          {/* Back */}
          <Pressable style={[s.heroOverlayBtn, { top: TOP, left: 14 }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color="#fff" />
          </Pressable>

          {/* Camera */}
          <Pressable
            style={[s.heroOverlayBtn, { bottom: 56, right: 14 }]}
            onPress={showPhotoOptions}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="camera-outline" size={16} color="#fff" />
            }
          </Pressable>

          {/* Edit */}
          <Pressable
            style={[s.heroOverlayBtn, { top: TOP, right: 14 }]}
            onPress={() => router.push({
              pathname: '/add-artwork/manual',
              params: {
                artistName: item.artist_name ?? '',
                artistId:   item.artist_id   ?? '',
                title:      item.title       ?? '',
                year:       item.year_created?.toString() ?? '',
                medium:     item.medium      ?? '',
                dimensions: item.dimensions  ?? '',
                editItemId: item.id,
              },
            })}
          >
            <Ionicons name="pencil-outline" size={16} color="#fff" />
          </Pressable>

          {/* Overlay info */}
          <View style={s.heroOverlay}>
            {!!artistName && <Text style={s.heroArtist}>{artistName}</Text>}
            <Text style={s.heroTitle}>{titleLine || 'Sans titre'}</Text>
            {!!mediumLine && <Text style={s.heroMedium}>{mediumLine}</Text>}
          </View>
        </View>

        {/* ── Value pill ── */}
        {isValued && (
          <View style={s.valuePill}>
            <Text style={s.valuePillLabel}>VALEUR ESTIMÉE</Text>
            <Text style={s.valuePillAmount}>
              {formatPrice(item.estimated_current_value_eur)}
            </Text>
            {gainPct != null && (
              <Text style={[s.valuePillGain, { color: gainPct >= 0 ? Colors.green : Colors.error }]}>
                {gainPct >= 0 ? '+' : ''}{gainPct}% depuis l'acquisition
              </Text>
            )}
          </View>
        )}

        {/* ── Tabs ── */}
        <View style={s.tabBar}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              style={[s.tabBtn, activeTab === t.key && s.tabBtnActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[s.tabTxt, activeTab === t.key && s.tabTxtActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Tab Content ── */}
        <View style={s.tabContent}>

          {activeTab === 'infos' && (
            <>
              <InfoRow label="Artiste"       value={item.artist_name ?? '—'} />
              <InfoRow label="Titre"         value={item.title ?? '—'} />
              <InfoRow label="Année"         value={item.year_created?.toString() ?? '—'} />
              <InfoRow label="Medium"        value={item.medium ?? '—'} />
              <InfoRow label="Dimensions"    value={item.dimensions ?? '—'} />
              <InfoRow label="Provenance"    value={item.provenance ?? '—'} />
              <InfoRow label="Mode d'acquisition" value={item.acquisition_type ? (ACQ_TYPE_LABEL[item.acquisition_type] ?? item.acquisition_type) : '—'} />
              <InfoRow label="Prix d'achat"      value={formatPrice(item.purchase_price_eur ?? null)} />
              <InfoRow label="Date d'achat"      value={purchaseDateStr ?? '—'} />
              <InfoRow label="État"              value={item.condition ?? '—'} last />
            </>
          )}

          {activeTab === 'valeur' && (
            <>
              {isValued ? (
                <>
                  <View style={s.valCard}>
                    <Text style={s.valLabel}>Valeur estimée</Text>
                    <Text style={s.valAmount}>
                      {formatPrice(item.estimated_current_value_eur)}
                    </Text>
                    {/* Range from latest_valuation */}
                    {item.latest_valuation?.value_low != null && item.latest_valuation?.value_high != null && (
                      <Text style={s.valRange}>
                        {formatPrice(item.latest_valuation.value_low)} – {formatPrice(item.latest_valuation.value_high)}
                      </Text>
                    )}
                    {gainPct != null && (
                      <Text style={[s.valGain, { color: gainPct >= 0 ? Colors.green : Colors.error }]}>
                        {gainPct >= 0 ? '+' : ''}{gainPct}% depuis l'acquisition
                      </Text>
                    )}
                    {item.last_valuation_at && (
                      <Text style={s.valDate}>
                        Mis à jour le {new Date(item.last_valuation_at).toLocaleDateString('fr-FR')}
                      </Text>
                    )}
                  </View>

                  {/* Valuation metadata */}
                  {item.latest_valuation && (
                    <View style={s.valMetaCard}>
                      {item.latest_valuation.comparables_count != null && (
                        <View style={s.valMetaRow}>
                          <Text style={s.valMetaLabel}>Comparables</Text>
                          <Text style={s.valMetaValue}>{item.latest_valuation.comparables_count} ventes</Text>
                        </View>
                      )}
                      {item.latest_valuation.confidence && (
                        <View style={s.valMetaRow}>
                          <Text style={s.valMetaLabel}>Fiabilité</Text>
                          <Text style={s.valMetaValue}>
                            {item.latest_valuation.confidence === 'high' ? 'Élevée'
                              : item.latest_valuation.confidence === 'medium' ? 'Modérée'
                              : 'Indicative'}
                          </Text>
                        </View>
                      )}
                      {item.latest_valuation.method && (
                        <View style={s.valMetaRow}>
                          <Text style={s.valMetaLabel}>Méthode</Text>
                          <Text style={s.valMetaValue}>{item.latest_valuation.method}</Text>
                        </View>
                      )}
                      {item.latest_valuation.warning && (
                        <Text style={s.valWarning}>{item.latest_valuation.warning}</Text>
                      )}
                    </View>
                  )}

                  {item.purchase_price_eur != null && (
                    <>
                      <InfoRow label="Prix d'acquisition" value={formatPrice(item.purchase_price_eur)} />
                      <InfoRow
                        label="Plus-value"
                        value={formatPrice(item.estimated_current_value_eur! - item.purchase_price_eur)}
                        last
                      />
                    </>
                  )}

                  <Pressable
                    style={s.revalueBtn}
                    onPress={handleRevalue}
                    disabled={revalueLoading}
                  >
                    {revalueLoading
                      ? <ActivityIndicator size="small" color={Colors.textOnDark} />
                      : <Text style={s.revalueBtnTxt}>Revaloriser →</Text>
                    }
                  </Pressable>

                  <Pressable
                    style={s.larryLink}
                    onPress={() => router.push({ pathname: '/(tabs)/larry', params: { q: assistantQ } })}
                  >
                    <Text style={s.larryLinkTxt}>Analyser avec l'Assistant →</Text>
                  </Pressable>
                </>
              ) : (
                <View style={s.emptyState}>
                  <Text style={s.emptyStateTxt}>
                    {item.artist_id
                      ? "Pas assez de données pour valoriser cette œuvre."
                      : "Aucun artiste associé à cette œuvre."}
                  </Text>
                  <Text style={s.emptyStateSub}>
                    {item.artist_id
                      ? "Nous n'avons pas trouvé de comparables pour ce médium. Essayez de revaloriser après avoir précisé le médium."
                      : "Associez un artiste reconnu pour obtenir une estimation basée sur les ventes aux enchères."}
                  </Text>
                  {!item.artist_id && (
                    <Pressable
                      style={[s.revalueBtn, { marginTop: Spacing.md }]}
                      onPress={() => router.push({
                        pathname: '/add-artwork/manual',
                        params: {
                          artistName: item.artist_name ?? '',
                          title:      item.title       ?? '',
                          editItemId: item.id,
                        },
                      })}
                    >
                      <Text style={s.revalueBtnTxt}>Compléter les infos →</Text>
                    </Pressable>
                  )}
                  {item.artist_id && (
                    <Pressable
                      style={[s.revalueBtn, { marginTop: Spacing.md }]}
                      onPress={handleRevalue}
                      disabled={revalueLoading}
                    >
                      {revalueLoading
                        ? <ActivityIndicator size="small" color={Colors.textOnDark} />
                        : <Text style={s.revalueBtnTxt}>Revaloriser →</Text>
                      }
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )}

          {activeTab === 'docs' && (
            <>
              {/* ── Photos ── */}
              <View style={s.photoSection}>
                <View style={s.photoSectionHeader}>
                  <Text style={s.photoSectionTitle}>PHOTOS</Text>
                  <Pressable
                    style={s.photoAddBtn}
                    onPress={showPhotoOptions}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto
                      ? <ActivityIndicator size="small" color={Colors.textOnDark} />
                      : <Ionicons name="add" size={18} color={Colors.textOnDark} />
                    }
                  </Pressable>
                </View>

                {(item.image_urls?.length ?? 0) > 0 ? (
                  <View style={s.photoGrid}>
                    {(item.image_urls ?? []).map((url, idx) => (
                      <Image key={idx} source={{ uri: url }} style={s.photoThumb} resizeMode="cover" />
                    ))}
                    <Pressable style={s.photoAddThumb} onPress={showPhotoOptions} disabled={uploadingPhoto}>
                      <Ionicons name="add" size={24} color={Colors.textTertiary} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={s.photoEmpty} onPress={showPhotoOptions} disabled={uploadingPhoto}>
                    <Ionicons name="camera-outline" size={28} color={Colors.textTertiary} />
                    <Text style={s.photoEmptyTxt}>Ajouter une photo</Text>
                  </Pressable>
                )}
              </View>

              {/* ── Documents ── */}
              <InfoRow label="Certificat d'authenticité" value={item.certificate_of_authenticity ? 'Présent' : 'Non renseigné'} />
              <InfoRow label="Documents" value={docCount > 0 ? `${docCount} fichier${docCount > 1 ? 's' : ''}` : 'Aucun'} last />
            </>
          )}

        </View>
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={s.bottomBar}>
        <Pressable
          style={s.btnGhost}
          onPress={() => router.push({ pathname: '/(tabs)/larry', params: { q: assistantQ } })}
        >
          <Text style={s.btnGhostTxt}>Demander à l'Assistant</Text>
        </Pressable>
        <Pressable
          style={s.btnPrimary}
          onPress={() => router.push({
            pathname: '/add-artwork/manual',
            params: {
              artistName: item.artist_name ?? '',
              artistId:   item.artist_id   ?? '',
              title:      item.title       ?? '',
              year:       item.year_created?.toString() ?? '',
              medium:     item.medium      ?? '',
              dimensions: item.dimensions  ?? '',
              editItemId: item.id,
            },
          })}
        >
          <Text style={s.btnPrimaryTxt}>Modifier</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  errTxt: { fontSize: FontSize.base, fontFamily: FontFamily.sans, color: Colors.textSecondary, marginBottom: 8 },
  errBack: { paddingVertical: 8 },
  errBackTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textTertiary },

  // Hero
  hero: { height: 260, backgroundColor: Colors.bgDark, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  heroImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroPlaceholder: { width: 80, height: 80, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.borderOnDark, alignItems: 'center', justifyContent: 'center' },
  heroInitial: { fontSize: FontSize['3xl'], fontFamily: FontFamily.serifBold, color: Colors.textOnDarkMuted },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, backgroundColor: 'rgba(0,0,0,0.50)' },
  heroArtist:  { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textOnDarkMuted, letterSpacing: 0.6, marginBottom: 3 },
  heroTitle:   { fontSize: FontSize.xl, fontFamily: FontFamily.serifBold, color: Colors.textOnDark, lineHeight: 24 },
  heroMedium:  { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textOnDarkSubtle, marginTop: 3 },
  heroOverlayBtn: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Value pill
  valuePill: {
    backgroundColor: Colors.bgDark,
    marginHorizontal: Spacing.md,
    marginTop: -1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.md,
  },
  valuePillLabel:  { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textOnDarkSubtle, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 4 },
  valuePillAmount: { fontSize: FontSize['5xl'], fontFamily: FontFamily.serifBold, color: Colors.textOnDark, letterSpacing: -1 },
  valuePillGain:   { fontSize: FontSize.sm, fontFamily: FontFamily.sansSemibold, marginTop: 4 },

  // Tabs
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: 4, paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: Colors.border, marginTop: Spacing.sm },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: Radius.full, borderWidth: 1, borderColor: 'transparent' },
  tabBtnActive: { borderColor: Colors.border, backgroundColor: Colors.bgElevated },
  tabTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium, color: Colors.textTertiary },
  tabTxtActive: { color: Colors.textPrimary },

  // Tab content
  tabContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },

  // Info rows
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  rowLast:  { borderBottomWidth: 0 },
  rowLabel: { fontSize: FontSize.base, fontFamily: FontFamily.sans, color: Colors.textSecondary },
  rowValue: { fontSize: FontSize.base, fontFamily: FontFamily.sansMedium, color: Colors.textPrimary, maxWidth: '55%', textAlign: 'right' },

  // Valeur tab
  valCard:    { backgroundColor: Colors.bgDark, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.md },
  valLabel:   { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textOnDarkSubtle, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6 },
  valAmount:  { fontSize: FontSize['4xl'], fontFamily: FontFamily.serifBold, color: Colors.textOnDark, letterSpacing: -0.8 },
  valRange:   { fontSize: FontSize.base, fontFamily: FontFamily.sans, color: Colors.textOnDarkMuted, marginTop: 4 },
  valGain:    { fontSize: FontSize.sm, fontFamily: FontFamily.sansSemibold, marginTop: 6 },
  valDate:    { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textOnDarkSubtle, marginTop: 4 },
  valMetaCard:  { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md },
  valMetaRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  valMetaLabel: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textTertiary },
  valMetaValue: { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium, color: Colors.textSecondary },
  valWarning:   { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.warning, marginTop: 6, lineHeight: 16 },

  revalueBtn:     { marginTop: Spacing.md, paddingVertical: 11, alignItems: 'center', backgroundColor: Colors.gold, borderRadius: Radius.md },
  revalueBtnTxt:  { fontSize: FontSize.sm, fontFamily: FontFamily.sansSemibold, color: Colors.textOnDark },
  larryLink:    { marginTop: Spacing.sm, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  larryLinkTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sansSemibold, color: Colors.textSecondary },

  emptyState:    { paddingVertical: Spacing.lg, alignItems: 'center' },
  emptyStateTxt: { fontSize: FontSize.base, fontFamily: FontFamily.sansMedium, color: Colors.textSecondary, textAlign: 'center', marginBottom: 6 },
  emptyStateSub: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textTertiary, textAlign: 'center', lineHeight: 18 },

  // Photos
  photoSection:       { marginBottom: Spacing.md },
  photoSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  photoSectionTitle:  { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textTertiary, letterSpacing: 0.7 },
  photoAddBtn:        { width: 28, height: 28, borderRadius: Radius.full, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  photoGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  photoThumb:         { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: Radius.sm, backgroundColor: Colors.bgElevated },
  photoAddThumb:      { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: Radius.sm, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  photoEmpty:         { height: 100, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: Spacing.md },
  photoEmptyTxt:      { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textTertiary },

  // Bottom bar
  bottomBar:    { flexDirection: 'row', gap: 8, padding: Spacing.sm, paddingHorizontal: Spacing.md, borderTopWidth: 0.5, borderTopColor: Colors.border, backgroundColor: Colors.bg },
  btnGhost:     { flex: 1, padding: 11, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  btnGhostTxt:  { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium, color: Colors.textSecondary },
  btnPrimary:   { flex: 1, padding: 11, borderRadius: Radius.md, backgroundColor: Colors.gold, alignItems: 'center' },
  btnPrimaryTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sansSemibold, color: Colors.textOnDark },
});
