import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, withSchema } from '@hawk/db';
import { DOCKER_LOG_SERVICES, streamDockerLogs } from '../docker-logs.js';
import { getTailLines, subscribeToLogs } from '../log-buffer.js';
import { handleAgentsRoute } from './routes/agents.js';
import { handleAutomationsRoute } from './routes/automations.js';
import { handleChatRoute } from './routes/chat.js';
import { handleLogsRoute } from './routes/logs.js';
import { handleOnboardingRoute } from './routes/onboarding.js';
import { handleWorkspaceRoute } from './routes/workspace.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIR = join(__dirname, '../../../workspace');

const PORT = Number.parseInt(process.env.AGENT_API_PORT || '3001');
const WS_AUTH_TOKEN = process.env.AGENT_WS_TOKEN ?? '';
const AGENT_API_SECRET = process.env.AGENT_API_SECRET ?? '';

/** Returns the db compat client — drop-in replacement for requireSupabase(). */
function requireSupabase() {
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
  /** Maps sessionId → tenant slug for per-tenant schema context */
  sessionTenants: Map<string, string>;
  pendingAutomation: string | null;
}

const state: AgentState = {
  status: 'online',
  startedAt: Date.now(),
  sessions: new Map(),
  wsClients: new Set(),
  chatClients: new Map(),
  sessionTenants: new Map(),
  pendingAutomation: null,
};

// SSE clients — key: clientId, value: event sender function
const sseClients = new Map<string, (type: string, data: unknown) => void>();

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
  // Also emit to SSE clients
  for (const listener of sseClients.values()) {
    listener(type, data);
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
    // Store tenant slug for this session so we can set schema context during chat
    const tenantSlug = typeof data.tenantSlug === 'string' ? data.tenantSlug : undefined;
    if (tenantSlug) state.sessionTenants.set(sid, tenantSlug);
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

    // Resolve tenant schema for this WebSocket session
    const wsTenantSlug = state.sessionTenants.get(sid);
    const wsSchemaName = `tenant_${wsTenantSlug ?? 'ten1'}`;

    const runWsChat = async () => {
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

      // Stream chunks to the client as they arrive from LLM
      const onChunk = (chunk: string) => {
        try {
          ws.send(JSON.stringify({ type: 'chat_chunk', sessionId: sid, content: chunk }));
        } catch {
          // client disconnected
        }
      };

      const startMs = Date.now();
      const chatResult = await handleChat(sid, message, onChunk);
      const durationMs = Date.now() - startMs;

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
          content: chatResult.content,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          tokensUsed: chatResult.tokensUsed,
          model: chatResult.model,
          durationMs,
        }),
      );
    };

    try {
      await withSchema(wsSchemaName, runWsChat);
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
): Promise<{ content: string; tokensUsed: number; model: string }> {
  const { handleWebMessage } = await import('../handler.js');
  const { withSchema } = await import('@hawk/db');
  const { tenantManager } = await import('../tenant-manager.js');

  // Only create session if it doesn't exist; don't reset existing sessions
  if (!state.sessions.has(sessionId)) {
    state.sessions.set(sessionId, { channel: 'web', lastActivity: Date.now(), messageCount: 0 });
  }

  // Resolve tenant schema for this session
  const tenantSlug = state.sessionTenants.get(sessionId);
  const tenantCtx = tenantSlug ? tenantManager.getTenant(tenantSlug) : tenantManager.getAll()[0];
  const schemaName = tenantCtx?.schemaName ?? `tenant_${tenantSlug ?? 'ten1'}`;

  try {
    const result = await withSchema(schemaName, () =>
      handleWebMessage(sessionId, message, onChunk, tenantCtx?.credentials?.openrouterConfig?.api_key),
    );
    return {
      content: result.response,
      tokensUsed: result.totalTokens,
      model: result.selectedModel,
    };
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
      const deep = url.searchParams.get('deep') === 'true';
      const checks: Record<string, { ok: boolean; latency_ms?: number; error?: string }> = {};

      // Always check database
      const dbStart = Date.now();
      try {
        await db.from('activity_log').select('id').limit(1);
        checks.database = { ok: true, latency_ms: Date.now() - dbStart };
      } catch (err) {
        checks.database = {
          ok: false,
          latency_ms: Date.now() - dbStart,
          error: err instanceof Error ? err.message : 'unknown',
        };
      }

      if (deep) {
        // Check OpenRouter
        try {
          const orRes = await fetch('https://openrouter.ai/api/v1/models', {
            signal: AbortSignal.timeout(5000),
          });
          checks.openrouter = { ok: orRes.ok };
        } catch (err) {
          checks.openrouter = { ok: false, error: err instanceof Error ? err.message : 'timeout' };
        }

        // Check Discord
        const discordToken = process.env.DISCORD_BOT_TOKEN;
        if (discordToken) {
          try {
            const dcRes = await fetch('https://discord.com/api/v10/users/@me', {
              headers: { Authorization: `Bot ${discordToken}` },
              signal: AbortSignal.timeout(5000),
            });
            checks.discord = { ok: dcRes.ok };
          } catch (err) {
            checks.discord = { ok: false, error: err instanceof Error ? err.message : 'timeout' };
          }
        }
      }

      // Tenant summary
      let tenantSummary: { count: number; active: number; slugs: string[] } | undefined;
      try {
        const { tenantManager } = await import('../tenant-manager.js');
        const all = tenantManager.getAll();
        tenantSummary = {
          count: all.length,
          active: all.filter((t) => t.status === 'active').length,
          slugs: all.map((t) => t.slug),
        };
      } catch {
        // tenantManager not available (legacy mode)
      }

      const allOk = Object.values(checks).every((c) => c.ok);
      const status = checks.database?.ok ? 200 : 503;

      return new Response(
        JSON.stringify({
          ok: allOk,
          timestamp: new Date().toISOString(),
          uptime_seconds: Math.floor(process.uptime()),
          checks,
          tenants: tenantSummary,
        }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // All other endpoints require auth
    const authError = requireAuth(req);
    if (authError) return authError;

    // Wrap all authenticated HTTP routes in the correct tenant schema context.
    // The X-Hawk-Tenant header is forwarded by the Next.js proxy.
    const hawkTenant = req.headers.get('X-Hawk-Tenant');
    const dispatchRoutes = async (): Promise<Response> => {
    if (path === '/reload-credentials' && method === 'POST') {
      try {
        const { tenantManager } = await import('../tenant-manager.js');
        const { startTenantServices } = await import('../index.js');
        // Reload all tenants from admin schema
        await tenantManager.shutdownAll();
        await tenantManager.loadAll();
        for (const ctx of tenantManager.getAll()) {
          await startTenantServices(ctx);
        }
        const success = true;
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

    // ── Admin: Tenant management endpoints ───────────────────────
    // POST /admin/tenants/:slug/start — hot-load a new tenant (called by onboarding)
    const tenantStartMatch = path.match(/^\/admin\/tenants\/([a-z0-9_-]+)\/start$/);
    if (tenantStartMatch && method === 'POST') {
      const slug = tenantStartMatch[1]!;
      try {
        const { tenantManager } = await import('../tenant-manager.js');
        const { startTenantServices } = await import('../index.js');
        const ctx = await tenantManager.addTenant(slug);
        await startTenantServices(ctx);
        return new Response(JSON.stringify({ ok: true, slug, status: ctx.status }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            ok: false,
            slug,
            error: err instanceof Error ? err.message : String(err),
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // POST /admin/tenants/:slug/stop — disconnect a tenant
    const tenantStopMatch = path.match(/^\/admin\/tenants\/([a-z0-9_-]+)\/stop$/);
    if (tenantStopMatch && method === 'POST') {
      const slug = tenantStopMatch[1]!;
      try {
        const { tenantManager } = await import('../tenant-manager.js');
        await tenantManager.removeTenant(slug);
        return new Response(JSON.stringify({ ok: true, slug, stopped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            ok: false,
            slug,
            error: err instanceof Error ? err.message : String(err),
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // POST /admin/reload — reload all tenants from admin schema
    if (path === '/admin/reload' && method === 'POST') {
      try {
        const { tenantManager } = await import('../tenant-manager.js');
        const { startTenantServices } = await import('../index.js');
        await tenantManager.shutdownAll();
        await tenantManager.loadAll();
        for (const ctx of tenantManager.getAll()) {
          await startTenantServices(ctx);
        }
        return new Response(
          JSON.stringify({
            ok: true,
            tenants: tenantManager.getAll().map((t) => ({ slug: t.slug, status: t.status })),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // GET /admin/tenants — list all loaded tenants and their status
    if (path === '/admin/tenants' && method === 'GET') {
      const { tenantManager } = await import('../tenant-manager.js');
      const tenants = tenantManager.getAll().map((t) => ({
        slug: t.slug,
        schemaName: t.schemaName,
        status: t.status,
        lastError: t.lastError,
        cronTasks: t.cronTasks.length,
        hasDiscord: !!t.discordClient,
      }));
      return new Response(JSON.stringify({ tenants, count: tenants.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /admin/logs/stream — stream logs via SSE
    // ?service=agent (default) | web | postgres | pgbouncer | caddy
    // ?tail=200 (lines to replay on connect)
    if (path === '/admin/logs/stream' && method === 'GET') {
      const tail = Math.min(
        Math.max(Number.parseInt(url.searchParams.get('tail') || '200', 10) || 200, 1),
        1000,
      );
      const service = url.searchParams.get('service') ?? 'agent';

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          let closed = false;

          function enqueue(text: string) {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(text));
            } catch {
              cleanup();
            }
          }

          function cleanup() {
            if (closed) return;
            closed = true;
            clearInterval(keepalive);
            if (unsubscribe) unsubscribe();
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          }

          enqueue(`data: ${JSON.stringify({ type: 'connected', service })}\n\n`);

          let unsubscribe: (() => void) | null = null;

          if (service === 'agent') {
            // In-memory buffer: replay tail then subscribe to live updates
            for (const line of getTailLines(tail)) {
              enqueue(
                `data: ${JSON.stringify({ type: 'log', level: line.level, ts: line.ts, line: line.text })}\n\n`,
              );
            }
            unsubscribe = subscribeToLogs((line) => {
              enqueue(
                `data: ${JSON.stringify({ type: 'log', level: line.level, ts: line.ts, line: line.text })}\n\n`,
              );
            });
          } else if (DOCKER_LOG_SERVICES.includes(service)) {
            // Docker HTTP API — stream from container
            streamDockerLogs(
              service,
              tail,
              (text) => {
                const level = /error/i.test(text) ? 'error' : /warn/i.test(text) ? 'warn' : 'log';
                enqueue(
                  `data: ${JSON.stringify({ type: 'log', level, ts: new Date().toISOString(), line: text })}\n\n`,
                );
              },
              req.signal,
            );
          } else {
            enqueue(
              `data: ${JSON.stringify({ type: 'error', message: `Unknown service: ${service}` })}\n\n`,
            );
            cleanup();
            return;
          }

          // Keepalive every 15s
          const keepalive = setInterval(() => {
            enqueue(': keepalive\n\n');
          }, 15_000);
          req.signal.addEventListener('abort', cleanup, { once: true });
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
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
      path,
      method,
      req,
      state,
      corsHeaders,
      requireSupabase,
      triggerAutomation,
      logActivity,
    );
    if (automationResponse) return automationResponse;

    // Onboarding chat route (delegated to routes/onboarding.ts)
    if (path === '/onboarding/chat') {
      return handleOnboardingRoute(req, corsHeaders);
    }

    // Chat routes (delegated to routes/chat.ts)
    const chatResponse = await handleChatRoute(
      path,
      method,
      req,
      url,
      corsHeaders,
      requireSupabase,
    );
    if (chatResponse) return chatResponse;

    // Logs routes (delegated to routes/logs.ts)
    const logsResponse = await handleLogsRoute(
      path,
      method,
      req,
      url,
      corsHeaders,
      requireSupabase,
    );
    if (logsResponse) return logsResponse;

    // Workspace routes (delegated to routes/workspace.ts)
    const workspaceResponse = await handleWorkspaceRoute(
      path,
      method,
      req,
      corsHeaders,
      WORKSPACE_DIR,
    );
    if (workspaceResponse) return workspaceResponse;

    // Agents routes (delegated to routes/agents.ts)
    const agentsResponse = await handleAgentsRoute(
      path,
      method,
      req,
      url,
      corsHeaders,
      requireSupabase,
    );
    if (agentsResponse) return agentsResponse;

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

    // ── Client error reporting (from web dashboard error-reporter.ts) ──
    if (path === '/errors' && method === 'POST') {
      try {
        const body = (await req.json()) as {
          message: string;
          stack?: string;
          component?: string;
          url?: string;
        };
        logActivity('client_error', `[${body.component ?? 'unknown'}] ${body.message}`, undefined, {
          stack: body.stack?.slice(0, 500),
          url: body.url,
        }).catch(() => {});
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ ok: false }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Prometheus-style metrics ────────────────────────────────────────────
    if (path === '/metrics' && method === 'GET') {
      const dailyUsage = (await import('../model-router.js')).getDailyUsage();
      const lines = [
        '# HELP hawk_uptime_seconds Agent uptime in seconds',
        '# TYPE hawk_uptime_seconds gauge',
        `hawk_uptime_seconds ${getUptimeSeconds()}`,
        '# HELP hawk_active_sessions Number of active sessions',
        '# TYPE hawk_active_sessions gauge',
        `hawk_active_sessions ${state.sessions.size}`,
        '# HELP hawk_daily_tokens Total tokens used today',
        '# TYPE hawk_daily_tokens counter',
        `hawk_daily_tokens ${dailyUsage.tokens}`,
        '# HELP hawk_daily_cost_usd Estimated cost today in USD',
        '# TYPE hawk_daily_cost_usd counter',
        `hawk_daily_cost_usd ${dailyUsage.cost.toFixed(4)}`,
        '# HELP hawk_total_messages Total messages across all sessions',
        '# TYPE hawk_total_messages counter',
        `hawk_total_messages ${Array.from(state.sessions.values()).reduce((s, x) => s + x.messageCount, 0)}`,
      ];
      return new Response(lines.join('\n'), {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
      });
    }

    // ── SSE Streaming Endpoint ─────────────────────────────────────────────
    // Server-Sent Events for long-running agent tasks (demands, automations).
    // Inspired by TaxHacker's SSE progress pattern.
    //
    // GET /stream?token=<auth_token>
    // Emits typed events: progress, tool_call, error, done, heartbeat
    if (path === '/stream' && method === 'GET') {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const clientId = crypto.randomUUID();

          function send(event: string, data: unknown) {
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            try {
              controller.enqueue(encoder.encode(payload));
            } catch {
              cleanup();
            }
          }

          // Send initial connection event
          send('connected', { clientId, timestamp: new Date().toISOString() });

          // Create a listener for broadcast events
          const listener = (type: string, payload: unknown) => {
            send(type, payload);
          };

          // Register SSE client
          sseClients.set(clientId, listener);

          // SSE keepalive every 15s (prevents proxy timeouts)
          const keepalive = setInterval(() => {
            send('heartbeat', { timestamp: new Date().toISOString() });
          }, 15_000);

          function cleanup() {
            sseClients.delete(clientId);
            clearInterval(keepalive);
            try {
              controller.close();
            } catch {
              // already closed
            }
          }

          // Handle client disconnect
          req.signal.addEventListener('abort', cleanup, { once: true });
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
      });
    }

      return new Response('Not Found', { status: 404 });
    };

    if (hawkTenant) {
      return withSchema(`tenant_${hawkTenant}`, dispatchRoutes);
    }
    return dispatchRoutes();
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
