'use server';

import { db } from '@hawk/db';
import { unstable_cache } from 'next/cache';
import { getTenantSlug, withTenant } from '../supabase/with-tenant';

export async function fetchProfileName(): Promise<string> {
  const slug = await getTenantSlug();
  return withTenant(() =>
    unstable_cache(
      async () => {
        const { data } = await db.from('profile').select('name').limit(1).single();
        return data?.name ?? 'Usuário';
      },
      [`profile-name-${slug}`],
      { revalidate: 1800, tags: ['profile'] },
    )(),
  );
}
