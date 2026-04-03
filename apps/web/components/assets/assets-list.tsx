'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditSheet } from '@/components/ui/edit-sheet';
import { RecordActions } from '@/components/ui/record-actions';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteAssetAction, editAssetAction, fetchAssets } from '@/lib/actions/assets';
import type { Asset, AssetCondition, AssetType, UpdateAssetInput } from '@hawk/module-assets/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const typeLabels: Record<string, string> = {
  electronics: 'Eletrônico',
  vehicle: 'Veículo',
  real_estate: 'Imóvel',
  investment: 'Investimento',
  furniture: 'Móvel',
  other: 'Outros',
};

const conditionConfig: Record<
  AssetCondition,
  { label: string; variant: 'success' | 'default' | 'warning' | 'danger' }
> = {
  excellent: { label: 'Excelente', variant: 'success' },
  good: { label: 'Bom', variant: 'default' },
  fair: { label: 'Regular', variant: 'warning' },
  poor: { label: 'Ruim', variant: 'danger' },
};

const typeOptions = [
  { value: 'electronics', label: 'Eletrônico' },
  { value: 'vehicle', label: 'Veículo' },
  { value: 'real_estate', label: 'Imóvel' },
  { value: 'investment', label: 'Investimento' },
  { value: 'furniture', label: 'Móvel' },
  { value: 'other', label: 'Outros' },
];

const conditionOptions = [
  { value: 'excellent', label: 'Excelente' },
  { value: 'good', label: 'Bom' },
  { value: 'fair', label: 'Regular' },
  { value: 'poor', label: 'Ruim' },
];

function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export function AssetsList() {
  const queryClient = useQueryClient();
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AssetType>('other');
  const [editValue, setEditValue] = useState('');
  const [editCondition, setEditCondition] = useState<AssetCondition | ''>('');

  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets', 'all'],
    queryFn: () => fetchAssets(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAssetAction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover patrimônio: ${err.message}`);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateAssetInput }) =>
      editAssetAction(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setEditingAsset(null);
      toast.success('Bem atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar bem: ${err.message}`);
    },
  });

  function openEdit(asset: Asset) {
    setEditingAsset(asset);
    setEditName(asset.name);
    setEditType(asset.type);
    setEditValue(asset.value != null ? String(asset.value) : '');
    setEditCondition(asset.condition ?? '');
  }

  function handleEditSave() {
    if (!editingAsset) return;
    const updates: UpdateAssetInput = { name: editName, type: editType };
    if (editValue) updates.value = Number.parseFloat(editValue);
    if (editCondition) updates.condition = editCondition;
    editMutation.mutate({ id: editingAsset.id, updates });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Meus Bens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Meus Bens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            Nenhum bem cadastrado
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalValue = assets.reduce((sum, a) => sum + (a.value ?? 0), 0);

  // Group assets by type, preserving a stable order
  const typeOrder: AssetType[] = [
    'real_estate',
    'vehicle',
    'investment',
    'electronics',
    'furniture',
    'other',
  ];
  const grouped = typeOrder.reduce<Record<string, Asset[]>>((acc, type) => {
    const group = assets.filter((a) => a.type === type);
    if (group.length > 0) acc[type] = group;
    return acc;
  }, {});
  // Include any types not covered by typeOrder
  for (const asset of assets) {
    if (!(asset.type in grouped)) {
      if (!grouped[asset.type]) grouped[asset.type] = [];
      (grouped[asset.type] as Asset[]).push(asset);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Meus Bens ({assets.length})
            </CardTitle>
            {totalValue > 0 && (
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-muted)]">Patrimônio total</p>
                <p className="text-base font-semibold">{formatBRL(totalValue)}</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(grouped).map(([type, group]) => (
            <div key={type}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                {typeLabels[type] ?? type}
              </p>
              <div className="space-y-2">
                {group.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-1)]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{asset.name}</p>
                        {asset.condition && (
                          <Badge
                            variant={conditionConfig[asset.condition].variant}
                            className="mt-1"
                          >
                            {conditionConfig[asset.condition].label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {asset.value != null && (
                        <p className="text-sm font-medium tabular-nums">{formatBRL(asset.value)}</p>
                      )}
                      <RecordActions
                        onEdit={() => openEdit(asset)}
                        onDelete={() => deleteMutation.mutate(asset.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <EditSheet
        open={editingAsset !== null}
        onClose={() => setEditingAsset(null)}
        title="Editar Bem"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="edit-asset-name"
              className="text-xs font-medium text-[var(--color-text-muted)]"
            >
              Nome
            </label>
            <input
              id="edit-asset-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="edit-asset-type"
              className="text-xs font-medium text-[var(--color-text-muted)]"
            >
              Tipo
            </label>
            <Select
              id="edit-asset-type"
              value={editType}
              onChange={(e) => setEditType(e.target.value as AssetType)}
              options={typeOptions}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Valor (R$)</label>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              step="0.01"
              min="0"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-2 text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Condição</label>
            <Select
              value={editCondition}
              onChange={(e) => setEditCondition(e.target.value as AssetCondition | '')}
              placeholder="Selecionar condição"
              options={conditionOptions}
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={handleEditSave}
            disabled={!editName || editMutation.isPending}
          >
            {editMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>
      </EditSheet>
    </>
  );
}
