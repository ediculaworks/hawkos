// Context Engine: Demands
// L0: demandas ativas com progresso
// L1: demandas + steps resumidos
// L2: demandas + steps + logs detalhados

import { getActiveDemands, getDemandWithSteps } from './queries';

/**
 * L0 — Demandas ativas com progresso (one-liner)
 */
export async function loadL0(): Promise<string> {
  try {
    const active = await getActiveDemands();
    const running = active.filter((d) => d.status === 'running');

    if (running.length === 0) return 'Nenhuma demanda em andamento.';

    const lines = running.map((d) => `• ${d.title} (${d.progress}%)`);
    return `Demandas ativas:\n${lines.join('\n')}`;
  } catch (_error) {
    return 'Demandas: indisponível';
  }
}

/**
 * L1 — Demandas com steps resumidos
 */
export async function loadL1(): Promise<string> {
  try {
    const active = await getActiveDemands();

    if (active.length === 0) return 'Demandas: nenhuma ativa.';

    const sections: string[] = [];

    for (const demand of active.slice(0, 5)) {
      const statusEmoji =
        demand.status === 'running'
          ? '🔄'
          : demand.status === 'paused'
            ? '⏸'
            : demand.status === 'planned'
              ? '📋'
              : demand.status === 'triaging'
                ? '🔍'
                : '•';

      sections.push(
        `${statusEmoji} ${demand.title} — ${demand.progress}% (${demand.completed_steps}/${demand.total_steps} steps)`,
      );
    }

    return `Demandas:\n${sections.join('\n')}`;
  } catch (_error) {
    return 'Demandas: indisponível';
  }
}

/**
 * L2 — Demandas com steps detalhados
 */
export async function loadL2(): Promise<string> {
  try {
    const active = await getActiveDemands();

    if (active.length === 0) return 'Nenhuma demanda ativa.';

    const sections: string[] = [];

    for (const demand of active.slice(0, 3)) {
      const withSteps = await getDemandWithSteps(demand.id);
      const stepLines = withSteps.steps.map((s) => {
        const statusIcon =
          s.status === 'completed'
            ? '✅'
            : s.status === 'running'
              ? '🔄'
              : s.status === 'failed'
                ? '❌'
                : s.status === 'waiting_human'
                  ? '⏳'
                  : s.status === 'skipped'
                    ? '⏭'
                    : '⬜';
        return `  ${statusIcon} ${s.title}`;
      });

      sections.push(
        `**${demand.title}** (${demand.progress}% · ${demand.status})\n${stepLines.join('\n')}`,
      );
    }

    return sections.join('\n\n');
  } catch (_error) {
    return 'Demandas (detalhe): indisponível';
  }
}
