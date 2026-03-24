// Context Engine: Journal / Diário
// L0: entry de hoje (mood, energy, preview)
// L1: últimos 7 dias com médias
// L2: últimas 30 entries completas

import { getJournalStats, getTodayEntry, listRecentEntries } from './queries';

/**
 * L0 — Entry de hoje: mood, energia e preview do conteúdo
 */
export async function loadL0(): Promise<string> {
  try {
    const entry = await getTodayEntry();
    if (!entry) return 'Diário: sem registro hoje.';

    const parts: string[] = ['Diário hoje:'];
    if (entry.mood) parts.push(`Humor ${entry.mood}/10`);
    if (entry.energy) parts.push(`Energia ${entry.energy}/10`);

    const preview = entry.content.slice(0, 120) + (entry.content.length > 120 ? '...' : '');
    parts.push(`"${preview}"`);

    return parts.join(' · ');
  } catch (_error) {
    return 'Diário: indisponível.';
  }
}

/**
 * L1 — Últimos 7 dias: média de humor/energia + streak
 */
export async function loadL1(): Promise<string> {
  try {
    const [entries, stats] = await Promise.all([listRecentEntries(7, 'daily'), getJournalStats()]);

    if (entries.length === 0) return 'Diário: sem entradas na última semana.';

    const lines: string[] = [`Diário — semana (${entries.length} entradas):`];

    if (stats.avg_mood) lines.push(`Humor médio: ${stats.avg_mood}/10`);
    if (stats.avg_energy) lines.push(`Energia média: ${stats.avg_energy}/10`);
    if (stats.current_streak > 1) lines.push(`Streak: ${stats.current_streak} dias`);

    const recent = entries.slice(0, 3).map((e) => {
      const date = new Date(e.date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      });
      const moodStr = e.mood ? ` (😊${e.mood})` : '';
      return `${date}${moodStr}: ${e.content.slice(0, 60)}...`;
    });

    lines.push('Últimas entradas:', ...recent);

    return lines.join('\n');
  } catch (_error) {
    return 'Diário: indisponível.';
  }
}

/**
 * L2 — Histórico completo: últimas 30 entries com conteúdo integral
 */
export async function loadL2(): Promise<string> {
  try {
    const [entries, stats] = await Promise.all([listRecentEntries(30), getJournalStats()]);

    if (entries.length === 0) return 'Diário: nenhuma entrada registrada.';

    const statsLine = [
      `Total: ${stats.total_entries} entradas`,
      stats.avg_mood ? `Humor médio: ${stats.avg_mood}/10` : null,
      stats.avg_energy ? `Energia média: ${stats.avg_energy}/10` : null,
      `Streak atual: ${stats.current_streak} dias`,
    ]
      .filter(Boolean)
      .join(' · ');

    const entryLines = entries.map((e) => {
      const date = new Date(e.date).toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      });
      const meta: string[] = [];
      if (e.mood) meta.push(`😊${e.mood}`);
      if (e.energy) meta.push(`⚡${e.energy}`);
      const metaStr = meta.length > 0 ? ` [${meta.join(' ')}]` : '';
      return `${date}${metaStr}: ${e.content}`;
    });

    return `Diário — histórico (${statsLine}):\n\n${entryLines.join('\n')}`;
  } catch (_error) {
    return 'Diário: indisponível.';
  }
}
