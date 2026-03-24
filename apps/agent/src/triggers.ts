/**
 * Trigger Rules — configurable reactive rules that fire on domain events.
 * These connect the event bus to actions like Discord notifications.
 */

import { type DomainEventName, type DomainEvents, eventBus } from '@hawk/shared';

type TriggerAction = 'notify' | 'log' | 'celebrate';

type TriggerRule<E extends DomainEventName = DomainEventName> = {
  name: string;
  event: E;
  condition: (data: DomainEvents[E]) => boolean;
  action: TriggerAction;
  message: (data: DomainEvents[E]) => string;
};

// ── Built-in Trigger Rules ──────────────────────────────────

const TRIGGER_RULES: TriggerRule<DomainEventName>[] = [
  // High-value transaction alert
  {
    name: 'high-value-transaction',
    event: 'transaction:created',
    condition: (data) => (data as DomainEvents['transaction:created']).amount > 500,
    action: 'notify',
    message: (data) => {
      const d = data as DomainEvents['transaction:created'];
      return `💰 Transação de R$${d.amount.toFixed(2)} registrada em **${d.category}**`;
    },
  },

  // Streak milestone celebration
  {
    name: 'streak-milestone',
    event: 'habit:logged',
    condition: (data) => {
      const d = data as DomainEvents['habit:logged'];
      return d.completed && d.streak > 0 && d.streak % 7 === 0;
    },
    action: 'celebrate',
    message: (data) => {
      const d = data as DomainEvents['habit:logged'];
      return `🔥 **${d.habitName}**: ${d.streak} dias de streak! Continue assim!`;
    },
  },

  // Task completed
  {
    name: 'task-completed',
    event: 'task:completed',
    condition: () => true,
    action: 'log',
    message: (data) => {
      const d = data as DomainEvents['task:completed'];
      return `✅ Tarefa concluída: **${d.title}**`;
    },
  },

  // Workout logged
  {
    name: 'workout-logged',
    event: 'workout:logged',
    condition: () => true,
    action: 'log',
    message: (data) => {
      const d = data as DomainEvents['workout:logged'];
      return `💪 Treino registrado: ${d.type}${d.duration ? ` (${d.duration}min)` : ''}`;
    },
  },
];

// ── Registration ──────────────────────────────────────────────

let sendNotification: ((message: string) => Promise<void>) | null = null;

export function setNotificationSender(sender: (message: string) => Promise<void>): void {
  sendNotification = sender;
}

async function handleTrigger(rule: TriggerRule<DomainEventName>, data: unknown): Promise<void> {
  const message = rule.message(data as DomainEvents[DomainEventName]);

  switch (rule.action) {
    case 'notify':
    case 'celebrate':
      if (sendNotification) {
        await sendNotification(message);
      }
      console.log(`[trigger:${rule.name}] ${message}`);
      break;
    case 'log':
      console.log(`[trigger:${rule.name}] ${message}`);
      break;
  }
}

/**
 * Register all trigger rules on the event bus.
 * Call once at startup.
 */
export function registerTriggers(): void {
  for (const rule of TRIGGER_RULES) {
    eventBus.on(rule.event, async (data) => {
      try {
        if (rule.condition(data as DomainEvents[typeof rule.event])) {
          await handleTrigger(rule, data);
        }
      } catch (err) {
        console.error(`[trigger:${rule.name}] Error:`, err);
      }
    });
  }
  console.log(`[hawk] Registered ${TRIGGER_RULES.length} trigger rules`);
}
