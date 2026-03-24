'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils/cn';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

export interface SectionConfig {
  id: string;
  title: string;
  component: ReactNode;
  collapsible?: boolean;
}

interface ModulePageLayoutProps {
  moduleId: string;
  sections: SectionConfig[];
}

export function ModulePageLayout({ moduleId, sections }: ModulePageLayoutProps) {
  const { getSectionOrder, setSectionOrder, isSectionCollapsed, toggleSectionCollapse } =
    useUIStore();

  const savedOrder = getSectionOrder(moduleId);
  const orderedIds =
    savedOrder.length > 0
      ? savedOrder.filter((id) => sections.some((s) => s.id === id))
      : sections.map((s) => s.id);

  // Add any new sections not in saved order
  for (const s of sections) {
    if (!orderedIds.includes(s.id)) orderedIds.push(s.id);
  }

  const orderedSections = orderedIds
    .map((id) => sections.find((s) => s.id === id))
    .filter(Boolean) as SectionConfig[];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = orderedIds.indexOf(String(active.id));
      const newIndex = orderedIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = [...orderedIds];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, String(active.id));
      setSectionOrder(moduleId, newOrder);
    },
    [orderedIds, moduleId, setSectionOrder],
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-[var(--space-4)]">
          {orderedSections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              moduleId={moduleId}
              isCollapsed={isSectionCollapsed(moduleId, section.id)}
              onToggleCollapse={() => toggleSectionCollapse(moduleId, section.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableSection({
  section,
  moduleId: _moduleId,
  isCollapsed,
  onToggleCollapse,
}: {
  section: SectionConfig;
  moduleId: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] transition-shadow',
        isDragging && 'shadow-lg opacity-90 z-10',
      )}
    >
      {/* Section header with drag handle */}
      <div className="flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] border-b border-[var(--color-border-subtle)]">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        {section.collapsible !== false ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-[var(--space-1-5)] flex-1 cursor-pointer text-left"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            )}
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
              {section.title}
            </span>
          </button>
        ) : (
          <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider flex-1">
            {section.title}
          </span>
        )}
      </div>

      {/* Section content */}
      {!isCollapsed && <div className="p-[var(--space-4)]">{section.component}</div>}
    </div>
  );
}
