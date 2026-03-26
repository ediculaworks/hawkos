'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface TenantRepairActionsProps {
  tenantSlug: string;
}

type Modal = 'reset-user' | 're-migrate' | 'fix-profile' | null;
type Status = 'idle' | 'loading' | 'success' | 'error';

export function TenantRepairActions({ tenantSlug }: TenantRepairActionsProps) {
  const [modal, setModal] = useState<Modal>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // Reset user state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Re-migrate state
  const [pat, setPat] = useState('');

  // Fix profile state
  const [fixEmail, setFixEmail] = useState('');
  const [fixName, setFixName] = useState('');
  const [migrationProgress, setMigrationProgress] = useState<string[]>([]);

  const handleResetUser = async () => {
    if (!email || !password) {
      setMessage('Email and password required');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/admin/repair-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          action: 'reset-user',
          email,
          newPassword: password,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reset user');
      }

      const result = await res.json();
      setStatus('success');
      setMessage(`✓ ${result.message}`);
      setEmail('');
      setPassword('');
      setTimeout(() => {
        setModal(null);
        setStatus('idle');
      }, 2000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to reset user');
    }
  };

  const handleReMigrate = async () => {
    if (!pat) {
      setMessage('Personal Access Token required');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');
    setMigrationProgress([]);

    try {
      const res = await fetch('/api/admin/repair-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          action: 're-migrate',
          supabaseAccessToken: pat,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to re-migrate');
      }

      // Parse streaming NDJSON response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === 'status' || event.type === 'file') {
              setMigrationProgress((prev) => [...prev, event.msg || event.name]);
            } else if (event.type === 'done') {
              setMigrationProgress((prev) => [...prev, '✓ Migrations completed']);
              setStatus('success');
              setMessage('All migrations applied successfully');
              setTimeout(() => {
                setModal(null);
                setStatus('idle');
                setMigrationProgress([]);
                setPat('');
              }, 2000);
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Migration error');
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event.type === 'error') {
            throw new Error(event.error || 'Migration error');
          }
        } catch {
          // Ignore parse errors
        }
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to re-migrate');
    }
  };

  const handleFixProfile = async () => {
    if (!fixEmail) {
      setMessage('Email required');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/admin/repair-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          action: 'fix-profile',
          email: fixEmail,
          name: fixName || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fix profile');
      }

      const result = await res.json();
      setStatus('success');
      setMessage(`✓ ${result.message}`);
      setFixEmail('');
      setFixName('');
      setTimeout(() => {
        setModal(null);
        setStatus('idle');
      }, 2000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to fix profile');
    }
  };

  if (modal === null) {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setModal('reset-user');
            setStatus('idle');
            setMessage('');
          }}
        >
          Resetar Usuário
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setModal('re-migrate');
            setStatus('idle');
            setMessage('');
          }}
        >
          Re-migrar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setModal('fix-profile');
            setStatus('idle');
            setMessage('');
          }}
        >
          Fix Onboarding
        </Button>
      </div>
    );
  }

  if (modal === 'reset-user') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg bg-[var(--color-surface-1)] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Resetar Usuário</h2>

          {status !== 'success' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Email
                </label>
                <Input
                  placeholder="usuario@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === 'loading'}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Nova Senha
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={status === 'loading'}
                />
              </div>
            </>
          )}

          {message && (
            <div
              className={`text-xs p-3 rounded flex items-start gap-2 ${
                status === 'error'
                  ? 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]'
                  : status === 'success'
                    ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                    : 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
              }`}
            >
              {status === 'loading' ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin mt-0.5" />
              ) : status === 'error' ? (
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              ) : (
                <Check className="h-3 w-3 shrink-0 mt-0.5" />
              )}
              <span>{message}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setModal(null)}
              disabled={status === 'loading'}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleResetUser}
              disabled={status === 'loading'}
              className="flex-1"
            >
              {status === 'loading' && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              {status === 'loading' ? 'Processando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (modal === 'fix-profile') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg bg-[var(--color-surface-1)] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Corrigir Onboarding</h2>

          {status !== 'success' && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Email do Usuário
                </label>
                <Input
                  placeholder="usuario@example.com"
                  value={fixEmail}
                  onChange={(e) => setFixEmail(e.target.value)}
                  disabled={status === 'loading'}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Nome (Opcional)
                </label>
                <Input
                  placeholder="Nome do usuário"
                  value={fixName}
                  onChange={(e) => setFixName(e.target.value)}
                  disabled={status === 'loading'}
                />
              </div>
            </>
          )}

          {message && (
            <div
              className={`text-xs p-3 rounded flex items-start gap-2 ${
                status === 'error'
                  ? 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]'
                  : status === 'success'
                    ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                    : 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
              }`}
            >
              {status === 'loading' ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin mt-0.5" />
              ) : status === 'error' ? (
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              ) : (
                <Check className="h-3 w-3 shrink-0 mt-0.5" />
              )}
              <span>{message}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setModal(null)}
              disabled={status === 'loading'}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleFixProfile}
              disabled={status === 'loading'}
              className="flex-1"
            >
              {status === 'loading' && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              {status === 'loading' ? 'Processando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (modal === 're-migrate') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-md rounded-lg bg-[var(--color-surface-1)] p-6 space-y-4 max-h-96 flex flex-col">
          <h2 className="text-lg font-semibold">Re-aplicar Migrations</h2>

          {status !== 'success' && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Personal Access Token (Supabase)
              </label>
              <Input
                type="password"
                placeholder="sbp_..."
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                disabled={status === 'loading'}
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Gere em{' '}
                <a
                  href="https://app.supabase.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  app.supabase.com → Account → Access Tokens
                </a>
              </p>
            </div>
          )}

          {migrationProgress.length > 0 && (
            <div className="bg-[var(--color-surface-2)] rounded p-3 flex-1 overflow-y-auto">
              <div className="text-xs font-mono space-y-1 text-[var(--color-text-muted)]">
                {migrationProgress.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {message && (
            <div
              className={`text-xs p-3 rounded flex items-start gap-2 ${
                status === 'error'
                  ? 'bg-[var(--color-danger)]/20 text-[var(--color-danger)]'
                  : status === 'success'
                    ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                    : 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
              }`}
            >
              {status === 'loading' ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin mt-0.5" />
              ) : status === 'error' ? (
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              ) : (
                <Check className="h-3 w-3 shrink-0 mt-0.5" />
              )}
              <span>{message}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setModal(null)}
              disabled={status === 'loading'}
            >
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handleReMigrate}
              disabled={status === 'loading'}
              className="flex-1"
            >
              {status === 'loading' && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              {status === 'loading' ? 'Migrando...' : 'Iniciar'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
