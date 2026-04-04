/**
 * Tool execution — handles tool calls from LLM responses.
 * Extracted from handler.ts for separation of concerns.
 */

import { db } from '@hawk/db';
import { embedMemory } from '@hawk/module-memory/embeddings';
import { createMemory } from '@hawk/module-memory/queries';
import type { MemoryType } from '@hawk/module-memory/types';
import { getFeatureFlag } from '@hawk/shared';
import type OpenAI from 'openai';
import { z } from 'zod';
import { logActivity } from './activity-logger.js';
import { hookRegistry } from './hooks/index.js';
import type { TOOLS } from './tools/index.js';

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

// ── Tool arg validation schemas ───────────────────────────────────────────
const saveMemorySchema = z.object({
  content: z.string().min(1).max(4000),
  memory_type: z.enum(['profile', 'preference', 'entity', 'event', 'case', 'pattern']),
  module: z.string().optional(),
  importance: z.number().int().min(1).max(10).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const createTransactionSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['expense', 'income']),
  category: z.string().min(1),
  description: z.string().optional(),
  account: z.string().optional(),
});

const logSleepSchema = z.object({
  duration_h: z.number().min(0).max(24),
  quality: z.number().int().min(1).max(10).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const logWorkoutSchema = z.object({
  exercise_name: z.string().min(1),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  weight_kg: z.number().min(0).optional(),
  duration_min: z.number().positive().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const createPersonSchema = z.object({
  name: z.string().min(1).max(200),
  relationship_type: z.string().optional(),
  notes: z.string().optional(),
});

const TOOL_SCHEMAS: Record<string, z.ZodTypeAny> = {
  save_memory: saveMemorySchema,
  create_transaction: createTransactionSchema,
  log_sleep: logSleepSchema,
  log_workout: logWorkoutSchema,
  create_person: createPersonSchema,
};

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

  // Validate args against schema if one exists for this tool
  const schema = TOOL_SCHEMAS[name];
  if (schema) {
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
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

    return result;
  } catch (err) {
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
