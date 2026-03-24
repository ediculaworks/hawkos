'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  addPost,
  fetchObjectivesForLinking,
  fetchPeopleForLinking,
  fetchProjectsForLinking,
  fetchTasksForLinking,
} from '@/lib/actions/social';
import type { SocialPlatform } from '@hawk/module-social/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, CheckSquare, Link2, Send, Target, Users } from 'lucide-react';
import { useState } from 'react';

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'outros', label: 'Outros' },
];

export function PostForm() {
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<'idea' | 'draft' | 'scheduled' | 'published'>('idea');
  const [linkedObjective, setLinkedObjective] = useState('');
  const [linkedTask, setLinkedTask] = useState('');
  const [linkedProject, setLinkedProject] = useState('');
  const [linkedPerson, setLinkedPerson] = useState('');
  const [showLinks, setShowLinks] = useState(false);
  const queryClient = useQueryClient();

  const { data: objectives } = useQuery({
    queryKey: ['social', 'linkable-objectives'],
    queryFn: fetchObjectivesForLinking,
  });

  const { data: tasks } = useQuery({
    queryKey: ['social', 'linkable-tasks'],
    queryFn: fetchTasksForLinking,
  });

  const { data: projects } = useQuery({
    queryKey: ['social', 'linkable-projects'],
    queryFn: fetchProjectsForLinking,
  });

  const { data: people } = useQuery({
    queryKey: ['social', 'linkable-people'],
    queryFn: fetchPeopleForLinking,
  });

  const mutation = useMutation({
    mutationFn: () =>
      addPost({
        platform,
        content,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        status,
        objective_id: linkedObjective || undefined,
        task_id: linkedTask || undefined,
        project_id: linkedProject || undefined,
        person_id: linkedPerson || undefined,
      }),
    onSuccess: () => {
      setContent('');
      setTags('');
      setLinkedObjective('');
      setLinkedTask('');
      setLinkedProject('');
      setLinkedPerson('');
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Criar Post</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="O que você quer compartilhar?"
          rows={4}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLinks(!showLinks)}
            className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <Link2 className="h-3 w-3" />
            {showLinks ? 'Ocultar' : 'Vincular'} contexto
          </button>
        </div>

        {showLinks && (
          <div className="space-y-2 p-3 bg-[var(--color-surface-2)] rounded-lg">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-400" />
              <select
                value={linkedObjective}
                onChange={(e) => setLinkedObjective(e.target.value)}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-1 text-xs text-[var(--color-text-primary)]"
              >
                <option value="">Nenhum objetivo</option>
                {objectives?.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-blue-400" />
              <select
                value={linkedTask}
                onChange={(e) => setLinkedTask(e.target.value)}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-1 text-xs text-[var(--color-text-primary)]"
              >
                <option value="">Nenhuma tarefa</option>
                {tasks?.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-purple-400" />
              <select
                value={linkedProject}
                onChange={(e) => setLinkedProject(e.target.value)}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-1 text-xs text-[var(--color-text-primary)]"
              >
                <option value="">Nenhum projeto</option>
                {projects?.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-400" />
              <select
                value={linkedPerson}
                onChange={(e) => setLinkedPerson(e.target.value)}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-1 text-xs text-[var(--color-text-primary)]"
              >
                <option value="">Nenhuma pessoa</option>
                {people?.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]"
        >
          <option value="idea">Ideia</option>
          <option value="draft">Rascunho</option>
          <option value="scheduled">Agendado</option>
          <option value="published">Publicado</option>
        </select>

        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (separadas por vírgula)"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
        />

        <div className="flex gap-2">
          <Button
            onClick={() => mutation.mutate()}
            disabled={!content.trim() || mutation.isPending}
            className="flex-1"
            variant={status === 'published' ? 'default' : 'outline'}
          >
            <Send className="h-4 w-4 mr-2" />
            {mutation.isPending ? 'Salvando...' : status === 'published' ? 'Publicar' : 'Salvar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
