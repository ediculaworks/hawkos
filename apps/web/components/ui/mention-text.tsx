'use client';

import { BookMarked, BookOpen, Brain, Target, User, Wallet } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

const TYPE_CONFIG: Record<
  string,
  { icon: typeof User; color: string; href: (id: string) => string }
> = {
  person: { icon: User, color: 'var(--color-mod-people)', href: () => '/dashboard/people' },
  objective: {
    icon: Target,
    color: 'var(--color-mod-objectives)',
    href: () => '/dashboard/objectives',
  },
  task: { icon: Target, color: 'var(--color-mod-objectives)', href: () => '/dashboard/objectives' },
  account: { icon: Wallet, color: 'var(--color-mod-finances)', href: () => '/dashboard/finances' },
  note: { icon: BookOpen, color: 'var(--color-mod-knowledge)', href: () => '/dashboard/memory' },
  book: {
    icon: BookMarked,
    color: 'var(--color-mod-knowledge)',
    href: () => '/dashboard/memory',
  },
  memory: { icon: Brain, color: 'var(--color-accent)', href: () => '/dashboard/memory' },
};

// Pattern: @[type:label](id)
const MENTION_REGEX = /@\[(\w+):([^\]]+)\]\(([^)]+)\)/g;

type Props = {
  text: string;
};

export function MentionText({ text }: Props) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_REGEX)) {
    const [full, type, label, id] = match;
    const startIdx = match.index;

    // Text before mention
    if (startIdx > lastIndex) {
      parts.push(text.slice(lastIndex, startIdx));
    }

    const config = TYPE_CONFIG[type ?? ''];
    const Icon = config?.icon ?? User;

    parts.push(
      <Link
        key={`${id}-${startIdx}`}
        href={config?.href(id ?? '') ?? '#'}
        className="inline-flex items-center gap-0.5 px-1 py-0 rounded-[var(--radius-sm)] text-xs font-medium transition-colors hover:opacity-80"
        style={{
          color: config?.color ?? 'var(--color-accent)',
          background: `${config?.color ?? 'var(--color-accent)'}15`,
        }}
      >
        <Icon className="h-3 w-3" />
        {label}
      </Link>,
    );

    lastIndex = startIdx + (full?.length ?? 0);
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className="whitespace-pre-wrap">{parts.length > 0 ? parts : text}</span>;
}
