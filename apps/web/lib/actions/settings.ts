'use server';

import { db } from '@hawk/db';
import { withTenant } from '../supabase/with-tenant';

export interface ProfileData {
  name: string;
  birth_date: string | null;
  metadata: Record<string, unknown>;
}

export async function fetchProfileSettings(): Promise<ProfileData> {
  return withTenant(async () => {
    const { data } = await db
      .from('profile')
      .select('name, birth_date, metadata')
      .limit(1)
      .single();

    return {
      name: data?.name ?? 'Usuário',
      birth_date: data?.birth_date ?? null,
      metadata: (data?.metadata as Record<string, unknown>) ?? {},
    };
  });
}

export async function updateProfileSettings(updates: {
  name: string;
  birth_date: string | null;
  metadata: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  return withTenant(async () => {
    const { data: existing } = await db.from('profile').select('id, metadata').limit(1).single();

    if (!existing) {
      return { success: false, error: 'Profile not found' };
    }

    const mergedMetadata = {
      ...((existing.metadata as Record<string, unknown>) ?? {}),
      ...updates.metadata,
    };

    const { error } = await db
      .from('profile')
      .update({
        name: updates.name,
        birth_date: updates.birth_date,
        metadata: mergedMetadata,
      } as never)
      .eq('id', existing.id);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  });
}

export interface ModuleRow {
  id: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export async function fetchModules(): Promise<ModuleRow[]> {
  return withTenant(async () => {
    const { data } = await db.from('modules').select('id, enabled, config').order('id');

    return (data ?? []).map((m) => ({
      id: m.id,
      enabled: m.enabled ?? true,
      config: (m.config as Record<string, unknown>) ?? {},
    }));
  });
}

export async function updateModuleEnabled(
  moduleId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  return withTenant(async () => {
    const { error } = await db.from('modules').update({ enabled }).eq('id', moduleId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  });
}
