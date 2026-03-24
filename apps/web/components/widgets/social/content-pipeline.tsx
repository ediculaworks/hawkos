'use client';

import { fetchPostsByStatus, fetchSocialStats } from '@/lib/actions/social';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb, PenLine, Send, Sparkles, Target } from 'lucide-react';

export default function SocialContentWidget() {
  const { data: postsByStatus } = useQuery({
    queryKey: ['social', 'posts-by-status'],
    queryFn: () => fetchPostsByStatus(),
  });

  const { data: stats } = useQuery({
    queryKey: ['social', 'stats'],
    queryFn: () => fetchSocialStats(),
  });

  const ideaCount = postsByStatus?.idea.length ?? 0;
  const draftCount = postsByStatus?.draft.length ?? 0;
  const scheduledCount = postsByStatus?.scheduled.length ?? 0;
  const publishedCount = postsByStatus?.published.length ?? 0;

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <StatCard
          label="Ideias"
          count={ideaCount}
          icon={Lightbulb}
          color="var(--color-text-muted)"
        />
        <StatCard
          label="Rascunhos"
          count={draftCount}
          icon={PenLine}
          color="var(--color-warning)"
        />
        <StatCard
          label="Agendados"
          count={scheduledCount}
          icon={Sparkles}
          color="var(--color-accent)"
        />
        <StatCard
          label="Publicados"
          count={publishedCount}
          icon={Send}
          color="var(--color-success)"
        />
      </div>

      {stats?.currentStreak && stats.currentStreak > 0 && (
        <div className="flex items-center justify-center gap-2 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-2)]">
          <Target className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm text-[var(--color-text-primary)]">
            <span className="font-bold">{stats.currentStreak}</span> dias de posting
          </span>
        </div>
      )}

      {postsByStatus && postsByStatus.idea.length > 0 && (
        <div className="space-y-[var(--space-1)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Ideias recentes
          </div>
          {postsByStatus.idea.slice(0, 3).map((post) => (
            <div
              key={post.id}
              className="flex items-center gap-2 text-sm rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
            >
              <div className="flex-1 min-w-0">
                <span className="truncate text-[var(--color-text-primary)]">
                  {post.content?.slice(0, 50) ?? 'Sem conteúdo'}
                  {post.content && post.content.length > 50 ? '...' : ''}
                </span>
                {post.objective_title && (
                  <span className="text-[10px] text-[var(--color-accent)] block">
                    → {post.objective_title}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 uppercase">
                {post.platform}
              </span>
            </div>
          ))}
        </div>
      )}

      {stats?.byPlatform && stats.byPlatform.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {stats.byPlatform.map((p) => (
            <span
              key={p.platform}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
            >
              {p.platform}: {p.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: typeof Lightbulb;
  color: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-[var(--space-2)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </span>
        <Icon className="h-3 w-3" style={{ color }} />
      </div>
      <span className="text-lg font-bold" style={{ color }}>
        {count}
      </span>
    </div>
  );
}
