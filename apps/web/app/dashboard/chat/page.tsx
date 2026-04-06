'use client';

import { ChatEmpty } from '@/components/chat/chat-empty';
import { ChatHeader } from '@/components/chat/chat-header';
import { ChatHistoryPanel } from '@/components/chat/chat-history-panel';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatMessageBubble, TypingIndicator } from '@/components/chat/chat-message';
import { ChatTabs } from '@/components/chat/chat-tabs';
import { MemoryChips } from '@/components/chat/memory-chips';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useChatContext } from '@/lib/agent-chat';
import { AlertCircle, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function ChatPage() {
  return (
    <ErrorBoundary>
      <ChatPageInner />
    </ErrorBoundary>
  );
}

function ChatPageInner() {
  const chat = useChatContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message/typing changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chat.messages, chat.typing]);

  const currentSession = chat.sessions.find((s) => s.id === chat.activeSession);
  const isDiscordSession = currentSession?.channel === 'discord';

  const handleSend = (content: string) => chat.sendMessage(content);
  const handleNewSession = () => chat.createSession();
  const handleSuggest = (text: string) => chat.sendMessage(text);

  const handleCommit = async () => {
    setCommitting(true);
    setCommitResult(null);
    const result = await chat.commitSession();
    setCommitting(false);
    if (result) {
      const n = result.memoriesCreated;
      setCommitResult(
        n > 0 ? `${n} memória${n !== 1 ? 's' : ''} salva${n !== 1 ? 's' : ''}` : 'Sessão arquivada',
      );
      setTimeout(() => setCommitResult(null), 4000);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-var(--topbar-height)-var(--space-12))]">
      {/* Tab bar */}
      <ChatTabs
        openTabs={chat.openTabs}
        sessions={chat.sessions}
        activeSession={chat.activeSession}
        onSelectTab={(id) => chat.selectSession(id)}
        onCloseTab={(id) => chat.closeTab(id)}
        onNewSession={handleNewSession}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col rounded-b-[var(--radius-lg)] border border-t-0 border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
        {/* Header */}
        <ChatHeader
          agent={chat.selectedAgent}
          connected={chat.connected}
          onCommit={chat.activeSession && !chat.loading ? handleCommit : undefined}
          committing={committing}
          commitResult={commitResult}
        />

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
          {chat.messagesLoading ? (
            <div className="space-y-4 py-4">
              <div className="flex justify-end">
                <Skeleton className="h-10 w-48 rounded-2xl" />
              </div>
              <div className="flex justify-start gap-2">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <Skeleton className="h-16 w-64 rounded-2xl" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-10 w-36 rounded-2xl" />
              </div>
              <div className="flex justify-start gap-2">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <Skeleton className="h-24 w-72 rounded-2xl" />
              </div>
            </div>
          ) : chat.messages.length === 0 ? (
            <ChatEmpty onSuggest={handleSuggest} />
          ) : (
            <>
              {chat.messages.map((msg, i) => (
                <ChatMessageBubble
                  key={msg.id ?? `msg-${msg.created_at ?? i}`}
                  message={msg}
                  agent={chat.selectedAgent}
                  isLast={i === chat.messages.length - 1 && msg.role === 'assistant'}
                  onRetry={
                    msg.role === 'assistant' && i === chat.messages.length - 1
                      ? () => {
                          const lastUser = [...chat.messages]
                            .reverse()
                            .find((m) => m.role === 'user');
                          if (lastUser) chat.sendMessage(lastUser.content);
                        }
                      : undefined
                  }
                  onQuickReply={(reply) => chat.sendMessage(reply)}
                />
              ))}
              {chat.typing && <TypingIndicator agent={chat.selectedAgent} />}
            </>
          )}

          {/* Error display */}
          {chat.error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 mb-4">
              <AlertCircle className="h-4 w-4 text-[var(--color-danger)] flex-shrink-0" />
              <p className="text-sm text-[var(--color-danger)]">{chat.error}</p>
              <button
                type="button"
                onClick={chat.clearError}
                className="ml-auto text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
              >
                Fechar
              </button>
            </div>
          )}
        </div>

        {/* Memory chips — shown when agent learns something during conversation */}
        <MemoryChips memories={chat.pendingMemories} onDismiss={chat.dismissMemory} />

        {/* Input */}
        {isDiscordSession ? (
          <div className="flex items-center justify-center gap-2 px-6 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/50">
            <Lock className="h-3 w-3 text-[var(--color-text-muted)]" />
            <span className="text-xs text-[var(--color-text-muted)]">
              Sessão Discord — somente leitura
            </span>
          </div>
        ) : (
          <ChatInput onSend={handleSend} loading={chat.loading} />
        )}
      </div>

      {/* History panel (slide-in from right) */}
      <ChatHistoryPanel
        open={historyOpen}
        sessions={chat.sessions}
        activeSession={chat.activeSession}
        loading={chat.sessionsLoading}
        onClose={() => setHistoryOpen(false)}
        onSelectSession={(id) => chat.selectSession(id)}
        onDeleteSession={(id) => chat.deleteSession(id)}
        onRenameSession={(id, title) => chat.updateSessionTitle(id, title)}
        onNewSession={() => {
          handleNewSession();
          setHistoryOpen(false);
        }}
      />
    </div>
  );
}
