import type { NextConfig } from 'next';

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  poweredByHeader: false,
  images: { unoptimized: true },
  devIndicators: false,
  async rewrites() {
    const destination = process.env.ASSETS_PROXY_URL?.replace(/\/$/, '');
    const api =
      process.env.API_PROXY_URL?.replace(/\/$/, '') ??
      (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : undefined);
    return [
      ...(destination ? [{ source: '/assets/:path*', destination: `${destination}/:path*` }] : []),
      ...(api ? [{ source: '/api/v1/:path*', destination: `${api}/api/v1/:path*` }] : []),
    ];
  },
};
export default config;
