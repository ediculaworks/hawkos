type SseListener = (type: string, data: unknown) => void;

export function handleStreamRoute(
  path: string,
  method: string,
  req: Request,
  corsHeaders: Record<string, string>,
  sseClients: Map<string, SseListener>,
): Response | null {
  if (path !== '/stream' || method !== 'GET') return null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const clientId = crypto.randomUUID();

      function send(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      }

      send('connected', { clientId, timestamp: new Date().toISOString() });

      const listener: SseListener = (type, payload) => {
        send(type, payload);
      };

      sseClients.set(clientId, listener);

      const keepalive = setInterval(() => {
        send('heartbeat', { timestamp: new Date().toISOString() });
      }, 15_000);

      function cleanup() {
        sseClients.delete(clientId);
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }

      req.signal.addEventListener('abort', cleanup, { once: true });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
