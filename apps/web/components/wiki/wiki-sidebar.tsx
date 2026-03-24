'use client';

import { cn } from '@/lib/utils/cn';
import { WIKI_NAV } from '@/lib/wiki-nav';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface WikiSidebarProps {
  currentSlug: string;
}

export function WikiSidebar({ currentSlug }: WikiSidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleCategory(cat: string) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <nav className="flex flex-col gap-[var(--space-1)]">
      {WIKI_NAV.map((section) => {
        const isCollapsed = collapsed[section.category] ?? false;
        return (
          <div key={section.category}>
            <button
              type="button"
              onClick={() => toggleCategory(section.category)}
              className="flex w-full items-center justify-between px-[var(--space-2)] py-[var(--space-1)] text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <span>{section.category}</span>
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {!isCollapsed && (
              <div className="flex flex-col gap-[var(--space-0-5)] mb-[var(--space-2)]">
                {section.items.map((item) => {
                  const isActive = item.slug === currentSlug;
                  return (
                    <Link
                      key={item.slug}
                      href={`/dashboard/wiki/${item.slug}`}
                      className={cn(
                        'block rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-1-5)] text-[13px] transition-colors',
                        isActive
                          ? 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)] font-medium'
                          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-1)] hover:text-[var(--color-text-secondary)]',
                      )}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
