import { CardSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-16 animate-pulse bg-[var(--color-surface-2)] rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
