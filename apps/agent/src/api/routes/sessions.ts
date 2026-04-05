import type { SupabaseCompatClient } from '@hawk/db';

type DbClient = SupabaseCompatClient;

interface AgentSessions {
  has(sessionId: string): boolean;
}

type BroadcastFn = (type: string, data: unknown) => void;
type RemoveSessionFn = (sessionId: string) => void;

export async function handleSessionsRoute(
  path: string,
  method: string,
  _req: Request,
  corsHeaders: Record<string, string>,
  requireSupabase: () => DbClient,
  broadcast: BroadcastFn,
  sessions: AgentSessions,
  removeSession: RemoveSessionFn,
): Promise<Response | null> {
  // POST /demands/:id/triage
  if (path.startsWith('/demands/') && path.endsWith('/triage') && method === 'POST') {
    const demandId = path.split('/')[2];
    try {
      const { getDemand } = await import('@hawk/module-demands/queries');
      const { triageDemand } = await import('@hawk/module-demands/triage');
      const demand = await getDemand(demandId!);
      triageDemand(demand)
        .then(() => {
          broadcast('demand_progress', { demandId, status: 'running' });
        })
        .catch((err) => {
          console.error('[demands] Triage failed:', err);
          broadcast('demand_progress', { demandId, status: 'failed', error: String(err) });
        });
      return new Response(JSON.stringify({ ok: true, demandId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // POST /sessions/:id/kill
  if (path.startsWith('/sessions/') && path.endsWith('/kill') && method === 'POST') {
    const sessionId = path.split('/')[2] ?? '';
    if (sessions.has(sessionId)) {
      removeSession(sessionId);
      return new Response(JSON.stringify({ ok: true, killed: sessionId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: false, error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST /agent-messages/:id/deliver
  if (path.startsWith('/agent-messages/') && path.endsWith('/deliver') && method === 'POST') {
    const messageId = path.split('/')[2] ?? '';
    const { error } = await requireSupabase()
      .from('agent_messages')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return null;
}
