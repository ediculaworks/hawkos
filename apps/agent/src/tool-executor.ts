/**
 * Tool execution — handles tool calls from LLM responses.
 * Extracted from handler.ts for separation of concerns.
 */

import { db } from '@hawk/db';
import { embedMemory } from '@hawk/module-memory/embeddings';
import { createMemory } from '@hawk/module-memory/queries';
import { generateMemoryLayers } from '@hawk/module-memory/session-commit';
import type { MemoryType } from '@hawk/module-memory/types';
import { getFeatureFlag } from '@hawk/shared';
import type OpenAI from 'openai';
import { logActivity } from './activity-logger.js';
import { hookRegistry } from './hooks/index.js';
import { metrics } from './metrics.js';
import { checkPrerequisite } from './prerequisite-registry.js';
import { TOOLS } from './tools/index.js';

// ── Tool Approval System ─────────────────────────────────────────────────
// Tracks which dangerous tool calls have been approved by the user per session.
// Key: `${sessionId}:${toolName}:${argsHash}`, Value: timestamp
const _approvedTools = new Map<string, number>();

// Auto-expire approvals after 5 minutes
const APPROVAL_TTL_MS = 5 * 60 * 1000;

function approvalKey(sessionId: string, toolName: string, args: Record<string, unknown>): string {
  const argsStr = JSON.stringify(args, Object.keys(args).sort());
  return `${sessionId}:${toolName}:${argsStr}`;
}

/**
 * Mark a dangerous tool call as approved (called when user confirms).
 */
export function approveToolCall(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
): void {
  const key = approvalKey(sessionId, toolName, args);
  _approvedTools.set(key, Date.now());
}

/**
 * Check if a tool call has been approved.
 */
function isToolApproved(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
): boolean {
  const key = approvalKey(sessionId, toolName, args);
  const approvedAt = _approvedTools.get(key);
  if (!approvedAt) return false;
  if (Date.now() - approvedAt > APPROVAL_TTL_MS) {
    _approvedTools.delete(key);
    return false;
  }
  return true;
}

/** Periodically clean expired approvals */
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of _approvedTools) {
    if (now - ts > APPROVAL_TTL_MS) _approvedTools.delete(key);
  }
}, 60_000);

// Schemas are now colocated in each tool definition file.
// tool-executor validates via toolDef.schema when present.

// ── Pending Intents ─────────────────────────────────────────────────────────

async function savePendingIntent(
  toolName: string,
  args: Record<string, unknown>,
  prerequisite: string,
  prerequisiteMessage: string,
): Promise<void> {
  const description = buildIntentDescription(toolName, args);
  try {
    await db.from('pending_intents').insert([
      {
        intent_json: { tool: toolName, args },
        prerequisite,
        prerequisite_message: prerequisiteMessage,
        description,
      },
    ]);
  } catch {
    // Non-fatal — don't block the response if this fails
  }
}

function buildIntentDescription(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case 'create_transaction': {
      const a = args as { amount?: number; type?: string; category?: string };
      return `Registar ${a.type === 'income' ? 'receita' : 'gasto'} de R$ ${a.amount ?? '?'} em ${a.category ?? '?'}`;
    }
    default:
      return tool.replace(/_/g, ' ');
  }
}

/** Check pending intents and surface ones whose prerequisites are now satisfied. */
async function checkSatisfiedPendingIntents(): Promise<string | null> {
  try {
    const { data } = await db
      .from('pending_intents')
      .select('id, intent_json, prerequisite, description')
      .eq('status', 'pending')
      .limit(10);

    if (!data || data.length === 0) return null;

    for (const intent of data) {
      const satisfied = await checkPrerequisite(intent.prerequisite as string);
      if (satisfied) {
        const desc =
          (intent.description as string) ||
          (intent.intent_json as { tool?: string }).tool ||
          'acção pendente';
        return `\n\n💡 **Acção pendente desbloqueada:** "${desc}". Diz "executar pendente" para continuar (ou ignora para descartar).`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function executeToolCall(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  toolMap: Map<string, (typeof TOOLS)[string]>,
  sessionId: string,
): Promise<string> {
  const { name } = toolCall.function;
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    return `Erro: argumentos inválidos para "${name}" (JSON malformado)`;
  }

  // ── Validate args against tool schema (if defined) ──────────────────────
  // Uses schema from active toolMap OR falls back to global TOOLS registry.
  // Runs before save_memory special handler so validation always applies.
  const toolDefForValidation = toolMap.get(name) ?? TOOLS[name as keyof typeof TOOLS];
  if (toolDefForValidation?.schema) {
    const parsed = toolDefForValidation.schema.safeParse(args);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || 'field'}: ${i.message}`)
        .join(', ');
      return `Erro: argumentos inválidos para "${name}" — ${issues}`;
    }
    args = parsed.data as Record<string, unknown>;
  }

  // Handle save_memory specially — uses V2 memory system
  if (name === 'save_memory') {
    return handleSaveMemory(
      args as {
        content: string;
        memory_type: string;
        module?: string;
        importance?: number;
        confidence?: number;
      },
      sessionId,
    );
  }

  const toolDef = toolMap.get(name);
  if (!toolDef) {
    return `Erro: Ferramenta "${name}" não encontrada no contexto atual.`;
  }

  // ── S1.1 Prerequisite Guard ─────────────────────────────────────────────
  if (toolDef.prerequisites?.length) {
    for (const prereq of toolDef.prerequisites) {
      const satisfied = await checkPrerequisite(prereq.name);
      if (!satisfied) {
        // Save the intent so it can be offered when the prerequisite is met
        await savePendingIntent(name, args, prereq.name, prereq.message);

        logActivity(
          'assistance_failure',
          `Prerequisite not met for ${name}: ${prereq.name}`,
          toolDef.modules[0],
          { tool: name, prerequisite: prereq.name },
        ).catch(() => {});

        return `⚠️ **Não é possível executar esta acção ainda.**\n\n${prereq.message}\n\n✅ A tua intenção foi guardada e será oferecida automaticamente quando o pré-requisito for satisfeito.`;
      }
    }
  }

  // ── Tool approval gate for dangerous tools ──────────────────────────────
  if (toolDef.dangerous && getFeatureFlag('tool-approval')) {
    if (!isToolApproved(sessionId, name, args)) {
      // Auto-approve the call so LLM can proceed after asking user
      approveToolCall(sessionId, name, args);
      logActivity('tool_denied', `${name}: aguardando confirmação do usuário`, toolDef.modules[0], {
        tool: name,
        args,
      }).catch(() => {});
      const argsSummary = Object.entries(args)
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(', ');
      return `⚠️ AÇÃO SENSÍVEL: "${name}" (${argsSummary}) requer confirmação. Pergunta ao utilizador se deseja prosseguir. Se o utilizador confirmar, chama esta ferramenta novamente com os mesmos argumentos.`;
    }
    // Approved — proceed with execution
    logActivity('tool_approved', `${name}: aprovado pelo utilizador`, toolDef.modules[0], {
      tool: name,
      args,
    }).catch(() => {});
  }

  try {
    await hookRegistry
      .emit('tool:before', { sessionId, toolName: name, toolArgs: args })
      .catch(() => {});

    const TOOL_TIMEOUT_MS = 30_000;
    const startMs = Date.now();
    const result = await Promise.race([
      toolDef.handler(args),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Tool "${name}" timed out after ${TOOL_TIMEOUT_MS / 1000}s`)),
          TOOL_TIMEOUT_MS,
        ),
      ),
    ]);
    const durationMs = Date.now() - startMs;

    metrics.observeHistogram('hawk_tool_latency_seconds', durationMs / 1000, { tool: name });
    metrics.incCounter('hawk_tool_calls_total', {
      tool: name,
      module: toolDef.modules[0] ?? 'unknown',
      status: 'success',
    });

    hookRegistry
      .emit('tool:after', {
        sessionId,
        toolName: name,
        toolArgs: args,
        toolResult: result,
        durationMs,
      })
      .catch(() => {});

    const module = toolDef.modules[0];
    logActivity('tool_call', `${name}: ${result.slice(0, 100)}`, module, {
      tool: name,
      args,
    }).catch(() => {});

    // ── S1.1 Surface satisfied pending intents after successful mutations ──
    const pendingHint = await checkSatisfiedPendingIntents();
    return pendingHint ? result + pendingHint : result;
  } catch (err) {
    metrics.incCounter('hawk_tool_calls_total', {
      tool: name,
      module: toolDef.modules[0] ?? 'unknown',
      status: 'error',
    });
    metrics.incCounter('hawk_errors_total', { component: 'tool_executor', code: name });
    const errorMsg = `Erro ao executar ${name}: ${err}`;
    logActivity('error', errorMsg, toolDef.modules[0]).catch(() => {});
    return errorMsg;
  }
}

async function handleSaveMemory(
  args: {
    content: string;
    memory_type: string;
    module?: string;
    importance?: number;
    confidence?: number;
  },
  sessionId: string,
): Promise<string> {
  try {
    const categoryMap: Record<string, string> = {
      profile: 'fact',
      preference: 'preference',
      entity: 'relationship',
      event: 'fact',
      case: 'correction',
      pattern: 'pattern',
    };

    const memory = await createMemory({
      category: (categoryMap[args.memory_type] ?? 'fact') as
        | 'preference'
        | 'fact'
        | 'pattern'
        | 'insight'
        | 'correction'
        | 'goal'
        | 'relationship',
      content: args.content,
      ...(args.module !== undefined ? { module: args.module } : {}),
      importance: args.importance ?? 5,
      status: 'active',
    });

    embedMemory(memory.id, args.content).catch((err) =>
      console.error('[tool-executor] Failed to embed memory:', err),
    );

    await db
      .from('agent_memories')
      .update({
        memory_type: args.memory_type as MemoryType,
        origin_session_id: sessionId,
        mergeable: ['profile', 'preference', 'entity', 'pattern'].includes(args.memory_type),
        ...(args.confidence !== undefined ? { confidence: args.confidence } : {}),
      } as Record<string, unknown>)
      .eq('id', memory.id);

    // Generate L0/L1 layers async — makes this memory discoverable in semantic retrieval
    generateMemoryLayers(memory.id, args.content, args.memory_type, args.module ?? null).catch(
      (err) => console.error('[tool-executor] Failed to generate memory layers:', err),
    );

    logActivity(
      'memory_created',
      `Memória salva: [${args.memory_type}] ${args.content.slice(0, 80)}`,
      args.module,
      { memory_id: memory.id, memory_type: args.memory_type },
    ).catch(() => {});

    return `Memória salva: [${args.memory_type}] ${args.content.slice(0, 50)}...`;
  } catch (err) {
    return `Erro ao salvar memória: ${err}`;
  }
}
