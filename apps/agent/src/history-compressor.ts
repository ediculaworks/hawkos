/**
 * History compression — uses worker LLM to summarize old messages
 * when conversation approaches token limits.
 *
 * Threshold strategy:
 * - 60k tokens → compress silently (user doesn't notice)
 * - 80k tokens → warn LLM to save memories (existing behavior)
 *
 * Includes tool pair sanitization to prevent orphaned tool_calls
 * after compression (which break LLM requests).
 */

interface Message {
  role: string;
  content: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

const COMPRESSION_THRESHOLD = 60_000; // tokens (estimated)

/**
 * Check if history needs compression based on estimated token count.
 */
export function needsCompression(estimatedTokens: number): boolean {
  return estimatedTokens > COMPRESSION_THRESHOLD;
}

/**
 * Compress old messages into a summary, keeping recent messages intact.
 * Uses the worker LLM (Ollama/free) to avoid spending OpenRouter tokens.
 */
export async function compressHistory(
  messages: Message[],
  keepRecent = 10,
): Promise<{ summary: string; recentMessages: Message[] }> {
  if (messages.length <= keepRecent) {
    return { summary: '', recentMessages: messages };
  }

  const oldMessages = messages.slice(0, -keepRecent);
  const recentMessages = messages.slice(-keepRecent);

  // Build conversation text for summarization
  const conversationText = oldMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')
    .slice(0, 8000); // Cap input to ~2k tokens

  let summary: string;
  try {
    // Try worker LLM (Ollama local or free model)
    const { getWorkerClient, WORKER_MODEL } = await import('./llm-client.js');
    const client = getWorkerClient();

    // Iterative context summary template (inspired by Hermes Agent)
    // Structured as Goal/Progress/Decisions/Next for minimal information loss
    const response = await client.chat.completions.create({
      model: WORKER_MODEL,
      max_tokens: 600,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Summarize this conversation in Portuguese using this EXACT template:

**Objetivo:** O que o usuário estava tentando fazer/resolver (1 frase)
**Progresso:** O que já foi feito/respondido (2-3 pontos)
**Decisões:** Escolhas feitas ou preferências expressas (lista curta)
**Próximo:** O que ainda precisa ser feito ou respondido (se houver)
**Dados:** Números, datas, nomes ou valores mencionados (se houver)

Seja conciso. Máximo 200 palavras. Não invente informação.`,
        },
        { role: 'user', content: conversationText },
      ],
    });

    summary = response.choices[0]?.message.content ?? '';
  } catch {
    // Fallback: structured extraction without LLM
    const userMsgs = oldMessages.filter((m) => m.role === 'user');
    const assistantMsgs = oldMessages.filter((m) => m.role === 'assistant');
    summary = [
      `**Objetivo:** ${userMsgs[0]?.content.slice(0, 100) ?? 'N/A'}`,
      '**Progresso:**',
      ...userMsgs.slice(-3).map((m) => `- ${m.content.slice(0, 80)}`),
      '**Decisões:** (resumo automático — LLM indisponível)',
      ...assistantMsgs.slice(-2).map((m) => `- ${m.content.slice(0, 80)}`),
    ].join('\n');
  }

  // Sanitize tool pairs in recent messages to prevent orphaned tool_calls
  const sanitized = sanitizeToolPairs(recentMessages);

  return { summary, recentMessages: sanitized };
}

/**
 * Sanitize tool call/response pairs in message arrays.
 * After compression, the boundary may cut between an assistant tool_call
 * and its tool response, leaving orphaned messages that break LLM APIs.
 *
 * Rules:
 * 1. Remove tool response messages (role: 'tool') that have no matching
 *    assistant message with the corresponding tool_call_id in the array.
 * 2. Remove tool_calls from assistant messages if none of their IDs have
 *    matching tool responses in the array.
 *
 * Inspired by Hermes Agent's tool pair sanitization.
 */
export function sanitizeToolPairs(messages: Message[]): Message[] {
  // Collect all tool_call IDs from assistant messages
  const toolCallIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        const id = (tc as { id?: string }).id;
        if (id) toolCallIds.add(id);
      }
    }
  }

  // Collect all tool response IDs
  const toolResponseIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'tool' && msg.tool_call_id) {
      toolResponseIds.add(msg.tool_call_id);
    }
  }

  const result: Message[] = [];
  for (const msg of messages) {
    // Rule 1: drop orphaned tool responses (no matching assistant tool_call)
    if (msg.role === 'tool') {
      if (msg.tool_call_id && toolCallIds.has(msg.tool_call_id)) {
        result.push(msg);
      }
      // else: orphaned tool response — drop it
      continue;
    }

    // Rule 2: strip orphaned tool_calls from assistant messages
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const validCalls = msg.tool_calls.filter((tc) => {
        const id = (tc as { id?: string }).id;
        return id && toolResponseIds.has(id);
      });

      if (validCalls.length === 0) {
        // All tool_calls are orphaned — keep message but strip tool_calls
        result.push({ role: msg.role, content: msg.content });
      } else if (validCalls.length < msg.tool_calls.length) {
        // Some orphaned — keep only valid ones
        result.push({ ...msg, tool_calls: validCalls });
      } else {
        result.push(msg);
      }
      continue;
    }

    result.push(msg);
  }

  return result;
}
