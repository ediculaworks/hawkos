'use server';

import { db } from '@hawk/db';
import { withTenant } from '../supabase/with-tenant';

export async function fetchProfileName(): Promise<string> {
  return withTenant(async () => {
    const { data } = await db.from('profile').select('name').limit(1).single();
    return data?.name ?? 'Usuário';
  });
}
