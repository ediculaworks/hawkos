'use server';

import { getSafeSchemaFromCookie } from '@/lib/auth/safe-schema';
import { getPool } from '@hawk/db';
import { revalidatePath } from 'next/cache';

export interface PendingIntent {
  id: string;
  description: string;
  prerequisiteMessage: string;
  createdAt: string;
}

export async function fetchPendingIntents(): Promise<PendingIntent[]> {
  const schema = await getSafeSchemaFromCookie();
  const sql = getPool();

  const rows = await sql.unsafe(
    `SELECT id, description, prerequisite_message, created_at
     FROM "${schema}".pending_intents
     WHERE status = 'pending'
     ORDER BY created_at DESC
     LIMIT 10`,
  );

  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    description: String(r.description ?? ''),
    prerequisiteMessage: String(r.prerequisite_message ?? ''),
    createdAt: String(r.created_at),
  }));
}

export async function dismissPendingIntent(id: string): Promise<void> {
  const schema = await getSafeSchemaFromCookie();
  const sql = getPool();

  await sql.unsafe(`UPDATE "${schema}".pending_intents SET status = 'expired' WHERE id = $1`, [id]);
  revalidatePath('/dashboard');
}
