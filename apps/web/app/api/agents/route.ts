import { getTenantPrivateBySlug } from '@/lib/tenants/cache-server';
import { db, withTenantSchema } from '@hawk/db';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

async function getTenantSchema(): Promise<string> {
  const cookieStore = await cookies();
  const slug = cookieStore.get('hawk_tenant')?.value;

  if (slug) {
    const tenant = await getTenantPrivateBySlug(slug);
    if (tenant) return tenant.schemaName;
  }

  return process.env.TENANT_SCHEMA ?? 'public';
}

export async function GET() {
  const schemaName = await getTenantSchema();

  try {
    const { data: agents, error } = await withTenantSchema(schemaName, () =>
      db.from('agent_templates').select('*').order('created_at', { ascending: true }),
    );

    if (error) {
      console.error('[api/agents] schema:', schemaName, 'error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedAgents = (agents ?? []).map((agent) => ({
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
      created_at: agent.created_at,
      agent_tier: agent.agent_tier ?? 'specialist',
      llm_model: agent.llm_model ?? null,
      sprite_folder: agent.sprite_folder ?? null,
      is_user_facing: agent.is_user_facing ?? true,
    }));

    return NextResponse.json({ agents: formattedAgents });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const schemaName = await getTenantSchema();

  try {
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

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const personality = {
      traits: traits ?? [],
      tone: tone ?? '',
      phrases: phrases ?? [],
    };

    const insertData = {
      name,
      avatar_seed: avatar || 'robot',
      description: tagline || '',
      personality,
      identity: identity || '',
      knowledge: knowledge || '',
      philosophy: philosophy || '',
      system_prompt: systemPrompt || null,
      tools_enabled: enabledTools ?? [],
      llm_model: llmModel || null,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 4096,
      agent_tier: agentTier || 'specialist',
      memory_type: memoryType || 'shared',
      is_user_facing: isUserFacing ?? true,
      is_system: false,
      is_default: false,
    };

    const { data: agent, error } = await withTenantSchema(schemaName, () =>
      db.from('agent_templates').insert(insertData).select().single(),
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
