/**
 * LLM Provider Registry
 *
 * All supported providers and their models.
 * Every provider uses an OpenAI-compatible API — same SDK, different baseURL.
 * Per-tenant chain config stored in admin.tenant_llm_chain references these IDs.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ProviderModel {
  id: string;
  name: string;
  contextWindow: number;
  costPer1MInput: number;
  costPer1MOutput: number;
  supportsTools: boolean;
  speed: 'fast' | 'medium' | 'slow';
  tiers: ('simple' | 'moderate' | 'complex')[];
}

export interface LLMProvider {
  id: string;
  name: string;
  baseURL: string;
  defaultHeaders?: Record<string, string>;
  models: ProviderModel[];
  envKey?: string;
  /** Whether this provider is a local inference server (e.g. Ollama) */
  isLocal?: boolean;
}

export interface ChainEntry {
  priority: number;
  providerId: string;
  modelId: string;
  tier: 'simple' | 'moderate' | 'complex' | 'all';
  enabled: boolean;
}

// ── Provider Definitions ────────────────────────────────────────────────────

export const PROVIDERS: LLMProvider[] = [
  {
    id: 'groq',
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        contextWindow: 128_000,
        costPer1MInput: 0.059,
        costPer1MOutput: 0.079,
        supportsTools: true,
        speed: 'fast',
        tiers: ['simple', 'moderate', 'complex'],
      },
      {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        contextWindow: 8_192,
        costPer1MInput: 0.02,
        costPer1MOutput: 0.02,
        supportsTools: true,
        speed: 'fast',
        tiers: ['simple', 'moderate'],
      },
      {
        id: 'meta-llama/llama-4-scout-17b-16e-instruct',
        name: 'Llama 4 Scout 17B',
        contextWindow: 131_072,
        costPer1MInput: 0.11,
        costPer1MOutput: 0.34,
        supportsTools: true,
        speed: 'fast',
        tiers: ['simple', 'moderate', 'complex'],
      },
    ],
  },
  {
    id: 'xai',
    name: 'x.AI',
    baseURL: 'https://api.x.ai/v1',
    envKey: 'XAI_API_KEY',
    models: [
      {
        id: 'grok-3-mini',
        name: 'Grok 3 Mini',
        contextWindow: 131_072,
        costPer1MInput: 0.3,
        costPer1MOutput: 0.5,
        supportsTools: true,
        speed: 'fast',
        tiers: ['simple', 'moderate'],
      },
      {
        id: 'grok-3',
        name: 'Grok 3',
        contextWindow: 131_072,
        costPer1MInput: 3.0,
        costPer1MOutput: 15.0,
        supportsTools: true,
        speed: 'medium',
        tiers: ['complex'],
      },
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    envKey: 'NVIDIA_API_KEY',
    models: [
      {
        id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
        name: 'Nemotron Ultra 253B',
        contextWindow: 131_072,
        costPer1MInput: 0.54,
        costPer1MOutput: 0.54,
        supportsTools: true,
        speed: 'medium',
        tiers: ['moderate', 'complex'],
      },
      {
        id: 'meta/llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B',
        contextWindow: 131_072,
        costPer1MInput: 0.0,
        costPer1MOutput: 0.0,
        supportsTools: true,
        speed: 'medium',
        tiers: ['simple', 'moderate', 'complex'],
      },
    ],
  },
  {
    id: 'google_ai',
    name: 'Google AI Studio',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    envKey: 'GOOGLE_AI_API_KEY',
    models: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        contextWindow: 1_048_576,
        costPer1MInput: 0.15,
        costPer1MOutput: 0.6,
        supportsTools: true,
        speed: 'fast',
        tiers: ['simple', 'moderate', 'complex'],
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        contextWindow: 1_048_576,
        costPer1MInput: 0.1,
        costPer1MOutput: 0.4,
        supportsTools: true,
        speed: 'fast',
        tiers: ['simple', 'moderate'],
      },
    ],
  },
  {
    id: 'together',
    name: 'Together AI',
    baseURL: 'https://api.together.xyz/v1',
    envKey: 'TOGETHER_API_KEY',
    models: [
      {
        id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        name: 'Llama 3.3 70B Turbo',
        contextWindow: 131_072,
        costPer1MInput: 0.88,
        costPer1MOutput: 0.88,
        supportsTools: true,
        speed: 'fast',
        tiers: ['simple', 'moderate', 'complex'],
      },
      {
        id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
        name: 'Qwen 2.5 72B Turbo',
        contextWindow: 131_072,
        costPer1MInput: 0.6,
        costPer1MOutput: 0.6,
        supportsTools: true,
        speed: 'fast',
        tiers: ['moderate', 'complex'],
      },
    ],
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    envKey: 'CEREBRAS_API_KEY',
    models: [
      {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B',
        contextWindow: 128_000,
        costPer1MInput: 0.06,
        costPer1MOutput: 0.06,
        supportsTools: true,
        speed: 'fast',
        tiers: ['simple', 'moderate', 'complex'],
      },
      {
        id: 'llama-4-scout-17b-16e',
        name: 'Llama 4 Scout 17B',
        contextWindow: 131_072,
        costPer1MInput: 0.1,
        costPer1MOutput: 0.34,
        supportsTools: true,
        speed: 'fast',
        tiers: ['simple', 'moderate'],
      },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/hawk-os',
      'X-Title': 'Hawk OS',
    },
    models: [
      {
        id: 'nvidia/nemotron-3-super-120b-a12b:free',
        name: 'Nemotron Super 120B (free)',
        contextWindow: 262_144,
        costPer1MInput: 0,
        costPer1MOutput: 0,
        supportsTools: true,
        speed: 'medium',
        tiers: ['simple', 'moderate', 'complex'],
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B (free)',
        contextWindow: 65_536,
        costPer1MInput: 0,
        costPer1MOutput: 0,
        supportsTools: true,
        speed: 'medium',
        tiers: ['simple', 'moderate'],
      },
      {
        id: 'qwen/qwen3.6-plus:free',
        name: 'Qwen 3.6 Plus (free)',
        contextWindow: 1_000_000,
        costPer1MInput: 0,
        costPer1MOutput: 0,
        supportsTools: true,
        speed: 'slow',
        tiers: ['moderate', 'complex'],
      },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    isLocal: true,
    models: [
      {
        id: 'gemma4:e2b',
        name: 'Gemma 4 E2B (local)',
        contextWindow: 128_000,
        costPer1MInput: 0,
        costPer1MOutput: 0,
        supportsTools: true,
        speed: 'slow',
        tiers: ['simple', 'moderate'],
      },
    ],
  },
];

// ── Lookup Helpers ──────────────────────────────────────────────────────────

const providerMap = new Map(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: string): LLMProvider | undefined {
  return providerMap.get(id);
}

export function getProviderModel(providerId: string, modelId: string): ProviderModel | undefined {
  return getProvider(providerId)?.models.find((m) => m.id === modelId);
}

/** All provider IDs */
export function getProviderIds(): string[] {
  return PROVIDERS.map((p) => p.id);
}

/**
 * Resolve the API key for a provider:
 * 1. Per-tenant key from tenant_integrations
 * 2. Global env var fallback
 */
export function resolveApiKey(providerId: string, tenantKeys?: Map<string, string>): string | null {
  const tenantKey = tenantKeys?.get(providerId);
  if (tenantKey) return tenantKey;

  const provider = getProvider(providerId);
  if (!provider) return null;

  if (provider.isLocal) return 'ollama';

  const envKey = provider.envKey ? process.env[provider.envKey] : undefined;
  return envKey || null;
}

/**
 * Default fallback chain used when a tenant has no custom config.
 * Matches the previous hardcoded behaviour (Ollama → OpenRouter free).
 */
export function getDefaultChain(): ChainEntry[] {
  const chain: ChainEntry[] = [];
  let priority = 1;

  if (process.env.OLLAMA_BASE_URL) {
    chain.push({
      priority: priority++,
      providerId: 'ollama',
      modelId: 'gemma4:e2b',
      tier: 'all',
      enabled: true,
    });
  }

  chain.push(
    {
      priority: priority++,
      providerId: 'openrouter',
      modelId: 'nvidia/nemotron-3-super-120b-a12b:free',
      tier: 'all',
      enabled: true,
    },
    {
      priority: priority++,
      providerId: 'openrouter',
      modelId: 'meta-llama/llama-3.3-70b-instruct:free',
      tier: 'all',
      enabled: true,
    },
    {
      priority: priority++,
      providerId: 'openrouter',
      modelId: 'qwen/qwen3.6-plus:free',
      tier: 'all',
      enabled: true,
    },
  );

  return chain;
}
