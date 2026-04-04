/**
 * Credential Pool with Rotation
 *
 * TODO: NOT YET INTEGRATED — this module is implemented but never imported.
 * To activate: wire into llm-client.ts to use getNextKey() instead of env var.
 *
 * Manages multiple API keys per provider with configurable rotation strategies.
 * Supports automatic cooldown after rate limits and failover to next key.
 *
 * Strategies:
 * - FILL_FIRST: Use highest-priority key until rate limited, then failover
 * - ROUND_ROBIN: Distribute calls evenly across keys
 * - LEAST_USED: Pick the key with fewest total calls
 *
 * Inspired by Hermes Agent's credential pool rotation pattern.
 */

import { createLogger } from '@hawk/shared';

const logger = createLogger('credential-pool');

export type RotationStrategy = 'fill_first' | 'round_robin' | 'least_used';

export interface PoolCredential {
  id: string;
  provider: string;
  label: string;
  apiKey: string;
  strategy: RotationStrategy;
  priority: number;
  enabled: boolean;
  // Usage tracking
  totalCalls: number;
  totalTokens: number;
  lastUsedAt: number | null;
  // Error tracking
  lastError: string | null;
  lastErrorAt: number | null;
  cooldownUntil: number | null;
  // Limits
  rateLimitRpm: number | null;
  dailyLimit: number | null;
  dailyCalls: number;
}

// ── Pool Registry ────────────────────────────────────────────────────────────

// provider → credentials sorted by priority
const _pools = new Map<string, PoolCredential[]>();
let _roundRobinIndex = new Map<string, number>();

/**
 * Register a credential in the pool.
 */
export function registerCredential(cred: PoolCredential): void {
  const pool = _pools.get(cred.provider) ?? [];
  // Replace if same ID exists
  const idx = pool.findIndex((c) => c.id === cred.id);
  if (idx >= 0) {
    pool[idx] = cred;
  } else {
    pool.push(cred);
  }
  // Sort by priority (lower = higher priority)
  pool.sort((a, b) => a.priority - b.priority);
  _pools.set(cred.provider, pool);
}

/**
 * Get the next available API key for a provider using the configured strategy.
 * Returns null if all keys are exhausted or on cooldown.
 */
export function getNextKey(provider: string): { apiKey: string; credentialId: string } | null {
  const pool = _pools.get(provider);
  if (!pool || pool.length === 0) return null;

  const available = pool.filter(
    (c) => c.enabled && (!c.cooldownUntil || Date.now() > c.cooldownUntil),
  );
  if (available.length === 0) return null;

  const strategy = available[0]?.strategy ?? 'round_robin';

  switch (strategy) {
    case 'fill_first':
      return selectFillFirst(available);
    case 'round_robin':
      return selectRoundRobin(provider, available);
    case 'least_used':
      return selectLeastUsed(available);
    default:
      return selectRoundRobin(provider, available);
  }
}

/**
 * Report a successful API call (update usage stats).
 */
export function reportSuccess(credentialId: string, tokens: number): void {
  for (const pool of _pools.values()) {
    const cred = pool.find((c) => c.id === credentialId);
    if (cred) {
      cred.totalCalls++;
      cred.totalTokens += tokens;
      cred.dailyCalls++;
      cred.lastUsedAt = Date.now();
      return;
    }
  }
}

/**
 * Report a rate limit or error (trigger cooldown).
 */
export function reportError(credentialId: string, error: string, cooldownMs = 60_000): void {
  for (const pool of _pools.values()) {
    const cred = pool.find((c) => c.id === credentialId);
    if (cred) {
      cred.lastError = error;
      cred.lastErrorAt = Date.now();
      cred.cooldownUntil = Date.now() + cooldownMs;
      logger.warn(
        { credentialId, provider: cred.provider, cooldownMs },
        `Credential on cooldown: ${cred.label}`,
      );
      return;
    }
  }
}

/**
 * Reset daily call counters (call at midnight).
 */
export function resetDailyCounts(): void {
  for (const pool of _pools.values()) {
    for (const cred of pool) {
      cred.dailyCalls = 0;
    }
  }
  _roundRobinIndex = new Map();
}

/**
 * Get pool stats for monitoring.
 */
export function getPoolStats(): Record<
  string,
  Array<{
    id: string;
    label: string;
    enabled: boolean;
    totalCalls: number;
    dailyCalls: number;
    onCooldown: boolean;
  }>
> {
  const stats: Record<string, Array<unknown>> = {};
  for (const [provider, pool] of _pools) {
    stats[provider] = pool.map((c) => ({
      id: c.id,
      label: c.label,
      enabled: c.enabled,
      totalCalls: c.totalCalls,
      dailyCalls: c.dailyCalls,
      onCooldown: c.cooldownUntil ? Date.now() < c.cooldownUntil : false,
    }));
  }
  return stats as Record<
    string,
    Array<{
      id: string;
      label: string;
      enabled: boolean;
      totalCalls: number;
      dailyCalls: number;
      onCooldown: boolean;
    }>
  >;
}

// ── Strategy Implementations ─────────────────────────────────────────────────

function selectFillFirst(pool: PoolCredential[]): { apiKey: string; credentialId: string } {
  // Use highest priority (lowest number) that hasn't hit daily limit
  for (const cred of pool) {
    if (cred.dailyLimit && cred.dailyCalls >= cred.dailyLimit) continue;
    return { apiKey: cred.apiKey, credentialId: cred.id };
  }
  // All at limit — use first available anyway
  return { apiKey: pool[0]!.apiKey, credentialId: pool[0]!.id };
}

function selectRoundRobin(
  provider: string,
  pool: PoolCredential[],
): { apiKey: string; credentialId: string } {
  const idx = (_roundRobinIndex.get(provider) ?? -1) + 1;
  const nextIdx = idx % pool.length;
  _roundRobinIndex.set(provider, nextIdx);
  const cred = pool[nextIdx]!;
  return { apiKey: cred.apiKey, credentialId: cred.id };
}

function selectLeastUsed(pool: PoolCredential[]): { apiKey: string; credentialId: string } {
  let min = pool[0]!;
  for (const cred of pool) {
    if (cred.totalCalls < min.totalCalls) min = cred;
  }
  return { apiKey: min.apiKey, credentialId: min.id };
}
