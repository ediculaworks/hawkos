'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Database, Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

const CONFIRMATION_PHRASE = 'APAGAR TUDO';

export function SectionData() {
  const router = useRouter();
  const [showReset, setShowReset] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    wiped?: number;
    errors?: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConfirmed = confirmation === CONFIRMATION_PHRASE;

  const handleSignOutAndRedirect = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/onboarding');
    router.refresh();
  }, [router]);

  const handleReset = async () => {
    if (!isConfirmed) return;
    setResetting(true);
    setResult(null);
    try {
      const res = await fetch('/api/factory-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: CONFIRMATION_PHRASE }),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setConfirmation('');
        setShowReset(false);
        await handleSignOutAndRedirect();
      }
    } catch {
      setResult({ success: false, errors: ['Erro de rede. Tente novamente.'] });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Dados</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Exportação, importação e reset do sistema.
        </p>
      </div>

      <div className="space-y-[var(--space-6)] max-w-lg">
        {/* Export */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
          <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
            <Database className="h-4 w-4 text-[var(--color-text-secondary)]" />
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Exportar dados</h3>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mb-[var(--space-3)]">
            Exporte todos os seus dados em formato JSON para backup ou migração.
          </p>
          <Button variant="outline" size="sm" disabled>
            Exportar JSON (em breve)
          </Button>
        </div>

        {/* Factory Reset */}
        <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-danger)]/30">
          {result?.success && (
            <div className="p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 mb-[var(--space-4)]">
              <p className="text-sm text-[var(--color-success)]">
                Factory reset concluído. {result.wiped} tabelas limpas. Redirecionando para
                onboarding...
              </p>
            </div>
          )}

          {result?.errors && result.errors.length > 0 && (
            <div className="p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 mb-[var(--space-4)]">
              <p className="text-sm text-[var(--color-danger)] mb-1">Erros durante o reset:</p>
              {result.errors.map((e) => (
                <p key={e} className="text-xs text-[var(--color-text-muted)]">
                  {e}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-start gap-[var(--space-3)]">
            <Trash2 className="h-5 w-5 text-[var(--color-danger)] shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                Factory Reset
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Apaga <strong>todos</strong> os dados do sistema: memórias, conversas, finanças,
                saúde, contatos, hábitos, objetivos e todos os outros módulos.
                <strong className="text-[var(--color-danger)]"> Esta ação é irreversível.</strong>
              </p>

              {!showReset ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setShowReset(true);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Resetar Sistema
                </Button>
              ) : (
                <div className="space-y-3 pt-[var(--space-2)]">
                  <div className="p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/20">
                    <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                      Para confirmar, digite{' '}
                      <code className="px-1.5 py-0.5 rounded bg-[var(--color-surface-3)] font-mono text-[var(--color-danger)] font-semibold">
                        {CONFIRMATION_PHRASE}
                      </code>{' '}
                      abaixo:
                    </p>
                    <Input
                      ref={inputRef}
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      placeholder={CONFIRMATION_PHRASE}
                      className="font-mono text-sm"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <div className="flex gap-[var(--space-2)]">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!isConfirmed || resetting}
                      onClick={handleReset}
                    >
                      {resetting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {resetting ? 'Apagando...' : 'Confirmar Reset'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowReset(false);
                        setConfirmation('');
                      }}
                      disabled={resetting}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
