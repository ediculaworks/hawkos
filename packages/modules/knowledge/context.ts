import { db } from '@hawk/db';
// Context Engine: Knowledge / Second Brain
import { listBooks, listRecentNotes } from './queries';

export async function loadL0(): Promise<string> {
  try {
    const [reading, unread] = await Promise.all([
      listBooks('reading'),
      db
        .from('knowledge_notes')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false)
        .eq('is_archived', false),
    ]);

    const parts: string[] = [];
    if (reading.length > 0) parts.push(`Lendo: ${reading.map((b) => b.title).join(', ')}`);
    if ((unread.count ?? 0) > 0) parts.push(`${unread.count} bookmarks não lidos`);
    return parts.length > 0 ? parts.join('. ') : 'Conhecimento: sem dados relevantes.';
  } catch (_error) {
    return 'Conhecimento: indisponível';
  }
}

export async function loadL1(): Promise<string> {
  try {
    const [notes, reading, completed] = await Promise.all([
      listRecentNotes(5),
      listBooks('reading'),
      listBooks('completed'),
    ]);
    const parts: string[] = ['Conhecimento:'];
    if (reading.length > 0) parts.push(`Lendo: ${reading.map((b) => b.title).join(', ')}`);
    if (completed.length > 0) parts.push(`Lidos: ${completed.length} livros`);
    if (notes.length > 0) parts.push(`Notas recentes: ${notes.length}`);
    return parts.join('\n');
  } catch (_error) {
    return 'Conhecimento (detalhes): indisponível';
  }
}

export async function loadL2(): Promise<string> {
  try {
    const [notes, books] = await Promise.all([listRecentNotes(10), listBooks()]);
    const sections: string[] = [];

    if (notes.length > 0) {
      const lines = notes.map((n) => {
        const title = n.title ?? `${n.content.slice(0, 50)}...`;
        const date = new Date(n.created_at).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        });
        return `• [${n.type}] ${date}: ${title}`;
      });
      sections.push(`**Notas recentes:**\n${lines.join('\n')}`);
    }

    if (books.length > 0) {
      const reading = books.filter((b) => b.status === 'reading');
      const wantToRead = books.filter((b) => b.status === 'want_to_read');
      if (reading.length > 0) sections.push(`**Lendo:** ${reading.map((b) => b.title).join(', ')}`);
      if (wantToRead.length > 0)
        sections.push(
          `**Quer ler (${wantToRead.length}):** ${wantToRead
            .slice(0, 5)
            .map((b) => b.title)
            .join(', ')}`,
        );
    }

    return sections.length > 0 ? sections.join('\n\n') : 'Conhecimento: sem dados.';
  } catch (_error) {
    return 'Conhecimento (histórico): indisponível';
  }
}
