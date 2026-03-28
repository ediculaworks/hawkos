/**
 * Tool execution — handles tool calls from LLM responses.
 * Extracted from handler.ts for separation of concerns.
 */

import { db } from '@hawk/db';
import { embedMemory } from '@hawk/module-memory/embeddings';
import { createMemory } from '@hawk/module-memory/queries';
import type { MemoryType } from '@hawk/module-memory/types';
import type OpenAI from 'openai';
import { logActivity } from './activity-logger.js';
import { hookRegistry } from './hooks/index.js';
import type { TOOLS } from './tools/index.js';

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

  // Handle save_memory specially — uses V2 memory system
  if (name === 'save_memory') {
    return handleSaveMemory(
      args as { content: string; memory_type: string; module?: string; importance?: number },
      sessionId,
    );
  }

  const toolDef = toolMap.get(name);
  if (!toolDef) {
    return `Erro: Ferramenta "${name}" não encontrada no contexto atual.`;
  }

  try {
    await hookRegistry
      .emit('tool:before', { sessionId, toolName: name, toolArgs: args })
      .catch(() => {});

    const startMs = Date.now();
    const result = await toolDef.handler(args);
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
  args: { content: string; memory_type: string; module?: string; importance?: number },
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
