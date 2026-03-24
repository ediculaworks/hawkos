'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecordActions } from '@/components/ui/record-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteDocumentAction, fetchDocuments, fetchExpiringDocuments } from '@/lib/actions/assets';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileText } from 'lucide-react';

function getExpiryInfo(expiresAt: string): { label: string; colorClass: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiresAt);
  expiry.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      label: `Expirado há ${absDays} ${absDays === 1 ? 'dia' : 'dias'}`,
      colorClass: 'text-[var(--color-danger)]',
    };
  }
  if (diffDays === 0) {
    return { label: 'Expira hoje', colorClass: 'text-[var(--color-danger)]' };
  }
  if (diffDays <= 30) {
    return {
      label: `Expira em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`,
      colorClass: 'text-[var(--color-danger)]',
    };
  }
  if (diffDays <= 90) {
    return {
      label: `Expira em ${diffDays} dias`,
      colorClass: 'text-[var(--color-warning)]',
    };
  }
  return {
    label: `Expira em ${diffDays} dias`,
    colorClass: 'text-[var(--color-text-muted)]',
  };
}

const typeLabels: Record<string, string> = {
  identity: 'Identidade',
  contract: 'Contrato',
  tax: 'Imposto',
  health: 'Saúde',
  property: 'Propriedade',
  vehicle: 'Veículo',
  other: 'Outro',
};

export function DocumentsList() {
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['assets', 'documents'],
    queryFn: () => fetchDocuments(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocumentAction(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos
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

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            Nenhum documento cadastrado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documentos ({documents.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-1)]"
          >
            <div>
              <p className="font-medium">{doc.name}</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {typeLabels[doc.type] ?? doc.type}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {doc.expires_at &&
                (() => {
                  const { label, colorClass } = getExpiryInfo(doc.expires_at);
                  return <p className={`text-xs font-medium ${colorClass}`}>{label}</p>;
                })()}
              <RecordActions onDelete={() => deleteMutation.mutate(doc.id)} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ExpiringDocuments() {
  const { data: expiring, isLoading } = useQuery({
    queryKey: ['assets', 'expiring'],
    queryFn: () => fetchExpiringDocuments(30),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Documentos a Vencer
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

  if (!expiring || expiring.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Documentos a Vencer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            Nenhum documento vencendo em 30 dias
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Documentos a Vencer ({expiring.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {expiring.map((doc) => {
          if (!doc.expires_at) return null;
          const expiresAt = new Date(doc.expires_at);
          const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const urgency =
            daysLeft <= 7 ? 'text-red-500' : daysLeft <= 15 ? 'text-orange-500' : 'text-yellow-500';

          return (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-1)]"
            >
              <div>
                <p className="font-medium">{doc.name}</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {typeLabels[doc.type] ?? doc.type}
                </p>
              </div>
              <span className={`text-sm font-medium ${urgency}`}>{daysLeft}d</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
