'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditSheet } from '@/components/ui/edit-sheet';
import { RecordActions } from '@/components/ui/record-actions';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteLegalEntityAction, editLegalEntity, fetchLegalEntities } from '@/lib/actions/legal';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import type { LegalEntity, LegalEntityType } from '@hawk/module-legal';

const typeLabels: Record<LegalEntityType, string> = {
  cpf: 'CPF',
  mei: 'MEI',
  ltda: 'LTDA',
  sa: 'S.A.',
};

const typeColors: Record<LegalEntityType, string> = {
  cpf: 'var(--color-primary)',
  mei: 'var(--color-warning)',
  ltda: 'var(--color-success)',
  sa: 'var(--color-danger)',
};

const typeOptions = [
  { value: 'cpf', label: 'CPF' },
  { value: 'mei', label: 'MEI' },
  { value: 'ltda', label: 'LTDA' },
  { value: 'sa', label: 'S.A.' },
];

function EditEntitySheet({
  entity,
  onClose,
}: {
  entity: LegalEntity;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(entity.name);
  const [type, setType] = useState<LegalEntityType>(entity.type as LegalEntityType);
  const [document, setDocument] = useState(entity.document ?? '');
  const [registrationDate, setRegistrationDate] = useState(entity.registration_date ?? '');
  const [notes, setNotes] = useState(entity.notes ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      editLegalEntity(entity.id, {
        name,
        type,
        document: document || undefined,
        registration_date: registrationDate || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal', 'entities'] });
      toast.success('Entidade atualizada!');
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
          htmlFor="edit-entity-name"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Nome
        </label>
        <input
          id="edit-entity-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="edit-entity-type"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Tipo
        </label>
        <Select
          id="edit-entity-type"
          value={type}
          onChange={(e) => setType(e.target.value as LegalEntityType)}
          size="sm"
          options={typeOptions}
        />
      </div>
      <div>
        <label
          htmlFor="edit-entity-document"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          CPF / CNPJ
        </label>
        <input
          id="edit-entity-document"
          type="text"
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          placeholder="000.000.000-00"
          className={`${inputClass} font-mono`}
        />
      </div>
      <div>
        <label
          htmlFor="edit-entity-registration-date"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Data de abertura
        </label>
        <input
          id="edit-entity-registration-date"
          type="date"
          value={registrationDate}
          onChange={(e) => setRegistrationDate(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="edit-entity-notes"
          className="block text-xs text-[var(--color-text-muted)] mb-1"
        >
          Observações
        </label>
        <textarea
          id="edit-entity-notes"
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

export function EntitiesSummary() {
  const queryClient = useQueryClient();
  const [editingEntity, setEditingEntity] = useState<LegalEntity | null>(null);

  const { data: entities, isLoading } = useQuery({
    queryKey: ['legal', 'entities'],
    queryFn: fetchLegalEntities,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLegalEntityAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal', 'entities'] });
      toast.success('Entidade removida');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover entidade: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Entidades Jurídicas
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

  if (!entities || entities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Entidades Jurídicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            Nenhuma entidade cadastrada
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
            <Building2 className="h-4 w-4" />
            Entidades Jurídicas ({entities.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {entities.map((entity) => {
            const entityType = entity.type as LegalEntityType;
            const typeColor = typeColors[entityType];
            const typeLabel = typeLabels[entityType];

            return (
              <div
                key={entity.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-1)]"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{entity.name}</p>
                    {entityType && (
                      <Badge
                        style={{
                          backgroundColor: `${typeColor}20`,
                          color: typeColor,
                          borderColor: `${typeColor}40`,
                        }}
                        variant="muted"
                      >
                        {typeLabel}
                      </Badge>
                    )}
                  </div>
                  {entity.document && (
                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5 font-mono">
                      {entity.document}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entity.registration_date && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Desde {new Date(entity.registration_date).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                  <RecordActions
                    onEdit={() => setEditingEntity(entity)}
                    onDelete={() => deleteMutation.mutate(entity.id)}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <EditSheet
        open={editingEntity !== null}
        onClose={() => setEditingEntity(null)}
        title="Editar Entidade"
      >
        {editingEntity && (
          <EditEntitySheet entity={editingEntity} onClose={() => setEditingEntity(null)} />
        )}
      </EditSheet>
    </>
  );
}
