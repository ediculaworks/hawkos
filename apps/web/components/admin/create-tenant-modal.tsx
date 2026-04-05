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

export function CreateTenantModal({ open, onClose }: CreateTenantModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [showDiscord, setShowDiscord] = useState(false);
  const [showOpenRouter, setShowOpenRouter] = useState(false);

  // Access fields
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Discord fields
  const [botToken, setBotToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [guildId, setGuildId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [authorizedUserId, setAuthorizedUserId] = useState('');
  // OpenRouter
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
    setEmail('');
    setPassword('');
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
    if (!label.trim() || !email.trim() || !password) return;

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
        email: email.trim(),
        password,
        discordConfig,
        openrouterConfig,
      });

      if (result.ok) {
        toast.success(`Tenant "${result.slug}" criado — acesso: ${email.trim()}`);
        handleClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  const canSubmit = label.trim() && email.trim() && password.length >= 8;

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
              Novo Tenant
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Cria o tenant e o acesso ao dashboard
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
          {/* ── Acesso ao Dashboard ── */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>Acesso ao Dashboard</p>

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

            <div>
              <label htmlFor="tenant-email" className={labelCls}>
                Email <span className="text-red-400">*</span>
              </label>
              <input
                id="tenant-email"
                type="email"
                className={inputCls}
                placeholder="user@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="tenant-password" className={labelCls}>
                Senha <span className="text-red-400">*</span>
              </label>
              <input
                id="tenant-password"
                type="password"
                className={inputCls}
                placeholder="Mínimo 8 caracteres"
                value={password}
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {password.length > 0 && password.length < 8 && (
                <p className="mt-1 text-[11px] text-amber-400">Mínimo 8 caracteres</p>
              )}
            </div>
          </div>

          {/* ── Discord ── */}
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <p className={sectionTitleCls}>Discord</p>
              <Toggle
                label="Configurar"
                checked={showDiscord}
                onChange={() => setShowDiscord(!showDiscord)}
              />
            </div>

            {showDiscord && (
              <div className="space-y-3 pt-1">
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
                <div>
                  <label htmlFor="tenant-authorized-user-id" className={labelCls}>
                    Authorized User ID
                  </label>
                  <input
                    id="tenant-authorized-user-id"
                    type="text"
                    className={inputCls}
                    placeholder="ID do utilizador autorizado"
                    value={authorizedUserId}
                    onChange={(e) => setAuthorizedUserId(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="tenant-guild-id" className={labelCls}>
                      Guild ID
                    </label>
                    <input
                      id="tenant-guild-id"
                      type="text"
                      className={inputCls}
                      placeholder="Guild"
                      value={guildId}
                      onChange={(e) => setGuildId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="tenant-channel-id" className={labelCls}>
                      Channel ID
                    </label>
                    <input
                      id="tenant-channel-id"
                      type="text"
                      className={inputCls}
                      placeholder="Canal"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="tenant-client-id" className={labelCls}>
                      Client ID
                    </label>
                    <input
                      id="tenant-client-id"
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
                Pode ser configurado depois em Settings → Integrations.
              </p>
            )}
          </div>

          {/* ── OpenRouter ── */}
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <p className={sectionTitleCls}>OpenRouter</p>
              <Toggle
                label="Configurar"
                checked={showOpenRouter}
                onChange={() => setShowOpenRouter(!showOpenRouter)}
              />
            </div>

            {showOpenRouter && (
              <div className="pt-1">
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

            {!showOpenRouter && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Usa a chave global do sistema. Pode ser personalizada depois.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border-subtle)] flex-shrink-0">
          <p className="text-xs text-[var(--color-text-muted)]">
            <span className="text-red-400">*</span> obrigatório
          </p>
          <div className="flex items-center gap-3">
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
              disabled={isPending || !canSubmit}
              className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? 'Criando…' : 'Criar Tenant'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
