import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  createHobbyLog,
  createMedia,
  findMediaByTitle,
  getHobbyStats,
  listHobbyLogs,
  listMedia,
  updateMediaStatus,
} from './queries';
import type { MediaStatus, MediaType } from './types';

export const midiaCommand = new SlashCommandBuilder()
  .setName('midia')
  .setDescription('Gerenciar filmes, séries, podcasts e outros')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar à lista')
      .addStringOption((opt) => opt.setName('titulo').setDescription('Título').setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Tipo')
          .setRequired(true)
          .addChoices(
            { name: 'Filme', value: 'movie' },
            { name: 'Série', value: 'series' },
            { name: 'Jogo', value: 'game' },
            { name: 'Podcast', value: 'podcast' },
            { name: 'Álbum', value: 'music_album' },
            { name: 'Outros', value: 'outros' },
          ),
      )
      .addStringOption((opt) =>
        opt
          .setName('plataforma')
          .setDescription('Plataforma (ex: Netflix, Spotify)')
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('done')
      .setDescription('Marcar como assistido/concluído')
      .addStringOption((opt) =>
        opt.setName('titulo').setDescription('Título (busca parcial)').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('nota')
          .setDescription('Avaliação (1-5 ★)')
          .setMinValue(1)
          .setMaxValue(5)
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('opiniao').setDescription('Opinião rápida').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Ver lista')
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('Filtrar por status')
          .setRequired(false)
          .addChoices(
            { name: 'Quero ver', value: 'want' },
            { name: 'Assistindo', value: 'watching' },
            { name: 'Concluído', value: 'completed' },
          ),
      )
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Filtrar por tipo')
          .setRequired(false)
          .addChoices(
            { name: 'Filme', value: 'movie' },
            { name: 'Série', value: 'series' },
            { name: 'Jogo', value: 'game' },
            { name: 'Podcast', value: 'podcast' },
          ),
      ),
  );

export const hobbyCommand = new SlashCommandBuilder()
  .setName('hobby')
  .setDescription('Registrar atividades de lazer')
  .addSubcommand((sub) =>
    sub
      .setName('log')
      .setDescription('Registrar sessão de hobby')
      .addStringOption((opt) =>
        opt.setName('atividade').setDescription('Ex: skate, violão, desenho').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt.setName('minutos').setDescription('Duração em minutos').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Observação').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('stats').setDescription('Ver hobbies dos últimos 30 dias'))
  .addSubcommand((sub) =>
    sub
      .setName('historico')
      .setDescription('Ver sessões recentes')
      .addStringOption((opt) =>
        opt.setName('atividade').setDescription('Filtrar por atividade').setRequired(false),
      ),
  );

// ─── Handlers /midia ──────────────────────────────────────────────────────────

export async function handleMidia(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleMidiaAdd(interaction);
  if (sub === 'done') return handleMidiaDone(interaction);
  if (sub === 'list') return handleMidiaList(interaction);
}

async function handleMidiaAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const titulo = interaction.options.getString('titulo', true);
  const tipo = interaction.options.getString('tipo', true) as MediaType;
  const plataforma = interaction.options.getString('plataforma') ?? undefined;

  const item = await createMedia({ title: titulo, type: tipo, platform: plataforma });

  const typeEmoji: Record<MediaType, string> = {
    movie: '🎬',
    series: '📺',
    book_fiction: '📖',
    game: '🎮',
    podcast: '🎙️',
    music_album: '🎵',
    outros: '🎭',
  };

  const platStr = item.platform ? ` · ${item.platform}` : '';
  await interaction.editReply(`${typeEmoji[tipo]} **${item.title}**${platStr} adicionado à lista!`);
}

async function handleMidiaDone(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const titulo = interaction.options.getString('titulo', true);
  const nota = interaction.options.getInteger('nota') ?? undefined;
  const opiniao = interaction.options.getString('opiniao') ?? undefined;

  const found = await findMediaByTitle(titulo);
  if (!found) {
    await interaction.editReply(`❌ **"${titulo}"** não encontrado na lista.`);
    return;
  }

  const updated = await updateMediaStatus(found.id, 'completed', nota, opiniao);
  const stars = nota ? ` · ${'★'.repeat(nota)}${'☆'.repeat(5 - nota)}` : '';
  await interaction.editReply(`✅ **${updated.title}** concluído!${stars}`);
}

async function handleMidiaList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const status = interaction.options.getString('status') as MediaStatus | null;
  const tipo = interaction.options.getString('tipo') as MediaType | null;

  const items = await listMedia(tipo ?? undefined, status ?? undefined);
  if (items.length === 0) {
    await interaction.editReply('🎬 Lista vazia. Use `/midia add` para adicionar.');
    return;
  }

  const typeEmoji: Record<MediaType, string> = {
    movie: '🎬',
    series: '📺',
    book_fiction: '📖',
    game: '🎮',
    podcast: '🎙️',
    music_album: '🎵',
    outros: '🎭',
  };
  const statusEmoji: Record<MediaStatus, string> = {
    want: '📋',
    watching: '▶️',
    completed: '✅',
    abandoned: '🚫',
  };

  const grouped: Record<string, string[]> = { watching: [], want: [], completed: [] };
  for (const item of items) {
    const e = typeEmoji[item.type] ?? '🎭';
    const s = statusEmoji[item.status] ?? '📋';
    const stars = item.rating ? ` ${'★'.repeat(item.rating)}` : '';
    const plat = item.platform ? ` · ${item.platform}` : '';
    const line = `${s} ${e} **${item.title}**${plat}${stars}`;
    grouped[item.status]?.push(line);
  }

  const sections: string[] = [];
  if (grouped.watching?.length) sections.push(`**Assistindo:**\n${grouped.watching.join('\n')}`);
  if (grouped.want?.length)
    sections.push(
      `**Quero ver (${grouped.want.length}):**\n${grouped.want.slice(0, 8).join('\n')}`,
    );
  if (grouped.completed?.length) sections.push(`**Concluídos:** ${grouped.completed.length} items`);

  await interaction.editReply(sections.join('\n\n') || 'Lista vazia.');
}

// ─── Handlers /hobby ──────────────────────────────────────────────────────────

export async function handleHobby(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'log') return handleHobbyLog(interaction);
  if (sub === 'stats') return handleHobbyStats(interaction);
  if (sub === 'historico') return handleHobbyHistorico(interaction);
}

async function handleHobbyLog(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const atividade = interaction.options.getString('atividade', true);
  const minutos = interaction.options.getInteger('minutos') ?? undefined;
  const nota = interaction.options.getString('nota') ?? undefined;

  const log = await createHobbyLog({ activity: atividade, duration_min: minutos, notes: nota });

  const durStr = log.duration_min ? ` · ${log.duration_min}min` : '';
  const notaStr = nota ? `\n📝 ${nota}` : '';
  await interaction.editReply(`🎯 **${atividade}** registrado!${durStr}${notaStr}`);
}

async function handleHobbyStats(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const stats = await getHobbyStats();
  if (stats.length === 0) {
    await interaction.editReply('🎯 Nenhum hobby registrado nos últimos 30 dias.');
    return;
  }

  const lines = stats.map((s) => {
    const dur =
      s.total_min > 0
        ? ` · ${Math.round(s.total_min / 60)}h${s.total_min % 60 > 0 ? `${s.total_min % 60}min` : ''}`
        : '';
    return `• **${s.activity}** — ${s.sessions} sessão(ões)${dur}`;
  });

  await interaction.editReply(`🎯 **Hobbies (últimos 30 dias):**\n\n${lines.join('\n')}`);
}

async function handleHobbyHistorico(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const atividade = interaction.options.getString('atividade') ?? undefined;
  const logs = await listHobbyLogs(atividade);

  if (logs.length === 0) {
    await interaction.editReply('🎯 Nenhum registro encontrado.');
    return;
  }

  const lines = logs.map((l) => {
    const date = new Date(l.logged_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const dur = l.duration_min ? ` · ${l.duration_min}min` : '';
    const nota = l.notes ? ` — ${l.notes}` : '';
    return `• ${date} **${l.activity}**${dur}${nota}`;
  });

  await interaction.editReply(`🎯 **Histórico de hobbies:**\n\n${lines.join('\n')}`);
}
