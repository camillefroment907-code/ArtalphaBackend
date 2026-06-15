// app/(tabs)/_layout.tsx — Option B: Collection · [+] · Market · Larry · Profile

import { Tabs, useRouter } from 'expo-router';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Radius, Shadow } from '@/constants/theme';

function FABButton() {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [fab.btn, { opacity: pressed ? 0.85 : 1 }]}
      onPress={() => router.push('/add-artwork')}
    >
      <Text style={fab.plus}>＋</Text>
    </Pressable>
  );
}

const fab = StyleSheet.create({
  btn: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...Shadow.md,
  },
  plus: {
    fontSize: 22,
    color: Colors.gold,
    lineHeight: 24,
    marginTop: -1,
  },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Colors.navy,
        tabBarInactiveTintColor: '#B0A99A',
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontFamily: FontFamily.sansMedium,
          marginTop: 2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="layers-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Placeholder route for the FAB — uses custom tabBarButton */}
      <Tabs.Screen
        name="collection"
        options={{
          title: '',
          tabBarButton: () => <FABButton />,
        }}
      />

      <Tabs.Screen
        name="market"
        options={{
          title: 'Marché',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="larry"
        options={{
          title: 'Larry',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Hide alerts from tab bar — accessible via alerts link */}
      <Tabs.Screen
        name="alerts"
        options={{ href: null }}
      />
    </Tabs>
  );
}
