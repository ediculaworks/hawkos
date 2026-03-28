import type { Database } from '@hawk/db';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

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

    const sessionList = await Promise.all(
      allConversations.map(async (conv) => {
        let agentName: string | undefined;
        let agentAvatar: string | undefined;

        if (conv.template_id) {
          const agent = await requireSupabase()
            .from('agent_templates')
            .select('name, avatar_seed')
            .eq('id', conv.template_id)
            .single();
          agentName = agent.data?.name;
          agentAvatar = agent.data?.avatar_seed ?? undefined;
        }

        return {
          id: conv.session_id,
          title: conv.title || 'Nova sessão',
          lastActivity: conv.last_message_at,
          agentId: conv.template_id,
          agentName,
          agentAvatar,
          lastMessage: '',
          channel: conv.channel ?? 'web',
        };
      }),
    );

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
      ? await db.from('agent_conversations').upsert({
          session_id: sessionId,
          template_id: agentId ?? null,
          title: 'Nova sessão',
          channel: 'web',
          started_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
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

    await requireSupabase().from('agent_conversations').upsert({
      session_id: sessionId,
      title,
      last_message_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return null;
}
