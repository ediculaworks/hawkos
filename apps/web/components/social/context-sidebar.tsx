'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchCurrentContext } from '@/lib/actions/social';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Film, Heart, Target, Users, Zap } from 'lucide-react';

export function ContextSidebar() {
  const { data: context, isLoading } = useQuery({
    queryKey: ['social', 'context'],
    queryFn: fetchCurrentContext,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contexto do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!context) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contexto do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-muted)]">Sem dados disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Contexto do Dia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Humor e Energia */}
        {(context.mood || context.energy) && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Bem-estar
            </p>
            <div className="flex gap-3">
              {context.mood && (
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-400" />
                  <span className="text-sm">Humor: {context.mood}/10</span>
                </div>
              )}
              {context.energy && (
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm">Energia: {context.energy}/10</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mídia em andamento */}
        {context.activeMedia && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Consumindo
            </p>
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-purple-400" />
              <Badge variant="muted">{context.activeMedia.title}</Badge>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Status:{' '}
              {context.activeMedia.status === 'watching'
                ? 'Assistindo'
                : context.activeMedia.status === 'reading'
                  ? 'Lendo'
                  : 'Jogando'}
            </p>
          </div>
        )}

        {/* Objetivos ativos */}
        {context.activeObjectives.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Objetivos
            </p>
            <div className="space-y-2">
              {context.activeObjectives.slice(0, 3).map((obj) => (
                <div key={obj.id} className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-400" />
                  <span className="text-sm truncate flex-1">{obj.title}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{obj.progress}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Próximos eventos */}
        {context.upcomingEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Próximos Eventos
            </p>
            <div className="space-y-1">
              {context.upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-400" />
                  <span className="text-sm truncate">{event.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interações recentes */}
        {context.recentInteractions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Contatos
            </p>
            <div className="space-y-1">
              {context.recentInteractions.slice(0, 3).map((interaction) => (
                <div key={interaction.id} className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-400" />
                  <span className="text-sm truncate">{interaction.personName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!context.mood &&
          !context.energy &&
          !context.activeMedia &&
          context.activeObjectives.length === 0 &&
          context.upcomingEvents.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Preencha seu diário para ver contexto aqui
            </p>
          )}
      </CardContent>
    </Card>
  );
}
