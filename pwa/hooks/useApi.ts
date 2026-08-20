import { useState, useCallback, useRef } from 'react';

interface ApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends ApiState<T> {
  execute: (...args: Parameters<() => Promise<T>>) => Promise<void>;
  reset: () => void;
}

export function useApi<T>(fetchFn: () => Promise<T>): UseApiReturn<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  // Keep a stable ref so callers don't need fetchFn in their dependency arrays
  const fnRef = useRef(fetchFn);
  fnRef.current = fetchFn;

  const execute = useCallback(async () => {
    setState({ data: null, isLoading: true, error: null });
    try {
      const data = await fnRef.current();
      setState({ data, isLoading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setState({ data: null, isLoading: false, error: message });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
