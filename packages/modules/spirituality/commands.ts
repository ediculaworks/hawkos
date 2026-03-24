import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  createReflection,
  getTodayReflections,
  getWeeklyMoodAverage,
  listPersonalValues,
  listReflections,
  searchReflections,
} from './queries';
import type { ReflectionType } from './types';

export const reflexaoCommand = new SlashCommandBuilder()
  .setName('reflexao')
  .setDescription('Reflexões, gratidão e espiritualidade')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Registrar reflexão, gratidão ou intenção')
      .addStringOption((opt) =>
        opt.setName('conteudo').setDescription('Escreva sua reflexão').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Tipo de entrada')
          .setRequired(false)
          .addChoices(
            { name: 'Reflexão', value: 'reflection' },
            { name: 'Gratidão', value: 'gratitude' },
            { name: 'Intenção do dia', value: 'intention' },
            { name: 'Valores', value: 'values' },
            { name: 'Mantra', value: 'mantra' },
          ),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('humor')
          .setDescription('Seu estado interior (1-5)')
          .setMinValue(1)
          .setMaxValue(5)
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('hoje').setDescription('Ver reflexões de hoje'))
  .addSubcommand((sub) =>
    sub
      .setName('historico')
      .setDescription('Ver reflexões recentes')
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Filtrar por tipo')
          .setRequired(false)
          .addChoices(
            { name: 'Reflexão', value: 'reflection' },
            { name: 'Gratidão', value: 'gratitude' },
            { name: 'Intenção', value: 'intention' },
            { name: 'Mantra', value: 'mantra' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('buscar')
      .setDescription('Buscar em reflexões passadas')
      .addStringOption((opt) =>
        opt.setName('query').setDescription('Termos de busca').setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName('valores').setDescription('Ver seus valores pessoais'));

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleReflexao(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleReflexaoAdd(interaction);
  if (sub === 'hoje') return handleReflexaoHoje(interaction);
  if (sub === 'historico') return handleReflexaoHistorico(interaction);
  if (sub === 'buscar') return handleReflexaoBuscar(interaction);
  if (sub === 'valores') return handleValores(interaction);
}

async function handleReflexaoAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const conteudo = interaction.options.getString('conteudo', true);
  const tipo = (interaction.options.getString('tipo') ?? 'reflection') as ReflectionType;
  const humor = interaction.options.getInteger('humor') ?? undefined;

  const _ref = await createReflection({ content: conteudo, type: tipo, mood: humor });

  const typeEmoji: Record<ReflectionType, string> = {
    reflection: '🧠',
    gratitude: '🙏',
    intention: '🎯',
    values: '⭐',
    mantra: '🔮',
  };
  const typeLabel: Record<ReflectionType, string> = {
    reflection: 'Reflexão',
    gratitude: 'Gratidão',
    intention: 'Intenção',
    values: 'Valores',
    mantra: 'Mantra',
  };

  const moodStr = humor
    ? ` · ${humor === 5 ? '😄' : humor === 4 ? '😊' : humor === 3 ? '😐' : humor === 2 ? '😔' : '😞'}`
    : '';
  const preview = conteudo.slice(0, 150) + (conteudo.length > 150 ? '...' : '');

  await interaction.editReply(
    `${typeEmoji[tipo]} **${typeLabel[tipo]} salva!**${moodStr}\n> ${preview}`,
  );
}

async function handleReflexaoHoje(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const today = await getTodayReflections();
  if (today.length === 0) {
    await interaction.editReply(
      '🧘 Nenhuma reflexão hoje ainda. Use `/reflexao add` para começar.',
    );
    return;
  }

  const typeEmoji: Record<ReflectionType, string> = {
    reflection: '🧠',
    gratitude: '🙏',
    intention: '🎯',
    values: '⭐',
    mantra: '🔮',
  };

  const lines = today.map((r) => {
    const emoji = typeEmoji[r.type] ?? '🧠';
    const preview = r.content.slice(0, 120) + (r.content.length > 120 ? '...' : '');
    return `${emoji} ${preview}`;
  });

  await interaction.editReply(
    `🧘 **Reflexões de hoje (${today.length}):**\n\n${lines.join('\n\n')}`,
  );
}

async function handleReflexaoHistorico(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const tipo = interaction.options.getString('tipo') as ReflectionType | null;
  const [refs, moodAvg] = await Promise.all([
    listReflections(tipo ?? undefined, 10),
    getWeeklyMoodAverage(),
  ]);

  if (refs.length === 0) {
    await interaction.editReply('🧠 Nenhuma reflexão encontrada.');
    return;
  }

  const typeEmoji: Record<ReflectionType, string> = {
    reflection: '🧠',
    gratitude: '🙏',
    intention: '🎯',
    values: '⭐',
    mantra: '🔮',
  };

  const moodLine = moodAvg != null ? `\n📊 Média interior (7d): **${moodAvg}/5**` : '';
  const lines = refs.map((r) => {
    const emoji = typeEmoji[r.type] ?? '🧠';
    const date = new Date(r.logged_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const preview = r.content.slice(0, 80) + (r.content.length > 80 ? '...' : '');
    return `${emoji} ${date}: ${preview}`;
  });

  await interaction.editReply(`🧘 **Reflexões recentes:**${moodLine}\n\n${lines.join('\n')}`);
}

async function handleReflexaoBuscar(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const query = interaction.options.getString('query', true);
  const results = await searchReflections(query);

  if (results.length === 0) {
    await interaction.editReply(`🔍 Nenhuma reflexão encontrada para **"${query}"**.`);
    return;
  }

  const lines = results.map((r) => {
    const date = new Date(r.logged_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const preview = r.content.slice(0, 100) + (r.content.length > 100 ? '...' : '');
    return `${date}: ${preview}`;
  });

  await interaction.editReply(
    `🔍 **${results.length} resultado(s) para "${query}":**\n\n${lines.join('\n\n')}`,
  );
}

async function handleValores(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const values = await listPersonalValues();
  if (values.length === 0) {
    await interaction.editReply('⭐ Nenhum valor pessoal cadastrado ainda.');
    return;
  }

  const lines = values.map((v, i) => {
    const desc = v.description ? `\n  _${v.description}_` : '';
    return `${i + 1}. **${v.name}** (prioridade ${v.priority}/10)${desc}`;
  });

  await interaction.editReply(`⭐ **Seus valores pessoais:**\n\n${lines.join('\n')}`);
}
