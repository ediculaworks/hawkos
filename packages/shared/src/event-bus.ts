/**
 * Typed Event Bus for cross-module reactive effects.
 *
 * Usage:
 *   import { eventBus } from '@hawk/shared';
 *   eventBus.on('transaction:created', (data) => { ... });
 *   eventBus.emit('transaction:created', { amount: 50, category: 'Food', type: 'expense' });
 */

type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

// ── Domain Event Types ──────────────────────────────────────

export type DomainEvents = {
  // Finances
  'transaction:created': { amount: number; category: string; type: string; description?: string };
  'transaction:deleted': { id: string };

  // Routine
  'habit:logged': { habitId: string; habitName: string; streak: number; completed: boolean };
  'habit:created': { habitId: string; name: string; frequency: string };

  // Health
  'sleep:logged': { hours: number; quality?: number };
  'workout:logged': { type: string; duration?: number };
  'weight:logged': { kg: number };

  // Objectives
  'task:created': { taskId: string; title: string; priority: number };
  'task:completed': { taskId: string; title: string };
  'objective:updated': { objectiveId: string; title: string; progress: number };

  // People
  'interaction:logged': { personId: string; personName: string; type: string };
  'person:created': { personId: string; name: string };

  // Calendar
  'event:created': { eventId: string; title: string; startTime: string };
  'event:upcoming': { eventId: string; title: string; minutesUntil: number };

  // Memory
  'memory:created': { memoryType: string; content: string; module?: string };
  'memory:merged': { memoryId: string; content: string };

  // Knowledge
  'note:created': { noteId: string; title?: string; type: string };

  // System
  'session:started': { sessionId: string; channel: string };
  'session:ended': { sessionId: string; channel: string };
  'heartbeat:completed': { profile: string; hadAlerts: boolean };
};

export type DomainEventName = keyof DomainEvents;

// ── Event Bus Implementation ────────────────────────────────

class TypedEventBus {
  private handlers = new Map<string, EventHandler[]>();

  on<E extends DomainEventName>(event: E, handler: EventHandler<DomainEvents[E]>): void {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler as EventHandler);
    this.handlers.set(event, existing);
  }

  off<E extends DomainEventName>(event: E, handler: EventHandler<DomainEvents[E]>): void {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(
      event,
      existing.filter((h) => h !== handler),
    );
  }

  async emit<E extends DomainEventName>(event: E, data: DomainEvents[E]): Promise<void> {
    const handlers = this.handlers.get(event) ?? [];
    for (const handler of handlers) {
      try {
        await handler(data);
      } catch (_err) {}
    }
  }

  /** Remove all handlers (useful for testing) */
  clear(): void {
    this.handlers.clear();
  }
}

/** Singleton event bus for cross-module reactive effects */
export const eventBus = new TypedEventBus();
