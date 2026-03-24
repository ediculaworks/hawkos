import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

function getAnonSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET() {
  const supabase = getAnonSupabase() ?? getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  try {
    const { data: agents, error } = await supabase
      .from('agent_templates')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
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
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

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
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const personality = {
      traits: traits ?? [],
      tone: tone ?? '',
      phrases: phrases ?? [],
    };

    const { data: agent, error } = await supabase
      .from('agent_templates')
      .insert({
        name,
        avatar_seed: avatar || 'robot',
        description: tagline || '',
        personality,
        knowledge: knowledge || '',
        philosophy: philosophy || '',
        tools_enabled: enabledTools ?? [],
        is_system: false,
        is_default: false,
        llm_model: llmModel || null,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 4096,
        agent_tier: agentTier || 'specialist',
        identity: identity || '',
        system_prompt: systemPrompt || null,
        memory_type: memoryType || 'shared',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
