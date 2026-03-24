'use client';

import { fetchPostStats, fetchPostsWithContext } from '@/lib/actions/social';
import type { PostStatus, SocialPlatform, SocialPostWithContext } from '@hawk/module-social/types';
import { useEffect, useState } from 'react';

interface PostsListProps {
  platformFilter?: SocialPlatform;
  statusFilter?: PostStatus;
}

export function PostsList({ platformFilter, statusFilter }: PostsListProps) {
  const [posts, setPosts] = useState<SocialPostWithContext[]>([]);
  const [stats, setStats] = useState<
    { platform: string; ideas: number; drafts: number; published: number }[]
  >([]);

  useEffect(() => {
    fetchPostsWithContext(platformFilter, statusFilter).then(setPosts);
    fetchPostStats().then(setStats);
  }, [platformFilter, statusFilter]);

  const statusColors: Record<string, string> = {
    idea: 'bg-yellow-500/20 text-yellow-400',
    draft: 'bg-blue-500/20 text-blue-400',
    scheduled: 'bg-purple-500/20 text-purple-400',
    published: 'bg-green-500/20 text-green-400',
  };

  const platformColors: Record<string, string> = {
    instagram: 'bg-pink-500/20 text-pink-400',
    linkedin: 'bg-blue-500/20 text-blue-400',
    twitter: 'bg-sky-500/20 text-sky-400',
    youtube: 'bg-red-500/20 text-red-400',
    tiktok: 'bg-black/50 text-white',
    outros: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="space-y-4">
      {stats.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.platform} className="bg-[var(--surface-2)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)] capitalize mb-1">{s.platform}</p>
              <p className="text-xl font-bold">{s.published}</p>
              <p className="text-xs text-[var(--text-muted)]">publicados</p>
            </div>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="bg-[var(--surface-2)] rounded-lg p-4">
          <p className="text-[var(--text-muted)]">Nenhum post encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="bg-[var(--surface-2)] rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${platformColors[post.platform] ?? ''}`}
                >
                  {post.platform}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${statusColors[post.status] ?? ''}`}>
                  {post.status}
                </span>
              </div>
              {post.content && <p className="text-sm line-clamp-2">{post.content}</p>}

              {/* Context badges */}
              <div className="flex flex-wrap gap-1 mt-2">
                {post.objective_title && (
                  <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                    🎯 {post.objective_title}
                  </span>
                )}
                {post.person_name && (
                  <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                    👤 {post.person_name}
                  </span>
                )}
                {post.project_name && (
                  <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                    📁 {post.project_name}
                  </span>
                )}
              </div>

              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent)] hover:underline mt-2 block"
                >
                  Ver post
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
