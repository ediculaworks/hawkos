/**
 * LLM Client Factory
 *
 * - Chat (user-facing): dynamic provider based on tenant chain config
 * - Workers (background automations): Ollama local if available, OpenRouter fallback
 *
 * Supports all OpenAI-compatible providers (Groq, x.AI, NVIDIA, Google AI Studio, etc.)
 * via the provider registry in providers.ts.
 */
import OpenAI from 'openai';
import { type ChainEntry, getProvider, resolveApiKey } from './providers.js';

// ── Per-provider client cache ─────────────────────────────────────────────
const clientCache = new Map<string, OpenAI>();

/**
 * Get or create an OpenAI-compatible client for any provider.
 * Clients are cached by `providerId:apiKeyHash` to avoid creating duplicates.
 */
export function getClientForProvider(providerId: string, apiKey: string): OpenAI {
  const cacheKey = `${providerId}:${apiKey.slice(-8)}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown LLM provider: ${providerId}`);
  }

  const client = new OpenAI({
    baseURL: provider.baseURL,
    apiKey,
    defaultHeaders: provider.defaultHeaders,
  });

  clientCache.set(cacheKey, client);
  return client;
}

/**
 * Resolve the correct client for a chain entry using tenant keys or env fallback.
 */
export function getClientForChainEntry(
  entry: ChainEntry,
  tenantKeys?: Map<string, string>,
): OpenAI | null {
  const apiKey = resolveApiKey(entry.providerId, tenantKeys);
  if (!apiKey) return null;
  return getClientForProvider(entry.providerId, apiKey);
}

// ── Legacy Chat client (OpenRouter global — used when no tenant chain) ────
let _chatClient: OpenAI | null = null;
export function getChatClient(): OpenAI {
  if (!_chatClient) {
    _chatClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || 'not-set',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/hawk-os',
        'X-Title': 'Hawk OS',
      },
    });
  }
  return _chatClient;
}

// ── Worker client (background tasks, prefers Ollama local) ────────────────
let _workerClient: OpenAI | null = null;
export function getWorkerClient(): OpenAI {
  if (!_workerClient) {
    const ollamaUrl = process.env.OLLAMA_BASE_URL;
    if (ollamaUrl) {
      _workerClient = new OpenAI({ baseURL: ollamaUrl, apiKey: 'ollama' });
    } else {
      _workerClient = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY || 'not-set',
      });
    }
  }
  return _workerClient;
}

/** Model name for worker tasks — Ollama model or OpenRouter free model */
export const WORKER_MODEL = process.env.OLLAMA_BASE_URL
  ? (process.env.OLLAMA_WORKER_MODEL ?? 'gemma4:e2b')
  : (process.env.MEMORY_WORKER_MODEL ?? 'nvidia/nemotron-nano-9b-v2:free');

export function isOllamaAvailable(): boolean {
  return !!process.env.OLLAMA_BASE_URL;
}
