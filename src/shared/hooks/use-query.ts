'use client';
import { useSearchParams, usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  window.addEventListener('smart-demo:query', listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener('smart-demo:query', listener);
  };
}
const snapshot = () => window.location.search;
export function useQuery() {
  const routerParams = useSearchParams();
  const search = useSyncExternalStore(subscribe, snapshot, () =>
    routerParams.toString() ? '?' + routerParams.toString() : '',
  );
  const params = new URLSearchParams(search);
  const pathname = usePathname();
  const set = (changes: Record<string, string | string[] | undefined>, resetPage = true) => {
    const next = new URLSearchParams(window.location.search);
    if (resetPage) next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((item) => next.append(key, item));
      else if (value) next.set(key, value);
    }
    const search = next.toString();
    window.history.replaceState(null, '', pathname + (search ? '?' + search : ''));
    window.dispatchEvent(new Event('smart-demo:query'));
  };
  const toggle = (key: string, value: string) => {
    const current = params.getAll(key);
    set({
      [key]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };
  return {
    params,
    set,
    toggle,
    clear: () => {
      window.history.replaceState(null, '', pathname);
      window.dispatchEvent(new Event('smart-demo:query'));
    },
  };
}
