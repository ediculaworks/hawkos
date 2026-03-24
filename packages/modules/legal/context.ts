// Context Engine: Legal / Jurídico
import { listActiveContracts, listPendingObligations } from './queries';

export async function loadL0(): Promise<string> {
  try {
    const urgent = (await listPendingObligations()).filter((o) => o.urgency !== 'ok');
    if (urgent.length === 0) return 'Jurídico: sem obrigações urgentes.';

    const lines = urgent.slice(0, 3).map((o) => {
      const daysStr =
        o.days_until_due < 0 ? `VENCIDA ${Math.abs(o.days_until_due)}d` : `${o.days_until_due}d`;
      return `• ${o.name} (${daysStr})`;
    });
    return `Obrigações urgentes:\n${lines.join('\n')}`;
  } catch (_error) {
    return 'Jurídico: indisponível';
  }
}

export async function loadL1(): Promise<string> {
  try {
    const obligations = await listPendingObligations();
    if (obligations.length === 0) return 'Jurídico: sem obrigações pendentes.';

    const lines = obligations.map((o) => {
      const daysStr = o.days_until_due < 0 ? 'VENCIDA' : `em ${o.days_until_due}d`;
      const valueStr = o.amount ? ` R$${o.amount.toFixed(0)}` : '';
      return `• ${o.name}${valueStr} (${daysStr})`;
    });
    return `Obrigações pendentes:\n${lines.join('\n')}`;
  } catch (_error) {
    return 'Jurídico (detalhes): indisponível';
  }
}

export async function loadL2(): Promise<string> {
  try {
    const [obligations, contracts] = await Promise.all([
      listPendingObligations(),
      listActiveContracts(),
    ]);

    const sections: string[] = [];

    if (obligations.length > 0) {
      const lines = obligations.map((o) => {
        const daysStr =
          o.days_until_due < 0
            ? `VENCIDA ${Math.abs(o.days_until_due)}d atrás`
            : `vence em ${o.days_until_due}d (${o.due_date})`;
        const valueStr = o.amount ? ` · R$${o.amount.toFixed(2)}` : '';
        return `• **${o.name}**${valueStr} — ${daysStr}`;
      });
      sections.push(`**Obrigações:**\n${lines.join('\n')}`);
    }

    if (contracts.length > 0) {
      const lines = contracts.map((c) => {
        const endStr = c.end_date ? ` até ${c.end_date}` : '';
        return `• ${c.title}${endStr}`;
      });
      sections.push(`**Contratos ativos:**\n${lines.join('\n')}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : 'Jurídico: sem dados.';
  } catch (_error) {
    return 'Jurídico (histórico): indisponível';
  }
}
