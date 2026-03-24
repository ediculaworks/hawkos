'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

// Detect callout type from the first text node inside a blockquote
function detectCallout(children: React.ReactNode): 'leigo' | 'tip' | 'warning' | null {
  const firstPara = React.Children.toArray(children)[0];
  if (!React.isValidElement(firstPara)) return null;
  const paraChildren = React.Children.toArray(
    (firstPara.props as { children?: React.ReactNode }).children,
  );
  const firstNode = paraChildren[0];
  const firstText = typeof firstNode === 'string' ? firstNode : '';
  if (firstText.startsWith('🧩')) return 'leigo';
  if (firstText.startsWith('💡')) return 'tip';
  if (firstText.startsWith('⚠️')) return 'warning';
  return null;
}

interface WikiArticleProps {
  content: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function WikiArticle({ content }: WikiArticleProps) {
  return (
    <div className="wiki-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children }) => {
            const text = String(children);
            const id = slugify(text);
            return (
              <h1 id={id} className="wiki-h1">
                {children}
              </h1>
            );
          },
          h2: ({ children }) => {
            const text = String(children);
            const id = slugify(text);
            return (
              <h2 id={id} className="wiki-h2">
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const text = String(children);
            const id = slugify(text);
            return (
              <h3 id={id} className="wiki-h3">
                {children}
              </h3>
            );
          },
          p: ({ children }) => <p className="wiki-p">{children}</p>,
          ul: ({ children }) => <ul className="wiki-ul">{children}</ul>,
          ol: ({ children }) => <ol className="wiki-ol">{children}</ol>,
          li: ({ children }) => <li className="wiki-li">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="wiki-a"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => {
            const callout = detectCallout(children);
            if (callout) {
              return <div className={`wiki-callout wiki-callout-${callout}`}>{children}</div>;
            }
            return <blockquote className="wiki-blockquote">{children}</blockquote>;
          },
          code: ({ children, className }) => {
            const text = String(children);
            const lang = className?.replace('language-', '');
            // Block code: has a language annotation OR content spans multiple lines
            const isBlock = !!lang || text.includes('\n');
            if (isBlock) {
              return (
                <div className="wiki-code-block">
                  {lang && <div className="wiki-code-lang">{lang}</div>}
                  <pre>
                    <code>{children}</code>
                  </pre>
                </div>
              );
            }
            return <code className="wiki-inline-code">{children}</code>;
          },
          // Strip the outer <pre> — our code renderer handles block wrapping
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="wiki-table-wrapper">
              <table className="wiki-table">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="wiki-thead">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="wiki-tr">{children}</tr>,
          th: ({ children }) => <th className="wiki-th">{children}</th>,
          td: ({ children }) => <td className="wiki-td">{children}</td>,
          hr: () => <hr className="wiki-hr" />,
          strong: ({ children }) => <strong className="wiki-strong">{children}</strong>,
          em: ({ children }) => <em className="wiki-em">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
