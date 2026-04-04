'use client';

import { Button } from '@/components/ui/button';
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

type Phase = 'confirm' | 'running' | 'done';

const INITIAL_STEPS: ConfigStep[] = [
  { label: 'Criando workspace', status: 'pending' },
  { label: 'Aplicando migrações', status: 'pending' },
  { label: 'Criando conta e autenticando', status: 'pending' },
];

export function Step5Configure({ formData, onComplete, onError }: Step5ConfigureProps) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [steps, setSteps] = useState<ConfigStep[]>(INITIAL_STEPS);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
    setShouldRun(true);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: shouldRun controls execution
  useEffect(() => {
    if (!shouldRun) return;
    setShouldRun(false);

    const run = async () => {
      try {
        // ── Step 1: Create workspace (tenant + schema) ────────────────
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
          throw new Error(tenantResult.error || 'Erro ao criar workspace');
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

        // ── Step 3: Create account + authenticate ─────────────────────
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

        if (!setupResult.success) {
          throw new Error(setupResult.error || 'Erro ao criar conta');
        }

        // Auto-login after account creation
        if (formData.email && formData.password) {
          await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              tenantSlug: tenantResult.tenant.slug,
            }),
          });
        }

        setStepStatus(2, 'done');
        setProgress(100);

        // Agent is notified automatically by the tenants API (hot-load)
        onComplete('', tenantResult.tenant.slug);
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
