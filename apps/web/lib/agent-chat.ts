'use client';

import { agentHeaders, getAgentApiUrl, getAgentWsUrl } from '@/lib/config';

function getTenantSlug(): string | undefined {
  if (typeof window !== 'undefined' && window.__HAWK_TENANT__) {
    return window.__HAWK_TENANT__.slug;
  }
  return undefined;
}
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  id?: string;
  session_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  created_at?: string;
  quickReplies?: string[];
  /** Token usage, model, and duration — set on assistant messages */
  tokensUsed?: number;
  model?: string;
  durationMs?: number;
  /** For tool messages: tool name, args, result, duration */
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
    result: string;
    durationMs?: number;
  };
  /** True while this message is still being streamed */
  streaming?: boolean;
}

export interface ChatSession {
  id: string;
  lastMessage?: string;
  lastActivity?: string;
  agentId?: string;
  agentName?: string;
  agentAvatar?: string;
  title?: string;
  channel?: 'web' | 'discord';
}

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  traits: string[];
  enabled_tools: string[];
  agent_tier: string;
  llm_model: string | null;
  sprite_folder: string | null;
  is_user_facing: boolean;
}

const SESSION_STORAGE_KEY = 'hawk_active_session';
const OPEN_TABS_KEY = 'hawk_open_tabs';
const DELEGATION_KEY = 'hawk_pending_delegation';

function getStoredSession(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

function setStoredSession(sessionId: string | null): void {
  if (typeof window === 'undefined') return;
  if (sessionId) {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

function getStoredTabs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(OPEN_TABS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function setStoredTabs(tabs: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(tabs));
}

export interface PendingMemory {
  id: string;
  content: string;
  memory_type: string;
  module: string | null;
}

export function useChat() {
  const [_ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, _setActiveSession] = useState<string | null>(() => getStoredSession());
  const [openTabs, setOpenTabs] = useState<string[]>(() => getStoredTabs());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hawk is the only agent — loaded once on connect, never changed by user
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [pendingMemories, setPendingMemories] = useState<PendingMemory[]>([]);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const activeSessionRef = useRef<string | null>(activeSession);
  const streamBufferRef = useRef<string>('');
  const streamFlushTimerRef = useRef<number | null>(null);
  // Pending message to auto-send after joining a session (used by agent delegation flow)
  const pendingMessageRef = useRef<string | null>(null);
  // Poll interval ref — used to detect pending LLM response after reconnecting
  const pendingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync with state
  activeSessionRef.current = activeSession;

  const setActiveSession = useCallback((sessionId: string | null) => {
    _setActiveSession(sessionId);
    activeSessionRef.current = sessionId;
    setStoredSession(sessionId);
  }, []);

  // Add a session as an open tab (idempotent)
  const addTab = useCallback((sessionId: string) => {
    setOpenTabs((prev) => {
      if (prev.includes(sessionId)) return prev;
      const next = [sessionId, ...prev];
      setStoredTabs(next);
      return next;
    });
  }, []);

  // Close a tab; switches active session to an adjacent tab if needed
  const closeTab = useCallback(
    (sessionId: string) => {
      setOpenTabs((prev) => {
        const idx = prev.indexOf(sessionId);
        const next = prev.filter((id) => id !== sessionId);
        setStoredTabs(next);

        if (activeSessionRef.current === sessionId) {
          // Select adjacent tab or null
          const nextActive = next[idx] ?? next[idx - 1] ?? null;
          _setActiveSession(nextActive);
          activeSessionRef.current = nextActive;
          setStoredSession(nextActive);
          if (nextActive) {
            // Load messages for the new active session
            setMessagesLoading(true);
            fetch(`${getAgentApiUrl()}/chat/sessions/${nextActive}/messages`, {
              headers: agentHeaders(),
            })
              .then((r) => r.json())
              .then((d) => setMessages((d as { messages?: ChatMessage[] }).messages ?? []))
              .catch(() => {})
              .finally(() => setMessagesLoading(false));
          } else {
            setMessages([]);
          }
        }

        return next;
      });
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`${getAgentApiUrl()}/chat/sessions`, { headers: agentHeaders() });
      const data = await res.json();
      const fetched: ChatSession[] = data.sessions ?? [];
      setSessions(fetched);

      // Validate open tabs against fetched sessions — remove stale IDs
      const validIds = new Set(fetched.map((s) => s.id));
      setOpenTabs((prev) => {
        const cleaned = prev.filter((id) => validIds.has(id));
        if (cleaned.length !== prev.length) setStoredTabs(cleaned);
        return cleaned;
      });
    } catch (_err) {
    } finally {
      setSessionsLoading(false);
      setInitializing(false);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(getAgentWsUrl());

    socket.onopen = () => {
      setConnected(true);
      const storedSession = activeSessionRef.current;

      // Check for pending delegation from agent creation form
      const pendingDelegation = (() => {
        if (typeof window === 'undefined') return null;
        const raw = sessionStorage.getItem(DELEGATION_KEY);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as { sessionId: string; message: string };
        } catch {
          return null;
        }
      })();

      if (pendingDelegation) {
        sessionStorage.removeItem(DELEGATION_KEY);
        setActiveSession(pendingDelegation.sessionId);
        addTab(pendingDelegation.sessionId);
        socket.send(
          JSON.stringify({
            type: 'chat_join',
            tenantSlug: getTenantSlug(),
            sessionId: pendingDelegation.sessionId,
          }),
        );
        // Send the first message once the join completes (handled in chat_joined handler)
        pendingMessageRef.current = pendingDelegation.message;
      } else if (storedSession) {
        socket.send(
          JSON.stringify({
            type: 'chat_join',
            tenantSlug: getTenantSlug(),
            sessionId: storedSession,
          }),
        );
        // Restore messages for the active session on page load
        loadMessages(storedSession);
      }

      loadSessions();
      loadHawk();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chat_joined') {
          setActiveSession(data.sessionId);
          addTab(data.sessionId);
          // Auto-send pending delegation message (from agent creation form)
          const pending = pendingMessageRef.current;
          if (pending) {
            pendingMessageRef.current = null;
            // Defer to next tick so state settles
            setTimeout(() => {
              const sock = wsRef.current;
              if (sock?.readyState === WebSocket.OPEN) {
                setMessages((prev) => [
                  ...prev,
                  { session_id: data.sessionId, role: 'user', content: pending },
                ]);
                setLoading(true);
                sock.send(
                  JSON.stringify({
                    type: 'chat_message',
                    sessionId: data.sessionId,
                    content: pending,
                  }),
                );
              }
            }, 50);
          }
        }

        if (data.type === 'chat_chunk') {
          // Buffer streaming chunks and flush to state periodically (~80ms)
          // to avoid excessive re-renders (50+ per response)
          streamBufferRef.current += data.content;
          if (!streamFlushTimerRef.current) {
            streamFlushTimerRef.current = window.setTimeout(() => {
              const buffered = streamBufferRef.current;
              streamBufferRef.current = '';
              streamFlushTimerRef.current = null;
              if (!buffered) return;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.streaming && last.role === 'assistant') {
                  return [...prev.slice(0, -1), { ...last, content: last.content + buffered }];
                }
                return [
                  ...prev,
                  {
                    session_id: data.sessionId,
                    role: 'assistant',
                    content: buffered,
                    streaming: true,
                  },
                ];
              });
            }, 80);
          }
          setTyping(false);
        }

        if (data.type === 'chat_message') {
          // Flush any remaining stream buffer and clear timer
          if (streamFlushTimerRef.current) {
            clearTimeout(streamFlushTimerRef.current);
            streamFlushTimerRef.current = null;
          }
          streamBufferRef.current = '';

          // Final complete message — replace any streaming placeholder
          setMessages((prev) => {
            const withoutStreaming = prev.filter((m) => !m.streaming);
            return [
              ...withoutStreaming,
              {
                session_id: data.sessionId,
                role: data.role,
                content: data.content,
                created_at: data.timestamp,
                quickReplies: data.quickReplies,
                tokensUsed: data.tokensUsed,
                model: data.model,
                durationMs: data.durationMs,
              },
            ];
          });
          setTyping(false);
          setLoading(false);
          stopPendingPoll(); // response arrived via WS — no need to poll DB
          loadSessions();
        }

        if (data.type === 'chat_tool_call') {
          // Tool call visualization
          setMessages((prev) => [
            ...prev,
            {
              session_id: data.sessionId,
              role: 'tool',
              content: data.result ?? '',
              toolCall: {
                name: data.name,
                args: data.args ?? {},
                result: data.result ?? '',
                durationMs: data.durationMs,
              },
            },
          ]);
        }

        if (data.type === 'chat_typing') {
          setTyping(true);
        }

        if (data.type === 'chat_error') {
          setTyping(false);
          setLoading(false);
          setError(data.error ?? 'Erro ao processar mensagem');
          // Still refresh — session was created even if LLM failed
          loadSessions();
        }

        if (data.type === 'memory:saved') {
          const mem: PendingMemory = {
            id: data.id,
            content: data.content,
            memory_type: data.memory_type,
            module: data.module ?? null,
          };
          setPendingMemories((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === mem.id)) return prev;
            return [...prev, mem];
          });
          // Auto-dismiss after 15s if user doesn't interact
          setTimeout(() => {
            setPendingMemories((prev) => prev.filter((m) => m.id !== mem.id));
          }, 15_000);
        }
      } catch (_err) {}
    };

    socket.onclose = () => {
      setConnected(false);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    wsRef.current = socket;
    setWs(socket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveSession, loadSessions, addTab]);

  // Load only Hawk (orchestrator) for display purposes — user cannot change agent
  const loadHawk = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        const hawk = (data.agents as Agent[]).find((a: Agent) => a.agent_tier === 'orchestrator');
        if (hawk) setSelectedAgent(hawk);
      }
    } catch (_err) {
      try {
        const res = await fetch(`${getAgentApiUrl()}/agents`, { headers: agentHeaders() });
        if (res.ok) {
          const data = await res.json();
          const hawk = (data.agents as Agent[]).find((a: Agent) => a.agent_tier === 'orchestrator');
          if (hawk) setSelectedAgent(hawk);
        }
      } catch (_err2) {}
    }
  };

  const stopPendingPoll = useCallback(() => {
    if (pendingPollRef.current) {
      clearInterval(pendingPollRef.current);
      pendingPollRef.current = null;
    }
  }, []);

  const loadMessages = async (sessionId: string) => {
    stopPendingPoll();
    setMessagesLoading(true);
    try {
      const res = await fetch(`${getAgentApiUrl()}/chat/sessions/${sessionId}/messages`, {
        headers: agentHeaders(),
      });
      const data = await res.json();
      const msgs: ChatMessage[] = data.messages ?? [];
      setMessages(msgs);

      // If the last message is from the user, the LLM may still be processing.
      // Poll DB every 3s until the assistant reply appears (up to 120s).
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg?.role === 'user') {
        setLoading(true);
        let elapsed = 0;
        const pollInterval = 3_000;
        const maxWait = 120_000;
        pendingPollRef.current = setInterval(async () => {
          elapsed += pollInterval;
          if (elapsed >= maxWait) {
            stopPendingPoll();
            setLoading(false);
            return;
          }
          try {
            const r = await fetch(`${getAgentApiUrl()}/chat/sessions/${sessionId}/messages`, {
              headers: agentHeaders(),
            });
            const d = await r.json();
            const fresh: ChatMessage[] = d.messages ?? [];
            const freshLast = fresh[fresh.length - 1];
            if (freshLast?.role === 'assistant') {
              setMessages(fresh);
              setLoading(false);
              stopPendingPoll();
            }
          } catch {
            // non-fatal — keep polling
          }
        }, pollInterval);
      }
    } catch (_err) {
      setError('Erro ao carregar mensagens');
    } finally {
      setMessagesLoading(false);
    }
  };

  // Creates a session and returns the sessionId (or null on failure).
  // No agentId is sent — backend defaults to the Hawk orchestrator.
  const ensureSession = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${getAgentApiUrl()}/chat/sessions`, {
        method: 'POST',
        headers: agentHeaders(),
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Erro ao criar sessão');
        return null;
      }

      const data = (await res.json()) as { sessionId?: string };
      if (!data.sessionId) {
        setError('Sessão criada mas sem ID');
        return null;
      }

      // Notify WebSocket about new session
      const socket = wsRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'chat_join',
            tenantSlug: getTenantSlug(),
            sessionId: data.sessionId,
          }),
        );
      }

      setActiveSession(data.sessionId);
      addTab(data.sessionId);
      setMessages([]);
      setError(null);
      await loadSessions();

      return data.sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar sessão');
      return null;
    }
  };

  const sendMessage = async (content: string) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    // Auto-create session if none active
    let sid = activeSessionRef.current;
    if (!sid) {
      sid = await ensureSession();
      if (!sid) return;
    }

    setMessages((prev) => [...prev, { session_id: sid, role: 'user', content }]);
    setLoading(true);

    socket.send(
      JSON.stringify({
        type: 'chat_message',
        sessionId: sid,
        content,
        tenantSlug: getTenantSlug(),
      }),
    );
  };

  const createSession = async () => {
    await ensureSession();
  };

  const selectSession = (sessionId: string) => {
    setActiveSession(sessionId);
    addTab(sessionId);
    setError(null);
    loadMessages(sessionId);
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`${getAgentApiUrl()}/chat/sessions/${sessionId}/delete`, {
        method: 'DELETE',
        headers: agentHeaders(),
      });
      // Close the tab if open
      closeTab(sessionId);
      if (activeSessionRef.current === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
      loadSessions();
    } catch (_err) {
      setError('Erro ao deletar sessão');
    }
  };

  const updateSessionTitle = async (sessionId: string, title: string) => {
    try {
      await fetch(`${getAgentApiUrl()}/chat/sessions/${sessionId}/title`, {
        method: 'PUT',
        headers: agentHeaders(),
        body: JSON.stringify({ title }),
      });
      loadSessions();
    } catch (_err) {
      setError('Erro ao renomear sessão');
    }
  };

  const clearError = () => setError(null);

  const dismissMemory = (id: string) => {
    setPendingMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const commitSession = async (): Promise<{ memoriesCreated: number } | null> => {
    const sid = activeSessionRef.current;
    if (!sid) return null;
    try {
      const res = await fetch(`${getAgentApiUrl()}/chat/sessions/${sid}/commit`, {
        method: 'POST',
        headers: agentHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { memoriesCreated: number };
    } catch (_err) {
      setError('Erro ao salvar sessão');
      return null;
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: connect manages its own deps
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopPendingPoll();
      wsRef.current?.close();
    };
  }, []);

  return {
    connected,
    initializing,
    sessionsLoading,
    messagesLoading,
    sessions,
    activeSession,
    openTabs,
    messages,
    loading,
    typing,
    error,
    selectedAgent, // always Hawk — read-only, loaded on connect
    pendingMemories,
    sendMessage,
    createSession,
    selectSession,
    addTab,
    closeTab,
    deleteSession,
    updateSessionTitle,
    clearError,
    dismissMemory,
    commitSession,
  };
}

// ── Persistent chat context (lives in DashboardLayout, survives page navigation) ──

export type ChatContextValue = ReturnType<typeof useChat>;

export const ChatContext = createContext<ChatContextValue>(null!);

/** Use inside any dashboard page — returns the shared chat state that persists across navigation. */
export function useChatContext(): ChatContextValue {
  return useContext(ChatContext);
}
