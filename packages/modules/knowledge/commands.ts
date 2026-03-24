import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  createBook,
  createNote,
  findBookByTitle,
  listBooks,
  listRecentNotes,
  searchNotes,
  updateBookStatus,
} from './queries';
import type { BookStatus, NoteType } from './types';

export const notaCommand = new SlashCommandBuilder()
  .setName('nota')
  .setDescription('Capturar e buscar notas no second brain')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Salvar nota ou insight')
      .addStringOption((opt) =>
        opt.setName('conteudo').setDescription('Conteúdo da nota').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Tipo de nota')
          .setRequired(false)
          .addChoices(
            { name: 'Nota', value: 'note' },
            { name: 'Insight', value: 'insight' },
            { name: 'Referência', value: 'reference' },
            { name: 'Citação', value: 'quote' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('fonte').setDescription('Fonte (livro, artigo, podcast...)').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('titulo').setDescription('Título da nota').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('buscar')
      .setDescription('Buscar em notas salvas')
      .addStringOption((opt) =>
        opt.setName('query').setDescription('Termos de busca').setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName('recentes').setDescription('Ver últimas 10 notas'));

export const livroCommand = new SlashCommandBuilder()
  .setName('livro')
  .setDescription('Gerenciar lista de leitura')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar livro à lista')
      .addStringOption((opt) =>
        opt.setName('titulo').setDescription('Título do livro').setRequired(true),
      )
      .addStringOption((opt) => opt.setName('autor').setDescription('Autor').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('lendo')
      .setDescription('Marcar livro como lendo')
      .addStringOption((opt) =>
        opt
          .setName('titulo')
          .setDescription('Título do livro')
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('done')
      .setDescription('Marcar livro como lido')
      .addStringOption((opt) =>
        opt
          .setName('titulo')
          .setDescription('Título do livro')
          .setRequired(true)
          .setAutocomplete(true),
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
        opt.setName('resumo').setDescription('Nota geral sobre o livro').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar livros (todos os status)'));

// ─── Handlers /nota ───────────────────────────────────────────────────────────

export async function handleNota(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleNotaAdd(interaction);
  if (sub === 'buscar') return handleNotaBuscar(interaction);
  if (sub === 'recentes') return handleNotaRecentes(interaction);
}

async function handleNotaAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const conteudo = interaction.options.getString('conteudo', true);
  const tipo = (interaction.options.getString('tipo') ?? 'note') as NoteType;
  const fonte = interaction.options.getString('fonte') ?? undefined;
  const titulo = interaction.options.getString('titulo') ?? undefined;

  const _note = await createNote({ content: conteudo, type: tipo, source: fonte, title: titulo });

  const typeEmoji: Record<NoteType, string> = {
    note: '📝',
    insight: '💡',
    reference: '🔗',
    book_note: '📚',
    quote: '💬',
    bookmark: '🔖',
  };

  const sourceStr = fonte ? `\n📖 Fonte: ${fonte}` : '';
  const preview = conteudo.slice(0, 150) + (conteudo.length > 150 ? '...' : '');

  await interaction.editReply(`${typeEmoji[tipo]} **Nota salva!**${sourceStr}\n> ${preview}`);
}

async function handleNotaBuscar(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const query = interaction.options.getString('query', true);
  const results = await searchNotes(query, 5);

  if (results.length === 0) {
    await interaction.editReply(`🔍 Nenhum resultado para **"${query}"**.`);
    return;
  }

  const lines = results.map((n) => {
    const date = new Date(n.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const title = n.title ? `**${n.title}** · ` : '';
    const preview = n.content.slice(0, 100) + (n.content.length > 100 ? '...' : '');
    return `${title}${date}\n> ${preview}`;
  });

  await interaction.editReply(
    `🔍 **${results.length} resultado(s) para "${query}":**\n\n${lines.join('\n\n')}`,
  );
}

async function handleNotaRecentes(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const notes = await listRecentNotes(10);
  if (notes.length === 0) {
    await interaction.editReply('📝 Nenhuma nota ainda. Use `/nota add` para capturar.');
    return;
  }

  const lines = notes.map((n) => {
    const date = new Date(n.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const title = n.title ? `**${n.title}**` : `${n.content.slice(0, 40)}...`;
    return `• ${date} ${title}`;
  });

  await interaction.editReply(`📝 **Notas recentes:**\n\n${lines.join('\n')}`);
}

// ─── Handlers /livro ──────────────────────────────────────────────────────────

export async function handleLivro(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleLivroAdd(interaction);
  if (sub === 'lendo') return handleLivroLendo(interaction);
  if (sub === 'done') return handleLivroDone(interaction);
  if (sub === 'list') return handleLivroList(interaction);
}

async function handleLivroAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  const titulo = interaction.options.getString('titulo', true);
  const autor = interaction.options.getString('autor') ?? undefined;
  const book = await createBook({ title: titulo, author: autor });
  const autorStr = book.author ? ` · ${book.author}` : '';
  await interaction.editReply(`📚 **${book.title}**${autorStr} adicionado à lista!`);
}

async function handleLivroLendo(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  const titulo = interaction.options.getString('titulo', true);
  const book = await findBookByTitle(titulo);
  if (!book) {
    await interaction.editReply(`❌ **"${titulo}"** não encontrado.`);
    return;
  }
  await updateBookStatus(book.id, 'reading');
  await interaction.editReply(`📖 Lendo agora: **${book.title}**`);
}

async function handleLivroDone(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  const titulo = interaction.options.getString('titulo', true);
  const nota = interaction.options.getInteger('nota') ?? undefined;
  const resumo = interaction.options.getString('resumo') ?? undefined;
  const book = await findBookByTitle(titulo);
  if (!book) {
    await interaction.editReply(`❌ **"${titulo}"** não encontrado.`);
    return;
  }
  await updateBookStatus(book.id, 'completed', resumo);
  const stars = nota ? ` · ${'★'.repeat(nota)}${'☆'.repeat(5 - nota)}` : '';
  await interaction.editReply(`✅ **${book.title}** concluído!${stars}`);
}

async function handleLivroList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  const books = await listBooks();
  if (books.length === 0) {
    await interaction.editReply('📚 Nenhum livro na lista.');
    return;
  }

  const statusEmoji: Record<BookStatus, string> = {
    want_to_read: '📋',
    reading: '📖',
    completed: '✅',
    abandoned: '🚫',
  };
  const grouped: Record<string, string[]> = {
    reading: [],
    want_to_read: [],
    completed: [],
    abandoned: [],
  };
  for (const b of books) {
    const emoji = statusEmoji[b.status] ?? '📋';
    const rating = b.rating ? ` ${'★'.repeat(b.rating)}` : '';
    grouped[b.status]?.push(`${emoji} **${b.title}**${b.author ? ` · ${b.author}` : ''}${rating}`);
  }

  const sections: string[] = [];
  if (grouped.reading?.length) sections.push(`**Lendo:**\n${grouped.reading.join('\n')}`);
  if (grouped.want_to_read?.length)
    sections.push(`**Quer ler:**\n${grouped.want_to_read.slice(0, 5).join('\n')}`);
  if (grouped.completed?.length)
    sections.push(
      `**Lidos (${grouped.completed.length}):** ${grouped.completed.slice(0, 3).join(', ')}`,
    );

  await interaction.editReply(sections.join('\n\n') || 'Lista vazia.');
}
