// app/add-artwork/reinforce.tsx — Signature reinforcement (étape 75%)

import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Image, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { api } from '@/lib/api';
import { collectionService, type ValuationResult } from '@/services/api';

interface VisionResult {
  artist?: string | null;
  artist_id?: string | null;
  artist_confidence: number;
  title?: string | null;
  medium?: string | null;
  artwork_category?: string | null;
  year_estimate?: string | null;
  signature_detected: boolean;
  style?: string | null;
  period?: string | null;
  confidence: number;
  analysis: string;
  image_url?: string | null;
  error?: string | null;
}

export default function ReinforceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    photoUri:          string;
    imageUrl:          string;
    artist:            string;
    artistId:          string;
    artistConfidence:  string;
    title:             string;
    medium:            string;
    yearEstimate:      string;
    artworkCategory:   string;
    style:             string;
    period:            string;
    signatureDetected: string;
    confidence:        string;
    analysis:          string;
    signatureUri:      string;  // pré-rempli si déjà ajouté depuis result
  }>();

  const artistConf = parseInt(params.artistConfidence ?? '0', 10);

  const extractYear = (s: string): string => {
    const m = s.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    return m ? m[1] : '';
  };
  const yearForForm = extractYear(params.yearEstimate ?? '');

  const [signatureUri, setSignatureUri] = useState<string | null>(
    params.signatureUri || null,
  );
  const [loading, setLoading]           = useState(false);
  const [loadingSkip, setLoadingSkip]   = useState(false);

  // ── Photo picker ─────────────────────────────────────────────────────────────
  const pickSignature = () => {
    Alert.alert('Photo de la signature', undefined, [
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission requise', "Autorisez l'accès à l'appareil photo dans les réglages.");
            return;
          }
          const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!r.canceled && r.assets[0]) setSignatureUri(r.assets[0].uri);
        },
      },
      {
        text: 'Choisir dans la galerie',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission requise', "Autorisez l'accès à la galerie dans les réglages.");
            return;
          }
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
          });
          if (!r.canceled && r.assets[0]) setSignatureUri(r.assets[0].uri);
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  // ── Core: create + valuate + navigate ────────────────────────────────────────
  const createAndNavigate = async (
    artistName: string | null | undefined,
    artistId:   string | null | undefined,
    imageUrl:   string | null | undefined,
  ) => {
    const year = yearForForm ? parseInt(yearForForm, 10) : null;
    const name = artistName?.trim() || 'Artiste inconnu';
    const id   = artistId || null;

    const [item, valResult] = await Promise.all([
      collectionService.create({
        artist_name:        name,
        artist_id:          id,
        title:              params.title?.trim() || name,
        medium:             params.medium || null,
        dimensions:         null,
        year_created:       year && !isNaN(year) ? year : null,
        purchase_price_eur: null,
        purchase_source:    null,
        purchase_date:      null,
        acquisition_type:   null,
        image_url:          imageUrl || params.imageUrl || null,
      }),
      id
        ? collectionService.valuate({
            artist_id:          id,
            medium:             params.medium || null,
            year_created:       year && !isNaN(year) ? year : null,
            artist_name:        name,
            artwork_category:   params.artworkCategory || null,
            style:              params.style || null,
            period:             params.period || null,
            signature_detected: params.signatureDetected === '1' ? true : null,
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (params.photoUri && !imageUrl && !params.imageUrl) {
      collectionService.uploadPhoto(item.id, params.photoUri).catch(() => {});
    }

    try { console.log('[NAUTILUS_EVENT]', { event: 'artwork_created', timestamp: Date.now(), properties: { artist_id: id ?? null, has_valuation: valResult != null && (valResult as ValuationResult).valuation_median != null } }); } catch {}

    const val = valResult as ValuationResult | null;
    if (val && val.valuation_median != null) {
      router.replace({
        pathname: '/add-artwork/success',
        params: {
          artistName:     artistName ?? '',
          title:          params.title ?? '',
          estimatedValue: String(val.valuation_median),
          valueLow:       String(val.valuation_low ?? ''),
          valueHigh:      String(val.valuation_high ?? ''),
          valConf:        val.confidence,
          valCount:       String(val.comparables_count),
          hasArtistId:    id ? '1' : '0',
          comparables:    JSON.stringify(val.comparables.slice(0, 5)),
        },
      });
    } else {
      router.replace(`/collection/${item.id}`);
    }
  };

  // ── CTA: Confirmer avec la signature ─────────────────────────────────────────
  const handleConfirmWithSignature = async () => {
    if (!signatureUri || loading) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri:  signatureUri,
        type: 'image/jpeg',
        name: 'signature.jpg',
      } as unknown as Blob);

      const result = await api.upload<VisionResult>(
        '/api/collection/vision/analyze',
        formData,
      );

      let finalArtist   = params.artist;
      let finalArtistId = params.artistId || null;
      let finalImageUrl = params.imageUrl || null;

      if (!result.error && result.artist_confidence > artistConf && result.artist_id) {
        finalArtist   = result.artist ?? params.artist;
        finalArtistId = result.artist_id;
        finalImageUrl = result.image_url ?? params.imageUrl ?? null;
        try { console.log('[NAUTILUS_EVENT]', { event: 'reinforce_upgraded', timestamp: Date.now(), properties: { old_confidence: artistConf, new_confidence: result.artist_confidence, artist_id: result.artist_id } }); } catch {}
      }

      try { console.log('[NAUTILUS_EVENT]', { event: 'reinforce_completed', timestamp: Date.now(), properties: { upgraded: finalArtistId !== (params.artistId || null) } }); } catch {}

      await createAndNavigate(finalArtist, finalArtistId, finalImageUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Erreur', msg, [{ text: 'Réessayer', onPress: handleConfirmWithSignature }]);
      setLoading(false);
    }
  };

  // ── CTA: Ignorer et confirmer ─────────────────────────────────────────────────
  const handleSkip = async () => {
    if (loadingSkip || loading) return;
    setLoadingSkip(true);
    try {
      try { console.log('[NAUTILUS_EVENT]', { event: 'reinforce_abandoned', timestamp: Date.now(), properties: { artist_confidence: artistConf } }); } catch {}
      await createAndNavigate(params.artist, params.artistId, params.imageUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Erreur', msg, [{ text: 'Réessayer', onPress: handleSkip }]);
      setLoadingSkip(false);
    }
  };

  const busy = loading || loadingSkip;

  return (
    <View style={s.container}>
      {/* Topbar */}
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.backBtn} disabled={busy}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <Text style={s.tbTitle}>Vérifier</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={s.progBg}><View style={[s.progFill, { width: '75%' }]} /></View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Ajouter la signature</Text>
        <Text style={s.subheading}>
          La signature peut confirmer l'identification de l'artiste et améliorer l'estimation.
        </Text>

        {/* Signature slot */}
        <Pressable style={s.photoSlot} onPress={pickSignature} disabled={busy}>
          {signatureUri ? (
            <>
              <Image source={{ uri: signatureUri }} style={s.photoImg} resizeMode="cover" />
              <View style={s.photoEditBadge}>
                <Ionicons name="pencil-outline" size={12} color={Colors.textSecondary} />
                <Text style={s.photoEditTxt}>Modifier</Text>
              </View>
            </>
          ) : (
            <View style={s.photoEmpty}>
              <View style={s.photoAddCircle}>
                <Ionicons name="add" size={24} color={Colors.textSecondary} />
              </View>
              <Text style={s.photoLabel}>Photo de la signature</Text>
              <Text style={s.photoHint}>Photographiez la signature de l'artiste</Text>
            </View>
          )}
        </Pressable>

        {/* CTA principale */}
        <Pressable
          style={[s.primaryBtn, (!signatureUri || busy) && s.primaryBtnDisabled]}
          onPress={handleConfirmWithSignature}
          disabled={!signatureUri || busy}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[s.primaryBtnTxt, !signatureUri && s.primaryBtnTxtDisabled]}>
              Confirmer avec la signature →
            </Text>
          )}
        </Pressable>

        {/* CTA secondaire */}
        <Pressable
          style={[s.secondaryBtn, busy && { opacity: 0.5 }]}
          onPress={handleSkip}
          disabled={busy}
        >
          {loadingSkip ? (
            <ActivityIndicator color={Colors.textSecondary} size="small" />
          ) : (
            <Text style={s.secondaryBtnTxt}>Ignorer et confirmer</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:             { flex: 1, backgroundColor: Colors.bgSecondary },
  topbar:                { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary, backgroundColor: Colors.bgSecondary },
  backBtn:               { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:               { fontSize: 20, color: Colors.textSecondary },
  tbTitle:               { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  progBg:                { height: 2, backgroundColor: Colors.bgTertiary },
  progFill:              { height: 2, backgroundColor: Colors.green },

  scroll:                { flex: 1 },
  content:               { padding: 20, paddingBottom: 48 },

  heading:               { fontSize: Fonts['2xl'], fontWeight: Fonts.semibold, color: Colors.textPrimary, marginBottom: 8 },
  subheading:            { fontSize: Fonts.md, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 },

  photoSlot:             { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: Colors.borderTertiary },
  photoEmpty:            { height: 180, backgroundColor: Colors.bgPrimary, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoAddCircle:        { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  photoLabel:            { fontSize: Fonts.md, fontWeight: Fonts.medium, color: Colors.textPrimary },
  photoHint:             { fontSize: Fonts.sm, color: Colors.textTertiary },
  photoImg:              { width: '100%', height: 220 },
  photoEditBadge:        { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  photoEditTxt:          { fontSize: Fonts.xs, color: Colors.textSecondary },

  primaryBtn:            { backgroundColor: Colors.blue, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  primaryBtnDisabled:    { backgroundColor: Colors.bgTertiary },
  primaryBtnTxt:         { color: '#FFFFFF', fontSize: Fonts.lg, fontWeight: Fonts.medium },
  primaryBtnTxtDisabled: { color: Colors.textTertiary },

  secondaryBtn:          { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnTxt:       { fontSize: Fonts.md, color: Colors.textSecondary },
});
