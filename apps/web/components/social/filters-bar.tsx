'use client';
import type { PostStatus, SocialPlatform } from '@hawk/module-social/types';

interface FiltersBarProps {
  platform?: SocialPlatform;
  status?: PostStatus;
  onPlatformChange: (platform: SocialPlatform | undefined) => void;
  onStatusChange: (status: PostStatus | undefined) => void;
}

const PLATFORMS: { value: SocialPlatform | ''; label: string }[] = [
  { value: '', label: 'Todas plataformas' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'outros', label: 'Outros' },
];

const STATUSES: { value: PostStatus | ''; label: string }[] = [
  { value: '', label: 'Todos status' },
  { value: 'idea', label: 'Ideia' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'published', label: 'Publicado' },
];

export function FiltersBar({
  platform,
  status,
  onPlatformChange,
  onStatusChange,
}: FiltersBarProps) {
  return (
    <div className="flex items-center gap-3">
      <select
        value={platform ?? ''}
        onChange={(e) => onPlatformChange(e.target.value as SocialPlatform | undefined)}
        className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]"
      >
        {PLATFORMS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <select
        value={status ?? ''}
        onChange={(e) => onStatusChange(e.target.value as PostStatus | undefined)}
        className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {(platform || status) && (
        <button
          type="button"
          onClick={() => {
            onPlatformChange(undefined);
            onStatusChange(undefined);
          }}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
