import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { embedMemory } from './embeddings';
import { createMemory } from './queries';
import { commitSession, generateMemoryLayers } from './session-commit';
import type { MemoryType } from './types';

const MEMORY_TYPE_CHOICES = [
  { name: 'Perfil (quem sou)', value: 'profile' },
  { name: 'Preferência (gosto/não gosto)', value: 'preference' },
  { name: 'Entidade (pessoa, lugar, projeto)', value: 'entity' },
  { name: 'Evento (decisão, marco)', value: 'event' },
  { name: 'Correção (erro cometido)', value: 'case' },
  { name: 'Padrão (processo habitual)', value: 'pattern' },
  { name: 'Regra (comportamento obrigatório)', value: 'procedure' },
] as const;

/**
 * /memorizar — salva uma memória diretamente, sem passar pelo LLM
 */
export const memorizarCommand = new SlashCommandBuilder()
  .setName('memorizar')
  .setDescription('Salvar uma memória manualmente')
  .addStringOption((opt) =>
    opt
      .setName('conteudo')
      .setDescription('O que devo lembrar')
      .setRequired(true)
      .setMaxLength(500),
  )
  .addStringOption((opt) =>
    opt
      .setName('tipo')
      .setDescription('Tipo de memória (padrão: preferência)')
      .setRequired(false)
      .addChoices(...MEMORY_TYPE_CHOICES),
  );

/**
 * /consolidar — extrai e arquiva memórias da sessão atual imediatamente
 */
export const consolidarCommand = new SlashCommandBuilder()
  .setName('consolidar')
  .setDescription('Extrair e salvar memórias desta conversa agora');

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function handleMemorizar(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const content = interaction.options.getString('conteudo', true);
  const memoryType = (interaction.options.getString('tipo') ?? 'preference') as MemoryType;

  const categoryMap: Record<string, string> = {
    profile: 'fact',
    preference: 'preference',
    entity: 'relationship',
    event: 'fact',
    case: 'correction',
    pattern: 'pattern',
    procedure: 'correction',
  };

  try {
    const memory = await createMemory({
      category: (categoryMap[memoryType] ?? 'fact') as
        | 'preference'
        | 'fact'
        | 'pattern'
        | 'insight'
        | 'correction'
        | 'goal'
        | 'relationship',
      content,
      importance: 7,
      status: 'active',
    });

    // Generate embedding + layers async — don't block the reply
    embedMemory(memory.id, content).catch((err) =>
      console.error('[memory/commands] embed failed:', err),
    );
    generateMemoryLayers(memory.id, content, memoryType, null).catch((err) =>
      console.error('[memory/commands] layers failed:', err),
    );

    const typeLabel = MEMORY_TYPE_CHOICES.find((c) => c.value === memoryType)?.name ?? memoryType;

    await interaction.editReply(`Memorizado: **[${typeLabel}]** ${content}`);
  } catch (err) {
    await interaction.editReply(`Erro ao salvar memória: ${err}`);
  }
}

export async function handleConsolidar(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  // Discord uses channelId as the session identifier
  const sessionId = interaction.channelId;

  try {
    const result = await commitSession(sessionId);

    if (result.memoriesCreated === 0 && result.memoriesMerged === 0) {
      await interaction.editReply(
        'Sessão arquivada — nenhuma memória nova encontrada nesta conversa.',
      );
      return;
    }

    const parts: string[] = ['Sessão consolidada:'];
    if (result.memoriesCreated > 0)
      parts.push(
        `${result.memoriesCreated} memória${result.memoriesCreated !== 1 ? 's' : ''} salva${result.memoriesCreated !== 1 ? 's' : ''}`,
      );
    if (result.memoriesMerged > 0)
      parts.push(`${result.memoriesMerged} fundida${result.memoriesMerged !== 1 ? 's' : ''}`);
    if (result.memoriesSkipped > 0)
      parts.push(
        `${result.memoriesSkipped} duplicada${result.memoriesSkipped !== 1 ? 's' : ''} ignorada${result.memoriesSkipped !== 1 ? 's' : ''}`,
      );

    await interaction.editReply(parts.join(' · '));
  } catch (err) {
    await interaction.editReply(`Erro ao consolidar sessão: ${err}`);
  }
}
