'use client';

import { ContextSidebar } from '@/components/social/context-sidebar';
import { FiltersBar } from '@/components/social/filters-bar';
import { GoalsList } from '@/components/social/goals-list';
import { KanbanBoard } from '@/components/social/kanban-board';
import { PostForm } from '@/components/social/post-form';
import { PostsList } from '@/components/social/posts-list';
import { SocialHeader, type SocialTab } from '@/components/social/social-header';
import { SocialStats } from '@/components/social/social-stats';
import type { PostStatus, SocialPlatform } from '@hawk/module-social/types';
import { useState } from 'react';

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState<SocialTab>('kanban');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | undefined>();
  const [statusFilter, setStatusFilter] = useState<PostStatus | undefined>();

  return (
    <div className="space-y-[var(--space-6)]">
      <SocialHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Posts View */}
      {activeTab === 'posts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--space-6)]">
          <div className="lg:col-span-2 space-y-[var(--space-6)]">
            <SocialStats />
            <FiltersBar
              platform={platformFilter}
              status={statusFilter}
              onPlatformChange={setPlatformFilter}
              onStatusChange={setStatusFilter}
            />
            <PostsList platformFilter={platformFilter} statusFilter={statusFilter} />
          </div>
          <div className="space-y-[var(--space-6)]">
            <ContextSidebar />
          </div>
        </div>
      )}

      {/* Kanban View */}
      {activeTab === 'kanban' && (
        <div className="space-y-[var(--space-6)]">
          <SocialStats />
          <FiltersBar
            platform={platformFilter}
            status={statusFilter}
            onPlatformChange={setPlatformFilter}
            onStatusChange={setStatusFilter}
          />
          <KanbanBoard />
        </div>
      )}

      {/* Create View */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--space-6)]">
          <div className="lg:col-span-2 space-y-[var(--space-6)]">
            <SocialStats />
            <FiltersBar
              platform={platformFilter}
              status={statusFilter}
              onPlatformChange={setPlatformFilter}
              onStatusChange={setStatusFilter}
            />
            <PostsList platformFilter={platformFilter} statusFilter={statusFilter} />
          </div>
          <div className="space-y-[var(--space-6)]">
            <PostForm />
            <ContextSidebar />
          </div>
        </div>
      )}

      {/* Goals View */}
      {activeTab === 'goals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--space-6)]">
          <div className="lg:col-span-2 space-y-[var(--space-6)]">
            <SocialStats />
            <GoalsList />
          </div>
          <div className="space-y-[var(--space-6)]">
            <ContextSidebar />
          </div>
        </div>
      )}
    </div>
  );
}
