'use client';

import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { fetchGoals } from '@/lib/actions/social';
import type { SocialGoal } from '@hawk/module-social/types';
import { Target } from 'lucide-react';
import { useEffect, useState } from 'react';

export function GoalsList() {
  const [goals, setGoals] = useState<SocialGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoals()
      .then(setGoals)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <ListSkeleton items={3} />;
  }

  if (goals.length === 0) {
    return (
      <div className="bg-[var(--surface-2)] rounded-lg p-4">
        <EmptyState
          icon={Target}
          title="Nenhuma meta cadastrada"
          description="Crie suas metas de presença nas redes sociais"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {goals.map((goal) => {
        const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
        return (
          <div key={goal.id} className="bg-[var(--surface-2)] rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium capitalize">{goal.platform}</span>
              <span className="text-sm text-[var(--text-muted)]">{goal.period}</span>
            </div>
            <p className="text-sm mb-2">{goal.metric}</p>
            <div className="w-full bg-[var(--surface-3)] rounded-full h-2 mb-2">
              <div
                className="bg-[var(--accent)] h-2 rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {goal.current} / {goal.target}
            </p>
          </div>
        );
      })}
    </div>
  );
}
