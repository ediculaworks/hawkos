'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  connectWithApiKey,
  disconnectExtension,
  fetchExtensions,
  toggleSync,
  triggerSync,
} from '@/lib/actions/extensions';
import type { ExtensionView } from '@hawk/extensions/core/types';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Github,
  Key,
  ListChecks,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const EXTENSION_ICONS: Record<string, React.ReactNode> = {
  github: <Github className="h-5 w-5" />,
  'list-checks': <ListChecks className="h-5 w-5" />,
};

function getIcon(icon: string) {
  return EXTENSION_ICONS[icon] ?? <Plug className="h-5 w-5" />;
}

function formatDate(iso: string | null) {
  if (!iso) return 'Nunca';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState<ExtensionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({});
  const [showApiKeyFor, setShowApiKeyFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchExtensions();
      setExtensions(data);
    } catch {
      toast.error('Falha ao carregar extensões');
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — load is stable, only run on mount
  useEffect(() => {
    load();
  }, []);

  const handleConnect = (ext: ExtensionView) => {
    if (ext.authMethod === 'api_key') {
      setShowApiKeyFor(ext.id);
    } else {
      // OAuth flow — redirect to auth endpoint
      window.location.href = `/api/extensions/${ext.id}/auth`;
    }
  };

  const handleApiKeySubmit = async (extId: string) => {
    const key = apiKeyInput[extId];
    if (!key) return;
    const result = await connectWithApiKey(extId, key);
    if (result.ok) {
      toast.success('Conectado!');
      setShowApiKeyFor(null);
      setApiKeyInput((prev) => ({ ...prev, [extId]: '' }));
      load();
    } else {
      toast.error(result.error ?? 'Falha ao conectar');
    }
  };

  const handleDisconnect = async (extId: string) => {
    await disconnectExtension(extId);
    toast.success('Desconectado');
    load();
  };

  const handleSync = async (extId: string) => {
    setSyncing(extId);
    try {
      const result = await triggerSync(extId);
      if (result.errors.length > 0) {
        toast.error(`Sync com erros: ${result.errors[0]}`);
      } else {
        toast.success(`${result.synced} itens sincronizados`);
      }
      load();
    } catch {
      toast.error('Falha no sync');
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleSync = async (extId: string, enabled: boolean) => {
    await toggleSync(extId, enabled);
    load();
  };

  return (
    <div className="space-y-[var(--space-6)] p-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)]">
        <Plug className="h-6 w-6 text-[var(--color-accent)]" />
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Extensões</h1>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] -mt-[var(--space-4)]">
        Conecte serviços externos para enriquecer seus módulos com dados em tempo real.
      </p>

      {/* Extensions Grid */}
      {loading ? (
        <ListSkeleton items={3} />
      ) : extensions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[var(--color-text-muted)]">
            Nenhuma extensão disponível.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-[var(--space-4)] md:grid-cols-2">
          {extensions.map((ext) => (
            <Card key={ext.id} className="relative overflow-hidden">
              {/* Status indicator strip */}
              <div
                className={`absolute left-0 top-0 h-full w-1 ${
                  ext.connected
                    ? 'bg-[var(--color-success)]'
                    : ext.status === 'error'
                      ? 'bg-[var(--color-danger)]'
                      : 'bg-[var(--color-surface-3)]'
                }`}
              />

              <CardHeader className="pl-[var(--space-6)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-[var(--space-3)]">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] ${
                        ext.connected
                          ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                          : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      {getIcon(ext.icon)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{ext.name}</CardTitle>
                      <p className="text-xs text-[var(--color-text-muted)]">{ext.description}</p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`text-xs px-[var(--space-2)] py-[var(--space-0-5)] rounded-full whitespace-nowrap ${
                      ext.connected
                        ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                        : ext.status === 'error'
                          ? 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
                          : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {ext.connected ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Conectado
                      </span>
                    ) : ext.status === 'error' ? (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Erro
                      </span>
                    ) : (
                      'Desconectado'
                    )}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pl-[var(--space-6)] space-y-[var(--space-3)]">
                {/* Error message */}
                {ext.lastError && (
                  <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)]">
                    {ext.lastError}
                  </p>
                )}

                {/* Connected state: sync info + actions */}
                {ext.connected && (
                  <>
                    <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                      <span>Último sync: {formatDate(ext.lastSyncAt)}</span>
                      <div className="flex items-center gap-[var(--space-2)]">
                        <span className="text-xs">Auto-sync</span>
                        <Switch
                          checked={ext.syncEnabled}
                          onCheckedChange={(v) => handleToggleSync(ext.id, v)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-[var(--space-2)]">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(ext.id)}
                        disabled={syncing === ext.id}
                      >
                        {syncing === ext.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        )}
                        Sincronizar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[var(--color-danger)]"
                        onClick={() => handleDisconnect(ext.id)}
                      >
                        <Unplug className="h-3.5 w-3.5 mr-1" />
                        Desconectar
                      </Button>
                    </div>
                  </>
                )}

                {/* Disconnected state: connect button */}
                {!ext.connected && (
                  <>
                    {/* API Key input form */}
                    {showApiKeyFor === ext.id && (
                      <div className="flex gap-[var(--space-2)]">
                        <Input
                          type="password"
                          placeholder="Cole sua API key..."
                          value={apiKeyInput[ext.id] ?? ''}
                          onChange={(e) =>
                            setApiKeyInput((prev) => ({ ...prev, [ext.id]: e.target.value }))
                          }
                          className="text-sm"
                        />
                        <Button size="sm" onClick={() => handleApiKeySubmit(ext.id)}>
                          Salvar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowApiKeyFor(null)}>
                          Cancelar
                        </Button>
                      </div>
                    )}

                    {showApiKeyFor !== ext.id && (
                      <div className="flex gap-[var(--space-2)]">
                        <Button size="sm" onClick={() => handleConnect(ext)}>
                          {ext.authMethod === 'api_key' ? (
                            <Key className="h-3.5 w-3.5 mr-1" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          )}
                          Conectar
                        </Button>
                        {/* Show API key option for OAuth extensions too */}
                        {ext.authMethod === 'oauth2' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowApiKeyFor(ext.id)}
                          >
                            <Key className="h-3.5 w-3.5 mr-1" />
                            API Key
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
