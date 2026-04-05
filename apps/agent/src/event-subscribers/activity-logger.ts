/**
 * Event Bus subscribers that automatically log domain events to activity_log.
 *
 * Registers listeners for all domain events and writes structured log entries.
 * This decouples "something happened" from "log that it happened".
 */

import { db } from '@hawk/db';
import { eventBus } from '@hawk/shared';

async function logActivity(
  eventType: string,
  summary: string,
  mod?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.from('activity_log').insert({
      event_type: eventType,
      summary,
      module: mod,
      metadata: (metadata ?? {}) as Record<string, unknown>,
      // biome-ignore lint/suspicious/noExplicitAny: Supabase types lag behind schema
    } as any);
  } catch (err) {
    console.error('[activity-logger] Failed to log event:', err);
  }
}

export function registerActivitySubscribers(): void {
  // ── Finances ──────────────────────────────────────────────────
  eventBus.on('transaction:created', (data) => {
    logActivity(
      'transaction',
      `Nova transação: ${data.description ?? data.category} R$${data.amount}`,
      'finances',
      data,
    ).catch(() => {});
  });

  // ── Routine ───────────────────────────────────────────────────
  eventBus.on('habit:logged', (data) => {
    const status = data.completed ? 'completado' : 'não completado';
    logActivity(
      'habit',
      `Hábito ${status}: ${data.habitName} (streak: ${data.streak})`,
      'routine',
      data,
    ).catch(() => {});
  });

  eventBus.on('habit:created', (data) => {
    logActivity('habit', `Hábito criado: ${data.name}`, 'routine', data).catch(() => {});
  });

  // ── Health ────────────────────────────────────────────────────
  eventBus.on('sleep:logged', (data) => {
    logActivity('health', `Sono registado: ${data.hours}h`, 'health', data).catch(() => {});
  });

  eventBus.on('workout:logged', (data) => {
    const dur = data.duration ? ` (${data.duration}min)` : '';
    logActivity('health', `Treino registado: ${data.type}${dur}`, 'health', data).catch(() => {});
  });

  eventBus.on('weight:logged', (data) => {
    logActivity('health', `Peso registado: ${data.kg}kg`, 'health', data).catch(() => {});
  });

  // ── Objectives ────────────────────────────────────────────────
  eventBus.on('task:created', (data) => {
    logActivity('task', `Tarefa criada: ${data.title}`, 'objectives', data).catch(() => {});
  });

  eventBus.on('task:completed', (data) => {
    logActivity('task', `Tarefa completada: ${data.title}`, 'objectives', data).catch(() => {});
  });

  eventBus.on('objective:updated', (data) => {
    logActivity(
      'objective',
      `Objectivo actualizado: ${data.title} (${data.progress}%)`,
      'objectives',
      data,
    ).catch(() => {});
  });

  // ── People ────────────────────────────────────────────────────
  eventBus.on('person:created', (data) => {
    logActivity('person', `Contacto criado: ${data.name}`, 'people', data).catch(() => {});
  });

  eventBus.on('interaction:logged', (data) => {
    logActivity(
      'interaction',
      `Interação com ${data.personName}: ${data.type}`,
      'people',
      data,
    ).catch(() => {});
  });

  // ── Calendar ──────────────────────────────────────────────────
  eventBus.on('event:created', (data) => {
    logActivity('calendar', `Evento criado: ${data.title}`, 'calendar', data).catch(() => {});
  });

  // ── Memory ────────────────────────────────────────────────────
  eventBus.on('memory:created', (data) => {
    logActivity(
      'memory',
      `Memória criada (${data.memoryType}): ${data.content.slice(0, 80)}`,
      data.module,
      data,
    ).catch(() => {});
  });

  // ── Knowledge ─────────────────────────────────────────────────
  eventBus.on('note:created', (data) => {
    const title = data.title ? `: ${data.title}` : '';
    logActivity('note', `Nota criada${title} (${data.type})`, 'knowledge', data).catch(() => {});
  });

  // ── Demands ───────────────────────────────────────────────────
  eventBus.on('demand:created', (data) => {
    logActivity('demand', `Demanda criada: ${data.title}`, data.module, data).catch(() => {});
  });

  eventBus.on('demand:completed', (data) => {
    logActivity('demand', `Demanda completada: ${data.title}`, undefined, data).catch(() => {});
  });

  // ── Journal ───────────────────────────────────────────────────
  eventBus.on('journal:entry_created', (data) => {
    const mood = data.mood != null ? ` mood:${data.mood}` : '';
    logActivity('journal', `Entrada de diário${mood}`, 'journal', data).catch(() => {});
  });

  // ── Security ──────────────────────────────────────────────────
  eventBus.on('security:alert_created', (data) => {
    logActivity(
      'security',
      `Alerta de segurança [${data.level}]: ${data.description}`,
      'security',
      data,
    ).catch(() => {});
  });

  // ── System ────────────────────────────────────────────────────
  eventBus.on('system:alert', (data) => {
    logActivity(
      'alert',
      `[${data.severity.toUpperCase()}] ${data.name}: ${data.message}`,
      undefined,
      data,
    ).catch(() => {});
  });

  console.log('[event-subscribers] Activity logger registered');
}
