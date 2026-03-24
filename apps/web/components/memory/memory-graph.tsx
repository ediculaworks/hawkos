'use client';

import { fetchMemoryGraph } from '@/lib/actions/memory';
import type { MemoryGraphNode, MemoryType } from '@hawk/module-memory/types';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const MEMORY_TYPE_OKLCH: Record<string, string> = {
  profile: 'oklch(0.70 0.15 250)',
  preference: 'oklch(0.65 0.18 300)',
  entity: 'oklch(0.68 0.18 340)',
  event: 'oklch(0.70 0.15 155)',
  case: 'oklch(0.68 0.18 25)',
  pattern: 'oklch(0.78 0.15 80)',
  procedure: 'oklch(0.70 0.14 195)',
};

const MEMORY_TYPE_LABELS: Record<string, string> = {
  profile: 'Perfil',
  preference: 'Preferência',
  entity: 'Entidade',
  event: 'Evento',
  case: 'Caso',
  pattern: 'Padrão',
  procedure: 'Procedimento',
};

type Props = {
  onSelectNode: (memory: MemoryGraphNode) => void;
};

export function MemoryGraph({ onSelectNode }: Props) {
  const [typeFilter, setTypeFilter] = useState<MemoryType | ''>('');
  const [minImportance, setMinImportance] = useState(0);

  const { data: graph } = useQuery({
    queryKey: ['memory', 'graph'],
    queryFn: () => fetchMemoryGraph(),
  });

  const filteredNodes = (graph?.nodes ?? []).filter((n) => {
    if (typeFilter && n.memory_type !== typeFilter) return false;
    if (minImportance > 0 && n.importance < minImportance) return false;
    return true;
  });

  const nodeIdSet = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = (graph?.edges ?? []).filter(
    (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target),
  );

  const graphData = {
    nodes: filteredNodes.map((n) => ({
      ...n,
      val: n.importance * 2,
    })),
    links: filteredEdges.map((e) => ({
      source: e.source,
      target: e.target,
      shared_module: e.shared_module,
    })),
  };

  const paintNode = useCallback((node: Record<string, unknown>, ctx: CanvasRenderingContext2D) => {
    const x = node.x as number;
    const y = node.y as number;
    const importance = (node.importance as number) ?? 5;
    const memoryType = (node.memory_type as string) ?? 'profile';
    const r = 3 + importance * 1.2;

    // Outer glow
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, 2 * Math.PI);
    const color = MEMORY_TYPE_OKLCH[memoryType] ?? 'oklch(0.45 0.01 260)';
    ctx.fillStyle = color.replace(')', ' / 0.15)');
    ctx.fill();

    // Node
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Border for pending status
    if ((node.status as string) === 'pending') {
      ctx.strokeStyle = 'oklch(0.78 0.15 80)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, []);

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-muted)]">
        Sem memórias para visualizar
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {/* Filter overlay */}
      <div className="absolute top-[var(--space-3)] left-[var(--space-3)] z-10 flex flex-col gap-[var(--space-2)] bg-[var(--color-surface-0)]/90 backdrop-blur-sm rounded-[var(--radius-md)] p-[var(--space-3)] border border-[var(--color-border-subtle)]">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as MemoryType | '')}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-[var(--space-2)] py-[var(--space-1)] text-[11px] text-[var(--color-text-primary)]"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(MEMORY_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-[var(--space-1)]">
          <span className="text-[10px] text-[var(--color-text-muted)]">Min:</span>
          <input
            type="range"
            min={0}
            max={10}
            value={minImportance}
            onChange={(e) => setMinImportance(Number(e.target.value))}
            className="w-20 h-1 accent-[var(--color-accent)]"
          />
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
            {minImportance}
          </span>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {filteredNodes.length} nós
        </span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-[var(--space-3)] left-[var(--space-3)] z-10 flex flex-wrap gap-[var(--space-2)] bg-[var(--color-surface-0)]/90 backdrop-blur-sm rounded-[var(--radius-md)] p-[var(--space-2)] border border-[var(--color-border-subtle)]">
        {Object.entries(MEMORY_TYPE_LABELS).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: MEMORY_TYPE_OKLCH[type] }}
            />
            <span className="text-[9px] text-[var(--color-text-muted)]">{label}</span>
          </div>
        ))}
      </div>

      <ForceGraph2D
        graphData={graphData}
        nodeCanvasObject={paintNode}
        linkColor={() => 'oklch(0.25 0.015 260)'}
        linkWidth={0.5}
        nodeLabel={(node: Record<string, unknown>) => {
          const content = (node.content as string) ?? '';
          const mt = MEMORY_TYPE_LABELS[(node.memory_type as string) ?? ''] ?? '';
          const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content;
          return `[${mt}] ${preview}`;
        }}
        onNodeClick={(node: Record<string, unknown>) => {
          onSelectNode(node as unknown as MemoryGraphNode);
        }}
        backgroundColor="oklch(0.13 0.01 260)"
        warmupTicks={50}
        cooldownTicks={100}
      />
    </div>
  );
}
