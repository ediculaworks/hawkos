'use client';

import type { Agent, ChatMessage } from '@/lib/agent-chat';
import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp, User } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { MarkdownRenderer } from './markdown-renderer';

interface ChatMessageProps {
  message: ChatMessage;
  agent: Agent | null;
  isLast?: boolean;
  onRetry?: () => void;
  onQuickReply?: (reply: string) => void;
}

function ChatMessageInner({ message, agent, isLast, onRetry, onQuickReply }: ChatMessageProps) {
  if (message.role === 'user') {
    return <UserMessage message={message} />;
  }
  return (
    <AssistantMessage
      message={message}
      agent={agent}
      isLast={isLast}
      onRetry={onRetry}
      onQuickReply={onQuickReply}
    />
  );
}

export const ChatMessageBubble = memo(ChatMessageInner, (prev, next) => {
  return prev.message.content === next.message.content && prev.isLast === next.isLast;
});

function UserMessage({ message }: { message: ChatMessage }) {
  const timestamp = message.created_at
    ? new Date(message.created_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="flex justify-end gap-3 mb-4">
      <div className="max-w-[720px]">
        <div className="flex items-center justify-end gap-2 mb-1">
          {timestamp && (
            <span className="text-[10px] text-[var(--color-text-muted)]">{timestamp}</span>
          )}
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">Você</span>
        </div>
        <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-[var(--radius-lg)] rounded-tr-[var(--radius-sm)] px-4 py-2.5">
          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center">
        <User className="h-3.5 w-3.5 text-[var(--color-accent)]" />
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  agent,
  isLast,
  onRetry,
  onQuickReply,
}: {
  message: ChatMessage;
  agent: Agent | null;
  isLast?: boolean;
  onRetry?: () => void;
  onQuickReply?: (reply: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const timestamp = message.created_at
    ? new Date(message.created_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  return (
    <div className="group mb-6">
      {/* Header: avatar + name + timestamp */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-bold text-white">
            {agent ? agent.name.slice(0, 2).toUpperCase() : 'HA'}
          </div>
        </div>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {agent?.name ?? 'Hawk'}
        </span>
        {timestamp && (
          <>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">{timestamp}</span>
          </>
        )}

        {/* Actions (hover) */}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <ActionButton
            icon={copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            onClick={handleCopy}
            title="Copiar"
          />
          {onRetry && (
            <ActionButton
              icon={<RefreshCw className="h-3 w-3" />}
              onClick={onRetry}
              title="Reenviar"
            />
          )}
          <ActionButton icon={<ThumbsUp className="h-3 w-3" />} onClick={() => {}} title="Bom" />
          <ActionButton icon={<ThumbsDown className="h-3 w-3" />} onClick={() => {}} title="Ruim" />
        </div>
      </div>

      {/* Content */}
      <div className="pl-[42px] max-w-[720px]">
        <MarkdownRenderer content={message.content} />

        {/* Quick replies */}
        {isLast && message.quickReplies && message.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => onQuickReply?.(reply)}
                className="px-3 py-1.5 text-xs rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)] hover:text-white hover:border-[var(--color-accent)] transition-all cursor-pointer"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
    >
      {icon}
    </button>
  );
}

export function TypingIndicator({ agent }: { agent: Agent | null }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="flex-shrink-0">
        <div className="h-8 w-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-xs font-bold text-white">
          {agent ? agent.name.slice(0, 2).toUpperCase() : 'HA'}
        </div>
      </div>
      <div className="flex items-center gap-1 px-3 py-2 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)]">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:0ms]" />
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:150ms]" />
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
