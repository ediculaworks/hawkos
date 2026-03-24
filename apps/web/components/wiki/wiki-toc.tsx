'use client';

import { cn } from '@/lib/utils/cn';
import { useEffect, useState } from 'react';

export type TocHeading = {
  id: string;
  text: string;
  level: number;
};

interface WikiTocProps {
  headings: TocHeading[];
}

export function WikiToc({ headings }: WikiTocProps) {
  const [activeId, setActiveId] = useState<string>('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-observe on headings change
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );

    const headingEls = document.querySelectorAll('h1[id], h2[id], h3[id]');
    for (const el of headingEls) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <div className="sticky top-[var(--space-6)]">
      <p className="mb-[var(--space-2)] text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        Neste artigo
      </p>
      <nav className="flex flex-col gap-[var(--space-0-5)]">
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={cn(
              'block text-[12px] transition-colors hover:text-[var(--color-text-primary)]',
              h.level === 1 && 'font-medium',
              h.level === 2 && 'pl-[var(--space-3)]',
              h.level === 3 && 'pl-[var(--space-5)]',
              activeId === h.id
                ? 'text-[var(--color-accent)] font-medium'
                : 'text-[var(--color-text-muted)]',
            )}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </div>
  );
}
