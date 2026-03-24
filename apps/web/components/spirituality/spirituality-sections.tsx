'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchAllValuesWithObjectives,
  fetchCombinedMood,
  fetchSpiritualityStats,
  fetchUnifiedTimeline,
} from '@/lib/actions/spirituality';
import { useQuery } from '@tanstack/react-query';
import { Flame, Heart, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const TYPE_LABELS: Record<string, string> = {
  reflection: 'Reflexão',
  gratitude: 'Gratidão',
  intention: 'Intenção',
  values: 'Valores',
  mantra: 'Mantra',
  daily: 'Diário',
  freeform: 'Livre',
  weekly_review: 'Review',
};

const SOURCE_COLORS: Record<string, string> = {
  journal: 'bg-blue-500/20 text-blue-400',
  spirituality: 'bg-purple-500/20 text-purple-400',
};

export function SpiritualityStats() {
  const { data: stats } = useQuery({
    queryKey: ['spirituality', 'stats'],
    queryFn: () => fetchSpiritualityStats(30),
  });

  if (!stats) return null;

  return (
    <div className="flex gap-[var(--space-3)] overflow-x-auto pb-2">
      <StatCard
        icon={<Flame className="h-4 w-4" />}
        label="Streak"
        value={`${stats.streak}d`}
        sublabel="dias seguidos"
      />
      <StatCard
        icon={<Heart className="h-4 w-4" />}
        label="Humor"
        value={stats.combinedMood ? `${stats.combinedMood}/10` : '—'}
        sublabel="média 30d"
      />
      <StatCard
        icon={<Sparkles className="h-4 w-4" />}
        label="Reflexões"
        value={String(stats.totalReflections)}
        sublabel="este mês"
      />
      <StatCard
        icon={<Target className="h-4 w-4" />}
        label="Diário"
        value={String(stats.totalJournal)}
        sublabel="entradas"
      />
      <StatCard
        icon={<TrendingUp className="h-4 w-4" />}
        label="Tipos"
        value={String(Object.keys(stats.byType).length)}
        sublabel="categorias"
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

export function MoodChart() {
  const { data: timeline } = useQuery({
    queryKey: ['spirituality', 'unified-timeline', 30],
    queryFn: () => fetchUnifiedTimeline(30),
  });

  if (!timeline) return null;

  const data = timeline
    .filter((e) => e.mood !== null)
    .reduce(
      (acc, entry) => {
        const existing = acc.find((d) => d.date === entry.date);
        if (existing) {
          if (entry.mood !== null) existing.mood = Math.max(existing.mood ?? 0, entry.mood);
        } else {
          acc.push({
            date: new Date(entry.date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            }),
            mood: entry.mood,
          });
        }
        return acc;
      },
      [] as { date: string; mood: number | null }[],
    )
    .reverse();

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Humor ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
            Sem dados de humor registrados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Humor ao Longo do Tempo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="spiritMoodG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.72 0.15 280)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.72 0.15 280)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'oklch(0.45 0.01 260)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[1, 10]}
                tick={{ fontSize: 10, fill: 'oklch(0.45 0.01 260)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'oklch(0.16 0.012 260)',
                  border: '1px solid oklch(0.25 0.015 260)',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: 'oklch(0.93 0.01 260)',
                }}
              />
              <Area
                type="monotone"
                dataKey="mood"
                stroke="oklch(0.72 0.15 280)"
                fill="url(#spiritMoodG)"
                strokeWidth={2}
                name="Humor"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function UnifiedTimeline() {
  const { data: timeline, isLoading } = useQuery({
    queryKey: ['spirituality', 'unified-timeline', 30],
    queryFn: () => fetchUnifiedTimeline(30),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-[var(--space-5)]">
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <Card>
        <CardContent className="pt-[var(--space-5)]">
          <p className="text-sm text-[var(--color-text-muted)]">
            Nenhuma entrada no diário ou reflexão registrada
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-[var(--space-3)]">
      {timeline.map((entry) => (
        <Card key={`${entry.source}-${entry.id}`}>
          <CardContent className="pt-[var(--space-4)]">
            <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-2)]">
              <span className="text-xs text-[var(--color-text-muted)]">
                {new Date(entry.date).toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <Badge variant="muted">{TYPE_LABELS[entry.type] ?? entry.type}</Badge>
              <span
                className={`text-[10px] px-2 py-0.5 rounded ${SOURCE_COLORS[entry.source] ?? ''}`}
              >
                {entry.source === 'journal' ? 'Diário' : 'Espiritualidade'}
              </span>
              {entry.mood !== null && (
                <span className="text-[11px] text-[var(--color-accent)]">
                  humor {entry.mood}/10
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-primary)] line-clamp-3">{entry.content}</p>
            {entry.tags.length > 0 && (
              <div className="flex gap-1 mt-[var(--space-2)]">
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant="muted">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ValuesWithObjectives() {
  const { data: valuesWithObjectives, isLoading } = useQuery({
    queryKey: ['spirituality', 'values-with-objectives'],
    queryFn: () => fetchAllValuesWithObjectives(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-[var(--space-5)]">
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!valuesWithObjectives || valuesWithObjectives.length === 0) {
    return (
      <Card>
        <CardContent className="pt-[var(--space-5)]">
          <p className="text-sm text-[var(--color-text-muted)]">Nenhum valor pessoal cadastrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-[var(--space-4)]">
      {valuesWithObjectives.map((value) => (
        <Card key={value.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">{value.name}</CardTitle>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)] rounded-full"
                    style={{ width: `${(value.priority / 10) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">#{value.priority}</span>
              </div>
            </div>
            {value.description && (
              <p className="text-xs text-[var(--color-text-muted)]">{value.description}</p>
            )}
          </CardHeader>
          {value.objectives.length > 0 && (
            <CardContent className="pt-0 px-5 pb-5">
              <p className="text-[11px] text-[var(--color-text-muted)] mb-2">
                Objetivos conectados:
              </p>
              <div className="space-y-2">
                {value.objectives.map((obj) => (
                  <div
                    key={obj.id}
                    className="flex items-center justify-between text-sm bg-[var(--color-surface-2)] rounded px-3 py-2"
                  >
                    <span className="truncate flex-1">{obj.title}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {obj.open_tasks}/{obj.tasks_count} tarefas
                      </span>
                      <div className="w-8 h-1 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${obj.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

export function TodayCard() {
  const { data: combinedMood } = useQuery({
    queryKey: ['spirituality', 'combined-mood', 7],
    queryFn: () => fetchCombinedMood(7),
  });

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Hoje</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--color-text-muted)] capitalize mb-4">{today}</p>
        {combinedMood !== null && combinedMood !== undefined && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-[var(--color-text-muted)]">Humor semanal</span>
                <span className="text-xs font-medium">{combinedMood}/10</span>
              </div>
              <div className="w-full h-2 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-accent)] rounded-full transition-all"
                  style={{ width: `${(combinedMood / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
        {combinedMood === null && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Nenhum registro de humor essa semana
          </p>
        )}
      </CardContent>
    </Card>
  );
}
