'use client';

import { IntegrationCard } from '@/components/extensions/integrations/integration-card';
import { IntegrationForm } from '@/components/extensions/integrations/integration-form';
import { INTEGRATION_REGISTRY } from '@/components/extensions/integrations/registry';
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
import {
  type IntegrationSummary,
  fetchIntegrations,
  saveIntegration,
} from '@/lib/actions/integrations';
import { agentHeaders, getAgentApiUrl } from '@/lib/config';
import type { IntegrationProvider } from '@hawk/admin';
import type { ExtensionView } from '@hawk/extensions/core/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Code,
  ExternalLink,
  Github,
  Globe,
  Key,
  ListChecks,
  Loader2,
  type LucideIcon,
  Mail,
  MessageCircle,
  Phone,
  Plug,
  Puzzle,
  Radio,
  RefreshCw,
  Send,
  Server,
  ShoppingBag,
  Slack,
  Sparkles,
  Unplug,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

// ── Tab definitions ─────────────────────────────────────────────────────────

type ExtTab = 'channels' | 'integrations' | 'mcp' | 'api' | 'skills' | 'marketplace';

const TABS: { id: ExtTab; label: string; icon: React.ElementType }[] = [
  { id: 'channels', label: 'Canais', icon: Radio },
  { id: 'integrations', label: 'Integracoes', icon: Plug },
  { id: 'mcp', label: 'MCP', icon: Server },
  { id: 'api', label: 'API', icon: Key },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
];

// ── Channel definitions ─────────────────────────────────────────────────────

interface ChannelDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  available: boolean;
}

const CHANNELS: ChannelDef[] = [
  {
    id: 'discord',
    name: 'Discord',
    description: 'Canal principal via bot Discord',
    icon: Bot,
    color: '#5865F2',
    available: true,
  },
  {
    id: 'web',
    name: 'Web Chat',
    description: 'Chat integrado no dashboard',
    icon: Globe,
    color: 'var(--color-accent)',
    available: true,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Bot Telegram para mensagens rapidas',
    icon: Send,
    color: '#26A5E4',
    available: false,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Via WhatsApp Business API',
    icon: MessageCircle,
    color: '#25D366',
    available: false,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Integracao com workspaces Slack',
    icon: Slack,
    color: '#E01E5A',
    available: false,
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Enviar e receber via SMTP/IMAP',
    icon: Mail,
    color: '#EA4335',
    available: false,
  },
  {
    id: 'voice',
    name: 'Voz',
    description: 'Interacao por voz via Whisper + TTS',
    icon: Phone,
    color: '#8B5CF6',
    available: false,
  },
];

// ── Extension icons ─────────────────────────────────────────────────────────

const EXT_ICONS: Record<string, React.ReactNode> = {
  github: <Github className="h-5 w-5" />,
  'list-checks': <ListChecks className="h-5 w-5" />,
};

function getExtIcon(icon: string) {
  return EXT_ICONS[icon] ?? <Plug className="h-5 w-5" />;
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

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ExtensionsPage() {
  const [activeTab, setActiveTab] = useState<ExtTab>('channels');

  return (
    <div className="space-y-[var(--space-6)] p-[var(--space-6)]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-[var(--space-3)]">
          <Puzzle className="h-6 w-6 text-[var(--color-accent)]" />
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Extensoes</h1>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Canais, integracoes, servidores MCP e extensoes do Hawk OS.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-[var(--space-1)] p-[var(--space-1)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)] overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-[var(--space-1-5)] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'channels' && <ChannelsTab />}
      {activeTab === 'integrations' && <IntegrationsTab />}
      {activeTab === 'mcp' && <MCPTab />}
      {activeTab === 'api' && <APITab />}
      {activeTab === 'skills' && <SkillsTab />}
      {activeTab === 'marketplace' && <MarketplaceTab />}
    </div>
  );
}

// ── Channels Tab ────────────────────────────────────────────────────────────

function ChannelsTab() {
  const [enabledChannels, setEnabledChannels] = useState<string[]>(['discord', 'web']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getAgentApiUrl()}/settings`, { headers: agentHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.enabled_channels) {
            setEnabledChannels(data.settings.enabled_channels);
          }
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleChannel = async (channelId: string, enabled: boolean) => {
    const prev = enabledChannels;
    const updated = enabled
      ? [...enabledChannels, channelId]
      : enabledChannels.filter((c) => c !== channelId);
    setEnabledChannels(updated);

    try {
      await fetch(`${getAgentApiUrl()}/settings`, {
        method: 'PUT',
        headers: agentHeaders(),
        body: JSON.stringify({ enabled_channels: updated }),
      });
    } catch {
      setEnabledChannels(prev);
    }
  };

  return (
    <div className="space-y-[var(--space-4)] max-w-2xl">
      {CHANNELS.map((ch) => {
        const isEnabled = enabledChannels.includes(ch.id);
        const Icon = ch.icon;
        return (
          <div
            key={ch.id}
            className={`relative p-[var(--space-4)] rounded-[var(--radius-lg)] border transition-all duration-200 ${
              ch.available
                ? isEnabled
                  ? 'bg-[var(--color-surface-1)] border-[var(--color-accent)]/30'
                  : 'bg-[var(--color-surface-1)] border-[var(--color-border)]'
                : 'bg-[var(--color-surface-1)]/50 border-[var(--color-border)]/50 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[var(--space-3)]">
                <div
                  className="w-10 h-10 rounded-[var(--radius-lg)] flex items-center justify-center"
                  style={{ backgroundColor: `color-mix(in oklch, ${ch.color}, transparent 85%)` }}
                >
                  <Icon className="h-5 w-5" style={{ color: ch.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {ch.name}
                    </span>
                    {!ch.available && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                        Em breve
                      </span>
                    )}
                    {ch.available && isEnabled && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]">
                        Ativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">{ch.description}</p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => toggleChannel(ch.id, checked)}
                disabled={!ch.available || loading}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Integrations Tab ────────────────────────────────────────────────────────

function IntegrationsTab() {
  const queryClient = useQueryClient();
  const [editingProvider, setEditingProvider] = useState<IntegrationProvider | null>(null);

  // Integration credentials (settings-based)
  const { data: integrations, isLoading: intLoading } = useQuery({
    queryKey: ['extensions', 'integrations'],
    queryFn: fetchIntegrations,
    staleTime: 30_000,
  });

  // Sync-based extensions
  const [extensions, setExtensions] = useState<ExtensionView[]>([]);
  const [extLoading, setExtLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({});
  const [showApiKeyFor, setShowApiKeyFor] = useState<string | null>(null);

  const loadExtensions = async () => {
    try {
      const data = await fetchExtensions();
      setExtensions(data);
    } catch {
      // silent
    } finally {
      setExtLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load on mount
  useEffect(() => {
    loadExtensions();
  }, []);

  const handleToggle = useCallback(
    async (provider: IntegrationProvider, enabled: boolean) => {
      queryClient.setQueryData<IntegrationSummary[]>(['extensions', 'integrations'], (prev) =>
        prev?.map((i) => (i.provider === provider ? { ...i, enabled } : i)),
      );
      const existing = integrations?.find((i) => i.provider === provider);
      if (existing?.configured) {
        await saveIntegration(provider, {}, enabled);
      }
    },
    [integrations, queryClient],
  );

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['extensions', 'integrations'] });
  }, [queryClient]);

  const handleExtConnect = (ext: ExtensionView) => {
    if (ext.authMethod === 'api_key') {
      setShowApiKeyFor(ext.id);
    } else {
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
      loadExtensions();
    } else {
      toast.error(result.error ?? 'Falha ao conectar');
    }
  };

  const handleExtDisconnect = async (extId: string) => {
    await disconnectExtension(extId);
    toast.success('Desconectado');
    loadExtensions();
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
      loadExtensions();
    } catch {
      toast.error('Falha no sync');
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleSync = async (extId: string, enabled: boolean) => {
    await toggleSync(extId, enabled);
    loadExtensions();
  };

  const editingDefinition = editingProvider
    ? INTEGRATION_REGISTRY.find((d) => d.provider === editingProvider)
    : null;

  const isLoading = intLoading || extLoading;

  return (
    <div className="space-y-[var(--space-6)] max-w-2xl">
      {isLoading ? (
        <ListSkeleton items={4} />
      ) : (
        <>
          {/* Credential-based integrations */}
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-3)]">
              Credenciais
            </h3>
            <div className="space-y-[var(--space-2)]">
              {INTEGRATION_REGISTRY.map((definition) => {
                const summary = integrations?.find((i) => i.provider === definition.provider);
                return (
                  <IntegrationCard
                    key={definition.provider}
                    definition={definition}
                    summary={summary}
                    onConfigure={() => setEditingProvider(definition.provider)}
                    onToggle={(enabled) => handleToggle(definition.provider, enabled)}
                  />
                );
              })}
            </div>
          </div>

          {/* Sync-based extensions */}
          {extensions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-3)]">
                Conectores de dados
              </h3>
              <div className="grid gap-[var(--space-4)] md:grid-cols-2">
                {extensions.map((ext) => (
                  <Card key={ext.id} className="relative overflow-hidden">
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
                            {getExtIcon(ext.icon)}
                          </div>
                          <div>
                            <CardTitle className="text-base">{ext.name}</CardTitle>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {ext.description}
                            </p>
                          </div>
                        </div>
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
                      {ext.lastError && (
                        <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)]">
                          {ext.lastError}
                        </p>
                      )}

                      {ext.connected && (
                        <>
                          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                            <span>Ultimo sync: {formatDate(ext.lastSyncAt)}</span>
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
                              onClick={() => handleExtDisconnect(ext.id)}
                            >
                              <Unplug className="h-3.5 w-3.5 mr-1" /> Desconectar
                            </Button>
                          </div>
                        </>
                      )}

                      {!ext.connected && (
                        <>
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowApiKeyFor(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          )}
                          {showApiKeyFor !== ext.id && (
                            <div className="flex gap-[var(--space-2)]">
                              <Button size="sm" onClick={() => handleExtConnect(ext)}>
                                {ext.authMethod === 'api_key' ? (
                                  <Key className="h-3.5 w-3.5 mr-1" />
                                ) : (
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                )}
                                Conectar
                              </Button>
                              {ext.authMethod === 'oauth2' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setShowApiKeyFor(ext.id)}
                                >
                                  <Key className="h-3.5 w-3.5 mr-1" /> API Key
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
            </div>
          )}
        </>
      )}

      {editingDefinition && (
        <IntegrationForm
          definition={editingDefinition}
          open={!!editingProvider}
          onClose={() => setEditingProvider(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// ── MCP Tab ─────────────────────────────────────────────────────────────────

function MCPTab() {
  return (
    <div className="max-w-2xl">
      <div className="p-[var(--space-5)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)] text-center">
        <Server className="h-8 w-8 text-[var(--color-text-muted)] mx-auto mb-[var(--space-3)]" />
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-2)]">
          Model Context Protocol
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto mb-[var(--space-4)]">
          Conecte servidores MCP para expandir as capacidades do agente com tools externas, acesso a
          dados e integracao com servicos.
        </p>
        <div className="space-y-[var(--space-2)]">
          {[
            { name: 'Filesystem', desc: 'Acesso seguro a ficheiros locais' },
            { name: 'Database', desc: 'Queries em bases de dados externas' },
            { name: 'Browser', desc: 'Navegacao web e scraping' },
            { name: 'Custom Server', desc: 'Servidor MCP customizado via stdio/SSE' },
          ].map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-left"
            >
              <div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">{s.name}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{s.desc}</div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                Em breve
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── API Tab ─────────────────────────────────────────────────────────────────

function APITab() {
  return (
    <div className="space-y-[var(--space-4)] max-w-2xl">
      {/* Personal Access Tokens */}
      <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-[var(--space-3)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Key className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Personal Access Tokens
            </h3>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
            Em breve
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-[var(--space-3)]">
          Crie tokens para aceder a API do Hawk OS programaticamente.
        </p>
        <div className="p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-center">
          <p className="text-xs text-[var(--color-text-muted)]">Nenhum token criado ainda.</p>
        </div>
      </div>

      {/* REST API */}
      <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-[var(--space-3)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Code className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">REST API</h3>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
            Em breve
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-[var(--space-3)]">
          Acesse os dados do Hawk OS via API REST.
        </p>
        <div className="space-y-[var(--space-1-5)]">
          {[
            { method: 'GET', path: '/api/v1/memories', desc: 'Listar memorias' },
            { method: 'POST', path: '/api/v1/chat', desc: 'Enviar mensagem ao agente' },
            { method: 'GET', path: '/api/v1/modules/:id', desc: 'Dados de um modulo' },
          ].map((ep) => (
            <div
              key={ep.path}
              className="flex items-center gap-[var(--space-2)] p-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-xs font-mono"
            >
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  ep.method === 'GET'
                    ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                    : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                }`}
              >
                {ep.method}
              </span>
              <span className="text-[var(--color-text-secondary)] flex-1">{ep.path}</span>
              <ChevronRight className="h-3 w-3 text-[var(--color-text-muted)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Skills Tab ──────────────────────────────────────────────────────────────

function SkillsTab() {
  return (
    <div className="max-w-2xl">
      <div className="p-[var(--space-5)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)] text-center">
        <Sparkles className="h-8 w-8 text-[var(--color-text-muted)] mx-auto mb-[var(--space-3)]" />
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-2)]">
          Agent Skills
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto mb-[var(--space-4)]">
          Skills sao capacidades modulares do agente. Cada skill adiciona tools, contexto e
          comportamentos especificos.
        </p>
        <div className="space-y-[var(--space-2)]">
          {[
            { name: 'Web Search', desc: 'Buscar informacoes na web em tempo real' },
            { name: 'Code Execution', desc: 'Executar codigo Python/JS em sandbox' },
            { name: 'Image Analysis', desc: 'Analisar imagens via modelos multimodais' },
            { name: 'Voice Transcription', desc: 'Transcrever audio via Whisper' },
          ].map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-left"
            >
              <div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">{s.name}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{s.desc}</div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                Em breve
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Marketplace Tab ─────────────────────────────────────────────────────────

function MarketplaceTab() {
  return (
    <div className="max-w-2xl">
      <div className="p-[var(--space-5)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)] text-center">
        <ShoppingBag className="h-8 w-8 text-[var(--color-text-muted)] mx-auto mb-[var(--space-3)]" />
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-2)]">
          ClawHub Marketplace
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto mb-[var(--space-4)]">
          Descubra e instale extensoes criadas pela comunidade.
        </p>
        <div className="grid grid-cols-2 gap-[var(--space-2)]">
          {[
            { name: 'Plugins', count: '0' },
            { name: 'Temas', count: '0' },
            { name: 'Automacoes', count: '0' },
            { name: 'Conectores', count: '0' },
          ].map((cat) => (
            <div
              key={cat.name}
              className="p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)]"
            >
              <div className="text-lg font-semibold text-[var(--color-text-muted)]">
                {cat.count}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">{cat.name}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-[var(--space-4)]">
          Em desenvolvimento. Acompanhe em clawhub.dev
        </p>
      </div>
    </div>
  );
}
