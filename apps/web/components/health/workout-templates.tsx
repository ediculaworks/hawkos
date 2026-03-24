'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchWorkoutTemplateWithSets, fetchWorkoutTemplates } from '@/lib/actions/health';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Clock, Dumbbell, Plus } from 'lucide-react';
import { useState } from 'react';

export function WorkoutTemplates() {
  const { data: templates, isLoading } = useQuery({
    queryKey: ['health', 'workout-templates'],
    queryFn: fetchWorkoutTemplates,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { data: selectedTemplateData } = useQuery({
    queryKey: ['health', 'workout-template', selectedTemplate],
    queryFn: () => (selectedTemplate ? fetchWorkoutTemplateWithSets(selectedTemplate) : null),
    enabled: !!selectedTemplate,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-[var(--color-surface-3)] rounded w-1/4" />
            <div className="h-20 bg-[var(--color-surface-3)] rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Fichas de Academia
          </CardTitle>
          <Button size="sm" variant="ghost">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nova Ficha
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {templates && templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplate(template.id)}
                className="w-full flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors cursor-pointer text-left"
              >
                <div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)] block">
                    {template.name}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    {template.frequency && (
                      <Badge variant="muted" className="text-xs">
                        {template.frequency}
                      </Badge>
                    )}
                    {template.estimated_duration_m && (
                      <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                        <Clock className="h-3 w-3" />
                        {template.estimated_duration_m} min
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Dumbbell}
            title="Nenhuma ficha criada"
            description="Crie sua primeira ficha de treino"
          />
        )}

        {selectedTemplateData && (
          <div className="mt-4 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-3)]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-[var(--color-text-primary)]">
                {selectedTemplateData.name}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="text-xs text-[var(--color-accent)] hover:underline cursor-pointer"
              >
                Fechar
              </button>
            </div>
            <div className="space-y-3">
              {selectedTemplateData.sets.map((set, idx) => (
                <div
                  key={set.id}
                  className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)] w-4">{idx + 1}.</span>
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {set.exercise.name}
                    </span>
                    <Badge variant="muted" className="text-xs">
                      {set.exercise.muscle_group}
                    </Badge>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {set.target_sets}x{set.target_reps}
                    {set.target_weight_kg && ` @ ${set.target_weight_kg}kg`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
