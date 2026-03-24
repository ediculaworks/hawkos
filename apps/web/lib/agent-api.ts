'use client';

import { agentHeaders, getAgentApiUrl, getAgentWsUrl } from '@/lib/config';
import { useCallback, useEffect, useRef, useState } from 'react';
export interface AgentStatus {
  status: 'online' | 'offline' | 'restarting';
  uptime: number;
  uptimeFormatted: string;
  sessions: AgentSession[];
  pendingAutomation: string | null;
  wsClients: number;
}

export interface AgentSession {
  id: string;
  channel: string;
  lastActivity: number;
  messageCount: number;
  uptime: number;
}

export interface Automation {
  name: string;
  description: string;
  cron: string;
  category: string;
  nextRun: string;
  nextRunFormatted: string;
}

export interface ActivityLog {
  id: string;
  event_type: string;
  module: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useAgentWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getAgentWsUrl());

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);

        if (data.type === 'connected' || data.type === 'heartbeat') {
          setStatus({
            status: data.status || 'online',
            uptime: data.uptime || 0,
            uptimeFormatted: formatUptime(data.uptime || 0),
            sessions: data.sessions || [],
            pendingAutomation: data.pendingAutomation || null,
            wsClients: data.wsClients || 0,
          });
        }
      } catch (_err) {}
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
      reconnectAttempts.current++;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = (_err) => {};

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const trigger = useCallback(
    (automation: string) => {
      return send({ type: 'trigger', automation });
    },
    [send],
  );

  const killSession = useCallback(
    (sessionId: string) => {
      return send({ type: 'kill_session', sessionId });
    },
    [send],
  );

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    status,
    connected,
    lastMessage,
    send,
    trigger,
    killSession,
    reconnect: connect,
  };
}

export async function fetchAgentStatus(): Promise<AgentStatus | null> {
  try {
    const res = await fetch(`${getAgentApiUrl()}/status`, { headers: agentHeaders() });
    if (!res.ok) return null;
    return res.json();
  } catch (_err) {
    return null;
  }
}

export async function fetchAgentSessions(): Promise<AgentSession[]> {
  try {
    const res = await fetch(`${getAgentApiUrl()}/chat/sessions`, { headers: agentHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch (_err) {
    return [];
  }
}

export async function fetchAutomations(): Promise<Automation[]> {
  try {
    const res = await fetch(`${getAgentApiUrl()}/automations`, { headers: agentHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.automations || [];
  } catch (_err) {
    return [];
  }
}

export interface LogsFilter {
  limit?: number;
  offset?: number;
  type?: string;
  module?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface LogsResponse {
  logs: ActivityLog[];
  total: number;
}

export async function fetchActivityLogs(filters: LogsFilter = {}): Promise<LogsResponse> {
  try {
    const params = new URLSearchParams();
    params.set('limit', String(filters.limit ?? 50));
    if (filters.offset) params.set('offset', String(filters.offset));
    if (filters.type) params.set('type', filters.type);
    if (filters.module) params.set('module', filters.module);
    if (filters.search) params.set('search', filters.search);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    const res = await fetch(`${getAgentApiUrl()}/logs?${params}`, { headers: agentHeaders() });
    if (!res.ok) return { logs: [], total: 0 };
    const data = await res.json();
    return { logs: data.logs ?? [], total: data.total ?? 0 };
  } catch (_err) {
    return { logs: [], total: 0 };
  }
}

export async function triggerAutomation(name: string): Promise<boolean> {
  try {
    const res = await fetch(`${getAgentApiUrl()}/automations/${name}/trigger`, {
      method: 'POST',
      headers: agentHeaders(),
    });
    return res.ok;
  } catch (_err) {
    return false;
  }
}

export async function killSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${getAgentApiUrl()}/sessions/${sessionId}/kill`, {
      method: 'POST',
      headers: agentHeaders(),
    });
    return res.ok;
  } catch (_err) {
    return false;
  }
}

export async function deleteChatSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${getAgentApiUrl()}/chat/sessions/${sessionId}/delete`, {
      method: 'DELETE',
      headers: agentHeaders(),
    });
    return res.ok;
  } catch (_err) {
    return false;
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
