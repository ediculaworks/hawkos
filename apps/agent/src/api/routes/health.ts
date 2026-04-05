import { db } from '@hawk/db';

interface AgentState {
  status: 'online' | 'offline' | 'restarting';
  startedAt: number;
  sessions: Map<string, { channel: string; lastActivity: number; messageCount: number }>;
}

export async function handleHealthRoute(
  req: Request,
  _state: AgentState,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const url = new URL(req.url);
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
    const { tenantManager } = await import('../../tenant-manager.js');
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

export function handleStatusRoute(
  state: AgentState,
  corsHeaders: Record<string, string>,
  getUptimeSeconds: () => number,
  formatUptime: (s: number) => string,
  pendingAutomation: string | null,
  wsClientsSize: number,
): Response {
  return new Response(
    JSON.stringify({
      status: state.status,
      uptime: getUptimeSeconds(),
      uptimeFormatted: formatUptime(getUptimeSeconds()),
      sessions: Array.from(state.sessions.entries()).map(([id, data]) => ({ id, ...data })),
      pendingAutomation,
      wsClients: wsClientsSize,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
