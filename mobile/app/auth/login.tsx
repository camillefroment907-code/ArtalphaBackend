// app/auth/login.tsx — Nautilus Login
// Fond blanc · Titres Playfair · Bouton ink #1A1A1A · Lien #1B4FCC

import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import {
  FontFamily,
  FontSize,
  Spacing,
  Radius,
} from '@/constants/theme';

const INK    = '#1A1A1A';
const MUTED  = '#6E6E73';
const BLUE   = '#1B4FCC';
const BORDER = '#E8E4DC';
const ERROR  = '#C0392B';

export default function LoginScreen() {
  const router      = useRouter();
  const storeLogin  = useAuthStore((s) => s.login);
  const isLoggingIn = useAuthStore((s) => s.isLoggingIn);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 6;

  const handleLogin = async () => {
    if (!canSubmit || isLoggingIn) return;
    setError(null);
    try {
      await storeLogin(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? 'Email ou mot de passe incorrect.');
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
        {/* Brand */}
        <View style={s.brand}>
          <Text style={s.logoText}>Nautilus</Text>
          <Text style={s.tagline}>Votre collection.{'\n'}Enfin organisée.</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={MUTED}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
          />
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            placeholderTextColor={MUTED}
            secureTextEntry
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <Pressable
            onPress={() => Linking.openURL('https://get-nautilus.com/reset-password')}
            style={s.forgotLink}
          >
            <Text style={s.forgotTxt}>Mot de passe oublié ?</Text>
          </Pressable>

          <Pressable
            style={[s.btn, (!canSubmit || isLoggingIn) && s.btnDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit || isLoggingIn}
          >
            <Text style={s.btnText}>
              {isLoggingIn ? 'Connexion…' : 'Se connecter'}
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Pressable
          onPress={() => router.push('/auth/register')}
          style={s.footerLink}
        >
          <Text style={s.footerTxt}>Pas encore de compte ? </Text>
          <Text style={[s.footerTxt, s.footerCta]}>Créer ma collection</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#FFFFFF' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg, paddingTop: 60 },

  // Brand
  brand: { alignItems: 'center', marginBottom: 52 },
  logoText: {
    fontSize: FontSize['4xl'],
    fontFamily: FontFamily.serifBold,
    color: INK,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  tagline: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.sans,
    color: MUTED,
    textAlign: 'center',
    lineHeight: FontSize.lg * 1.5,
  },

  // Form
  form: { gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: Radius.md,
    padding: 14,
    fontSize: FontSize.base,
    fontFamily: FontFamily.sans,
    color: INK,
    backgroundColor: '#FAFAF8',
  },
  errorText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.sans,
    color: ERROR,
    textAlign: 'center',
  },
  forgotLink:  { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotTxt:   { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: MUTED },

  btn: {
    backgroundColor: INK,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: { opacity: 0.35 },
  btnText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemibold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Footer
  footerLink:  { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  footerTxt:   { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: MUTED },
  footerCta:   { color: BLUE, fontFamily: FontFamily.sansMedium },
});
