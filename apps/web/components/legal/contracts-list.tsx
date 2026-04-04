'use client';

import { AnimatedItem, AnimatedList } from '@/components/motion/animated-list';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditSheet } from '@/components/ui/edit-sheet';
import { RecordActions } from '@/components/ui/record-actions';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteContractAction, editContract, fetchAllContracts } from '@/lib/actions/legal';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, FileSignature } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import type { Contract, ContractStatus, ContractType } from '@hawk/module-legal';

const typeLabels: Record<string, string> = {
  employment: 'Trabalho',
  service: 'Serviço',
  rental: 'Aluguel',
  partnership: 'Parceria',
  other: 'Outro',
};

const statusConfig: Record<ContractStatus, { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'var(--color-success)' },
  expired: { label: 'Expirado', color: 'var(--color-danger)' },
  terminated: { label: 'Encerrado', color: 'var(--color-danger)' },
  draft: { label: 'Rascunho', color: 'var(--color-warning)' },
};

const typeOptions = [
  { value: '', label: 'Sem tipo' },
  { value: 'service', label: 'Serviço' },
  { value: 'employment', label: 'Trabalho' },
  { value: 'rental', label: 'Aluguel' },
  { value: 'partnership', label: 'Parceria' },
  { value: 'other', label: 'Outro' },
];

const statusOptions = [
  { value: 'active', label: 'Ativo' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'expired', label: 'Expirado' },
  { value: 'terminated', label: 'Encerrado' },
];

function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function EditContractSheet({
  contract,
  onClose,
}: {
  contract: Contract;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(contract.title);
  const [parties, setParties] = useState(contract.parties?.join(', ') ?? '');
  const [type, setType] = useState<string>(contract.type ?? '');
  const [startDate, setStartDate] = useState(contract.start_date ?? '');
  const [endDate, setEndDate] = useState(contract.end_date ?? '');
  const [value, setValue] = useState(contract.value != null ? String(contract.value) : '');
  const [status, setStatus] = useState<ContractStatus>(
    (contract.status ?? 'active') as ContractStatus,
  );
  const [notes, setNotes] = useState(contract.notes ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      editContract(contract.id, {
        title,
        parties: parties
          ? parties
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
          : [],
        type: (type || undefined) as ContractType | undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        value: value ? Number.parseFloat(value) : undefined,
        status,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal', 'contracts'] });
      toast.success('Contrato atualizado!');
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
          htmlFor="edit-contract-title"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Título
        </label>
        <input
          id="edit-contract-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="edit-contract-parties"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Partes (separadas por vírgula)
        </label>
        <input
          id="edit-contract-parties"
          type="text"
          value={parties}
          onChange={(e) => setParties(e.target.value)}
          placeholder="Empresa X, Empresa Y"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="edit-contract-type"
            className="block text-xs text-[var(--color-text-muted)] mb-1"
          >
            Tipo
          </label>
          <Select
            id="edit-contract-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            size="sm"
            options={typeOptions}
          />
        </div>
        <div>
          <label
            htmlFor="edit-contract-status"
            className="block text-xs text-[var(--color-text-muted)] mb-1"
          >
            Status
          </label>
          <Select
            id="edit-contract-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ContractStatus)}
            size="sm"
            options={statusOptions}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="edit-contract-start-date"
            className="block text-xs text-[var(--color-text-muted)] mb-1"
          >
            Início
          </label>
          <input
            id="edit-contract-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="edit-contract-end-date"
            className="block text-xs text-[var(--color-text-muted)] mb-1"
          >
            Vencimento
          </label>
          <input
            id="edit-contract-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="edit-contract-value"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Valor (R$)
        </label>
        <input
          id="edit-contract-value"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          step="0.01"
          min="0"
          placeholder="0,00"
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="edit-contract-notes"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Observações
        </label>
        <textarea
          id="edit-contract-notes"
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
        disabled={!title.trim() || mutation.isPending}
        className="w-full py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-surface-0)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {mutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
      </button>
    </div>
  );
}

export function ContractsList() {
  const queryClient = useQueryClient();
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['legal', 'contracts'],
    queryFn: fetchAllContracts,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContractAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal', 'contracts'] });
      toast.success('Contrato removido');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover contrato: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Contratos
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

  if (!contracts || contracts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Contratos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            Nenhum contrato cadastrado
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
            <FileSignature className="h-4 w-4" />
            Contratos ({contracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <AnimatedList>
            {contracts.map((contract) => {
              const startDate = contract.start_date
                ? new Date(contract.start_date).toLocaleDateString('pt-BR')
                : null;
              const endDate = contract.end_date
                ? new Date(contract.end_date).toLocaleDateString('pt-BR')
                : null;
              const status = (contract.status ?? 'draft') as ContractStatus;
              const statusInfo = statusConfig[status] ?? statusConfig.draft;

              return (
                <AnimatedItem key={contract.id}>
                  <div className="flex items-start justify-between p-3 rounded-lg bg-[var(--color-surface-1)]">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{contract.title}</p>
                        <Badge
                          style={{
                            backgroundColor: `${statusInfo.color}20`,
                            color: statusInfo.color,
                            borderColor: `${statusInfo.color}40`,
                          }}
                          variant="muted"
                        >
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                        {contract.type && typeLabels[contract.type]}
                        {contract.parties.length > 0 && ` • ${contract.parties.join(', ')}`}
                      </p>
                      {(startDate || endDate) && (
                        <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {startDate && `${startDate}`}
                          {startDate && endDate && ' → '}
                          {endDate ?? 'Indeterminado'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {contract.value != null && (
                        <p className="text-sm font-medium text-right">
                          {formatBRL(contract.value)}
                        </p>
                      )}
                      <RecordActions
                        onEdit={() => setEditingContract(contract)}
                        onDelete={() => deleteMutation.mutate(contract.id)}
                      />
                    </div>
                  </div>
                </AnimatedItem>
              );
            })}
          </AnimatedList>
        </CardContent>
      </Card>

      <EditSheet
        open={editingContract !== null}
        onClose={() => setEditingContract(null)}
        title="Editar Contrato"
      >
        {editingContract && (
          <EditContractSheet contract={editingContract} onClose={() => setEditingContract(null)} />
        )}
      </EditSheet>
    </>
  );
}
