import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '@hawk/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_CONTEXT_PATH = join(__dirname, '../../groups/main/CLAUDE.md');
const STANDING_ORDERS_PATH = join(__dirname, '../../workspace/STANDING_ORDERS.md');

const HAWK_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

export interface ResolvedAgent {
  id: string;
  name: string;
  model: string;
  maxTokens: number;
  temperature: number;
  tier: 'orchestrator' | 'specialist' | 'worker';
  systemPromptParts: {
    identity: string | null;
    knowledge: string | null;
    philosophy: string | null;
    customSystemPrompt: string | null;
    personality: { traits: string[]; tone: string; phrases: string[] };
  };
  toolsEnabled: string[];
  isUserFacing: boolean;
  spriteFolder: string | null;
}

// Cache for Hawk's file-based system prompt and standing orders
let hawkSystemPromptCache: string | null = null;
let standingOrdersCache: string | null = null;

function loadHawkSystemPrompt(): string {
  if (hawkSystemPromptCache) return hawkSystemPromptCache;
  try {
    hawkSystemPromptCache = readFileSync(AGENT_CONTEXT_PATH, 'utf-8');
    return hawkSystemPromptCache;
  } catch {
    return 'Você é o Hawk, um agente pessoal de gerenciamento de vida.';
  }
}

function loadStandingOrders(): string | null {
  if (standingOrdersCache !== null) return standingOrdersCache || null;
  try {
    standingOrdersCache = readFileSync(STANDING_ORDERS_PATH, 'utf-8');
    return standingOrdersCache;
  } catch {
    standingOrdersCache = '';
    return null;
  }
}

/**
 * Resolve which agent template to use for a given session.
 * 1. Check agent_conversations for template_id linked to session
 * 2. If not found, use default agent (Hawk)
 */
export async function resolveAgent(sessionId: string, _channel: string): Promise<ResolvedAgent> {
  // Try to find agent linked to this session
  const { data: conversation } = await db
    .from('agent_conversations')
    .select('template_id')
    .eq('session_id', sessionId)
    .maybeSingle();

  const templateId = conversation?.template_id ?? HAWK_ID;

  // Load agent template
  const { data: template } = await db
    .from('agent_templates')
    .select(
      'id, name, personality, identity, knowledge, philosophy, system_prompt, tools_enabled, llm_model, agent_tier, max_tokens, temperature, is_user_facing, sprite_folder',
    )
    .eq('id', templateId)
    .single();

  if (!template) {
    const { data: settings } = await db.from('agent_settings').select('*').limit(1).maybeSingle();
    return {
      id: HAWK_ID,
      name: settings?.agent_name ?? 'Hawk',
      model: settings?.llm_model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
      maxTokens: settings?.max_tokens ?? 4096,
      temperature: Number(settings?.temperature ?? 0.7),
      tier: 'orchestrator',
      systemPromptParts: {
        identity: null,
        knowledge: null,
        philosophy: null,
        customSystemPrompt: null,
        personality: { traits: [], tone: '', phrases: [] },
      },
      toolsEnabled: [],
      isUserFacing: true,
      spriteFolder: settings?.tenant_name?.toLowerCase().replace(/\s+/g, '-') ?? 'hawk',
    };
  }

  const personality =
    (template.personality as { traits?: string[]; tone?: string; phrases?: string[] }) ?? {};

  return {
    id: template.id,
    name: template.name,
    model: template.llm_model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    maxTokens: template.max_tokens ?? 4096,
    temperature: Number(template.temperature ?? 0.7),
    tier: (template.agent_tier as ResolvedAgent['tier']) ?? 'specialist',
    systemPromptParts: {
      identity: template.identity ?? null,
      knowledge: template.knowledge ?? null,
      philosophy: template.philosophy ?? null,
      customSystemPrompt: template.system_prompt ?? null,
      personality: {
        traits: personality.traits ?? [],
        tone: personality.tone ?? '',
        phrases: personality.phrases ?? [],
      },
    },
    toolsEnabled: (template.tools_enabled as string[]) ?? [],
    isUserFacing: template.is_user_facing ?? true,
    spriteFolder: template.sprite_folder ?? null,
  };
}

/**
 * Build system prompt from agent template fields + context layers.
 * Hawk uses CLAUDE.md + context. Specialists use identity/knowledge/philosophy + context.
 */
export function buildSystemPrompt(agent: ResolvedAgent, contextSection: string): string {
  const parts: string[] = [];

  // 1. Custom system prompt override (if set)
  if (agent.systemPromptParts.customSystemPrompt) {
    parts.push(agent.systemPromptParts.customSystemPrompt);
  } else if (agent.id === HAWK_ID) {
    // Hawk uses file-based system prompt
    parts.push(loadHawkSystemPrompt());
  } else if (agent.systemPromptParts.identity) {
    // Specialists use identity block
    parts.push(`# ${agent.name}\n\n${agent.systemPromptParts.identity}`);
  }

  // 2. Personality injection
  const { traits, tone, phrases } = agent.systemPromptParts.personality;
  if (traits.length > 0 || tone) {
    const personalityLines: string[] = ['## Tom e personalidade'];
    if (traits.length > 0) personalityLines.push(`- Traços: ${traits.join(', ')}`);
    if (tone) personalityLines.push(`- Tom: ${tone}`);
    if (phrases.length > 0) {
      personalityLines.push(`- Frases típicas: ${phrases.map((p) => `"${p}"`).join(', ')}`);
    }
    parts.push(personalityLines.join('\n'));
  }

  // 3. Knowledge
  if (agent.systemPromptParts.knowledge) {
    parts.push(agent.systemPromptParts.knowledge);
  }

  // 4. Philosophy
  if (agent.systemPromptParts.philosophy) {
    parts.push(agent.systemPromptParts.philosophy);
  }

  // 5. Standing orders (loaded from workspace/STANDING_ORDERS.md)
  const standingOrders = loadStandingOrders();
  if (standingOrders) {
    parts.push(standingOrders);
  }

  // 6. Context section (L0/L1/L2 + memories + previous session)
  if (contextSection) {
    parts.push(contextSection);
  }

  return parts.filter(Boolean).join('\n\n---\n\n');
}
