'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useEffect, useState } from 'react';

interface NotificationPrefs {
  checkinMorning: boolean;
  checkinEvening: boolean;
  weeklyReview: boolean;
  alerts: boolean;
  streakGuardian: boolean;
  healthInsights: boolean;
}

const DEFAULTS: NotificationPrefs = {
  checkinMorning: true,
  checkinEvening: true,
  weeklyReview: true,
  alerts: true,
  streakGuardian: true,
  healthInsights: false,
};

const PREFS_KEY = 'hawk-notification-prefs';

export function SectionNotifications() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      try {
        setPrefs({ ...DEFAULTS, ...JSON.parse(stored) });
      } catch {
        // ignore
      }
    }
  }, []);

  const toggle = async (key: keyof NotificationPrefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));

    // Sync to agent automation_configs
    setSaving(true);
    try {
      const automationMap: Partial<Record<keyof NotificationPrefs, string>> = {
        checkinMorning: 'daily-checkin-morning',
        checkinEvening: 'daily-checkin-evening',
        weeklyReview: 'weekly-review',
        alerts: 'alerts-daily',
        streakGuardian: 'streak-guardian',
        healthInsights: 'health-insights',
      };
      const automationId = automationMap[key];
      if (automationId) {
        await fetch('/api/agent/automations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: automationId, enabled: updated[key] }),
        });
      }
    } catch {
      // Silently fail — local prefs saved regardless
    } finally {
      setSaving(false);
    }
  };

  const notifications = [
    {
      key: 'checkinMorning' as const,
      label: 'Check-in matinal',
      description: 'Humor, energia e top 3 do dia (09:00)',
    },
    {
      key: 'checkinEvening' as const,
      label: 'Check-in noturno',
      description: 'Habitos do dia e reflexao (22:00)',
    },
    {
      key: 'weeklyReview' as const,
      label: 'Review semanal',
      description: 'Resumo de habitos, humor e objetivos (Domingo)',
    },
    {
      key: 'alerts' as const,
      label: 'Alertas diarios',
      description: 'Aniversarios, obrigacoes, contatos pendentes',
    },
    {
      key: 'streakGuardian' as const,
      label: 'Streak Guardian',
      description: 'Alerta de habitos com streak em risco (20:00)',
    },
    {
      key: 'healthInsights' as const,
      label: 'Health Insights',
      description: 'Analise de padroes de saude (requer LLM)',
    },
  ];

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Notificacoes</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Escolha quais automacoes enviam mensagens no Discord.
        </p>
      </div>

      <div className="space-y-[var(--space-4)] max-w-lg">
        {notifications.map((n) => (
          <div
            key={n.key}
            className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-1)] border border-[var(--color-border)]"
          >
            <div>
              <Label>{n.label}</Label>
              <p className="text-xs text-[var(--color-text-muted)]">{n.description}</p>
            </div>
            <Switch
              checked={prefs[n.key]}
              onCheckedChange={() => toggle(n.key)}
              disabled={saving}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
