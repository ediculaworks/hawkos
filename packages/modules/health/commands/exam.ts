import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { addLabResult, listLabResults } from '../queries';

// ─────────────────────────────────────────────
// /exame — exames laboratoriais
// ─────────────────────────────────────────────

export const exameCommand = new SlashCommandBuilder()
  .setName('exame')
  .setDescription('Exames — registrar e consultar resultados')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar resultado de exame')
      .addStringOption((opt) =>
        opt
          .setName('nome')
          .setDescription('Nome do exame (ex: TSH, Testosterona)')
          .setRequired(true),
      )
      .addNumberOption((opt) =>
        opt.setName('valor').setDescription('Valor numérico').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('unidade').setDescription('Unidade (ex: mg/dL, mU/L)').setRequired(false),
      )
      .addNumberOption((opt) =>
        opt.setName('ref_min').setDescription('Referência mínima').setRequired(false),
      )
      .addNumberOption((opt) =>
        opt.setName('ref_max').setDescription('Referência máxima').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('laboratorio').setDescription('Nome do laboratório').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('data').setDescription('Data da coleta (YYYY-MM-DD)').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Observação').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar exames recentes'));

export async function handleExame(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleExameAdd(interaction);
  if (sub === 'list') return handleExameList(interaction);
}

async function handleExameAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const valor = interaction.options.getNumber('valor') ?? undefined;
  const unidade = interaction.options.getString('unidade') ?? undefined;
  const refMin = interaction.options.getNumber('ref_min') ?? undefined;
  const refMax = interaction.options.getNumber('ref_max') ?? undefined;
  const lab = interaction.options.getString('laboratorio') ?? undefined;
  const data = interaction.options.getString('data') ?? undefined;
  const nota = interaction.options.getString('nota') ?? undefined;

  const result = await addLabResult({
    name: nome,
    value_number: valor,
    unit: unidade,
    reference_min: refMin,
    reference_max: refMax,
    lab_name: lab,
    collected_at: data,
    notes: nota,
  });

  const valStr = valor && unidade ? ` = ${valor} ${unidade}` : valor ? ` = ${valor}` : '';
  const statusEmoji =
    result.status === 'normal'
      ? '✅'
      : result.status === 'elevated'
        ? '⬆️'
        : result.status === 'low'
          ? '⬇️'
          : '🔬';
  const statusStr = result.status ? ` (${result.status})` : '';

  await interaction.editReply(`${statusEmoji} **${nome}**${valStr}${statusStr} registrado.`);
}

async function handleExameList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const results = await listLabResults(15);
  if (results.length === 0) {
    await interaction.editReply('🔬 Nenhum exame registrado ainda. Use `/exame add`.');
    return;
  }

  const lines = results.slice(0, 15).map((r) => {
    const date = new Date(r.collected_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    const valStr =
      r.value_number !== null && r.unit
        ? ` ${r.value_number} ${r.unit}`
        : r.value_number !== null
          ? ` ${r.value_number}`
          : '';
    const statusEmoji =
      r.status === 'normal'
        ? '✅'
        : r.status === 'elevated'
          ? '⬆️'
          : r.status === 'low'
            ? '⬇️'
            : '🔬';
    return `${statusEmoji} ${date} **${r.name}**${valStr}`;
  });

  await interaction.editReply(`🔬 **Exames recentes:**\n${lines.join('\n')}`);
}
