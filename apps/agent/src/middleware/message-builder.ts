/**
 * Message builder middleware — assembles the messages array for the LLM call.
 * Handles system prompt, history, user message, compression, and compaction.
 */

import type OpenAI from 'openai';
import { buildSystemPrompt } from '../agent-resolver.js';
import { compressHistory, needsCompression } from '../history-compressor.js';
import { estimateTokenCount } from '../model-router.js';
import type { HandlerContext, Middleware } from './types.js';

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

const REACT_INSTRUCTION = `
When handling complex or multi-step requests, follow this reasoning pattern:
1. THINK: Analyze what information you need and which tools to use
2. ACT: Execute the necessary tools
3. OBSERVE: Check if the results fully answer the question
4. REFLECT: If incomplete, explain what's missing and plan next steps

For simple greetings, quick facts, or single-module queries, respond directly.

When you are uncertain about information (no tool results, working from memory, or data is older than a week), prefix your statement with "Acredito que..." or "Não tenho certeza, mas..." to signal confidence level. Never state uncertain facts as definitive.`;

/** Extract string content from a message for token estimation (handles multimodal) */
function getMessageText(msg: OpenAI.ChatCompletionMessageParam): string {
  const content = (msg as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join(' ');
  }
  return '';
}

/** Estimate total tokens for a messages array (computed once, not twice) */
function estimateMessagesTokens(
  messages: OpenAI.ChatCompletionMessageParam[],
  model: string,
): number {
  return messages.reduce((sum, m) => sum + estimateTokenCount(getMessageText(m), model), 0);
}

export const messageBuilderMiddleware: Middleware = {
  name: 'message-builder',
  execute: async (ctx: HandlerContext, next) => {
    // Build system prompt
    const basePrompt = buildSystemPrompt(ctx.agent, ctx.contextSection);
    const platformHint = PLATFORM_HINTS[ctx.channel] ?? '';
    const systemPrompt = [basePrompt, platformHint, ctx.isComplexQuery ? REACT_INSTRUCTION : '']
      .filter(Boolean)
      .join('\n\n');

    // Build messages array
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (excluding duplicate of current message)
    for (const msg of ctx.history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        if (
          msg.role === 'user' &&
          msg.content === ctx.originalMessage &&
          msg === ctx.history[ctx.history.length - 1]
        ) {
          continue;
        }
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Build user message content (text + optional images)
    if (ctx.attachments && ctx.attachments.length > 0) {
      const contentParts: OpenAI.ChatCompletionContentPart[] = [
        { type: 'text', text: ctx.sanitizedMessage },
        ...ctx.attachments.map((a) => ({
          type: 'image_url' as const,
          image_url: { url: a.url },
        })),
      ];
      messages.push({ role: 'user', content: contentParts });
    } else {
      messages.push({ role: 'user', content: ctx.sanitizedMessage });
    }

    // History compression (estimate tokens once)
    let estimatedTokens = estimateMessagesTokens(messages, ctx.agent.model);

    if (
      ctx.agent.historyCompressionEnabled &&
      needsCompression(estimatedTokens) &&
      ctx.history.length > 12
    ) {
      try {
        const historyMessages = ctx.history.map((m) => ({ role: m.role, content: m.content }));
        const { summary, recentMessages } = await compressHistory(historyMessages);
        if (summary) {
          const userMsg = messages[messages.length - 1];
          messages.length = 1; // keep system prompt
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
          // Re-estimate after compression changed the messages
          estimatedTokens = estimateMessagesTokens(messages, ctx.agent.model);
        }
      } catch (err) {
        console.warn('[middleware:message-builder] History compression failed:', err);
      }
    }

    // Context compaction warning (reuse estimatedTokens — no double calculation)
    const COMPACTION_THRESHOLD = Number(process.env.COMPACTION_THRESHOLD_TOKENS) || 80_000;
    if (estimatedTokens > COMPACTION_THRESHOLD) {
      messages.splice(messages.length - 1, 0, {
        role: 'system',
        content:
          'AVISO: A sessão está próxima do limite de contexto. Antes de responder, use save_memory para salvar qualquer informação importante que o usuário compartilhou nesta sessão e que ainda não foi salva como memória.',
      });
    }

    ctx.messages = messages;

    await next();
  },
};
