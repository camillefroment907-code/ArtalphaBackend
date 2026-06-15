// app/onboarding/step4.tsx — Artistes favoris (avec autocomplete)

import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { api } from '@/lib/api';
import { saveOnboardingData } from '@/lib/onboarding';

type Suggestion = { id?: string; name: string };

export default function Step4() {
  const router = useRouter();
  const [query, setQuery]           = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected]     = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      const enc = encodeURIComponent(text.trim());
      const [acRes, srRes] = await Promise.allSettled([
        api.get<{ suggestions: Suggestion[] }>(`/api/artist-profiles/autocomplete?q=${enc}&limit=5`),
        api.get<{ artists: Array<{ name: string }> }>(`/api/artist-profiles/search/${enc}`),
      ]);
      const merged: Suggestion[] = [];
      const seen = new Set<string>();
      if (acRes.status === 'fulfilled') {
        for (const s of acRes.value.suggestions ?? []) {
          if (!seen.has(s.name.toLowerCase())) { merged.push(s); seen.add(s.name.toLowerCase()); }
        }
      }
      if (srRes.status === 'fulfilled') {
        for (const a of (srRes.value.artists ?? []).slice(0, 5)) {
          if (!seen.has(a.name.toLowerCase())) { merged.push({ name: a.name }); seen.add(a.name.toLowerCase()); }
        }
      }
      setSuggestions(merged.slice(0, 6));
    }, 300);
  };

  const addArtist = (name: string) => {
    if (!selected.includes(name)) setSelected(prev => [...prev, name]);
    setQuery('');
    setSuggestions([]);
  };

  const removeArtist = (name: string) => {
    setSelected(prev => prev.filter(a => a !== name));
  };

  const handleContinue = async () => {
    await saveOnboardingData({ artists: selected });
    router.push('/onboarding/step5');
  };

  return (
    <View style={s.container}>
      <View style={s.topRow}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <View style={s.dots}>
          {[1,2,3,4,5,6,7].map(i => (
            <View key={i} style={[s.dot, i === 4 && s.dotActive]} />
          ))}
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.header}>
        <Text style={s.step}>4 / 7</Text>
        <Text style={s.title}>Vos artistes</Text>
        <Text style={s.sub}>Nautilus suivra leur marché pour vous.</Text>
      </View>

      <View style={s.searchBlock}>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={handleChange}
          placeholder="Soulages, Basquiat, Richter…"
          placeholderTextColor={Colors.textTertiary}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {suggestions.length > 0 && (
          <View style={s.dropdown}>
            {suggestions.map((s_, i) => (
              <Pressable
                key={s_.id ?? i}
                style={[s.dropItem, i < suggestions.length - 1 && s.dropBorder]}
                onPress={() => addArtist(s_.name)}
              >
                <Text style={s.dropName}>{s_.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {selected.length > 0 && (
        <View style={s.chips}>
          {selected.map(name => (
            <Pressable key={name} style={s.chip} onPress={() => removeArtist(name)}>
              <Text style={s.chipTxt}>{name}</Text>
              <Text style={s.chipX}>×</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flex: 1 }} />

      <View style={s.footer}>
        <Pressable style={s.cta} onPress={handleContinue}>
          <Text style={s.ctaTxt}>
            {selected.length > 0 ? `Continuer (${selected.length} artiste${selected.length > 1 ? 's' : ''})` : 'Continuer'}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/onboarding/step5')} style={s.skip}>
          <Text style={s.skipTxt}>Passer cette étape</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bgPrimary, paddingHorizontal: 24 },
  topRow:      { flexDirection: 'row', alignItems: 'center', paddingTop: 60 },
  back:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:     { fontSize: 20, color: Colors.textSecondary },
  dots:        { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.bgTertiary },
  dotActive:   { backgroundColor: Colors.textPrimary, width: 20 },
  header:      { paddingTop: 24, paddingBottom: 24 },
  step:        { fontSize: Fonts.base, color: Colors.textTertiary, marginBottom: 8 },
  title:       { fontSize: Fonts['4xl'], fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.8, marginBottom: 8 },
  sub:         { fontSize: Fonts.lg, color: Colors.textSecondary },
  searchBlock: { marginBottom: 14 },
  input:       { borderWidth: 1, borderColor: Colors.borderSecondary, borderRadius: Radius.md, padding: 13, fontSize: Fonts.md, color: Colors.textPrimary },
  dropdown:    { marginTop: 4, borderWidth: 0.5, borderColor: Colors.borderSecondary, borderRadius: Radius.md, backgroundColor: Colors.bgPrimary, overflow: 'hidden' },
  dropItem:    { paddingHorizontal: 14, paddingVertical: 12 },
  dropBorder:  { borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  dropName:    { fontSize: Fonts.md, color: Colors.textPrimary },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.bgSecondary, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  chipTxt:     { fontSize: Fonts.base, color: Colors.textPrimary, fontWeight: '500' },
  chipX:       { fontSize: Fonts.lg, color: Colors.textTertiary },
  footer:      { paddingVertical: 20, gap: 10 },
  cta:         { backgroundColor: Colors.textPrimary, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  ctaTxt:      { color: Colors.bgPrimary, fontSize: Fonts.lg, fontWeight: '600' },
  skip:        { alignItems: 'center', paddingVertical: 6 },
  skipTxt:     { fontSize: Fonts.base, color: Colors.textTertiary },
});
