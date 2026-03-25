import { requireAdminAuth } from '@/lib/admin-auth';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

interface SetupAccountRequest {
  email: string;
  password: string;
  name: string;
  cpf?: string;
  birthDate?: string;
  tenantSlot: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  modules: string[];
  timezone?: string;
  agents?: string[];
  discord?: {
    botToken: string;
    clientId: string;
    guildId: string;
    channelId: string;
    userId: string;
  };
  openrouter?: {
    apiKey: string;
    model?: string;
  };
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body: SetupAccountRequest = await request.json();
    const {
      email,
      password,
      name,
      cpf,
      birthDate,
      tenantSlot,
      supabaseUrl,
      supabaseServiceKey,
      modules,
      timezone,
      agents,
      discord,
      openrouter,
    } = body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 1. Create auth user — service key bypasses email confirmation
    let userId: string;

    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      const msg = createError.message.toLowerCase();
      const isAlreadyExists = msg.includes('already') && msg.includes('registered');
      if (isAlreadyExists) {
        // Migrations already wiped the tables — just delete the stale auth user and recreate
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existing = listData?.users.find((u) => u.email === email);
        if (existing) {
          const { error: delErr } = await supabase.auth.admin.deleteUser(existing.id);
          if (delErr) throw delErr;
        }
        const { data: retryData, error: retryError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (retryError) throw retryError;
        userId = retryData.user.id;
      } else {
        throw createError;
      }
    } else {
      userId = createData.user.id;
    }

    // 1b. Ensure password is set (createUser can silently skip password in some conditions)
    const { error: pwError } = await supabase.auth.admin.updateUser(userId, { password });
    if (pwError) console.warn('[setup-account] updateUser password failed:', pwError.message);

    // 2. Upsert profile with onboarding_complete = true
    const { error: profileError } = await supabase.from('profile').upsert(
      {
        id: userId,
        name,
        cpf: cpf || null,
        birth_date: birthDate || null,
        onboarding_complete: true,
        tenant_slot: tenantSlot,
        metadata: {
          timezone: timezone || 'America/Sao_Paulo',
          enabled_agents: agents?.length ? agents : ['bull', 'wolf'],
        },
      },
      { onConflict: 'id' },
    );
    if (profileError)
      throw new Error(profileError.message || profileError.code || JSON.stringify(profileError));

    // 3. Enable selected modules
    if (modules?.length > 0) {
      const { error: modulesError } = await supabase
        .from('modules')
        .upsert(modules.map((id: string) => ({ id, enabled: true })));
      if (modulesError)
        throw new Error(modulesError.message || modulesError.code || JSON.stringify(modulesError));
    }

    // 4. Save integration configs
    const integrations: Array<{
      profile_id: string;
      provider: string;
      config: Record<string, unknown>;
      enabled: boolean;
    }> = [];

    if (discord?.botToken) {
      integrations.push({
        profile_id: userId,
        provider: 'discord',
        config: discord as unknown as Record<string, unknown>,
        enabled: true,
      });
    }
    if (openrouter?.apiKey) {
      integrations.push({
        profile_id: userId,
        provider: 'openrouter',
        config: openrouter as unknown as Record<string, unknown>,
        enabled: true,
      });
    }
    if (integrations.length > 0) {
      const { error: intError } = await supabase
        .from('integration_configs')
        .upsert(integrations, { onConflict: 'profile_id,provider' });
      if (intError) console.warn('[setup-account] integration_configs upsert failed:', intError);
    }

    // 5. Save timezone to agent_settings singleton row
    if (timezone) {
      const { error: settingsError } = await supabase
        .from('agent_settings')
        .upsert({ id: 'singleton', timezone }, { onConflict: 'id' });
      if (settingsError)
        console.warn('[setup-account] agent_settings upsert failed:', settingsError);
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error('[admin/setup-account] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Setup failed' },
      { status: 500 },
    );
  }
}
