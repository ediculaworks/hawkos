import { resolve } from 'node:path';
import { config } from 'dotenv';
import type { NextConfig } from 'next';

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
    '@hawk/module-journal',
    '@hawk/module-knowledge',
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
    '@hawk/extensions',
  ],
  async headers() {
    return [
      {
        // All routes EXCEPT Next.js static assets (content-addressed, fine to cache)
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
