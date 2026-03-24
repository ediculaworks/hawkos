import { getMemoryStats, getTopMemories } from './queries';

export async function loadL0(): Promise<string> {
  try {
    const stats = await getMemoryStats();
    const lines = ['## Memória', `- ${stats.total} memórias (${stats.pending_count} pendentes)`];
    return lines.join('\n');
  } catch {
    return '## Memória (indisponível)';
  }
}

export async function loadL1(): Promise<string> {
  try {
    const memories = await getTopMemories(10);
    if (memories.length === 0) return '## Memória\nSem memórias salvas.';

    const lines = [
      '## Memórias Relevantes',
      ...memories.map((m) => `- [${m.category}] ${m.content}${m.module ? ` (${m.module})` : ''}`),
    ];
    return lines.join('\n');
  } catch {
    return '## Memória (indisponível)';
  }
}

export async function loadL2(_query?: string): Promise<string> {
  try {
    const memories = await getTopMemories(20);
    const lines = [
      '## Memórias Detalhadas',
      ...memories.map(
        (m) =>
          `- [${m.category}|${m.importance}/10] ${m.content}${m.tags.length > 0 ? ` #${m.tags.join(' #')}` : ''}${m.module ? ` (${m.module})` : ''}`,
      ),
    ];
    return lines.join('\n');
  } catch {
    return '## Memórias (indisponível)';
  }
}
