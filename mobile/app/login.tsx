// app/login.tsx

import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { login } from '@/lib/auth';
import { Colors, Fonts, Spacing, Radius } from '@/lib/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 6;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const err = e as { detail?: string; message?: string } | string;
      setError(typeof err === 'string' ? err : err?.detail || err?.message || 'Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Logo */}
      <View style={styles.logoWrap}>
        <Text style={styles.logoText}>Nautilus</Text>
        <Text style={styles.tagline}>Connaissez la valeur de ce que vous possédez.</Text>
        <Text style={styles.socialProof}>Rejoint par 4 200 collectionneurs</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Mot de passe"
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry
          autoComplete="password"
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          onPress={() => Linking.openURL('https://get-nautilus.com/reset-password')}
          style={styles.forgotLink}
        >
          <Text style={styles.forgotTxt}>Mot de passe oublié ?</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, !canSubmit && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.bgPrimary} />
          ) : (
            <Text style={styles.btnText}>Se connecter</Text>
          )}
        </Pressable>
      </View>

      <Pressable onPress={() => Linking.openURL('https://get-nautilus.com')} style={styles.footerLink}>
        <Text style={styles.footer}>Pas encore de compte ?{' '}</Text>
        <Text style={[styles.footer, styles.footerUnderline]}>get-nautilus.com</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 44,
  },
  logoText: {
    fontSize: Fonts['4xl'],
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  tagline: {
    fontSize: Fonts.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  socialProof: {
    fontSize: Fonts.sm,
    color: Colors.textTertiary,
    letterSpacing: 0.2,
  },
  form: {
    gap: 10,
  },
  input: {
    borderWidth: 0.5,
    borderColor: Colors.borderSecondary,
    borderRadius: Radius.md,
    padding: 12,
    fontSize: Fonts.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgPrimary,
  },
  errorText: {
    fontSize: Fonts.sm,
    color: Colors.error,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.md,
    padding: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    color: Colors.bgPrimary,
    fontSize: Fonts.lg,
    fontWeight: Fonts.medium,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
  },
  forgotTxt: {
    fontSize: Fonts.sm,
    color: Colors.textTertiary,
  },
  footerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footer: {
    fontSize: Fonts.sm,
    color: Colors.textTertiary,
  },
  footerUnderline: {
    textDecorationLine: 'underline',
  },
});
