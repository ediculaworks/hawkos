/**
 * Channel abstraction for multi-channel support.
 *
 * Each channel (Discord, Web, Telegram, etc.) implements this interface.
 * Capabilities allow the handler to adapt behavior per channel.
 */

export interface ChannelCapabilities {
  /** Maximum message length (0 = unlimited) */
  maxMessageLength: number;
  /** Supports typing indicators */
  typing: boolean;
  /** Supports rich formatting (Markdown, embeds) */
  richFormatting: boolean;
  /** Supports tables */
  tables: boolean;
  /** Supports headings (#, ##) */
  headings: boolean;
  /** Supports inline images */
  images: boolean;
  /** Supports audio messages / transcription */
  audio: boolean;
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports reactions / emoji responses */
  reactions: boolean;
  /** Supports threaded replies */
  threads: boolean;
}

export interface Channel {
  readonly name: string;
  readonly capabilities: ChannelCapabilities;
  connect(): Promise<void>;
  send(channelId: string, content: string): Promise<void>;
  sendTyping?(channelId: string): Promise<void>;
  ownsJid(jid: string): boolean;
  isConnected(): boolean;
  disconnect(): Promise<void>;
}

// ── Default Capabilities ─────────────────────────────────────────────────────

export const DISCORD_CAPABILITIES: ChannelCapabilities = {
  maxMessageLength: 2000,
  typing: true,
  richFormatting: true,
  tables: false,
  headings: false,
  images: true,
  audio: true,
  streaming: true,
  reactions: true,
  threads: true,
};

export const WEB_CAPABILITIES: ChannelCapabilities = {
  maxMessageLength: 0, // unlimited
  typing: true,
  richFormatting: true,
  tables: true,
  headings: true,
  images: true,
  audio: false,
  streaming: true,
  reactions: false,
  threads: false,
};

export const TELEGRAM_CAPABILITIES: ChannelCapabilities = {
  maxMessageLength: 4096,
  typing: true,
  richFormatting: true,
  tables: false,
  headings: false,
  images: true,
  audio: true,
  streaming: false,
  reactions: true,
  threads: true,
};

export const WHATSAPP_CAPABILITIES: ChannelCapabilities = {
  maxMessageLength: 65536,
  typing: true,
  richFormatting: true,
  tables: false,
  headings: false,
  images: true,
  audio: true,
  streaming: false,
  reactions: true,
  threads: false,
};

/**
 * Generate platform-specific formatting hints from channel capabilities.
 * Used by the handler to inject formatting instructions into the system prompt.
 */
export function getFormattingHints(capabilities: ChannelCapabilities, channelName: string): string {
  const hints: string[] = [`## Formatação (${channelName})`];

  if (capabilities.maxMessageLength > 0) {
    hints.push(
      `- Limite de ${capabilities.maxMessageLength} caracteres por mensagem. Divida respostas longas.`,
    );
  } else {
    hints.push('- Sem limite de caracteres. Pode usar respostas detalhadas.');
  }

  if (capabilities.richFormatting) {
    hints.push('- Use **negrito** e *itálico* para ênfase. Use `code` para termos técnicos.');
  }

  if (capabilities.tables) {
    hints.push('- Tabelas Markdown são suportadas para dados comparativos.');
  } else {
    hints.push('- Tabelas não renderizam — use listas formatadas.');
  }

  if (capabilities.headings) {
    hints.push('- Use headings (#, ##) para organizar respostas longas.');
  } else {
    hints.push('- Não use headings (#) — não renderizam neste canal.');
  }

  hints.push('- Emojis: use com moderação para categorizar (✅ ❌ ⚠️ 📊 💰).');

  return hints.join('\n');
}
