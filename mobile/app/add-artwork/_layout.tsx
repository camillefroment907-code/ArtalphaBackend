// app/add-artwork/_layout.tsx
// Layout minimal pour le flow add-artwork (présenté en modal depuis la root stack)

import { Stack } from 'expo-router';

export default function AddArtworkLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
