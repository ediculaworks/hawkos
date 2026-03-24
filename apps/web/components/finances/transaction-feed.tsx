'use client';
import { AnimatedItem, AnimatedList } from '@/components/motion/animated-list';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { RecordActions } from '@/components/ui/record-actions';
import { Select } from '@/components/ui/select';
import {
  editTransaction,
  fetchAccounts,
  fetchCategories,
  removeTransaction,
} from '@/lib/actions/finances';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, todayDateStr } from '@/lib/utils/format';
import type { TransactionWithCategory } from '@hawk/module-finances/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReceiptText, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';

type Props = {
  transactions: TransactionWithCategory[];
};

function groupByDate(txns: TransactionWithCategory[]): Record<string, TransactionWithCategory[]> {
  const groups: Record<string, TransactionWithCategory[]> = {};
  for (const t of txns) {
    const key = t.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return groups;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const today = todayDateStr();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    yesterdayDate,
  );

  if (dateStr === today) return 'Hoje';
  if (dateStr === yesterday) return 'Ontem';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

export function TransactionFeed({ transactions }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const { data: accounts } = useQuery({
    queryKey: ['finances', 'accounts'],
    queryFn: () => fetchAccounts(),
    enabled: editingId !== null,
  });
  const { data: categories } = useQuery({
    queryKey: ['finances', 'categories-all'],
    queryFn: () => fetchCategories(),
    enabled: editingId !== null,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      toast.success('Transação excluída');
    },
    onError: (err: Error) => toast.error(`Erro ao excluir transação: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      editTransaction(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      setEditingId(null);
      toast.success('Transação atualizada');
    },
    onError: (err: Error) => toast.error(`Erro ao atualizar: ${err.message}`),
  });

  const startEdit = (t: TransactionWithCategory) => {
    setEditingId(t.id);
    setEditAmount(String(t.amount));
    setEditDescription(t.description ?? '');
    setEditCategoryId(t.category_id);
    setEditAccountId(t.account_id);
  };

  const submitEdit = (id: string) => {
    updateMutation.mutate({
      id,
      updates: {
        amount: Number.parseFloat(editAmount),
        description: editDescription,
        category_id: editCategoryId,
        account_id: editAccountId,
      },
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 300);
  };

  const filtered = transactions.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (
      search &&
      !t.description?.toLowerCase().includes(search.toLowerCase()) &&
      !t.category_name.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const grouped = groupByDate(filtered);
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-[var(--space-3)]">
      {/* Filter bar */}
      <div className="flex items-center gap-[var(--space-2)]">
        <div className="relative flex-1">
          <Search className="absolute left-[var(--space-2-5)] top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] pl-8 pr-[var(--space-3)] py-[var(--space-1-5)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="flex gap-[var(--space-0-5)] rounded-[var(--radius-md)] bg-[var(--color-surface-1)] p-[var(--space-0-5)]">
          {(['all', 'expense', 'income'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTypeFilter(f)}
              className={cn(
                'px-[var(--space-2)] py-[var(--space-0-5)] rounded-[var(--radius-sm)] text-[11px] font-medium transition-colors cursor-pointer',
                typeFilter === f
                  ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
              )}
            >
              {f === 'all' ? 'Todas' : f === 'income' ? 'Receitas' : 'Despesas'}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped transactions */}
      {dates.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Nenhuma transação encontrada"
          description="Registre seu primeiro gasto ou receita pelo agente ou pelo botão + Transação acima."
        />
      ) : (
        <AnimatedList>
          {dates.map((date) => (
            <AnimatedItem key={date}>
              <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                {formatDateLabel(date)}
              </span>
              <div className="mt-[var(--space-1)] space-y-[var(--space-0-5)]">
                {grouped[date]?.map((t) =>
                  editingId === t.id ? (
                    <div
                      key={t.id}
                      className="flex flex-col gap-[var(--space-2)] py-[var(--space-2)] px-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-accent)]/30"
                    >
                      <div className="flex gap-[var(--space-2)]">
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          step="0.01"
                          className="w-28 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-[var(--space-1)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Descrição"
                          className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-[var(--space-1)] text-xs focus:outline-none focus:border-[var(--color-accent)]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitEdit(t.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                      </div>
                      <div className="flex gap-[var(--space-2)]">
                        <Select
                          value={editCategoryId}
                          onChange={(e) => setEditCategoryId(e.target.value)}
                          placeholder="Categoria"
                          size="sm"
                          options={categories?.map((c) => ({ value: c.id, label: c.name })) ?? []}
                        />
                        <Select
                          value={editAccountId}
                          onChange={(e) => setEditAccountId(e.target.value)}
                          placeholder="Conta"
                          size="sm"
                          options={accounts?.map((a) => ({ value: a.id, label: a.name })) ?? []}
                        />
                      </div>
                      <div className="flex justify-end gap-[var(--space-2)]">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => submitEdit(t.id)}
                          disabled={!editAmount || updateMutation.isPending}
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={t.id}
                      className="group flex items-center gap-[var(--space-3)] py-[var(--space-1-5)] px-[var(--space-2)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-2)]/50 transition-colors"
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: t.category_color ?? 'var(--color-text-muted)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[var(--color-text-primary)] truncate block">
                          {t.description || t.category_name}
                        </span>
                        {t.description && (
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            {t.category_name}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-sm font-mono flex-shrink-0',
                          t.type === 'income'
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--color-text-primary)]',
                        )}
                      >
                        {t.type === 'income' ? '+' : '-'}
                        {formatCurrency(t.amount)}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <RecordActions
                          onEdit={() => startEdit(t)}
                          onDelete={() => deleteMutation.mutate(t.id)}
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </AnimatedItem>
          ))}
        </AnimatedList>
      )}
    </div>
  );
}
