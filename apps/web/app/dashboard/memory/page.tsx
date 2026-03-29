'use client';

import { MemoryDetailPanel } from '@/components/memory/memory-detail-panel';
import { MemoryGraph } from '@/components/memory/memory-graph';
import { Button } from '@/components/ui/button';
import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import { PageSkeleton } from '@/components/ui/skeleton';
import { createMemoryAction, fetchMemoryStats } from '@/lib/actions/memory';
import type { AgentMemory, MemoryGraphNode } from '@hawk/module-memory/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, BookMarked, Brain, FileText, MessageSquare, Network, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Suspense, useState } from 'react';

const MemoryExplorer = dynamic(
  () => import('@/components/memory/memory-explorer').then((m) => m.MemoryExplorer),
  { ssr: false },
);
const SessionArchives = dynamic(
  () => import('@/components/memory/session-archives').then((m) => m.SessionArchives),
  { ssr: false },
);
const NotesTab = dynamic(() => import('@/components/memory/notes-tab').then((m) => m.NotesTab), {
  ssr: false,
});
const LibraryTab = dynamic(
  () => import('@/components/memory/library-tab').then((m) => m.LibraryTab),
  { ssr: false },
);
const IntelligenceTab = dynamic(
  () => import('@/components/memory/intelligence-tab').then((m) => m.IntelligenceTab),
  { ssr: false },
);

type Tab = 'memories' | 'sessions' | 'notes' | 'library' | 'graph' | 'intelligence';

const MEMORY_TABS: TabItem<Tab>[] = [
  { id: 'memories', label: 'Memórias', icon: Brain },
  { id: 'sessions', label: 'Sessões', icon: MessageSquare },
  { id: 'notes', label: 'Notas', icon: FileText },
  { id: 'library', label: 'Biblioteca', icon: BookMarked },
  { id: 'graph', label: 'Grafo', icon: Network },
  { id: 'intelligence', label: 'Inteligência', icon: BarChart3 },
];

export default function MemoryPage() {
  const [tab, setTab] = useState<Tab>('memories');
  const [selectedMemory, setSelectedMemory] = useState<AgentMemory | null>(null);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['memory', 'stats'],
    queryFn: () => fetchMemoryStats(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createMemoryAction({
        category: 'fact',
        content: 'Nova memória',
        importance: 5,
        status: 'active',
      }),
    onSuccess: (newMemory) => {
      queryClient.invalidateQueries({ queryKey: ['memory'] });
      setSelectedMemory(newMemory);
      setTab('memories');
    },
  });

  const handleGraphSelect = (node: MemoryGraphNode) => {
    setSelectedMemory(node as unknown as AgentMemory);
  };

  const showDetailPanel = (tab === 'memories' || tab === 'graph') && selectedMemory;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <div className="flex flex-col h-[calc(100vh-var(--topbar-height)-var(--space-12))] -mb-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[var(--space-4)] flex-shrink-0">
        <div className="flex items-center gap-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Brain className="h-4 w-4 text-[var(--color-mod-knowledge)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Memória</span>
            {stats && (
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {stats.total} memórias
                {stats.pending_count > 0 && (
                  <span className="ml-1 text-[var(--color-warning)]">
                    · {stats.pending_count} pendentes
                  </span>
                )}
              </span>
            )}
          </div>
          <TabBar tabs={MEMORY_TABS} active={tab} onChange={setTab} size="sm" />
        </div>
        {tab === 'memories' && (
          <Button size="sm" onClick={() => createMutation.mutate()}>
            <Plus className="h-3.5 w-3.5" /> Ensinar
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex">
        {/* MEMORIES TAB */}
        {tab === 'memories' && (
          <>
            <div className="flex-1 min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] overflow-hidden">
              <MemoryExplorer
                selectedId={selectedMemory?.id ?? null}
                onSelect={setSelectedMemory}
              />
            </div>
            {showDetailPanel && (
              <MemoryDetailPanel memory={selectedMemory} onClose={() => setSelectedMemory(null)} />
            )}
          </>
        )}

        {/* SESSIONS TAB */}
        {tab === 'sessions' && (
          <div className="flex-1 min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] overflow-hidden">
            <SessionArchives />
          </div>
        )}

        {/* NOTES TAB */}
        {tab === 'notes' && <NotesTab />}

        {/* LIBRARY TAB */}
        {tab === 'library' && <LibraryTab />}

        {/* GRAPH TAB */}
        {tab === 'graph' && (
          <>
            <div className="flex-1 min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] overflow-hidden">
              <MemoryGraph onSelectNode={handleGraphSelect} />
            </div>
            {showDetailPanel && (
              <MemoryDetailPanel memory={selectedMemory} onClose={() => setSelectedMemory(null)} />
            )}
          </>
        )}

        {/* INTELLIGENCE TAB */}
        {tab === 'intelligence' && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <IntelligenceTab />
          </div>
        )}
      </div>
      </div>
    </Suspense>
  );
}
