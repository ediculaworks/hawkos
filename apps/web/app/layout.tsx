import { ErrorBoundary } from '@/components/ui/error-boundary';
import { getTenantPrivateBySlug } from '@/lib/tenants/cache-server';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
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
};

// Build ID for cache invalidation — changes on every docker build
const BUILD_ID = process.env.BUILD_ID || String(Date.now());

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('hawk_tenant')?.value;
  const tenant = tenantSlug ? await getTenantPrivateBySlug(tenantSlug) : null;

  // Inject tenant config + build ID into browser globals
  const tenantObj = tenant
    ? JSON.stringify({
        slug: tenant.slug,
        supabaseUrl: tenant.supabaseUrl,
        supabaseAnonKey: tenant.supabaseAnonKey,
        agentApiPort: tenant.agentApiPort,
        agentApiSecret: tenant.agentApiSecret,
      })
    : 'null';

  const initScript = `window.__HAWK_TENANT__=${tenantObj};window.__HAWK_BUILD__="${BUILD_ID}";(function(){var b=localStorage.getItem("hawk_build");if(b&&b!=="${BUILD_ID}"){localStorage.setItem("hawk_build","${BUILD_ID}");location.reload()}else{localStorage.setItem("hawk_build","${BUILD_ID}")}})();`;

  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: tenant + build config injection */}
      <script dangerouslySetInnerHTML={{ __html: initScript }} />
      <body>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
