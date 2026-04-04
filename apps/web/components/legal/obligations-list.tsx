'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditSheet } from '@/components/ui/edit-sheet';
import { RecordActions } from '@/components/ui/record-actions';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  completeObligationAction,
  deleteObligationAction,
  editObligation,
  fetchPendingObligations,
} from '@/lib/actions/legal';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, FileText } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import type {
  LegalObligation,
  ObligationFrequency,
  ObligationStatus,
  ObligationType,
  ObligationWithDaysLeft,
} from '@hawk/module-legal';

const urgencyConfig: Record<
  ObligationWithDaysLeft['urgency'],
  { color: string; bg: string; label: string; icon: typeof AlertTriangle }
> = {
  critical: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Crítico', icon: AlertTriangle },
  urgent: { color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Urgente', icon: Clock },
  warning: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Atenção', icon: Clock },
  ok: { color: 'text-green-500', bg: 'bg-green-500/10', label: 'Ok', icon: CheckCircle2 },
};

const typeLabels: Record<ObligationType, string> = {
  tax: 'Imposto',
  declaration: 'Declaração',
  renewal: 'Renovação',
  payment: 'Pagamento',
};

const typeOptions = [
  { value: 'tax', label: 'Imposto' },
  { value: 'declaration', label: 'Declaração' },
  { value: 'renewal', label: 'Renovação' },
  { value: 'payment', label: 'Pagamento' },
];

const frequencyOptions = [
  { value: '', label: 'Sem frequência' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'one_time', label: 'Única vez' },
];

const statusOptions = [
  { value: 'pending', label: 'Pendente' },
  { value: 'completed', label: 'Concluída' },
  { value: 'late', label: 'Atrasada' },
  { value: 'exempted', label: 'Isenta' },
];

function EditObligationSheet({
  obligation,
  onClose,
}: {
  obligation: LegalObligation;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(obligation.name);
  const [type, setType] = useState<ObligationType>(obligation.type as ObligationType);
  const [dueDate, setDueDate] = useState(obligation.due_date);
  const [frequency, setFrequency] = useState<string>(obligation.frequency ?? '');
  const [amount, setAmount] = useState(obligation.amount != null ? String(obligation.amount) : '');
  const [status, setStatus] = useState<ObligationStatus>(obligation.status as ObligationStatus);
  const [notes, setNotes] = useState(obligation.notes ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      editObligation(obligation.id, {
        name,
        type,
        due_date: dueDate,
        frequency: (frequency || undefined) as ObligationFrequency | undefined,
        amount: amount ? Number.parseFloat(amount) : undefined,
        status,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal', 'obligations'] });
      queryClient.invalidateQueries({ queryKey: ['legal', 'urgent'] });
      toast.success('Obrigação atualizada!');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });

  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]';

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="edit-obligation-name"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Nome
        </label>
        <input
          id="edit-obligation-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="edit-obligation-type"
            className="block text-xs text-[var(--color-text-muted)] mb-1"
          >
            Tipo
          </label>
          <Select
            id="edit-obligation-type"
            value={type}
            onChange={(e) => setType(e.target.value as ObligationType)}
            size="sm"
            options={typeOptions}
          />
        </div>
        <div>
          <label
            htmlFor="edit-obligation-status"
            className="block text-xs text-[var(--color-text-muted)] mb-1"
          >
            Status
          </label>
          <Select
            id="edit-obligation-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ObligationStatus)}
            size="sm"
            options={statusOptions}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="edit-obligation-due-date"
            className="block text-xs text-[var(--color-text-muted)] mb-1"
          >
            Vencimento
          </label>
          <input
            id="edit-obligation-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="edit-obligation-amount"
            className="block text-xs text-[var(--color-text-muted)] mb-1"
          >
            Valor (R$)
          </label>
          <input
            id="edit-obligation-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.01"
            min="0"
            placeholder="0,00"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="edit-obligation-frequency"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Frequência
        </label>
        <Select
          id="edit-obligation-frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          size="sm"
          options={frequencyOptions}
        />
      </div>
      <div>
        <label
          htmlFor="edit-obligation-notes"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Observações
        </label>
        <textarea
          id="edit-obligation-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Observações..."
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
        />
      </div>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={!name.trim() || mutation.isPending}
        className="w-full py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-surface-0)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {mutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
      </button>
    </div>
  );
}

export function ObligationsList() {
  const queryClient = useQueryClient();
  const [editingObligation, setEditingObligation] = useState<LegalObligation | null>(null);

  const { data: obligations, isLoading } = useQuery({
    queryKey: ['legal', 'obligations'],
    queryFn: fetchPendingObligations,
  });

  const completeMutation = useMutation({
    mutationFn: completeObligationAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal', 'obligations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteObligationAction,
    onSuccess: () => {
      toast.success('Obrigação removida');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['legal', 'obligations'] });
      queryClient.invalidateQueries({ queryKey: ['legal', 'urgent'] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Obrigações Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!obligations || obligations.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Obrigações Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            Nenhuma obrigação pendente
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Obrigações Pendentes ({obligations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {obligations.map((obligation) => {
            const urgency = obligation.urgency as ObligationWithDaysLeft['urgency'];
            const config = urgencyConfig[urgency];
            const Icon = config.icon;
            const dueDate = new Date(obligation.due_date).toLocaleDateString('pt-BR');

            return (
              <div
                key={obligation.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-1)]"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div>
                    <p className="font-medium">{obligation.name}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {typeLabels[obligation.type as ObligationType]} • {dueDate}
                      {obligation.amount != null &&
                        ` • R$ ${obligation.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${config.color}`}>
                    {obligation.days_until_due < 0
                      ? `Vencida há ${Math.abs(obligation.days_until_due)}d`
                      : obligation.days_until_due === 0
                        ? 'Vence hoje'
                        : `${obligation.days_until_due}d`}
                  </span>
                  <button
                    type="button"
                    onClick={() => completeMutation.mutate(obligation.id)}
                    className="p-2 rounded-md hover:bg-[var(--color-surface-0)] transition-colors"
                    title="Marcar como concluída"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </button>
                  <RecordActions
                    onEdit={() => setEditingObligation(obligation)}
                    onDelete={() => deleteMutation.mutate(obligation.id)}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <EditSheet
        open={editingObligation !== null}
        onClose={() => setEditingObligation(null)}
        title="Editar Obrigação"
      >
        {editingObligation && (
          <EditObligationSheet
            obligation={editingObligation}
            onClose={() => setEditingObligation(null)}
          />
        )}
      </EditSheet>
    </>
  );
}
