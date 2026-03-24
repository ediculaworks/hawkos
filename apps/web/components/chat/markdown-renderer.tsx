'use client';

import { Check, Copy } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace('language-', '') ?? '';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative group/code my-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--color-surface-3)] border-b border-[var(--color-border-subtle)]">
        <span className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copiado
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copiar
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 bg-[var(--color-surface-0)] text-[0.8125rem] leading-relaxed">
        <code className="font-mono text-[var(--color-text-primary)]">{code}</code>
      </pre>
    </div>
  );
}

const components = {
  code({
    className,
    children,
    ...props
  }: { className?: string; children?: React.ReactNode; node?: unknown }) {
    const isBlock = className?.startsWith('language-') || String(children).includes('\n');
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return (
      <code
        className="bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded-[var(--radius-sm)] font-mono text-[0.8125rem] text-[var(--color-accent)]"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre({ children }: { children?: React.ReactNode }) {
    // pre is handled by the code component for blocks
    return <>{children}</>;
  },
  table({ children }: { children?: React.ReactNode }) {
    return (
      <div className="overflow-x-auto my-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    );
  },
  thead({ children }: { children?: React.ReactNode }) {
    return <thead className="bg-[var(--color-surface-3)]">{children}</thead>;
  },
  th({ children }: { children?: React.ReactNode }) {
    return (
      <th className="text-left px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border-subtle)]">
        {children}
      </th>
    );
  },
  td({ children }: { children?: React.ReactNode }) {
    return (
      <td className="px-3 py-2 text-sm text-[var(--color-text-primary)] border-b border-[var(--color-border-subtle)]">
        {children}
      </td>
    );
  },
  tr({ children }: { children?: React.ReactNode }) {
    return <tr className="even:bg-[var(--color-surface-2)]">{children}</tr>;
  },
  blockquote({ children }: { children?: React.ReactNode }) {
    return (
      <blockquote className="border-l-2 border-[var(--color-accent)] pl-4 my-3 text-[var(--color-text-muted)] italic">
        {children}
      </blockquote>
    );
  },
  a({ href, children }: { href?: string; children?: React.ReactNode }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--color-accent)] hover:underline"
      >
        {children}
      </a>
    );
  },
  ul({ children }: { children?: React.ReactNode }) {
    return <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>;
  },
  ol({ children }: { children?: React.ReactNode }) {
    return <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>;
  },
  h1({ children }: { children?: React.ReactNode }) {
    return (
      <h1 className="text-lg font-semibold mt-4 mb-2 text-[var(--color-text-primary)]">
        {children}
      </h1>
    );
  },
  h2({ children }: { children?: React.ReactNode }) {
    return (
      <h2 className="text-base font-semibold mt-3 mb-2 text-[var(--color-text-primary)]">
        {children}
      </h2>
    );
  },
  h3({ children }: { children?: React.ReactNode }) {
    return (
      <h3 className="text-sm font-semibold mt-3 mb-1 text-[var(--color-text-primary)]">
        {children}
      </h3>
    );
  },
  hr() {
    return <hr className="border-t border-[var(--color-border)] my-4" />;
  },
  p({ children }: { children?: React.ReactNode }) {
    return <p className="my-1.5 leading-relaxed">{children}</p>;
  },
};

function MarkdownRendererInner({ content }: { content: string }) {
  return (
    <div className="prose-chat text-sm text-[var(--color-text-primary)]">
      <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}

export const MarkdownRenderer = memo(
  MarkdownRendererInner,
  (prev, next) => prev.content === next.content,
);
