import { WikiArticle } from './wiki-article';
import { WikiNavFooter } from './wiki-nav-footer';
import { WikiSidebar } from './wiki-sidebar';
import type { TocHeading } from './wiki-toc';
import { WikiToc } from './wiki-toc';

interface WikiLayoutProps {
  content: string;
  currentSlug: string;
  headings: TocHeading[];
}

export function WikiLayout({ content, currentSlug, headings }: WikiLayoutProps) {
  return (
    // Negative margin cancels out the dashboard layout's p-[var(--space-6)] padding
    <div className="-m-[var(--space-6)] flex min-h-[calc(100vh-var(--topbar-height))] bg-[var(--color-surface-0)]">
      {/* Left sidebar — wiki navigation */}
      <aside className="hidden lg:flex w-[220px] flex-shrink-0 border-r border-[var(--color-border-subtle)]">
        <div className="sticky top-[var(--topbar-height)] h-[calc(100vh-var(--topbar-height))] w-full overflow-y-auto py-[var(--space-6)] px-[var(--space-3)]">
          <div className="mb-[var(--space-4)] px-[var(--space-2)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
              Wiki
            </p>
          </div>
          <WikiSidebar currentSlug={currentSlug} />
        </div>
      </aside>

      {/* Main article */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-[var(--space-8)] py-[var(--space-8)]">
          <WikiArticle content={content} />
          <WikiNavFooter currentSlug={currentSlug} />
        </div>
      </main>

      {/* Right TOC */}
      <aside className="hidden xl:flex w-[200px] flex-shrink-0">
        <div className="sticky top-[var(--topbar-height)] h-[calc(100vh-var(--topbar-height))] w-full overflow-y-auto py-[var(--space-8)] pr-[var(--space-6)]">
          <WikiToc headings={headings} />
        </div>
      </aside>
    </div>
  );
}
