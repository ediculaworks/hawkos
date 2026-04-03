import type { Hook, HookContext, HookEvent } from './types.js';

class HookRegistry {
  private hooks: Map<HookEvent, Hook[]> = new Map();

  register(hook: Hook): void {
    const existing = this.hooks.get(hook.event) ?? [];
    existing.push(hook);
    // Sort by priority (lower = first)
    existing.sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
    this.hooks.set(hook.event, existing);
  }

  unregister(name: string, event?: HookEvent): void {
    if (event) {
      const hooks = this.hooks.get(event) ?? [];
      this.hooks.set(
        event,
        hooks.filter((h) => h.name !== name),
      );
    } else {
      for (const [evt, hooks] of this.hooks) {
        this.hooks.set(
          evt,
          hooks.filter((h) => h.name !== name),
        );
      }
    }
  }

  async emit(event: HookEvent, ctx: HookContext): Promise<void> {
    const hooks = this.hooks.get(event) ?? [];
    const results = await Promise.allSettled(hooks.map((hook) => hook.handler(ctx)));
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result && result.status === 'rejected') {
        console.error(`[hooks] Error in hook "${hooks[i]?.name}" for event "${event}":`, result.reason);
      }
    }
  }

  getHooks(event?: HookEvent): Hook[] {
    if (event) return this.hooks.get(event) ?? [];
    return [...this.hooks.values()].flat();
  }
}

export const hookRegistry = new HookRegistry();
