import { db } from '@hawk/db';
import { MEMORY_HALF_LIVES } from './retrieval';

/**
 * Adaptive Half-Lives
 *
 * Instead of using fixed constants (routine=3d, health=7d, etc.),
 * this module computes optimal half-lives from actual memory access patterns.
 *
 * Concept: Half-life = the time for a memory to lose half its relevance.
 * If the user accesses health memories every 3 days on average,
 * the real half-life is ~4 days (median_interval * ln(2)).
 *
 * The system blends computed values with hardcoded defaults:
 *   final = computed_weight * computed + (1 - computed_weight) * default
 *
 * With few data points, defaults dominate. As data accumulates,
 * the computed values take over — the system literally gets smarter.
 */

// ── Configuration ──────────────────────────────────────────

/** Minimum memories accessed per module to compute adaptive half-life */
const MIN_MEMORIES_FOR_ADAPTATION = 3;

/** How much weight the computed half-life gets vs the default */
const COMPUTED_WEIGHT = 0.7;

/** Safety bounds for computed half-lives */
const MIN_HALF_LIFE_DAYS = 1;
const MAX_HALF_LIFE_DAYS = 365;

// ── Cached Adaptive Values ─────────────────────────────────

let adaptiveHalfLives: Record<string, number> | null = null;

/**
 * Get the current half-life for a module, using adaptive values if available.
 * Falls back to hardcoded defaults if no adaptive data exists.
 */
export function getAdaptiveHalfLife(module: string): number {
  const adaptive = adaptiveHalfLives?.[module];
  if (adaptive !== undefined) return adaptive;
  return MEMORY_HALF_LIVES[module] ?? MEMORY_HALF_LIVES.default ?? 180;
}

/**
 * Compute adaptive half-lives from actual memory access patterns.
 *
 * Algorithm:
 * 1. For each module, find memories that have been accessed 2+ times
 * 2. Calculate the average interval between created_at and last_accessed
 * 3. Derive half-life: median_interval * ln(2)
 * 4. Blend with hardcoded default for stability
 *
 * This should be called periodically (weekly) to update the values.
 */
export async function computeAdaptiveHalfLives(): Promise<Record<string, number>> {
  const { data, error } = await db
    .from('agent_memories')
    .select('module, access_count, created_at, last_accessed, updated_at')
    .eq('status', 'active')
    .gte('access_count', 2)
    .not('module', 'is', null)
    .not('last_accessed', 'is', null);

  if (error || !data || data.length === 0) {
    return { ...MEMORY_HALF_LIVES };
  }

  // Group by module
  const byModule = new Map<string, number[]>();
  for (const row of data) {
    if (!row.module || !row.last_accessed || !row.created_at) continue;

    const module = row.module as string;
    const created = new Date(row.created_at as string).getTime();
    const lastAccessed = new Date(row.last_accessed as string).getTime();

    // Interval = time span from creation to last access, divided by access count
    // This approximates the average time between accesses
    const totalSpanDays = Math.max((lastAccessed - created) / 86_400_000, 0.1);
    const avgIntervalDays = totalSpanDays / Math.max((row.access_count as number) - 1, 1);

    if (!byModule.has(module)) byModule.set(module, []);
    byModule.get(module)?.push(avgIntervalDays);
  }

  // Compute half-life per module
  const computed: Record<string, number> = {};

  for (const [module, intervals] of byModule) {
    if (intervals.length < MIN_MEMORIES_FOR_ADAPTATION) continue;

    // Use median for robustness against outliers
    intervals.sort((a, b) => a - b);
    const medianIdx = Math.floor(intervals.length / 2);
    const prev = intervals[medianIdx - 1] ?? 0;
    const curr = intervals[medianIdx] ?? 0;
    const medianInterval = intervals.length % 2 === 0 ? (prev + curr) / 2 : curr;

    // Half-life = median_interval * ln(2)
    const rawHalfLife = medianInterval * Math.LN2;

    // Clamp to safety bounds
    const clampedHalfLife = Math.max(MIN_HALF_LIFE_DAYS, Math.min(MAX_HALF_LIFE_DAYS, rawHalfLife));

    // Blend with default
    const defaultHalfLife = MEMORY_HALF_LIVES[module] ?? MEMORY_HALF_LIVES.default ?? 180;
    const blended = COMPUTED_WEIGHT * clampedHalfLife + (1 - COMPUTED_WEIGHT) * defaultHalfLife;

    computed[module] = Math.round(blended * 10) / 10; // round to 1 decimal
  }

  // Merge with defaults (keep default for modules without enough data)
  const result = { ...MEMORY_HALF_LIVES };
  for (const [module, halfLife] of Object.entries(computed)) {
    result[module] = halfLife;
  }

  // Cache the result
  adaptiveHalfLives = result;

  return result;
}

/**
 * Reset adaptive cache (useful for testing or after data reset).
 */
export function resetAdaptiveCache(): void {
  adaptiveHalfLives = null;
}
