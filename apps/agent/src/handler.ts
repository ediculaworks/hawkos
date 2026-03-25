import { assembleContext } from '@hawk/context-engine';
import { db } from '@hawk/db';
import { embedMemory } from '@hawk/module-memory/embeddings';
import { createMemory, getSessionMessages, saveMessage } from '@hawk/module-memory/queries';
import { retrieveMemories, trackMemoryAccess } from '@hawk/module-memory/retrieval';
import { getLastSessionArchive } from '@hawk/module-memory/session-commit';
import type { MemoryType } from '@hawk/module-memory/types';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { ResolvedAgent } from './agent-resolver.js';
import { buildSystemPrompt, resolveAgent } from './agent-resolver.js';
import { addSession, updateSession } from './api/server.js';
import { hookRegistry } from './hooks/index.js';
import { type TOOLS, getToolsForModules } from './tools/index.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const activityDb = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
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

// ── Session Management (NanoClaw-inspired) ─────────────────
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_GC_INTERVAL_MS = 5 * 60 * 1000; // cleanup every 5 min

const activeSessions = new Map<string, { sessionId: string; lastActivity: number }>();
const webSessions = new Map<string, { lastActivity: number }>();

// ── Rate Limiting ──────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // max 20 messages per minute per channel
const rateLimiter = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(channelId: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(channelId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimiter.set(channelId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── Session GC ─────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of activeSessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      activeSessions.delete(key);
    }
  }
  for (const [key, session] of webSessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      webSessions.delete(key);
    }
  }
  // Cleanup stale rate limiter entries
  for (const [key, entry] of rateLimiter) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimiter.delete(key);
    }
  }
}, SESSION_GC_INTERVAL_MS);

function getOrCreateSession(channelId: string): { sessionId: string; isNew: boolean } {
  const existing = activeSessions.get(channelId);
  const now = Date.now();

  if (existing && now - existing.lastActivity < SESSION_TTL_MS) {
    existing.lastActivity = now;
    return { sessionId: existing.sessionId, isNew: false };
  }

  const sessionId = crypto.randomUUID();
  activeSessions.set(channelId, { sessionId, lastActivity: now });
  return { sessionId, isNew: true };
}

function touchWebSession(sessionId: string): void {
  webSessions.set(sessionId, { lastActivity: Date.now() });
}

// ── Core LLM Session ──────────────────────────────────────

export type Attachment = { type: 'image'; url: string };

async function runLLMSession(params: {
  sessionId: string;
  userMessage: string;
  channel: 'discord' | 'web';
  agent: ResolvedAgent;
  isNewSession: boolean;
  onChunk?: (chunk: string) => void;
  attachments?: Attachment[];
}): Promise<string> {
  const { sessionId, userMessage, channel, agent, isNewSession, onChunk, attachments } = params;

  // 0. Emit hooks
  if (isNewSession) {
    hookRegistry.emit('session:start', { sessionId, channel }).catch(() => {});
  }
  hookRegistry
    .emit('message:received', { sessionId, channel, message: userMessage })
    .catch(() => {});

  // 1. Save user message
  await saveMessage({
    session_id: sessionId,
    role: 'user',
    content: userMessage,
    channel,
  }).catch((err) => console.error('[handler] Failed to save user message:', err));

  // 2. Load context in parallel (all with error handling to prevent single-point crashes)
  const [contextResult, memoriesResult, historyResult, previousSessionResult] =
    await Promise.allSettled([
      assembleContext(userMessage),
      retrieveMemories(userMessage, 5),
      getSessionMessages(sessionId, 20),
      isNewSession ? getLastSessionArchive(channel) : Promise.resolve(null),
    ]);

  const context =
    contextResult.status === 'fulfilled'
      ? contextResult.value
      : { l0: '', l1: '', l2: '', modulesLoaded: [] as string[], relevanceScores: [] };
  const memories = memoriesResult.status === 'fulfilled' ? memoriesResult.value : [];
  const history = historyResult.status === 'fulfilled' ? historyResult.value : [];
  const previousSession =
    previousSessionResult.status === 'fulfilled' ? previousSessionResult.value : null;

  if (contextResult.status === 'rejected') {
    console.error(
      '[handler] Context assembly failed, running with empty context:',
      contextResult.reason,
    );
  }

  // 3. Track memory access (increment hotness)
  const memoryIds = memories.map((m) => m.id).filter(Boolean);
  trackMemoryAccess(memoryIds).catch((err) =>
    console.error('[handler] Failed to track memory access:', err),
  );

  // 4. Build context section (separate procedural memories as rules)
  const proceduralMemories = memories.filter((m) => m.memory_type === 'procedure');
  const regularMemories = memories.filter((m) => m.memory_type !== 'procedure');

  const contextSection = [
    context.l0 ? `## Contexto dos módulos\n${context.l0}` : '',
    proceduralMemories.length > 0
      ? `## Regras aprendidas (SEMPRE seguir)\n${proceduralMemories.map((m) => `- ${m.content}`).join('\n')}`
      : '',
    regularMemories.length > 0
      ? `## Memórias sobre o usuário\n${regularMemories.map((m) => `- [${m.category}] ${m.content}`).join('\n')}`
      : '',
    previousSession
      ? `## Sessão anterior\n${previousSession.abstract}\n\n### Detalhes\n${previousSession.overview}`
      : '',
    context.l1 ? `## Detalhes\n${context.l1}` : '',
    context.l2 ? `## Dados específicos\n${context.l2}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  // 5. Build system prompt from agent template
  const systemPrompt = buildSystemPrompt(agent, contextSection);

  // 6. Build messages array with conversation history
  const messages: OpenAI.ChatCompletionMessageParam[] = [{ role: 'system', content: systemPrompt }];

  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      if (
        msg.role === 'user' &&
        msg.content === userMessage &&
        msg === history[history.length - 1]
      ) {
        continue;
      }
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Build user message content (text + optional images for multimodal)
  if (attachments && attachments.length > 0) {
    const contentParts: OpenAI.ChatCompletionContentPart[] = [
      { type: 'text', text: userMessage },
      ...attachments.map((a) => ({
        type: 'image_url' as const,
        image_url: { url: a.url },
      })),
    ];
    messages.push({ role: 'user', content: contentParts });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  // 6b. Context compaction — warn agent to save memories if near token limit
  const COMPACTION_THRESHOLD = Number(process.env.COMPACTION_THRESHOLD_TOKENS) || 80_000;
  const estimatedTokens = messages.reduce(
    (sum, m) => sum + Math.ceil(((m as { content?: string }).content?.length ?? 0) / 4),
    0,
  );
  if (estimatedTokens > COMPACTION_THRESHOLD) {
    messages.splice(messages.length - 1, 0, {
      role: 'system',
      content:
        'AVISO: A sessão está próxima do limite de contexto. Antes de responder, use save_memory para salvar qualquer informação importante que o usuário compartilhou nesta sessão e que ainda não foi salva como memória.',
    });
  }

  // 7. Dynamic tool routing — filter by detected modules intersected with agent's scope
  const allowedModules =
    agent.toolsEnabled.length > 0
      ? context.modulesLoaded.filter((m) => agent.toolsEnabled.includes(m))
      : context.modulesLoaded;
  const { tools: filteredTools, toolMap } = getToolsForModules(allowedModules);

  // 7b. Log module detection for ML training data
  logActivity('module_detection', `Detected: ${allowedModules.join(', ') || 'none'}`, undefined, {
    detected_modules: allowedModules,
    relevance_scores: context.relevanceScores,
    message_preview: userMessage.slice(0, 120),
    tools_offered: filteredTools.map((t) => (t as { function: { name: string } }).function.name),
  }).catch(() => {});

  // 8. Call LLM with agent's model + fallback chain for 429/rate limits
  const hasTools = filteredTools.length > 0;
  const FALLBACK_MODELS = [
    'stepfun/step-3.5-flash:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'openrouter/free',
  ];

  async function callLLM(
    msgs: OpenAI.ChatCompletionMessageParam[],
    stream: boolean,
  ): Promise<{
    content: string | null;
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
    finishReason: string | null;
    usage?: { total_tokens?: number };
  }> {
    const modelsToTry = [agent.model, ...FALLBACK_MODELS.filter((m) => m !== agent.model)];

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      try {
        return await _callLLMOnce(msgs, stream, model ?? agent.model);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 429 || status === 403) {
          console.warn(`[handler] Model ${model} returned ${status}, trying fallback...`);
          if (i < modelsToTry.length - 1) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
        }
        throw err;
      }
    }
    throw new Error('All models exhausted');
  }

  async function _callLLMOnce(
    msgs: OpenAI.ChatCompletionMessageParam[],
    stream: boolean,
    model: string,
  ): Promise<{
    content: string | null;
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
    finishReason: string | null;
    usage?: { total_tokens?: number };
  }> {
    const opts = {
      model,
      max_tokens: agent.maxTokens,
      messages: msgs,
      tools: hasTools ? filteredTools : undefined,
      tool_choice: hasTools ? 'auto' : undefined,
    };

    if (stream && onChunk) {
      // Streaming mode
      const streamResponse = await getClient().chat.completions.create({
        ...opts,
        stream: true,
      } as never);
      let content = '';
      const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
      let finishReason: string | null = null;

      for await (const chunk of streamResponse as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          onChunk(delta.content);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.index !== undefined) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = {
                  id: tc.id ?? '',
                  type: 'function',
                  function: { name: tc.function?.name ?? '', arguments: '' },
                };
              }
              const entry = toolCalls[tc.index];
              if (entry) {
                if (tc.id) entry.id = tc.id;
                if (tc.function?.name) entry.function.name = tc.function.name;
                if (tc.function?.arguments) entry.function.arguments += tc.function.arguments;
              }
            }
          }
        }
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }

      return { content: content || null, toolCalls: toolCalls.filter(Boolean), finishReason };
    }

    // Non-streaming mode
    const response = await getClient().chat.completions.create(opts as never);
    const choice = response.choices[0];
    return {
      content: choice?.message.content ?? null,
      toolCalls: choice?.message.tool_calls ?? [],
      finishReason: choice?.finish_reason ?? null,
      usage: response.usage as { total_tokens?: number } | undefined,
    };
  }

  // First call — stream if we have onChunk
  let result = await callLLM(messages, !!onChunk);

  // Track which tools were actually called (for ML training data)
  const toolsActuallyUsed: string[] = [];

  // 9. Handle tool calls (always non-streaming during tool loop)
  while (result.finishReason === 'tool_calls' && result.toolCalls.length > 0) {
    const toolMessages: OpenAI.ChatCompletionMessageParam[] = [
      ...messages,
      { role: 'assistant', content: result.content, tool_calls: result.toolCalls },
    ];

    // Track tool names for ML logging
    for (const tc of result.toolCalls) {
      toolsActuallyUsed.push(tc.function.name);
    }

    // Execute tool calls in parallel (they are independent)
    const toolResults = await Promise.allSettled(
      result.toolCalls.map((tc) => executeToolCall(tc, toolMap, sessionId)),
    );
    for (let i = 0; i < result.toolCalls.length; i++) {
      const tc = result.toolCalls[i];
      if (!tc) continue;
      const settled = toolResults[i];
      const toolResult =
        settled?.status === 'fulfilled'
          ? settled.value
          : `Erro ao executar ${tc.function.name}: ${settled?.status === 'rejected' ? settled.reason : 'unknown'}`;
      toolMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: toolResult,
      });
    }

    // After tools, stream the final response
    result = await callLLM(toolMessages, !!onChunk);
  }

  const content = result.content;
  if (!content) {
    const errorMsg = `Empty response from AI (${agent.name}/${agent.model}): finish_reason=${result.finishReason}`;
    logActivity('error', errorMsg, 'agent', {});
    throw new Error(errorMsg);
  }

  // 10. Save assistant response
  const msgTokens = result.usage?.total_tokens;
  await saveMessage({
    session_id: sessionId,
    role: 'assistant',
    content,
    channel,
    ...(msgTokens !== undefined ? { tokens_used: msgTokens } : {}),
  }).catch((err) => console.error('[handler] Failed to save assistant message:', err));

  // 10b. Log tools actually used vs detected modules (ML training: module detection accuracy)
  if (toolsActuallyUsed.length > 0) {
    logActivity('module_detection', `Tools used: ${toolsActuallyUsed.join(', ')}`, undefined, {
      phase: 'post_session',
      detected_modules: allowedModules,
      tools_used: toolsActuallyUsed,
      session_id: sessionId,
    }).catch(() => {});
  }

  // Emit message:sent hook
  hookRegistry.emit('message:sent', { sessionId, channel, message: content }).catch(() => {});

  return content;
}

// ── Public handlers ───────────────────────────────────────

export async function handleWebMessage(
  sessionId: string,
  userMessage: string,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  // Rate limit both per-session AND globally for web (prevent session-ID spoofing bypass)
  if (!checkRateLimit(`web:${sessionId}`) || !checkRateLimit('web:global')) {
    throw new Error('Rate limit exceeded. Aguarde um momento antes de enviar mais mensagens.');
  }
  touchWebSession(sessionId);
  const agent = await resolveAgent(sessionId, 'web');
  const llmResult = await runLLMSession({
    sessionId,
    userMessage,
    channel: 'web',
    agent,
    isNewSession: false,
    onChunk,
  });
  touchWebSession(sessionId);
  return llmResult;
}

export async function handleMessage(
  userMessage: string,
  channelId?: string,
  attachments?: Attachment[],
): Promise<string> {
  const channel = channelId ?? 'default';
  if (!checkRateLimit(`discord:${channel}`)) {
    return 'Rate limit: aguarde um momento antes de enviar mais mensagens.';
  }
  const { sessionId, isNew } = getOrCreateSession(channel);

  if (isNew) {
    addSession(sessionId, channel);
    // Persist Discord session to DB so it appears in web chat
    Promise.resolve(
      activityDb?.from('agent_conversations').upsert(
        {
          session_id: sessionId,
          channel: 'discord',
          started_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' },
      ),
    ).catch((err: unknown) =>
      console.error('[handler] Failed to upsert Discord conversation:', err),
    );
  } else {
    updateSession(sessionId);
    // Update timestamp in DB
    Promise.resolve(
      activityDb
        ?.from('agent_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('session_id', sessionId),
    ).catch(() => {});
  }

  const agent = await resolveAgent(sessionId, 'discord');
  const response = await runLLMSession({
    sessionId,
    userMessage,
    channel: 'discord',
    agent,
    isNewSession: isNew,
    attachments,
  });

  // Auto-title Discord sessions from first user message
  if (isNew && activityDb) {
    const autoTitle = userMessage.length > 50 ? `${userMessage.slice(0, 47)}...` : userMessage;
    Promise.resolve(
      activityDb
        .from('agent_conversations')
        .update({ title: autoTitle })
        .eq('session_id', sessionId)
        .is('title', null),
    ).catch(() => {});
  }

  return response;
}

/**
 * Handle a message from an automation (heartbeat, cron, etc).
 * Runs as Hawk agent without session persistence or rate limiting.
 */
export async function handleAutomationMessage(prompt: string): Promise<string> {
  const sessionId = `automation-${Date.now()}`;
  const agent = await resolveAgent(sessionId, 'discord');
  return runLLMSession({
    sessionId,
    userMessage: prompt,
    channel: 'discord',
    agent,
    isNewSession: true,
  });
}

// ── Activity Logging ───────────────────────────────────────

async function logActivity(
  eventType: string,
  summary: string,
  moduleName?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  // Always log to console as fallback
  const logLine = `[activity] ${eventType} ${moduleName ?? '-'}: ${summary}`;
  if (eventType === 'error') {
    console.error(logLine);
  }

  if (!activityDb) return;

  const mod = moduleName ?? undefined;
  try {
    await (
      activityDb as unknown as {
        from: (table: string) => {
          insert: (data: Record<string, unknown>) => Promise<{ error: Error | null }>;
        };
      }
    )
      .from('activity_log')
      .insert({
        event_type: eventType,
        module: mod,
        summary,
        metadata: metadata ?? {},
      });
  } catch (err) {
    console.error('[handler] Failed to write activity log:', err);
  }
}

// ── Tool execution ─────────────────────────────────────────

async function executeToolCall(
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
    // Emit tool:before hook
    await hookRegistry
      .emit('tool:before', { sessionId, toolName: name, toolArgs: args })
      .catch(() => {});

    const startMs = Date.now();
    const result = await toolDef.handler(args);
    const durationMs = Date.now() - startMs;

    // Emit tool:after hook
    hookRegistry
      .emit('tool:after', {
        sessionId,
        toolName: name,
        toolArgs: args,
        toolResult: result,
        durationMs,
      })
      .catch(() => {});

    // Log activity
    const module = toolDef.modules[0];
    logActivity('tool_call', `${name}: ${result.slice(0, 100)}`, module, {
      tool: name,
      args,
    }).catch((err) => console.error('[handler] Failed to log tool activity:', err));

    return result;
  } catch (err) {
    const errorMsg = `Erro ao executar ${name}: ${err}`;
    logActivity('error', errorMsg, toolDef.modules[0]).catch((err) =>
      console.error('[handler] Failed to log error:', err),
    );
    return errorMsg;
  }
}

async function handleSaveMemory(
  args: { content: string; memory_type: string; module?: string; importance?: number },
  sessionId: string,
): Promise<string> {
  try {
    // Map memory_type to legacy category for backward compat
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

    // Generate embedding async (don't block response)
    embedMemory(memory.id, args.content).catch((err) =>
      console.error('[handler] Failed to embed memory:', err),
    );

    // Update memory_type field directly
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
      {
        memory_id: memory.id,
        memory_type: args.memory_type,
      },
    ).catch((err) => console.error('[handler] Failed to log memory creation:', err));

    return `Memória salva: [${args.memory_type}] ${args.content.slice(0, 50)}...`;
  } catch (err) {
    return `Erro ao salvar memória: ${err}`;
  }
}
