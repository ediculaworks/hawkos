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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('hawk_tenant')?.value;
  const tenant = tenantSlug ? await getTenantPrivateBySlug(tenantSlug) : null;

  // Inject tenant config into browser globals (public + agent routing info)
  const tenantScript = tenant
    ? `window.__HAWK_TENANT__=${JSON.stringify({
        slug: tenant.slug,
        supabaseUrl: tenant.supabaseUrl,
        supabaseAnonKey: tenant.supabaseAnonKey,
        agentApiPort: tenant.agentApiPort,
        agentApiSecret: tenant.agentApiSecret,
      })};`
    : '';

  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: tenant config injection into window globals */}
      {tenantScript ? <script dangerouslySetInnerHTML={{ __html: tenantScript }} /> : null}
      <body>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
