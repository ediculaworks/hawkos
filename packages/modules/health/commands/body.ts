import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getLatestWeight, listWeightHistory, logWeight } from '../queries';

// ─────────────────────────────────────────────
// /corpo — peso e medidas
// ─────────────────────────────────────────────

export const corpoCommand = new SlashCommandBuilder()
  .setName('corpo')
  .setDescription('Corpo — peso e medidas')
  .addSubcommand((sub) =>
    sub
      .setName('peso')
      .setDescription('Registrar peso')
      .addNumberOption((opt) =>
        opt
          .setName('kg')
          .setDescription('Peso em kg')
          .setRequired(true)
          .setMinValue(30)
          .setMaxValue(300),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Observação').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('historico').setDescription('Histórico de peso'));

export async function handleCorpo(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'peso') return handleCorpoPeso(interaction);
  if (sub === 'historico') return handleCorpoHistorico(interaction);
}

async function handleCorpoPeso(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const kg = interaction.options.getNumber('kg', true);
  const nota = interaction.options.getString('nota') ?? undefined;

  await logWeight({ weight_kg: kg, notes: nota });

  const latest = await getLatestWeight();
  await interaction.editReply(
    `⚖️ Peso registrado: **${kg}kg**${latest ? ` (anterior: ${latest.weight_kg}kg)` : ''}`,
  );
}

async function handleCorpoHistorico(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const history = await listWeightHistory(14);
  if (history.length === 0) {
    await interaction.editReply('⚖️ Nenhum peso registrado ainda. Use `/corpo peso`.');
    return;
  }

  const latest = history[0];
  const oldest = history[history.length - 1];
  if (!latest || !oldest) return;
  const diff = latest.weight_kg && oldest.weight_kg ? latest.weight_kg - oldest.weight_kg : null;
  const diffStr = diff !== null ? ` (${diff > 0 ? '+' : ''}${diff.toFixed(1)}kg)` : '';

  const lines = history.slice(0, 10).map((m) => {
    const date = new Date(m.measured_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    return `${date}: **${m.weight_kg}kg**`;
  });

  await interaction.editReply(`⚖️ **Histórico de peso**${diffStr}\n${lines.join('\n')}`);
}
