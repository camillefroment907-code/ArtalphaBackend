// app/add-artwork/photo.tsx — Photo step avec caméra réelle (étape 30%)

import {
  View, Text, Pressable, StyleSheet, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/lib/tokens';

export default function PhotoScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Photo capturée → conversion JPEG si nécessaire → analyse Vision AI
  const afterCapture = async (uri: string) => {
    let finalUri = uri;
    try {
      const ImageManipulator = await import('expo-image-manipulator');
      const converted = await ImageManipulator.manipulateAsync(
        uri, [], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      finalUri = converted.uri;
    } catch {}
    router.push({
      pathname: '/add-artwork/analyse',
      params: { photoUri: finalUri },
    });
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        try { console.log('[NAUTILUS_EVENT]', { event: 'photo_submitted', timestamp: Date.now(), properties: { source: 'camera' } }); } catch {}
        await afterCapture(photo.uri);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de prendre la photo. Réessayez.');
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à votre galerie dans les réglages.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      try { console.log('[NAUTILUS_EVENT]', { event: 'photo_submitted', timestamp: Date.now(), properties: { source: 'gallery' } }); } catch {}
      await afterCapture(result.assets[0].uri);
    }
  };

  // ── Permission non accordée ───────────────────────────────────────────────
  if (!permission?.granted) {
    const isDenied = permission?.status === 'denied';

    return (
      <View style={s.container}>
        <View style={s.topbar}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </Pressable>
          <Text style={s.tbTitle}>Photographier une œuvre</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.progBg}><View style={[s.progFill, { width: '30%' }]} /></View>

        <View style={s.permContent}>
          <View style={s.iconCircle}>
            <Ionicons name="camera-outline" size={28} color={Colors.textSecondary} />
          </View>
          <Text style={s.permTitle}>Photographier une œuvre</Text>
          <Text style={s.permSub}>
            Pour identifier automatiquement une œuvre et estimer sa valeur, Nautilus a besoin d'accéder à votre appareil photo.
          </Text>
          {isDenied ? (
            <Pressable style={s.primaryBtn} onPress={() => Linking.openSettings()}>
              <Text style={s.primaryBtnTxt}>Ouvrir les réglages</Text>
            </Pressable>
          ) : (
            <Pressable style={s.primaryBtn} onPress={requestPermission}>
              <Text style={s.primaryBtnTxt}>Continuer</Text>
            </Pressable>
          )}
          <Pressable style={s.secondaryBtn} onPress={pickFromLibrary}>
            <Text style={s.secondaryBtnTxt}>Importer une photo existante</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Vue caméra plein écran ────────────────────────────────────────────────
  return (
    <View style={s.cameraContainer}>
      <CameraView ref={cameraRef} style={s.camera} facing="back">
        {/* Topbar flottant */}
        <View style={s.camTopbar}>
          <Pressable onPress={() => router.back()} style={s.camBackBtn}>
            <Text style={s.camBackTxt}>←</Text>
          </Pressable>
          <Text style={s.camTitle}>Photographier une œuvre</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Viseur centré */}
        <View style={s.viewfinder}>
          <View style={s.vfCornerTL} />
          <View style={s.vfCornerTR} />
          <View style={s.vfCornerBL} />
          <View style={s.vfCornerBR} />
        </View>

        {/* Contrôles bas */}
        <View style={s.camControls}>
          {/* Galerie */}
          <Pressable style={s.galleryBtn} onPress={pickFromLibrary}>
            <Text style={s.galleryTxt}>🖼</Text>
          </Pressable>

          {/* Déclencheur */}
          <Pressable style={s.shutter} onPress={takePicture}>
            <View style={s.shutterInner} />
          </Pressable>

          {/* Placeholder symétrie */}
          <View style={{ width: 44 }} />
        </View>

        <Text style={s.camHint}>Photographiez pour garder une trace visuelle</Text>
      </CameraView>
    </View>
  );
}

const s = StyleSheet.create({
  // ── Permission screen
  container:    { flex: 1, backgroundColor: Colors.bgPrimary },
  topbar:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  backBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:      { fontSize: 20, color: Colors.textSecondary },
  tbTitle:      { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  progBg:       { height: 2, backgroundColor: Colors.bgSecondary },
  progFill:     { height: 2, backgroundColor: Colors.green },
  permContent:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  iconCircle:   { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  permTitle:    { fontSize: Fonts.xl, fontWeight: '600', color: Colors.textPrimary, marginBottom: 10, textAlign: 'center' },
  permSub:      { fontSize: Fonts.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  primaryBtn:   { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: Radius.md, backgroundColor: Colors.textPrimary, marginBottom: 10 },
  primaryBtnTxt:{ color: Colors.bgPrimary, fontSize: Fonts.lg, fontWeight: Fonts.medium },
  secondaryBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 11, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderSecondary },
  secondaryBtnTxt: { fontSize: Fonts.md, color: Colors.textSecondary },

  // ── Camera view
  cameraContainer: { flex: 1 },
  camera:          { flex: 1 },

  camTopbar:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12 },
  camBackBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  camBackTxt:  { fontSize: 18, color: '#fff' },
  camTitle:    { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.medium, color: '#fff' },

  // Viewfinder corners
  viewfinder:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vfCornerTL:  { position: 'absolute', top: '20%', left: '12%', width: 22, height: 22, borderTopWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  vfCornerTR:  { position: 'absolute', top: '20%', right: '12%', width: 22, height: 22, borderTopWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  vfCornerBL:  { position: 'absolute', bottom: '20%', left: '12%', width: 22, height: 22, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  vfCornerBR:  { position: 'absolute', bottom: '20%', right: '12%', width: 22, height: 22, borderBottomWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },

  camControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 44, paddingBottom: 44, paddingTop: 20 },
  galleryBtn:  { width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  galleryTxt:  { fontSize: 22 },
  shutter:     { width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner:{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  camHint:     { textAlign: 'center', fontSize: Fonts.base, color: 'rgba(255,255,255,0.55)', paddingBottom: 12 },
});
