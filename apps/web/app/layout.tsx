import { ErrorBoundary } from '@/components/ui/error-boundary';
import { defaultLocale } from '@/lib/i18n';
import { getTenantPrivateBySlug } from '@/lib/tenants/cache-server';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { cookies } from 'next/headers';
import { Providers } from './providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Hawk OS',
  description: 'Personal life operating system',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Hawk OS',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('hawk_tenant')?.value;
  const tenant = tenantSlug ? await getTenantPrivateBySlug(tenantSlug) : null;

  // Load i18n messages for client components
  const messages = (await import(`../messages/${defaultLocale}.json`)).default;

  // Inject tenant config + build ID into browser globals
  const buildId = process.env.BUILD_ID ?? Date.now().toString(36);
  const tenantScript = [
    `window.__HAWK_BUILD__='${buildId}';`,
    tenant
      ? `window.__HAWK_TENANT__=${JSON.stringify({
          slug: tenant.slug,
          supabaseUrl: tenant.supabaseUrl,
          supabaseAnonKey: tenant.supabaseAnonKey,
          agentApiPort: tenant.agentApiPort,
        })};`
      : '',
  ]
    .filter(Boolean)
    .join('');

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: tenant config injection into window globals */}
      {tenantScript ? <script dangerouslySetInnerHTML={{ __html: tenantScript }} /> : null}
      <body>
        <ErrorBoundary>
          <NextIntlClientProvider locale={defaultLocale} messages={messages}>
            <Providers>{children}</Providers>
          </NextIntlClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
