// app/add-artwork/price.tsx — Prix d'acquisition (étape 82%)

import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { api } from '@/lib/api';
import { PortfolioItem } from '@/services/api';

function fmtEur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M€`;
  if (n >= 10_000)    return `${Math.round(n / 1_000)} k€`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace('.', ',')} k€`;
  return `${n} €`;
}

const GRADE_COLOR: Record<string, string> = {
  A: Colors.green, 'B+': Colors.blue, B: Colors.blue, C: Colors.warning, D: Colors.error,
};

const TREND_ICON  = { up: '↑', stable: '→', down: '↓' } as const;
const TREND_LABEL = { up: 'En hausse', stable: 'Stable', down: 'En baisse' } as const;
const TREND_COLOR = { up: Colors.green, stable: Colors.textTertiary, down: Colors.error } as const;

const ACQ_TYPES = [
  { value: 'purchase_gallery',  label: 'Galerie' },
  { value: 'purchase_auction',  label: 'Enchères' },
  { value: 'purchase_private',  label: 'Particulier' },
  { value: 'gift',              label: 'Don' },
  { value: 'inheritance',       label: 'Héritage' },
  { value: 'succession',        label: 'Succession' },
  { value: 'donation',          label: 'Donation' },
  { value: 'exchange',          label: 'Échange' },
  { value: 'other',             label: 'Autre' },
] as const;

type AcqType = (typeof ACQ_TYPES)[number]['value'];

const NON_PURCHASE = new Set<AcqType>(['gift', 'inheritance', 'succession', 'donation', 'exchange']);

export default function PriceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    artistName?:      string;
    artistId?:        string;
    title?:           string;
    year?:            string;
    medium?:          string;
    dimensions?:      string;
    estimatedMin?:    string;
    estimatedMax?:    string;
    estimatedMedian?: string;
    estimatedCount?:  string;
    trendDirection?:  string;
    investmentGrade?: string;
    investmentLabel?: string;
    imageUrl?:        string;   // URL Supabase depuis le flow Vision
    editItemId?:      string;
  }>();

  const [price,   setPrice]   = useState('');
  const [house,   setHouse]   = useState('');
  const [date,    setDate]    = useState('');
  const [acqType, setAcqType] = useState<AcqType | null>(null);
  const [loading, setLoading] = useState(false);

  // Parse market estimate from params
  const estMin    = params.estimatedMin    ? parseInt(params.estimatedMin, 10)    : null;
  const estMax    = params.estimatedMax    ? parseInt(params.estimatedMax, 10)    : null;
  const estMedian = params.estimatedMedian ? parseInt(params.estimatedMedian, 10) : null;
  const estCount  = params.estimatedCount  ? parseInt(params.estimatedCount, 10)  : null;
  const hasEstimate = estMin !== null && estMax !== null && estMedian !== null;

  const trend = (params.trendDirection ?? 'stable') as 'up' | 'stable' | 'down';
  const grade = params.investmentGrade ?? '';
  const gradeColor = GRADE_COLOR[grade] ?? Colors.textSecondary;

  const submit = async (skipPrice = false) => {
    setLoading(true);
    try {
      const editItemId = params.editItemId?.trim() || null;
      const parsedYear = params.year ? parseInt(params.year, 10) : null;
      const payload: Record<string, unknown> = {
        title:               params.title?.trim() || params.artistName?.trim() || 'Sans titre',
        artist_name:         params.artistName?.trim() ?? '',
        artist_id:           params.artistId?.trim() || null,
        year_created:        parsedYear && !isNaN(parsedYear) ? parsedYear : null,
        medium:              params.medium?.trim() || null,
        dimensions:          params.dimensions?.trim() || null,
        purchase_price_eur:  (!skipPrice && price) ? parseFloat(price) : null,
        purchase_source:     house.trim() || null,
        purchase_date:       date.trim() || null,
        acquisition_type:    acqType ?? null,
        image_url:           params.imageUrl?.trim() || null,  // URL Supabase du flow Vision
      };

      const item = editItemId
        ? await api.patch<PortfolioItem>(`/api/collection/items/${editItemId}`, payload)
        : await api.post<PortfolioItem>('/api/collection/items', payload);

      const lv = item.latest_valuation;
      router.replace({
        pathname: '/add-artwork/success',
        params: {
          itemId:         item.id,
          artistName:     params.artistName ?? '',
          title:          params.title ?? '',
          estimatedValue: (item.estimated_current_value_eur ?? estMedian ?? 0).toString(),
          valueLow:       (lv?.value_low  ?? '').toString(),
          valueHigh:      (lv?.value_high ?? '').toString(),
          valConf:        lv?.confidence  ?? '',
          valCount:       (lv?.comparables_count ?? '').toString(),
          hasArtistId:    (params.artistId?.trim() ? '1' : '0'),
        },
      });
    } catch {
      Alert.alert('Erreur', "Impossible d'ajouter cette œuvre. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>

      {/* ── Topbar ── */}
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <Text style={s.tbTitle}>Prix d'acquisition</Text>
        <Text style={s.tbStep}>4/4</Text>
      </View>
      <View style={s.progBg}><View style={[s.progFill, { width: '82%' }]} /></View>

      <ScrollView style={s.form} contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">

        {/* ── Récap œuvre ── */}
        <View style={s.recap}>
          <Text style={s.recapArtist}>{params.artistName || '—'}</Text>
          {!!params.title && <Text style={s.recapTitle}>{params.title}</Text>}
          {(!!params.medium || !!params.year) && (
            <Text style={s.recapMeta}>
              {[params.medium, params.year].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        {/* ── Estimation de marché ── */}
        {hasEstimate && (
          <View style={s.marketCard}>
            <View style={s.marketTopRow}>
              <Text style={s.marketCardTitle}>Valeur de marché estimée</Text>
              {!!grade && (
                <View style={[s.gradeBadge, { borderColor: gradeColor }]}>
                  <Text style={[s.gradeTxt, { color: gradeColor }]}>Grade {grade}</Text>
                </View>
              )}
            </View>

            <Text style={s.marketRange}>{fmtEur(estMin!)} – {fmtEur(estMax!)}</Text>
            <Text style={s.marketMedian}>Médiane estimée · {fmtEur(estMedian!)}</Text>

            <View style={s.marketMetaRow}>
              {estCount != null && (
                <Text style={s.marketMetaTxt}>
                  {estCount} vente{estCount > 1 ? 's' : ''} analysée{estCount > 1 ? 's' : ''}
                </Text>
              )}
              <Text style={[s.marketTrend, { color: TREND_COLOR[trend] }]}>
                {TREND_ICON[trend]} {TREND_LABEL[trend]}
              </Text>
            </View>
          </View>
        )}

        {/* ── Mode d'acquisition ── */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Mode d'acquisition</Text>
          <View style={s.chipRow}>
            {ACQ_TYPES.map((t) => (
              <Pressable
                key={t.value}
                style={[s.chip, acqType === t.value && s.chipActive]}
                onPress={() => setAcqType(prev => prev === t.value ? null : t.value)}
              >
                <Text style={[s.chipTxt, acqType === t.value && s.chipTxtActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Prix payé ── */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>
            {acqType && NON_PURCHASE.has(acqType) ? 'Valeur estimée' : 'Prix d\'acquisition'}
            {(hasEstimate || (acqType && NON_PURCHASE.has(acqType))) && (
              <Text style={s.fieldHint}> · optionnel</Text>
            )}
          </Text>
          <View style={s.priceRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={price}
              onChangeText={setPrice}
              placeholder={estMedian ? fmtEur(estMedian).replace(/[^0-9]/g, '…') : '4 200'}
              placeholderTextColor={Colors.textTertiary}
              keyboardType="decimal-pad"
              autoFocus={!hasEstimate}
            />
            <Text style={s.currency}>€</Text>
          </View>
          {hasEstimate && !price && (
            <Text style={s.priceHint}>
              Renseignez le prix payé pour calculer votre performance
            </Text>
          )}
        </View>

        {/* ── Maison de vente ── */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Maison de vente</Text>
          <TextInput
            style={s.input}
            value={house}
            onChangeText={setHouse}
            placeholder="Artcurial, Christie's, Drouot…"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        {/* ── Date ── */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Date d'acquisition</Text>
          <TextInput
            style={s.input}
            value={date}
            onChangeText={setDate}
            placeholder="2024-05-15"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        {!hasEstimate && (
          <View style={s.hint}>
            <Text style={s.hintTxt}>
              Ces informations permettent de calculer la performance de votre investissement.
            </Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── CTAs ── */}
      <View style={s.footer}>
        <Pressable style={s.primaryBtn} onPress={() => submit(false)} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.bgPrimary} />
            : <Text style={s.primaryBtnTxt}>Ajouter à ma collection</Text>
          }
        </Pressable>
        <Pressable style={s.skipBtn} onPress={() => submit(true)} disabled={loading}>
          <Text style={s.skipBtnTxt}>Passer cette étape →</Text>
        </Pressable>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bgPrimary },

  topbar:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  backBtn:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:        { fontSize: 20, color: Colors.textSecondary },
  tbTitle:        { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  tbStep:         { fontSize: Fonts.base, color: Colors.textTertiary },
  progBg:         { height: 2, backgroundColor: Colors.bgSecondary },
  progFill:       { height: 2, backgroundColor: Colors.green },

  form:           { flex: 1 },
  formContent:    { padding: 16 },

  // Recap
  recap:          { borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, padding: 13, marginBottom: 14 },
  recapArtist:    { fontSize: Fonts.base, color: Colors.textTertiary, marginBottom: 2 },
  recapTitle:     { fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  recapMeta:      { fontSize: Fonts.sm, color: Colors.textTertiary, marginTop: 3 },

  // Market card
  marketCard:     { borderWidth: 1.5, borderColor: Colors.blue, borderRadius: Radius.lg, padding: 14, marginBottom: 18, backgroundColor: Colors.blueLight },
  marketTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  marketCardTitle:{ fontSize: Fonts.base, color: Colors.textPrimary, fontWeight: Fonts.medium },
  gradeBadge:     { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  gradeTxt:       { fontSize: Fonts.xs, fontWeight: '700', letterSpacing: 0.3 },
  marketRange:    { fontSize: Fonts['3xl'], fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 2 },
  marketMedian:   { fontSize: Fonts.base, color: Colors.textSecondary, marginBottom: 10 },
  marketMetaRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  marketMetaTxt:  { fontSize: Fonts.sm, color: Colors.textTertiary },
  marketTrend:    { fontSize: Fonts.sm, fontWeight: '600' },

  // Chips
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip:           { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.borderSecondary, backgroundColor: Colors.bgPrimary },
  chipActive:     { backgroundColor: Colors.blue, borderColor: Colors.blue },
  chipTxt:        { fontSize: Fonts.base, color: Colors.textSecondary, fontWeight: Fonts.medium },
  chipTxtActive:  { color: Colors.bgPrimary },

  // Fields
  fieldGroup:     { marginBottom: 14 },
  fieldLabel:     { fontSize: Fonts.base, color: Colors.textSecondary, marginBottom: 5 },
  fieldHint:      { color: Colors.textTertiary, fontWeight: '400' },
  input:          { borderWidth: 0.5, borderColor: Colors.borderSecondary, borderRadius: Radius.md, padding: 10, fontSize: Fonts.md, color: Colors.textPrimary },
  priceRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currency:       { fontSize: Fonts.md, fontWeight: Fonts.medium, color: Colors.textSecondary },
  priceHint:      { fontSize: Fonts.sm, color: Colors.textTertiary, marginTop: 5 },
  hint:           { padding: 10, paddingHorizontal: 12, backgroundColor: Colors.bgSecondary, borderRadius: Radius.md },
  hintTxt:        { fontSize: 11, color: Colors.textTertiary, lineHeight: 16 },

  footer:         { padding: 16, borderTopWidth: 0.5, borderTopColor: Colors.borderTertiary, gap: 8 },
  primaryBtn:     { backgroundColor: Colors.blue, borderRadius: Radius.md, padding: 13, alignItems: 'center' },
  primaryBtnTxt:  { color: Colors.bgPrimary, fontSize: Fonts.lg, fontWeight: Fonts.medium },
  skipBtn:        { alignItems: 'center', paddingVertical: 8 },
  skipBtnTxt:     { fontSize: Fonts.md, color: Colors.textTertiary },
});
