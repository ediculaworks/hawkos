/**
 * Prerequisite Registry — S1.1 Prerequisite Guard
 *
 * Tool definitions declare prerequisites by name (e.g. "finances.accounts.exists").
 * Checker functions are registered here and run within the tenant schema context
 * (called from executeToolCall which always runs inside withSchema()).
 */

type Checker = () => Promise<boolean>;

const _registry = new Map<string, Checker>();

export function registerPrerequisite(name: string, check: Checker): void {
  _registry.set(name, check);
}

/**
 * Returns true if the prerequisite is satisfied, or if it is unknown (no checker registered).
 * Must be called within a withSchema() context so DB queries use the correct tenant schema.
 */
export async function checkPrerequisite(name: string): Promise<boolean> {
  const check = _registry.get(name);
  if (!check) return true; // unknown prerequisite = optimistically satisfied
  try {
    return await check();
  } catch {
    return true; // fail-open: don't block the user if the check itself errors
  }
}
