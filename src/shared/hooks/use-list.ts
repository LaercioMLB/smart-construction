'use client';
import { useEffect, useState } from 'react';
import type { ListQuery, PageResult, ReadRepository } from '@/shared/contracts';
export function useList<T>(
  repository: ReadRepository<T>,
  query: ListQuery,
  initial: PageResult<T>,
) {
  const key = JSON.stringify(query);
  const [state, setState] = useState({ key, data: initial, error: '', attempt: 0 });
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await repository.list(JSON.parse(key) as ListQuery);
        if (active) setState({ key, data, error: '', attempt: retryCount });
      } catch (error) {
        if (active)
          setState((old) => ({
            ...old,
            key,
            error: error instanceof Error ? error.message : 'Falha ao carregar.',
            attempt: retryCount,
          }));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [repository, key, retryCount]);
  return {
    ...state.data,
    loading: state.key !== key || state.attempt !== retryCount,
    error: state.error,
    retry: () => setRetryCount((count) => count + 1),
  };
}
