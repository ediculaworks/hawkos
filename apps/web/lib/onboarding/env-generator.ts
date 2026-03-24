import { generateAgentPort, generateSecret, getSlotConfig } from './slot-manager';
import type { DiscordConfig, OpenRouterConfig } from './types';

export interface EnvConfig {
  slot: string;
  discord?: DiscordConfig;
  openrouter: OpenRouterConfig;
  groqApiKey?: string;
  googleCalendar?: {
    clientId: string;
    clientSecret: string;
  };
}

export function generateEnvFile(config: EnvConfig): string {
  const slotConfig = getSlotConfig(config.slot);

  if (!slotConfig) {
    throw new Error(`Slot ${config.slot} not configured`);
  }

  const agentPort = generateAgentPort(config.slot);
  const agentSecret = generateSecret();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return `# Hawk OS - Tenant Configuration
# Slot: ${config.slot}
# NÃO COMMIT ESTE ARQUIVO

# Supabase
SUPABASE_URL=${slotConfig.supabaseUrl}
SUPABASE_ANON_KEY=${slotConfig.anonKey}
SUPABASE_SERVICE_ROLE_KEY=${slotConfig.serviceRoleKey}

# Discord
DISCORD_BOT_TOKEN=${config.discord?.botToken || ''}
DISCORD_CLIENT_ID=${config.discord?.clientId || ''}
DISCORD_GUILD_ID=${config.discord?.guildId || ''}
DISCORD_CHANNEL_ID=${config.discord?.channelId || ''}
DISCORD_CHANNEL_GERAL=${config.discord?.channelId || ''}
DISCORD_AUTHORIZED_USER_ID=${config.discord?.userId || ''}

# OpenRouter
OPENROUTER_API_KEY=${config.openrouter.apiKey}
OPENROUTER_MODEL=${config.openrouter.model || 'openrouter/auto'}

# Agent
AGENT_API_PORT=${agentPort}
AGENT_API_SECRET=${agentSecret}
NEXT_PUBLIC_AGENT_API_TOKEN=${agentSecret}

# App
NODE_ENV=production
APP_URL=${appUrl}

# Frontend
NEXT_PUBLIC_SUPABASE_URL=${slotConfig.supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${slotConfig.anonKey}
NEXT_PUBLIC_APP_URL=${appUrl}

# Voice (Groq - optional)
GROQ_API_KEY=${config.groqApiKey || ''}

# Google Calendar (optional)
${
  config.googleCalendar
    ? `GOOGLE_CLIENT_ID=${config.googleCalendar.clientId}
GOOGLE_CLIENT_SECRET=${config.googleCalendar.clientSecret}
GOOGLE_REDIRECT_URI=${appUrl}/auth/google/callback`
    : ''
}
`;
}

export function downloadEnvFile(content: string, slot: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `.env.${slot.toLowerCase()}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
