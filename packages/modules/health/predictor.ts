import { db } from '@hawk/db';

/**
 * C3: Mood/Energy Predictor (Multiple Linear Regression)
 *
 * Predicts today's mood and energy based on yesterday's data:
 * sleep, exercise, substance use, and day of week.
 *
 * Model: y = w0 + w1*sleep_hours + w2*sleep_quality + w3*exercised +
 *             w4*cannabis + w5*tobacco + w6*is_weekend
 *
 * Training: Uses Ordinary Least Squares (OLS) via normal equations,
 * simplified to avoid matrix inversion by using feature-by-feature
 * gradient updates.
 *
 * With < 14 days of data: returns null (insufficient data).
 * With 14+ days: returns prediction with confidence interval.
 */

// ── Types ──────────────────────────────────────────────────

export type MoodPrediction = {
  predicted_mood: number; // 1-10
  predicted_energy: number; // 1-10
  confidence: 'low' | 'medium' | 'high';
  key_factors: string[]; // Human-readable factors
  sample_size: number;
};

type DayData = {
  sleep_hours: number;
  sleep_quality: number;
  exercised: number; // 0 or 1
  cannabis: number; // 0 or 1
  tobacco: number; // 0 or 1
  is_weekend: number; // 0 or 1
  mood: number;
  energy: number;
};

type LinearModel = {
  weights: number[]; // [intercept, w1, w2, w3, w4, w5, w6]
  r_squared: number;
  feature_names: string[];
};

// ── Model Cache ────────────────────────────────────────────

let moodModel: LinearModel | null = null;
let energyModel: LinearModel | null = null;

// ── Data Assembly ──────────────────────────────────────────

/**
 * Assemble paired day data: for each day with mood/energy,
 * get the PREVIOUS day's sleep/exercise/substance data.
 * This is because yesterday's behaviors predict today's mood.
 */
async function assembleTrainingData(days = 90): Promise<DayData[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().slice(0, 10);

  const [sleepRes, workoutRes, substanceRes, moodRes] = await Promise.all([
    db.from('sleep_sessions').select('date, duration_h, quality').gte('date', startStr),
    db.from('workout_sessions').select('date').gte('date', startStr),
    db
      .from('substance_logs')
      .select('logged_at, substance')
      .gte('logged_at', `${startStr}T00:00:00`),
    db
      .from('health_observations')
      .select('observed_at, code, value_number')
      .in('code', ['mood', 'energy'])
      .gte('observed_at', `${startStr}T00:00:00`),
  ]);

  // Build date-indexed maps
  const sleepMap = new Map<string, { hours: number; quality: number }>();
  for (const s of sleepRes.data ?? []) {
    sleepMap.set(s.date as string, {
      hours: s.duration_h as number,
      quality: s.quality as number,
    });
  }

  const workoutDates = new Set<string>();
  for (const w of workoutRes.data ?? []) {
    workoutDates.add(w.date as string);
  }

  const substanceDates = new Map<string, { cannabis: boolean; tobacco: boolean }>();
  for (const s of substanceRes.data ?? []) {
    const date = (s.logged_at as string).slice(0, 10);
    const existing = substanceDates.get(date) ?? { cannabis: false, tobacco: false };
    if (s.substance === 'cannabis') existing.cannabis = true;
    if (s.substance === 'tobacco') existing.tobacco = true;
    substanceDates.set(date, existing);
  }

  const moodMap = new Map<string, number>();
  const energyMap = new Map<string, number>();
  for (const obs of moodRes.data ?? []) {
    const date = (obs.observed_at as string).slice(0, 10);
    if (obs.code === 'mood' && obs.value_number) moodMap.set(date, obs.value_number as number);
    if (obs.code === 'energy' && obs.value_number) energyMap.set(date, obs.value_number as number);
  }

  // Assemble paired data: mood today ↔ yesterday's features
  const result: DayData[] = [];
  const today = new Date();

  for (let d = 0; d < days - 1; d++) {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() - d);
    const targetStr = targetDate.toISOString().slice(0, 10);

    const prevDate = new Date(targetDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevStr = prevDate.toISOString().slice(0, 10);

    const mood = moodMap.get(targetStr);
    const energy = energyMap.get(targetStr);
    if (mood === undefined && energy === undefined) continue;

    const sleep = sleepMap.get(prevStr);
    const substances = substanceDates.get(prevStr);
    const dayOfWeek = prevDate.getDay();

    result.push({
      sleep_hours: sleep?.hours ?? 7, // Default if missing
      sleep_quality: sleep?.quality ?? 5,
      exercised: workoutDates.has(prevStr) ? 1 : 0,
      cannabis: substances?.cannabis ? 1 : 0,
      tobacco: substances?.tobacco ? 1 : 0,
      is_weekend: dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0,
      mood: mood ?? 5,
      energy: energy ?? 5,
    });
  }

  return result;
}

// ── Linear Regression ──────────────────────────────────────

/**
 * Train a simple linear regression using gradient descent.
 * Fast, no matrix operations needed.
 */
function trainLinearModel(data: DayData[], target: 'mood' | 'energy'): LinearModel | null {
  if (data.length < 14) return null;

  const featureNames = [
    'intercept',
    'sleep_hours',
    'sleep_quality',
    'exercised',
    'cannabis',
    'tobacco',
    'is_weekend',
  ];

  // Extract features and targets
  const X = data.map((d) => [
    1,
    d.sleep_hours,
    d.sleep_quality,
    d.exercised,
    d.cannabis,
    d.tobacco,
    d.is_weekend,
  ]);
  const y = data.map((d) => d[target]);

  // Initialize weights
  const weights = new Array(7).fill(0);
  weights[0] = y.reduce((a, b) => a + b, 0) / y.length; // Intercept = mean

  // Gradient descent (100 iterations, learning rate 0.001)
  const lr = 0.001;
  const n = X.length;

  for (let iter = 0; iter < 100; iter++) {
    const gradients = new Array(7).fill(0);

    for (let i = 0; i < n; i++) {
      const xi = X[i];
      if (!xi) continue;
      let prediction = 0;
      for (let j = 0; j < 7; j++) {
        prediction += (weights[j] ?? 0) * (xi[j] ?? 0);
      }
      const error = prediction - (y[i] ?? 0);
      for (let j = 0; j < 7; j++) {
        gradients[j] = (gradients[j] ?? 0) + error * (xi[j] ?? 0);
      }
    }

    // Update weights
    for (let j = 0; j < 7; j++) {
      weights[j] = (weights[j] ?? 0) - lr * ((gradients[j] ?? 0) / n);
    }
  }

  // Compute R² (coefficient of determination)
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const xi = X[i];
    if (!xi) continue;
    let prediction = 0;
    for (let j = 0; j < 7; j++) {
      prediction += (weights[j] ?? 0) * (xi[j] ?? 0);
    }
    ssRes += ((y[i] ?? 0) - prediction) ** 2;
    ssTot += ((y[i] ?? 0) - yMean) ** 2;
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { weights, r_squared: Math.max(0, rSquared), feature_names: featureNames };
}

// ── Public API ─────────────────────────────────────────────

/**
 * Train mood and energy prediction models from historical data.
 * Should be called weekly or when data significantly changes.
 */
export async function trainPredictionModels(): Promise<{
  mood_r2: number | null;
  energy_r2: number | null;
  sample_size: number;
}> {
  const data = await assembleTrainingData(90);

  if (data.length < 14) {
    moodModel = null;
    energyModel = null;
    return { mood_r2: null, energy_r2: null, sample_size: data.length };
  }

  moodModel = trainLinearModel(data, 'mood');
  energyModel = trainLinearModel(data, 'energy');

  return {
    mood_r2: moodModel?.r_squared ?? null,
    energy_r2: energyModel?.r_squared ?? null,
    sample_size: data.length,
  };
}

/**
 * Predict today's mood and energy based on yesterday's data.
 * Returns null if models aren't trained.
 */
export async function predictMoodEnergy(): Promise<MoodPrediction | null> {
  if (!moodModel && !energyModel) {
    // Try to train first
    await trainPredictionModels();
  }

  if (!moodModel && !energyModel) return null;

  // Get yesterday's data
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [sleepRes, workoutRes, substanceRes] = await Promise.all([
    db.from('sleep_sessions').select('duration_h, quality').eq('date', yesterdayStr).maybeSingle(),
    db.from('workout_sessions').select('id').eq('date', yesterdayStr).limit(1),
    db
      .from('substance_logs')
      .select('substance')
      .gte('logged_at', `${yesterdayStr}T00:00:00`)
      .lt(
        'logged_at',
        `${yesterdayStr.replace(/\d{2}$/, (d) => String(Number(d) + 1).padStart(2, '0'))}T00:00:00`,
      ),
  ]);

  const dayOfWeek = yesterday.getDay();
  const features = [
    1, // intercept
    (sleepRes.data?.duration_h as number) ?? 7,
    (sleepRes.data?.quality as number) ?? 5,
    workoutRes.data && workoutRes.data.length > 0 ? 1 : 0,
    (substanceRes.data ?? []).some((s) => s.substance === 'cannabis') ? 1 : 0,
    (substanceRes.data ?? []).some((s) => s.substance === 'tobacco') ? 1 : 0,
    dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0,
  ];

  // Predict
  let predictedMood = 5;
  let predictedEnergy = 5;

  if (moodModel) {
    predictedMood = 0;
    for (let i = 0; i < 7; i++) {
      predictedMood += (moodModel.weights[i] ?? 0) * (features[i] ?? 0);
    }
    predictedMood = Math.max(1, Math.min(10, Math.round(predictedMood * 10) / 10));
  }

  if (energyModel) {
    predictedEnergy = 0;
    for (let i = 0; i < 7; i++) {
      predictedEnergy += (energyModel.weights[i] ?? 0) * (features[i] ?? 0);
    }
    predictedEnergy = Math.max(1, Math.min(10, Math.round(predictedEnergy * 10) / 10));
  }

  // Identify key factors
  const keyFactors: string[] = [];
  const sleepH = features[1] ?? 7;
  const sleepQ = features[2] ?? 5;

  if (sleepH < 6) keyFactors.push(`Sono curto ontem (${sleepH}h)`);
  else if (sleepH >= 8) keyFactors.push(`Sono longo ontem (${sleepH}h)`);

  if (sleepQ <= 4) keyFactors.push(`Qualidade do sono baixa (${sleepQ}/10)`);
  else if (sleepQ >= 8) keyFactors.push(`Qualidade do sono alta (${sleepQ}/10)`);

  if (features[3] === 1) keyFactors.push('Exercitou ontem');
  if (features[4] === 1) keyFactors.push('Cannabis ontem');
  if (features[5] === 1) keyFactors.push('Tabaco ontem');
  if (features[6] === 1) keyFactors.push('Fim de semana');

  // Confidence based on R² and sample size
  const avgR2 = ((moodModel?.r_squared ?? 0) + (energyModel?.r_squared ?? 0)) / 2;
  let confidence: MoodPrediction['confidence'] = 'low';
  if (avgR2 >= 0.4) confidence = 'high';
  else if (avgR2 >= 0.2) confidence = 'medium';

  return {
    predicted_mood: predictedMood,
    predicted_energy: predictedEnergy,
    confidence,
    key_factors: keyFactors,
    sample_size: (moodModel?.r_squared ?? 0) > 0 ? features.length : 0,
  };
}

/**
 * Format prediction into a human-readable string.
 */
export function formatPrediction(prediction: MoodPrediction): string {
  const factors =
    prediction.key_factors.length > 0 ? `\nFatores: ${prediction.key_factors.join(', ')}` : '';

  return `Previsão de hoje: mood ${prediction.predicted_mood}/10, energia ${prediction.predicted_energy}/10 (conf: ${prediction.confidence})${factors}`;
}
