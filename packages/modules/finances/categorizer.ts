import { db } from '@hawk/db';

/**
 * C2: Transaction Auto-Categorization (TF-IDF + Naive Bayes)
 *
 * Learns from the user's past categorized transactions to suggest
 * categories for new ones. Uses a simplified Naive Bayes text classifier
 * trained on transaction descriptions.
 *
 * Naive Bayes:
 *   P(category | description) ∝ P(category) × ∏ P(word | category)
 *
 * In plain terms: for each category, count how often each word appears.
 * When a new transaction comes in, find the category whose word
 * frequencies best match the description.
 *
 * With no data: returns null (no suggestion).
 * With data: suggests category with confidence score.
 */

// ── Types ──────────────────────────────────────────────────

export type CategorySuggestion = {
  category_id: string;
  category_name: string;
  confidence: number; // 0-1
  runner_up: { category_id: string; category_name: string; confidence: number } | null;
};

type TrainedModel = {
  // Word counts per category: categoryId → { word → count }
  wordCounts: Map<string, Map<string, number>>;
  // Total words per category
  totalWords: Map<string, number>;
  // Category prior: categoryId → count
  categoryPrior: Map<string, number>;
  // Category names
  categoryNames: Map<string, string>;
  // Vocabulary size
  vocabSize: number;
  // Total documents
  totalDocs: number;
};

// ── Cached Model ───────────────────────────────────────────

let model: TrainedModel | null = null;

// ── Text Processing ────────────────────────────────────────

/**
 * Tokenize a transaction description into normalized words.
 * Removes stopwords, numbers, and short tokens.
 */
function tokenize(text: string): string[] {
  const stopwords = new Set([
    'de',
    'da',
    'do',
    'das',
    'dos',
    'em',
    'no',
    'na',
    'nos',
    'nas',
    'por',
    'para',
    'com',
    'sem',
    'um',
    'uma',
    'uns',
    'umas',
    'o',
    'a',
    'os',
    'as',
    'ao',
    'e',
    'ou',
    'que',
    'pix',
    'ted',
    'doc',
    'ref',
    'pgto',
  ]);

  return (
    text
      .toLowerCase()
      .normalize('NFD')
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: standard Unicode combining marks removal after NFD normalization
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, ' ') // Keep only alphanumeric
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopwords.has(w) && !/^\d+$/.test(w))
  );
}

// ── Training ───────────────────────────────────────────────

/**
 * Train the categorizer from existing categorized transactions.
 * Requires at least 20 categorized transactions to be useful.
 */
export async function trainCategorizer(): Promise<{ categories: number; documents: number }> {
  // Load categorized transactions
  const { data, error } = await db
    .from('finance_transactions')
    .select('description, category_id')
    .not('category_id', 'is', null)
    .not('description', 'is', null)
    .order('date', { ascending: false })
    .limit(2000); // Last 2000 transactions

  if (error || !data || data.length < 20) {
    model = null;
    return { categories: 0, documents: 0 };
  }

  // Load category names
  const categoryIds = [
    ...new Set(data.map((d: Record<string, unknown>) => d.category_id as string)),
  ];
  const { data: categories } = await db
    .from('finance_categories')
    .select('id, name')
    .in('id', categoryIds);

  const categoryNames = new Map<string, string>();
  for (const cat of categories ?? []) {
    categoryNames.set(cat.id as string, cat.name as string);
  }

  // Build word counts
  const wordCounts = new Map<string, Map<string, number>>();
  const totalWords = new Map<string, number>();
  const categoryPrior = new Map<string, number>();
  const vocabulary = new Set<string>();

  for (const tx of data) {
    const catId = tx.category_id as string;
    const description = tx.description as string;
    if (!description) continue;

    const tokens = tokenize(description);
    if (tokens.length === 0) continue;

    // Update category prior
    categoryPrior.set(catId, (categoryPrior.get(catId) ?? 0) + 1);

    // Update word counts
    if (!wordCounts.has(catId)) wordCounts.set(catId, new Map());
    const catWords = wordCounts.get(catId);

    for (const token of tokens) {
      vocabulary.add(token);
      if (catWords) {
        catWords.set(token, (catWords.get(token) ?? 0) + 1);
      }
      totalWords.set(catId, (totalWords.get(catId) ?? 0) + 1);
    }
  }

  model = {
    wordCounts,
    totalWords,
    categoryPrior,
    categoryNames,
    vocabSize: vocabulary.size,
    totalDocs: data.length,
  };

  return { categories: categoryPrior.size, documents: data.length };
}

// ── Prediction ─────────────────────────────────────────────

/**
 * Suggest a category for a transaction description.
 * Returns null if the model isn't trained or confidence is too low.
 *
 * Uses log-space Naive Bayes to avoid floating point underflow:
 *   log P(cat|desc) = log P(cat) + Σ log P(word|cat)
 *
 * Laplace smoothing (add-1) prevents zero probabilities for unseen words.
 */
export function suggestCategory(description: string): CategorySuggestion | null {
  if (!model || model.totalDocs === 0) return null;

  const tokens = tokenize(description);
  if (tokens.length === 0) return null;

  // Compute log-probability for each category
  const scores: Array<{ catId: string; logProb: number }> = [];

  for (const [catId, priorCount] of model.categoryPrior) {
    // Log prior
    let logProb = Math.log(priorCount / model.totalDocs);

    // Log likelihood of each word given category (with Laplace smoothing)
    const catWords = model.wordCounts.get(catId);
    const catTotal = model.totalWords.get(catId) ?? 0;

    for (const token of tokens) {
      const wordCount = catWords?.get(token) ?? 0;
      // Laplace smoothing: (count + 1) / (total + vocabSize)
      const prob = (wordCount + 1) / (catTotal + model.vocabSize);
      logProb += Math.log(prob);
    }

    scores.push({ catId, logProb });
  }

  if (scores.length === 0) return null;

  // Sort by score (highest first)
  scores.sort((a, b) => b.logProb - a.logProb);

  const best = scores[0];
  const runnerUp = scores[1];
  if (!best) return null;

  // Convert log-probabilities to confidence (softmax-like normalization)
  const maxLogProb = best.logProb;
  const expScores = scores.map((s) => Math.exp(s.logProb - maxLogProb));
  const sumExp = expScores.reduce((a, b) => a + b, 0);
  const confidence = (expScores[0] ?? 0) / sumExp;

  // Only suggest if confidence is reasonable
  if (confidence < 0.3) return null;

  const suggestion: CategorySuggestion = {
    category_id: best.catId,
    category_name: model.categoryNames.get(best.catId) ?? 'Desconhecido',
    confidence: Math.round(confidence * 1000) / 1000,
    runner_up: null,
  };

  if (runnerUp && scores.length >= 2) {
    const runnerUpConfidence = (expScores[1] ?? 0) / sumExp;
    if (runnerUpConfidence >= 0.15) {
      suggestion.runner_up = {
        category_id: runnerUp.catId,
        category_name: model.categoryNames.get(runnerUp.catId) ?? 'Desconhecido',
        confidence: Math.round(runnerUpConfidence * 1000) / 1000,
      };
    }
  }

  return suggestion;
}

/**
 * Check if the categorizer is trained and ready.
 */
export function isCategorizerReady(): boolean {
  return model !== null && model.totalDocs >= 20;
}
