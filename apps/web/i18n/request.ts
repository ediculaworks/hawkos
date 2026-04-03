import { defaultLocale } from '@/lib/i18n';
import type { AbstractIntlMessages } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  const locale = defaultLocale;
  const messages = (await import(`../messages/${locale}.json`)) as {
    default: AbstractIntlMessages;
  };
  return {
    locale,
    messages: messages.default,
  };
});
