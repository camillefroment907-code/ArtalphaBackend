// app/add-artwork/result.tsx — AI result confirmation (étape 58%)

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Image, ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { api } from '@/lib/api';
import { collectionService, type ValuationResult, type ResolveArtistSuggestion } from '@/services/api';

type ExtraKey = 'signature' | 'back' | 'certificate';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisionState {
  artist:            string;
  artistId:          string;
  artistConf:        number;
  title:             string;
  medium:            string;
  yearEstimate:      string;
  artworkCategory:   string;
  style:             string;
  period:            string;
  signatureDetected: boolean;
  confidence:        number;
  analysis:          string;
  imageUrl:          string;
}

interface VisionApiResult {
  artist?:            string | null;
  artist_id?:         string | null;
  artist_confidence:  number;
  title?:             string | null;
  medium?:            string | null;
  artwork_category?:  string | null;
  year_estimate?:     string | null;
  signature_detected: boolean;
  style?:             string | null;
  period?:            string | null;
  confidence:         number;
  analysis:           string;
  image_url?:         string | null;
  error?:             string | null;
}

// ── shouldReplaceResult ───────────────────────────────────────────────────────
// Toute la logique "best-wins" vit ici.
// Retourne uniquement les champs où le candidat apporte une amélioration.
// Le meilleur résultat connu reste toujours la source de vérité.

function shouldReplaceResult(
  current: VisionState,
  candidate: VisionApiResult,
  hasAuthoritativeEvidence = false, // signature ou certificat présents → preuve d'autorité
): Partial<VisionState> {
  const updates: Partial<VisionState> = {};

  // Artiste :
  // - Preuve d'autorité (signature/certificat) → accepter si confiance ≥ 60, peu importe le score précédent
  // - Sinon → best-wins classique (confiance strictement supérieure)
  const artistShouldUpdate = hasAuthoritativeEvidence
    ? candidate.artist_confidence >= 60
    : candidate.artist_confidence > current.artistConf;

  if (artistShouldUpdate) {
    updates.artistConf = candidate.artist_confidence;
    if (candidate.artist)    updates.artist   = candidate.artist;
    if (candidate.artist_id) updates.artistId = candidate.artist_id;
  }

  // Confiance globale : prendre le meilleur
  if (candidate.confidence > current.confidence) {
    updates.confidence = candidate.confidence;
  }

  // Champs texte : enrichir uniquement si le champ est vide
  if (!current.title          && candidate.title)             updates.title          = candidate.title;
  if (!current.medium         && candidate.medium)            updates.medium         = candidate.medium;
  if (!current.yearEstimate   && candidate.year_estimate)     updates.yearEstimate   = candidate.year_estimate;
  if (!current.artworkCategory && candidate.artwork_category) updates.artworkCategory = candidate.artwork_category;
  if (!current.style          && candidate.style)             updates.style          = candidate.style;
  if (!current.period         && candidate.period)            updates.period         = candidate.period;

  // Analyse : garder la plus riche
  if (candidate.analysis && candidate.analysis.length > current.analysis.length) {
    updates.analysis = candidate.analysis;
  }

  // Signature : une fois détectée, reste détectée
  if (candidate.signature_detected && !current.signatureDetected) {
    updates.signatureDetected = true;
  }

  return updates;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function ResultScreen() {
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
  }>();

  // État principal : toutes les données Vision sont mutables
  const [visionResult, setVisionResult] = useState<VisionState>({
    artist:            params.artist            ?? '',
    artistId:          params.artistId          ?? '',
    artistConf:        parseInt(params.artistConfidence ?? '0', 10),
    title:             params.title             ?? '',
    medium:            params.medium            ?? '',
    yearEstimate:      params.yearEstimate       ?? '',
    artworkCategory:   params.artworkCategory    ?? '',
    style:             params.style             ?? '',
    period:            params.period            ?? '',
    signatureDetected: params.signatureDetected === '1',
    confidence:        parseInt(params.confidence ?? '0', 10),
    analysis:          params.analysis          ?? '',
    imageUrl:          params.imageUrl          ?? '',
  });

  const [extraPhotos,     setExtraPhotos]     = useState<Partial<Record<ExtraKey, string>>>({});
  const [creating,        setCreating]        = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [suggestions,     setSuggestions]     = useState<ResolveArtistSuggestion[]>([]);

  // Animation fade sur la carte résultat lors d'une mise à jour
  const fadeAnim       = useRef(new Animated.Value(1)).current;
  // Génération d'analyse — pour ignorer les résultats périmés (remplace AbortController)
  const analysisGenRef = useRef(0);
  // Valorisation pré-chargée en arrière-plan
  const valuationRef   = useRef<Promise<ValuationResult | null> | null>(null);

  const extractYear = (s: string): string => {
    const m = s.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    return m ? m[1] : '';
  };
  const yearForForm = extractYear(visionResult.yearEstimate);

  // ── Valorisation — se relance si artistId s'améliore ─────────────────────
  useEffect(() => {
    if (!visionResult.artistId) return;
    const year = yearForForm ? parseInt(yearForForm, 10) : null;
    valuationRef.current = collectionService.valuate({
      artist_id:          visionResult.artistId,
      medium:             visionResult.medium          || null,
      year_created:       year && !isNaN(year) ? year : null,
      artist_name:        visionResult.artist          || null,
      artwork_category:   visionResult.artworkCategory || null,
      style:              visionResult.style           || null,
      period:             visionResult.period          || null,
      signature_detected: visionResult.signatureDetected ? true : null,
    }).then((res) => {
      try { console.log('[NAUTILUS_EVENT]', { event: 'valuation_ready', timestamp: Date.now(), properties: { artist_id: visionResult.artistId, confidence: res.confidence, comparables_count: res.comparables_count } }); } catch {}
      return res;
    }).catch(() => null);
  }, [visionResult.artistId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Résolution artiste (confiance intermédiaire) — une seule fois au montage
  useEffect(() => {
    const { artistConf, artistId, artist, style, period, medium, analysis, imageUrl } = visionResult;
    if (artistConf >= 95 && !!artistId) return;
    if (artistConf < 45) return;
    if (!artist) return;

    try { console.log('[NAUTILUS_EVENT]', { event: 'resolve_artist_called', timestamp: Date.now(), properties: { artist_confidence: artistConf, has_artist_id: !!artistId } }); } catch {}

    const resolvePromise = collectionService.resolveArtist({
      artist,
      artist_confidence: artistConf,
      style:             style    || null,
      period:            period   || null,
      medium:            medium   || null,
      analysis:          analysis || null,
      image_url:         imageUrl || params.imageUrl || null,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    );

    Promise.race([resolvePromise, timeoutPromise])
      .then((res) => {
        const suggs = res.suggestions.slice(0, 3);
        const wasUnresolved = !artistId;
        if (suggs.length > 0 && suggs[0].confidence === 'high') {
          const top = suggs[0];
          setVisionResult(prev => ({
            ...prev,
            artist:   top.artist_name,
            artistId: top.artist_id ?? prev.artistId,
          }));
          if (wasUnresolved && top.artist_id) {
            try { console.log('[NAUTILUS_EVENT]', { event: 'vision_rescued_by_resolver', timestamp: Date.now(), properties: { artist_id: top.artist_id, artist_confidence: artistConf } }); } catch {}
          }
          try { console.log('[NAUTILUS_EVENT]', { event: 'resolve_artist_auto_selected', timestamp: Date.now(), properties: { confidence: 'high', artist_id: top.artist_id } }); } catch {}
        } else {
          setSuggestions(suggs);
          if (wasUnresolved && suggs.length > 0) {
            try { console.log('[NAUTILUS_EVENT]', { event: 'vision_rescued_by_resolver', timestamp: Date.now(), properties: { artist_id: suggs[0].artist_id, artist_confidence: artistConf } }); } catch {}
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Réanalyse automatique ─────────────────────────────────────────────────
  // Appelée dès qu'une nouvelle preuve est ajoutée.
  // Envoie toutes les preuves disponibles en un seul appel.
  // Les résultats périmés sont ignorés via le compteur de génération.
  const reanalyzeArtwork = useCallback(async (currentPhotos: Partial<Record<ExtraKey, string>>) => {
    const gen = ++analysisGenRef.current;
    // Signature ou certificat = preuve d'autorité → logique de remplacement assouplie
    const hasAuthoritativeEvidence = !!(currentPhotos.signature || currentPhotos.certificate);
    setAnalysisLoading(true);

    try {
      const formData = new FormData();

      formData.append('files', {
        uri:  params.photoUri,
        type: 'image/jpeg',
        name: 'main.jpg',
      } as unknown as Blob);

      if (currentPhotos.signature) {
        formData.append('files', { uri: currentPhotos.signature, type: 'image/jpeg', name: 'signature.jpg' } as unknown as Blob);
      }
      if (currentPhotos.back) {
        formData.append('files', { uri: currentPhotos.back, type: 'image/jpeg', name: 'back.jpg' } as unknown as Blob);
      }
      if (currentPhotos.certificate) {
        formData.append('files', { uri: currentPhotos.certificate, type: 'image/jpeg', name: 'certificate.jpg' } as unknown as Blob);
      }

      const result = await api.upload<VisionApiResult>('/api/collection/vision/analyze', formData);

      if (gen !== analysisGenRef.current) return;

      if (result.error) {
        console.warn('[reanalyze] Vision error:', result.error);
        Alert.alert('Analyse', `L'analyse n'a pas pu être améliorée : ${result.error}`);
        return;
      }

      setVisionResult(prev => {
        const updates = shouldReplaceResult(prev, result, hasAuthoritativeEvidence);
        if (Object.keys(updates).length === 0) return prev;
        try { console.log('[NAUTILUS_EVENT]', { event: 'reanalysis_improved', timestamp: Date.now(), properties: { updated_fields: Object.keys(updates), authoritative: hasAuthoritativeEvidence, new_artist_conf: updates.artistConf ?? prev.artistConf } }); } catch {}
        return { ...prev, ...updates };
      });

      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.65, duration: 100, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1.0,  duration: 200, useNativeDriver: true }),
      ]).start();

    } catch (err) {
      if (gen !== analysisGenRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[reanalyze] Failed:', msg);
      Alert.alert('Analyse', `Impossible de relancer l'analyse : ${msg}`);
    } finally {
      if (gen === analysisGenRef.current) setAnalysisLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sélection manuelle d'un artiste depuis les suggestions ───────────────
  const selectSuggestion = useCallback((sg: ResolveArtistSuggestion) => {
    setVisionResult(prev => ({
      ...prev,
      artist:   sg.artist_name,
      artistId: sg.artist_id ?? prev.artistId,
    }));
    setSuggestions([]);
    try { console.log('[NAUTILUS_EVENT]', { event: 'resolve_artist_user_confirmed', timestamp: Date.now(), properties: { artist_id: sg.artist_id } }); } catch {}
  }, []);

  // ── Valeurs dérivées ──────────────────────────────────────────────────────
  const confColor =
    visionResult.confidence >= 75 ? Colors.green :
    visionResult.confidence >= 45 ? '#E8962A' :
    Colors.textTertiary;

  const confLabel =
    visionResult.confidence >= 75 ? 'Identification fiable' :
    visionResult.confidence >= 45 ? 'Identification probable' :
    'Identification indicative';

  const hasResult = !!(visionResult.artist || visionResult.title || visionResult.medium);

  const docItems: { label: string; done: boolean }[] = [
    { label: 'Photo frontale',       done: !!params.photoUri },
    { label: 'Artiste',              done: !!visionResult.artist },
    { label: 'Titre',                done: !!visionResult.title },
    { label: 'Technique / médium',   done: !!visionResult.medium },
    { label: 'Date',                 done: !!yearForForm },
    { label: 'Signature',            done: visionResult.signatureDetected || !!extraPhotos.signature },
    { label: 'Photo supplémentaire', done: !!(extraPhotos.back || extraPhotos.certificate) },
  ];
  const docDone  = docItems.filter((d) => d.done).length;
  const docTotal = docItems.length;

  // ── Conversion en JPEG — gère les photos HEIC d'iPhone ──────────────────
  const toJpeg = async (uri: string): Promise<string> => {
    try {
      // Import dynamique — pas de crash si le module natif n'est pas encore compilé
      const ImageManipulator = await import('expo-image-manipulator');
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      return result.uri;
    } catch {
      return uri; // fallback : URI originale si module non disponible
    }
  };

  // ── Ajout de photo extra → réanalyse automatique ──────────────────────────
  const pickExtraPhoto = (key: ExtraKey) => {
    Alert.alert('Ajouter une photo', undefined, [
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission requise', "Autorisez l'accès à l'appareil photo dans les réglages.");
            return;
          }
          const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!r.canceled && r.assets[0]) {
            const uri = await toJpeg(r.assets[0].uri);
            const newPhotos = { ...extraPhotos, [key]: uri };
            setExtraPhotos(newPhotos);
            reanalyzeArtwork(newPhotos);
          }
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
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
          if (!r.canceled && r.assets[0]) {
            const uri = await toJpeg(r.assets[0].uri);
            const newPhotos = { ...extraPhotos, [key]: uri };
            setExtraPhotos(newPhotos);
            reanalyzeArtwork(newPhotos);
          }
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  // ── Création de la fiche ──────────────────────────────────────────────────
  const createAndContinue = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const year       = yearForForm ? parseInt(yearForForm, 10) : null;
      const artistName = visionResult.artist;
      const artistId   = visionResult.artistId;

      let imageUrl = visionResult.imageUrl || params.imageUrl || null;
      const [item, valResult] = await Promise.all([
        collectionService.create({
          artist_name:        artistName?.trim() || 'Artiste inconnu',
          artist_id:          artistId || null,
          title:              visionResult.title?.trim() || artistName?.trim() || 'Sans titre',
          medium:             visionResult.medium || null,
          dimensions:         null,
          year_created:       year && !isNaN(year) ? year : null,
          purchase_price_eur: null,
          purchase_source:    null,
          purchase_date:      null,
          acquisition_type:   null,
          image_url:          imageUrl,
          image_urls:         imageUrl ? [imageUrl] : null,
        }),
        valuationRef.current ?? Promise.resolve(null),
      ]);

      try { console.log('[NAUTILUS_EVENT]', { event: 'artwork_created', timestamp: Date.now(), properties: { artist_id: artistId ?? null, has_valuation: valResult != null && valResult.valuation_median != null } }); } catch {}

      if (params.photoUri && !imageUrl) {
        try {
          const uploaded = await collectionService.uploadPhoto(item.id, params.photoUri);
          imageUrl = uploaded.image_url ?? imageUrl;
        } catch {}
      }

      if (valResult && valResult.valuation_median != null) {
        router.replace({
          pathname: '/add-artwork/success',
          params: {
            artistName:     artistName ?? '',
            title:          visionResult.title ?? '',
            estimatedValue: String(valResult.valuation_median),
            valueLow:       String(valResult.valuation_low ?? ''),
            valueHigh:      String(valResult.valuation_high ?? ''),
            valConf:        valResult.confidence,
            valCount:       String(valResult.comparables_count),
            hasArtistId:    artistId ? '1' : '0',
            comparables:    JSON.stringify(valResult.comparables.slice(0, 5)),
          },
        });
      } else {
        try { console.log('[NAUTILUS_EVENT]', { event: 'valuation_failed', timestamp: Date.now(), properties: { artist_id: artistId ?? null, reason: 'no_result' } }); } catch {}
        router.replace(`/collection/${item.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[createAndContinue]', msg);
      Alert.alert(
        'Erreur',
        msg || 'Impossible de créer la fiche. Vérifiez votre connexion.',
        [{ text: 'Réessayer', onPress: createAndContinue }],
      );
    } finally {
      setCreating(false);
    }
  };

  const goToEdit = () =>
    router.push({
      pathname: '/add-artwork/manual',
      params: {
        artistName: visionResult.artist,
        artistId:   visionResult.artistId,
        title:      visionResult.title,
        year:       yearForForm,
        medium:     visionResult.medium,
      },
    });

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      {/* Topbar */}
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <Text style={s.tbTitle}>Vérifier</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={s.progBg}><View style={[s.progFill, { width: '58%' }]} /></View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {hasResult ? (
          <Text style={s.foundTxt}>Nautilus a identifié :</Text>
        ) : (
          <Text style={s.foundTxt}>Analyse incomplète</Text>
        )}

        {/* ── Carte résultat — animée lors des mises à jour ─────────────── */}
        <Animated.View style={[s.resultCard, { opacity: fadeAnim }]}>

          {/* Loader discret pendant réanalyse */}
          {analysisLoading && (
            <View style={s.analysisLoadingBar}>
              <ActivityIndicator size="small" color={Colors.green} />
              <Text style={s.analysisLoadingTxt}>Analyse des nouvelles informations…</Text>
            </View>
          )}

          {/* Photo thumbnail */}
          {params.photoUri ? (
            <Image source={{ uri: params.photoUri }} style={s.thumb} resizeMode="cover" />
          ) : (
            <View style={s.thumbPlaceholder}>
              <Ionicons name="image-outline" size={40} color={Colors.textTertiary} />
            </View>
          )}

          {/* Confidence badge */}
          {visionResult.confidence > 0 && (
            <View style={[s.confBadge, { borderColor: confColor }]}>
              <View style={[s.confDot, { backgroundColor: confColor }]} />
              <Text style={[s.confTxt, { color: confColor }]}>{confLabel}</Text>
            </View>
          )}

          {/* Artist */}
          <View style={s.artistRow}>
            {visionResult.artistConf >= 75 ? (
              visionResult.artist
                ? <Text style={s.artistName}>{visionResult.artist}</Text>
                : <Text style={s.artistUnknown}>Artiste non identifié</Text>
            ) : visionResult.artistConf >= 45 ? (
              <View style={s.artistConfRow}>
                <Text style={s.artistName}>{visionResult.artist}</Text>
                <View style={s.badgeConfirm}><Text style={s.badgeConfirmTxt}>À confirmer</Text></View>
              </View>
            ) : (
              <Text style={s.artistUnknown}>Attribution incertaine</Text>
            )}
          </View>

          {/* Title */}
          {visionResult.title ? <Text style={s.title}>{visionResult.title}</Text> : null}

          {/* Medium + Year */}
          {(visionResult.medium || visionResult.yearEstimate) ? (
            <Text style={s.meta}>
              {[visionResult.yearEstimate, visionResult.medium].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          {/* Style / Period */}
          {(visionResult.style || visionResult.period) ? (
            <Text style={s.stylePeriod}>
              {[visionResult.period, visionResult.style].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          {/* Signature */}
          {visionResult.signatureDetected && (
            <View style={s.sigBadge}>
              <Ionicons name="pencil-outline" size={11} color={Colors.textSecondary} />
              <Text style={s.sigTxt}>Signature détectée</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Artistes proches ── */}
        {suggestions.length > 0 && (
          <View style={s.suggestBloc}>
            <Text style={s.suggestTitle}>ARTISTES PROCHES</Text>
            {suggestions.map((sg, i) => (
              <Pressable
                key={sg.artist_id ?? i}
                style={[s.suggestRow, i < suggestions.length - 1 && s.suggestDivider]}
                onPress={() => selectSuggestion(sg)}
              >
                <View style={s.suggestInfo}>
                  <Text style={s.suggestName}>{sg.artist_name}</Text>
                </View>
                {(visionResult.artistId === sg.artist_id || (!visionResult.artistId && sg.artist_name === visionResult.artist)) && (
                  <Ionicons name="checkmark" size={16} color={Colors.green} style={s.suggestCheck} />
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Contexte détecté ── */}
        {visionResult.artistConf < 45 && (visionResult.style || visionResult.period || visionResult.medium) && (
          <View style={s.unknownBloc}>
            <Text style={s.suggestTitle}>CONTEXTE DÉTECTÉ</Text>
            <View style={s.detectedCtx}>
              {visionResult.period && (
                <View style={s.detectedRow}>
                  <Text style={s.suggestMeta}>Période</Text>
                  <Text style={s.suggestName}>{visionResult.period}</Text>
                </View>
              )}
              {visionResult.style && (
                <View style={s.detectedRow}>
                  <Text style={s.suggestMeta}>Style</Text>
                  <Text style={s.suggestName}>{visionResult.style}</Text>
                </View>
              )}
              {visionResult.medium && (
                <View style={s.detectedRow}>
                  <Text style={s.suggestMeta}>Médium</Text>
                  <Text style={s.suggestName}>{visionResult.medium}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Analyse textuelle */}
        {visionResult.analysis ? (
          <View style={s.analysisBox}>
            <Text style={s.analysisTxt}>{visionResult.analysis}</Text>
          </View>
        ) : null}

        {/* ── Fiche complétée ── */}
        <View style={s.docBloc}>
          <View style={s.docHeader}>
            <Text style={s.docTitle}>Fiche complétée</Text>
            <Text style={s.docCount}>{docDone}/{docTotal}</Text>
          </View>
          <View style={s.docBarBg}>
            <View style={[s.docBarFill, { width: `${Math.round((docDone / docTotal) * 100)}%` }]} />
          </View>
          <View style={s.docList}>
            {docItems.map((item) => (
              <View key={item.label} style={s.docRow}>
                <Ionicons
                  name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={item.done ? Colors.green : Colors.borderSecondary}
                />
                <Text style={[s.docLabel, !item.done && s.docLabelMuted]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Sources de la fiche ── */}
        <View style={s.sourcesBloc}>
          <Text style={s.sourcesTitle}>Sources de la fiche</Text>

          {/* Photo frontale — toujours présente */}
          <View style={s.sourceRow}>
            {params.photoUri ? (
              <Image source={{ uri: params.photoUri }} style={s.sourceThumb} resizeMode="cover" />
            ) : (
              <View style={[s.sourceThumb, s.sourceThumbEmpty]}>
                <Ionicons name="image-outline" size={16} color={Colors.textTertiary} />
              </View>
            )}
            <View style={s.sourceInfo}>
              <Text style={s.sourceLabel}>Photo frontale</Text>
              <Text style={s.sourceStatus}>Ajoutée</Text>
            </View>
          </View>

          {/* Signature */}
          <Pressable style={s.sourceRow} onPress={() => pickExtraPhoto('signature')} disabled={analysisLoading}>
            {extraPhotos.signature ? (
              <Image source={{ uri: extraPhotos.signature }} style={s.sourceThumb} resizeMode="cover" />
            ) : (
              <View style={[s.sourceThumb, s.sourceThumbEmpty]}>
                <Ionicons name="add" size={16} color={Colors.textTertiary} />
              </View>
            )}
            <View style={s.sourceInfo}>
              <Text style={s.sourceLabel}>Photo de la signature</Text>
              <Text style={extraPhotos.signature ? s.sourceStatus : s.sourceAdd}>
                {extraPhotos.signature ? 'Ajoutée' : 'Ajouter'}
              </Text>
            </View>
            {!extraPhotos.signature && (
              <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
            )}
          </Pressable>

          {/* Verso */}
          <Pressable style={s.sourceRow} onPress={() => pickExtraPhoto('back')} disabled={analysisLoading}>
            {extraPhotos.back ? (
              <Image source={{ uri: extraPhotos.back }} style={s.sourceThumb} resizeMode="cover" />
            ) : (
              <View style={[s.sourceThumb, s.sourceThumbEmpty]}>
                <Ionicons name="add" size={16} color={Colors.textTertiary} />
              </View>
            )}
            <View style={s.sourceInfo}>
              <Text style={s.sourceLabel}>Photo du verso</Text>
              <Text style={extraPhotos.back ? s.sourceStatus : s.sourceAdd}>
                {extraPhotos.back ? 'Ajoutée' : 'Ajouter'}
              </Text>
            </View>
            {!extraPhotos.back && (
              <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
            )}
          </Pressable>

          {/* Certificat */}
          <Pressable style={[s.sourceRow, s.sourceRowLast]} onPress={() => pickExtraPhoto('certificate')} disabled={analysisLoading}>
            {extraPhotos.certificate ? (
              <Image source={{ uri: extraPhotos.certificate }} style={s.sourceThumb} resizeMode="cover" />
            ) : (
              <View style={[s.sourceThumb, s.sourceThumbEmpty]}>
                <Ionicons name="add" size={16} color={Colors.textTertiary} />
              </View>
            )}
            <View style={s.sourceInfo}>
              <Text style={s.sourceLabel}>Certificat d'authenticité</Text>
              <Text style={extraPhotos.certificate ? s.sourceStatus : s.sourceAdd}>
                {extraPhotos.certificate ? 'Ajouté' : 'Ajouter'}
              </Text>
            </View>
            {!extraPhotos.certificate && (
              <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
            )}
          </Pressable>
        </View>

        {/* ── CTAs ── */}
        {!hasResult ? (
          <Pressable style={s.primaryBtn} onPress={goToEdit}>
            <Text style={s.primaryBtnTxt}>Saisir manuellement</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[s.primaryBtn, (creating || analysisLoading) && { opacity: 0.6 }]}
              onPress={createAndContinue}
              disabled={creating || analysisLoading}
            >
              {creating
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={s.primaryBtnTxt}>
                    {analysisLoading ? 'Analyse en cours…' : 'Confirmer et créer la fiche →'}
                  </Text>
              }
            </Pressable>
            <Pressable style={s.secondaryBtn} onPress={goToEdit}>
              <Text style={s.secondaryBtnTxt}>Modifier les informations</Text>
            </Pressable>
            <View style={s.hint}>
              <Text style={s.hintTxt}>
                La fiche est créée immédiatement.{'\n'}Vous pourrez ajouter le prix d'acquisition, la provenance et les documents depuis la fiche œuvre.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bgPrimary },
  topbar:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  backBtn:         { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:         { fontSize: 20, color: Colors.textSecondary },
  tbTitle:         { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  progBg:          { height: 2, backgroundColor: Colors.bgSecondary },
  progFill:        { height: 2, backgroundColor: Colors.green },

  scroll:          { flex: 1 },
  content:         { padding: 16, paddingBottom: 40 },
  foundTxt:        { fontSize: Fonts.md, color: Colors.textSecondary, marginBottom: 12 },

  resultCard:      { borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 12 },

  analysisLoadingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: Colors.bgSecondary, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  analysisLoadingTxt: { fontSize: Fonts.sm, color: Colors.textSecondary },

  thumb:           { width: '100%', height: 200 },
  thumbPlaceholder:{ height: 200, backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center' },

  confBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, margin: 12, marginBottom: 0, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 0.5, borderRadius: Radius.sm, alignSelf: 'flex-start' },
  confDot:         { width: 6, height: 6, borderRadius: 3 },
  confTxt:         { fontSize: Fonts.xs, fontWeight: Fonts.medium },

  artistRow:       { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 2 },
  artistName:      { fontSize: Fonts.sm, color: Colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase' },
  artistUnknown:   { fontSize: Fonts.sm, color: Colors.textTertiary, fontStyle: 'italic' },

  title:           { fontSize: Fonts.xl, fontWeight: Fonts.medium, color: Colors.textPrimary, paddingHorizontal: 12, marginBottom: 3 },
  meta:            { fontSize: Fonts.base, color: Colors.textSecondary, paddingHorizontal: 12, marginBottom: 3 },
  stylePeriod:     { fontSize: Fonts.sm, color: Colors.textTertiary, paddingHorizontal: 12, marginBottom: 8 },

  sigBadge:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginHorizontal: 12, marginBottom: 12, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.bgSecondary, borderRadius: Radius.sm, alignSelf: 'flex-start' },
  sigTxt:          { fontSize: Fonts.xs, color: Colors.textSecondary },

  analysisBox:     { padding: 12, paddingHorizontal: 13, backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, marginBottom: 14 },
  analysisTxt:     { fontSize: Fonts.sm, color: Colors.textSecondary, lineHeight: 18 },

  docBloc:         { borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, padding: 14, marginBottom: 12 },
  docHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  docTitle:        { fontSize: Fonts.sm, fontWeight: Fonts.semibold, color: Colors.textPrimary },
  docCount:        { fontSize: Fonts.xs, color: Colors.textTertiary },
  docBarBg:        { height: 3, backgroundColor: Colors.bgSecondary, borderRadius: 2, marginBottom: 12 },
  docBarFill:      { height: 3, backgroundColor: Colors.green, borderRadius: 2 },
  docList:         { gap: 7 },
  docRow:          { flexDirection: 'row', alignItems: 'center', gap: 7 },
  docLabel:        { fontSize: Fonts.sm, color: Colors.textPrimary },
  docLabelMuted:   { color: Colors.textTertiary },

  sourcesBloc:     { borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 14 },
  sourcesTitle:    { fontSize: Fonts.sm, fontWeight: Fonts.semibold, color: Colors.textPrimary, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 },
  sourceRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: Colors.borderTertiary },
  sourceRowLast:   {},
  sourceThumb:     { width: 36, height: 36, borderRadius: 6 },
  sourceThumbEmpty:{ backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  sourceInfo:      { flex: 1 },
  sourceLabel:     { fontSize: Fonts.sm, color: Colors.textPrimary, marginBottom: 1 },
  sourceStatus:    { fontSize: Fonts.xs, color: Colors.green },
  sourceAdd:       { fontSize: Fonts.xs, color: Colors.textTertiary },

  primaryBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: Radius.md, backgroundColor: '#0F2D5C', marginBottom: 9 },
  primaryBtnTxt:   { color: '#FFFFFF', fontSize: Fonts.lg, fontWeight: Fonts.medium },
  secondaryBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 11, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderSecondary, marginBottom: 10 },
  secondaryBtnTxt: { fontSize: Fonts.md, color: Colors.textSecondary },

  hint:            { padding: 9, paddingHorizontal: 11, backgroundColor: Colors.bgSecondary, borderRadius: Radius.md },
  hintTxt:         { fontSize: 11, color: Colors.textTertiary, lineHeight: 16 },

  artistConfRow:   { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  badgeConfirm:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(232,150,42,0.12)', borderWidth: 0.5, borderColor: '#E8962A' },
  badgeConfirmTxt: { fontSize: Fonts.xs, color: '#E8962A', fontWeight: Fonts.medium },

  suggestBloc:     { borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 12 },
  suggestTitle:    { fontSize: Fonts.xs, color: Colors.textTertiary, letterSpacing: 0.7, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8, textTransform: 'uppercase' },
  suggestRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  suggestDivider:  { borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  suggestInfo:     { flex: 1 },
  suggestName:     { fontSize: Fonts.sm, color: Colors.textPrimary, fontWeight: Fonts.medium, marginBottom: 1 },
  suggestMeta:     { fontSize: Fonts.xs, color: Colors.textTertiary },
  suggestCheck:    { marginLeft: 6 },

  unknownBloc:     { borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 12 },
  detectedCtx:     { paddingHorizontal: 14, paddingBottom: 12 },
  detectedRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderTopWidth: 0.5, borderTopColor: Colors.borderTertiary },
});
