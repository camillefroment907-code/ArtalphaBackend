// app/auth/register.tsx — Nautilus Register Screen
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/services/api';
import { setStoredAuth } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import {
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadow,
} from '@/constants/theme';

export default function RegisterScreen() {
  const router   = useRouter();
  const setUser  = useAuthStore((s) => s.setUser);

  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [emailTaken,  setEmailTaken]  = useState(false);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  const handleRegister = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setEmailTaken(false);
    try {
      const user = await authService.register(email.trim(), password, name.trim());
      await setStoredAuth(user);
      setUser(user);
      await AsyncStorage.setItem('show_welcome_banner', '1');
      router.replace('/add-artwork');
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? '';
      if (msg.toLowerCase().includes('déjà') || msg.includes('409') || msg.toLowerCase().includes('exist')) {
        setEmailTaken(true);
        setError('Cet email est déjà utilisé.');
      } else if (msg.toLowerCase().includes('réseau') || msg.toLowerCase().includes('network') || msg.includes('fetch')) {
        setError('Connexion indisponible. Réessayez.');
      } else {
        setError('Erreur lors de la création du compte. Réessayez.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.title}>Créer un compte</Text>
          <Text style={s.subtitle}>
            Commencez à connaître la valeur{'\n'}de ce que vous possédez.
          </Text>
        </View>

        {/* ── Form ── */}
        <View style={s.form}>
          <View style={s.fieldGroup}>
            <Text style={s.label}>Prénom</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Votre prénom"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Mot de passe</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="8 caractères minimum"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
          </View>

          {error ? (
            <View>
              <Text style={s.errorText}>{error}</Text>
              {emailTaken && (
                <Pressable onPress={() => router.replace('/auth/login')} style={s.loginHint}>
                  <Text style={s.loginHintTxt}>Se connecter avec cet email →</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <Pressable
            style={[s.btn, (!canSubmit || loading) && s.btnDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit || loading}
          >
            <Text style={s.btnText}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </Text>
          </Pressable>

          <Text style={s.cgu}>
            En créant un compte, vous acceptez nos CGU et notre politique de confidentialité.
          </Text>
        </View>

        {/* ── Back to login ── */}
        <Pressable style={s.backLink} onPress={() => router.replace('/auth/login')}>
          <Text style={s.backTxt}>Déjà un compte ? Se connecter</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.bgDark },
  inner: { flexGrow: 1, padding: Spacing.lg, paddingTop: 80 },

  // Header
  header:   { marginBottom: 40 },
  title:    { fontSize: FontSize['4xl'], fontFamily: FontFamily.serifBold, color: Colors.textOnDark, letterSpacing: -0.4, marginBottom: 10 },
  subtitle: { fontSize: FontSize.md, fontFamily: FontFamily.sans, color: Colors.textOnDarkMuted, lineHeight: FontSize.md * 1.5 },

  // Form
  form:       { gap: 16 },
  fieldGroup: { gap: 6 },
  label:      { fontSize: FontSize.sm, fontFamily: FontFamily.sansSemibold, color: Colors.textOnDarkMuted, letterSpacing: 0.3, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderOnDark,
    borderRadius: Radius.md,
    padding: 14,
    fontSize: FontSize.base,
    fontFamily: FontFamily.sans,
    color: Colors.textOnDark,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  errorText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.sans,
    color: '#FF6B6B',
    textAlign: 'center',
  },

  btn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    ...Shadow.gold,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemibold,
    color: Colors.bgDark,
    letterSpacing: 0.2,
  },

  cgu:       { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textOnDarkSubtle, textAlign: 'center', lineHeight: 16, marginTop: 10 },
  loginHint:    { alignItems: 'center', marginTop: 6 },
  loginHintTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium, color: Colors.gold, textDecorationLine: 'underline' },

  // Back link
  backLink: { marginTop: 32, alignItems: 'center' },
  backTxt:  { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textOnDarkSubtle, textDecorationLine: 'underline' },
});
