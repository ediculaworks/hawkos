// ── Agent API Configuration ─────────────────────────────────────────────────
// Multi-tenant: reads from window.__HAWK_TENANT__ (injected by layout.tsx).
// Single-tenant fallback: reads from NEXT_PUBLIC_* env vars.

function getTenantConfig() {
  if (typeof window !== 'undefined' && window.__HAWK_TENANT__) {
    const t = window.__HAWK_TENANT__;
    const host = window.location.hostname;
    return {
      apiUrl: `http://${host}:${t.agentApiPort}`,
      wsUrl: `ws://${host}:${t.agentApiPort}/ws`,
      token: t.agentApiSecret,
    };
  }
  return {
    apiUrl: process.env.NEXT_PUBLIC_AGENT_API_URL ?? 'http://localhost:3001',
    wsUrl: process.env.NEXT_PUBLIC_AGENT_WS_URL ?? 'ws://localhost:3001/ws',
    token: process.env.NEXT_PUBLIC_AGENT_API_TOKEN ?? '',
  };
}

export function getAgentApiUrl(): string {
  return getTenantConfig().apiUrl;
}

export function getAgentWsUrl(): string {
  const { wsUrl } = getTenantConfig();
  const wsToken = process.env.NEXT_PUBLIC_AGENT_WS_TOKEN ?? '';
  return wsToken ? `${wsUrl}?token=${wsToken}` : wsUrl;
}

export function agentHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const { token } = getTenantConfig();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
