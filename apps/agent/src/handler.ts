import { assembleContext } from '@hawk/context-engine';
import { db as activityDb } from '@hawk/db';
import { getSessionMessages, saveMessage } from '@hawk/module-memory/queries';
import { retrieveMemories, trackMemoryAccess } from '@hawk/module-memory/retrieval';
import { getLastSessionArchive } from '@hawk/module-memory/session-commit';
import {
  HawkError,
  HawkErrorCode,
  createLogger,
  getFeatureFlag,
  redactSecrets,
  scanForInjection,
  stripSuspiciousUnicode,
} from '@hawk/shared';
import OpenAI from 'openai';
import { logActivity } from './activity-logger.js';
import type { ResolvedAgent } from './agent-resolver.js';
import { buildSystemPrompt, resolveAgent } from './agent-resolver.js';
import { addSession, updateSession } from './api/server.js';
import { createSessionCost, estimateCostUsd, trackLLMCall, trackToolCall } from './cost-tracker.js';
import { compressHistory, needsCompression } from './history-compressor.js';
import { hookRegistry } from './hooks/index.js';
import {
  classifyComplexity,
  estimateTokenCount,
  getContextLimit,
  getDailyUsage,
  persistUsage,
  selectModel,
  supportsToolChoice,
  trackUsage,
} from './model-router.js';
import { checkRateLimit, getOrCreateSession, touchWebSession } from './session-manager.js';
import { executeToolCall } from './tool-executor.js';
import { getToolsForModules } from './tools/index.js';

const logger = createLogger('handler');

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

  // 0b. Security: strip suspicious unicode + scan for prompt injection
  let sanitizedMessage = stripSuspiciousUnicode(userMessage);
  if (getFeatureFlag('prompt-injection-scanning')) {
    const scanResult = scanForInjection(sanitizedMessage);
    if (scanResult.threatLevel === 'critical' || scanResult.threatLevel === 'high') {
      logActivity(
        'security',
        `Injection detected: ${scanResult.matchedPatterns.join(', ')}`,
        undefined,
        {
          threatLevel: scanResult.threatLevel,
          score: scanResult.score,
          patterns: scanResult.matchedPatterns,
          session_id: sessionId,
        },
      ).catch(() => {});
      logger.warn(
        {
          sessionId,
          threatLevel: scanResult.threatLevel,
          score: scanResult.score,
          patterns: scanResult.matchedPatterns,
        },
        'Prompt injection detected',
      );
    }
  }

  // 0c. Security: redact secrets from user message before LLM context
  if (getFeatureFlag('secret-redaction')) {
    const redaction = redactSecrets(sanitizedMessage);
    if (redaction.redactedCount > 0) {
      sanitizedMessage = redaction.text;
      logActivity(
        'security',
        `Redacted ${redaction.redactedCount} secret(s): ${redaction.redactedPatterns.join(', ')}`,
        undefined,
        {
          redactedCount: redaction.redactedCount,
          patterns: redaction.redactedPatterns,
          session_id: sessionId,
        },
      ).catch(() => {});
      logger.warn(
        { sessionId, count: redaction.redactedCount, patterns: redaction.redactedPatterns },
        'Secrets redacted from user message',
      );
    }
  }

  // 1. Save user message (original, not redacted — redaction is only for LLM context)
  await saveMessage({
    session_id: sessionId,
    role: 'user',
    content: userMessage,
    channel,
  }).catch((err) => console.error('[handler] Failed to save user message:', err));

  // 2. Load context in parallel — per-component fault isolation
  //    Each component failure is logged independently and doesn't crash the handler.
  const [contextResult, memoriesResult, historyResult, previousSessionResult] =
    await Promise.allSettled([
      assembleContext(sanitizedMessage),
      retrieveMemories(sanitizedMessage, 5),
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

  // Per-component fault isolation — log each failure independently
  if (contextResult.status === 'rejected') {
    logger.error(
      { err: contextResult.reason, sessionId },
      'Context assembly failed (running with empty context)',
    );
    logActivity('error', `Context assembly failed: ${contextResult.reason}`, undefined, {
      component: 'context-engine',
      error_code: HawkErrorCode.CONTEXT_LOAD_FAILED,
      session_id: sessionId,
    }).catch(() => {});
  }
  if (memoriesResult.status === 'rejected') {
    logger.error(
      { err: memoriesResult.reason, sessionId },
      'Memory retrieval failed (running without memories)',
    );
    logActivity('error', `Memory retrieval failed: ${memoriesResult.reason}`, undefined, {
      component: 'memory-retrieval',
      error_code: HawkErrorCode.MEMORY_OPERATION_FAILED,
      session_id: sessionId,
    }).catch(() => {});
  }
  if (historyResult.status === 'rejected') {
    logger.error(
      { err: historyResult.reason, sessionId },
      'History loading failed (running without history)',
    );
    logActivity('error', `History loading failed: ${historyResult.reason}`, undefined, {
      component: 'session-history',
      error_code: HawkErrorCode.DB_QUERY_FAILED,
      session_id: sessionId,
    }).catch(() => {});
  }
  if (previousSessionResult.status === 'rejected') {
    logger.warn(
      { err: previousSessionResult.reason, sessionId },
      'Previous session loading failed',
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

  let contextSection = [
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

  // Redact any secrets that may have leaked into context (memories, DB data, etc.)
  if (getFeatureFlag('secret-redaction')) {
    const contextRedaction = redactSecrets(contextSection);
    if (contextRedaction.redactedCount > 0) {
      contextSection = contextRedaction.text;
      logger.warn(
        { count: contextRedaction.redactedCount },
        'Secrets redacted from context section',
      );
    }
  }

  // 5. Build system prompt from agent template + platform-specific hints
  const basePrompt = buildSystemPrompt(agent, contextSection);

  // 5a. Platform-specific formatting hints
  const PLATFORM_HINTS: Record<string, string> = {
    discord: `## Formatação (Discord)
- Limite de 2000 caracteres por mensagem. Se a resposta for longa, divida em partes.
- Use **negrito** e *itálico* para ênfase. Use \`code\` para termos técnicos.
- Listas: use - ou • (não números para listas curtas).
- Emojis: use com moderação para categorizar (✅ ❌ ⚠️ 📊 💰).
- Tabelas não renderizam no Discord — use listas formatadas.
- Blocos de código: use \`\`\` para dados estruturados.
- Não use headings (#) — Discord os renderiza mal.`,
    web: `## Formatação (Web Dashboard)
- Sem limite de caracteres. Pode usar respostas mais detalhadas.
- Use Markdown completo: headings (#, ##), tabelas, listas ordenadas.
- Tabelas são preferidas para dados comparativos.
- Blocos de código com syntax highlighting: \`\`\`sql, \`\`\`json.
- Links: use [texto](url) para referências.`,
  };

  const platformHint = PLATFORM_HINTS[channel] ?? '';

  // 5b. ReAct: detect complex queries that benefit from structured reasoning
  const reactEnabled =
    agent.reactMode === 'always' ||
    (agent.reactMode === 'auto' &&
      (context.relevanceScores.length >= 2 ||
        /\b(analis|compar|plan[ei]j|revis|resum|organiz|avali|otimiz|prioriz)/i.test(userMessage)));
  const isComplexQuery = reactEnabled;

  const REACT_INSTRUCTION = `
When handling complex or multi-step requests, follow this reasoning pattern:
1. THINK: Analyze what information you need and which tools to use
2. ACT: Execute the necessary tools
3. OBSERVE: Check if the results fully answer the question
4. REFLECT: If incomplete, explain what's missing and plan next steps

For simple greetings, quick facts, or single-module queries, respond directly.

When you are uncertain about information (no tool results, working from memory, or data is older than a week), prefix your statement with "Acredito que..." or "Não tenho certeza, mas..." to signal confidence level. Never state uncertain facts as definitive.`;

  const systemPrompt = [basePrompt, platformHint, isComplexQuery ? REACT_INSTRUCTION : '']
    .filter(Boolean)
    .join('\n\n');

  // 5c. Initialize cost tracking (respects feature flag)
  const sessionCost = agent.costTrackingEnabled ? createSessionCost(agent.model) : null;

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
  // Uses sanitizedMessage (secrets redacted, unicode cleaned) for LLM context
  if (attachments && attachments.length > 0) {
    const contentParts: OpenAI.ChatCompletionContentPart[] = [
      { type: 'text', text: sanitizedMessage },
      ...attachments.map((a) => ({
        type: 'image_url' as const,
        image_url: { url: a.url },
      })),
    ];
    messages.push({ role: 'user', content: contentParts });
  } else {
    messages.push({ role: 'user', content: sanitizedMessage });
  }

  // 6b. History compression — silently compress old messages at 60k tokens
  const estimatedTokens = messages.reduce(
    (sum, m) => sum + estimateTokenCount((m as { content?: string }).content ?? '', agent.model),
    0,
  );

  if (agent.historyCompressionEnabled && needsCompression(estimatedTokens) && history.length > 12) {
    try {
      const historyMessages = history.map((m) => ({ role: m.role, content: m.content }));
      const { summary, recentMessages } = await compressHistory(historyMessages);
      if (summary) {
        // Rebuild messages: system + summary + recent history + user message
        const userMsg = messages[messages.length - 1]; // preserve current user message
        messages.length = 1; // keep system prompt only
        messages.push({
          role: 'system',
          content: `## Resumo da conversa anterior\n${summary}`,
        });
        for (const msg of recentMessages) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
          }
        }
        if (userMsg) messages.push(userMsg);
      }
    } catch (err) {
      console.warn('[handler] History compression failed, continuing with full history:', err);
    }
  }

  // 6c. Context compaction — warn agent to save memories if near token limit
  const COMPACTION_THRESHOLD = Number(process.env.COMPACTION_THRESHOLD_TOKENS) || 80_000;
  const estimatedTokensAfterCompression = messages.reduce(
    (sum, m) => sum + estimateTokenCount((m as { content?: string }).content ?? '', agent.model),
    0,
  );
  if (estimatedTokensAfterCompression > COMPACTION_THRESHOLD) {
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

  // 8. Smart model routing — select model based on query complexity
  const hasTools = filteredTools.length > 0;
  const complexity = classifyComplexity(userMessage, context.relevanceScores.length);
  const selectedModel = selectModel(complexity, agent.model);

  // 7b. Log module detection for ML training data
  logActivity('module_detection', `Detected: ${allowedModules.join(', ') || 'none'}`, undefined, {
    detected_modules: allowedModules,
    relevance_scores: context.relevanceScores,
    message_preview: userMessage.slice(0, 120),
    tools_offered: filteredTools.map((t) => (t as { function: { name: string } }).function.name),
    complexity,
    selected_model: selectedModel,
    base_model: agent.model,
  }).catch(() => {});

  // Fallback models split by tool_choice support — avoid sending tool_choice
  // to models that don't support it, which causes 400 errors or silent failures.
  const FALLBACK_MODELS_WITH_TOOL_CHOICE = [
    'qwen/qwen3.6-plus:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
  ];
  const FALLBACK_MODELS_NO_TOOL_CHOICE = ['stepfun/step-3.5-flash:free', 'openrouter/free'];
  const FALLBACK_MODELS = hasTools
    ? FALLBACK_MODELS_WITH_TOOL_CHOICE
    : [...FALLBACK_MODELS_WITH_TOOL_CHOICE, ...FALLBACK_MODELS_NO_TOOL_CHOICE];

  async function callLLM(
    msgs: OpenAI.ChatCompletionMessageParam[],
    stream: boolean,
  ): Promise<{
    content: string | null;
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
    finishReason: string | null;
    usage?: { total_tokens?: number };
  }> {
    const modelsToTry = [selectedModel, ...FALLBACK_MODELS.filter((m) => m !== selectedModel)];

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
    logger.error({ models: modelsToTry }, 'All models exhausted');
    throw new HawkError('All models exhausted', 'LLM_CALL_FAILED');
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
    // Validate estimated tokens against model's context window
    const contextLimit = getContextLimit(model);
    const msgTokens = msgs.reduce(
      (sum, m) => sum + estimateTokenCount((m as { content?: string }).content ?? '', model),
      0,
    );
    if (msgTokens > contextLimit * 0.9) {
      logger.warn(
        { model, estimatedTokens: msgTokens, contextLimit },
        'Message tokens exceed 90% of model context window, may be truncated',
      );
    }

    // Respect model's tool_choice capability
    const useToolChoice = hasTools && supportsToolChoice(model);
    const opts = {
      model,
      max_tokens: agent.maxTokens,
      messages: msgs,
      tools: hasTools ? filteredTools : undefined,
      tool_choice: useToolChoice ? 'auto' : undefined,
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

  // Check daily budget before first LLM call
  const { overBudget } = trackUsage(0, 0); // just check without adding
  if (overBudget) {
    const usage = getDailyUsage();
    return `[Hawk OS] Limite diário de custo atingido ($${usage.cost.toFixed(2)}). Tente novamente amanhã.`;
  }

  // First call — stream if we have onChunk
  let result = await callLLM(messages, !!onChunk);
  if (sessionCost)
    trackLLMCall(
      sessionCost,
      result.usage as
        | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
        | undefined,
    );
  if (result.usage?.total_tokens) {
    trackUsage(
      result.usage.total_tokens,
      estimateCostUsd(result.usage.total_tokens, selectedModel),
    );
  }

  // Track which tools were actually called (for ML training data)
  const toolsActuallyUsed: string[] = [];
  const MAX_TOOL_ROUNDS = 5;
  let toolRound = 0;

  // 9. Handle tool calls (always non-streaming during tool loop)
  while (
    result.finishReason === 'tool_calls' &&
    result.toolCalls.length > 0 &&
    toolRound < MAX_TOOL_ROUNDS
  ) {
    toolRound++;
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

    // Track tool calls for cost
    if (sessionCost) trackToolCall(sessionCost, result.toolCalls.length);

    // ReAct reflect step — ask LLM to evaluate tool results on complex queries
    if (isComplexQuery && result.toolCalls.length > 1) {
      toolMessages.push({
        role: 'system',
        content:
          'Reflect briefly on the tool results above. Did they provide what you needed? If something is missing, explain what and use additional tools. Otherwise, synthesize a complete answer.',
      });
    }

    // After tools, stream the final response
    result = await callLLM(toolMessages, !!onChunk);
    if (sessionCost)
      trackLLMCall(
        sessionCost,
        result.usage as
          | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
          | undefined,
      );
    if (result.usage?.total_tokens) {
      trackUsage(
        result.usage.total_tokens,
        estimateCostUsd(result.usage.total_tokens, selectedModel),
      );
    }
  }

  if (toolRound >= MAX_TOOL_ROUNDS) {
    logger.warn({ sessionId, toolRound, tools: toolsActuallyUsed }, 'Hit max tool rounds limit');
  }

  const content = result.content;
  if (!content) {
    const errorMsg = `Empty response from AI (${agent.name}/${agent.model}): finish_reason=${result.finishReason}`;
    logger.error(
      { agent: agent.name, model: agent.model, finishReason: result.finishReason },
      'Empty LLM response',
    );
    logActivity('error', errorMsg, 'agent', {});
    throw new HawkError(errorMsg, 'LLM_CALL_FAILED');
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

  // 11. Log session cost (if tracking enabled) + persist to admin.tenant_metrics
  if (sessionCost) {
    logActivity(
      'session_cost',
      `tokens=${sessionCost.totalTokens} calls=${sessionCost.llmCalls} tools=${sessionCost.toolCalls}`,
      undefined,
      {
        ...sessionCost,
        session_id: sessionId,
        is_complex: isComplexQuery,
      },
    ).catch(() => {});
    persistUsage().catch(() => {});
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
    throw new HawkError(
      'Rate limit exceeded. Aguarde um momento antes de enviar mais mensagens.',
      'RATE_LIMITED',
    );
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
      activityDb.from('agent_conversations').upsert(
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
  if (isNew) {
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
 * Handle a Discord message with streaming support.
 * Same as handleMessage but accepts onChunk callback for progressive responses.
 */
export async function handleStreamingMessage(
  userMessage: string,
  channelId?: string,
  onChunk?: (chunk: string) => void,
  attachments?: Attachment[],
): Promise<string> {
  const channel = channelId ?? 'default';
  if (!checkRateLimit(`discord:${channel}`)) {
    return 'Rate limit: aguarde um momento antes de enviar mais mensagens.';
  }
  const { sessionId, isNew } = getOrCreateSession(channel);

  if (isNew) {
    addSession(sessionId, channel);
    Promise.resolve(
      activityDb.from('agent_conversations').upsert(
        {
          session_id: sessionId,
          channel: 'discord',
          started_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' },
      ),
    ).catch(() => {});
  } else {
    updateSession(sessionId);
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
    onChunk,
    attachments,
  });

  if (isNew) {
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
