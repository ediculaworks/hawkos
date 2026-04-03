'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Step5ConfigureProps {
  formData: {
    workspaceLabel?: string;
    name: string;
    email?: string;
    password?: string;
    cpf?: string;
    birthDate?: string;
    timezone?: string;
    openrouter?: { apiKey: string; model?: string };
    discord?: {
      botToken: string;
      clientId: string;
      guildId: string;
      channelId: string;
      userId: string;
    };
    modules: string[];
    agents?: string[];
  };
  onComplete: (envContent: string, assignedSlot: string) => void;
  onError: () => void;
}

interface ConfigStep {
  label: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  note?: string;
}

type Phase = 'confirm' | 'running' | 'account-exists' | 'done';

const INITIAL_STEPS: ConfigStep[] = [
  { label: 'Criando tenant', status: 'pending' },
  { label: 'Aplicando migrações', status: 'pending' },
  { label: 'Criando conta de usuário', status: 'pending' },
  { label: 'Realizando login', status: 'pending' },
  { label: 'Verificando instalação', status: 'pending' },
];

async function readNdjsonStream(
  res: Response,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<void> {
  if (!res.body) throw new Error(`HTTP ${res.status}: sem corpo na resposta`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      onEvent(event);
    }
  }
  if (buffer.trim()) {
    try {
      onEvent(JSON.parse(buffer) as Record<string, unknown>);
    } catch {}
  }
}

export function Step5Configure({ formData, onComplete, onError }: Step5ConfigureProps) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [steps, setSteps] = useState<ConfigStep[]>(INITIAL_STEPS);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Account-exists state
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  // shouldRun triggers the actual run() effect
  const [shouldRun, setShouldRun] = useState(false);

  const setStepStatus = (idx: number, status: ConfigStep['status'], note?: string) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, status, note } : s)));
  };

  const total = INITIAL_STEPS.length;

  const startRun = () => {
    setPhase('running');
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending' as const })));
    setProgress(0);
    setError(null);
    setResetLoading(false);
    setResetError('');
    setShouldRun(true);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: shouldRun controls execution
  useEffect(() => {
    if (!shouldRun) return;
    setShouldRun(false);

    const run = async () => {
      try {
        // ── Step 1: Create tenant ──────────────────────────────────────
        setStepStatus(0, 'loading');
        setProgress((0.5 / total) * 100);

        const tenantRes = await fetch('/api/admin/tenants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: formData.workspaceLabel || formData.name,
            discordConfig: formData.discord
              ? {
                  bot_token: formData.discord.botToken,
                  client_id: formData.discord.clientId,
                  guild_id: formData.discord.guildId,
                  channel_id: formData.discord.channelId,
                  user_id: formData.discord.userId,
                }
              : undefined,
            openrouterConfig: formData.openrouter
              ? { api_key: formData.openrouter.apiKey, model: formData.openrouter.model }
              : undefined,
          }),
        });
        const tenantResult = await tenantRes.json();
        if (!tenantResult.tenant) {
          throw new Error(tenantResult.error || 'Erro ao criar tenant');
        }
        setStepStatus(0, 'done');
        setProgress((1 / total) * 100);

        // ── Step 2: Apply migrations to tenant schema ─────────────────
        setStepStatus(1, 'loading');
        setProgress((1.5 / total) * 100);

        const migRes = await fetch('/api/admin/apply-migrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug: tenantResult.tenant.slug,
            schemaName: tenantResult.tenant.schema_name,
          }),
        });
        if (!migRes.ok) {
          const migResult = await migRes.json();
          throw new Error(migResult.error || 'Erro ao aplicar migrações');
        }
        setStepStatus(1, 'done');
        setProgress((2 / total) * 100);

        // ── Step 3: Create user account + profile ─────────────────────
        setStepStatus(2, 'loading');
        setProgress((2.5 / total) * 100);

        const setupRes = await fetch('/api/admin/setup-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            cpf: formData.cpf,
            birthDate: formData.birthDate,
            tenantSlot: tenantResult.tenant.slug,
            schemaName: tenantResult.tenant.schema_name,
            modules: formData.modules,
            timezone: formData.timezone,
            agents: formData.agents,
            discord: formData.discord,
            openrouter: formData.openrouter,
          }),
        });
        const setupResult = await setupRes.json();

        if (setupRes.status === 409) {
          setStepStatus(2, 'error', 'conta existente');
          setPhase('account-exists');
          return;
        }

        if (!setupResult.success) {
          throw new Error(setupResult.error || 'Erro ao criar conta de usuário');
        }
        setStepStatus(2, 'done');
        setProgress((3 / total) * 100);

        // ── Step 4: Sign in via API ───────────────────────────────────
        setStepStatus(3, 'loading');
        setProgress((3.5 / total) * 100);

        if (formData.email && formData.password) {
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              tenantSlug: tenantResult.tenant.slug,
            }),
          });
          if (!loginRes.ok) throw new Error('Erro ao realizar login');
        }
        setStepStatus(3, 'done');
        setProgress((4 / total) * 100);

        // ── Step 5: Verify installation ───────────────────────────────
        setStepStatus(4, 'loading');
        setProgress((4.5 / total) * 100);

        const verifyRes = await fetch('/api/admin/verify-install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug: tenantResult.tenant.slug,
            schemaName: tenantResult.tenant.schema_name,
            email: formData.email,
          }),
        });
        const verifyResult = await verifyRes.json();

        if (!verifyRes.ok) {
          throw new Error(verifyResult.error || 'Erro na verificação');
        }

        const failedChecks = verifyResult.checks?.filter(
          (c: { ok: boolean; label: string; detail?: string }) => !c.ok,
        );
        if (failedChecks?.length > 0) {
          const details = failedChecks
            .map((c: { label: string; detail?: string }) => `${c.label}: ${c.detail || 'falhou'}`)
            .join('; ');
          throw new Error(`Verificação falhou — ${details}`);
        }

        setStepStatus(4, 'done');
        setProgress(100);
        onComplete(tenantResult.envContent || '', tenantResult.tenant.slug);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(msg);
        setSteps((prev) =>
          prev.map((s) => (s.status === 'loading' ? { ...s, status: 'error', note: msg } : s)),
        );
      }
    };

    run();
  }, [shouldRun]);

  const handleResetAccount = async () => {
    if (!resetPassword) return;
    setResetLoading(true);
    setResetError('');
    try {
      const res = await fetch('/api/admin/reset-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: resetPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || 'Erro ao apagar conta');
        setResetLoading(false);
        return;
      }
      // Account deleted — restart the run
      setResetPassword('');
      startRun();
    } catch {
      setResetError('Erro de rede ao apagar conta');
      setResetLoading(false);
    }
  };

  // ── Confirmation phase ────────────────────────────────────────────────────
  if (phase === 'confirm') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Pronto para instalar
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Revise o que acontecerá antes de continuar.
          </p>
        </div>

        <div className="p-5 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] space-y-3">
          <div className="flex items-start gap-3">
            <Check className="h-4 w-4 text-[var(--color-success)] mt-0.5 shrink-0" />
            <p className="text-sm text-[var(--color-text-primary)]">
              Suas credenciais serão validadas
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Check className="h-4 w-4 text-[var(--color-success)] mt-0.5 shrink-0" />
            <p className="text-sm text-[var(--color-text-primary)]">
              Um workspace será criado no banco de dados
            </p>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--color-warning)]">
                O banco de dados do tenant será resetado
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Todas as tabelas existentes serão apagadas e as migrações aplicadas do zero. Dados
                de instalações anteriores serão perdidos.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Check className="h-4 w-4 text-[var(--color-success)] mt-0.5 shrink-0" />
            <p className="text-sm text-[var(--color-text-primary)]">
              Sua conta será criada e você será autenticado
            </p>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onError}>
            ← Voltar
          </Button>
          <Button onClick={startRun}>Confirmar e instalar →</Button>
        </div>
      </div>
    );
  }

  // ── Account exists phase ──────────────────────────────────────────────────
  if (phase === 'account-exists') {
    return (
      <div className="space-y-6">
        <div className="p-5 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-warning)]">
                Conta existente detectada
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                O e-mail{' '}
                <strong className="text-[var(--color-text-primary)]">{formData.email}</strong> já
                tem uma conta de uma instalação anterior.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-[var(--color-text-primary)]">
            Confirme a senha da conta existente para apagá-la e reinstalar:
          </label>
          <Input
            type="password"
            placeholder="Senha da conta existente"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && resetPassword) handleResetAccount();
            }}
          />
          {resetError && <p className="text-xs text-[var(--color-danger)]">{resetError}</p>}
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleResetAccount}
            disabled={!resetPassword || resetLoading}
            variant="danger"
            className="w-full"
          >
            {resetLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Apagar conta antiga e reinstalar
          </Button>
          <Button variant="ghost" onClick={onError} className="w-full">
            ← Voltar e corrigir dados
          </Button>
        </div>
      </div>
    );
  }

  // ── Running phase ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Configurando Sistema
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Por favor, aguarde enquanto preparamos tudo para você...
        </p>
      </div>

      <div className="p-6 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
        <div className="mb-6">
          <div className="h-2 rounded-full bg-[var(--color-surface-2)]">
            <div
              className="h-2 rounded-full bg-[var(--color-accent)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2 text-right">
            {Math.round(progress)}%
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  step.status === 'done'
                    ? 'bg-[var(--color-success)]'
                    : step.status === 'loading'
                      ? 'bg-[var(--color-accent)]'
                      : step.status === 'error'
                        ? 'bg-[var(--color-danger)]'
                        : 'bg-[var(--color-surface-2)]'
                }`}
              >
                {step.status === 'done' ? (
                  <Check className="h-3 w-3 text-white" />
                ) : step.status === 'loading' ? (
                  <Loader2 className="h-3 w-3 text-white animate-spin" />
                ) : step.status === 'error' ? (
                  <span className="text-white text-xs">✕</span>
                ) : null}
              </div>
              <div className="flex-1">
                <span
                  className={`text-sm ${
                    step.status === 'pending'
                      ? 'text-[var(--color-text-muted)]'
                      : step.status === 'error'
                        ? 'text-[var(--color-danger)]'
                        : 'text-[var(--color-text-primary)]'
                  }`}
                >
                  {step.label}
                </span>
                {step.note && (
                  <span className="text-xs text-[var(--color-text-muted)] ml-2">
                    {step.status === 'done' ? `(${step.note})` : step.note}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
            <p className="text-xs font-medium text-[var(--color-danger)] mb-1">
              Erro na configuração
            </p>
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          </div>
          <Button variant="ghost" onClick={onError} className="w-full">
            ← Voltar e corrigir
          </Button>
        </div>
      )}
    </div>
  );
}
