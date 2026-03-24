// Context Engine: Security / Segurança
import { getDueForReview, getPendingItems, getSecuritySummary } from './queries';

export async function loadL0(): Promise<string> {
  const summary = await getSecuritySummary();
  if (summary.critico > 0) return `🔴 Segurança: ${summary.critico} item(s) crítico(s)!`;
  if (summary.pendente > 0) return `🟠 Segurança: ${summary.pendente} item(s) pendente(s).`;
  return '✅ Segurança: tudo ok.';
}

export async function loadL1(): Promise<string> {
  const [summary, due] = await Promise.all([getSecuritySummary(), getDueForReview()]);
  const total = summary.ok + summary.pendente + summary.critico;
  const parts: string[] = ['Segurança:'];
  parts.push(`${summary.ok}/${total} itens ok`);
  if (summary.critico > 0) parts.push(`🔴 ${summary.critico} crítico(s)`);
  if (summary.pendente > 0) parts.push(`🟠 ${summary.pendente} pendente(s)`);
  if (due.length > 0) parts.push(`📅 ${due.length} para revisar`);
  return parts.join('\n');
}

export async function loadL2(): Promise<string> {
  const [summary, pending, due] = await Promise.all([
    getSecuritySummary(),
    getPendingItems(),
    getDueForReview(),
  ]);

  const total = summary.ok + summary.pendente + summary.critico;
  const sections: string[] = [];

  const header =
    summary.critico > 0
      ? `🔴 **${summary.critico} crítico(s)** · 🟠 ${summary.pendente} pendente(s) · ✅ ${summary.ok}/${total}`
      : summary.pendente > 0
        ? `🟠 **${summary.pendente} pendente(s)** · ✅ ${summary.ok}/${total}`
        : `✅ Tudo ok (${total} itens)`;
  sections.push(`**Segurança:** ${header}`);

  if (pending.length > 0) {
    const lines = pending
      .slice(0, 5)
      .map(
        (i) => `${i.status === 'critical' ? '🔴' : '🟠'} ${i.name}${i.notes ? `: ${i.notes}` : ''}`,
      );
    sections.push(`**Para resolver:**\n${lines.join('\n')}`);
  }

  if (due.length > 0) {
    const lines = due.slice(0, 3).map((i) => `📅 ${i.name}`);
    sections.push(`**Para revisar:**\n${lines.join('\n')}`);
  }

  return sections.join('\n\n');
}
