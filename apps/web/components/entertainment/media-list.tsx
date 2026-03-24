'use client';

import { AnimatedItem, AnimatedList } from '@/components/motion/animated-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecordActions } from '@/components/ui/record-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMedia, removeMedia } from '@/lib/actions/entertainment';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Film, Gamepad2, Music } from 'lucide-react';
import toast from 'react-hot-toast';

const typeIcons: Record<string, typeof Film> = {
  movie: Film,
  series: Film,
  game: Gamepad2,
  music_album: Music,
  book_fiction: BookOpen,
};

const typeLabels: Record<string, string> = {
  movie: 'Filme',
  series: 'Série',
  game: 'Jogo',
  music_album: 'Música',
  book_fiction: 'Livro',
  outros: 'Outro',
};

export function MediaList() {
  const queryClient = useQueryClient();

  const { data: media, isLoading } = useQuery({
    queryKey: ['entertainment', 'media'],
    queryFn: fetchMedia,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entertainment'] });
      toast.success('Mídia excluída');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Mídia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!media || media.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Mídia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <Film className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum item cadastrado</p>
            <p className="text-xs mt-1">Use o agente para registrar filmes, séries e jogos</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Mídia ({media.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatedList>
          {media.slice(0, 10).map((item) => {
            const Icon = typeIcons[item.type] ?? Film;
            return (
              <AnimatedItem key={item.id}>
                <div className="group flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface-1)]">
                  <Icon className="h-4 w-4 text-[var(--color-text-muted)]" />
                  <div className="flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {typeLabels[item.type] ?? item.type}
                    </p>
                  </div>
                  {item.rating && <span className="text-sm">{'★'.repeat(item.rating)}</span>}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <RecordActions onDelete={() => deleteMutation.mutate(item.id)} />
                  </div>
                </div>
              </AnimatedItem>
            );
          })}
        </AnimatedList>
      </CardContent>
    </Card>
  );
}
