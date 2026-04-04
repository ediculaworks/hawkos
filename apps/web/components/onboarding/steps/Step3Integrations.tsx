'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OPENROUTER_MODELS } from '@/lib/onboarding/types';
import { CheckCircle, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';

type TestStatus = 'idle' | 'loading' | 'ok' | 'error';

interface Step3IntegrationsProps {
  onNext: (data: {
    openrouter: { apiKey: string; model?: string };
    discord: {
      botToken: string;
      clientId: string;
      guildId: string;
      channelId: string;
      userId: string;
    };
  }) => void;
  onBack: () => void;
  initialValues?: {
    openrouter?: { apiKey?: string; model?: string };
    discord?: {
      botToken?: string;
      clientId?: string;
      guildId?: string;
      channelId?: string;
      userId?: string;
    };
  };
}

function ConnectionBadge({ status, error }: { status: TestStatus; error?: string }) {
  if (status === 'loading')
    return <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />;
  if (status === 'ok') return <CheckCircle className="h-4 w-4 text-[var(--color-success)]" />;
  if (status === 'error')
    return (
      <div className="flex items-center gap-1.5">
        <XCircle className="h-4 w-4 shrink-0 text-[var(--color-danger)]" />
        {error && <span className="text-xs text-[var(--color-danger)] leading-tight">{error}</span>}
      </div>
    );
  return null;
}

export function Step3Integrations({ onNext, onBack, initialValues }: Step3IntegrationsProps) {
  const [openrouter, setOpenrouter] = useState({
    apiKey: initialValues?.openrouter?.apiKey ?? '',
    model: initialValues?.openrouter?.model ?? 'nvidia/nemotron-3-super-120b-a12b:free',
  });
  const [manualModel, setManualModel] = useState('');
  const [openrouterStatus, setOpenrouterStatus] = useState<TestStatus>('idle');
  const [openrouterError, setOpenrouterError] = useState('');

  const [discord, setDiscord] = useState({
    botToken: initialValues?.discord?.botToken ?? '',
    clientId: initialValues?.discord?.clientId ?? '',
    guildId: initialValues?.discord?.guildId ?? '',
    channelId: initialValues?.discord?.channelId ?? '',
    userId: initialValues?.discord?.userId ?? '',
  });
  const [discordStatus, setDiscordStatus] = useState<TestStatus>('idle');
  const [discordError, setDiscordError] = useState('');
  const [_discordExpanded, _setDiscordExpanded] = useState(!!initialValues?.discord?.botToken);

  const testOpenRouter = async () => {
    if (!openrouter.apiKey.trim()) {
      setOpenrouterError('Preencha a API key');
      setOpenrouterStatus('error');
      return;
    }
    setOpenrouterStatus('loading');
    setOpenrouterError('');
    try {
      const res = await fetch('/api/admin/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openrouterApiKey: openrouter.apiKey.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setOpenrouterStatus('ok');
      } else {
        setOpenrouterStatus('error');
        setOpenrouterError(data.error || 'API key invalida');
      }
    } catch {
      setOpenrouterStatus('error');
      setOpenrouterError('Erro ao testar API key');
    }
  };

  const testDiscord = async () => {
    if (!discord.botToken.trim()) {
      setDiscordError('Preencha o Bot Token');
      setDiscordStatus('error');
      return;
    }
    setDiscordStatus('loading');
    setDiscordError('');
    try {
      const res = await fetch('/api/admin/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordBotToken: discord.botToken.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setDiscordStatus('ok');
      } else {
        setDiscordStatus('error');
        setDiscordError(data.error || 'Token invalido');
      }
    } catch {
      setDiscordStatus('error');
      setDiscordError('Erro ao testar Discord');
    }
  };

  const discordFilled =
    discord.botToken.trim() &&
    discord.clientId.trim() &&
    discord.guildId.trim() &&
    discord.channelId.trim() &&
    discord.userId.trim();

  const canContinue = openrouterStatus === 'ok' && !!discordFilled;

  const handleSubmit = () => {
    if (!canContinue) return;
    const resolvedModel = openrouter.model === '__manual__' ? manualModel.trim() : openrouter.model;
    onNext({
      openrouter: { apiKey: openrouter.apiKey.trim(), model: resolvedModel },
      discord: {
        botToken: discord.botToken.trim(),
        clientId: discord.clientId.trim(),
        guildId: discord.guildId.trim(),
        channelId: discord.channelId.trim(),
        userId: discord.userId.trim(),
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Discord */}
      <div className="p-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-accent)]/30 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
              Discord
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                Obrigatorio
              </span>
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline inline-flex items-center gap-1"
              >
                discord.com/developers → Applications <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
          <div className="mt-0.5 shrink-0">
            <ConnectionBadge status={discordStatus} />
          </div>
        </div>

        <div>
          <label
            htmlFor="discord-bot-token"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Bot Token
          </label>
          <Input
            id="discord-bot-token"
            type="password"
            placeholder="MTIz... (Bot → Token)"
            value={discord.botToken}
            onChange={(e) => {
              setDiscord({ ...discord, botToken: e.target.value });
              setDiscordStatus('idle');
            }}
          />
        </div>
        <div>
          <label
            htmlFor="discord-client-id"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Client ID
          </label>
          <Input
            id="discord-client-id"
            placeholder="123456789 (General → App ID)"
            value={discord.clientId}
            onChange={(e) => setDiscord({ ...discord, clientId: e.target.value })}
          />
        </div>
        <div>
          <label
            htmlFor="discord-guild-id"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Guild / Server ID
          </label>
          <Input
            id="discord-guild-id"
            placeholder="123456789 (Server Settings → Widget)"
            value={discord.guildId}
            onChange={(e) => setDiscord({ ...discord, guildId: e.target.value })}
          />
        </div>
        <div>
          <label
            htmlFor="discord-channel-id"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Channel ID
          </label>
          <Input
            id="discord-channel-id"
            placeholder="123456789 (Right-click channel → Copy ID)"
            value={discord.channelId}
            onChange={(e) => setDiscord({ ...discord, channelId: e.target.value })}
          />
        </div>
        <div>
          <label
            htmlFor="discord-user-id"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Seu User ID
          </label>
          <Input
            id="discord-user-id"
            placeholder="123456789 (Right-click seu nome → Copy ID)"
            value={discord.userId}
            onChange={(e) => setDiscord({ ...discord, userId: e.target.value })}
          />
        </div>
        {discordStatus === 'error' && discordError && (
          <p className="text-xs text-[var(--color-danger)]">{discordError}</p>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={testDiscord}
          disabled={discordStatus === 'loading' || !discord.botToken}
          className="w-full"
        >
          {discordStatus === 'loading' && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
          {discordStatus === 'ok' ? '✓ Bot online' : 'Testar Discord'}
        </Button>
      </div>

      {/* OpenRouter */}
      <div className="p-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-accent)]/30 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
              OpenRouter
              <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                Obrigatorio
              </span>
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline inline-flex items-center gap-1"
              >
                openrouter.ai → API Keys <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
          <div className="mt-0.5 shrink-0">
            <ConnectionBadge status={openrouterStatus} />
          </div>
        </div>

        <div>
          <label
            htmlFor="openrouter-api-key"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            API Key
          </label>
          <Input
            id="openrouter-api-key"
            type="password"
            placeholder="sk-or-v1-..."
            value={openrouter.apiKey}
            onChange={(e) => {
              setOpenrouter({ ...openrouter, apiKey: e.target.value });
              setOpenrouterStatus('idle');
            }}
          />
        </div>
        <div>
          <label
            htmlFor="openrouter-model"
            className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Modelo (gratuitos)
          </label>
          <select
            id="openrouter-model"
            value={openrouter.model}
            onChange={(e) => setOpenrouter({ ...openrouter, model: e.target.value })}
            className="flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            {OPENROUTER_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
          {openrouter.model === '__manual__' && (
            <Input
              className="mt-2"
              placeholder="ex: anthropic/claude-sonnet-4-5"
              value={manualModel}
              onChange={(e) => setManualModel(e.target.value.trim())}
            />
          )}
        </div>
        {openrouterStatus === 'error' && openrouterError && (
          <p className="text-xs text-[var(--color-danger)]">{openrouterError}</p>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={testOpenRouter}
          disabled={openrouterStatus === 'loading' || !openrouter.apiKey}
          className="w-full"
        >
          {openrouterStatus === 'loading' && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
          {openrouterStatus === 'ok' ? '✓ Conectado' : 'Testar API key'}
        </Button>
      </div>

      {!canContinue && (openrouterStatus !== 'idle' || discordStatus !== 'idle') && (
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Preencha o Discord e teste o OpenRouter para continuar.
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          ← Voltar
        </Button>
        <Button onClick={handleSubmit} disabled={!canContinue}>
          Proximo →
        </Button>
      </div>
    </div>
  );
}
