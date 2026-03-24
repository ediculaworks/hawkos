import type React from 'react';

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton-shimmer rounded-[var(--radius-md)] ${className ?? ''}`}
      style={style}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  const arr = Array.from({ length: items }, (_, i) => i);
  return (
    <div className="space-y-2">
      {arr.map((i) => (
        <div
          key={`ls-${i}`}
          className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)]"
        >
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-9 w-28 rounded-[var(--radius-md)]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  const arr = Array.from({ length: rows }, (_, i) => i);
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <div className="flex-1" />
        <Skeleton className="h-3 w-16" />
      </div>
      {arr.map((i) => (
        <div
          key={`ts-${i}`}
          className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border-subtle)] last:border-b-0"
        >
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
          <div className="flex-1" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 192 }: { height?: number }) {
  const barHeights = [45, 60, 35, 70, 55, 80, 40, 65, 50, 75, 42, 58, 38, 68];
  return (
    <div className="space-y-3" style={{ height }}>
      <div className="flex items-end gap-2 h-full">
        {barHeights.map((h) => (
          <Skeleton key={`sk-bar-${h}`} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-2 w-8" />
        <Skeleton className="h-2 w-8" />
        <Skeleton className="h-2 w-8" />
      </div>
    </div>
  );
}
