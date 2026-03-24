import { db } from '@hawk/db';

/**
 * Health Analytics — Automatic Correlation Discovery
 *
 * B2: Instead of hardcoded thresholds (sleep <6h + mood <6),
 * this module automatically discovers correlations between ANY
 * health variables using Spearman rank correlation.
 *
 * Why Spearman (not Pearson)?
 * - Works on ordinal data (mood 1-10, quality 1-10)
 * - Robust to outliers
 * - Detects monotonic relationships (not just linear)
 *
 * The system discovers patterns like:
 * - "Nos últimos 30 dias, sono > 7h correlaciona com mood +1.5"
 * - "Dias com exercício têm energy 1.2 pontos maior"
 * - "Cannabis correlaciona negativamente com sleep quality (r=-0.4)"
 */

// ── Types ──────────────────────────────────────────────────

export type HealthCorrelation = {
  variable_a: string;
  variable_b: string;
  correlation: number; // Spearman r, -1 to +1
  strength: 'weak' | 'moderate' | 'strong';
  direction: 'positive' | 'negative';
  sample_size: number;
  insight: string; // Human-readable insight in Portuguese
};

export type DailyVector = {
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  exercised: number; // 0 or 1
  workout_min: number | null;
  mood: number | null;
  energy: number | null;
  cannabis_used: number; // 0 or 1
  tobacco_used: number; // 0 or 1;
  substance_cost: number | null;
  weight_kg: number | null;
  calories: number | null;
};

// ── Spearman Rank Correlation ──────────────────────────────

/**
 * Assign ranks to values (handles ties with average rank).
 */
function rankArray(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    // Find ties
    while (j < indexed.length && indexed[j]?.v === indexed[i]?.v) {
      j++;
    }
    // Average rank for tied values
    const avgRank = (i + j + 1) / 2; // +1 because ranks are 1-based
    for (let k = i; k < j; k++) {
      const idx = indexed[k]?.i;
      if (idx !== undefined) ranks[idx] = avgRank;
    }
    i = j;
  }

  return ranks;
}

/**
 * Compute Spearman rank correlation coefficient between two arrays.
 *
 * Formula: r_s = 1 - (6 * sum(d_i^2)) / (n * (n^2 - 1))
 * where d_i = rank(x_i) - rank(y_i)
 *
 * Returns null if insufficient data (< 5 pairs).
 */
function spearmanCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 5) return null;

  const n = x.length;
  const rankX = rankArray(x);
  const rankY = rankArray(y);

  let sumDSq = 0;
  for (let i = 0; i < n; i++) {
    const d = (rankX[i] ?? 0) - (rankY[i] ?? 0);
    sumDSq += d * d;
  }

  const r = 1 - (6 * sumDSq) / (n * (n * n - 1));
  return Math.max(-1, Math.min(1, r)); // Clamp to [-1, 1]
}

// ── Daily Health Vector Assembly ───────────────────────────

/**
 * Assemble daily health vectors from the last N days.
 * Each day becomes a row with all available health variables.
 */
async function getDailyVectors(days = 30): Promise<DailyVector[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().slice(0, 10);

  // Fetch all data sources in parallel
  const [sleepRes, workoutRes, substanceRes, weightRes, nutritionRes, moodRes] = await Promise.all([
    db
      .from('sleep_sessions')
      .select('date, duration_h, quality')
      .gte('date', startStr)
      .order('date'),
    db.from('workout_sessions').select('date, duration_m').gte('date', startStr).order('date'),
    db
      .from('substance_logs')
      .select('logged_at, substance, cost_brl')
      .gte('logged_at', `${startStr}T00:00:00`)
      .order('logged_at'),
    db
      .from('body_measurements')
      .select('measured_at, weight_kg')
      .gte('measured_at', `${startStr}T00:00:00`)
      .order('measured_at'),
    db
      .from('nutrition_logs')
      .select('logged_at, calories')
      .gte('logged_at', `${startStr}T00:00:00`)
      .order('logged_at'),
    db
      .from('health_observations')
      .select('observed_at, code, value_number')
      .in('code', ['mood', 'energy'])
      .gte('observed_at', `${startStr}T00:00:00`)
      .order('observed_at'),
  ]);

  // Build date-indexed maps
  const sleepMap = new Map<string, { hours: number; quality: number }>();
  for (const s of sleepRes.data ?? []) {
    const date = s.date as string;
    sleepMap.set(date, {
      hours: s.duration_h as number,
      quality: s.quality as number,
    });
  }

  const workoutMap = new Map<string, number>();
  for (const w of workoutRes.data ?? []) {
    const date = w.date as string;
    workoutMap.set(date, (workoutMap.get(date) ?? 0) + ((w.duration_m as number) ?? 0));
  }

  const substanceMap = new Map<string, { cannabis: boolean; tobacco: boolean; cost: number }>();
  for (const s of substanceRes.data ?? []) {
    const date = (s.logged_at as string).slice(0, 10);
    const existing = substanceMap.get(date) ?? { cannabis: false, tobacco: false, cost: 0 };
    if (s.substance === 'cannabis') existing.cannabis = true;
    if (s.substance === 'tobacco') existing.tobacco = true;
    existing.cost += (s.cost_brl as number) ?? 0;
    substanceMap.set(date, existing);
  }

  const weightMap = new Map<string, number>();
  for (const w of weightRes.data ?? []) {
    const date = (w.measured_at as string).slice(0, 10);
    weightMap.set(date, w.weight_kg as number);
  }

  const calorieMap = new Map<string, number>();
  for (const n of nutritionRes.data ?? []) {
    const date = (n.logged_at as string).slice(0, 10);
    calorieMap.set(date, (calorieMap.get(date) ?? 0) + ((n.calories as number) ?? 0));
  }

  const moodMap = new Map<string, number>();
  const energyMap = new Map<string, number>();
  for (const obs of moodRes.data ?? []) {
    const date = (obs.observed_at as string).slice(0, 10);
    if (obs.code === 'mood') moodMap.set(date, obs.value_number as number);
    if (obs.code === 'energy') energyMap.set(date, obs.value_number as number);
  }

  // Assemble daily vectors
  const vectors: DailyVector[] = [];
  const today = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);

    const sleep = sleepMap.get(dateStr);
    const substance = substanceMap.get(dateStr);

    vectors.push({
      date: dateStr,
      sleep_hours: sleep?.hours ?? null,
      sleep_quality: sleep?.quality ?? null,
      exercised: workoutMap.has(dateStr) ? 1 : 0,
      workout_min: workoutMap.get(dateStr) ?? null,
      mood: moodMap.get(dateStr) ?? null,
      energy: energyMap.get(dateStr) ?? null,
      cannabis_used: substance?.cannabis ? 1 : 0,
      tobacco_used: substance?.tobacco ? 1 : 0,
      substance_cost: substance?.cost ?? null,
      weight_kg: weightMap.get(dateStr) ?? null,
      calories: calorieMap.get(dateStr) ?? null,
    });
  }

  return vectors;
}

// ── Correlation Discovery ──────────────────────────────────

const VARIABLE_LABELS: Record<string, string> = {
  sleep_hours: 'Horas de sono',
  sleep_quality: 'Qualidade do sono',
  exercised: 'Exercício (sim/não)',
  workout_min: 'Duração do treino',
  mood: 'Humor',
  energy: 'Energia',
  cannabis_used: 'Uso de cannabis',
  tobacco_used: 'Uso de tabaco',
  substance_cost: 'Custo de substâncias',
  weight_kg: 'Peso',
  calories: 'Calorias ingeridas',
};

/**
 * Discover all significant correlations between health variables.
 *
 * Process:
 * 1. Assemble daily vectors for last N days
 * 2. For each pair of variables, compute Spearman correlation
 * 3. Filter to significant correlations (|r| >= 0.3)
 * 4. Generate human-readable insights
 *
 * Returns correlations sorted by absolute strength.
 */
export async function discoverHealthCorrelations(
  days = 30,
  minCorrelation = 0.3,
): Promise<HealthCorrelation[]> {
  const vectors = await getDailyVectors(days);

  if (vectors.length < 7) return []; // Need at least a week of data

  const variables: (keyof DailyVector)[] = [
    'sleep_hours',
    'sleep_quality',
    'exercised',
    'workout_min',
    'mood',
    'energy',
    'cannabis_used',
    'tobacco_used',
    'substance_cost',
    'calories',
  ];

  const correlations: HealthCorrelation[] = [];

  // Test all pairs
  for (let i = 0; i < variables.length; i++) {
    for (let j = i + 1; j < variables.length; j++) {
      const varA = variables[i] as keyof DailyVector;
      const varB = variables[j] as keyof DailyVector;

      // Extract paired non-null values
      const pairs: { a: number; b: number }[] = [];
      for (const v of vectors) {
        const a = v[varA];
        const b = v[varB];
        if (a !== null && b !== null && typeof a === 'number' && typeof b === 'number') {
          pairs.push({ a, b });
        }
      }

      if (pairs.length < 5) continue;

      const r = spearmanCorrelation(
        pairs.map((p) => p.a),
        pairs.map((p) => p.b),
      );

      if (r === null || Math.abs(r) < minCorrelation) continue;

      const absR = Math.abs(r);
      let strength: HealthCorrelation['strength'] = 'weak';
      if (absR >= 0.7) strength = 'strong';
      else if (absR >= 0.5) strength = 'moderate';

      const direction: HealthCorrelation['direction'] = r > 0 ? 'positive' : 'negative';
      const insight = generateInsight(varA, varB, r, strength, pairs.length);

      correlations.push({
        variable_a: varA,
        variable_b: varB,
        correlation: Math.round(r * 1000) / 1000,
        strength,
        direction,
        sample_size: pairs.length,
        insight,
      });
    }
  }

  return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

/**
 * Generate a human-readable insight from a correlation.
 */
function generateInsight(
  varA: string,
  varB: string,
  r: number,
  strength: string,
  n: number,
): string {
  const labelA = VARIABLE_LABELS[varA] ?? varA;
  const labelB = VARIABLE_LABELS[varB] ?? varB;
  const dir = r > 0 ? 'positivamente' : 'negativamente';
  const strengthPt =
    strength === 'strong' ? 'forte' : strength === 'moderate' ? 'moderada' : 'leve';

  return `${labelA} e ${labelB} têm correlação ${strengthPt} ${dir} (r=${r.toFixed(2)}, n=${n} dias)`;
}

/**
 * Format correlations into a human-readable summary for the agent.
 */
export function formatCorrelationsSummary(correlations: HealthCorrelation[]): string {
  if (correlations.length === 0) return '';

  const lines = ['Correlações de saúde descobertas automaticamente:'];

  for (const c of correlations.slice(0, 8)) {
    const arrow = c.direction === 'positive' ? '+' : '-';
    lines.push(`  [${arrow}${c.strength}] ${c.insight}`);
  }

  return lines.join('\n');
}
