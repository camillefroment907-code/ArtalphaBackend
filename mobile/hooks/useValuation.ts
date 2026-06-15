// hooks/useValuation.ts
// Estimation de valeur via Collection Value Engine (nautilus_comparable_engine_v1)
// Pattern : useState local + useCallback — pas de react-query, pas de cache

import { useState, useCallback } from 'react';
import { collectionService } from '@/services/api';
import type { ValuationResult } from '@/services/api';

interface UseValuationState {
  valuation: ValuationResult | null;
  loading: boolean;
  error: string | null;
}

interface UseValuationReturn extends UseValuationState {
  estimate: (params: {
    artist_id: string;
    medium?: string | null;
    dimensions?: string | null;
    year_created?: number | null;
    item_id?: string;
  }) => Promise<ValuationResult | null>;
  revalue: (itemId: string) => Promise<ValuationResult | null>;
  reset: () => void;
}

export function useValuation(): UseValuationReturn {
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const estimate = useCallback(async (params: {
    artist_id: string;
    medium?: string | null;
    dimensions?: string | null;
    year_created?: number | null;
    item_id?: string;
  }): Promise<ValuationResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await collectionService.valuate(params);
      setValuation(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Estimation indisponible';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const revalue = useCallback(async (itemId: string): Promise<ValuationResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await collectionService.revaluate(itemId);
      setValuation(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Revalorisation indisponible';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setValuation(null);
    setError(null);
  }, []);

  return { valuation, loading, error, estimate, revalue, reset };
}
