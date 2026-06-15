// app/auth/login.tsx — Nautilus Login Screen
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
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadow,
} from '@/constants/theme';

export default function LoginScreen() {
  const router   = useRouter();
  const storeLogin = useAuthStore((s) => s.login);
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
        {/* ── Brand ── */}
        <View style={s.brand}>
          <View style={s.logoMark}>
            <Text style={s.logoN}>N</Text>
          </View>
          <Text style={s.logoText}>Nautilus</Text>
          <Text style={s.tagline}>
            Connaissez la valeur{'\n'}de ce que vous possédez.
          </Text>
          <Text style={s.socialProof}>Rejoint par 4 200 collectionneurs</Text>
        </View>

        {/* ── Form ── */}
        <View style={s.form}>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={Colors.textTertiary}
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
            placeholderTextColor={Colors.textTertiary}
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

        {/* ── Footer ── */}
        <Pressable
          onPress={() => Linking.openURL('https://get-nautilus.com')}
          style={s.footerLink}
        >
          <Text style={s.footerTxt}>Pas encore de compte ? </Text>
          <Text style={[s.footerTxt, s.footerUnderline]}>get-nautilus.com</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.bgDark },
  inner: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg, paddingTop: 60 },

  // Brand
  brand: { alignItems: 'center', marginBottom: 48 },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoN: {
    fontSize: FontSize['2xl'],
    fontFamily: FontFamily.serifBold,
    color: Colors.gold,
  },
  logoText: {
    fontSize: FontSize['4xl'],
    fontFamily: FontFamily.serifBold,
    color: Colors.textOnDark,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  tagline: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.sans,
    color: Colors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: FontSize.lg * 1.5,
    marginBottom: 10,
  },
  socialProof: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.sans,
    color: Colors.textOnDarkSubtle,
    letterSpacing: 0.2,
  },

  // Form
  form: { gap: 10 },
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
  forgotLink:  { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotTxt:   { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textOnDarkSubtle },

  btn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
    ...Shadow.gold,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemibold,
    color: Colors.bgDark,
    letterSpacing: 0.2,
  },

  // Footer
  footerLink:    { flexDirection: 'row', justifyContent: 'center', marginTop: 36 },
  footerTxt:     { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textOnDarkSubtle },
  footerUnderline: { textDecorationLine: 'underline' },
});
