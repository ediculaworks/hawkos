import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, withSchema } from '@hawk/db';
import { handleAdminRoute } from './routes/admin.js';
import { handleAgentsRoute } from './routes/agents.js';
import { handleAutomationsRoute } from './routes/automations.js';
import { handleChatRoute } from './routes/chat.js';
import { handleErrorsRoute } from './routes/errors.js';
import { handleHealthRoute, handleStatusRoute } from './routes/health.js';
import { handleLogsRoute } from './routes/logs.js';
import { handleMetricsRoute } from './routes/metrics.js';
import { handleOnboardingRoute } from './routes/onboarding.js';
import { handleSessionsRoute } from './routes/sessions.js';
import { handleSettingsRoute } from './routes/settings.js';
import { handleStreamRoute } from './routes/stream.js';
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
  console.log('[ws] received:', type, typeof sessionId === 'string' ? sessionId.slice(0, 8) : '?');

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

    // Resolve tenant schema for this WebSocket session.
    // Falls back to tenantSlug in the message payload (sent by client as defensive measure).
    const wsTenantSlug =
      state.sessionTenants.get(sid) ??
      (typeof data.tenantSlug === 'string' ? data.tenantSlug : undefined);
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
      console.error(
        '[ws-chat] error:',
        err instanceof Error ? err.message : err,
        'schema:',
        wsSchemaName,
      );
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
      handleWebMessage(
        sessionId,
        message,
        onChunk,
        tenantCtx?.credentials?.openrouterConfig?.api_key,
      ),
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
      return handleHealthRoute(req, state, corsHeaders);
    }

    // All other endpoints require auth
    const authError = requireAuth(req);
    if (authError) return authError;

    // Wrap all authenticated HTTP routes in the correct tenant schema context.
    // The X-Hawk-Tenant header is forwarded by the Next.js proxy.
    const hawkTenant = req.headers.get('X-Hawk-Tenant');
    const dispatchRoutes = async (): Promise<Response> => {
      // ── Status ────────────────────────────────────────────────────
      if (path === '/status' && method === 'GET') {
        return handleStatusRoute(
          state,
          corsHeaders,
          getUptimeSeconds,
          formatUptime,
          state.pendingAutomation,
          state.wsClients.size,
        );
      }

      // ── Settings ──────────────────────────────────────────────────
      const settingsResponse = await handleSettingsRoute(
        path,
        method,
        req,
        corsHeaders,
        requireSupabase,
      );
      if (settingsResponse) return settingsResponse;

      // ── Admin (tenant management + logs/stream) ───────────────────
      const { startTenantServices } = await import('../index.js');
      const adminResponse = await handleAdminRoute(
        path,
        method,
        req,
        url,
        corsHeaders,
        startTenantServices,
      );
      if (adminResponse) return adminResponse;

      // ── Automations ───────────────────────────────────────────────
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

      // ── Onboarding chat ───────────────────────────────────────────
      if (path === '/onboarding/chat') return handleOnboardingRoute(req, corsHeaders);

      // ── Chat ──────────────────────────────────────────────────────
      const chatResponse = await handleChatRoute(
        path,
        method,
        req,
        url,
        corsHeaders,
        requireSupabase,
      );
      if (chatResponse) return chatResponse;

      // ── Logs ──────────────────────────────────────────────────────
      const logsResponse = await handleLogsRoute(
        path,
        method,
        req,
        url,
        corsHeaders,
        requireSupabase,
      );
      if (logsResponse) return logsResponse;

      // ── Workspace ─────────────────────────────────────────────────
      const workspaceResponse = await handleWorkspaceRoute(
        path,
        method,
        req,
        corsHeaders,
        WORKSPACE_DIR,
      );
      if (workspaceResponse) return workspaceResponse;

      // ── Agents ────────────────────────────────────────────────────
      const agentsResponse = await handleAgentsRoute(
        path,
        method,
        req,
        url,
        corsHeaders,
        requireSupabase,
      );
      if (agentsResponse) return agentsResponse;

      // ── Sessions (demands triage, kill session, message deliver) ──
      const sessionsResponse = await handleSessionsRoute(
        path,
        method,
        req,
        corsHeaders,
        requireSupabase,
        broadcast,
        state.sessions,
        removeSession,
      );
      if (sessionsResponse) return sessionsResponse;

      // ── Client error reporting ────────────────────────────────────
      const errorsResponse = await handleErrorsRoute(path, method, req, corsHeaders, logActivity);
      if (errorsResponse) return errorsResponse;

      // ── Metrics ───────────────────────────────────────────────────
      const metricsResponse = await handleMetricsRoute(
        path,
        method,
        corsHeaders,
        state,
        getUptimeSeconds,
      );
      if (metricsResponse) return metricsResponse;

      // ── SSE Stream ────────────────────────────────────────────────
      const streamResponse = handleStreamRoute(path, method, req, corsHeaders, sseClients);
      if (streamResponse) return streamResponse;

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
