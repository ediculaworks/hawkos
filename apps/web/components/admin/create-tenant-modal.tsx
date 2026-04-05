'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import toast from 'react-hot-toast';

import { createTenantAction } from '@/lib/actions/admin';

interface CreateTenantModalProps {
  open: boolean;
  onClose: () => void;
}

const inputCls =
  'w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const labelCls = 'text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 block';

export function CreateTenantModal({ open, onClose }: CreateTenantModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [showDiscord, setShowDiscord] = useState(false);
  const [showOpenRouter, setShowOpenRouter] = useState(false);

  const [label, setLabel] = useState('');
  const [botToken, setBotToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [guildId, setGuildId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [authorizedUserId, setAuthorizedUserId] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  function resetForm() {
    setLabel('');
    setBotToken('');
    setClientId('');
    setGuildId('');
    setChannelId('');
    setAuthorizedUserId('');
    setApiKey('');
    setShowDiscord(false);
    setShowOpenRouter(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;

    const discordConfig =
      showDiscord && (botToken || clientId || guildId || channelId || authorizedUserId)
        ? {
            bot_token: botToken || undefined,
            client_id: clientId || undefined,
            guild_id: guildId || undefined,
            channel_id: channelId || undefined,
            authorized_user_id: authorizedUserId || undefined,
          }
        : undefined;

    const openrouterConfig = showOpenRouter && apiKey ? { api_key: apiKey } : undefined;

    startTransition(async () => {
      const result = await createTenantAction({
        label: label.trim(),
        discordConfig,
        openrouterConfig,
      });

      if (result.ok) {
        toast.success(`Tenant "${result.slug}" criado com sucesso`);
        handleClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="w-full max-w-lg rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] p-0 shadow-xl backdrop:bg-black/60"
    >
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Novo Tenant</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* Label */}
          <div>
            <label htmlFor="tenant-label" className={labelCls}>
              Nome <span className="text-red-400">*</span>
            </label>
            <input
              id="tenant-label"
              type="text"
              className={inputCls}
              placeholder="ex: Lucas"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>

          {/* Discord Config toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowDiscord(!showDiscord)}
              className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <span
                className={`inline-block h-4 w-4 border rounded text-center text-xs leading-none transition-colors ${showDiscord ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white' : 'border-[var(--color-border)]'}`}
              >
                {showDiscord ? '✓' : ''}
              </span>
              Discord Config (opcional)
            </button>
            {showDiscord && (
              <div className="mt-3 space-y-3 pl-6 border-l border-[var(--color-border-subtle)]">
                <div>
                  <label htmlFor="tenant-bot-token" className={labelCls}>
                    Bot Token
                  </label>
                  <input
                    id="tenant-bot-token"
                    type="password"
                    className={inputCls}
                    placeholder="Bot token do Discord"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="tenant-client-id" className={labelCls}>
                      Client ID
                    </label>
                    <input
                      id="tenant-client-id"
                      type="text"
                      className={inputCls}
                      placeholder="Client ID"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="tenant-guild-id" className={labelCls}>
                      Guild ID
                    </label>
                    <input
                      id="tenant-guild-id"
                      type="text"
                      className={inputCls}
                      placeholder="Guild ID"
                      value={guildId}
                      onChange={(e) => setGuildId(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="tenant-channel-id" className={labelCls}>
                      Channel ID
                    </label>
                    <input
                      id="tenant-channel-id"
                      type="text"
                      className={inputCls}
                      placeholder="Channel ID"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="tenant-authorized-user-id" className={labelCls}>
                      Authorized User ID
                    </label>
                    <input
                      id="tenant-authorized-user-id"
                      type="text"
                      className={inputCls}
                      placeholder="User ID"
                      value={authorizedUserId}
                      onChange={(e) => setAuthorizedUserId(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* OpenRouter Config toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowOpenRouter(!showOpenRouter)}
              className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <span
                className={`inline-block h-4 w-4 border rounded text-center text-xs leading-none transition-colors ${showOpenRouter ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white' : 'border-[var(--color-border)]'}`}
              >
                {showOpenRouter ? '✓' : ''}
              </span>
              OpenRouter Config (opcional)
            </button>
            {showOpenRouter && (
              <div className="mt-3 pl-6 border-l border-[var(--color-border-subtle)]">
                <label htmlFor="tenant-api-key" className={labelCls}>
                  API Key
                </label>
                <input
                  id="tenant-api-key"
                  type="password"
                  className={inputCls}
                  placeholder="sk-or-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border-subtle)]">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="rounded-[var(--radius-md)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || !label.trim()}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? 'Criando…' : 'Criar Tenant'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
