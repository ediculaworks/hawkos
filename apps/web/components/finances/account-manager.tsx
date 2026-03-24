'use client';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select } from '@/components/ui/select';
import { addAccount, fetchAccounts, removeAccount } from '@/lib/actions/finances';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import type { AccountType } from '@hawk/module-finances/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Corrente',
  savings: 'Poupança',
  credit_card: 'Cartão',
  investment: 'Investimento',
  cash: 'Dinheiro',
};

export function AccountManager() {
  const [managing, setManaging] = useState(false);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: accounts } = useQuery({
    queryKey: ['finances', 'accounts'],
    queryFn: () => fetchAccounts(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['finances'] });

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeAccount(id),
    onSuccess: () => {
      invalidate();
      toast.success('Conta removida.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover conta: ${err.message}`);
    },
  });

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation]);

  if (!accounts) return null;

  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-[var(--space-2)]">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Contas
        </span>
        <div className="flex items-center gap-[var(--space-1)]">
          <span className="text-xs font-mono font-semibold text-[var(--color-text-primary)]">
            {formatCurrency(total)}
          </span>
          <button
            type="button"
            onClick={() => setManaging(!managing)}
            className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
            title="Gerenciar contas"
          >
            {managing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {accounts.map((a) => (
        <div key={a.id} className="flex items-center justify-between group">
          <div className="flex items-center gap-[var(--space-1-5)] min-w-0">
            <span className="text-xs text-[var(--color-text-secondary)] truncate">{a.name}</span>
            {managing && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {ACCOUNT_TYPE_LABELS[a.type as AccountType] ?? a.type}
              </span>
            )}
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            <span
              className={cn(
                'text-xs font-mono',
                a.balance >= 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-danger)]',
              )}
            >
              {formatCurrency(a.balance)}
            </span>
            {managing && (
              <button
                type="button"
                onClick={() => setDeleteTarget(a.id)}
                className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
                title="Desabilitar conta"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      ))}

      {managing &&
        (creating ? (
          <CreateAccountForm
            onSuccess={() => {
              setCreating(false);
              invalidate();
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-[var(--space-1)] text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer pt-[var(--space-1)]"
          >
            <Plus className="h-3 w-3" /> Nova conta
          </button>
        ))}

      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Remover conta"
        description="Tem certeza? Transações vinculadas a esta conta não serão deletadas, mas ficarão sem conta associada."
        confirmLabel="Remover"
        variant="danger"
      />
    </div>
  );
}

function CreateAccountForm({
  onSuccess,
  onCancel,
}: { onSuccess: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => addAccount({ name, type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      onSuccess();
      toast.success('Conta criada!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar conta: ${err.message}`);
    },
  });

  return (
    <div className="space-y-[var(--space-1-5)] pt-[var(--space-1)]">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) mutation.mutate();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Nome da conta"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
      />
      <div className="flex gap-[var(--space-1)]">
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          size="sm"
          className="flex-1"
          options={Object.entries(ACCOUNT_TYPE_LABELS).map(([val, label]) => ({
            value: val,
            label,
          }))}
        />
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!name.trim() || mutation.isPending}
        >
          Criar
        </Button>
      </div>
    </div>
  );
}
