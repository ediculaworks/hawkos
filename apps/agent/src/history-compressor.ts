/**
 * History compression — uses worker LLM to summarize old messages
 * when conversation approaches token limits.
 *
 * Threshold strategy:
 * - 60k tokens → compress silently (user doesn't notice)
 * - 80k tokens → warn LLM to save memories (existing behavior)
 */

interface Message {
  role: string;
  content: string;
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

    const response = await client.chat.completions.create({
      model: WORKER_MODEL,
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Summarize this conversation concisely in Portuguese. Focus on: decisions made, information shared, pending questions. Max 3 paragraphs.',
        },
        { role: 'user', content: conversationText },
      ],
    });

    summary = response.choices[0]?.message.content ?? '';
  } catch {
    // Fallback: simple extraction of key messages
    summary = oldMessages
      .filter((m) => m.role === 'user')
      .slice(-5)
      .map((m) => `- ${m.content.slice(0, 100)}`)
      .join('\n');
  }

  return { summary, recentMessages };
}
