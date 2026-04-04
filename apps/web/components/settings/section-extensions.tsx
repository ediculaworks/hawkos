'use client';

import {
  type IntegrationSummary,
  fetchIntegrations,
  saveIntegration,
} from '@/lib/actions/integrations';
import type { IntegrationProvider } from '@hawk/admin';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Code,
  Key,
  Loader2,
  Puzzle,
  Server,
  ShoppingBag,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { IntegrationCard } from './integrations/integration-card';
import { IntegrationForm } from './integrations/integration-form';
import { INTEGRATION_REGISTRY } from './integrations/registry';

type ExtensionTab = 'integrations' | 'mcp' | 'api' | 'marketplace';

const TABS: { id: ExtensionTab; label: string; icon: React.ElementType }[] = [
  { id: 'integrations', label: 'Integracoes', icon: Puzzle },
  { id: 'mcp', label: 'MCP Servers', icon: Server },
  { id: 'api', label: 'API & Tokens', icon: Key },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
];

export function SectionExtensions() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ExtensionTab>('integrations');
  const [editingProvider, setEditingProvider] = useState<IntegrationProvider | null>(null);

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['settings', 'integrations'],
    queryFn: fetchIntegrations,
    staleTime: 30_000,
  });

  const handleToggle = useCallback(
    async (provider: IntegrationProvider, enabled: boolean) => {
      queryClient.setQueryData<IntegrationSummary[]>(['settings', 'integrations'], (prev) =>
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
    queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
  }, [queryClient]);

  const editingDefinition = editingProvider
    ? INTEGRATION_REGISTRY.find((d) => d.provider === editingProvider)
    : null;

  return (
    <div className="space-y-[var(--space-6)]">
      <div>
        <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
          <Puzzle className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Extensoes</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Integracoes, servidores MCP, tokens de acesso e extensoes.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-[var(--space-1)] p-[var(--space-1)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)] max-w-lg overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-[var(--space-1-5)] px-[var(--space-3)] py-[var(--space-1-5)] rounded-[var(--radius-md)] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="max-w-lg">
        {activeTab === 'integrations' && (
          <div className="space-y-[var(--space-2)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : (
              INTEGRATION_REGISTRY.map((definition) => {
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
              })
            )}
          </div>
        )}

        {activeTab === 'mcp' && (
          <div className="space-y-[var(--space-4)]">
            <div className="p-[var(--space-5)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)] text-center">
              <Server className="h-8 w-8 text-[var(--color-text-muted)] mx-auto mb-[var(--space-3)]" />
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-2)]">
                Model Context Protocol
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto mb-[var(--space-4)]">
                Conecte servidores MCP para expandir as capacidades do agente com tools externas,
                acesso a dados e integracao com servicos.
              </p>
              <div className="space-y-[var(--space-2)]">
                {[
                  {
                    name: 'Filesystem',
                    desc: 'Acesso seguro a ficheiros locais',
                    status: 'planned',
                  },
                  {
                    name: 'Database',
                    desc: 'Queries em bases de dados externas',
                    status: 'planned',
                  },
                  {
                    name: 'Browser',
                    desc: 'Navegacao web e scraping',
                    status: 'planned',
                  },
                  {
                    name: 'Custom Server',
                    desc: 'Servidor MCP customizado via stdio/SSE',
                    status: 'planned',
                  },
                ].map((server) => (
                  <div
                    key={server.name}
                    className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-left"
                  >
                    <div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">
                        {server.name}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">{server.desc}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                      Em breve
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-[var(--space-4)]">
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
                Crie tokens para aceder a API do Hawk OS programaticamente. Util para scripts,
                automacoes externas e integracao com outras ferramentas.
              </p>
              <div className="p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-center">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Nenhum token criado ainda.
                </p>
              </div>
            </div>

            {/* API Access */}
            <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-[var(--space-3)]">
                <div className="flex items-center gap-[var(--space-2)]">
                  <Code className="h-4 w-4 text-[var(--color-accent)]" />
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                    REST API
                  </h3>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                  Em breve
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mb-[var(--space-3)]">
                Acesse os dados do Hawk OS via API REST. Documentacao completa com exemplos
                para cada endpoint.
              </p>
              <div className="space-y-[var(--space-1-5)]">
                {[
                  { method: 'GET', path: '/api/v1/memories', desc: 'Listar memorias' },
                  { method: 'POST', path: '/api/v1/chat', desc: 'Enviar mensagem ao agente' },
                  { method: 'GET', path: '/api/v1/modules/:id', desc: 'Dados de um modulo' },
                ].map((endpoint) => (
                  <div
                    key={endpoint.path}
                    className="flex items-center gap-[var(--space-2)] p-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-2)] text-xs font-mono"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        endpoint.method === 'GET'
                          ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                          : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <span className="text-[var(--color-text-secondary)] flex-1">
                      {endpoint.path}
                    </span>
                    <ChevronRight className="h-3 w-3 text-[var(--color-text-muted)]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'marketplace' && (
          <div className="p-[var(--space-5)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)] text-center">
            <ShoppingBag className="h-8 w-8 text-[var(--color-text-muted)] mx-auto mb-[var(--space-3)]" />
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-2)]">
              ClawHub Marketplace
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto mb-[var(--space-4)]">
              Descubra e instale extensoes criadas pela comunidade. Plugins, temas, automacoes
              e integradores customizados.
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
        )}
      </div>

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
