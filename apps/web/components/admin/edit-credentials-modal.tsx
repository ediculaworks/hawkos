'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import toast from 'react-hot-toast';

import { updateTenantCredentials } from '@/lib/actions/admin';

interface EditCredentialsModalProps {
  tenantId: string;
  tenantLabel: string;
  onClose: () => void;
}

const inputCls =
  'w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const labelCls =
  'text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block uppercase tracking-wide';
const sectionCls =
  'rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-4 space-y-3';
const sectionTitleCls =
  'text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider';

function Toggle({
  label,
  checked,
  onChange,
}: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
    >
      <span
        className={`inline-flex h-4 w-4 items-center justify-center border rounded text-[10px] transition-colors ${
          checked
            ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
            : 'border-[var(--color-border)]'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      {label}
    </button>
  );
}

export function EditCredentialsModal({
  tenantId,
  tenantLabel,
  onClose,
}: EditCredentialsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [showDiscord, setShowDiscord] = useState(false);
  const [showOpenRouter, setShowOpenRouter] = useState(false);

  // Discord fields
  const [botToken, setBotToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [guildId, setGuildId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [authorizedUserId, setAuthorizedUserId] = useState('');
  // OpenRouter
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function handleClose() {
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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

    if (!discordConfig && !openrouterConfig) {
      toast.error('Preencha pelo menos uma credencial para actualizar.');
      return;
    }

    startTransition(async () => {
      const result = await updateTenantCredentials(tenantId, { discordConfig, openrouterConfig });

      if (result.ok) {
        toast.success(`Credenciais de "${tenantLabel}" actualizadas e re-encriptadas.`);
        handleClose();
      } else {
        toast.error(result.error ?? 'Erro ao actualizar credenciais');
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="fixed inset-0 z-50 m-auto w-full max-w-lg max-h-[90vh] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] p-0 shadow-2xl backdrop:bg-black/60 flex flex-col"
    >
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Editar Credenciais
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {tenantLabel} — re-encripta com a chave actual
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Info notice */}
          <div className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-xs text-amber-300">
              Deixe as secções fechadas para manter as credenciais existentes. Apenas as secções
              abertas serão actualizadas e re-encriptadas.
            </p>
          </div>

          {/* ── Discord ── */}
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <p className={sectionTitleCls}>Discord</p>
              <Toggle
                label="Actualizar"
                checked={showDiscord}
                onChange={() => setShowDiscord(!showDiscord)}
              />
            </div>

            {showDiscord && (
              <div className="space-y-3 pt-1">
                <div>
                  <label htmlFor="edit-bot-token" className={labelCls}>
                    Bot Token
                  </label>
                  <input
                    id="edit-bot-token"
                    type="password"
                    className={inputCls}
                    placeholder="Bot token do Discord"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="edit-authorized-user-id" className={labelCls}>
                    Authorized User ID
                  </label>
                  <input
                    id="edit-authorized-user-id"
                    type="text"
                    className={inputCls}
                    placeholder="ID do utilizador autorizado"
                    value={authorizedUserId}
                    onChange={(e) => setAuthorizedUserId(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="edit-guild-id" className={labelCls}>
                      Guild ID
                    </label>
                    <input
                      id="edit-guild-id"
                      type="text"
                      className={inputCls}
                      placeholder="Guild"
                      value={guildId}
                      onChange={(e) => setGuildId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-channel-id" className={labelCls}>
                      Channel ID
                    </label>
                    <input
                      id="edit-channel-id"
                      type="text"
                      className={inputCls}
                      placeholder="Canal"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-client-id" className={labelCls}>
                      Client ID
                    </label>
                    <input
                      id="edit-client-id"
                      type="text"
                      className={inputCls}
                      placeholder="Client"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {!showDiscord && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Discord config mantida — abrir para substituir.
              </p>
            )}
          </div>

          {/* ── OpenRouter ── */}
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <p className={sectionTitleCls}>OpenRouter</p>
              <Toggle
                label="Actualizar"
                checked={showOpenRouter}
                onChange={() => setShowOpenRouter(!showOpenRouter)}
              />
            </div>

            {showOpenRouter && (
              <div className="pt-1">
                <label htmlFor="edit-api-key" className={labelCls}>
                  API Key
                </label>
                <input
                  id="edit-api-key"
                  type="password"
                  className={inputCls}
                  placeholder="sk-or-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            )}

            {!showOpenRouter && (
              <p className="text-xs text-[var(--color-text-muted)]">
                OpenRouter config mantida — abrir para substituir.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-[var(--color-border-subtle)] flex-shrink-0 gap-3">
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
            disabled={isPending}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? 'Actualizando…' : 'Guardar Credenciais'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
