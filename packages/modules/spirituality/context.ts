// Context Engine: Spirituality / Espiritualidade
import {
  getTodayReflections,
  getWeeklyMoodAverage,
  listPersonalValues,
  listReflections,
} from './queries';

export async function loadL0(): Promise<string> {
  const [today, moodAvg] = await Promise.all([getTodayReflections(), getWeeklyMoodAverage()]);
  const moodStr = moodAvg != null ? ` · estado médio: ${moodAvg}/5` : '';
  if (today.length === 0) return `Espiritualidade: sem reflexões hoje${moodStr}.`;
  return `Espiritualidade: ${today.length} reflexão(ões) hoje${moodStr}.`;
}

export async function loadL1(): Promise<string> {
  const [today, recent, moodAvg] = await Promise.all([
    getTodayReflections(),
    listReflections(undefined, 3),
    getWeeklyMoodAverage(),
  ]);

  const parts: string[] = ['Espiritualidade:'];
  if (today.length > 0) parts.push(`Reflexões hoje: ${today.length}`);
  if (moodAvg != null) parts.push(`Estado interior (7d): ${moodAvg}/5`);
  if (recent.length > 0) {
    const gratitude = recent.filter((r) => r.type === 'gratitude');
    if (gratitude.length > 0)
      parts.push(`Gratidão recente: ${gratitude[0]?.content.slice(0, 50)}...`);
  }
  return parts.join('\n');
}

export async function loadL2(): Promise<string> {
  const [today, values, moodAvg] = await Promise.all([
    getTodayReflections(),
    listPersonalValues(),
    getWeeklyMoodAverage(),
  ]);

  const sections: string[] = [];

  if (moodAvg != null) {
    const bar = '█'.repeat(Math.round(moodAvg)) + '░'.repeat(5 - Math.round(moodAvg));
    sections.push(`**Estado interior (7d):** ${bar} ${moodAvg}/5`);
  }

  if (today.length > 0) {
    const typeEmoji: Record<string, string> = {
      reflection: '🧠',
      gratitude: '🙏',
      intention: '🎯',
      values: '⭐',
      mantra: '🔮',
    };
    const lines = today.map((r) => {
      const emoji = typeEmoji[r.type] ?? '🧠';
      return `${emoji} ${r.content.slice(0, 80)}${r.content.length > 80 ? '...' : ''}`;
    });
    sections.push(`**Reflexões de hoje:**\n${lines.join('\n')}`);
  }

  if (values.length > 0) {
    const top3 = values
      .slice(0, 3)
      .map((v) => `⭐ ${v.name}`)
      .join(' · ');
    sections.push(`**Top valores:** ${top3}`);
  }

  return sections.length > 0 ? sections.join('\n\n') : 'Espiritualidade: sem dados de hoje.';
}
