import { db } from '@hawk/db';
import OpenAI from 'openai';

const DEFAULT_MODEL = process.env.OLLAMA_BASE_URL ? 'gemma4:e2b' : 'qwen/qwen3.6-plus:free';

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  // Prefer Ollama local when available, else OpenRouter
  const ollamaUrl = process.env.OLLAMA_BASE_URL;
  if (ollamaUrl) {
    _client = new OpenAI({ baseURL: ollamaUrl, apiKey: 'ollama' });
  } else {
    _client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || 'not-set',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/hawk-os',
        'X-Title': 'Hawk OS',
      },
    });
  }
  return _client;
}

// Cache loaded templates to avoid repeated DB queries within same process
const templateCache = new Map<
  string,
  { model: string; identity: string; maxTokens: number; temperature: number }
>();

async function loadTemplate(agentId: string) {
  const cached = templateCache.get(agentId);
  if (cached) return cached;

  const { data } = await db
    .from('agent_templates')
    .select('llm_model, identity, max_tokens, temperature')
    .eq('id', agentId)
    .single();

  if (!data) return null;

  const result = {
    model: data.llm_model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    identity: data.identity ?? '',
    maxTokens: data.max_tokens ?? 2048,
    temperature: Number(data.temperature ?? 0.3),
  };

  templateCache.set(agentId, result);
  return result;
}

/**
 * Run a sub-agent call: direct LLM invocation with the target agent's
 * model and system prompt. No tools, no memory, no context assembly.
 *
 * Used by:
 * - call_agent tool (Hawk consulting a specialist)
 * - session-commit.ts (Memory Extractor worker)
 * - deduplicator.ts (Dedup Judge worker)
 * - automations (Insight Synthesizer worker)
 */
export async function runSubAgent(params: {
  agentId: string;
  query: string;
  context?: string;
  maxTokens?: number;
}): Promise<string> {
  const template = await loadTemplate(params.agentId);
  if (!template) {
    throw new Error(`Agent template not found: ${params.agentId}`);
  }

  const systemPrompt = params.context
    ? `${template.identity}\n\n---\n\nContexto adicional:\n${params.context}`
    : template.identity;

  const response = await getClient().chat.completions.create({
    model: template.model,
    max_tokens: params.maxTokens ?? template.maxTokens,
    temperature: template.temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: params.query },
    ],
  });

  return response.choices[0]?.message.content ?? '';
}

/** Well-known agent IDs for workers */
export const WORKER_IDS = {
  MEMORY_EXTRACTOR: '00000000-0000-0000-0000-000000000020',
  TITLE_GENERATOR: '00000000-0000-0000-0000-000000000021',
  INSIGHT_SYNTHESIZER: '00000000-0000-0000-0000-000000000022',
  DEDUP_JUDGE: '00000000-0000-0000-0000-000000000023',
} as const;
