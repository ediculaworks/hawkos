// Context Engine: Social / Presença Digital
import { getPostStats, listPosts } from './queries';

export async function loadL0(): Promise<string> {
  try {
    const [ideas, drafts] = await Promise.all([
      listPosts(undefined, 'idea'),
      listPosts(undefined, 'draft'),
    ]);
    const total = ideas.length + drafts.length;
    if (total === 0) return 'Social: sem posts pendentes.';
    return `Social: ${total} post(s) pendente(s) (${ideas.length} ideias, ${drafts.length} rascunhos).`;
  } catch (_error) {
    return 'Social: indisponível';
  }
}

export async function loadL1(): Promise<string> {
  try {
    const stats = await getPostStats();
    if (stats.length === 0) return 'Social: sem atividade registrada.';

    const parts = stats.map((s) => `${s.platform}: ${s.ideas}💡 ${s.drafts}📝 ${s.published}✅`);
    return `Social:\n${parts.join('\n')}`;
  } catch (_error) {
    return 'Social (detalhes): indisponível';
  }
}

export async function loadL2(): Promise<string> {
  try {
    const [ideas, drafts, stats] = await Promise.all([
      listPosts(undefined, 'idea'),
      listPosts(undefined, 'draft'),
      getPostStats(),
    ]);

    const sections: string[] = [];

    if (drafts.length > 0) {
      const lines = drafts.slice(0, 3).map((p) => {
        const preview = p.content?.slice(0, 60) ?? '—';
        return `📝 [${p.platform}] ${preview}`;
      });
      sections.push(`**Rascunhos (${drafts.length}):**\n${lines.join('\n')}`);
    }

    if (ideas.length > 0) {
      const lines = ideas.slice(0, 3).map((p) => {
        const preview = p.content?.slice(0, 50) ?? '—';
        return `💡 [${p.platform}] ${preview}`;
      });
      sections.push(`**Ideias (${ideas.length}):**\n${lines.join('\n')}`);
    }

    if (stats.length > 0) {
      const lines = stats.map((s) => `• ${s.platform}: ${s.published} publicados`);
      sections.push(`**Histórico:**\n${lines.join('\n')}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : 'Social: sem dados.';
  } catch (_error) {
    return 'Social (histórico): indisponível';
  }
}
