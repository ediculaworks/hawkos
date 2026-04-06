/**
 * Undo Store — S1.3 Undo Actions
 *
 * In-memory registry of undoable actions with a 60-second TTL.
 * Tools that create records register an undo action here.
 * The Discord channel adapter reads and surfaces the undo button.
 */

export const UNDO_TTL_MS = 60_000;

export interface UndoAction {
  actionId: string;
  /** Human-readable summary shown on the button label and confirmation */
  description: string;
  /** Runs the actual undo (soft-delete). Must be called within withSchema() context. */
  perform: () => Promise<void>;
  createdAt: number;
}

const _store = new Map<string, UndoAction>();

// Auto-cleanup expired entries every 30s
setInterval(() => {
  const now = Date.now();
  for (const [id, action] of _store) {
    if (now - action.createdAt > UNDO_TTL_MS) {
      _store.delete(id);
    }
  }
}, 30_000);

export function registerUndoAction(
  actionId: string,
  description: string,
  perform: () => Promise<void>,
): void {
  _store.set(actionId, { actionId, description, perform, createdAt: Date.now() });
}

export function getUndoAction(actionId: string): UndoAction | undefined {
  const action = _store.get(actionId);
  if (!action) return undefined;
  if (Date.now() - action.createdAt > UNDO_TTL_MS) {
    _store.delete(actionId);
    return undefined;
  }
  return action;
}

export function removeUndoAction(actionId: string): void {
  _store.delete(actionId);
}

/** Extract UNDO tag from tool result string. Returns {clean, actionId} or {clean: result, actionId: null}. */
export function parseUndoTag(result: string): { clean: string; actionId: string | null } {
  const match = result.match(/\[UNDO:([a-f0-9-]{36})\]/);
  if (!match) return { clean: result, actionId: null };
  return {
    clean: result.replace(/\s*\[UNDO:[a-f0-9-]{36}\]/, '').trimEnd(),
    actionId: match[1] ?? null,
  };
}
