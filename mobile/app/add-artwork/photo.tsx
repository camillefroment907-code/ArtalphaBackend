// app/add-artwork/photo.tsx — Photo step avec caméra réelle (étape 30%)

import {
  View, Text, Pressable, StyleSheet, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts, Radius } from '@/lib/tokens';

export default function PhotoScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Photo capturée → formulaire manuel directement
  const afterCapture = () => {
    router.push({
      pathname: '/add-artwork/manual',
      params: { import_mode: 'photo' },
    });
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      await cameraRef.current.takePictureAsync({ quality: 0.7 });
      afterCapture();
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
    if (!result.canceled) {
      afterCapture();
    }
  };

  // ── Permission refusée ────────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <View style={s.container}>
        <View style={s.topbar}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </Pressable>
          <Text style={s.tbTitle}>Photographier</Text>
          <Text style={s.tbStep}>1/4</Text>
        </View>
        <View style={s.progBg}><View style={[s.progFill, { width: '30%' }]} /></View>

        <View style={s.permContent}>
          <Text style={s.permIcon}>📷</Text>
          <Text style={s.permTitle}>Accès à l'appareil photo</Text>
          <Text style={s.permSub}>
            Nautilus utilise l'appareil photo pour identifier vos œuvres d'art.
          </Text>
          <Pressable style={s.primaryBtn} onPress={requestPermission}>
            <Text style={s.primaryBtnTxt}>Autoriser l'accès</Text>
          </Pressable>
          <Pressable style={s.secondaryBtn} onPress={pickFromLibrary}>
            <Text style={s.secondaryBtnTxt}>🖼  Choisir depuis la galerie</Text>
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
          <Text style={s.camTitle}>Photographier</Text>
          <Text style={s.camStep}>1/4</Text>
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
  tbStep:       { fontSize: Fonts.base, color: Colors.textTertiary },
  progBg:       { height: 2, backgroundColor: Colors.bgSecondary },
  progFill:     { height: 2, backgroundColor: Colors.green },
  permContent:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  permIcon:     { fontSize: 44, marginBottom: 16 },
  permTitle:    { fontSize: Fonts.xl, fontWeight: Fonts.medium, color: Colors.textPrimary, marginBottom: 10, textAlign: 'center' },
  permSub:      { fontSize: Fonts.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
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
  camStep:     { fontSize: Fonts.base, color: 'rgba(255,255,255,0.6)' },

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
