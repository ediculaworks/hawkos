import { requireAdminAuth } from '@/lib/admin-auth';
import { createAdminClientFromEnv } from '@hawk/admin';
import { createUser, deleteUser, listUsers, updateUser } from '@hawk/auth';
import { getPool } from '@hawk/db';
import { NextResponse } from 'next/server';

interface SetupAccountRequest {
  email: string;
  password: string;
  name: string;
  cpf?: string;
  birthDate?: string;
  tenantSlot: string;
  schemaName: string;
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
      schemaName,
      modules,
      timezone,
      agents,
      discord,
      openrouter,
    } = body;

    if (!schemaName) {
      return NextResponse.json({ error: 'schemaName is required' }, { status: 400 });
    }

    const sql = getPool();

    // 1. Create auth user — if already exists, delete and recreate
    let userId: string;

    const { data: createData, error: createError } = await createUser(email, password, schemaName);

    if (createError) {
      const isAlreadyExists =
        createError.toLowerCase().includes('already') ||
        createError.toLowerCase().includes('duplicate');

      if (isAlreadyExists) {
        // Delete stale auth user and recreate
        const { data: listData } = await listUsers(schemaName);
        const existing = listData?.find((u) => u.email === email);
        if (existing) {
          await deleteUser(existing.id, schemaName);
        }
        const { data: retryData, error: retryError } = await createUser(
          email,
          password,
          schemaName,
        );
        if (retryError) throw new Error(retryError);
        if (!retryData) throw new Error('Failed to create user');
        userId = retryData.id;
      } else {
        throw new Error(createError);
      }
    } else {
      if (!createData) throw new Error('Failed to create user');
      userId = createData.id;
    }

    // 1b. Ensure password is set (belt-and-suspenders)
    const { error: pwError } = await updateUser(userId, { password }, schemaName);
    if (pwError) console.warn('[setup-account] updateUser password failed:', pwError);

    // 2. Upsert profile with onboarding_complete = true
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
      await tx.unsafe(
        `INSERT INTO profile (id, name, cpf, birth_date, onboarding_complete, tenant_slot, metadata)
         VALUES ($1, $2, $3, $4, true, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           cpf = EXCLUDED.cpf,
           birth_date = EXCLUDED.birth_date,
           onboarding_complete = true,
           tenant_slot = EXCLUDED.tenant_slot,
           metadata = EXCLUDED.metadata`,
        [
          userId,
          name,
          cpf || null,
          birthDate || null,
          tenantSlot,
          JSON.stringify({
            timezone: timezone || 'America/Sao_Paulo',
            enabled_agents: agents?.length ? agents : ['bull', 'wolf'],
          }),
        ],
      );
    });

    // 3. Enable selected modules
    if (modules?.length > 0) {
      await sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
        for (const id of modules) {
          await tx.unsafe(
            `INSERT INTO modules (id, enabled) VALUES ($1, true)
             ON CONFLICT (id) DO UPDATE SET enabled = true`,
            [id],
          );
        }
      });
    }

    // 4. Save integration configs via admin client
    const admin = createAdminClientFromEnv();
    const tenant = await admin.getTenantBySlug(tenantSlot);

    if (tenant) {
      if (discord?.botToken) {
        await admin.upsertTenantIntegration(
          tenant.id,
          'discord',
          {
            bot_token: discord.botToken,
            client_id: discord.clientId,
            guild_id: discord.guildId,
            channel_id: discord.channelId,
            authorized_user_id: discord.userId,
          },
          true,
        );
      }
      if (openrouter?.apiKey) {
        await admin.upsertTenantIntegration(
          tenant.id,
          'openrouter',
          {
            api_key: openrouter.apiKey,
            model: openrouter.model || 'openrouter/auto',
          },
          true,
        );
      }
    } else {
      console.warn('[setup-account] Tenant not found in admin DB — integrations not saved');
    }

    // 5. Save timezone to agent_settings singleton row
    if (timezone) {
      await sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
        await tx.unsafe(
          `INSERT INTO agent_settings (id, timezone) VALUES ('singleton', $1)
           ON CONFLICT (id) DO UPDATE SET timezone = EXCLUDED.timezone`,
          [timezone],
        );
      });
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
