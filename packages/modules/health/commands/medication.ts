import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createMedication, listActiveMedications, logMedicationTaken } from '../queries';
import type { MedicationFrequency } from '../types';

// ─────────────────────────────────────────────
// /remedio — medicamentos
// ─────────────────────────────────────────────

export const remedioCommand = new SlashCommandBuilder()
  .setName('remedio')
  .setDescription('Remédios — aderência e gerenciamento')
  .addSubcommand((sub) =>
    sub
      .setName('tomei')
      .setDescription('Registrar que tomou um remédio')
      .addStringOption((opt) =>
        opt.setName('nome').setDescription('Nome do remédio (parcial aceito)').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('motivo').setDescription('Motivo caso não tenha tomado').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar remédios ativos'))
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar novo remédio')
      .addStringOption((opt) =>
        opt.setName('nome').setDescription('Nome do remédio').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('freq')
          .setDescription('Frequência')
          .setRequired(true)
          .addChoices(
            { name: 'Diário', value: 'daily' },
            { name: '2x ao dia', value: 'twice_daily' },
            { name: '3x ao dia', value: 'three_times_daily' },
            { name: 'Se necessário', value: 'as_needed' },
            { name: 'Semanal', value: 'weekly' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('dosagem').setDescription('Ex: 50mg').setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('indicacao')
          .setDescription('Para que é: TDAH, ansiedade...')
          .setRequired(false),
      ),
  );

export async function handleRemedio(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'tomei') return handleRemedioTomei(interaction);
  if (sub === 'list') return handleRemedioList(interaction);
  if (sub === 'add') return handleRemedioAdd(interaction);
}

async function handleRemedioTomei(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const motivo = interaction.options.getString('motivo') ?? undefined;

  const meds = await listActiveMedications();
  const match = meds.find((m) => m.name.toLowerCase().includes(nome.toLowerCase()));

  if (!match) {
    await interaction.editReply(
      `💊 Remédio "${nome}" não encontrado. Use \`/remedio list\` para ver os ativos.`,
    );
    return;
  }

  await logMedicationTaken({
    medication_id: match.id,
    taken: !motivo,
    skipped_reason: motivo,
  });

  if (motivo) {
    await interaction.editReply(`💊 **${match.name}** — pulado. Motivo: ${motivo}`);
  } else {
    await interaction.editReply(`💊 **${match.name}** — tomado ✓`);
  }
}

async function handleRemedioList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const meds = await listActiveMedications();
  if (meds.length === 0) {
    await interaction.editReply('💊 Nenhum remédio ativo cadastrado. Use `/remedio add`.');
    return;
  }

  const lines = meds.map((m) => {
    const dosStr = m.dosage ? ` ${m.dosage}` : '';
    const indStr = m.indication ? ` — ${m.indication}` : '';
    const freqLabels: Record<string, string> = {
      daily: '1x/dia',
      twice_daily: '2x/dia',
      three_times_daily: '3x/dia',
      as_needed: 'se necessário',
      weekly: 'semanal',
      other: '',
    };
    return `• **${m.name}${dosStr}** (${freqLabels[m.frequency] ?? m.frequency})${indStr}`;
  });

  await interaction.editReply(`💊 **Remédios ativos:**\n${lines.join('\n')}`);
}

async function handleRemedioAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const freq = interaction.options.getString('freq', true) as MedicationFrequency;
  const dosagem = interaction.options.getString('dosagem') ?? undefined;
  const indicacao = interaction.options.getString('indicacao') ?? undefined;

  const med = await createMedication({
    name: nome,
    frequency: freq,
    dosage: dosagem,
    indication: indicacao,
  });

  await interaction.editReply(`💊 **${med.name}** cadastrado ✓`);
}
