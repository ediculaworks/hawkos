import type { Database } from '@hawk/db';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export async function handleAgentsRoute(
  path: string,
  method: string,
  req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
  requireSupabase: () => DbClient,
): Promise<Response | null> {
  if (path === '/agents' && method === 'GET') {
    const { data: agents, error: _error } = await requireSupabase()
      .from('agent_templates')
      .select('*')
      .order('created_at', { ascending: true });

    const formatted = (agents ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      avatar: a.avatar_seed ?? 'robot',
      tagline: a.description ?? '',
      // biome-ignore lint/suspicious/noExplicitAny: JSONB personality field
      traits: (a.personality as any)?.traits ?? [],
      // biome-ignore lint/suspicious/noExplicitAny: JSONB personality field
      tone: (a.personality as any)?.tone ?? '',
    }));

    return new Response(JSON.stringify({ agents: formatted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (path === '/agent-messages' && method === 'POST') {
    const body = (await req.json()) as Record<string, unknown>;
    const { from_agent_id, to_agent_id, session_id, message_type, content, context } = body;

    const { data: message, error } = await requireSupabase()
      .from('agent_messages')
      .insert({
        from_agent_id: from_agent_id as string,
        to_agent_id: to_agent_id as string,
        session_id: (session_id as string) ?? null,
        message_type: (message_type as string) ?? 'message',
        content: content as string,
        context: (context ?? {}) as Record<string, unknown>,
        // biome-ignore lint/suspicious/noExplicitAny: Supabase types lag behind schema
      } as any)
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (path === '/agent-messages' && method === 'GET') {
    const agentId = url.searchParams.get('agent_id');
    const sessionId = url.searchParams.get('session_id');
    const status = url.searchParams.get('status');

    let query = requireSupabase()
      .from('agent_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (agentId) {
      query = query.eq('to_agent_id', agentId);
    }
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: messages, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ messages: messages ?? [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (path === '/agent/query' && method === 'POST') {
    const body = (await req.json()) as Record<string, unknown>;
    const { from_agent_id, to_agent_id, query, session_id, context } = body;

    // Get target agent info
    const { data: targetAgent } = await requireSupabase()
      .from('agent_templates')
      .select('*')
      .eq('id', to_agent_id as string)
      .single();

    if (!targetAgent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create message record
    const { data: message } = await requireSupabase()
      .from('agent_messages')
      .insert({
        from_agent_id: from_agent_id as string,
        to_agent_id: to_agent_id as string,
        session_id: (session_id as string) ?? null,
        message_type: 'query',
        content: query as string,
        context: (context ?? {}) as Record<string, unknown>,
        // biome-ignore lint/suspicious/noExplicitAny: Supabase types lag behind schema
      } as any)
      .select()
      .single();

    // Return agent info for the caller to process the query
    return new Response(
      JSON.stringify({
        message_id: message?.id,
        agent: {
          id: targetAgent.id,
          name: targetAgent.name,
          avatar: targetAgent.avatar_seed,
          personality: targetAgent.personality,
          knowledge: targetAgent.knowledge,
          philosophy: targetAgent.philosophy,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  return null;
}
