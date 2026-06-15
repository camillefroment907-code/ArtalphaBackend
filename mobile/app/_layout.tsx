// app/_layout.tsx — Root layout
// Auth guard + onboarding guard + font loading + Zustand hydration

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import {
  useFonts,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '@/store/auth';
import { isOnboardingComplete } from '@/lib/onboarding';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const hydrate   = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user      = useAuthStore((s) => s.user);
  const router    = useRouter();
  const segments  = useSegments();

  // Hydrate auth store once on mount
  useEffect(() => { hydrate(); }, [hydrate]);

  // Auth + onboarding guard
  useEffect(() => {
    if (isLoading || !fontsLoaded) return;
    const root = segments[0] as string | undefined;
    if (root === 'auth' || root === 'onboarding') return;

    if (!user?.token) {
      router.replace('/auth/login');
      return;
    }

    isOnboardingComplete().then((done) => {
      if (!done) router.replace('/onboarding');
    });
  }, [isLoading, fontsLoaded, user, segments]);

  const ready = !isLoading && fontsLoaded;

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgDark }}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
      <Stack.Screen name="login" />  {/* legacy compat */}
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="artist/[id]" />
      <Stack.Screen name="artwork/[id]" />
      <Stack.Screen name="collection/[id]" />
      <Stack.Screen name="add-artwork" options={{ presentation: 'modal' }} />
      <Stack.Screen name="collection-health" />
      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
