/**
 * LLM Client Factory
 *
 * - Chat (user-facing): OpenRouter with configured model
 * - Workers (background automations): Ollama local if available, OpenRouter fallback
 *
 * The OLLAMA_BASE_URL env var switches worker tasks to local Qwen 2.5 3B,
 * saving 100% of OpenRouter tokens for background operations.
 */
import OpenAI from 'openai';

// ── Chat client (user-facing, OpenRouter) ─────────────────────────────────
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
  ? 'qwen2.5:3b'
  : (process.env.MEMORY_WORKER_MODEL ?? 'nvidia/nemotron-nano-9b-v2:free');

export function isOllamaAvailable(): boolean {
  return !!process.env.OLLAMA_BASE_URL;
}
