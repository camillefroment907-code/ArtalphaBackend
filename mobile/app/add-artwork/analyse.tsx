// app/add-artwork/analyse.tsx — Vision AI analysis (étape 46%)

import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Colors, Fonts, Radius } from '@/lib/tokens';

interface VisionResult {
  artist?: string | null;
  artist_id?: string | null;
  artist_confidence: number;
  title?: string | null;
  medium?: string | null;
  artwork_category?: string | null;
  year_estimate?: string | null;
  signature_detected: boolean;
  signature_position?: string | null;
  style?: string | null;
  period?: string | null;
  condition_apparent?: string;
  confidence: number;
  confidence_breakdown?: Record<string, number>;
  analysis: string;
  source_used?: string[];
  image_url?: string | null;  // URL Supabase si upload réussi
  error?: string | null;
}

const MESSAGES = [
  'Analyse de votre œuvre…',
  'Identification de l\'artiste…',
  'Vérification de la signature…',
  'Consultation de la base de données…',
  'Presque terminé…',
];

export default function AnalyseScreen() {
  const router = useRouter();
  const { photoUri } = useLocalSearchParams<{ photoUri: string }>();
  const [msgIndex, setMsgIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didRun = useRef(false);

  useEffect(() => {
    if (!photoUri || didRun.current) return;
    didRun.current = true;

    intervalRef.current = setInterval(() => {
      setMsgIndex(i => (i + 1) % MESSAGES.length);
    }, 2200);

    runAnalysis();

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [photoUri]);

  const runAnalysis = async () => {
    if (!photoUri) {
      Alert.alert('Debug', 'photoUri manquant — params non reçus', [
        { text: 'Manuel', onPress: () => router.replace('/add-artwork/manual') },
      ]);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('files', {
        uri:  photoUri,
        type: 'image/jpeg',
        name: 'main.jpg',
      } as unknown as Blob);

      const result = await api.upload<VisionResult>(
        '/api/collection/vision/analyze',
        formData,
      );

      if (intervalRef.current) clearInterval(intervalRef.current);

      if (result.error) {
        Alert.alert('Vision Error', result.error, [
          { text: 'Saisir manuellement', onPress: () => router.replace('/add-artwork/manual') },
        ]);
        return;
      }

      router.replace({
        pathname: '/add-artwork/result',
        params: {
          photoUri,
          imageUrl:          result.image_url ?? '',
          artist:            result.artist ?? '',
          artistId:          result.artist_id ?? '',
          artistConfidence:  String(result.artist_confidence),
          title:             result.title ?? '',
          medium:            result.medium ?? '',
          yearEstimate:      result.year_estimate ?? '',
          artworkCategory:   result.artwork_category ?? '',
          style:             result.style ?? '',
          period:            result.period ?? '',
          signatureDetected: result.signature_detected ? '1' : '0',
          confidence:        String(result.confidence),
          analysis:          result.analysis ?? '',
        },
      });
    } catch (err: unknown) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Erreur analyse', msg, [
        { text: 'Saisir manuellement', onPress: () => router.replace('/add-artwork/manual') },
      ]);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <Text style={s.tbTitle}>Analyse en cours</Text>
        <Text style={s.tbStep}>2/4</Text>
      </View>
      <View style={s.progBg}><View style={[s.progFill, { width: '46%' }]} /></View>

      <View style={s.content}>
        <View style={s.iconWrap}>
          <Text style={s.icon}>🔍</Text>
          <ActivityIndicator
            size="small"
            color={Colors.green}
            style={s.spinnerOverlay}
          />
        </View>
        <Text style={s.loadingTxt}>{MESSAGES[msgIndex]}</Text>
        <Text style={s.loadingSub}>
          Nautilus identifie l'œuvre en quelques secondes
        </Text>

        {/* Debug — à supprimer après validation */}
        <Text style={s.debugTxt} numberOfLines={2}>
          uri: {photoUri ? photoUri.slice(0, 40) + '…' : 'MANQUANT'}
        </Text>
        <Pressable style={s.debugBtn} onPress={runAnalysis}>
          <Text style={s.debugBtnTxt}>⟳ Relancer l'analyse</Text>
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
  content:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  iconWrap:       { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  icon:           { fontSize: 30 },
  spinnerOverlay: { position: 'absolute', bottom: -2, right: -2 },
  loadingTxt:     { fontSize: Fonts.md, fontWeight: Fonts.medium, color: Colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  loadingSub:     { fontSize: Fonts.sm, color: Colors.textTertiary, textAlign: 'center', lineHeight: 18 },
  debugTxt:       { marginTop: 24, fontSize: 10, color: Colors.textTertiary, textAlign: 'center', paddingHorizontal: 16 },
  debugBtn:       { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.sm, borderWidth: 0.5, borderColor: Colors.borderSecondary },
  debugBtnTxt:    { fontSize: Fonts.sm, color: Colors.textSecondary },
});
