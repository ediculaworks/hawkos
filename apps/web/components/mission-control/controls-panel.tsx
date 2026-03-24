'use client';

import { Button } from '@/components/ui/button';
import { type Automation, fetchAutomations } from '@/lib/agent-api';
import {
  CalendarClock,
  CheckCircle2,
  Lightbulb,
  Newspaper,
  Shield,
  Sun,
  Sunset,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface ControlsPanelProps {
  onTrigger: (automation: string) => boolean;
  pendingAutomation: string | null;
}

const AUTOMATION_ICONS: Record<string, React.ReactNode> = {
  'daily-checkin-morning': <Sun className="h-4 w-4" />,
  'daily-checkin-evening': <Sunset className="h-4 w-4" />,
  'weekly-review': <CalendarClock className="h-4 w-4" />,
  'alerts-daily': <Shield className="h-4 w-4" />,
  'alerts-monthly': <Shield className="h-4 w-4" />,
  'health-insights': <Lightbulb className="h-4 w-4" />,
  'content-pipeline': <Newspaper className="h-4 w-4" />,
};

export function ControlsPanel({ onTrigger, pendingAutomation }: ControlsPanelProps) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    fetchAutomations().then(setAutomations);
  }, []);

  const handleTrigger = async (name: string) => {
    setTriggering(name);
    onTrigger(name);
    setTimeout(() => setTriggering(null), 2000);
  };

  const grouped = {
    checkin: automations.filter((a) => a.category === 'checkin'),
    review: automations.filter((a) => a.category === 'review'),
    alerts: automations.filter((a) => a.category === 'alerts'),
    health: automations.filter((a) => a.category === 'health'),
    content: automations.filter((a) => a.category === 'content'),
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-[var(--space-5)]">
      <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-4)]">
        CONTROLS
      </h2>

      <div className="flex flex-wrap gap-[var(--space-2)]">
        {/* Check-in buttons */}
        {grouped.checkin.map((a) => (
          <Button
            key={a.name}
            size="sm"
            variant="outline"
            onClick={() => handleTrigger(a.name)}
            disabled={triggering === a.name || !!pendingAutomation}
          >
            {AUTOMATION_ICONS[a.name] || <CheckCircle2 className="h-4 w-4" />}
            <span className="ml-1">{a.name.includes('morning') ? 'Manhã' : 'Noite'}</span>
          </Button>
        ))}

        {/* Weekly Review */}
        {grouped.review.map((a) => (
          <Button
            key={a.name}
            size="sm"
            variant="outline"
            onClick={() => handleTrigger(a.name)}
            disabled={triggering === a.name || !!pendingAutomation}
          >
            <CalendarClock className="h-4 w-4" />
            <span className="ml-1">Weekly Review</span>
          </Button>
        ))}

        {/* Alerts */}
        {grouped.alerts.map((a) => (
          <Button
            key={a.name}
            size="sm"
            variant="outline"
            onClick={() => handleTrigger(a.name)}
            disabled={triggering === a.name || !!pendingAutomation}
          >
            <Shield className="h-4 w-4" />
            <span className="ml-1">{a.name.includes('monthly') ? 'Security' : 'Alertas'}</span>
          </Button>
        ))}

        {/* Health Insights */}
        {grouped.health.map((a) => (
          <Button
            key={a.name}
            size="sm"
            variant="outline"
            onClick={() => handleTrigger(a.name)}
            disabled={triggering === a.name || !!pendingAutomation}
          >
            <Lightbulb className="h-4 w-4" />
            <span className="ml-1">Health</span>
          </Button>
        ))}

        {/* Content Pipeline */}
        {grouped.content.map((a) => (
          <Button
            key={a.name}
            size="sm"
            variant="outline"
            onClick={() => handleTrigger(a.name)}
            disabled={triggering === a.name || !!pendingAutomation}
          >
            <Newspaper className="h-4 w-4" />
            <span className="ml-1">Pipeline</span>
          </Button>
        ))}
      </div>

      {/* Next automations */}
      <div className="mt-[var(--space-4)] pt-[var(--space-4)] border-t border-[var(--color-border)]">
        <h3 className="text-xs font-medium text-[var(--color-text-muted)] mb-[var(--space-2)]">
          PRÓXIMAS AUTOMATIONS
        </h3>
        <div className="space-y-[var(--space-1)]">
          {automations.slice(0, 5).map((a) => (
            <div key={a.name} className="flex justify-between text-xs">
              <span className="text-[var(--color-text-secondary)]">{a.description}</span>
              <span className="text-[var(--color-text-muted)]">{a.nextRunFormatted}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
