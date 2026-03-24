'use client';

import { Card, CardContent } from '@/components/ui/card';
import { fetchSocialStats } from '@/lib/actions/social';
import { useQuery } from '@tanstack/react-query';
import { Clock, Flame, Send } from 'lucide-react';

export function SocialStats() {
  const { data: stats } = useQuery({
    queryKey: ['social', 'stats'],
    queryFn: fetchSocialStats,
  });

  if (!stats) return null;

  return (
    <div className="flex gap-[var(--space-3)] overflow-x-auto pb-2">
      <StatCard
        icon={<Send className="h-4 w-4" />}
        label="Publicados"
        value={String(stats.totalPublished)}
        sublabel="total"
      />
      <StatCard
        icon={<Clock className="h-4 w-4" />}
        label="Pendentes"
        value={String(stats.totalPending)}
        sublabel="rascunhos"
      />
      <StatCard
        icon={<Flame className="h-4 w-4" />}
        label="Streak"
        value={`${stats.currentStreak}d`}
        sublabel="dias seguidos"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <Card className="min-w-[140px] flex-shrink-0">
      <CardContent className="pt-[var(--space-4)]">
        <div className="flex items-center gap-2 text-[var(--color-accent)] mb-1">
          {icon}
          <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
        </div>
        <p className="text-xl font-semibold text-[var(--color-text-primary)]">{value}</p>
        <span className="text-[10px] text-[var(--color-text-muted)]">{sublabel}</span>
      </CardContent>
    </Card>
  );
}
