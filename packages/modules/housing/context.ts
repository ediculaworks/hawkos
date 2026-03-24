// Context Engine: Housing / Moradia
import {
  getMonthlyBillTotal,
  getPendingBills,
  getPrimaryResidence,
  listMaintenance,
} from './queries';

export async function loadL0(): Promise<string> {
  try {
    const [residence, pending] = await Promise.all([getPrimaryResidence(), getPendingBills()]);
    if (!residence) return 'Moradia: não configurada.';
    if (pending.length === 0) return `Moradia: ${residence.name} · sem contas pendentes.`;
    return `Moradia: ${residence.name} · ${pending.length} conta(s) pendente(s).`;
  } catch (_error) {
    return 'Moradia: indisponível.';
  }
}

export async function loadL1(): Promise<string> {
  try {
    const [residence, pending, total] = await Promise.all([
      getPrimaryResidence(),
      getPendingBills(),
      getMonthlyBillTotal(),
    ]);

    if (!residence) return 'Moradia: não configurada.';

    const parts: string[] = [`Moradia: ${residence.name}`];
    if (total > 0)
      parts.push(
        `Contas do mês: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      );
    if (pending.length > 0) parts.push(`Pendentes: ${pending.map((b) => b.name).join(', ')}`);
    return parts.join('\n');
  } catch (_error) {
    return 'Moradia: indisponível.';
  }
}

export async function loadL2(): Promise<string> {
  try {
    const [residence, pending, total, maintenance] = await Promise.all([
      getPrimaryResidence(),
      getPendingBills(),
      getMonthlyBillTotal(),
      (async () => {
        const r = await getPrimaryResidence();
        return listMaintenance(r?.id);
      })(),
    ]);

    if (!residence) return 'Moradia: não configurada.';

    const sections: string[] = [];

    const header = [`**${residence.name}**`];
    if (residence.address) header.push(`📍 ${residence.address}`);
    if (total > 0)
      header.push(
        `💰 Total mês: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
      );
    sections.push(header.join('\n'));

    if (pending.length > 0) {
      const lines = pending.map(
        (b) =>
          `⏳ ${b.name} — R$ ${(b.amount ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })} (dia ${b.due_day})`,
      );
      sections.push(`**Contas pendentes:**\n${lines.join('\n')}`);
    }

    if (maintenance.length > 0) {
      const recent = maintenance.slice(0, 3);
      const lines = recent.map(
        (m) =>
          `🔧 ${new Date(m.done_at ?? '').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}: ${m.description}`,
      );
      sections.push(`**Últimas manutenções:**\n${lines.join('\n')}`);
    }

    return sections.join('\n\n');
  } catch (_error) {
    return 'Moradia: indisponível.';
  }
}
