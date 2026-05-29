'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * useAsync Hook
 * Handles async operations
 * 
 * @param asyncFunction - async function to execute
 * @param immediate - execute on mount
 * @returns { data, loading, error, execute }
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate = true
) {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const response = await asyncFunction();
      setState({ data: response, loading: false, error: null });
      return response;
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      // Intentional: kick off the initial fetch on mount. The setState
      // inside execute is async (after await) so it won't cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void execute();
    }
  }, [execute, immediate]);

  return { ...state, execute };
}