import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createTransaction, getAccounts, getCategories, getFinanceSummary } from './queries';
import type { CreateTransactionInput } from './types';

/**
 * /gasto - Registrar um gasto
 * Uso: /gasto amount:100 category:Alimentação description:Almoço
 */
export const gastaCommand = new SlashCommandBuilder()
  .setName('gasto')
  .setDescription('Registrar uma despesa')
  .addNumberOption((opt) =>
    opt.setName('amount').setDescription('Valor do gasto').setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('category')
      .setDescription('Categoria da despesa')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt.setName('description').setDescription('Descrição (opcional)').setRequired(false),
  )
  .addStringOption((opt) =>
    opt
      .setName('account')
      .setDescription('Conta (padrão: primeira ativa)')
      .setRequired(false)
      .setAutocomplete(true),
  );

/**
 * /receita - Registrar uma receita
 * Uso: /receita amount:5000 category:Salário
 */
export const receitaCommand = new SlashCommandBuilder()
  .setName('receita')
  .setDescription('Registrar uma receita')
  .addNumberOption((opt) =>
    opt.setName('amount').setDescription('Valor da receita').setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('category')
      .setDescription('Categoria da receita')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt.setName('description').setDescription('Descrição (opcional)').setRequired(false),
  );

/**
 * /saldo - Ver resumo financeiro do mês
 * Uso: /saldo (sem argumentos = mês atual)
 */
export const saldoCommand = new SlashCommandBuilder()
  .setName('saldo')
  .setDescription('Ver resumo financeiro do mês')
  .addStringOption((opt) =>
    opt
      .setName('period')
      .setDescription('Período (month, week, today)')
      .setRequired(false)
      .addChoices(
        { name: 'Este mês', value: 'month' },
        { name: 'Esta semana', value: 'week' },
        { name: 'Hoje', value: 'today' },
        { name: 'Últimos 30 dias', value: '30days' },
      ),
  );

/**
 * Handler para /gasto
 */
export async function handleGasto(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const amount = interaction.options.getNumber('amount', true);
    const categoryName = interaction.options.getString('category', true);
    const description = interaction.options.getString('description') || '';
    const accountName = interaction.options.getString('account');

    // Validações
    if (amount <= 0) {
      await interaction.editReply('❌ O valor deve ser positivo.');
      return;
    }

    // Obter conta padrão ou especificada
    const accounts = await getAccounts();
    const account = accountName
      ? accounts.find((a) => a.name.toLowerCase().includes(accountName.toLowerCase()))
      : accounts[0];

    if (!account) {
      await interaction.editReply('❌ Nenhuma conta encontrada.');
      return;
    }

    // Obter categoria
    const categories = await getCategories('expense');
    const category = categories.find((c) =>
      c.name.toLowerCase().includes(categoryName.toLowerCase()),
    );

    if (!category) {
      const availableCategories = categories.map((c) => `• ${c.name}`).join('\n');
      await interaction.editReply(
        `❌ Categoria não encontrada.\n\nCategorias disponíveis:\n${availableCategories}`,
      );
      return;
    }

    // Criar transação
    await createTransaction({
      account_id: account.id,
      category_id: category.id,
      amount,
      type: 'expense',
      description,
    } as CreateTransactionInput);

    await interaction.editReply(
      `✅ Gasto registrado!\n💰 **${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}** em **${category.name}**\n📝 ${description}`,
    );
  } catch (_error) {
    await interaction.editReply('❌ Erro ao registrar gasto. Tente novamente.');
  }
}

/**
 * Handler para /receita
 */
export async function handleReceita(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const amount = interaction.options.getNumber('amount', true);
    const categoryName = interaction.options.getString('category', true);
    const description = interaction.options.getString('description') || '';

    if (amount <= 0) {
      await interaction.editReply('❌ O valor deve ser positivo.');
      return;
    }

    const accounts = await getAccounts();
    const account = accounts[0];

    if (!account) {
      await interaction.editReply('❌ Nenhuma conta encontrada.');
      return;
    }

    const categories = await getCategories('income');
    const category = categories.find((c) =>
      c.name.toLowerCase().includes(categoryName.toLowerCase()),
    );

    if (!category) {
      const availableCategories = categories.map((c) => `• ${c.name}`).join('\n');
      await interaction.editReply(
        `❌ Categoria não encontrada.\n\nCategorias disponíveis:\n${availableCategories}`,
      );
      return;
    }

    await createTransaction({
      account_id: account.id,
      category_id: category.id,
      amount,
      type: 'income',
      description,
    } as CreateTransactionInput);

    await interaction.editReply(
      `✅ Receita registrada!\n💰 **${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}** em **${category.name}**\n📝 ${description}`,
    );
  } catch (_error) {
    await interaction.editReply('❌ Erro ao registrar receita. Tente novamente.');
  }
}

/**
 * Handler para /saldo
 */
export async function handleSaldo(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const period = interaction.options.getString('period') || 'month';
    const today = new Date();
    let startDate: string;

    switch (period) {
      case 'today':
        startDate = today.toISOString().split('T')[0] ?? '';
        break;
      case 'week': {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        startDate = weekStart.toISOString().split('T')[0] ?? '';
        break;
      }
      case '30days': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0] ?? '';
        break;
      }
      default: {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = monthStart.toISOString().split('T')[0] ?? '';
      }
    }

    const summary = await getFinanceSummary(undefined, startDate);

    const embed = {
      color: 0x2ecc71,
      title: `📊 Resumo Financeiro - ${getPeriodLabel(period)}`,
      fields: [
        {
          name: '📈 Receitas',
          value: `**${summary.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}**`,
          inline: true,
        },
        {
          name: '📉 Despesas',
          value: `**${summary.expenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}**`,
          inline: true,
        },
        {
          name: '💰 Saldo Líquido',
          value: `**${summary.net.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}**`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    await interaction.editReply({ embeds: [embed] });
  } catch (_error) {
    await interaction.editReply('❌ Erro ao obter saldo. Tente novamente.');
  }
}

function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    today: 'Hoje',
    week: 'Esta semana',
    month: 'Este mês',
    '30days': 'Últimos 30 dias',
  };
  return labels[period] || 'Este mês';
}
