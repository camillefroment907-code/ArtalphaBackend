// app/add-artwork/search.tsx — Recherche artiste/œuvre (étape 30%)

import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useRef, useCallback } from 'react';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { api } from '@/lib/api';

type SearchResult = {
  id?: string | null;
  name: string;
  nationality?: string | null;
  birth_year?: number | null;
  lot_count?: number;
  avg_price?: number;
  confidence?: string;
};

function fmtPrice(n?: number): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k€`;
  return `${Math.round(n)} €`;
}

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]); setSearched(false); setLoading(false); return;
    }
    setLoading(true); setSearched(true);
    const enc = encodeURIComponent(q.trim());

    try {
      const res = await api.get<{ suggestions: SearchResult[] }>(
        `/api/artist-profiles/autocomplete?q=${enc}&limit=10`
      );
      // Dedup by id (primary) then normalized name (fallback for unresolved entries)
      const seen = new Set<string>();
      const deduped: SearchResult[] = [];
      for (const s of res.suggestions ?? []) {
        const key = s.id ?? s.name.toLowerCase();
        if (!seen.has(key)) {
          deduped.push(s);
          seen.add(key);
        }
      }
      setResults(deduped.slice(0, 10));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(() => search(text), 350);
  };

  const selectResult = (r: SearchResult) =>
    router.push({
      pathname: '/add-artwork/manual',
      params: {
        artistName: r.name,
        ...(r.id ? { artistId: r.id } : {}),
      },
    });

  return (
    <View style={s.container}>
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <Text style={s.tbTitle}>Rechercher un artiste</Text>
        <Text style={s.tbStep}>1/4</Text>
      </View>
      <View style={s.progBg}><View style={[s.progFill, { width: '30%' }]} /></View>

      <View style={s.content}>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={handleChange}
            placeholder="Soulages, Basquiat, Richter…"
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            autoCorrect={false}
            autoCapitalize="words"
          />
          {loading && <ActivityIndicator size="small" color={Colors.textTertiary} style={{ marginRight: 10 }} />}
        </View>

        {!searched && (
          <Text style={s.hint}>Recherchez un artiste pour ajouter une de ses œuvres.</Text>
        )}

        {searched && !loading && results.length === 0 && (
          <View style={s.emptyBlock}>
            <Text style={s.emptyTxt}>Aucun résultat pour « {query} »</Text>
            <Pressable onPress={() => router.push('/add-artwork/manual')}>
              <Text style={s.emptyLink}>Ajouter manuellement →</Text>
            </Pressable>
          </View>
        )}

        {results.length > 0 && (
          <>
            <Text style={s.resultsLabel}>
              {results.length} artiste{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
            </Text>
            <ScrollView style={s.resultsList} keyboardShouldPersistTaps="handled">
              <View style={s.resultsWrap}>
                {results.map((r, i) => (
                  <Pressable
                    key={i}
                    style={[s.srItem, i < results.length - 1 && s.srItemBorder]}
                    onPress={() => selectResult(r)}
                  >
                    <View style={s.srThumb}>
                      <Text style={s.srInitial}>{r.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={s.srInfo}>
                      <Text style={s.srName} numberOfLines={1}>{r.name}</Text>
                      {(r.nationality || r.birth_year) ? (
                        <Text style={s.srMeta}>
                          {[r.nationality, r.birth_year ? `né en ${r.birth_year}` : null].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={s.srArrow}>→</Text>
                  </Pressable>
                ))}
              </View>
              {query.trim().length > 0 && (
                <Pressable
                  style={s.manualLink}
                  onPress={() => router.push({ pathname: '/add-artwork/manual', params: { artistName: query } })}
                >
                  <Text style={s.manualLinkTxt}>✍️  Ajouter « {query} » manuellement →</Text>
                </Pressable>
              )}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.bgPrimary },
  topbar:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  backBtn:       { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:       { fontSize: 20, color: Colors.textSecondary },
  tbTitle:       { flex: 1, fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  tbStep:        { fontSize: Fonts.base, color: Colors.textTertiary },
  progBg:        { height: 2, backgroundColor: Colors.bgSecondary },
  progFill:      { height: 2, backgroundColor: Colors.green },
  content:       { flex: 1, padding: 16 },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.borderSecondary, borderRadius: Radius.md, paddingLeft: 11, marginBottom: 14 },
  searchIcon:    { fontSize: 15, marginRight: 4 },
  searchInput:   { flex: 1, padding: 11, fontSize: Fonts.md, color: Colors.textPrimary },
  hint:          { fontSize: Fonts.base, color: Colors.textTertiary, textAlign: 'center', marginTop: 36 },
  emptyBlock:    { alignItems: 'center', marginTop: 32, gap: 10 },
  emptyTxt:      { fontSize: Fonts.base, color: Colors.textTertiary },
  emptyLink:     { fontSize: Fonts.base, color: Colors.textPrimary, fontWeight: '500' },
  resultsLabel:  { fontSize: Fonts.xs, color: Colors.textTertiary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  resultsList:   { flex: 1 },
  resultsWrap:   { borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: 12 },
  srItem:        { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  srItemBorder:  { borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  srThumb:       { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  srInitial:     { fontSize: Fonts.lg, fontWeight: '600', color: Colors.textSecondary },
  srInfo:        { flex: 1, minWidth: 0 },
  srName:        { fontSize: Fonts.md, fontWeight: '500', color: Colors.textPrimary },
  srMeta:        { fontSize: Fonts.xs, color: Colors.textTertiary, marginTop: 1 },
  srArrow:       { fontSize: Fonts.base, color: Colors.textTertiary },
  manualLink:    { paddingVertical: 10, alignItems: 'center' },
  manualLinkTxt: { fontSize: Fonts.base, color: Colors.textTertiary },
});
