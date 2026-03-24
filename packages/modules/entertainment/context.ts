// Context Engine: Entertainment / Lazer
import { getHobbyStats, listMedia } from './queries';

export async function loadL0(): Promise<string> {
  try {
    const watching = await listMedia(undefined, 'watching');
    if (watching.length === 0) return 'Lazer: sem mídia em andamento.';
    return `Assistindo: ${watching.map((m) => m.title).join(', ')}`;
  } catch (_error) {
    return 'Lazer: indisponível';
  }
}

export async function loadL1(): Promise<string> {
  try {
    const [watching, want, stats] = await Promise.all([
      listMedia(undefined, 'watching'),
      listMedia(undefined, 'want'),
      getHobbyStats(),
    ]);

    const parts: string[] = ['Lazer:'];
    if (watching.length > 0) parts.push(`Assistindo: ${watching.map((m) => m.title).join(', ')}`);
    if (want.length > 0) parts.push(`Lista de espera: ${want.length} items`);
    if (stats.length > 0)
      parts.push(
        `Hobbies ativos: ${stats
          .slice(0, 3)
          .map((s) => s.activity)
          .join(', ')}`,
      );
    return parts.join('\n');
  } catch (_error) {
    return 'Lazer (detalhes): indisponível';
  }
}

export async function loadL2(): Promise<string> {
  try {
    const [watching, want, stats] = await Promise.all([
      listMedia(undefined, 'watching'),
      listMedia(undefined, 'want'),
      getHobbyStats(),
    ]);

    const sections: string[] = [];

    if (watching.length > 0) {
      const lines = watching.map((m) => {
        const plat = m.platform ? ` (${m.platform})` : '';
        return `▶️ ${m.title}${plat}`;
      });
      sections.push(`**Em andamento:**\n${lines.join('\n')}`);
    }

    if (want.length > 0) {
      const preview = want
        .slice(0, 5)
        .map((m) => m.title)
        .join(', ');
      const extra = want.length > 5 ? ` +${want.length - 5}` : '';
      sections.push(`**Lista (${want.length}):** ${preview}${extra}`);
    }

    if (stats.length > 0) {
      const lines = stats.slice(0, 5).map((s) => {
        const dur = s.total_min > 0 ? ` · ${Math.round(s.total_min / 60)}h` : '';
        return `🎯 ${s.activity} — ${s.sessions}x${dur}`;
      });
      sections.push(`**Hobbies (30 dias):**\n${lines.join('\n')}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : 'Lazer: sem dados.';
  } catch (_error) {
    return 'Lazer (histórico): indisponível';
  }
}
