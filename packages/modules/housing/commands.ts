import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  createBill,
  createMaintenance,
  getMonthlyBillTotal,
  getPendingBills,
  getPrimaryResidence,
  listBills,
  listMaintenance,
  markBillPaid,
} from './queries';
import type { MaintenanceCategory } from './types';

export const moradiaCommand = new SlashCommandBuilder()
  .setName('moradia')
  .setDescription('Gerenciar moradia e manutenções')
  .addSubcommand((sub) => sub.setName('status').setDescription('Resumo da moradia principal'))
  .addSubcommand((sub) =>
    sub
      .setName('manutencao')
      .setDescription('Registrar manutenção realizada')
      .addStringOption((opt) =>
        opt
          .setName('categoria')
          .setDescription('Categoria')
          .setRequired(true)
          .addChoices(
            { name: 'Elétrica', value: 'eletrica' },
            { name: 'Hidráulica', value: 'hidraulica' },
            { name: 'Pintura', value: 'pintura' },
            { name: 'Limpeza', value: 'limpeza' },
            { name: 'Reforma', value: 'reforma' },
            { name: 'Outros', value: 'outros' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('descricao').setDescription('O que foi feito').setRequired(true),
      )
      .addNumberOption((opt) =>
        opt.setName('custo').setDescription('Custo (R$)').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('proxima').setDescription('Próxima manutenção (YYYY-MM-DD)').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('historico').setDescription('Ver histórico de manutenções'));

export const contaCommand = new SlashCommandBuilder()
  .setName('conta')
  .setDescription('Gerenciar contas da moradia')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Registrar conta do mês')
      .addStringOption((opt) =>
        opt
          .setName('nome')
          .setDescription('Nome da conta (ex: CEMIG, Condomínio)')
          .setRequired(true),
      )
      .addNumberOption((opt) => opt.setName('valor').setDescription('Valor (R$)').setRequired(true))
      .addIntegerOption((opt) =>
        opt
          .setName('vencimento')
          .setDescription('Dia do vencimento')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(31),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Ver contas do mês'))
  .addSubcommand((sub) =>
    sub
      .setName('pagar')
      .setDescription('Marcar conta como paga')
      .addStringOption((opt) => opt.setName('id').setDescription('ID da conta').setRequired(true)),
  );

// ─── Handlers /moradia ────────────────────────────────────────────────────────

export async function handleMoradia(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'status') return handleMoradiaStatus(interaction);
  if (sub === 'manutencao') return handleMoradiaManutencao(interaction);
  if (sub === 'historico') return handleMoradiaHistorico(interaction);
}

async function handleMoradiaStatus(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const [residence, pending, total] = await Promise.all([
    getPrimaryResidence(),
    getPendingBills(),
    getMonthlyBillTotal(),
  ]);

  if (!residence) {
    await interaction.editReply('🏠 Nenhuma moradia principal configurada.');
    return;
  }

  const parts: string[] = [`🏠 **${residence.name}**`];
  if (residence.address) parts.push(`📍 ${residence.address}`);
  if (total > 0)
    parts.push(
      `💰 Contas do mês: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    );
  if (pending.length > 0) {
    parts.push(`\n⏳ **Pendentes (${pending.length}):**`);
    for (const b of pending) {
      parts.push(
        `• ${b.name} — R$ ${(b.amount ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (dia ${b.due_day})`,
      );
    }
  } else {
    parts.push('✅ Sem contas pendentes este mês!');
  }

  await interaction.editReply(parts.join('\n'));
}

async function handleMoradiaManutencao(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const categoria = interaction.options.getString('categoria', true) as MaintenanceCategory;
  const descricao = interaction.options.getString('descricao', true);
  const custo = interaction.options.getNumber('custo') ?? undefined;
  const proxima = interaction.options.getString('proxima') ?? undefined;

  const residence = await getPrimaryResidence();
  if (!residence) {
    await interaction.editReply('❌ Nenhuma moradia principal configurada.');
    return;
  }

  const log = await createMaintenance({
    residence_id: residence.id,
    category: categoria,
    description: descricao,
    cost: custo,
    next_due_at: proxima,
  });

  const catEmoji: Record<MaintenanceCategory, string> = {
    eletrica: '⚡',
    hidraulica: '💧',
    pintura: '🎨',
    limpeza: '🧹',
    reforma: '🔨',
    outros: '🔧',
  };

  const custoStr =
    log.cost != null
      ? `\n💰 Custo: R$ ${log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : '';
  const proximaStr = log.next_due_at
    ? `\n📅 Próxima: ${new Date(log.next_due_at).toLocaleDateString('pt-BR')}`
    : '';

  await interaction.editReply(
    `${catEmoji[categoria]} **Manutenção registrada!**\n📝 ${descricao}${custoStr}${proximaStr}`,
  );
}

async function handleMoradiaHistorico(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const residence = await getPrimaryResidence();
  const logs = await listMaintenance(residence?.id);

  if (logs.length === 0) {
    await interaction.editReply('🔧 Nenhuma manutenção registrada.');
    return;
  }

  const catEmoji: Record<MaintenanceCategory, string> = {
    eletrica: '⚡',
    hidraulica: '💧',
    pintura: '🎨',
    limpeza: '🧹',
    reforma: '🔨',
    outros: '🔧',
  };

  const lines = logs.map((l) => {
    const emoji = (l.category ? catEmoji[l.category as MaintenanceCategory] : undefined) ?? '🔧';
    const date = new Date(l.done_at ?? '').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const custo =
      l.cost != null ? ` · R$ ${l.cost.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '';
    return `${emoji} ${date}: ${l.description}${custo}`;
  });

  await interaction.editReply(`🔧 **Histórico de manutenções:**\n\n${lines.join('\n')}`);
}

// ─── Handlers /conta ──────────────────────────────────────────────────────────

export async function handleConta(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleContaAdd(interaction);
  if (sub === 'list') return handleContaList(interaction);
  if (sub === 'pagar') return handleContaPagar(interaction);
}

async function handleContaAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const valor = interaction.options.getNumber('valor', true);
  const vencimento = interaction.options.getInteger('vencimento', true);

  const residence = await getPrimaryResidence();
  if (!residence) {
    await interaction.editReply('❌ Nenhuma moradia principal configurada.');
    return;
  }

  const bill = await createBill({
    residence_id: residence.id,
    name: nome,
    amount: valor,
    due_day: vencimento,
  });

  await interaction.editReply(
    `🧾 **${bill.name}** — R$ ${(bill.amount ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · dia ${bill.due_day} registrada!`,
  );
}

async function handleContaList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const [residence, total] = await Promise.all([getPrimaryResidence(), getMonthlyBillTotal()]);
  const bills = await listBills(residence?.id);

  if (bills.length === 0) {
    await interaction.editReply('🧾 Nenhuma conta registrada este mês.');
    return;
  }

  const statusEmoji: Record<string, string> = { pending: '⏳', paid: '✅', overdue: '🔴' };
  const lines = bills.map((b) => {
    const emoji = statusEmoji[b.status] ?? '⏳';
    const valor = (b.amount ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    return `${emoji} \`${b.id.slice(0, 8)}\` **${b.name}** — R$ ${valor} (dia ${b.due_day})`;
  });

  await interaction.editReply(
    `🧾 **Contas do mês (${bills.length}):**\n\n${lines.join('\n')}\n\n💰 **Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**`,
  );
}

async function handleContaPagar(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const id = interaction.options.getString('id', true);

  // busca por prefixo do UUID
  const bills = await listBills();
  const found = bills.find((b) => b.id.startsWith(id));
  if (!found) {
    await interaction.editReply(`❌ Conta \`${id}\` não encontrada.`);
    return;
  }

  const updated = await markBillPaid(found.id);
  await interaction.editReply(`✅ **${updated.name}** marcada como paga!`);
}
