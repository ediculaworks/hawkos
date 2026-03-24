'use client';

import { AnimatedItem, AnimatedList } from '@/components/motion/animated-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchSecurityItems, updateSecurityItemAction } from '@/lib/actions/security';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

const categoryLabels: Record<string, string> = {
  account: 'Conta',
  backup: 'Backup',
  '2fa': '2FA',
  recovery: 'Recuperação',
  password_manager: 'Gerenciador de Senhas',
  other: 'Outro',
};

const statusConfig: Record<
  'ok' | 'needs_attention' | 'critical',
  { color: string; bg: string; icon: typeof CheckCircle2; label: string }
> = {
  ok: { color: 'text-green-500', bg: 'bg-green-500/10', icon: CheckCircle2, label: 'OK' },
  needs_attention: {
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    icon: Clock,
    label: 'Atenção',
  },
  critical: { color: 'text-red-500', bg: 'bg-red-500/10', icon: AlertTriangle, label: 'Crítico' },
};

export function SecurityList() {
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['security', 'all'],
    queryFn: () => fetchSecurityItems(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ok' | 'needs_attention' | 'critical' }) =>
      updateSecurityItemAction(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security'] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Itens de Segurança
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

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Itens de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            Nenhum item cadastrado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Itens de Segurança ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatedList>
          {items.map((item) => {
            const status = item.status as 'ok' | 'needs_attention' | 'critical';
            const config = statusConfig[status];
            const Icon = config.icon;

            return (
              <AnimatedItem key={item.id}>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-1)]">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {categoryLabels[item.type] ?? item.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        updateMutation.mutate({
                          id: item.id,
                          status: e.target.value as 'ok' | 'needs_attention' | 'critical',
                        })
                      }
                      className="text-sm bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-md px-2 py-1"
                    >
                      <option value="ok">OK</option>
                      <option value="needs_attention">Atenção</option>
                      <option value="critical">Crítico</option>
                    </select>
                  </div>
                </div>
              </AnimatedItem>
            );
          })}
        </AnimatedList>
      </CardContent>
    </Card>
  );
}
