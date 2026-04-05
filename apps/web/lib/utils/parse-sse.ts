/**
 * Async generator that reads a Server-Sent Events (SSE) response stream
 * and yields parsed JSON objects from `data:` lines.
 *
 * Stops when it receives `data: [DONE]` or the stream ends.
 */
export async function* parseSseStream(response: Response): AsyncGenerator<{
  type: string;
  content?: string;
  payload?: Record<string, unknown>;
  error?: string;
}> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;
        try {
          yield JSON.parse(raw) as {
            type: string;
            content?: string;
            payload?: Record<string, unknown>;
            error?: string;
          };
        } catch {
          // skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
