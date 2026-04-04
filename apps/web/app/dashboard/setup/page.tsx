'use client';

import { ChatInput } from '@/components/chat/chat-input';
import { MarkdownRenderer } from '@/components/chat/markdown-renderer';
import { parseSseStream } from '@/lib/utils/parse-sse';
import { User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────

interface OnboardingMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface OnboardingPayload {
  name: string;
  birthDate?: string;
  timezone?: string;
  bio?: string;
  goals?: string;
  enabledModules?: string[];
  enabledAgents?: string[];
  checkinMorning?: string;
  checkinEvening?: string;
  weeklyReviewDay?: string;
  weeklyReviewTime?: string;
  farewell?: string;
}

// ── Message bubble components ────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end gap-3 mb-4">
      <div className="max-w-[680px]">
        <div className="flex items-center justify-end gap-2 mb-1">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Você</span>
        </div>
        <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-[var(--radius-lg)] rounded-tr-[var(--radius-sm)] px-4 py-2.5">
          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{content}</p>
        </div>
      </div>
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center">
        <User className="h-3.5 w-3.5 text-[var(--color-accent)]" />
      </div>
    </div>
  );
}

function AssistantBubble({ content }: { content: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-bold text-white">
          HA
        </div>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Hawk</span>
      </div>
      <div className="pl-[42px] max-w-[680px]">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-bold text-white">
        HA
      </div>
      <div className="flex items-center gap-1 px-3 py-2 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)]">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:0ms]" />
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:150ms]" />
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timezone = useRef(
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'America/Sao_Paulo',
  );

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const handleComplete = useCallback(
    async (payload: OnboardingPayload, assistantText: string) => {
      setStreaming(false);
      setCompleting(true);

      // Make sure farewell is shown in the chat
      if (payload.farewell && !assistantText.includes(payload.farewell)) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              role: 'assistant',
              content: assistantText || payload.farewell || '',
            };
          } else {
            updated.push({ role: 'assistant', content: payload.farewell || '' });
          }
          return updated;
        });
      }

      // Brief pause so the user can read the farewell
      await new Promise((resolve) => setTimeout(resolve, 1400));

      try {
        const res = await fetch('/api/setup/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: payload.name,
            birthDate: payload.birthDate || undefined,
            timezone: payload.timezone || timezone.current,
            bio: payload.bio || undefined,
            goals: payload.goals || undefined,
            checkinMorning: payload.checkinMorning || '09:00',
            checkinEvening: payload.checkinEvening || '22:00',
            weeklyReviewDay: payload.weeklyReviewDay || 'sunday',
            weeklyReviewTime: payload.weeklyReviewTime || '20:00',
            enabledModules: payload.enabledModules ?? ['finances', 'health', 'objectives', 'routine'],
            enabledAgents: payload.enabledAgents ?? ['bull', 'wolf', 'owl', 'bee'],
          }),
        });

        const result = (await res.json()) as { error?: string };
        if (!res.ok || result.error) {
          setError(result.error ?? 'Erro ao salvar configuração. Tente novamente.');
          setCompleting(false);
          return;
        }

        router.push('/dashboard');
      } catch {
        setError('Erro de conexão. Verifique sua internet e tente novamente.');
        setCompleting(false);
      }
    },
    [router, timezone],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (streaming || completing) return;

      const isInit = text === '__init__';

      // Append user message to history (skip the init signal)
      const history: OnboardingMessage[] = isInit
        ? [...messages]
        : [...messages, { role: 'user', content: text }];

      if (!isInit) {
        setMessages(history);
        setInputValue('');
      }

      setStreaming(true);
      setError(null);

      // Start streaming assistant response
      let assistantContent = '';
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch('/api/agent/onboarding/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: history.filter((m) => m.role !== 'assistant' || m.content !== ''),
            message: text,
            timezone: timezone.current,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        for await (const event of parseSseStream(response)) {
          if (event.type === 'chunk' && event.content) {
            assistantContent += event.content;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
              return updated;
            });
          } else if (event.type === 'complete' && event.payload) {
            await handleComplete(
              event.payload as unknown as OnboardingPayload,
              assistantContent,
            );
            return;
          } else if (event.type === 'error') {
            throw new Error(event.error ?? 'Agent error');
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError('Algo deu errado. Tente novamente.');
        // Remove the empty assistant message
        setMessages((prev) => prev.filter((m) => m.content !== ''));
      } finally {
        setStreaming(false);
      }
    },
    [streaming, completing, messages, handleComplete],
  );

  // Fire the init message on mount to get the greeting
  useEffect(() => {
    sendMessage('__init__');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - var(--topbar-height, 56px))' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--color-border-subtle)] px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="h-9 w-9 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            HA
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Hawk</p>
            <p className="text-xs text-[var(--color-text-muted)]">Configuração Inicial</p>
          </div>
          {completing && (
            <div className="ml-auto flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <div className="h-2 w-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
              Configurando...
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <UserBubble key={i} content={msg.content} />
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <AssistantBubble key={i} content={msg.content} />
            ),
          )}
          {streaming && messages[messages.length - 1]?.content === '' && <TypingIndicator />}
          {error && (
            <div className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 px-3 py-2 max-w-2xl">
              <p className="text-xs text-[var(--color-danger)]">{error}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-[var(--color-border-subtle)]">
        <div className="max-w-2xl mx-auto">
          <ChatInput
            onSend={sendMessage}
            loading={streaming || completing}
            value={inputValue}
            onChange={setInputValue}
          />
        </div>
      </div>
    </div>
  );
}
