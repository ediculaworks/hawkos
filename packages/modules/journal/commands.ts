import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getTodayEntry, listRecentEntries, upsertJournalEntry } from './queries';

/**
 * /diario - Criar ou ver entradas do diário
 *
 * /diario <texto>           → criar entry do dia (tipo daily)
 * /diario humor <1-10>      → registrar apenas humor
 * /diario hoje              → ver entry de hoje
 * /diario semana            → ver últimas 7 entradas
 */
export const diarioCommand = new SlashCommandBuilder()
  .setName('diario')
  .setDescription('Diário pessoal — registrar e consultar entradas')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar entrada no diário')
      .addStringOption((opt) =>
        opt.setName('texto').setDescription('Conteúdo da entrada').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('humor')
          .setDescription('Nível de humor (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('energia')
          .setDescription('Nível de energia (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Tipo de entrada')
          .setRequired(false)
          .addChoices(
            { name: 'Diário (padrão)', value: 'daily' },
            { name: 'Reflexão', value: 'reflection' },
            { name: 'Gratidão', value: 'gratitude' },
            { name: 'Livre', value: 'freeform' },
          ),
      ),
  )
  .addSubcommand((sub) => sub.setName('hoje').setDescription('Ver a entrada de hoje'))
  .addSubcommand((sub) =>
    sub.setName('semana').setDescription('Ver as últimas 7 entradas do diário'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('humor')
      .setDescription('Registrar apenas humor e energia')
      .addIntegerOption((opt) =>
        opt
          .setName('valor')
          .setDescription('Humor (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('energia')
          .setDescription('Energia (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false),
      ),
  );

/**
 * Handler principal para /diario
 */
export async function handleDiario(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const sub = interaction.options.getSubcommand();

  if (sub === 'add') return handleDiarioAdd(interaction);
  if (sub === 'hoje') return handleDiarioHoje(interaction);
  if (sub === 'semana') return handleDiarioSemana(interaction);
  if (sub === 'humor') return handleDiarioHumor(interaction);
}

async function handleDiarioAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const texto = interaction.options.getString('texto', true);
  const humor = interaction.options.getInteger('humor') ?? undefined;
  const energia = interaction.options.getInteger('energia') ?? undefined;
  const tipo = (interaction.options.getString('tipo') ?? 'daily') as
    | 'daily'
    | 'reflection'
    | 'gratitude'
    | 'freeform';

  const entry = await upsertJournalEntry({
    content: texto,
    mood: humor,
    energy: energia,
    type: tipo,
  });

  const date = new Date(entry.date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  const parts = [`📓 **Diário ${date}** registrado!`];
  if (humor) parts.push(`😊 Humor: ${humor}/10`);
  if (energia) parts.push(`⚡ Energia: ${energia}/10`);
  parts.push(`\n> ${texto.slice(0, 200)}${texto.length > 200 ? '...' : ''}`);

  await interaction.editReply(parts.join('\n'));
}

async function handleDiarioHoje(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const entry = await getTodayEntry();

  if (!entry) {
    await interaction.editReply('📓 Nenhuma entrada hoje ainda. Use `/diario add` para registrar.');
    return;
  }

  const date = new Date(entry.date).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });

  const parts = [`📓 **${date}**`];
  if (entry.mood) parts.push(`😊 Humor: ${entry.mood}/10`);
  if (entry.energy) parts.push(`⚡ Energia: ${entry.energy}/10`);
  parts.push(`\n${entry.content}`);

  if (entry.tags.length > 0) {
    parts.push(`\nTags: ${entry.tags.map((t) => `#${t}`).join(' ')}`);
  }

  await interaction.editReply(parts.join('\n'));
}

async function handleDiarioSemana(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const entries = await listRecentEntries(7, 'daily');

  if (entries.length === 0) {
    await interaction.editReply('📓 Nenhuma entrada registrada ainda.');
    return;
  }

  const lines = entries.map((e) => {
    const date = new Date(e.date).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    const moodStr = e.mood ? ` · 😊${e.mood}` : '';
    const energyStr = e.energy ? ` ⚡${e.energy}` : '';
    const preview = e.content.slice(0, 80) + (e.content.length > 80 ? '...' : '');
    return `**${date}**${moodStr}${energyStr}\n> ${preview}`;
  });

  await interaction.editReply(`📓 **Últimas entradas:**\n\n${lines.join('\n\n')}`);
}

async function handleDiarioHumor(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const humor = interaction.options.getInteger('valor', true);
  const energia = interaction.options.getInteger('energia') ?? undefined;

  // Gera um content mínimo apenas com o registro de humor/energia
  const content = `[Check-in] Humor: ${humor}/10${energia ? ` · Energia: ${energia}/10` : ''}`;

  await upsertJournalEntry({
    content,
    mood: humor,
    energy: energia,
    type: 'daily',
  });

  const energiaStr = energia ? ` · Energia: ${energia}/10` : '';
  await interaction.editReply(`✅ Registrado — Humor: ${humor}/10${energiaStr}`);
}
