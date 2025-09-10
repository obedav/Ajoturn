import { useState, useCallback, useRef, useEffect } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseAsyncOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export const useAsync = <T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions = {}
) => {
  const { immediate = false, onSuccess, onError } = options;
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: any[]) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const data = await asyncFunction(...args);
        if (mountedRef.current) {
          setState({ data, loading: false, error: null });
          onSuccess?.(data);
        }
        return data;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (mountedRef.current) {
          setState(prev => ({ ...prev, loading: false, error: err }));
          onError?.(err);
        }
        throw err;
      }
    },
    [asyncFunction, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return {
    ...state,
    execute,
    reset,
  };
};

// Hook for handling multiple async operations
export const useAsyncOperations = () => {
  const [operations, setOperations] = useState<Record<string, AsyncState<any>>>({});

  const execute = useCallback(
    async <T>(
      key: string,
      asyncFunction: () => Promise<T>,
      options: UseAsyncOptions = {}
    ) => {
      const { onSuccess, onError } = options;

      setOperations(prev => ({
        ...prev,
        [key]: { data: null, loading: true, error: null },
      }));

      try {
        const data = await asyncFunction();
        setOperations(prev => ({
          ...prev,
          [key]: { data, loading: false, error: null },
        }));
        onSuccess?.(data);
        return data;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setOperations(prev => ({
          ...prev,
          [key]: { data: null, loading: false, error: err },
        }));
        onError?.(err);
        throw err;
      }
    },
    []
  );

  const getOperation = useCallback((key: string) => {
    return operations[key] || { data: null, loading: false, error: null };
  }, [operations]);

  const isAnyLoading = useCallback(() => {
    return Object.values(operations).some(op => op.loading);
  }, [operations]);

  const reset = useCallback((key?: string) => {
    if (key) {
      setOperations(prev => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    } else {
      setOperations({});
    }
  }, []);

  return {
    execute,
    getOperation,
    isAnyLoading,
    reset,
    operations,
  };
};

// Hook for handling paginated data loading
export const usePaginatedAsync = <T>(
  asyncFunction: (page: number, limit: number) => Promise<{ data: T[]; hasMore: boolean }>,
  limit: number = 20
) => {
  const [state, setState] = useState<{
    data: T[];
    loading: boolean;
    error: Error | null;
    hasMore: boolean;
    page: number;
  }>({
    data: [],
    loading: false,
    error: null,
    hasMore: true,
    page: 0,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (state.loading || !state.hasMore) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const nextPage = state.page + 1;
      const result = await asyncFunction(nextPage, limit);
      
      if (mountedRef.current) {
        setState(prev => ({
          data: [...prev.data, ...result.data],
          loading: false,
          error: null,
          hasMore: result.hasMore,
          page: nextPage,
        }));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: false, error: err }));
      }
    }
  }, [asyncFunction, limit, state.loading, state.hasMore, state.page]);

  const refresh = useCallback(async () => {
    setState({
      data: [],
      loading: true,
      error: null,
      hasMore: true,
      page: 0,
    });

    try {
      const result = await asyncFunction(1, limit);
      
      if (mountedRef.current) {
        setState({
          data: result.data,
          loading: false,
          error: null,
          hasMore: result.hasMore,
          page: 1,
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: false, error: err }));
      }
    }
  }, [asyncFunction, limit]);

  const reset = useCallback(() => {
    setState({
      data: [],
      loading: false,
      error: null,
      hasMore: true,
      page: 0,
    });
  }, []);

  return {
    ...state,
    loadMore,
    refresh,
    reset,
  };
};

// Hook for debounced async operations (useful for search)
export const useDebouncedAsync = <T>(
  asyncFunction: (query: string) => Promise<T>,
  delay: number = 300
) => {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  
  const [query, setQuery] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!query.trim()) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await asyncFunction(query);
        if (mountedRef.current) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (mountedRef.current) {
          setState(prev => ({ ...prev, loading: false, error: err }));
        }
      }
    }, delay);
  }, [query, asyncFunction, delay]);

  return {
    ...state,
    query,
    setQuery,
  };
};