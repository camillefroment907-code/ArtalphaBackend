// app/_layout.tsx — Root layout
// Splash → Auth guard + onboarding guard + font loading + Zustand hydration

import { useEffect, useState, useRef, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, Animated, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '@/store/auth';
import NautilusLogoAnimation from '@/components/NautilusLogoAnimation';

const INTRO_KEY = 'nautilus_intro_complete';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
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

  const [introSeen, setIntroSeen] = useState<boolean | null>(null);

  // Splash state
  const [splashDone, setSplashDone]     = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const splashOpacity                   = useRef(new Animated.Value(1)).current;

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem(INTRO_KEY);
      setIntroSeen(v === 'true');
    })();
  }, []);

  // Called by NautilusLogoAnimation when all phases complete
  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => setSplashHidden(true));
  }, [splashOpacity]);

  // Navigation guard — waits for splash AND all state to be ready
  useEffect(() => {
    if (isLoading || !fontsLoaded || introSeen === null || !splashDone) return;
    const root = segments[0] as string | undefined;
    if (root === 'auth' || root === 'onboarding') return;
    if (user?.token) return;

    if (!introSeen) {
      router.replace('/onboarding/intro');
    } else {
      router.replace('/auth/login');
    }
  }, [isLoading, fontsLoaded, user, segments, introSeen, splashDone]);

  return (
    <View style={s.root}>
      {/* Stack — renders as soon as fonts are ready, underneath the splash */}
      {fontsLoaded && (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/register" />
          <Stack.Screen name="login" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="alerts" />
          <Stack.Screen name="artist/[id]" />
          <Stack.Screen name="artwork/[id]" />
          <Stack.Screen name="collection/[id]" />
          <Stack.Screen name="add-artwork" options={{ presentation: 'modal' }} />
          <Stack.Screen name="collection-health" />
          <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        </Stack>
      )}

      {/* Splash overlay — covers Stack until animation ends, then fades out */}
      {!splashHidden && (
        <Animated.View
          style={[StyleSheet.absoluteFill, s.splash, { opacity: splashOpacity }]}
          pointerEvents={splashDone ? 'none' : 'auto'}
        >
          <NautilusLogoAnimation
            size={100}
            showWordmark
            autoPlay
            onComplete={handleSplashComplete}
          />
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
