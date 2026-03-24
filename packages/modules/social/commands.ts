import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createPost, getPostStats, listPosts, publishPost } from './queries';
import type { PostStatus, SocialPlatform } from './types';

export const postCommand = new SlashCommandBuilder()
  .setName('post')
  .setDescription('Gerenciar ideias e posts de redes sociais')
  .addSubcommand((sub) =>
    sub
      .setName('idea')
      .setDescription('Registrar ideia de post')
      .addStringOption((opt) =>
        opt
          .setName('plataforma')
          .setDescription('Rede social')
          .setRequired(true)
          .addChoices(
            { name: 'Instagram', value: 'instagram' },
            { name: 'LinkedIn', value: 'linkedin' },
            { name: 'Twitter/X', value: 'twitter' },
            { name: 'YouTube', value: 'youtube' },
            { name: 'Outros', value: 'outros' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('conteudo').setDescription('Ideia ou rascunho').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('tags').setDescription('Tags separadas por vírgula').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Ver ideias e rascunhos')
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('Filtrar por status')
          .setRequired(false)
          .addChoices(
            { name: 'Ideia', value: 'idea' },
            { name: 'Rascunho', value: 'draft' },
            { name: 'Publicado', value: 'published' },
          ),
      )
      .addStringOption((opt) =>
        opt
          .setName('plataforma')
          .setDescription('Filtrar por plataforma')
          .setRequired(false)
          .addChoices(
            { name: 'Instagram', value: 'instagram' },
            { name: 'LinkedIn', value: 'linkedin' },
            { name: 'Twitter/X', value: 'twitter' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('publicar')
      .setDescription('Marcar post como publicado')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID do post (primeiros 8 chars)').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('url').setDescription('Link do post publicado').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('stats').setDescription('Ver resumo por plataforma'));

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handlePost(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'idea') return handlePostIdea(interaction);
  if (sub === 'list') return handlePostList(interaction);
  if (sub === 'publicar') return handlePostPublicar(interaction);
  if (sub === 'stats') return handlePostStats(interaction);
}

async function handlePostIdea(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const plataforma = interaction.options.getString('plataforma', true) as SocialPlatform;
  const conteudo = interaction.options.getString('conteudo', true);
  const tagsRaw = interaction.options.getString('tags') ?? '';
  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const post = await createPost({ platform: plataforma, content: conteudo, status: 'idea', tags });

  const platEmoji: Record<SocialPlatform, string> = {
    instagram: '📸',
    linkedin: '💼',
    twitter: '🐦',
    youtube: '▶️',
    tiktok: '🎵',
    outros: '📱',
  };

  const tagsStr = tags.length > 0 ? `\n🏷️ ${tags.join(', ')}` : '';
  const preview = conteudo.slice(0, 120) + (conteudo.length > 120 ? '...' : '');
  await interaction.editReply(
    `${platEmoji[plataforma]} **Ideia salva!** \`${post.id.slice(0, 8)}\`\n> ${preview}${tagsStr}`,
  );
}

async function handlePostList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const status = interaction.options.getString('status') as PostStatus | null;
  const plataforma = interaction.options.getString('plataforma') as SocialPlatform | null;

  const posts = await listPosts(plataforma ?? undefined, status ?? undefined);
  if (posts.length === 0) {
    await interaction.editReply('📱 Nenhum post encontrado. Use `/post idea` para criar.');
    return;
  }

  const statusEmoji: Record<PostStatus, string> = {
    idea: '💡',
    draft: '📝',
    scheduled: '📅',
    published: '✅',
  };
  const platEmoji: Record<SocialPlatform, string> = {
    instagram: '📸',
    linkedin: '💼',
    twitter: '🐦',
    youtube: '▶️',
    tiktok: '🎵',
    outros: '📱',
  };

  const lines = posts.slice(0, 10).map((p) => {
    const s = statusEmoji[p.status] ?? '💡';
    const pl = platEmoji[p.platform as SocialPlatform] ?? '📱';
    const preview = p.content ? p.content.slice(0, 60) + (p.content.length > 60 ? '...' : '') : '—';
    return `${s} ${pl} \`${p.id.slice(0, 8)}\` ${preview}`;
  });

  await interaction.editReply(`📱 **Posts (${posts.length}):**\n\n${lines.join('\n')}`);
}

async function handlePostPublicar(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const id = interaction.options.getString('id', true);
  const url = interaction.options.getString('url') ?? undefined;

  const posts = await listPosts();
  const found = posts.find((p) => p.id.startsWith(id));
  if (!found) {
    await interaction.editReply(`❌ Post \`${id}\` não encontrado.`);
    return;
  }

  const updated = await publishPost(found.id, url);
  const urlStr = updated.url ? `\n🔗 ${updated.url}` : '';
  await interaction.editReply(`✅ Post publicado!${urlStr}`);
}

async function handlePostStats(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const stats = await getPostStats();
  if (stats.length === 0) {
    await interaction.editReply('📱 Nenhum post registrado ainda.');
    return;
  }

  const lines = stats.map((s) => {
    return `**${s.platform}** · 💡${s.ideas} ideias · 📝${s.drafts} rascunhos · ✅${s.published} publicados`;
  });

  await interaction.editReply(`📱 **Resumo por plataforma:**\n\n${lines.join('\n')}`);
}
