// app/add-artwork/manual.tsx — Formulaire avec autocomplete et estimation de marché en temps réel

import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useCallback } from 'react';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

type Suggestion = {
  id?: string;
  name: string;
  nationality?: string;
  birth_year?: number;
};

type PriceHistorySale = {
  medium: string | null;
  sale_date: string;
  hammer_price_eur: number | null;
};

type PriceHistory = {
  artist_name: string;
  total_sales: number;
  statistics: {
    avg_hammer_eur: number | null;
    min_hammer_eur: number | null;
    max_hammer_eur: number | null;
    trend_pct: number;
    trend_direction: 'up' | 'stable' | 'down';
    sell_above_estimate_pct: number | null;
  } | null;
  price_by_year: Array<{ year: string; avg_price: number; sale_count: number }>;
  sales: PriceHistorySale[];
};

type InvestmentGrade = {
  score: number | null;
  grade: string | null;
  label: string | null;
};

type Estimate = {
  low: number;
  high: number;
  median: number;
  count: number;
  trend: 'up' | 'stable' | 'down';
  confidence: 'high' | 'medium' | 'low';
  basedOnMedium: boolean;
};

// ── Medium categories ──────────────────────────────────────────────────────

const MEDIUMS = [
  { label: 'Peinture',   value: 'painting',      display: 'Peinture' },
  { label: 'Estampe',    value: 'print',          display: 'Estampe' },
  { label: 'Dessin',     value: 'works_on_paper', display: 'Dessin sur papier' },
  { label: 'Photo',      value: 'photography',    display: 'Photographie' },
  { label: 'Sculpture',  value: 'sculpture',      display: 'Sculpture' },
  { label: 'Mixte',      value: 'mixed_media',    display: 'Médias mixtes' },
] as const;

type MediumValue = (typeof MEDIUMS)[number]['value'];

function normalizeMediumRaw(raw: string): string {
  const m = (raw || '').toLowerCase();
  if (/oil\b|huile|acrylic|acrylique|tempera|alkyd/.test(m)) return 'painting';
  if (/lithograph|etching|gravure|sérigraph|serigraphy|screenprint|woodcut|aquatint|drypoint|mezzotint|linocut/.test(m)) return 'print';
  if (/photo|gelatin|chromogenic|silver print|c-print|inkjet|archival pigment/.test(m)) return 'photography';
  if (/bronze|sculpture|ceramic|terracotta|marble|resin|plaster|steel|aluminum|fonte/.test(m)) return 'sculpture';
  if (/watercolor|gouache|pastel|charcoal|pencil|drawing|dessin|ink on paper|aquarelle|crayon/.test(m)) return 'works_on_paper';
  if (/mixed|techniques mixtes|multimedia/.test(m)) return 'mixed_media';
  return 'other';
}

// ── Estimation engine ──────────────────────────────────────────────────────

function computeEstimate(
  history: PriceHistory | null,
  selectedMedium: MediumValue | null,
): Estimate | null {
  if (!history) return null;

  let prices: number[] = [];
  let basedOnMedium = false;

  // 1. Try medium-filtered sales first
  if (selectedMedium && history.sales.length > 0) {
    const filtered = history.sales
      .filter(s => normalizeMediumRaw(s.medium || '') === selectedMedium)
      .map(s => s.hammer_price_eur)
      .filter((p): p is number => typeof p === 'number' && p > 0)
      .sort((a, b) => a - b);
    if (filtered.length >= 3) {
      prices = filtered;
      basedOnMedium = true;
    }
  }

  // 2. Fallback: all sales
  if (prices.length < 3 && history.sales.length > 0) {
    prices = history.sales
      .map(s => s.hammer_price_eur)
      .filter((p): p is number => typeof p === 'number' && p > 0)
      .sort((a, b) => a - b);
    basedOnMedium = false;
  }

  // 3. Fallback: use aggregate statistics (avg ± spread)
  if (prices.length === 0) {
    const avg = history.statistics?.avg_hammer_eur;
    if (!avg) return null;
    // Use recent years avg if available for better accuracy
    const recentYears = history.price_by_year.slice(-2);
    const recentAvg = recentYears.length > 0
      ? recentYears.reduce((s, y) => s + y.avg_price, 0) / recentYears.length
      : avg;
    const spread = history.total_sales >= 10 ? 0.30 : 0.45;
    return {
      low: Math.round(recentAvg * (1 - spread)),
      high: Math.round(recentAvg * (1 + spread)),
      median: Math.round(recentAvg),
      count: history.total_sales,
      trend: history.statistics?.trend_direction ?? 'stable',
      confidence: history.total_sales >= 20 ? 'medium' : 'low',
      basedOnMedium: false,
    };
  }

  // Winsorize top/bottom 10% to remove outliers
  const trimN = Math.max(0, Math.floor(prices.length * 0.1));
  const trimmed = prices.slice(trimN, prices.length - (trimN || 0));
  if (trimmed.length === 0) return null;

  const p25 = trimmed[Math.floor(trimmed.length * 0.25)] ?? trimmed[0];
  const median = trimmed[Math.floor(trimmed.length * 0.5)] ?? trimmed[0];
  const p75 = trimmed[Math.min(Math.floor(trimmed.length * 0.75), trimmed.length - 1)];

  // Widen range for small samples
  const extraSpread = prices.length < 5 ? 0.20 : 0;

  const confidence: Estimate['confidence'] =
    prices.length >= 20 ? 'high' : prices.length >= 5 ? 'medium' : 'low';

  return {
    low:    Math.round(p25 * (1 - extraSpread)),
    high:   Math.round(p75 * (1 + extraSpread)),
    median: Math.round(median),
    count:  prices.length,
    trend:  history.statistics?.trend_direction ?? 'stable',
    confidence,
    basedOnMedium,
  };
}

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M€`;
  if (n >= 10_000)    return `${Math.round(n / 1_000)} k€`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace('.', ',')} k€`;
  return `${n} €`;
}

const GRADE_COLOR: Record<string, string> = {
  A: Colors.green, 'B+': Colors.blue, B: Colors.blue, C: Colors.warning, D: Colors.error,
};

const CONFIDENCE_COLOR = {
  high: Colors.green,
  medium: Colors.warning,
  low: Colors.textTertiary,
};

// ── Component ──────────────────────────────────────────────────────────────

export default function ManualScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    artistName?: string;
    title?: string;
    year?: string;
    medium?: string;
  }>();

  // Form state
  const [artistName, setArtistName]     = useState(params.artistName ?? '');
  const [artistId, setArtistId]         = useState<string | null>(null);
  const [title, setTitle]               = useState(params.title ?? '');
  const [year, setYear]                 = useState(params.year ?? '');
  const [selectedMedium, setSelectedMedium] = useState<MediumValue | null>(
    params.medium ? (normalizeMediumRaw(params.medium) as MediumValue) : null
  );
  const [dimensions, setDimensions]     = useState('');

  // Autocomplete state
  const [suggestions, setSuggestions]         = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const acDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Market data state
  const [priceHistory, setPriceHistory]       = useState<PriceHistory | null>(null);
  const [investmentGrade, setInvestmentGrade] = useState<InvestmentGrade | null>(null);
  const [loadingMarket, setLoadingMarket]     = useState(false);

  const estimate = computeEstimate(priceHistory, selectedMedium);

  // ── Market data fetch ────────────────────────────────────────────────────

  const fetchMarketData = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return;
    setLoadingMarket(true);
    setPriceHistory(null);
    setInvestmentGrade(null);
    try {
      const encoded = encodeURIComponent(trimmed);
      const [hist, grade] = await Promise.all([
        api.get<PriceHistory>(`/api/artist-profiles/${encoded}/price-history`),
        api.get<InvestmentGrade>(`/api/artist-profiles/${encoded}/investment-grade`).catch(() => null),
      ]);
      setPriceHistory(hist.total_sales > 0 ? hist : null);
      if (grade?.grade) setInvestmentGrade(grade);
    } catch {
      // silently fail — no estimate shown
    } finally {
      setLoadingMarket(false);
    }
  }, []);

  // ── Artist input handlers ────────────────────────────────────────────────

  const handleArtistChange = (text: string) => {
    setArtistName(text);
    setArtistId(null);
    setPriceHistory(null);
    setInvestmentGrade(null);

    if (acDebounce.current) clearTimeout(acDebounce.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    acDebounce.current = setTimeout(async () => {
      const q = text.trim();
      const enc = encodeURIComponent(q);

      // Appel parallèle :
      // 1. autocomplete → table Artist enrichie (pg_trgm, a les ids)
      // 2. search/{q}   → table Lot.artist_name_raw (ILIKE, toujours fiable)
      const [acResult, searchResult] = await Promise.allSettled([
        api.get<{ suggestions: Suggestion[] }>(
          `/api/artist-profiles/autocomplete?q=${enc}&limit=6`
        ),
        api.get<{ artists: Array<{ name: string; lot_count: number }> }>(
          `/api/artist-profiles/search/${enc}`
        ),
      ]);

      const merged: Suggestion[] = [];
      const seen = new Set<string>();

      // Priorité aux résultats autocomplete (ont un id)
      if (acResult.status === 'fulfilled') {
        for (const s of acResult.value.suggestions ?? []) {
          merged.push(s);
          seen.add(s.name.toLowerCase());
        }
      }

      // Complète avec les résultats ILIKE non encore présents
      if (searchResult.status === 'fulfilled') {
        for (const a of (searchResult.value.artists ?? []).slice(0, 6)) {
          if (!seen.has(a.name.toLowerCase())) {
            merged.push({ name: a.name });
            seen.add(a.name.toLowerCase());
          }
        }
      }

      const list = merged.slice(0, 7);
      setSuggestions(list);
      setShowSuggestions(list.length > 0);
    }, 300);
  };

  const selectSuggestion = (item: Suggestion) => {
    setArtistName(item.name);
    setArtistId(item.id ?? null);
    setSuggestions([]);
    setShowSuggestions(false);
    fetchMarketData(item.name);
  };

  const handleArtistBlur = () => {
    setShowSuggestions(false);
    if (!artistId && artistName.trim().length >= 3) {
      fetchMarketData(artistName.trim());
    }
  };

  // ── Navigation ───────────────────────────────────────────────────────────

  const canContinue = artistName.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    const mediumObj = MEDIUMS.find(m => m.value === selectedMedium);
    router.push({
      pathname: '/add-artwork/price',
      params: {
        artistName:      artistName.trim(),
        artistId:        artistId ?? '',
        title:           title.trim(),
        year:            year.trim(),
        medium:          mediumObj?.display ?? '',
        dimensions:      dimensions.trim(),
        estimatedMin:    estimate?.low.toString()    ?? '',
        estimatedMax:    estimate?.high.toString()   ?? '',
        estimatedMedian: estimate?.median.toString() ?? '',
        estimatedCount:  estimate?.count.toString()  ?? '',
        trendDirection:  estimate?.trend             ?? '',
        investmentGrade: investmentGrade?.grade      ?? '',
        investmentLabel: investmentGrade?.label      ?? '',
      },
    });
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const trendIcon  = estimate?.trend === 'up' ? '↑' : estimate?.trend === 'down' ? '↓' : '→';
  const trendColor = estimate?.trend === 'up' ? Colors.green : estimate?.trend === 'down' ? Colors.error : Colors.textTertiary;
  const trendLabel = estimate?.trend === 'up' ? 'En hausse' : estimate?.trend === 'down' ? 'En baisse' : 'Stable';

  const gradeColor = investmentGrade?.grade ? (GRADE_COLOR[investmentGrade.grade] ?? Colors.textSecondary) : Colors.textSecondary;

  const confColor = estimate ? CONFIDENCE_COLOR[estimate.confidence] : Colors.borderTertiary;
  const confLabel = estimate?.confidence === 'high' ? 'Élevée' : estimate?.confidence === 'medium' ? 'Modérée' : 'Indicative';
  const confWidth = estimate?.confidence === 'high' ? '88%' : estimate?.confidence === 'medium' ? '55%' : '22%';

  return (
    <View style={s.container}>

      {/* ── Topbar ── */}
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <Text style={s.tbTitle}>Informations</Text>
        <Text style={s.tbStep}>3/4</Text>
      </View>
      <View style={s.progBg}><View style={[s.progFill, { width: '65%' }]} /></View>

      <ScrollView
        style={s.form}
        contentContainerStyle={s.formContent}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Artiste ── */}
        <View style={s.artistGroup}>
          <Text style={s.fieldLabel}>
            Artiste <Text style={s.required}>*</Text>
          </Text>
          <View style={s.inputRow}>
            <TextInput
              style={[s.input, s.inputFlex]}
              value={artistName}
              onChangeText={handleArtistChange}
              onBlur={handleArtistBlur}
              placeholder="Nom de l'artiste"
              placeholderTextColor={Colors.textTertiary}
              autoFocus={!params.artistName}
              autoCorrect={false}
              autoCapitalize="words"
            />
            {loadingMarket
              ? <ActivityIndicator size="small" color={Colors.green} style={s.spinner} />
              : artistId != null
                ? <View style={s.confirmedBadge}><Text style={s.confirmedTxt}>✓</Text></View>
                : null
            }
          </View>

          {showSuggestions && (
            <View style={s.dropdown}>
              {suggestions.map((item, idx) => (
                <Pressable
                  key={item.id ?? idx}
                  style={[s.dropItem, idx < suggestions.length - 1 && s.dropBorder]}
                  onPress={() => selectSuggestion(item)}
                >
                  <Text style={s.dropName}>{item.name}</Text>
                  {(item.nationality || item.birth_year) && (
                    <Text style={s.dropSub}>
                      {[item.nationality, item.birth_year ? `né·e ${item.birth_year}` : '']
                        .filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── Titre ── */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Titre</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Titre de l'œuvre"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        {/* ── Médium chips ── */}
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Médium</Text>
          <View style={s.chipRow}>
            {MEDIUMS.map(m => (
              <Pressable
                key={m.value}
                style={[s.chip, selectedMedium === m.value && s.chipActive]}
                onPress={() => setSelectedMedium(prev => prev === m.value ? null : m.value)}
              >
                <Text style={[s.chipTxt, selectedMedium === m.value && s.chipTxtActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Année + Dimensions ── */}
        <View style={s.fieldRow}>
          <View style={[s.fieldGroup, { flex: 1 }]}>
            <Text style={s.fieldLabel}>Année</Text>
            <TextInput
              style={s.input}
              value={year}
              onChangeText={setYear}
              placeholder="1990"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={[s.fieldGroup, { flex: 2 }]}>
            <Text style={s.fieldLabel}>Dimensions</Text>
            <TextInput
              style={s.input}
              value={dimensions}
              onChangeText={setDimensions}
              placeholder="81 × 65 cm"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        </View>

        {/* ── Loader marché ── */}
        {loadingMarket && !estimate && (
          <View style={s.marketLoader}>
            <ActivityIndicator size="small" color={Colors.green} />
            <Text style={s.marketLoaderTxt}>Analyse du marché en cours…</Text>
          </View>
        )}

        {/* ── Carte estimation ── */}
        {estimate && (
          <View style={[s.estimateCard, { borderColor: confColor }]}>

            <View style={s.estimateTopRow}>
              <Text style={s.estimateTitle}>Estimation de marché</Text>
              {investmentGrade?.grade && (
                <View style={[s.gradeBadge, { borderColor: gradeColor }]}>
                  <Text style={[s.gradeTxt, { color: gradeColor }]}>
                    Grade {investmentGrade.grade}
                  </Text>
                </View>
              )}
            </View>

            <Text style={s.estimateRange}>
              {fmtEur(estimate.low)} – {fmtEur(estimate.high)}
            </Text>

            <Text style={s.estimateMedian}>
              Médiane · {fmtEur(estimate.median)}
            </Text>

            <View style={s.estimateMeta}>
              <Text style={s.estimateMetaTxt}>
                {estimate.count} vente{estimate.count > 1 ? 's' : ''} analysée{estimate.count > 1 ? 's' : ''}
                {estimate.basedOnMedium ? ' · médium filtré' : ''}
              </Text>
              <Text style={[s.estimateTrend, { color: trendColor }]}>
                {trendIcon} {trendLabel}
              </Text>
            </View>

            <View style={s.confRow}>
              <View style={s.confBarBg}>
                <View style={[s.confBarFill, { width: confWidth, backgroundColor: confColor }]} />
              </View>
              <Text style={[s.confLabel, { color: confColor }]}>
                Fiabilité {confLabel}
              </Text>
            </View>

          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── CTA ── */}
      <View style={s.footer}>
        <Pressable
          style={[s.primaryBtn, !canContinue && s.primaryBtnOff]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={s.primaryBtnTxt}>Continuer →</Text>
        </Pressable>
      </View>

    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bgPrimary },

  // Topbar
  topbar:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  backBtn:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:        { fontSize: 20, color: Colors.textSecondary },
  tbTitle:        { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  tbStep:         { fontSize: Fonts.base, color: Colors.textTertiary },
  progBg:         { height: 2, backgroundColor: Colors.bgSecondary },
  progFill:       { height: 2, backgroundColor: Colors.green },

  // Form
  form:           { flex: 1 },
  formContent:    { padding: 16 },
  fieldGroup:     { marginBottom: 14 },
  fieldRow:       { flexDirection: 'row' },
  fieldLabel:     { fontSize: Fonts.base, color: Colors.textSecondary, marginBottom: 5 },
  required:       { color: Colors.green },
  input:          { borderWidth: 0.5, borderColor: Colors.borderSecondary, borderRadius: Radius.md, padding: 10, fontSize: Fonts.md, color: Colors.textPrimary },

  // Artist field
  artistGroup:    { marginBottom: 14 },
  inputRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputFlex:      { flex: 1 },
  spinner:        { marginRight: 2 },
  confirmedBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  confirmedTxt:   { color: '#fff', fontSize: 11, fontWeight: '600' },

  // Autocomplete dropdown
  dropdown:       { marginTop: 3, borderWidth: 0.5, borderColor: Colors.borderSecondary, borderRadius: Radius.md, backgroundColor: Colors.bgPrimary, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  dropItem:       { paddingHorizontal: 13, paddingVertical: 11 },
  dropBorder:     { borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  dropName:       { fontSize: Fonts.md, color: Colors.textPrimary, fontWeight: Fonts.medium },
  dropSub:        { fontSize: Fonts.sm, color: Colors.textTertiary, marginTop: 2 },

  // Medium chips
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip:           { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.borderSecondary, backgroundColor: Colors.bgPrimary },
  chipActive:     { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  chipTxt:        { fontSize: Fonts.base, color: Colors.textSecondary, fontWeight: Fonts.medium },
  chipTxtActive:  { color: Colors.bgPrimary },

  // Market loader
  marketLoader:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  marketLoaderTxt: { fontSize: Fonts.base, color: Colors.textTertiary },

  // Estimate card
  estimateCard:   { borderWidth: 1.5, borderRadius: Radius.lg, padding: 14, marginBottom: 4, backgroundColor: Colors.bgPrimary },
  estimateTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  estimateTitle:  { fontSize: Fonts.base, color: Colors.textSecondary, fontWeight: Fonts.medium },
  gradeBadge:     { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  gradeTxt:       { fontSize: Fonts.xs, fontWeight: '700', letterSpacing: 0.3 },
  estimateRange:  { fontSize: Fonts['2xl'], fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5, marginBottom: 3 },
  estimateMedian: { fontSize: Fonts.base, color: Colors.textTertiary, marginBottom: 10 },
  estimateMeta:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  estimateMetaTxt:{ fontSize: Fonts.sm, color: Colors.textTertiary },
  estimateTrend:  { fontSize: Fonts.sm, fontWeight: '600' },
  confRow:        { flexDirection: 'row', alignItems: 'center', gap: 9 },
  confBarBg:      { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.bgTertiary, overflow: 'hidden' },
  confBarFill:    { height: 3, borderRadius: 2 },
  confLabel:      { fontSize: Fonts.xs, fontWeight: '600', minWidth: 90 },

  // Footer
  footer:         { padding: 16, borderTopWidth: 0.5, borderTopColor: Colors.borderTertiary },
  primaryBtn:     { backgroundColor: Colors.textPrimary, borderRadius: Radius.md, padding: 13, alignItems: 'center' },
  primaryBtnOff:  { opacity: 0.4 },
  primaryBtnTxt:  { color: Colors.bgPrimary, fontSize: Fonts.lg, fontWeight: Fonts.medium },
});
