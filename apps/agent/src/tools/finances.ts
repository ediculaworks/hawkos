import {
  createTransaction,
  deleteTransaction,
  getAccounts,
  getBudgetVsActual,
  getCategories,
  getFinanceSummary,
  getPortfolioPositions,
  listTransactions,
} from '@hawk/module-finances/queries';
import { eventBus } from '@hawk/shared';
import { z } from 'zod';

import type { ToolDefinition } from './types.js';

export const financeTools: Record<string, ToolDefinition> = {
  create_transaction: {
    name: 'create_transaction',
    modules: ['finances'],
    description: 'Registra uma transação financeira (gasto ou receita)',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Valor da transação' },
        type: {
          type: 'string',
          enum: ['expense', 'income'],
          description: 'Tipo: despesa ou receita',
        },
        category: { type: 'string', description: 'Nome da categoria (ex: Alimentação, Salário)' },
        description: { type: 'string', description: 'Descrição opcional' },
        account: { type: 'string', description: 'Nome da conta (opcional)' },
      },
      required: ['amount', 'type', 'category'],
    },
    schema: z.object({
      amount: z.number().positive(),
      type: z.enum(['expense', 'income']),
      category: z.string().min(1),
      description: z.string().optional(),
      account: z.string().optional(),
    }),
    handler: async (args: {
      amount: number;
      type: 'expense' | 'income';
      category: string;
      description?: string;
      account?: string;
    }) => {
      const accounts = await getAccounts();
      const account = args.account
        ? accounts.find((a) => a.name.toLowerCase().includes(args.account?.toLowerCase() ?? ''))
        : accounts[0];

      if (!account) return 'Erro: Nenhuma conta encontrada.';

      const categories = await getCategories();
      const category = categories.find(
        (c) => c.name.toLowerCase().includes(args.category.toLowerCase()) && c.type === args.type,
      );

      if (!category) return `Erro: Categoria "${args.category}" não encontrada para ${args.type}.`;

      await createTransaction({
        account_id: account.id,
        category_id: category.id,
        amount: args.amount,
        type: args.type,
        description: args.description,
      });

      eventBus
        .emit('transaction:created', {
          amount: args.amount,
          category: category.name,
          type: args.type,
          description: args.description,
        })
        .catch(() => {});

      return `Transação registrada: ${args.type === 'expense' ? 'Gasto' : 'Receita'} de R$ ${args.amount} em ${category.name}.`;
    },
  },

  delete_transaction: {
    name: 'delete_transaction',
    modules: ['finances'],
    dangerous: true,
    description: 'Deleta uma transação financeira por ID',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID da transação a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteTransaction(args.id);
      return 'Transação deletada.';
    },
  },

  get_financial_summary: {
    name: 'get_financial_summary',
    modules: ['finances'],
    description: 'Obtém resumo financeiro do mês atual',
    parameters: {
      type: 'object',
      properties: {},
    },
    schema: z.object({}),
    handler: async () => {
      const summary = await getFinanceSummary();
      return `Receitas: R$ ${summary.income.toFixed(2)}\nDespesas: R$ ${summary.expenses.toFixed(2)}\nSaldo: R$ ${summary.net.toFixed(2)}`;
    },
  },

  get_portfolio_summary: {
    name: 'get_portfolio_summary',
    modules: ['finances'],
    description: 'Resumo do portfólio de investimentos com posições e alocação',
    parameters: {
      type: 'object',
      properties: {},
    },
    schema: z.object({}),
    handler: async () => {
      const positions = await getPortfolioPositions();
      if (positions.length === 0) return 'Nenhum ativo no portfólio.';
      type Position = {
        ticker?: string;
        asset_class?: string;
        quantity?: number;
        current_price?: number;
        current_value?: number;
      };
      const total = (positions as Position[]).reduce((s, p) => s + (p.current_value ?? 0), 0);
      return [
        `**Portfólio** — Total: R$ ${total.toFixed(2)}`,
        ...(positions as Position[]).map(
          (p) =>
            `• ${p.ticker} (${p.asset_class}): ${p.quantity} × R$ ${p.current_price?.toFixed(2) ?? '?'} = R$ ${p.current_value?.toFixed(2) ?? '?'}`,
        ),
      ].join('\n');
    },
  },

  get_budget_status: {
    name: 'get_budget_status',
    modules: ['finances'],
    description: 'Status do orçamento do mês atual vs gasto real por categoria',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Mês no formato YYYY-MM (default: mês atual)' },
      },
    },
    schema: z.object({
      month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(),
    }),
    handler: async (args: { month?: string }) => {
      const month = args.month ?? new Date().toISOString().slice(0, 7);
      const budget = await getBudgetVsActual(month);
      if (budget.length === 0) return `Nenhum orçamento configurado para ${month}.`;
      type BudgetRow = {
        category_name?: string;
        spent_amount?: number;
        budget_amount?: number;
        remaining_amount?: number;
      };
      const overBudget = (budget as BudgetRow[]).filter((b) => (b.remaining_amount ?? 0) < 0);
      const lines = (budget as BudgetRow[]).map(
        (b) =>
          `${(b.remaining_amount ?? 0) < 0 ? '🔴' : '🟢'} ${b.category_name}: R$ ${b.spent_amount?.toFixed(2) ?? 0} / R$ ${b.budget_amount?.toFixed(2)} (${(b.remaining_amount ?? 0) < 0 ? 'excedido' : `R$ ${b.remaining_amount?.toFixed(2)} restante`})`,
      );
      return [`**Orçamento ${month}** — ${overBudget.length} categorias excedidas`, ...lines].join(
        '\n',
      );
    },
  },

  list_transactions: {
    name: 'list_transactions',
    modules: ['finances'],
    description: 'Lista transações recentes com filtros opcionais',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['expense', 'income'], description: 'Filtrar por tipo' },
        limit: { type: 'number', description: 'Quantidade (padrão: 20, máx: 50)' },
        offset: { type: 'number', description: 'Deslocamento para paginação' },
      },
      required: [],
    },
    schema: z.object({
      type: z.enum(['expense', 'income']).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      offset: z.number().int().min(0).optional(),
    }),
    handler: async (args: { type?: 'expense' | 'income'; limit?: number; offset?: number }) => {
      const limit = args.limit ?? 20;
      const offset = args.offset ?? 0;
      const transactions = await listTransactions(undefined, undefined, undefined, limit, offset);
      const filtered = args.type ? transactions.filter((t) => t.type === args.type) : transactions;
      if (filtered.length === 0) return 'Nenhuma transação encontrada.';
      const lines = filtered.map(
        (t) =>
          `• ${t.type === 'expense' ? '↓' : '↑'} R$ ${Math.abs(t.amount).toFixed(2)} — ${t.description ?? 'sem descrição'} (${t.date?.slice(0, 10) ?? ''})`,
      );
      return `${filtered.length} transação(ões):\n${lines.join('\n')}`;
    },
  },
};
