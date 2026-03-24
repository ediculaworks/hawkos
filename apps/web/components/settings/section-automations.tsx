'use client';

import { agentHeaders, getAgentApiUrl } from '@/lib/config';
import { Clock, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AutomationInfo {
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
}

const KNOWN_AUTOMATIONS: AutomationInfo[] = [
  {
    name: 'Alertas',
    description: 'Verifica limites e envia alertas',
    schedule: '0 8 * * *',
    enabled: true,
  },
  {
    name: 'Check-in Manhã',
    description: 'Resumo do dia e tarefas',
    schedule: '0 9 * * *',
    enabled: true,
  },
  {
    name: 'Check-in Noite',
    description: 'Review do dia e reflexão',
    schedule: '0 22 * * *',
    enabled: true,
  },
  {
    name: 'Weekly Review',
    description: 'Análise semanal completa',
    schedule: '0 20 * * 0',
    enabled: true,
  },
  {
    name: 'Session Compactor',
    description: 'Extrai memórias de sessões',
    schedule: '0 * * * *',
    enabled: true,
  },
  {
    name: 'Health Insights',
    description: 'Correlações de saúde',
    schedule: '0 7 * * 1',
    enabled: true,
  },
  {
    name: 'Content Pipeline',
    description: 'Gestão de conteúdo social',
    schedule: '0 10 * * 1,4',
    enabled: true,
  },
];

function formatCron(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const min = parts[0] ?? '*';
  const hour = parts[1] ?? '*';
  const dow = parts[4] ?? '*';

  const dayNames: Record<string, string> = {
    '0': 'Dom',
    '1': 'Seg',
    '2': 'Ter',
    '3': 'Qua',
    '4': 'Qui',
    '5': 'Sex',
    '6': 'Sáb',
  };

  let timeStr = '';
  if (hour !== '*' && min !== '*') {
    timeStr = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  } else if (hour === '*') {
    timeStr = 'A cada hora';
  }

  if (dow !== '*') {
    const days = dow
      .split(',')
      .map((d) => dayNames[d] ?? d)
      .join(', ');
    return `${timeStr} (${days})`;
  }
  if (timeStr === 'A cada hora') return timeStr;
  return `${timeStr} diário`;
}

export function SectionAutomations() {
  const [automations, setAutomations] = useState<AutomationInfo[]>(KNOWN_AUTOMATIONS);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getAgentApiUrl()}/automations`, { headers: agentHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.automations) && data.automations.length > 0) {
            setAutomations(data.automations);
          }
        } else {
          setOffline(true);
        }
      } catch {
        setOffline(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Automações</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Tarefas automáticas executadas pelo agente.
        </p>
        {offline && (
          <p className="text-xs text-[var(--color-warning)] mt-[var(--space-2)]">
            Agente offline. Mostrando automações conhecidas.
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : (
        <div className="space-y-[var(--space-2)] max-w-lg">
          {automations.map((auto) => (
            <div
              key={auto.name}
              className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-1)]"
            >
              <div className="flex items-center gap-[var(--space-3)]">
                <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-accent)]/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-[var(--color-accent)]" />
                </div>
                <div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {auto.name}
                  </span>
                  <p className="text-xs text-[var(--color-text-muted)]">{auto.description}</p>
                </div>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] font-mono whitespace-nowrap">
                {formatCron(auto.schedule)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="pt-[var(--space-2)]">
        <Link
          href="/dashboard/automations"
          className="inline-flex items-center gap-[var(--space-1-5)] text-sm text-[var(--color-accent)] hover:underline"
        >
          Gerenciar automações
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
