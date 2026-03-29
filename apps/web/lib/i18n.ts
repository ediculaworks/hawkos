import { getRequestConfig } from 'next-intl/server';

export const locales = ['pt-BR', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'pt-BR';

export default getRequestConfig(async () => {
  // For now, always use pt-BR. Later: read from user profile or cookie
  const locale = defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
