import type { SupabaseCompatClient } from '@hawk/db';

type DbClient = SupabaseCompatClient;

export async function handleChatRoute(
  path: string,
  method: string,
  req: Request,
  _url: URL,
  corsHeaders: Record<string, string>,
  requireSupabase: () => DbClient,
): Promise<Response | null> {
  if (!path.startsWith('/chat/')) {
    return null;
  }

  // GET /chat/sessions
  if (path === '/chat/sessions' && method === 'GET') {
    const { data: allConversations, error } = await requireSupabase()
      .from('agent_conversations')
      .select('session_id, template_id, title, last_message_at, channel')
      .order('last_message_at', { ascending: false })
      .limit(50);

    if (error || !allConversations) {
      return new Response(JSON.stringify({ sessions: [], error: error?.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Batch-load agent templates to avoid N+1 queries
    type ConversationRow = {
      session_id: string;
      template_id: string | null;
      title: string | null;
      last_message_at: string | null;
      channel: string | null;
    };
    const templateIds = [
      ...new Set(
        (allConversations as ConversationRow[])
          .filter((c) => c.template_id)
          .map((c) => c.template_id as string),
      ),
    ];
    const agentMap = new Map<string, { name: string; avatar_seed?: string }>();
    if (templateIds.length > 0) {
      const { data: agents } = await requireSupabase()
        .from('agent_templates')
        .select('id, name, avatar_seed')
        .in('id', templateIds);
      type AgentRow = { id: string; name: string; avatar_seed?: string | null };
      for (const a of agents ?? []) {
        const agent = a as AgentRow;
        agentMap.set(agent.id, { name: agent.name, avatar_seed: agent.avatar_seed ?? undefined });
      }
    }

    const sessionList = (allConversations as ConversationRow[]).map((conv) => {
      const agent = conv.template_id ? agentMap.get(conv.template_id) : undefined;
      return {
        id: conv.session_id,
        title: conv.title || 'Nova sessão',
        lastActivity: conv.last_message_at,
        agentId: conv.template_id,
        agentName: agent?.name,
        agentAvatar: agent?.avatar_seed ?? undefined,
        lastMessage: '',
        channel: conv.channel ?? 'web',
      };
    });

    return new Response(JSON.stringify({ sessions: sessionList }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // GET /chat/sessions/:id/messages
  if (path.startsWith('/chat/sessions/') && path.endsWith('/messages') && method === 'GET') {
    const sessionId = path.split('/')[3] ?? '';
    const { data } = await requireSupabase()
      .from('conversation_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    return new Response(JSON.stringify({ messages: data ?? [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST /chat/sessions
  if (path === '/chat/sessions' && method === 'POST') {
    const sessionId = crypto.randomUUID();
    let agentId: string | undefined;
    try {
      const body = (await req.json()) as Record<string, unknown>;
      agentId = body.agentId as string | undefined;
    } catch {
      // ignore parse errors
    }

    const db = requireSupabase();
    const { error } = db
      ? await db.from('agent_conversations').upsert(
          {
            session_id: sessionId,
            template_id: agentId ?? null,
            title: 'Nova sessão',
            channel: 'web',
            started_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
          },
          { onConflict: 'session_id' },
        )
      : { error: { message: 'Database not available' } };

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sessionId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // DELETE /chat/sessions/:id/delete
  if (path.startsWith('/chat/sessions/') && path.endsWith('/delete') && method === 'DELETE') {
    const sessionId = path.split('/')[3] ?? '';
    await requireSupabase().from('conversation_messages').delete().eq('session_id', sessionId);
    await requireSupabase().from('agent_conversations').delete().eq('session_id', sessionId);
    return new Response(JSON.stringify({ ok: true, deleted: sessionId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // PUT /chat/sessions/:id/title
  if (path.startsWith('/chat/sessions/') && path.endsWith('/title') && method === 'PUT') {
    const sessionId = path.split('/')[3] ?? '';
    const body = (await req.json()) as Record<string, unknown>;
    const title = body.title as string;

    await requireSupabase().from('agent_conversations').upsert(
      {
        session_id: sessionId,
        title,
        last_message_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' },
    );

    return new Response(JSON.stringify({ ok: true, title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return null;
}
