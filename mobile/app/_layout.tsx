// app/_layout.tsx — Root layout
// Auth guard + onboarding guard + font loading + Zustand hydration

import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { Colors } from '@/constants/theme';

// Key shared with lib/onboarding.ts
const ONBOARDING_KEY = 'nautilus_onboarding_complete';

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

  // null = not yet loaded from AsyncStorage
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  // Hydrate auth store once on mount
  useEffect(() => { hydrate(); }, [hydrate]);

  // Load onboarding flag once on mount
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setOnboardingSeen(val === 'true');
    });
  }, []);

  // Auth + onboarding guard
  // Priority: 1. user authenticated → stay/go to app
  //           2. user not authenticated + onboarding seen → /auth/login
  //           3. user not authenticated + onboarding not seen → /onboarding
  useEffect(() => {
    if (isLoading || !fontsLoaded || onboardingSeen === null) return;
    const root = segments[0] as string | undefined;
    if (root === 'auth' || root === 'onboarding') return;

    if (user?.token) return; // authenticated — no redirect needed from guard

    if (!onboardingSeen) {
      router.replace('/onboarding');
    } else {
      router.replace('/auth/login');
    }
  }, [isLoading, fontsLoaded, user, segments, onboardingSeen]);

  const ready = !isLoading && fontsLoaded && onboardingSeen !== null;

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
