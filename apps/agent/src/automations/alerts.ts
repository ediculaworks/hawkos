// Automation: Alertas proativos
// - Aniversários (3 dias antes)
// - Obrigações fiscais (15, 7 e 1 dia antes)
// - Contatos overdue
// Horários configuráveis via agent_settings

import { db } from '@hawk/db';
import { listExpiringDocuments } from '@hawk/module-assets';
import { getExpiringContracts, getUrgentObligations } from '@hawk/module-legal';
import type { Person } from '@hawk/module-people';
import { listOverdueContacts, listUpcomingBirthdays } from '@hawk/module-people';
import { getDueForReview, getPendingItems, getSecuritySummary } from '@hawk/module-security';
import cron from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { isAutomationEnabled, markAutomationRun } from './config.js';

const CHANNEL_ID = process.env.DISCORD_CHANNEL_GERAL ?? '';

interface AlertSettings {
  alerts_enabled: boolean;
  alerts_time: string;
  security_review_day: number;
  security_review_time: string;
}

async function getAlertSettings(): Promise<AlertSettings> {
  try {
    const { data } = await db.from('agent_settings').select('*').limit(1).single();
    return {
      alerts_enabled: data?.alerts_enabled ?? true,
      alerts_time: data?.alerts_time ?? '08:00',
      security_review_day: data?.security_review_day ?? 1,
      security_review_time: data?.security_review_time ?? '10:00',
    };
  } catch {
    return {
      alerts_enabled: true,
      alerts_time: '08:00',
      security_review_day: 1,
      security_review_time: '10:00',
    };
  }
}

/**
 * Verificar e enviar todos os alertas do dia
 */
export async function runDailyAlerts(): Promise<void> {
  if (!CHANNEL_ID) return;

  // Check web UI toggle (automation_configs) + agent_settings
  if (!(await isAutomationEnabled('alerts-daily'))) return;

  const settings = await getAlertSettings();
  if (!settings.alerts_enabled) return;

  const alerts: string[] = [];

  const birthdays = await listUpcomingBirthdays(3);
  for (const p of birthdays) {
    if (p.days_until === 0) {
      alerts.push(`🎂 **HOJE** é aniversário de **${p.name}**! Manda uma mensagem.`);
    } else if (p.days_until <= 3) {
      alerts.push(
        `🎂 Aniversário de **${p.name}** em **${p.days_until} dias** (${new Date(p.birthday as string).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`,
      );
    }
  }

  const obligations = await getUrgentObligations(15);
  for (const o of obligations) {
    if (o.urgency === 'critical') {
      const msg =
        o.days_until_due < 0
          ? `🔴 **VENCIDA** há ${Math.abs(o.days_until_due)}d: **${o.name}**${o.amount ? ` · R$${o.amount.toFixed(2)}` : ''}`
          : `🔴 **HOJE** vence: **${o.name}**${o.amount ? ` · R$${o.amount.toFixed(2)}` : ''}`;
      alerts.push(msg);
    } else if (o.urgency === 'urgent') {
      alerts.push(
        `🟠 ${o.days_until_due}d para **${o.name}**${o.amount ? ` · R$${o.amount.toFixed(2)}` : ''}`,
      );
    } else if (o.urgency === 'warning') {
      alerts.push(`🟡 ${o.days_until_due}d para **${o.name}**`);
    }
  }

  const expiringDocs = await listExpiringDocuments(30);
  for (const doc of expiringDocs) {
    if (!doc.expires_at) continue;
    const venc = new Date(doc.expires_at);
    const diff = Math.ceil((venc.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff <= 7) {
      alerts.push(
        `🔴 Documento vencendo em ${diff}d: **${doc.name}** (${venc.toLocaleDateString('pt-BR')})`,
      );
    } else if (diff <= 30) {
      alerts.push(`🟡 Documento vencendo em ${diff}d: **${doc.name}**`);
    }
  }

  const expiringContracts = await getExpiringContracts(30);
  for (const c of expiringContracts) {
    if (c.days_until_expiry <= 7) {
      alerts.push(
        `🔴 Contrato vencendo em ${c.days_until_expiry}d: **${c.title}** (${c.end_date})`,
      );
    } else if (c.days_until_expiry <= 30) {
      alerts.push(`🟡 Contrato vencendo em ${c.days_until_expiry}d: **${c.title}**`);
    }
  }

  const overdue = await listOverdueContacts();
  if (overdue.length > 0) {
    const names = overdue
      .slice(0, 3)
      .map((p: Person) => p.name)
      .join(', ');
    const extra = overdue.length > 3 ? ` (+${overdue.length - 3})` : '';
    alerts.push(`📞 Contatos pendentes: **${names}**${extra}`);
  }

  if (alerts.length === 0) return;

  const message = `⚡ **Alertas do dia:**\n\n${alerts.join('\n')}`;
  await sendToChannel(CHANNEL_ID, message);
}

async function runMonthlySecurityReview(): Promise<void> {
  if (!CHANNEL_ID) return;

  const [summary, _pending, due] = await Promise.all([
    getSecuritySummary(),
    getPendingItems(),
    getDueForReview(),
  ]);

  const total = summary.ok + summary.pendente + summary.critico;
  const lines: string[] = ['🔐 **Revisão mensal de segurança:**', ''];

  if (summary.critico > 0) lines.push(`🔴 ${summary.critico} item(s) crítico(s)`);
  if (summary.pendente > 0) lines.push(`🟠 ${summary.pendente} item(s) pendente(s)`);
  lines.push(`✅ ${summary.ok}/${total} itens ok`);

  if (due.length > 0) {
    lines.push('', '📅 **Para revisar este mês:**');
    for (const i of due) {
      lines.push(`• ${i.name}`);
    }
  }

  lines.push('', 'Use `/seguranca list` para ver todos os itens.');
  await sendToChannel(CHANNEL_ID, lines.join('\n'));
}

let _alertsRunning = false;

function getLocalHour(timezone: string): { hours: number; minutes: number; date: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    hour12: false,
    timeZone: timezone,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hours: get('hour'), minutes: get('minute'), date: get('day') };
}

export function startAlertsCron(): void {
  cron.schedule('0 * * * *', async () => {
    if (_alertsRunning) return;
    _alertsRunning = true;
    try {
      const settings = await getAlertSettings();
      const timezone =
        ((settings as unknown as Record<string, unknown>).timezone as string) ??
        'America/Sao_Paulo';
      const now = getLocalHour(timezone);
      const [aHours, aMinutes] = settings.alerts_time.split(':').map(Number);
      const [sHours, sMinutes] = settings.security_review_time.split(':').map(Number);

      if (settings.alerts_enabled && now.hours === aHours && now.minutes === aMinutes) {
        await runDailyAlerts()
          .then(() => markAutomationRun('alerts-daily', 'success'))
          .catch((err) => {
            console.error('[alerts] Daily alerts failed:', err);
            markAutomationRun('alerts-daily', 'failure', String(err));
          });
      }

      if (
        now.date === settings.security_review_day &&
        now.hours === sHours &&
        now.minutes === sMinutes
      ) {
        await runMonthlySecurityReview()
          .then(() => markAutomationRun('alerts-monthly', 'success'))
          .catch((err) => {
            console.error('[alerts] Security review failed:', err);
            markAutomationRun('alerts-monthly', 'failure', String(err));
          });
      }
    } finally {
      _alertsRunning = false;
    }
  });
}
