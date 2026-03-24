import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { invalidateTenantCache } from '@/lib/tenants/cache';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT = 'hawk-os-admin-salt-v1';

interface TenantInput {
  label: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  discordConfig?: {
    bot_token?: string;
    client_id?: string;
    guild_id?: string;
    channel_id?: string;
    user_id?: string;
  };
  openrouterConfig?: {
    api_key?: string;
    model?: string;
  };
}

function getAdminClient() {
  const url = process.env.ADMIN_SUPABASE_URL;
  const key = process.env.ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('ADMIN_SUPABASE_URL and ADMIN_SUPABASE_SERVICE_KEY must be set in environment');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function deriveKey(masterKey: string): Buffer {
  return createHash('sha256')
    .update(masterKey + SALT)
    .digest();
}

function encrypt(text: string, masterKey: string): { encrypted: string; iv: string } {
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([Buffer.from(encrypted, 'base64'), tag]);

  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64'),
  };
}

function generateAgentSecret(): string {
  return randomBytes(32).toString('hex');
}

export async function GET(request: Request) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');

    let query = supabase.from('tenants').select('*');
    if (slug) query = query.eq('slug', slug);
    else if (id) query = query.eq('id', id);
    else query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const adminUrl = process.env.ADMIN_SUPABASE_URL || '';
    const adminAnonKey = process.env.ADMIN_SUPABASE_ANON_KEY || '';
    const adminServiceKey = process.env.ADMIN_SUPABASE_SERVICE_KEY || '';

    const tenants = (data || []).map((t) => {
      const envContent = `# Hawk OS - Agent Environment Configuration
# Slot: ${t.slug}
# NÃO COMMIT ESTE ARQUIVO

# Admin Supabase (plataforma centralizada)
ADMIN_SUPABASE_URL=${adminUrl}
ADMIN_SUPABASE_ANON_KEY=${adminAnonKey}
ADMIN_SUPABASE_SERVICE_KEY=${adminServiceKey}

# Agent Slot (identifica qual tenant este agent pertence)
AGENT_SLOT=${t.slug}

# Agent API
AGENT_API_PORT=${t.agent_port}
AGENT_API_SECRET=${t.agent_secret}
NEXT_PUBLIC_AGENT_API_TOKEN=${t.agent_secret}

# Discord
DISCORD_AUTHORIZED_USER_ID=${t.discord_config?.user_id || ''}

# App
NODE_ENV=production
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Heartbeat
HEARTBEAT_PROFILE=companion
HEARTBEAT_ACTIVE_HOURS=08:00-22:00
`;
      return {
        ...t,
        supabase_service_key_encrypted: undefined,
        supabase_service_key_iv: undefined,
        envContent,
      };
    });

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('[admin/tenants] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tenants' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: TenantInput = await request.json();
    const supabase = getAdminClient();

    const SLOTS = ['ten1', 'ten2', 'ten3', 'ten4', 'ten5', 'ten6'];

    // Check if a tenant with this supabaseUrl already exists — reuse its slot
    const { data: existingByUrl } = await supabase
      .from('tenants')
      .select('*')
      .eq('supabase_url', body.supabaseUrl)
      .maybeSingle();

    // Find next available slot (exclude slot already owned by this URL)
    const { data: allTenants } = await supabase.from('tenants').select('slug, supabase_url');
    const usedSlugs = new Set(
      (allTenants || [])
        .filter((t: { slug: string; supabase_url: string }) => t.supabase_url !== body.supabaseUrl)
        .map((t: { slug: string }) => t.slug),
    );

    const nextSlug = existingByUrl?.slug ?? SLOTS.find((s) => !usedSlugs.has(s));
    if (!nextSlug) {
      return NextResponse.json({ error: 'No available slots' }, { status: 400 });
    }

    const agentPort = 3001 + SLOTS.indexOf(nextSlug);
    const agentSecret = existingByUrl?.agent_secret ?? generateAgentSecret();

    // Encrypt service key using admin service key as master
    const masterKey = process.env.ADMIN_SUPABASE_SERVICE_KEY!;
    const { encrypted, iv } = encrypt(body.supabaseServiceKey, masterKey);

    // Upsert tenant (handles re-runs of onboarding for the same Supabase URL)
    const { data: tenant, error } = await supabase
      .from('tenants')
      .upsert(
        {
          slug: nextSlug,
          label: body.label,
          supabase_url: body.supabaseUrl,
          supabase_anon_key: body.supabaseAnonKey,
          supabase_service_key_encrypted: encrypted,
          supabase_service_key_iv: iv,
          discord_config: body.discordConfig || {},
          openrouter_config: body.openrouterConfig || {},
          agent_port: agentPort,
          agent_secret: agentSecret,
          status: 'active',
          onboarding_completed_at: new Date().toISOString(),
        },
        { onConflict: 'slug' },
      )
      .select()
      .single();

    if (error) throw error;

    // Invalidate tenant cache so middleware picks up the new tenant immediately
    invalidateTenantCache(nextSlug);

    // Generate complete .env for the agent — no AGENT_SLOT (legacy single-env mode)
    const envContent = `# Hawk OS — Environment Configuration
# Gerado pelo onboarding em ${new Date().toISOString()}
# NÃO COMMIT ESTE ARQUIVO

# =============================================================================
# Supabase
# =============================================================================
SUPABASE_URL=${body.supabaseUrl}
SUPABASE_ANON_KEY=${body.supabaseAnonKey}
SUPABASE_SERVICE_ROLE_KEY=${body.supabaseServiceKey}

# Exposto ao browser (Next.js)
NEXT_PUBLIC_SUPABASE_URL=${body.supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${body.supabaseAnonKey}

# =============================================================================
# Discord
# =============================================================================
DISCORD_BOT_TOKEN=${body.discordConfig?.bot_token || ''}
DISCORD_CLIENT_ID=${body.discordConfig?.client_id || ''}
DISCORD_GUILD_ID=${body.discordConfig?.guild_id || ''}
DISCORD_CHANNEL_ID=${body.discordConfig?.channel_id || ''}
DISCORD_AUTHORIZED_USER_ID=${body.discordConfig?.user_id || ''}

# =============================================================================
# OpenRouter
# =============================================================================
OPENROUTER_API_KEY=${body.openrouterConfig?.api_key || ''}
OPENROUTER_MODEL=${body.openrouterConfig?.model || 'openrouter/auto'}
OPENROUTER_MAX_TOKENS=4096

# =============================================================================
# Agent API (comunicação web ↔ agent)
# =============================================================================
AGENT_API_PORT=${agentPort}
AGENT_API_SECRET=${agentSecret}
NEXT_PUBLIC_AGENT_API_TOKEN=${agentSecret}

# =============================================================================
# App
# =============================================================================
NODE_ENV=production
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Heartbeat
HEARTBEAT_PROFILE=companion
HEARTBEAT_ACTIVE_HOURS=08:00-22:00
`;

    return NextResponse.json({ tenant, envContent });
  } catch (error) {
    console.error('[admin/tenants] Error:', error);
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
