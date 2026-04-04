import {
  getAccounts,
  getFinanceSummary,
  getTransactionsByCategory,
  listTransactions,
} from './queries';

/**
 * L0 Context: Resumo ultra-rápido do mês atual
 * Cabe em ~50 tokens. Carregado sempre que finanças são mencionadas.
 */
export async function loadL0(): Promise<string> {
  try {
    const today = new Date();
    const monthStart =
      new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0] ?? '';

    const summary = await getFinanceSummary(undefined, monthStart);
    const recentTransactions = await listTransactions(undefined, monthStart, undefined, 5);

    const lines = [
      `## Finanças (Mês de ${monthStart.substring(0, 7)})`,
      `- **Receitas:** R$ ${summary.income.toFixed(2)}`,
      `- **Despesas:** R$ ${summary.expenses.toFixed(2)}`,
      `- **Saldo Líquido:** R$ ${summary.net.toFixed(2)}`,
      `- **Últimas transações:** ${recentTransactions.length > 0 ? recentTransactions.length : 'nenhuma'}`,
    ];

    return lines.join('\n');
  } catch (_error) {
    return '## Finanças (indisponível)';
  }
}

/**
 * L1 Context: Contexto detalhado com categorias e contas
 * ~200 tokens. Carregado quando o usuário interage com finances.
 */
export async function loadL1(): Promise<string> {
  try {
    const today = new Date();
    const monthStart =
      new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0] ?? '';

    const [summary, accounts, categoryExpenses] = await Promise.all([
      getFinanceSummary(undefined, monthStart),
      getAccounts(),
      getTransactionsByCategory(monthStart),
    ]);

    const lines = [
      '## Finanças Detalhadas',
      '### Resumo Mensal',
      `- Receitas: R$ ${summary.income.toFixed(2)}`,
      `- Despesas: R$ ${summary.expenses.toFixed(2)}`,
      `- Líquido: R$ ${summary.net.toFixed(2)}`,
      '### Despesas por Categoria',
      ...categoryExpenses.slice(0, 10).map((e) => `- ${e.name}: R$ ${e.total.toFixed(2)}`),
      '### Contas',
      ...accounts.map((a) => `- ${a.name} (${a.type}): R$ ${a.balance.toFixed(2)}`),
    ];

    return lines.join('\n');
  } catch (_error) {
    return '## Finanças (indisponível)';
  }
}

/**
 * L2 Context: Dados específicos (histórico completo, análises detalhadas)
 * ~500 tokens. Carregado apenas para queries específicas.
 */
export async function loadL2(query?: string): Promise<string> {
  try {
    const today = new Date();
    const monthStart =
      new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0] ?? '';

    const transactions = await listTransactions(undefined, monthStart, undefined, 100);

    const lines = [
      '## Histórico Detalhado de Transações',
      '### Últimas 10 Transações',
      ...transactions
        .slice(0, 10)
        .map(
          (t) =>
            `- **${t.date}** | R$ ${t.amount.toFixed(2)} | ${t.type} | ${t.description || '(sem desc)'}`,
        ),
    ];

    if (query?.toLowerCase().includes('substancia') || query?.toLowerCase().includes('cannabis')) {
      const substanceTransactions = transactions.filter((t) =>
        t.description?.toLowerCase().includes('cannabis'),
      );
      lines.push(
        '### Gastos com Substâncias',
        `Total mensal: R$ ${substanceTransactions.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}`,
        `Transações: ${substanceTransactions.length}`,
      );
    }

    return lines.join('\n');
  } catch (_error) {
    return '## Histórico (indisponível)';
  }
}
