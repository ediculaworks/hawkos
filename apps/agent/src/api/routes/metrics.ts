import { metrics } from '../../metrics.js';

interface AgentState {
  sessions: Map<string, { channel: string; lastActivity: number; messageCount: number }>;
}

export async function handleMetricsRoute(
  path: string,
  method: string,
  corsHeaders: Record<string, string>,
  state: AgentState,
  getUptimeSeconds: () => number,
): Promise<Response | null> {
  if (path !== '/metrics' || method !== 'GET') return null;

  // Sync gauges from live state before serializing
  metrics.setGauge('hawk_active_sessions', state.sessions.size);

  // Keep uptime in-sync (simple gauge not tracked by pipeline)
  metrics.setGauge('hawk_uptime_seconds', getUptimeSeconds());

  const body = metrics.serialize();

  return new Response(body, {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
  });
}
