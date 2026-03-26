import { getTenantPrivateBySlug } from '@/lib/tenants/cache-server';
import { createTenantClient } from '@hawk/db';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

async function getTenantSupabase() {
  const cookieStore = await cookies();
  const slug = cookieStore.get('hawk_tenant')?.value;
  if (slug) {
    const tenant = await getTenantPrivateBySlug(slug);
    if (tenant) return createTenantClient(tenant.supabaseUrl, tenant.supabaseServiceRoleKey);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await getTenantSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const { data: agent, error } = await supabase
      .from('agent_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar_seed ?? 'robot',
        tagline: agent.description ?? '',
        traits: agent.personality?.traits ?? [],
        tone: agent.personality?.tone ?? '',
        phrases: agent.personality?.phrases ?? [],
        knowledge: agent.knowledge ?? '',
        philosophy: agent.philosophy ?? '',
        enabled_tools: agent.tools_enabled ?? [],
        is_system: agent.is_system ?? false,
        is_default: agent.is_default ?? false,
        is_user_facing: agent.is_user_facing ?? true,
        created_at: agent.created_at,
        llm_model: agent.llm_model ?? null,
        temperature: agent.temperature != null ? Number(agent.temperature) : 0.7,
        max_tokens: agent.max_tokens ?? 4096,
        agent_tier: agent.agent_tier ?? 'specialist',
        identity: agent.identity ?? '',
        system_prompt: agent.system_prompt ?? '',
        memory_type: agent.memory_type ?? 'shared',
      },
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await getTenantSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      avatar,
      tagline,
      traits,
      tone,
      phrases,
      knowledge,
      philosophy,
      enabledTools,
      llmModel,
      temperature,
      maxTokens,
      agentTier,
      identity,
      systemPrompt,
      memoryType,
      isUserFacing,
    } = body;

    const updatePayload: Record<string, unknown> = {
      name,
      avatar_seed: avatar,
      description: tagline,
      personality: { traits: traits ?? [], tone: tone ?? '', phrases: phrases ?? [] },
      knowledge: knowledge ?? '',
      philosophy: philosophy ?? '',
      tools_enabled: enabledTools ?? [],
      updated_at: new Date().toISOString(),
    };

    if (llmModel !== undefined) updatePayload.llm_model = llmModel;
    if (temperature !== undefined) updatePayload.temperature = temperature;
    if (maxTokens !== undefined) updatePayload.max_tokens = maxTokens;
    if (agentTier !== undefined) updatePayload.agent_tier = agentTier;
    if (identity !== undefined) updatePayload.identity = identity;
    if (systemPrompt !== undefined) updatePayload.system_prompt = systemPrompt;
    if (memoryType !== undefined) updatePayload.memory_type = memoryType;
    if (isUserFacing !== undefined) updatePayload.is_user_facing = isUserFacing;

    const { data: agent, error } = await supabase
      .from('agent_templates')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getTenantSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  try {
    const { id } = await params;
    const { error } = await supabase
      .from('agent_templates')
      .delete()
      .eq('id', id)
      .eq('is_system', false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
