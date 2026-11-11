'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { assetsBaseURL, initialAssetKeys } from '@/shared/assets';

const initialKeys: ReadonlySet<string> = new Set(initialAssetKeys);
const AssetContext = createContext(initialKeys);

export function AssetProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState(initialKeys);
  useEffect(() => {
    if (!assetsBaseURL) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`${assetsBaseURL}/__assets.json`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (
          Array.isArray(payload) &&
          payload.every((key): key is string => typeof key === 'string')
        ) {
          setKeys(new Set(payload));
        }
      } catch {
        // Mantém as chaves iniciais se o índice não puder ser consultado.
      }
    }
    void refresh();
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return <AssetContext.Provider value={keys}>{children}</AssetContext.Provider>;
}

export function useAssetExists(path: string): boolean {
  return useContext(AssetContext).has(path.replace(/^\/images\//, ''));
}
