'use client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPostsByStatus, updatePostStatusAction } from '@/lib/actions/social';
import type { PostStatus, SocialPostWithContext } from '@hawk/module-social/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

type ColumnId = 'idea' | 'draft' | 'scheduled' | 'published';

const COLUMNS: { id: ColumnId; label: string; color: string }[] = [
  { id: 'idea', label: 'Ideia', color: 'border-yellow-500' },
  { id: 'draft', label: 'Rascunho', color: 'border-blue-500' },
  { id: 'scheduled', label: 'Agendado', color: 'border-purple-500' },
  { id: 'published', label: 'Publicado', color: 'border-green-500' },
];

export function KanbanBoard() {
  const queryClient = useQueryClient();
  const [draggedPost, setDraggedPost] = useState<string | null>(null);

  const { data: postsByStatus, isLoading } = useQuery({
    queryKey: ['social', 'posts-by-status'],
    queryFn: fetchPostsByStatus,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PostStatus }) =>
      updatePostStatusAction({ id, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
  });

  const handleDragStart = (postId: string) => {
    setDraggedPost(postId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: ColumnId) => {
    if (draggedPost) {
      moveMutation.mutate({ id: draggedPost, status });
      setDraggedPost(null);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {(['📋', '📝', '✅', '📌'] as const).map((emoji) => (
          <div
            key={emoji}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-4 space-y-3"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {COLUMNS.map((column) => {
        const posts = postsByStatus?.[column.id] ?? [];
        return (
          <div
            key={column.id}
            className="flex flex-col"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.id)}
          >
            <div className={`border-t-2 ${column.color} pt-2 mb-3`}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{column.label}</h3>
                <Badge variant="muted">{posts.length}</Badge>
              </div>
            </div>

            <div className="flex-1 space-y-2 min-h-[200px]">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onDragStart={() => handleDragStart(post.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PostCard({
  post,
  onDragStart,
}: {
  post: SocialPostWithContext;
  onDragStart: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: PostStatus }) =>
      updatePostStatusAction({ id: post.id, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
  });

  const platformColors: Record<string, string> = {
    instagram: 'bg-pink-500/20 text-pink-400',
    linkedin: 'bg-blue-500/20 text-blue-400',
    twitter: 'bg-sky-500/20 text-sky-400',
    youtube: 'bg-red-500/20 text-red-400',
    tiktok: 'bg-black/50 text-white',
    outros: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', post.id);
        onDragStart();
      }}
      className="bg-[var(--color-surface-2)] rounded-lg p-3 cursor-grab active:cursor-grabbing border border-transparent hover:border-[var(--color-border-subtle)] transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <span className={`text-xs px-2 py-0.5 rounded ${platformColors[post.platform] ?? ''}`}>
          {post.platform}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-[var(--color-surface-3)] rounded"
          >
            <MoreHorizontal className="h-4 w-4 text-[var(--color-text-muted)]" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 bg-[var(--color-surface-3)] rounded-lg shadow-lg border border-[var(--color-border-subtle)] py-1 z-10 min-w-[140px]">
              {COLUMNS.filter((c) => c.id !== post.status).map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => {
                    statusMutation.mutate({ status: col.id });
                    setShowMenu(false);
                  }}
                  disabled={statusMutation.isPending}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-surface-2)] flex items-center gap-2"
                >
                  <ArrowRight className="h-3 w-3" />
                  Mover para {col.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {post.content && <p className="text-sm line-clamp-3 mb-2">{post.content}</p>}

      {/* Context badges */}
      <div className="flex flex-wrap gap-1 mb-2">
        {post.objective_title && (
          <Badge variant="muted" className="text-[10px]">
            🎯{' '}
            {post.objective_title.length > 15
              ? `${post.objective_title.slice(0, 15)}...`
              : post.objective_title}
          </Badge>
        )}
        {post.person_name && (
          <Badge variant="muted" className="text-[10px]">
            👤{' '}
            {post.person_name.length > 10
              ? `${post.person_name.slice(0, 10)}...`
              : post.person_name}
          </Badge>
        )}
        {post.project_name && (
          <Badge variant="muted" className="text-[10px]">
            📁{' '}
            {post.project_name.length > 10
              ? `${post.project_name.slice(0, 10)}...`
              : post.project_name}
          </Badge>
        )}
      </div>

      {post.url && (
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          Ver post →
        </a>
      )}
    </div>
  );
}
