// app/add-artwork/success.tsx — Wow moment (dark, premium)

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Fonts, Radius } from '@/lib/tokens';

function fmtEur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k€`;
  return `${Math.round(n)} €`;
}

const CONF_LABEL: Record<string, string> = {
  high:   'Fiabilité élevée',
  medium: 'Fiabilité modérée',
  low:    'Estimation indicative',
};

export default function SuccessScreen() {
  const router = useRouter();
  const { artistName, title, estimatedValue, valueLow, valueHigh, valConf, valCount, hasArtistId } =
    useLocalSearchParams<{
      artistName?: string;
      title?: string;
      estimatedValue?: string;
      valueLow?: string;
      valueHigh?: string;
      valConf?: string;
      valCount?: string;
      hasArtistId?: string;
    }>();

  const valLow  = valueLow  ? parseFloat(valueLow)  : null;
  const valHigh = valueHigh ? parseFloat(valueHigh) : null;
  const valMed  = estimatedValue ? parseFloat(estimatedValue) : null;
  const count   = valCount ? parseInt(valCount, 10) : null;
  const hasRange = valLow != null && valLow > 0 && valHigh != null && valHigh > 0;
  const hasValue = valMed != null && valMed > 0;
  const confLabel = valConf ? (CONF_LABEL[valConf] ?? null) : null;

  const displayArtist = artistName || 'Votre œuvre';
  const displayTitle = title || null;

  return (
    <View style={s.container}>

      {/* ── N ring ── */}
      <View style={s.logoRing}>
        <Text style={s.logoMark}>N</Text>
      </View>

      {/* ── Main message ── */}
      <Text style={s.artist}>{displayArtist}</Text>
      {displayTitle && <Text style={s.workTitle}>"{displayTitle}"</Text>}
      <Text style={s.addedMsg}>rejoint votre collection.</Text>

      <View style={s.divider} />

      {/* ── Valorisation ── */}
      {hasRange ? (
        <View style={s.valWrap}>
          <Text style={s.valLabel}>VALEUR ESTIMÉE</Text>
          <Text style={s.valRange}>{fmtEur(valLow!)} – {fmtEur(valHigh!)}</Text>
          {hasValue && <Text style={s.valMedian}>Médiane · {fmtEur(valMed!)}</Text>}
          <View style={s.valMeta}>
            {count != null && count > 0 && (
              <Text style={s.valMetaTxt}>{count} comparable{count > 1 ? 's' : ''}</Text>
            )}
            {confLabel && (
              <Text style={s.valMetaTxt}>{confLabel}</Text>
            )}
          </View>
        </View>
      ) : hasValue ? (
        <View style={s.valWrap}>
          <Text style={s.valLabel}>ESTIMÉE À ENVIRON</Text>
          <Text style={s.valAmount}>{fmtEur(valMed!)}</Text>
          <Text style={s.valSource}>Basé sur les comparables récents du marché</Text>
        </View>
      ) : (
        <View style={s.valWrap}>
          <Text style={s.valLabelDim}>
            {hasArtistId === '1'
              ? "Pas assez de données pour valoriser cette œuvre pour l'instant."
              : "Associez un artiste reconnu pour obtenir une estimation de marché."}
          </Text>
        </View>
      )}

      {/* ── CTAs ── */}
      <View style={s.ctaWrap}>
        <Pressable style={s.primaryBtn} onPress={() => router.replace('/(tabs)/collection')}>
          <Text style={s.primaryBtnTxt}>Voir ma collection →</Text>
        </Pressable>
        <Pressable
          style={s.secBtn}
          onPress={() => router.replace('/add-artwork')}
        >
          <Text style={s.secBtnTxt}>Ajouter une autre œuvre</Text>
        </Pressable>
      </View>

      <Text style={s.legal}>Nautilus Collection OS · 2026</Text>

    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.night, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },

  logoRing:     { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: Colors.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  logoMark:     { fontSize: 24, fontWeight: '700', color: Colors.blue, letterSpacing: -0.5 },

  artist:       { fontSize: Fonts['2xl'], fontWeight: '700', color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.3, marginBottom: 4 },
  workTitle:    { fontSize: Fonts.lg, color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontStyle: 'italic', marginBottom: 8 },
  addedMsg:     { fontSize: Fonts.md, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },

  divider:      { width: 32, height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 24 },

  valWrap:      { alignItems: 'center', marginBottom: 32 },
  valLabel:     { fontSize: Fonts.xs, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  valRange:     { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.8, marginBottom: 4 },
  valMedian:    { fontSize: Fonts.base, color: 'rgba(255,255,255,0.45)', marginBottom: 8 },
  valMeta:      { flexDirection: 'row', gap: 12, marginTop: 4 },
  valMetaTxt:   { fontSize: Fonts.sm, color: 'rgba(255,255,255,0.3)' },
  valAmount:    { fontSize: 34, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1, marginBottom: 6 },
  valSource:    { fontSize: Fonts.sm, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
  valLabelDim:  { fontSize: Fonts.md, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 20 },

  ctaWrap:      { width: '100%', gap: 10 },
  primaryBtn:   { backgroundColor: Colors.blue, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  primaryBtnTxt:{ color: '#FFFFFF', fontSize: Fonts.lg, fontWeight: '700', letterSpacing: 0.2 },
  secBtn:       { padding: 12, alignItems: 'center' },
  secBtnTxt:    { fontSize: Fonts.base, color: 'rgba(255,255,255,0.4)' },

  legal:        { position: 'absolute', bottom: 32, fontSize: Fonts.xs, color: 'rgba(255,255,255,0.15)', letterSpacing: 0.3 },
});
