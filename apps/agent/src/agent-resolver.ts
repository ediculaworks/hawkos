import { db } from '@hawk/db';

const DEFAULT_MODEL = 'qwen/qwen3.6-plus:free';

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
  // Feature flags from agent_settings
  reactMode: 'auto' | 'always' | 'never';
  costTrackingEnabled: boolean;
  historyCompressionEnabled: boolean;
}

/**
 * Resolve which agent template to use for a given session.
 * 1. Check agent_conversations for template_id linked to session
 * 2. If not found, use default agent (first orchestrator or first row)
 */
export async function resolveAgent(sessionId: string, _channel: string): Promise<ResolvedAgent> {
  // Try to find agent linked to this session
  const { data: conversation } = await db
    .from('agent_conversations')
    .select('template_id')
    .eq('session_id', sessionId)
    .maybeSingle();

  let templateId = conversation?.template_id ?? null;

  // If no explicit template, find the default orchestrator
  if (!templateId) {
    const { data: defaultTemplate } = await db
      .from('agent_templates')
      .select('id')
      .eq('agent_tier', 'orchestrator')
      .limit(1)
      .maybeSingle();
    templateId = defaultTemplate?.id ?? null;
  }

  // Load agent template
  const { data: template } = templateId
    ? await db
        .from('agent_templates')
        .select(
          'id, name, personality, identity, knowledge, philosophy, system_prompt, tools_enabled, llm_model, agent_tier, max_tokens, temperature, is_user_facing, sprite_folder',
        )
        .eq('id', templateId)
        .single()
    : { data: null };

  // Load feature flags from agent_settings (shared across all agents)
  const { data: agentSettings } = await db
    .from('agent_settings')
    .select('react_mode, cost_tracking_enabled, history_compression_enabled')
    .limit(1)
    .maybeSingle();

  const featureFlags = {
    reactMode: (agentSettings?.react_mode as ResolvedAgent['reactMode']) ?? 'auto',
    costTrackingEnabled: agentSettings?.cost_tracking_enabled ?? true,
    historyCompressionEnabled: agentSettings?.history_compression_enabled ?? true,
  };

  if (!template) {
    const { data: settings } = await db.from('agent_settings').select('*').limit(1).maybeSingle();
    return {
      id: 'default',
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
      ...featureFlags,
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
    ...featureFlags,
  };
}

const MEMORY_INSTRUCTION = `## Memória — quando salvar
Usa \`save_memory\` proativamente durante a conversa quando o utilizador revelar informação relevante. Não esperas o fim da conversa — salvas no momento em que aprendes.

Tipos e quando usar:
- **profile**: nome, idade, profissão, localização, condição médica, situação familiar
- **preference**: preferências explícitas (comida, horário, formato de resposta, estilo de comunicação)
- **entity**: pessoas importantes, projetos ou locais mencionados com contexto (quem são, relação)
- **event**: decisões importantes, marcos de vida, mudanças significativas
- **case**: quando cometeste um erro — o que aconteceu e como devias ter agido
- **pattern**: processo ou método que o utilizador prefere usar de forma consistente
- **procedure**: regra explícita dada pelo utilizador ("não faças X", "sempre que Y, faz Z", "prefiro que...")

Prioridade máxima: salva **procedure** IMEDIATAMENTE quando o utilizador te corrigir ou der uma regra.
Confiança: usa 1.0 para afirmações diretas, 0.7 para inferências, 0.4 para suposições.`;

/**
 * Build system prompt from agent template fields + context layers.
 * Priority: system_prompt (full override) > identity + personality + knowledge + philosophy
 */
export function buildSystemPrompt(agent: ResolvedAgent, contextSection: string): string {
  const parts: string[] = [];

  // 1. Custom system prompt override (if set) — takes priority over everything
  if (agent.systemPromptParts.customSystemPrompt) {
    parts.push(agent.systemPromptParts.customSystemPrompt);
  } else {
    // 2. Identity block
    if (agent.systemPromptParts.identity) {
      parts.push(`# ${agent.name}\n\n${agent.systemPromptParts.identity}`);
    }

    // 3. Personality injection
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

    // 4. Knowledge
    if (agent.systemPromptParts.knowledge) {
      parts.push(agent.systemPromptParts.knowledge);
    }

    // 5. Philosophy
    if (agent.systemPromptParts.philosophy) {
      parts.push(agent.systemPromptParts.philosophy);
    }
  }

  // 6. Memory instruction — always present so LLM knows when/how to save memories
  parts.push(MEMORY_INSTRUCTION);

  // 7. Context section (L0/L1/L2 + memories + previous session)
  if (contextSection) {
    parts.push(contextSection);
  }

  return parts.filter(Boolean).join('\n\n---\n\n');
}
