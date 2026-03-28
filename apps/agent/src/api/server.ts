import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from '@hawk/db';
import { createClient } from '@supabase/supabase-js';
import { AUTOMATIONS, handleAutomationsRoute } from './routes/automations.js';
import { handleChatRoute } from './routes/chat.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIR = join(__dirname, '../../../workspace');

const PORT = Number.parseInt(process.env.AGENT_API_PORT || '3001');
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const WS_AUTH_TOKEN = process.env.AGENT_WS_TOKEN ?? '';
const AGENT_API_SECRET = process.env.AGENT_API_SECRET ?? '';

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    const url = SUPABASE_URL || process.env.SUPABASE_URL;
    const key = SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _supabase = createClient<Database>(url, key);
  }
  return _supabase;
}

function requireSupabase() {
  const db = getSupabase();
  if (!db) throw new Error('Supabase not configured');
  return db;
}

function requireAuth(req: Request): Response | null {
  if (!AGENT_API_SECRET) return null; // dev mode: skip auth if no secret configured
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${AGENT_API_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

interface BunWebSocket {
  send(data: string | ArrayBufferView | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
}

interface BunServer {
  upgrade(req: Request): Promise<BunWebSocket> | undefined;
}

declare const Bun: {
  serve(options: {
    port?: number;
    hostname?: string;
    fetch(req: Request, server: BunServer): Response | Promise<Response> | undefined;
    websocket?: {
      open(ws: BunWebSocket): void;
      message(ws: BunWebSocket, message: string | Buffer): void;
      close(ws: BunWebSocket): void;
    };
  }): { port: number };
};

interface AgentState {
  status: 'online' | 'offline' | 'restarting';
  startedAt: number;
  sessions: Map<string, { channel: string; lastActivity: number; messageCount: number }>;
  wsClients: Set<BunWebSocket>;
  chatClients: Map<string, BunWebSocket>;
  pendingAutomation: string | null;
}

const state: AgentState = {
  status: 'online',
  startedAt: Date.now(),
  sessions: new Map(),
  wsClients: new Set(),
  chatClients: new Map(),
  pendingAutomation: null,
};

/**
 * Send a tool call event to the WebSocket client for a given session.
 * Used by the tool:after hook to show tool calls in real-time.
 */
export function sendToolCallToClient(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
  result: string,
  durationMs?: number,
): void {
  const ws = state.chatClients.get(sessionId);
  if (!ws) return;
  try {
    ws.send(
      JSON.stringify({
        type: 'chat_tool_call',
        sessionId,
        name: toolName,
        args,
        result: result.slice(0, 500), // Truncate for WS
        durationMs,
      }),
    );
  } catch {
    // client disconnected
  }
}

// AUTOMATIONS constant imported from ./routes/automations.ts

function broadcast(type: string, data: unknown) {
  const msg = JSON.stringify({ type, timestamp: new Date().toISOString(), ...(data as object) });
  for (const ws of state.wsClients) {
    ws.send(msg);
  }
}

async function logActivity(
  eventType: string,
  summary: string,
  mod?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await requireSupabase()
      .from('activity_log')
      .insert({
        event_type: eventType,
        summary,
        module: mod,
        metadata: (metadata ?? {}) as Record<string, unknown>,
        // biome-ignore lint/suspicious/noExplicitAny: Supabase generated types lag behind schema
        // biome-ignore lint/suspicious/noExplicitAny: Supabase types lag behind schema
      } as any);
  } catch (err) {
    console.error('[api-server] Failed to log activity:', err);
  }
}

async function updateAgentStatus() {
  try {
    await requireSupabase()
      ?.from('agent_status')
      .upsert({
        id: 'singleton',
        status: state.status,
        last_heartbeat: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? 'development',
        version: '0.1.0',
      });
  } catch (err) {
    console.error('[api-server] Failed to update agent status:', err);
  }
}

function getUptimeSeconds(): number {
  return Math.floor((Date.now() - state.startedAt) / 1000);
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function addSession(sessionId: string, channel: string) {
  state.sessions.set(sessionId, { channel, lastActivity: Date.now(), messageCount: 0 });
  broadcast('session_started', { sessionId, channel });
  logActivity('automation', `Session started: ${sessionId}`, 'agent', { sessionId, channel });
}

export function updateSession(sessionId: string) {
  const session = state.sessions.get(sessionId);
  if (session) {
    session.lastActivity = Date.now();
    session.messageCount++;
  }
}

export function removeSession(sessionId: string) {
  const session = state.sessions.get(sessionId);
  if (session) {
    state.sessions.delete(sessionId);
    broadcast('session_ended', { sessionId, channel: session.channel });
    logActivity('automation', `Session ended: ${sessionId}`, 'agent', {
      sessionId,
      channel: session.channel,
    });
  }
}

export function triggerAutomation(name: string) {
  state.pendingAutomation = name;
  broadcast('automation_triggered', { name, timestamp: new Date().toISOString() });
  logActivity('automation', `Automation triggered: ${name}`, 'agent', { name });
  setTimeout(() => {
    state.pendingAutomation = null;
  }, 5000);
}

async function handleChatMessage(ws: BunWebSocket, data: Record<string, unknown>) {
  const { type, sessionId, content } = data;

  if (type === 'chat_join') {
    const sid = typeof sessionId === 'string' && sessionId ? sessionId : crypto.randomUUID();
    state.chatClients.set(sid, ws);
    ws.send(JSON.stringify({ type: 'chat_joined', sessionId: sid }));
    return;
  }

  if (type === 'chat_message') {
    if (typeof sessionId !== 'string' || !sessionId) {
      ws.send(JSON.stringify({ type: 'chat_error', error: 'Missing sessionId' }));
      return;
    }
    if (typeof content !== 'string' || !content.trim()) {
      ws.send(JSON.stringify({ type: 'chat_error', sessionId, error: 'Missing content' }));
      return;
    }
    // Limit message size (16KB max)
    if (content.length > 16_384) {
      ws.send(
        JSON.stringify({ type: 'chat_error', sessionId, error: 'Message too long (max 16KB)' }),
      );
      return;
    }
    const sid = sessionId;
    const message = content;

    // Ensure agent_conversations entry exists (upsert)
    const now = new Date().toISOString();
    await requireSupabase().from('agent_conversations').upsert(
      {
        session_id: sid,
        last_message_at: now,
        channel: 'web',
      },
      { onConflict: 'session_id' },
    );

    ws.send(JSON.stringify({ type: 'chat_typing', sessionId: sid }));

    try {
      // Stream chunks to the client as they arrive from LLM
      const onChunk = (chunk: string) => {
        try {
          ws.send(JSON.stringify({ type: 'chat_chunk', sessionId: sid, content: chunk }));
        } catch {
          // client disconnected
        }
      };

      const response = await handleChat(sid, message, onChunk);

      // Auto-title: update title from first user message if still default
      const { data: conv } = await requireSupabase()
        .from('agent_conversations')
        .select('title')
        .eq('session_id', sid)
        .single();

      if (!conv?.title || conv.title === 'Nova sessão') {
        const autoTitle = message.length > 50 ? `${message.slice(0, 47)}...` : message;
        await requireSupabase()
          .from('agent_conversations')
          .update({ title: autoTitle, last_message_at: new Date().toISOString() })
          .eq('session_id', sid);
      } else {
        await requireSupabase()
          .from('agent_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('session_id', sid);
      }

      // Send final complete message (marks end of streaming)
      ws.send(
        JSON.stringify({
          type: 'chat_message',
          sessionId: sid,
          content: response,
          role: 'assistant',
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (err) {
      ws.send(
        JSON.stringify({
          type: 'chat_error',
          sessionId: sid,
          error: err instanceof Error ? err.message : 'Unknown error',
        }),
      );
    }
  }
}

async function handleChat(
  sessionId: string,
  message: string,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const { handleWebMessage } = await import('../handler.js');

  // Only create session if it doesn't exist; don't reset existing sessions
  if (!state.sessions.has(sessionId)) {
    state.sessions.set(sessionId, { channel: 'web', lastActivity: Date.now(), messageCount: 0 });
  }

  try {
    const response = await handleWebMessage(sessionId, message, onChunk);
    return response;
  } finally {
    const session = state.sessions.get(sessionId);
    if (session) {
      session.messageCount++;
      session.lastActivity = Date.now();
    }
  }
}

const agentServer = Bun.serve({
  port: PORT,
  websocket: {
    open(ws) {
      // Reject new connections if at capacity
      const MAX_WS_CONNECTIONS = 100;
      if (state.wsClients.size >= MAX_WS_CONNECTIONS) {
        ws.close(1013, 'Max connections reached');
        return;
      }
      state.wsClients.add(ws);
      ws.send(
        JSON.stringify({
          type: 'connected',
          status: state.status,
          uptime: getUptimeSeconds(),
          sessions: Array.from(state.sessions.entries()).map(([id, data]) => ({ id, ...data })),
        }),
      );
    },
    message(ws, message) {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'chat_join' || data.type === 'chat_message') {
          handleChatMessage(ws, data);
        } else {
          handleWsMessage(data, ws);
        }
      } catch (err) {
        console.error('[api-server] Invalid WebSocket message:', err);
      }
    },
    close(ws) {
      state.wsClients.delete(ws);
    },
  },
  async fetch(req, _server) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (path === '/ws') {
      // Authenticate WebSocket connections via token query param
      if (WS_AUTH_TOKEN) {
        const token = url.searchParams.get('token');
        if (token !== WS_AUTH_TOKEN) {
          return new Response('Unauthorized', { status: 401 });
        }
      }
      const upgraded = await _server.upgrade(req);
      if (upgraded) return new Response(undefined, { status: 101 });
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // /health is public (monitoring)
    if (path === '/health') {
      return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // All other endpoints require auth
    const authError = requireAuth(req);
    if (authError) return authError;

    if (path === '/reload-credentials' && method === 'POST') {
      try {
        const { refreshCredentials } = await import('../credential-manager.js');
        const success = await refreshCredentials();
        return new Response(
          JSON.stringify({
            success,
            reloaded_at: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    }

    if (path === '/status' && method === 'GET') {
      return new Response(
        JSON.stringify({
          status: state.status,
          uptime: getUptimeSeconds(),
          uptimeFormatted: formatUptime(getUptimeSeconds()),
          sessions: Array.from(state.sessions.entries()).map(([id, data]) => ({ id, ...data })),
          pendingAutomation: state.pendingAutomation,
          wsClients: state.wsClients.size,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (path === '/settings' && method === 'GET') {
      const { data } = await requireSupabase()
        .from('agent_settings')
        .select('*')
        .eq('id', 'singleton')
        .single();
      return new Response(JSON.stringify({ settings: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/settings' && method === 'PUT') {
      const body = (await req.json()) as Record<string, unknown>;
      const { data, error } = await requireSupabase()
        .from('agent_settings')
        .upsert({
          id: 'singleton',
          agent_name: body.agent_name as string,
          llm_model: body.llm_model as string,
          temperature: body.temperature as number,
          max_tokens: body.max_tokens as number,
          heartbeat_interval: body.heartbeat_interval as number,
          offline_threshold: body.offline_threshold as number,
          auto_restart: body.auto_restart as boolean,
          enabled_channels: body.enabled_channels as string[],
          enabled_tools: body.enabled_tools as string[] | undefined,
          tenant_name: body.tenant_name as string | undefined,
          timezone: body.timezone as string | undefined,
          language: body.language as string | undefined,
          checkin_morning_enabled: body.checkin_morning_enabled as boolean | undefined,
          checkin_morning_time: body.checkin_morning_time as string | undefined,
          checkin_evening_enabled: body.checkin_evening_enabled as boolean | undefined,
          checkin_evening_time: body.checkin_evening_time as string | undefined,
          weekly_review_enabled: body.weekly_review_enabled as boolean | undefined,
          weekly_review_time: body.weekly_review_time as string | undefined,
          alerts_enabled: body.alerts_enabled as boolean | undefined,
          alerts_time: body.alerts_time as string | undefined,
          security_review_day: body.security_review_day as number | undefined,
          security_review_time: body.security_review_time as string | undefined,
          big_purchase_threshold: body.big_purchase_threshold as number | undefined,
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .select()
        .single();
      return new Response(JSON.stringify({ settings: data, error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Automations (delegated to routes/automations.ts) ──────
    const automationResponse = await handleAutomationsRoute(
      path, method, req, state, corsHeaders, requireSupabase, triggerAutomation, logActivity,
    );
    if (automationResponse) return automationResponse;

    // Chat routes (delegated to routes/chat.ts)
    const chatResponse = await handleChatRoute(path, method, req, url, corsHeaders, requireSupabase);
    if (chatResponse) return chatResponse;

    if (path === '/automations' && method === 'GET') {
      const db = requireSupabase();
      const { data: configs } = db
        ? await db.from('automation_configs').select('*').order('name')
        : { data: null };
      const merged = AUTOMATIONS.map((a) => {
        const config = configs?.find((c) => c.id === a.name);
        return {
          ...a,
          custom: false,
          enabled: config?.enabled ?? true,
          cron_expression: config?.cron_expression ?? a.cron,
          last_run: config?.last_run,
          run_count: config?.run_count ?? 0,
        };
      });
      // Include custom automations from DB
      const builtinNames = new Set(AUTOMATIONS.map((a) => a.name));
      const customAutomations = (configs ?? [])
        .filter((c) => !builtinNames.has(c.id) && c.custom === true)
        .map((c) => ({
          name: c.id,
          description: c.description ?? c.id,
          cron: c.cron_expression ?? '0 * * * *',
          category: c.category ?? 'custom',
          custom: true,
          enabled: c.enabled ?? true,
          cron_expression: c.cron_expression ?? '0 * * * *',
          last_run: c.last_run,
          run_count: c.run_count ?? 0,
        }));
      return new Response(
        JSON.stringify({
          automations: [...merged, ...customAutomations],
          pending: state.pendingAutomation,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (path === '/automations' && method === 'POST') {
      const body = (await req.json()) as Record<string, unknown>;
      const name = body.name as string;
      if (!name) {
        return new Response(JSON.stringify({ error: 'name is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data, error } = await requireSupabase()
        .from('automation_configs')
        .upsert({
          id: name,
          description: (body.description as string) ?? name,
          cron_expression: (body.cron_expression as string) ?? '0 * * * *',
          category: (body.category as string) ?? 'custom',
          enabled: true,
          custom: true,
          updated_at: new Date().toISOString(),
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
      await logActivity('automation.created', `Custom automation created: ${name}`, undefined, {
        name,
      });
      return new Response(JSON.stringify({ automation: data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path.startsWith('/automations/') && !path.endsWith('/trigger') && method === 'DELETE') {
      const name = path.split('/')[2] ?? '';
      // Only allow deleting custom automations
      const builtinNames = new Set(AUTOMATIONS.map((a) => a.name));
      if (builtinNames.has(name)) {
        return new Response(JSON.stringify({ error: 'Cannot delete built-in automation' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const db2 = requireSupabase();
      if (!db2) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await db2.from('automation_configs').delete().eq('id', name);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await logActivity('automation.deleted', `Custom automation deleted: ${name}`, undefined, {
        name,
      });
      return new Response(JSON.stringify({ ok: true, deleted: name }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/automations' && method === 'PUT') {
      const body = (await req.json()) as Record<string, unknown>;
      const { data, error } = await requireSupabase()
        .from('automation_configs')
        .upsert({
          id: body.id as string,
          enabled: body.enabled as boolean,
          cron_expression: body.cron_expression as string,
          updated_at: new Date().toISOString(),
          // biome-ignore lint/suspicious/noExplicitAny: Supabase types lag behind schema
        } as any)
        .select()
        .single();
      return new Response(JSON.stringify({ automation: data, error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path.startsWith('/automations/') && path.endsWith('/trigger') && method === 'POST') {
      const name = path.split('/')[2] ?? '';
      triggerAutomation(name);
      const { data } = await requireSupabase()
        .from('automation_configs')
        .select('run_count')
        .eq('id', name)
        .single();
      const newRunCount = (data?.run_count ?? 0) + 1;
      await requireSupabase()
        .from('automation_configs')
        .update({
          last_run: new Date().toISOString(),
          run_count: newRunCount,
          last_status: 'success',
        })
        .eq('id', name);
      return new Response(JSON.stringify({ ok: true, triggered: name }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Demands ───────────────────────────────────────────────────────
    if (path.startsWith('/demands/') && path.endsWith('/triage') && method === 'POST') {
      const demandId = path.split('/')[2];
      try {
        const { getDemand } = await import('@hawk/module-demands/queries');
        const { triageDemand } = await import('@hawk/module-demands/triage');
        const demand = await getDemand(demandId!);
        // Run triage async — don't block the response
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

    if (path === '/chat/sessions' && method === 'POST') {
      const sessionId = crypto.randomUUID();
      let agentId: string | undefined;
      try {
        const body = (await req.json()) as Record<string, unknown>;
        agentId = body.agentId as string | undefined;
      } catch {
        // ignore parse errors
      }

      // Always insert into agent_conversations so session appears in list immediately
      const db3 = requireSupabase();
      const { error } = db3
        ? await db3.from('agent_conversations').upsert({
            session_id: sessionId,
            template_id: agentId ?? null,
            title: 'Nova sessão',
            channel: 'web',
            started_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
          })
        : { error: { message: 'Database not available' } };

      if (error) {
        logActivity('error', `Failed to create session: ${error.message}`, 'agent', {
          error: error.message,
        });
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ sessionId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path.startsWith('/chat/sessions/') && path.endsWith('/delete') && method === 'DELETE') {
      const sessionId = path.split('/')[3] ?? '';
      await requireSupabase().from('conversation_messages').delete().eq('session_id', sessionId);
      await requireSupabase().from('agent_conversations').delete().eq('session_id', sessionId);
      return new Response(JSON.stringify({ ok: true, deleted: sessionId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    if (path === '/logs' && method === 'GET') {
      const limit = Math.min(Number.parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
      const offset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
      const type = url.searchParams.get('type');
      const mod = url.searchParams.get('module');
      const search = url.searchParams.get('search');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');

      let query = requireSupabase()
        .from('activity_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (type) query = query.eq('event_type', type);
      if (mod) query = query.eq('module', mod);
      if (search) query = query.ilike('summary', `%${search}%`);
      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      const { data, error, count } = await query;
      return new Response(JSON.stringify({ logs: data ?? [], total: count ?? 0, error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Workspace file endpoints (standing orders, heartbeat) ──
    if (path === '/workspace/standing-orders' && method === 'GET') {
      try {
        const content = readFileSync(join(WORKSPACE_DIR, 'STANDING_ORDERS.md'), 'utf-8');
        return new Response(JSON.stringify({ content }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ content: '' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (path === '/workspace/standing-orders' && method === 'PUT') {
      const body = (await req.json()) as { content: string };
      writeFileSync(join(WORKSPACE_DIR, 'STANDING_ORDERS.md'), body.content, 'utf-8');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === '/workspace/heartbeat' && method === 'GET') {
      try {
        const content = readFileSync(join(WORKSPACE_DIR, 'HEARTBEAT.md'), 'utf-8');
        return new Response(JSON.stringify({ content }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ content: '' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (path === '/workspace/heartbeat' && method === 'PUT') {
      const body = (await req.json()) as { content: string };
      writeFileSync(join(WORKSPACE_DIR, 'HEARTBEAT.md'), body.content, 'utf-8');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    if (path.startsWith('/sessions/') && path.endsWith('/kill') && method === 'POST') {
      const sessionId = path.split('/')[2] ?? '';
      if (state.sessions.has(sessionId)) {
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

    // Agent-to-Agent Messaging
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

    // Query another agent (synchronous request-response)
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

    return new Response('Not Found', { status: 404 });
  },
});

function handleWsMessage(data: Record<string, unknown>, ws: BunWebSocket) {
  const type = data.type as string;

  if (type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
    return;
  }

  if (type === 'trigger') {
    const automation = data.automation as string;
    if (automation) {
      triggerAutomation(automation);
      ws.send(JSON.stringify({ type: 'trigger_ack', automation }));
    }
    return;
  }

  if (type === 'kill_session') {
    const sessionId = data.sessionId as string;
    if (sessionId && state.sessions.has(sessionId)) {
      removeSession(sessionId);
      ws.send(JSON.stringify({ type: 'kill_ack', sessionId }));
    }
    return;
  }
}

// Heartbeat broadcast every 30s (lightweight, WebSocket keepalive)
setInterval(() => {
  broadcast('heartbeat', {
    status: state.status,
    uptime: getUptimeSeconds(),
    sessions: state.sessions.size,
    pendingAutomation: state.pendingAutomation,
  });
}, 30_000);

// DB status update every 5min (was 30s — saves ~10x DB writes)
setInterval(() => {
  updateAgentStatus();
}, 300_000);

updateAgentStatus();

export function stopApiServer() {
  (agentServer as { stop?: () => void }).stop?.();
  for (const ws of state.wsClients) {
    ws.close(1001, 'Server shutting down');
  }
  state.wsClients.clear();
  state.chatClients.clear();
  state.sessions.clear();
}

export { state as agentState, broadcast, logActivity };
