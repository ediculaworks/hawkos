import { bemCommand, documentoCommand, handleBem, handleDocumento } from '@hawk/module-assets';
import {
  agendaCommand,
  eventCommand,
  handleAgenda,
  handleEvent,
  handleRemind,
  remindCommand,
} from '@hawk/module-calendar';
import {
  certificadoCommand,
  experienciaCommand,
  formacaoCommand,
  handleCertificado,
  handleExperiencia,
  handleFormacao,
  handleHoras,
  handlePerfil,
  handleProjetos,
  handleSkill,
  horasCommand,
  perfilCommand,
  projetosCommand,
  skillCommand,
} from '@hawk/module-career';
// Phase 6
import { handleHobby, handleMidia, hobbyCommand, midiaCommand } from '@hawk/module-entertainment';
// Phase 1
import {
  gastaCommand,
  handleGasto,
  handleReceita,
  handleSaldo,
  receitaCommand,
  saldoCommand,
} from '@hawk/module-finances';
// Phase 3
import {
  corpoCommand,
  exameCommand,
  handleCorpo,
  handleExame,
  handleRemedio,
  handleSaude,
  handleSono,
  handleSubstancia,
  handleTreino,
  remedioCommand,
  saudeCommand,
  sonoCommand,
  substanciaCommand,
  treinoCommand,
} from '@hawk/module-health';
import { contaCommand, handleConta, handleMoradia, moradiaCommand } from '@hawk/module-housing';
import { diarioCommand, handleDiario } from '@hawk/module-journal';
// Phase 5
import { handleLivro, handleNota, livroCommand, notaCommand } from '@hawk/module-knowledge';
import {
  contratosCommand,
  handleContratos,
  handleObrigacoes,
  obrigacoesCommand,
} from '@hawk/module-legal';
import { handleMeta, handleTarefa, metaCommand, tarefaCommand } from '@hawk/module-objectives';
// Phase 4
import {
  aniversariosCommand,
  comoNosConhecemosCommand,
  contatosCommand,
  dormentesCommand,
  handleAniversarios,
  handleComoNosConhecemos,
  handleContatos,
  handleDormentes,
  handleInteracao,
  handleLembrar,
  handlePessoa,
  interacaoCommand,
  lembrarCommand,
  pessoaCommand,
} from '@hawk/module-people';
// Phase 2
import { habitoCommand, handleHabito } from '@hawk/module-routine';
import { handleSeguranca, segurancaCommand } from '@hawk/module-security';
import { handlePost, postCommand } from '@hawk/module-social';
import { handleReflexao, reflexaoCommand } from '@hawk/module-spirituality';
import { AuthorizationError } from '@hawk/shared';
import {
  type ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  type Message,
} from 'discord.js';
import { handleMessage } from '../handler.js';

const AUTHORIZED_USER_ID = process.env.DISCORD_AUTHORIZED_USER_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// ── Channel → Agent Mapping ──────────────────────────────────
// Format: DISCORD_CHANNEL_MAP=channelId1:agentTemplateId1,channelId2:agentTemplateId2
// Channels not in map but in allowed list use the default Hawk agent.

function parseChannelMap(): Map<string, string> {
  const map = new Map<string, string>();
  const raw = process.env.DISCORD_CHANNEL_MAP;
  if (raw) {
    for (const pair of raw.split(',')) {
      const [channelId, agentId] = pair.trim().split(':');
      if (channelId && agentId) {
        map.set(channelId.trim(), agentId.trim());
      }
    }
  }
  return map;
}

const channelAgentMap = parseChannelMap();

function getAllowedChannels(): Set<string> {
  const channels = [process.env.DISCORD_CHANNEL_GERAL].filter((id): id is string => Boolean(id));
  // Also allow any channel in the channel map
  for (const channelId of channelAgentMap.keys()) {
    channels.push(channelId);
  }
  return new Set(channels);
}

/**
 * Get the agent template ID for a Discord channel.
 * Returns undefined for channels using the default Hawk agent.
 */
export function getAgentForChannel(channelId: string): string | undefined {
  return channelAgentMap.get(channelId);
}

// ── Voice/Audio Transcription ────────────────────────────────

async function transcribeAudio(url: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[discord] No GROQ_API_KEY or OPENAI_API_KEY set, cannot transcribe audio');
    return null;
  }

  try {
    // Download the audio file
    const response = await fetch(url);
    if (!response.ok) return null;
    const audioBuffer = await response.arrayBuffer();

    // Use Groq Whisper (free, fast) or OpenAI Whisper
    const baseUrl = process.env.GROQ_API_KEY
      ? 'https://api.groq.com/openai/v1'
      : 'https://api.openai.com/v1';
    const model = process.env.GROQ_API_KEY ? 'whisper-large-v3' : 'whisper-1';

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'voice.ogg');
    formData.append('model', model);
    formData.append('language', 'pt');

    const result = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!result.ok) {
      console.error('[discord] Transcription failed:', result.status, await result.text());
      return null;
    }

    const data = (await result.json()) as { text?: string };
    return data.text?.trim() || null;
  } catch (err) {
    console.error('[discord] Transcription error:', err);
    return null;
  }
}

// Token/user checks deferred to startDiscordBot() — env vars loaded at runtime
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, async (c) => {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (guildId) {
    const guild = await c.guilds.fetch(guildId);
    await guild.commands.set([
      // Phase 1: Finances + Calendar
      gastaCommand,
      receitaCommand,
      saldoCommand,
      eventCommand,
      agendaCommand,
      remindCommand,
      // Phase 2: Routine + Journal + Objectives
      habitoCommand,
      diarioCommand,
      metaCommand,
      tarefaCommand,
      // Phase 4: People + Career + Legal
      pessoaCommand,
      interacaoCommand,
      aniversariosCommand,
      contatosCommand,
      comoNosConhecemosCommand,
      lembrarCommand,
      dormentesCommand,
      horasCommand,
      projetosCommand,
      perfilCommand,
      experienciaCommand,
      formacaoCommand,
      skillCommand,
      certificadoCommand,
      obrigacoesCommand,
      contratosCommand,
      // Phase 5: Knowledge + Assets + Housing + Security
      notaCommand,
      livroCommand,
      bemCommand,
      documentoCommand,
      moradiaCommand,
      contaCommand,
      segurancaCommand,
      // Phase 3: Health
      saudeCommand,
      sonoCommand,
      treinoCommand,
      corpoCommand,
      remedioCommand,
      substanciaCommand,
      exameCommand,
      // Phase 6: Entertainment + Social + Spirituality
      midiaCommand,
      hobbyCommand,
      postCommand,
      reflexaoCommand,
    ]);
  } else {
  }
  // Automations are now started from index.ts (single source of truth)
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (message.author.id !== AUTHORIZED_USER_ID) return;
  if (!getAllowedChannels().has(message.channelId)) return;

  if ('sendTyping' in message.channel) {
    await message.channel.sendTyping();
  }

  try {
    let textContent = message.content;
    const imageUrls: string[] = [];
    let wasTranscribed = false;

    // Process attachments (voice messages, images)
    if (message.attachments.size > 0) {
      for (const attachment of message.attachments.values()) {
        const ct = attachment.contentType ?? '';

        // Voice messages (Discord sends as audio/ogg or video/ogg)
        if (ct.startsWith('audio/') || ct === 'video/ogg' || attachment.name?.endsWith('.ogg')) {
          const transcription = await transcribeAudio(attachment.url);
          if (transcription) {
            textContent = transcription;
            wasTranscribed = true;
          } else {
            await message.reply(
              'Não consegui transcrever o áudio. Verifique se GROQ_API_KEY ou OPENAI_API_KEY está configurado.',
            );
            return;
          }
        }

        // Images (receipts, screenshots, documents)
        if (ct.startsWith('image/')) {
          imageUrls.push(attachment.url);
        }
      }
    }

    // If no text and no transcription, skip
    if (!textContent && imageUrls.length === 0) return;

    // Pass to handler with optional attachments
    const attachments =
      imageUrls.length > 0 ? imageUrls.map((url) => ({ type: 'image' as const, url })) : undefined;

    const response = await handleMessage(
      textContent || 'Descreva esta imagem',
      message.channelId,
      attachments,
    );

    // Prefix transcribed audio with the transcription
    const finalResponse = wasTranscribed ? `*"${textContent}"*\n\n${response}` : response;

    if (finalResponse.length <= 2000) {
      await message.reply(finalResponse);
    } else {
      const chunks = finalResponse.match(/.{1,2000}/gs) ?? [finalResponse];
      const channel = message.channel;
      if (channel && 'send' in channel && typeof channel.send === 'function') {
        for (const chunk of chunks) {
          await channel.send(chunk);
        }
      }
    }
  } catch (err) {
    if (err instanceof AuthorizationError) return;
    await message.reply('Erro interno. Tente novamente.');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.user.id !== AUTHORIZED_USER_ID) {
    await interaction.reply({ content: 'Não autorizado.', ephemeral: true });
    return;
  }

  const cmd = interaction as ChatInputCommandInteraction;
  try {
    switch (interaction.commandName) {
      // Phase 1: Finances
      case 'gasto':
        await handleGasto(cmd);
        break;
      case 'receita':
        await handleReceita(cmd);
        break;
      case 'saldo':
        await handleSaldo(cmd);
        break;
      // Phase 1: Calendar
      case 'event':
        await handleEvent(cmd);
        break;
      case 'agenda':
        await handleAgenda(cmd);
        break;
      case 'remind':
        await handleRemind(cmd);
        break;
      // Phase 2: Routine
      case 'habito':
        await handleHabito(cmd);
        break;
      // Phase 2: Journal
      case 'diario':
        await handleDiario(cmd);
        break;
      // Phase 2: Objectives + Tasks
      case 'meta':
        await handleMeta(cmd);
        break;
      case 'tarefa':
        await handleTarefa(cmd);
        break;
      // Phase 4: People / CRM
      case 'pessoa':
        await handlePessoa(cmd);
        break;
      case 'interacao':
        await handleInteracao(cmd);
        break;
      case 'aniversarios':
        await handleAniversarios(cmd);
        break;
      case 'contatos':
        await handleContatos(cmd);
        break;
      case 'como-nos-conhecemos':
        await handleComoNosConhecemos(cmd);
        break;
      case 'lembrar':
        await handleLembrar(cmd);
        break;
      case 'dormentes':
        await handleDormentes(cmd);
        break;
      // Phase 4: Career
      case 'horas':
        await handleHoras(cmd);
        break;
      case 'projetos':
        await handleProjetos(cmd);
        break;
      case 'perfil':
        await handlePerfil(cmd);
        break;
      case 'experiencia':
        await handleExperiencia(cmd);
        break;
      case 'formacao':
        await handleFormacao(cmd);
        break;
      case 'skill':
        await handleSkill(cmd);
        break;
      case 'certificado':
        await handleCertificado(cmd);
        break;
      // Phase 4: Legal
      case 'obrigacoes':
        await handleObrigacoes(cmd);
        break;
      case 'contratos':
        await handleContratos(cmd);
        break;
      // Phase 5: Knowledge
      case 'nota':
        await handleNota(cmd);
        break;
      case 'livro':
        await handleLivro(cmd);
        break;
      // Phase 5: Assets
      case 'bem':
        await handleBem(cmd);
        break;
      case 'documento':
        await handleDocumento(cmd);
        break;
      // Phase 5: Housing
      case 'moradia':
        await handleMoradia(cmd);
        break;
      case 'conta':
        await handleConta(cmd);
        break;
      // Phase 5: Security
      case 'seguranca':
        await handleSeguranca(cmd);
        break;
      // Phase 3: Health
      case 'saude':
        await handleSaude(cmd);
        break;
      case 'sono':
        await handleSono(cmd);
        break;
      case 'treino':
        await handleTreino(cmd);
        break;
      case 'corpo':
        await handleCorpo(cmd);
        break;
      case 'remedio':
        await handleRemedio(cmd);
        break;
      case 'substancia':
        await handleSubstancia(cmd);
        break;
      case 'exame':
        await handleExame(cmd);
        break;
      // Phase 6: Entertainment
      case 'midia':
        await handleMidia(cmd);
        break;
      case 'hobby':
        await handleHobby(cmd);
        break;
      // Phase 6: Social
      case 'post':
        await handlePost(cmd);
        break;
      // Phase 6: Spirituality
      case 'reflexao':
        await handleReflexao(cmd);
        break;
      default:
        await interaction.reply({ content: 'Comando desconhecido.', ephemeral: true });
    }
  } catch (_err) {
    if (interaction.isRepliable()) {
      await interaction.reply({
        content: 'Erro ao processar comando. Tente novamente.',
        ephemeral: true,
      });
    }
  }
});

export async function sendToChannel(channelId: string, content: string): Promise<void> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    return;
  }
  if ('send' in channel && typeof channel.send === 'function') {
    if (content.length <= 2000) {
      await channel.send(content);
    } else {
      const chunks = content.match(/.{1,2000}/gs) ?? [content];
      for (const chunk of chunks) {
        await channel.send(chunk);
      }
    }
  }
}

export async function startDiscordBot() {
  const token = BOT_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('Missing DISCORD_BOT_TOKEN');
  if (!AUTHORIZED_USER_ID && !process.env.DISCORD_AUTHORIZED_USER_ID)
    throw new Error('Missing DISCORD_AUTHORIZED_USER_ID');
  await client.login(token);
}

export function disconnectDiscord() {
  if (client.isReady()) {
    client.destroy();
  }
}
