import { resolve } from 'node:path';
import { config } from 'dotenv';
import type { NextConfig } from 'next';

// Load root .env (monorepo pattern — Next.js only reads from its own dir)
config({ path: resolve(process.cwd(), '../../.env') });

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@hawk/db',
    '@hawk/shared',
    '@hawk/module-calendar',
    '@hawk/module-career',
    '@hawk/module-finances',
    '@hawk/module-routine',
    '@hawk/module-objectives',
    '@hawk/module-journal',
    '@hawk/module-knowledge',
    '@hawk/module-memory',
    '@hawk/module-people',
    '@hawk/extensions',
  ],
};

export default nextConfig;
