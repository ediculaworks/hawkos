import { resolve } from 'node:path';
import bundleAnalyzer from '@next/bundle-analyzer';
import { config } from 'dotenv';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Load root .env (monorepo pattern — Next.js only reads from its own dir)
config({ path: resolve(process.cwd(), '../../.env') });

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(process.cwd(), '../../'),
  transpilePackages: [
    '@hawk/db',
    '@hawk/shared',
    '@hawk/context-engine',
    '@hawk/module-calendar',
    '@hawk/module-career',
    '@hawk/module-finances',
    '@hawk/module-routine',
    '@hawk/module-objectives',
    '@hawk/module-memory',
    '@hawk/module-people',
    '@hawk/module-health',
    '@hawk/module-housing',
    '@hawk/module-assets',
    '@hawk/module-entertainment',
    '@hawk/module-legal',
    '@hawk/module-security',
    '@hawk/module-social',
    '@hawk/module-spirituality',
    '@hawk/module-journal',
    '@hawk/module-knowledge',
    '@hawk/extensions',
    'react-markdown',
    'remark-gfm',
    'remark-breaks',
  ],
  async headers() {
    return [
      {
        // Dashboard and API routes — always fresh
        source: '/dashboard/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        // Auth/login pages — cache for 1 hour
        source: '/login',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
      {
        source: '/auth/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
