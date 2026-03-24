import fs from 'node:fs';
import path from 'node:path';
import { WikiLayout } from '@/components/wiki/wiki-layout';
import type { TocHeading } from '@/components/wiki/wiki-toc';
import { notFound } from 'next/navigation';

interface WikiPageProps {
  params: Promise<{ slug?: string[] }>;
}

function extractHeadings(markdown: string): TocHeading[] {
  const lines = markdown.split('\n');
  const headings: TocHeading[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1]?.length;
      const text = match[2]?.trim();
      if (text && level != null) {
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        headings.push({ id, text, level });
      }
    }
  }

  return headings;
}

export default async function WikiPage({ params }: WikiPageProps) {
  const { slug: slugParts } = await params;
  const slug = slugParts?.join('/') ?? 'visao-geral';

  const filePath = path.join(process.cwd(), 'content', 'wiki', `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    notFound();
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const headings = extractHeadings(content);

  return <WikiLayout content={content} currentSlug={slug} headings={headings} />;
}

export function generateStaticParams() {
  return [];
}
