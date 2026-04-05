import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getSubstanceStats, logSubstance } from '../queries';
import type { SubstanceType } from '../types';

// ─────────────────────────────────────────────
// /substancia — tracking de substâncias
// ─────────────────────────────────────────────

export const substanciaCommand = new SlashCommandBuilder()
  .setName('substancia')
  .setDescription('Substâncias — registrar e acompanhar')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Registrar uso de substância')
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Substância')
          .setRequired(true)
          .addChoices(
            { name: 'Cannabis', value: 'cannabis' },
            { name: 'Tabaco', value: 'tobacco' },
            { name: 'Álcool', value: 'alcohol' },
            { name: 'Cafeína', value: 'caffeine' },
          ),
      )
      .addNumberOption((opt) =>
        opt.setName('quantidade').setDescription('Quantidade').setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('unidade')
          .setDescription('Unidade')
          .setRequired(false)
          .addChoices(
            { name: 'gramas (g)', value: 'g' },
            { name: 'cigarros', value: 'cigarettes' },
            { name: 'ml', value: 'ml' },
            { name: 'doses', value: 'doses' },
            { name: 'xícaras', value: 'cups' },
          ),
      )
      .addNumberOption((opt) =>
        opt.setName('custo').setDescription('Custo em R$').setRequired(false).setMinValue(0),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Contexto ou observação').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('semana').setDescription('Resumo da semana por substância'))
  .addSubcommand((sub) => sub.setName('stats').setDescription('Estatísticas dos últimos 30 dias'));

export async function handleSubstancia(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleSubstanciaAdd(interaction);
  if (sub === 'semana') return handleSubstanciaSemana(interaction);
  if (sub === 'stats') return handleSubstanciaStats(interaction);
}

async function handleSubstanciaAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const tipo = interaction.options.getString('tipo', true) as SubstanceType;
  const quantidade = interaction.options.getNumber('quantidade') ?? undefined;
  const unidade = interaction.options.getString('unidade') ?? undefined;
  const custo = interaction.options.getNumber('custo') ?? undefined;
  const nota = interaction.options.getString('nota') ?? undefined;

  await logSubstance({
    substance: tipo,
    quantity: quantidade,
    unit: unidade,
    cost_brl: custo,
    notes: nota,
  });

  const qtyStr = quantidade && unidade ? ` — ${quantidade}${unidade}` : '';
  const costStr = custo ? ` (R$${custo.toFixed(2)})` : '';
  const labels: Record<SubstanceType, string> = {
    cannabis: '🌿 Cannabis',
    tobacco: '🚬 Tabaco',
    alcohol: '🍺 Álcool',
    caffeine: '☕ Cafeína',
    other: '💊 Substância',
  };
  await interaction.editReply(`${labels[tipo]}${qtyStr}${costStr} registrado.`);
}

async function handleSubstanciaSemana(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  const stats = await getSubstanceStats(7);
  if (stats.length === 0) {
    await interaction.editReply('✅ Nenhuma substância registrada essa semana.');
    return;
  }
  const lines = stats.map((s) => {
    const qtyStr = s.total_quantity && s.unit ? ` — ${s.total_quantity}${s.unit}` : '';
    const costStr = s.total_cost ? ` (R$${s.total_cost.toFixed(2)})` : '';
    return `• **${s.substance}**: ${s.days_used}/7 dias${qtyStr}${costStr}`;
  });
  await interaction.editReply(`**Substâncias — semana:**\n${lines.join('\n')}`);
}

async function handleSubstanciaStats(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  const stats = await getSubstanceStats(30);
  if (stats.length === 0) {
    await interaction.editReply('✅ Nenhuma substância registrada nos últimos 30 dias.');
    return;
  }
  const lines = stats.map((s) => {
    const qtyStr = s.total_quantity && s.unit ? ` — ${s.total_quantity}${s.unit}` : '';
    const costStr = s.total_cost ? ` (R$${s.total_cost.toFixed(2)})` : '';
    return `• **${s.substance}**: ${s.days_used}/30 dias${qtyStr}${costStr}`;
  });
  await interaction.editReply(`**Substâncias — 30 dias:**\n${lines.join('\n')}`);
}
