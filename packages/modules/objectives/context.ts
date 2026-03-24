// Context Engine: Objectives + Tasks
// L0: tarefas urgentes + objetivos de alta prioridade
// L1: todos os objetivos ativos com progresso
// L2: objetivos + tarefas detalhadas

import { listActiveTasks, listObjectivesByTimeframe, listOverdueTasks } from './queries';

/**
 * L0 — Tarefas urgentes e objetivos top prioridade
 */
export async function loadL0(): Promise<string> {
  try {
    const [byTimeframe, overdue] = await Promise.all([
      listObjectivesByTimeframe(),
      listOverdueTasks(),
    ]);

    const parts: string[] = [];

    // Top 3 objetivos de maior prioridade
    const allActive = [...byTimeframe.short, ...byTimeframe.medium, ...byTimeframe.long]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);

    if (allActive.length > 0) {
      const objLines = allActive.map((o) => `• ${o.title} (${o.progress}%)`);
      parts.push(`Objetivos top:\n${objLines.join('\n')}`);
    }

    if (overdue.length > 0) {
      const overdueLines = overdue.slice(0, 3).map((t) => `• ${t.title} (${t.due_date})`);
      parts.push(`Tarefas atrasadas:\n${overdueLines.join('\n')}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : 'Nenhum objetivo/tarefa urgente.';
  } catch (_error) {
    return 'Objetivos: indisponível';
  }
}

/**
 * L1 — Todos os objetivos ativos com progresso
 */
export async function loadL1(): Promise<string> {
  try {
    const byTimeframe = await listObjectivesByTimeframe();

    const sections: string[] = [];

    const labels: Record<string, string> = {
      short: 'Curto prazo',
      medium: 'Médio prazo',
      long: 'Longo prazo',
    };

    for (const tf of ['short', 'medium', 'long']) {
      const objs = byTimeframe[tf as keyof typeof byTimeframe];
      if (objs.length === 0) continue;
      const lines = objs.map((o) => `• ${o.title}: ${o.progress}%`);
      sections.push(`${labels[tf]}:\n${lines.join('\n')}`);
    }

    if (sections.length === 0) return 'Objetivos: nenhum ativo.';

    return `Objetivos:\n\n${sections.join('\n\n')}`;
  } catch (_error) {
    return 'Objetivos (semana): indisponível';
  }
}

/**
 * L2 — Objetivos + tarefas ativas detalhadas
 */
export async function loadL2(): Promise<string> {
  try {
    const [byTimeframe, tasks] = await Promise.all([
      listObjectivesByTimeframe(),
      listActiveTasks(20),
    ]);

    const sections: string[] = [];

    const labels: Record<string, string> = {
      short: 'Curto prazo',
      medium: 'Médio prazo',
      long: 'Longo prazo',
    };

    for (const tf of ['short', 'medium', 'long']) {
      const objs = byTimeframe[tf as keyof typeof byTimeframe];
      if (objs.length === 0) continue;

      const lines = objs.map((o) => {
        const desc = o.description ? ` — ${o.description.slice(0, 60)}` : '';
        const deadline = o.target_date ? ` · até ${o.target_date}` : '';
        return `• **${o.title}**${deadline}: ${o.progress}%${desc}`;
      });

      sections.push(`**${labels[tf]}:**\n${lines.join('\n')}`);
    }

    if (tasks.length > 0) {
      const taskLines = tasks.map((t) => {
        const dueStr = t.due_date ? ` (${t.due_date})` : '';
        return `• [${t.status}] ${t.title}${dueStr}`;
      });
      sections.push(`**Tarefas ativas:**\n${taskLines.join('\n')}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : 'Nenhum objetivo ou tarefa ativo.';
  } catch (_error) {
    return 'Objetivos (histórico): indisponível';
  }
}
