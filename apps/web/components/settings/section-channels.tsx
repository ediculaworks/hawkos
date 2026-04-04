'use client';

import { Switch } from '@/components/ui/switch';
import { agentHeaders, getAgentApiUrl } from '@/lib/config';
import {
  Bot,
  Globe,
  type LucideIcon,
  Mail,
  MessageCircle,
  Phone,
  Radio,
  Send,
  Slack,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface ChannelDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  available: boolean;
}

const CHANNELS: ChannelDefinition[] = [
  {
    id: 'discord',
    name: 'Discord',
    description: 'Canal principal via bot Discord',
    icon: Bot,
    color: '#5865F2',
    available: true,
  },
  {
    id: 'web',
    name: 'Web Chat',
    description: 'Chat integrado no dashboard',
    icon: Globe,
    color: 'var(--color-accent)',
    available: true,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Bot Telegram para mensagens rapidas',
    icon: Send,
    color: '#26A5E4',
    available: false,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Via WhatsApp Business API',
    icon: MessageCircle,
    color: '#25D366',
    available: false,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Integracao com workspaces Slack',
    icon: Slack,
    color: '#E01E5A',
    available: false,
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Enviar e receber via SMTP/IMAP',
    icon: Mail,
    color: '#EA4335',
    available: false,
  },
  {
    id: 'voice',
    name: 'Voz',
    description: 'Interacao por voz via Whisper + TTS',
    icon: Phone,
    color: '#8B5CF6',
    available: false,
  },
];

export function SectionChannels() {
  const [enabledChannels, setEnabledChannels] = useState<string[]>(['discord', 'web']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getAgentApiUrl()}/settings`, { headers: agentHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.enabled_channels) {
            setEnabledChannels(data.settings.enabled_channels);
          }
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleChannel = async (channelId: string, enabled: boolean) => {
    const updated = enabled
      ? [...enabledChannels, channelId]
      : enabledChannels.filter((c) => c !== channelId);
    setEnabledChannels(updated);

    try {
      await fetch(`${getAgentApiUrl()}/settings`, {
        method: 'PUT',
        headers: agentHeaders(),
        body: JSON.stringify({ enabled_channels: updated }),
      });
    } catch {
      // Revert on failure
      setEnabledChannels(enabledChannels);
    }
  };

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
          <Radio className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Canais</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Canais de comunicacao com o agente. Ative ou desative cada canal.
        </p>
      </div>

      <div className="space-y-[var(--space-3)] max-w-lg">
        {CHANNELS.map((channel) => {
          const isEnabled = enabledChannels.includes(channel.id);
          const Icon = channel.icon;

          return (
            <div
              key={channel.id}
              className={`relative p-[var(--space-4)] rounded-[var(--radius-lg)] border transition-all duration-200 ${
                channel.available
                  ? isEnabled
                    ? 'bg-[var(--color-surface-1)] border-[var(--color-accent)]/30'
                    : 'bg-[var(--color-surface-1)] border-[var(--color-border)]'
                  : 'bg-[var(--color-surface-1)]/50 border-[var(--color-border)]/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[var(--space-3)]">
                  <div
                    className="w-10 h-10 rounded-[var(--radius-lg)] flex items-center justify-center"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${channel.color}, transparent 85%)`,
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: channel.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-[var(--space-2)]">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {channel.name}
                      </span>
                      {!channel.available && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                          Em breve
                        </span>
                      )}
                      {channel.available && isEnabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">{channel.description}</p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => toggleChannel(channel.id, checked)}
                  disabled={!channel.available || loading}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] border border-[var(--color-border)] max-w-lg">
        <p className="text-xs text-[var(--color-text-muted)]">
          Canais marcados como "Em breve" estao em desenvolvimento. Configure as credenciais
          de cada canal na aba <strong>Extensoes</strong>.
        </p>
      </div>
    </div>
  );
}
