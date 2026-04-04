'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell } from 'lucide-react';
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

interface NotificationItem {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  category: 'checkin' | 'alerts' | 'insights';
}

const NOTIFICATIONS: NotificationItem[] = [
  {
    key: 'checkinMorning',
    label: 'Check-in matinal',
    description: 'Humor, energia e top 3 do dia (09:00)',
    category: 'checkin',
  },
  {
    key: 'checkinEvening',
    label: 'Check-in noturno',
    description: 'Habitos do dia e reflexao (22:00)',
    category: 'checkin',
  },
  {
    key: 'weeklyReview',
    label: 'Review semanal',
    description: 'Resumo de habitos, humor e objetivos (Domingo)',
    category: 'checkin',
  },
  {
    key: 'alerts',
    label: 'Alertas diarios',
    description: 'Aniversarios, obrigacoes, contatos pendentes',
    category: 'alerts',
  },
  {
    key: 'streakGuardian',
    label: 'Streak Guardian',
    description: 'Alerta de habitos com streak em risco (20:00)',
    category: 'alerts',
  },
  {
    key: 'healthInsights',
    label: 'Health Insights',
    description: 'Analise de padroes de saude via LLM (semanal)',
    category: 'insights',
  },
];

const CATEGORIES = [
  { id: 'checkin' as const, label: 'Check-ins', description: 'Rotinas diarias e semanais' },
  { id: 'alerts' as const, label: 'Alertas', description: 'Avisos e lembretes proativos' },
  { id: 'insights' as const, label: 'Insights', description: 'Analises e padroes (usa LLM)' },
];

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
      // Local prefs saved regardless
    } finally {
      setSaving(false);
    }
  };

  // Count enabled per category
  const enabledCount = (category: string) =>
    NOTIFICATIONS.filter((n) => n.category === category && prefs[n.key]).length;
  const totalCount = (category: string) =>
    NOTIFICATIONS.filter((n) => n.category === category).length;

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
          <Bell className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Notificacoes</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Escolha quais automacoes enviam mensagens no Discord.
        </p>
      </div>

      <div className="space-y-[var(--space-6)] max-w-lg">
        {CATEGORIES.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center justify-between mb-[var(--space-3)]">
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                  {cat.label}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">{cat.description}</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                {enabledCount(cat.id)}/{totalCount(cat.id)}
              </span>
            </div>
            <div className="space-y-[var(--space-2)]">
              {NOTIFICATIONS.filter((n) => n.category === cat.id).map((n) => (
                <div
                  key={n.key}
                  className={`flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] border transition-colors ${
                    prefs[n.key]
                      ? 'bg-[var(--color-surface-1)] border-[var(--color-accent)]/20'
                      : 'bg-[var(--color-surface-1)] border-[var(--color-border)]'
                  }`}
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
        ))}
      </div>
    </div>
  );
}
