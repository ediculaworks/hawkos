'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { agentHeaders, getAgentApiUrl } from '@/lib/config';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface Automation {
  name: string;
  description: string;
  cron: string;
  category: string;
  custom?: boolean;
  enabled: boolean;
  cron_expression: string;
  last_run?: string;
  run_count: number;
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCron, setNewCron] = useState('0 * * * *');
  const [newCategory, setNewCategory] = useState('custom');

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getAgentApiUrl()}/automations`, { headers: agentHeaders() });
      if (!res.ok) {
        setError(
          res.status === 401 ? 'Não autorizado. Verifique AGENT_API_TOKEN.' : `Erro ${res.status}`,
        );
        return;
      }
      const data = await res.json();
      setAutomations(data.automations ?? []);
    } catch {
      setError(`Agente offline. Verifique se o agent está rodando em ${getAgentApiUrl()}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutomation = async (name: string, enabled: boolean) => {
    try {
      await fetch(`${getAgentApiUrl()}/automations`, {
        method: 'PUT',
        headers: agentHeaders(),
        body: JSON.stringify({ id: name, enabled }),
      });
      fetchAutomations();
    } catch {
      setError('Falha ao atualizar automação.');
    }
  };

  const updateCron = async (name: string, cron_expression: string) => {
    try {
      await fetch(`${getAgentApiUrl()}/automations`, {
        method: 'PUT',
        headers: agentHeaders(),
        body: JSON.stringify({ id: name, cron_expression }),
      });
      fetchAutomations();
    } catch {
      setError('Falha ao atualizar cron.');
    }
  };

  const triggerAutomation = async (name: string) => {
    setTriggering(name);
    try {
      await fetch(`${getAgentApiUrl()}/automations/${name}/trigger`, {
        method: 'POST',
        headers: agentHeaders(),
      });
      fetchAutomations();
    } catch {
      setError('Falha ao executar automação.');
    } finally {
      setTriggering(null);
    }
  };

  const createAutomation = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`${getAgentApiUrl()}/automations`, {
        method: 'POST',
        headers: agentHeaders(),
        body: JSON.stringify({
          name: newName.trim().toLowerCase().replace(/\s+/g, '-'),
          description: newDescription || newName,
          cron_expression: newCron,
          category: newCategory,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(`Erro: ${err.error}`);
        return;
      }
      toast.success('Automação criada!');
      setShowCreateForm(false);
      setNewName('');
      setNewDescription('');
      setNewCron('0 * * * *');
      setNewCategory('custom');
      fetchAutomations();
    } catch {
      toast.error('Falha ao criar automação.');
    }
  };

  const deleteAutomation = async (name: string) => {
    try {
      const res = await fetch(`${getAgentApiUrl()}/automations/${name}`, {
        method: 'DELETE',
        headers: agentHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(`Erro: ${err.error}`);
        return;
      }
      toast.success('Automação excluída');
      fetchAutomations();
    } catch {
      toast.error('Falha ao excluir automação.');
    }
  };

  const getNextRun = (cron: string) => {
    const parts = cron.split(' ');
    if (parts.length < 2) return cron;
    const hour = Number.parseInt(parts[1] ?? '0', 10);
    const minute = Number.parseInt(parts[0] ?? '0', 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return cron;
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next.toLocaleString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-[var(--space-5)]">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 animate-pulse rounded bg-[var(--color-surface-3)]" />
          <div className="h-9 w-28 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-3)]" />
        </div>
        <ListSkeleton items={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-[var(--space-4)]">
        <AlertTriangle className="h-10 w-10 text-[var(--color-warning)]" />
        <p className="text-sm text-[var(--color-text-muted)] text-center max-w-md">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchAutomations}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (automations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-[var(--space-4)]">
        <Zap className="h-10 w-10 text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-muted)]">Nenhuma automação configurada.</p>
        <Button variant="outline" size="sm" onClick={fetchAutomations}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Recarregar
        </Button>
      </div>
    );
  }

  const grouped = automations.reduce(
    (acc, auto) => {
      const cat = auto.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(auto);
      return acc;
    },
    {} as Record<string, Automation[]>,
  );

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--space-3)]">
          <Zap className="h-6 w-6 text-[var(--color-accent)]" />
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Automations</h1>
          <span className="text-xs text-[var(--color-text-muted)]">
            {automations.length} configuradas
          </span>
        </div>
        <div className="flex gap-[var(--space-2)]">
          <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="h-3.5 w-3.5" /> Automação
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAutomations}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <CardContent className="pt-[var(--space-4)] space-y-[var(--space-3)]">
            <div className="flex gap-[var(--space-2)]">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome (ex: backup-diario)"
                className="flex-1"
              />
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Descrição"
                className="flex-1"
              />
            </div>
            <div className="flex gap-[var(--space-2)]">
              <Input
                value={newCron}
                onChange={(e) => setNewCron(e.target.value)}
                placeholder="Cron expression"
                className="w-40"
              />
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Categoria"
                className="w-32"
              />
              <Button size="sm" onClick={createAutomation} disabled={!newName.trim()}>
                Criar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories */}
      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-base capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((auto) => (
              <div
                key={auto.name}
                className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)]"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <Switch
                      checked={auto.enabled}
                      onCheckedChange={(checked) => toggleAutomation(auto.name, checked)}
                    />
                    <span className="font-medium text-sm">{auto.description || auto.name}</span>
                  </div>
                  <div className="flex items-center gap-[var(--space-4)] mt-[var(--space-2)] text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getNextRun(auto.cron_expression || auto.cron)}
                    </span>
                    <span>Execuções: {auto.run_count}</span>
                    {auto.last_run && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-[var(--color-success)]" />
                        {new Date(auto.last_run).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-[var(--space-2)]">
                  <Input
                    value={auto.cron_expression || auto.cron}
                    onChange={(e) => updateCron(auto.name, e.target.value)}
                    className="w-32 text-xs"
                    placeholder="Cron"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => triggerAutomation(auto.name)}
                    disabled={triggering === auto.name}
                  >
                    {triggering === auto.name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  {auto.custom && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteAutomation(auto.name)}
                      className="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
