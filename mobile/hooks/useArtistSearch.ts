// hooks/useArtistSearch.ts
// Autocomplete artiste avec debounce 300ms
// Déstructure { suggestions } depuis /api/artist-profiles/autocomplete
// Pattern : useState local + useCallback — pas de react-query

import { useState, useCallback, useRef } from 'react';
import { artistService } from '@/services/api';
import type { ArtistSearchResult } from '@/services/api';

interface UseArtistSearchReturn {
  results: ArtistSearchResult[];
  loading: boolean;
  searched: boolean;  // true dès qu'une recherche a été lancée
  search: (query: string) => void;  // déclenche debounce
  clear: () => void;
}

export function useArtistSearch(debounceMs = 300): UseArtistSearchReturn {
  const [results,  setResults]  = useState<ArtistSearchResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const _fetch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      // { suggestions: ArtistSearchResult[] } — déstructurer ici
      const { suggestions } = await artistService.search(q.trim());
      setResults(suggestions ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => _fetch(query), debounceMs);
  }, [_fetch, debounceMs]);

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setResults([]);
    setSearched(false);
    setLoading(false);
  }, []);

  return { results, loading, searched, search, clear };
}
