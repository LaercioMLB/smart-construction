import knownAssets from './assets-index.json';
import coverOverrides from './service-cover-overrides.json';

const serviceCoverOverrides: Readonly<Record<string, string>> = coverOverrides;

export const initialAssetKeys = knownAssets;
export const assetsBaseURL = process.env.NEXT_PUBLIC_ASSETS_BASE_URL?.replace(/\/$/, '') ?? '';

export function assetUrl(src: string, baseURL = assetsBaseURL): string {
  if (!src.startsWith('/images/') || !baseURL) return src;
  return `${baseURL.replace(/\/$/, '')}/${src.slice('/images/'.length)}`;
}

export function serviceCoverPath(slug: string): string {
  const filename = serviceCoverOverrides[slug] ?? 'cover.jpg';
  return `/images/services/${encodeURIComponent(slug)}/${filename}`;
}
