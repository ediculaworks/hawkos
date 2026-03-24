import { db } from '@hawk/db';

/**
 * C1: Learned Importance Scorer
 *
 * Instead of the LLM guessing importance (1-10), this module learns
 * what "important" means from actual memory access patterns.
 *
 * Concept: A memory that gets accessed frequently and recently is
 * more important than one that's never retrieved. We train a simple
 * linear model on features that predict access_count.
 *
 * Model: Linear scoring with learned weights
 *   score = w1*has_entity + w2*has_date + w3*word_count_norm +
 *           w4*is_procedure + w5*is_profile + w6*module_boost
 *
 * The weights are learned by correlating features with normalized
 * access_count across all existing memories.
 *
 * With no data: returns a heuristic score based on memory type.
 * With data: weights are calibrated from real access patterns.
 */

// ── Types ──────────────────────────────────────────────────

type ScoringWeights = {
  has_entity: number;
  has_date: number;
  word_count: number;
  is_procedure: number;
  is_profile: number;
  is_preference: number;
  is_event: number;
  module_known: number;
  intercept: number;
};

type FeatureVector = {
  has_entity: number;
  has_date: number;
  word_count: number;
  is_procedure: number;
  is_profile: number;
  is_preference: number;
  is_event: number;
  module_known: number;
};

// ── Default Weights (heuristic, before learning) ───────────

const DEFAULT_WEIGHTS: ScoringWeights = {
  has_entity: 1.0,
  has_date: 0.5,
  word_count: 0.3,
  is_procedure: 2.0, // Procedures are corrections — very important
  is_profile: 1.5, // Profile facts are core identity
  is_preference: 1.0,
  is_event: 0.5,
  module_known: 0.5,
  intercept: 5.0, // Base score of 5
};

let learnedWeights: ScoringWeights | null = null;

// ── Feature Extraction ─────────────────────────────────────

// Patterns that indicate named entities (people, places, projects)
const ENTITY_PATTERNS = [
  /\b[A-Z][a-záéíóúãõç]+(?:\s+[A-Z][a-záéíóúãõç]+)+\b/, // Capitalized multi-word
  /\b(?:dr\.|dra\.|sr\.|sra\.)\s+\w+/i, // Titles
  /\b@\w+\b/, // Mentions
];

// Patterns that indicate dates or temporal references
const DATE_PATTERNS = [
  /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/, // DD/MM or DD/MM/YYYY
  /\d{4}-\d{2}-\d{2}/, // ISO dates
  /\b(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i,
  /\b(?:segunda|terça|quarta|quinta|sexta|sábado|domingo)\b/i,
  /\b(?:ontem|hoje|amanhã|semana passada|mês passado)\b/i,
];

/**
 * Extract features from memory content and metadata.
 */
function extractFeatures(
  content: string,
  memoryType: string,
  module: string | null,
): FeatureVector {
  const words = content.split(/\s+/).length;

  return {
    has_entity: ENTITY_PATTERNS.some((p) => p.test(content)) ? 1 : 0,
    has_date: DATE_PATTERNS.some((p) => p.test(content)) ? 1 : 0,
    word_count: Math.min(words / 50, 1), // Normalize: 50+ words = 1.0
    is_procedure: memoryType === 'procedure' ? 1 : 0,
    is_profile: memoryType === 'profile' ? 1 : 0,
    is_preference: memoryType === 'preference' ? 1 : 0,
    is_event: memoryType === 'event' ? 1 : 0,
    module_known: module ? 1 : 0,
  };
}

/**
 * Compute importance score using current weights (learned or default).
 * Returns a score clamped to 1-10.
 */
export function predictImportance(
  content: string,
  memoryType: string,
  module: string | null,
): number {
  const features = extractFeatures(content, memoryType, module);
  const w = learnedWeights ?? DEFAULT_WEIGHTS;

  const raw =
    w.intercept +
    features.has_entity * w.has_entity +
    features.has_date * w.has_date +
    features.word_count * w.word_count +
    features.is_procedure * w.is_procedure +
    features.is_profile * w.is_profile +
    features.is_preference * w.is_preference +
    features.is_event * w.is_event +
    features.module_known * w.module_known;

  return Math.max(1, Math.min(10, Math.round(raw)));
}

/**
 * Learn importance weights from actual memory access patterns.
 *
 * Algorithm (Ordinary Least Squares approximation):
 * 1. Load all active memories with access_count > 0
 * 2. Normalize access_count to 1-10 scale (target)
 * 3. For each feature, compute correlation with target
 * 4. Use correlations as weight adjustments on top of defaults
 *
 * This is a simplified linear regression that avoids matrix inversion
 * by using feature-target correlations as weight signals.
 */
export async function learnImportanceWeights(): Promise<ScoringWeights> {
  const { data, error } = await db
    .from('agent_memories')
    .select('content, memory_type, module, access_count, importance')
    .eq('status', 'active')
    .gt('access_count', 0);

  if (error || !data || data.length < 10) {
    // Not enough data to learn — keep defaults
    return DEFAULT_WEIGHTS;
  }

  // Normalize access_count to 1-10 scale
  const maxAccess = Math.max(...data.map((d) => d.access_count as number));
  if (maxAccess === 0) return DEFAULT_WEIGHTS;

  const samples = data.map((d) => ({
    features: extractFeatures(
      d.content as string,
      d.memory_type as string,
      d.module as string | null,
    ),
    target: 1 + ((d.access_count as number) / maxAccess) * 9, // Normalize to 1-10
  }));

  // Compute mean of target
  const targetMean = samples.reduce((s, d) => s + d.target, 0) / samples.length;

  // Compute correlation between each feature and target
  const featureKeys = Object.keys(DEFAULT_WEIGHTS).filter(
    (k) => k !== 'intercept',
  ) as (keyof FeatureVector)[];
  const correlations: Record<string, number> = {};

  for (const key of featureKeys) {
    const featureMean = samples.reduce((s, d) => s + d.features[key], 0) / samples.length;

    let cov = 0;
    let varFeature = 0;
    let varTarget = 0;

    for (const sample of samples) {
      const fDiff = sample.features[key] - featureMean;
      const tDiff = sample.target - targetMean;
      cov += fDiff * tDiff;
      varFeature += fDiff * fDiff;
      varTarget += tDiff * tDiff;
    }

    const denom = Math.sqrt(varFeature * varTarget);
    correlations[key] = denom > 0 ? cov / denom : 0;
  }

  // Adjust default weights by correlations
  // Strong positive correlation → boost weight, negative → reduce
  const newWeights: ScoringWeights = { ...DEFAULT_WEIGHTS };
  for (const key of featureKeys) {
    const corr = correlations[key] ?? 0;
    const defaultW = DEFAULT_WEIGHTS[key];
    // Blend: 60% correlation-adjusted + 40% default
    newWeights[key] = 0.6 * (defaultW * (1 + corr)) + 0.4 * defaultW;
  }

  // Adjust intercept to center predictions around target mean
  newWeights.intercept = targetMean - 2; // Slightly below mean to allow features to push up

  learnedWeights = newWeights;
  return newWeights;
}

/**
 * Reset learned weights (for testing).
 */
export function resetLearnedWeights(): void {
  learnedWeights = null;
}
