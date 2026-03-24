'use client';

import { agentHeaders, getAgentApiUrl, getAgentWsUrl } from '@/lib/config';
import { useCallback, useEffect, useRef, useState } from 'react';
export interface ChatMessage {
  id?: string;
  session_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  created_at?: string;
  quickReplies?: string[];
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
  agentSpriteFolder?: string;
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

export function useChat() {
  const [_ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, _setActiveSession] = useState<string | null>(() => getStoredSession());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const activeSessionRef = useRef<string | null>(activeSession);
  const selectedAgentRef = useRef<Agent | null>(selectedAgent);
  const streamBufferRef = useRef<string>('');
  const streamFlushTimerRef = useRef<number | null>(null);

  // Keep refs in sync with state
  activeSessionRef.current = activeSession;
  selectedAgentRef.current = selectedAgent;

  const setActiveSession = useCallback((sessionId: string | null) => {
    _setActiveSession(sessionId);
    activeSessionRef.current = sessionId;
    setStoredSession(sessionId);
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`${getAgentApiUrl()}/chat/sessions`, { headers: agentHeaders() });
      const data = await res.json();
      setSessions(data.sessions ?? []);
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
      if (storedSession) {
        socket.send(JSON.stringify({ type: 'chat_join', sessionId: storedSession }));
      }
      loadSessions();
      loadAgents();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chat_joined') {
          setActiveSession(data.sessionId);
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
              },
            ];
          });
          setTyping(false);
          setLoading(false);
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
      } catch (_err) {}
    };

    socket.onclose = () => {
      setConnected(false);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    wsRef.current = socket;
    setWs(socket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveSession, loadSessions]);

  const loadAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents ?? []);
        if (data.agents?.length > 0 && !selectedAgentRef.current) {
          setSelectedAgent(data.agents[0]);
        }
      }
    } catch (_err) {
      try {
        const res = await fetch(`${getAgentApiUrl()}/agents`, { headers: agentHeaders() });
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents ?? []);
          if (data.agents?.length > 0 && !selectedAgentRef.current) {
            setSelectedAgent(data.agents[0]);
          }
        }
      } catch (_err2) {}
    }
  };

  const loadMessages = async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`${getAgentApiUrl()}/chat/sessions/${sessionId}/messages`, {
        headers: agentHeaders(),
      });
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch (_err) {
      setError('Erro ao carregar mensagens');
    } finally {
      setMessagesLoading(false);
    }
  };

  // Creates a session and returns the sessionId (or null on failure)
  const ensureSession = async (agentId?: string): Promise<string | null> => {
    try {
      const body = agentId ? { agentId } : {};
      const res = await fetch(`${getAgentApiUrl()}/chat/sessions`, {
        method: 'POST',
        headers: agentHeaders(),
        body: JSON.stringify(body),
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
        socket.send(JSON.stringify({ type: 'chat_join', sessionId: data.sessionId }));
      }

      setActiveSession(data.sessionId);
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
      sid = await ensureSession(selectedAgentRef.current?.id);
      if (!sid) return;
    }

    setMessages((prev) => [...prev, { session_id: sid, role: 'user', content }]);
    setLoading(true);

    socket.send(
      JSON.stringify({
        type: 'chat_message',
        sessionId: sid,
        content,
      }),
    );
  };

  const createSession = async (agentId?: string) => {
    await ensureSession(agentId);
  };

  const selectSession = (sessionId: string) => {
    setActiveSession(sessionId);
    setError(null);
    loadMessages(sessionId);
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`${getAgentApiUrl()}/chat/sessions/${sessionId}/delete`, {
        method: 'DELETE',
        headers: agentHeaders(),
      });
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: connect manages its own deps
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
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
    messages,
    loading,
    typing,
    error,
    agents,
    selectedAgent,
    setSelectedAgent,
    sendMessage,
    createSession,
    selectSession,
    deleteSession,
    updateSessionTitle,
    clearError,
  };
}
